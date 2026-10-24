# Deploy LinuxDocs: Vercel (frontend) + Render (API) + Supabase (Postgres)

Click-by-click setup. Total time: ~20 minutes. Passwords/keys are generated
by the platforms or pasted into their dashboards only — they never enter the
repository, and this doc deliberately contains no secret placeholders you
could accidentally commit.

```
                    ┌─────────────────────────────────────────────┐
  Browser ──────────►  Vercel (this repo)                          │
                    │   serves the built SPA at your-site.vercel.app
                    │   rewrites /api/* ────────────────►  Render   │
                    └─────────────────────────────┬────────────────┘
                                                  │  linuxdocs-api.onrender.com
                                                  ▼
                                    Flask (gunicorn, app:create_app())
                                                  │  session pooler :5432
                                                  ▼
                                    Supabase Postgres (public schema, RLS on)
```

---

## 1. Supabase project (database)

1. <https://supabase.com/dashboard> → **New project**. Any region close to
   `ap-southeast-1` (Render region used here is Singapore). Save the database
   password once — you will paste it into the connection string on Render.
2. Grab the connection string:
   **Project Settings → Database → Connection string → Session pooler**
   (port 5432, host ends in `.pooler.supabase.com`, user is
   `postgres.<project-ref>`). Replace `[YOUR-PASSWORD]` with the database
   password (URL-encode special characters). This URI is what goes into
   Render's `DATABASE_URL`.
3. **Read twice, do once:** migrations must run through the **session
   pooler**. If you ever switch the URI to the transaction pooler (:6543),
   the app still serves reads/writes, but `flask db upgrade` must not run
   there — DDL needs real sessions.
4. **Turn off the Data API** (Supabase's REST table API for the anon key):
   **Project Settings → API → Data API → Disable**.
   Why: the `users` table holds password hashes. Defense in depth:
   * the app never uses the anon or service-role key anywhere, so the Data
     API is dead weight;
   * migration `003_rls_lockdown` enables Row Level Security on **every**
     application table with **no permissive policies** — any Data API read
     returns zero rows even if re-enabled;
   * with the API disabled the endpoint does not exist at all, so an anon
     key leak reaches nothing.

## 2. Render web service (Flask API)

1. <https://dashboard.render.com> → **New + → Blueprint** → pick this repo.
   Render reads `render.yaml` and pre-fills: plan free, region singapore,
   runtime python (3.11.x), rootDir backend, health check `/api/health`,
   and the start command which runs migrations first:
   ```
   flask --app index db upgrade && gunicorn "app:create_app()" --bind 0.0.0.0:$PORT --workers 1 --threads 4 --timeout 60 --access-logfile -
   ```
2. When prompted for `DATABASE_URL` (it shows as a required empty slot —
   `sync: false`), paste the **session-pooler** URI from step 1.3.
3. `SECRET_KEY` / `JWT_SECRET_KEY` are **generateValue** — leave them.
4. Fill the two URL placeholders (or fix them later in Environment):
   * `FRONTEND_ORIGIN` = `https://<your-site>.vercel.app` (see step 3.2)
   * `ALLOWED_HOSTS` = `linuxdocs-api.onrender.com,<your-site>.vercel.app`
   * keep `TRUST_PROXY_HEADERS=1` and `FLASK_ENV=production`.
5. Create the service. Watch it build, run `flask db upgrade` (creates
   `users`, `sessions`, …, `user_progress` and the RLS lockdown), then boot
   gunicorn. Verify:
   ```bash
   curl https://linuxdocs-api.onrender.com/api/health   # {"status":"ok"}
   curl https://linuxdocs-api.onrender.com/api/ready   # latency + mode:"session"
   ```
   Re-deploys are idempotent: `flask db upgrade` no-ops at head.

## 3. Vercel frontend

1. <https://vercel.com/new> → import the same repo. Framework preset **Vite**
   (build `npm run build`, output `dist`). If Vercel asks, add no env vars —
   the frontend only ever calls relative `/api` URLs.
2. **The Render URL lives in exactly one place:** `vercel.json` at the repo
   root,
   ```json
   "rewrites": [{ "source": "/api/:path*", "destination": "https://linuxdocs-api.onrender.com/api/:path*" }]
   ```
   Update the destination to the Render service URL created in step 2 and
   redeploy. The browser only ever talks to the Vercel domain, cookies stay
   first-party (HttpOnly refresh cookie, SameSite=Lax, Secure on https).
3. Back on Render, make sure `FRONTEND_ORIGIN` and the Vercel part of
   `ALLOWED_HOSTS` match the final Vercel URL (step 2.4). A mismatch shows up
   as `403 Cross-origin request rejected` or `400 Invalid Host header`.
4. Verify the browser flow: <https://your-site.vercel.app> → sign up →
   Settings shows **Service Status: API reachable · database ready · …ms ·
   session**.

## 4. Post-deploy checklist

* [ ] `/api/health` (Render host) returns `{"status": "ok"}`.
* [ ] `/api/ready` (Vercel host, `/api/ready`) returns `status:"ok"`,
      `mode:"session"`, latency in ms.
* [ ] Register → sign in → refresh the page: the session survives (cookie).
* [ ] Bookmark a command, save a note, then restart the Render service
      (Manual Deploy → Restart): everything is still there after it boots.
* [ ] RLS proof (optional, needs the anon key for this one-off check only):
      ```bash
      curl "https://<ref>.supabase.co/rest/v1/users" -H "apikey: <ANON_KEY>"
      # → [] (zero rows) or 404 "Not found" if the Data API is disabled
      ```
* [ ] Keepalive: on GitHub → repo **Settings → Secrets and variables →
      Actions → Variables** add `KEEPALIVE_URL` =
      `https://<your-site>.vercel.app/api/ready`. The scheduled workflow
      pings it every 3 days so Supabase's ~7-day auto-pause never trips.

## 5. If something goes wrong

| Symptom | Cause | Fix |
| --- | --- | --- |
| `400 Invalid Host header` | `ALLOWED_HOSTS` missing the Vercel domain | add `<your-site>.vercel.app` (ProxyFix maps X-Forwarded-Host) |
| `403 Cross-origin request rejected` | `FRONTEND_ORIGIN` ≠ actual Vercel URL | set the exact origin, no trailing slash |
| `503 Database is not ready` right after boot | Supabase project sleeping or pooler hiccup | the app retries 3× with backoff (bounded by DB_CONNECT_TIMEOUT=10s per attempt); if it persists, wake the project in the dashboard and redeploy |
| Start fails with `flask db` errors | `DATABASE_URL` points at the **transaction** pooler (:6543) or is missing/typo'd | use the session-pooler (:5432) URI |
| Everything 500s at once | see `backend/instance/security.log` locally / Render logs remotely — SELECT 1 failures show as `SEC-EVENT database_unreachable` with a request id |
