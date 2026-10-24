# LinuxDocs Backend — Overview & Deploy Guide (for collaborators)

Start here if you were asked to deploy the backend. No prior knowledge of
the repo is needed — this file explains what the backend is, what you need,
and every step of the deploy in order. The deep-dive version with all the
"why" notes lives in [`DEPLOY_SUPABASE.md`](DEPLOY_SUPABASE.md).

---

## 1. What this backend is (plain-language summary)

A **Python Flask REST API** that stores everything for the LinuxDocs SPA:

| Area | What it does | Where the code lives |
| --- | --- | --- |
| App factory | One entry point, `create_app()`, wired with CORS, security headers, rate limits, error handlers | `backend/app/__init__.py` |
| Auth | Email/password sign-up + sign-in, short-lived JWT access token, long-lived **HttpOnly rotating sesions** (no JWT refresh token in JS reach) | `backend/app/auth.py` |
| User data | Bookmarks, notes, recently-viewed, per-user learning progress (merge-safe) | `backend/app/user.py`, `progress*.py` |
| Catalog | Read-only command reference (index, per-command docs) served from a JSON dataset | `backend/app/commands.py` |
| Health | `/api/health` = "process is up"; `/api/ready` = real `SELECT 1` against the DB + latency + connection mode; any DB failure answers `503 {error, request_id}` instead of a raw 500 | `backend/app/__init__.py` |
| DB layer | `database.py` normalizes any Supabase connection string (adds `sslmode=require` off-localhost, rewrites legacy `postgres://` URLs), picks the pool mode, retries cold-started databases 3× with backoff, and **never logs credentials** | `backend/app/database.py` |

**Stack:** Flask 3 · Flask-SQLAlchemy · Alembic (Flask-Migrate) · Flask-Bcrypt ·
Flask-JWT-Extended · psycopg 3 (binary) · Gunicorn · Python 3.11.

**Database schema is owned by migrations** — not auto-created:
`backend/migrations/versions/` holds `001_initial` (core tables),
`002_user_progress` (learning progress), `003_rls_lockdown` (Row Level
Security enabled on every table, zero permissive policies). The start command
runs `flask db upgrade` on every deploy (idempotent — no-ops at head).

**7 tables:** `users`, `sessions`, `password_reset_tokens`, `bookmarks`,
`user_notes`, `recently_viewed`, `user_progress`.

**How it runs in production:**
```
Browser ──► Vercel (built SPA, vercel.json rewrites /api/*) ──► Render
             (Flask in Gunicorn, 1 worker / 4 threads) ──► Supabase Postgres
```
The browser only ever talks to the Vercel domain, so auth cookies stay
first-party. Locally, the backend runs on plain **SQLite**
(`backend/instance/app.db`, auto-created on first `flask db upgrade`) —
Supabase/Postgres is only involved in production.

**Safety model in one line:** the Supabase anon/service keys are never used
by the app; migrations lock every table behind RLS so a leaked anon key
reads zero rows, and the recommended setting disables Supabase's Data API
altogether.

---

## 2. What you need before starting

