# LinuxDocs

An MDN-style reference for Linux commands plus a CTF security & hacking tools section, with user accounts, bookmarks, notes, and history.

## Stack

- **Frontend**: Vite + React 19 + TypeScript + Tailwind CSS v4
- **Backend**: Flask + Flask-SQLAlchemy + Flask-Bcrypt + Flask-JWT-Extended + Flask-CORS
- **Database**: SQLite (local) / PostgreSQL (production)
- **Auth**: JWT access tokens (in-memory) + HttpOnly refresh cookies (30-day)

## Quick Start (Windows PowerShell)

### Prerequisites

- Node.js 20+ and npm
- Python 3.11+
- Git

### 1. Clone and install frontend dependencies

```powershell
git clone <your-repo-url>
cd LinuxDocs
npm install
```

### 2. Set up backend

```powershell
cd backend
python -m venv venv
.\venv\Scripts\pip install -r requirements.txt
```

### 3. Configure environment

```powershell
# Copy example and edit with your secrets
copy .env.example .env
# Generate secrets:
# python -c "import secrets; print(secrets.token_hex(32))"
# Edit .env and fill in SECRET_KEY, JWT_SECRET_KEY
```

Required `.env` variables:
| Variable | Description |
|----------|-------------|
| `SECRET_KEY` | Flask secret (32+ random hex chars) |
| `JWT_SECRET_KEY` | JWT signing secret (32+ random hex chars) |
| `DATABASE_URL` | `sqlite:///instance/app.db` (local) or Postgres URL |
| `FRONTEND_ORIGIN` | `http://localhost:5173` (must match exactly) |
| `JWT_ACCESS_TOKEN_EXPIRES` | Access token TTL in seconds (default: 900) |
| `JWT_REFRESH_TOKEN_EXPIRES` | Refresh token TTL in seconds (default: 2592000 = 30 days) |

**Never commit `.env` or `instance/app.db`** — they're in `.gitignore`.

### 4. Run everything

**Option A: One command (both servers)**
```powershell
npm run dev:all
```

**Option B: Separate terminals**

Terminal 1 (Frontend):
```powershell
npm run dev
```

Terminal 2 (Backend):
```powershell
cd backend
.\venv\Scripts\python -m flask run --port 5000
```

Frontend: http://localhost:5173  
Backend API: http://localhost:5000/api

### 5. Run backend tests

```powershell
cd backend
.\venv\Scripts\pytest
```

All 79 tests should pass.

## Features

- **Command Reference**: 100+ Linux commands and CTF tools with syntax, examples, and related commands
- **User Accounts**: Register, login, change password, delete account
- **Bookmarks**: Star commands to save them to your dashboard
- **Notes**: Per-command notes with auto-save (Ctrl+S)
- **History**: Recently viewed commands (last 15)
- **Dashboard**: View all bookmarks, notes, and history in one place
- **Settings**: Change password, delete account with confirmation
- **Terminal UI**: Dark/light themes, blinking cursor, terminal-styled auth forms
- **Security**: HttpOnly cookies, SameSite=Strict, CSRF origin checks, per-endpoint + global rate limits, account lockout, rotating opaque sessions with token-reuse (theft) detection, Host-header allowlist, strict payload validation, hardened security headers (HSTS/CSP in production)
- **Data durability**: WAL + synchronous=FULL SQLite, `foreign_keys=ON`, verified daily backups with automatic restore on corruption, and a persistent security audit log — accounts are kept, not disposable

## Project Structure

```
LinuxDocs/
├── src/                    # Frontend
│   ├── components/         # Reusable UI components
│   ├── context/            # React Context (Auth, Theme)
│   ├── data/               # Command data (single source of truth)
│   ├── pages/              # Route pages
│   ├── services/           # API client
│   ├── App.tsx             # Main router
│   └── main.tsx            # Entry point
├── backend/                # Flask API
│   ├── app/
│   │   ├── __init__.py     # App factory
│   │   ├── models.py       # SQLAlchemy models
│   │   ├── auth.py         # Auth endpoints
│   │   ├── user.py         # User endpoints
│   │   ├── security.py     # Rate limits, lockouts, headers, CSRF, Host checks
│   │   ├── sessions.py     # Rotating opaque sessions + reset tokens
│   │   └── persistence.py  # WAL, integrity checks, backups, restore
│   ├── tests/
│   │   └── test_auth.py    # 79 pytest cases
│   ├── requirements.txt    # Pinned dependencies
│   ├── .env.example        # Environment template
│   └── pytest.ini
├── package.json
├── vite.config.ts
├── tsconfig.json
└── README.md
```

## API Endpoints

All under `/api` with CORS restricted to `FRONTEND_ORIGIN`:

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/auth/register` | — | Register new user |
| POST | `/auth/login` | — | Login, returns access token + sets refresh cookie |
| POST | `/auth/refresh` | Refresh cookie | Get new access token |
| POST | `/auth/logout` | — | Clear cookies |
| GET | `/auth/me` | Access token | Get current user |
| GET | `/user/me` | Access token | Get current user (alias) |
| GET | `/user/bookmarks` | Access token | List bookmarks |
| POST | `/user/bookmarks/toggle` | Access token | Toggle bookmark |
| GET | `/user/notes` | Access token | List notes |
| POST | `/user/notes` | Access token | Upsert note |
| DELETE | `/user/notes/:slug` | Access token | Delete note |
| GET | `/user/history` | Access token | List recent (15) |
| POST | `/user/history/add` | Access token | Record view |
| POST | `/user/change-password` | Access token | Change password |
| DELETE | `/user/delete-account` | Access token | Delete account + cascade |

## Verification Checklist

After running `npm run dev:all`:

1. Open http://localhost:5173
2. Click **Sign Up** → create account (username, email, strong password)
3. Verify redirect to home, header shows username
4. Browse to any command (e.g., `/linux/file-and-directory/ls`)
5. Click **Bookmark** star → appears in Dashboard
6. Add a **Note** → auto-saves, appears in Dashboard
7. View 3+ different commands
8. Open **Dashboard** → verify Bookmarks, Notes, History tabs
9. Open **Settings** → change password, verify login works with new password
10. **Restart Flask** (`Ctrl+C` in backend terminal, re-run)
11. Reload frontend → should stay logged in (silent refresh)
12. Open **incognito/private window** → sign in → verify data persists
13. Check DevTools → Application → Cookies → `refresh_token_cookie` is **HttpOnly**, no tokens in localStorage
14. `git status` → no `.env` or `instance/app.db` shown

## License

MIT