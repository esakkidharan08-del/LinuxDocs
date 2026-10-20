# Running LinuxDocs (frontend + backend)

Step-by-step commands for **Windows PowerShell**, run from this folder:

```
C:\Users\Esakki dharan\Projects\LinuxDocs
```

- **Frontend** — Vite dev server on **http://localhost:5173**
- **Backend** — Flask API on **http://localhost:5000** (`/api/...`)
- The frontend calls `/api` and Vite proxies it to `:5000` (see `vite.config.ts`), so both must be running.

---

## Step 1 — Open a terminal in the project root

```powershell
cd "C:\Users\Esakki dharan\Projects\LinuxDocs"
```

## Step 2 — Install frontend dependencies (first time only)

```powershell
npm install
```

## Step 3 — Set up the backend virtual environment (first time only)

```powershell
cd backend
python -m venv venv
.\venv\Scripts\python.exe -m pip install --upgrade pip
.\venv\Scripts\python.exe -m pip install -r requirements.txt
```

> Already done in this folder (`backend\venv` exists) — skip if you just want to run.

## Step 4 — Configure the backend environment

The backend **exits on startup** if any required variable is missing.

```powershell
cd backend
# Only if .env does not exist yet:
Copy-Item .env.example .env
```

Then fill in `backend\.env`. Generate the two secrets with:

```powershell
.\venv\Scripts\python.exe -c "import secrets; print(secrets.token_hex(32))"
```

| Variable | Value for local dev |
|----------|---------------------|
| `SECRET_KEY` | 64-char hex from the command above |
| `JWT_SECRET_KEY` | a **different** 64-char hex |
| `DATABASE_URL` | `sqlite:///instance/app.db` |
| `FRONTEND_ORIGIN` | `http://localhost:5173` (exact, no trailing slash) |
| `JWT_ACCESS_TOKEN_EXPIRES` | `900` |
| `JWT_REFRESH_TOKEN_EXPIRES` | `2592000` |

> `backend\.env` is already populated here. Tables are auto-created on startup (`db.create_all()`), so no migration step is needed.

## Step 5 — Start the backend (Terminal 1)

The backend must run **from the `backend` folder** so `.env` and `instance\app.db` resolve.

```powershell
cd "C:\Users\Esakki dharan\Projects\LinuxDocs\backend"
.\venv\Scripts\python.exe -m flask run --port 5000
```

Wait for: `Running on http://127.0.0.1:5000`.

Confirm it's alive (from a second terminal):

```powershell
Invoke-RestMethod http://localhost:5000/api/health   # -> {"status":"ok"}
```

## Step 6 — Start the frontend (Terminal 2)

Open a **new** PowerShell window:

```powershell
cd "C:\Users\Esakki dharan\Projects\LinuxDocs"
npm run dev
```

Wait for `Local: http://localhost:5173/`.

## Step 7 — Open the app

Browse to **http://localhost:5173**.

Quick end-to-end check:

1. **Sign Up** → create an account (strong password: 10+ chars, upper, lower, number, symbol).
2. Header shows your username → you're logged in.
3. Open a command, e.g. http://localhost:5173/linux/file-and-directory/ls
4. **Bookmark** it and add a **note** (Ctrl+S saves).
5. Open **Dashboard** → Bookmarks / Notes / History tabs populate.

---

## Option A — Run both with one command

From the project root (runs `concurrently`, Ctrl+C stops both):

```powershell
npm run dev:all
```

Backend only:

```powershell
npm run dev:backend
```

## Option B — Run the backend tests

```powershell
cd backend
.\venv\Scripts\python.exe -m pytest
```

(79 tests should pass; config is in `backend\pytest.ini`.)

## Step 8 — Stop everything

Press `Ctrl+C` in each terminal window.

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `ERROR: Missing required environment variables: ...` on backend start | `backend\.env` is missing or a key is empty — redo **Step 4**. |
| `[Errno 10048] address already in use` (port 5000) | Stop the other process or use another port: `flask run --port 5001`, then update the Vite proxy target in `vite.config.ts`. |
| Port 5173 in use | Vite now refuses to start (`strictPort`) rather than silently move to another port — a moved port changes the browser `Origin`, which the backend rejects with `403`. Stop the process holding 5173: `Get-NetTCPConnection -State Listen -LocalPort 5173 | ForEach { Stop-Process -Id $_.OwningProcess -Force }` |
| Login/network errors, `401`/CORS in DevTools | `FRONTEND_ORIGIN` in `backend\.env` must equal the frontend URL **exactly** (`http://localhost:5173`). Restart the backend after editing `.env`. |
| `Activate.ps1 ... running scripts is disabled` | Either call the interpreter directly (`.\venv\Scripts\python.exe ...`) or run once: `Set-ExecutionPolicy -Scope Process Bypass`. |
| `500` / `no such table` after adding a table to `models.py` | Tables are created on boot (`db.create_all()`), which never drops data — just restart the backend. Adding a *column* to an existing table needs a migration (see below). |
| `Database failed its integrity check` / `Database is corrupt` on boot | The backend refuses to run on a damaged DB. It auto-restores the newest verified backup; otherwise run `cd backend; .\venv\Scripts\python.exe -m flask backups`, then `flask restore`. **Never delete `instance\app.db` to "fix" an error — it holds every account.** |
| API calls fail but backend is up | The frontend proxies `/api` → `:5000`; start the backend first, then the frontend. |

## Reference — URLs and commands

| Purpose | Command / URL |
|---------|---------------|
| Frontend (dev) | `npm run dev` → http://localhost:5173 |
| Backend (dev) | `cd backend; .\venv\Scripts\python.exe -m flask run --port 5000` |
| Both together | `npm run dev:all` |
| Health check | http://localhost:5000/api/health |
| Backend tests | `cd backend; .\venv\Scripts\python.exe -m pytest` |
| Frontend build | `npm run build` |
| Frontend lint | `npm run lint` |
| Command link check | `npm run check:links` |
| Take a DB backup now | `cd backend; .\venv\Scripts\python.exe -m flask backup` |
| List / restore backups | `cd backend; .\venv\Scripts\python.exe -m flask backups` / `flask restore` |

---

## Data durability (users are remembered forever)

The database is configured so registered accounts cannot be lost to a crash,
a power cut, or corruption:

- **WAL + `synchronous=FULL`** — a write that returned success survives a hard
  power loss.
- **`foreign_keys=ON`** — SQLite ships with foreign keys *off*, so cascades
  silently did nothing; deleting an account now really removes its rows.
- **`busy_timeout`** — concurrent writers wait instead of dropping a write
  ("database is locked").
- **Boot-time `integrity_check`** — if the file is damaged, the backend
  auto-restores the newest *verified* backup instead of starting on top of it.
- **Verified hot backups** — taken on every boot and daily after that, in
  `backend\instance\backups\`, rotated (default: newest 30 kept). Each one is
  integrity-checked before it is kept, and a `.partial` copy is never promoted.
- **Security audit log** — `backend\instance\security.log` keeps a rotating
  record of rate-limit trips, lockouts, origin/host rejections and session
  revocations, so an attack can be read about *after* the fact.

Backups live next to the database, so they protect against corruption and
accidental overwrites — **not** against losing the machine. Copy
`backend\instance\backups\` somewhere off-box (or point `BACKUP_DIR` at a
synced folder) if the accounts matter.

To migrate a SQLite database to a new machine, stop the backend and copy the
whole `backend\instance\` directory (`app.db` plus the `backups\` folder).