| Account | Used for | Cost |
| --- | --- | --- |
| GitHub (already have it — that's this repo) | repo access | free |
| Supabase | managed Postgres database | free tier |
| Render | hosts the Flask API | free tier |
| Vercel | hosts the frontend | free tier (repo owner usually owns this) |

Time estimate: **~20–30 minutes**. Nothing below stores passwords in the
repo; secrets are pasted into platform dashboards only.

---

## 3. Who does what (important!)

The **deployer (you)** can do everything below.

The **repo owner** keeps the one real secret — the Supabase `DATABASE_URL` —
out of your reach unless the owner chooses otherwise. Two clean patterns:

- **Pattern A (recommended):** the deployer creates the Supabase project and
  the Render service, then the **owner** pastes `DATABASE_URL` into the
  Render dashboard (Environment → edit → Add). The deployer never sees it.
- **Pattern B (scratch testing):** the deployer creates their **own** Supabase
  project and connects the service to it. Nobody shares the owner's URL at
  all.

Never commit `DATABASE_URL` or any key to the repo — `backend/.env` is
gitignored on purpose.

---

## 4. Supabase (the database) — 5 minutes

1. <https://supabase.com/dashboard> → **New project**. Pick a region near
   Singapore (`ap-southeast-1` — Render's region below). Save the **database
   password** you set here; the connection string will need it.
2. Open **Project Settings → Database → Connection string → Session pooler**.
   You want: port **5432**, host ending in `.pooler.supabase.com`, user
   `postgres.<project-ref>`. Replace `[YOUR-PASSWORD]` with the password
   from step 1 (URL-encode special characters). Keep this URI for step 5.2 —
   it becomes Render's `DATABASE_URL`.
3. **Rule to remember:** migrations must go through the **session pooler
   (5432)** — not the transaction pooler (6543). The app auto-detects the
   mode from the port, but DDL (schema creation) needs the session mode.
4. One security step: **Project Settings → API → Data API → Disable.**
   The app never calls Supabase's REST Data API, and the migration
   `003_rls_lockdown` already blocks it as backstop (RLS with no policies
   = zero rows for the anon key). Disabling removes the surface entirely.

> These steps are expanded in [`DEPLOY_SUPABASE.md`](DEPLOY_SUPABASE.md) §1.

## 5. Render (the Flask API) — 10 minutes

1. <https://dashboard.render.com> → **New + → Blueprint** → select this
   GitHub repo. Render reads `render.yaml` and pre-fills everything:
   plan **free**, region **singapore**, runtime **Python 3.11.x**,
   `rootDir: backend`, health check `/api/health`, and this start command
   (migrations first, then Gunicorn):
   ```
   flask --app index db upgrade && gunicorn "app:create_app()" --bind 0.0.0.0:$PORT --workers 1 --threads 4 --timeout 60 --access-logfile -
   ```
2. Render will prompt for `DATABASE_URL` (an empty slot, marked required).
   Paste the **session-pooler URI** from step 4.2. This is the "Pattern A"
   moment — if you shouldn't see the owner's URL, stop here and let the
   owner fill this slot.
3. Leave `SECRET_KEY` and `JWT_SECRET_KEY` as **generateValue** (Render
   creates random ones).
4. Fill the two URL placeholders in the blueprint env vars with real values:
   * `FRONTEND_ORIGIN` = the Vercel site URL, e.g. `https://<your-site>.vercel.app`
     (exact match, no trailing slash — see step 6 for where it comes from)
   * `ALLOWED_HOSTS` = `linuxdocs-api.onrender.com,<your-site>.vercel.app`
     (both the Render host and the Vercel host must be allowlisted)
   * keep `FLASK_ENV=production`, `TRUST_PROXY_HEADERS=1`,
     `SESSION_COOKIE_SAMESITE=Lax` as pre-filled.
5. Create the service. First deploy: install deps → `flask db upgrade`
   creates the 7 tables + RLS lockdown → Gunicorn boots. Then verify:
   ```bash
   curl https://linuxdocs-api.onrender.com/api/health   # {"status":"ok"}
   curl https://linuxdocs-api.onrender.com/api/ready    # {"status":"ok","mode":"session","latency_ms":…}
   ```

## 6. Vercel (the frontend) — 5 minutes

1. <https://vercel.com/new> → import the repo → framework preset **Vite**
   (build `npm run build`, output `dist`). No env vars needed — the frontend
   only calls relative `/api` paths. Note the final URL (e.g.
   `https://<your-site>.vercel.app`).
2. The Render URL lives in **exactly one file**: `vercel.json` at the repo
   root — update the rewrite destination to the Render service URL from
   step 5 and redeploy:
   ```json
   "rewrites": [{ "source": "/api/:path*", "destination": "https://linuxdocs-api.onrender.com/api/:path*" }]
   ```
3. Cross-check: Render's `FRONTEND_ORIGIN` and the Vercel part of
   `ALLOWED_HOSTS` (step 5.4) must equal the final Vercel URL. A mismatch
   shows as `403 Cross-origin request rejected` or `400 Invalid Host header`.

## 7. Post-deploy checklist

* [ ] `/api/health` on the Render host → `{"status":"ok"}`
* [ ] `/api/ready` through the Vercel host → `status:"ok"`, `mode:"session"`, latency in ms
* [ ] Register a test account → sign in → refresh the page: still signed in (cookie session)
* [ ] Save a bookmark + note → Render dashboard → **Manual Deploy → Restart** → sign back in → data still there
* [ ] GitHub repo → Settings → Secrets and variables → Actions → **Variables** tab → add
      `KEEPALIVE_URL` = `https://<your-site>.vercel.app/api/ready` (scheduled
      workflow pings it every 3 days so Supabase never auto-pauses the DB)

The optional RLS proof (anon-key curl returning zero rows / 404) is in
[`DEPLOY_SUPABASE.md`](DEPLOY_SUPABASE.md) §4.

---

## 8. Running the backend locally (no Supabase needed)

```bash
cd backend
python -m venv venv
venv\Scripts\pip install -r requirements.txt   # Windows
# source venv/bin/activate + pip … on Linux/macOS
venv\Scripts\python -m flask db upgrade        # creates SQLite tables
venv\Scripts\python -m flask run --port 5000
# frontend (separate terminal, repo root):
npm install && npm run dev                     # http://localhost:5173
```
Local defaults (in `backend/.env`, copied from `.env.example`): SQLite at
`sqlite:///instance/app.db`, JWT access token 15 min, rate limits generous.
Run the test suite with `pytest` (217 tests, SQLite-only, never touches
Supabase).

---

## 9. Optional settings you may need later

| Variable | Purpose |
| --- | --- |
| `DB_POOL_MODE` | force `session` / `transaction` / `direct` (auto-detected from the port otherwise) |
| `DB_CONNECT_TIMEOUT`, `DB_CONNECT_RETRIES` | cold-start tolerance for Supabase (defaults 10 s / 3 tries) |
| `MAIL_DRIVER=resend` + `RESEND_API_KEY`, `MAIL_FROM` | real password-reset emails (recommended on Render) |
| `MAIL_DRIVER=smtp` + `SMTP_*` | alternative: any SMTP relay |
| unset mail vars + `FLASK_ENV=production` | reset links are silently disabled — generic responses only |
| `RATE_LIMIT_*` | all brute-force limits are pre-tuned; leave defaults unless testing |

Full list with comments: [`backend/.env.example`](../backend/.env.example).

## 10. Troubleshooting quick table

| Symptom | Fix |
| --- | --- |
| `400 Invalid Host header` | add the Vercel domain to `ALLOWED_HOSTS` |
| `403 Cross-origin request rejected` | `FRONTEND_ORIGIN` ≠ exact Vercel URL |
| `503 Database is not ready` at boot | Supabase project paused — wake it in the dashboard, redeploy; the app auto-retries 3× |
| `flask db` errors at start | `DATABASE_URL` is on the transaction pooler (:6543) — switch to the session pooler (:5432) |
| All requests 500 | check Render logs / `security.log` for `SEC-EVENT database_unreachable` + request id |

More detail: [`DEPLOY_SUPABASE.md`](DEPLOY_SUPABASE.md) §5.
