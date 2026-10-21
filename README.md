<div align="center">

![LinuxDocs](docs/screenshots/intro.png)

# LinuxDocs

**Every flag, every example, without the guesswork.**

A hand-checked MDN-style reference for **95 Linux utilities + 37 CTF & security tools**, wrapped in a full learning platform — guided paths, a mission-based practice terminal, quizzes, flashcards, and a speed drill — with real accounts that persist progress.

[![React 19](https://img.shields.io/badge/React-19-20232a?logo=react)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript)](https://www.typescriptlang.org)
[![Flask](https://img.shields.io/badge/Flask-3-000?logo=flask)](https://flask.palletsprojects.com)
[![PostgreSQL ready](https://img.shields.io/badge/SQLite%20%E2%86%92%20PostgreSQL-ready-4169E1?logo=postgresql)](#deploy-your-own)
[![Tests](https://img.shields.io/badge/tests-84%20passing-2EA043)](#how-it-is-verified)

▶ **Live app:** *[[your deployed URL here]]* — **Demo GIF below** 👇

</div>

---

## The demo (8 real pages, captured during automated QA)

![LinuxDocs demo](docs/screenshots/demo.gif)

*Intro boot sequence → landing → a full command page → the Ctrl+K command palette → the practice sandbox → flashcards → the signed-in dashboard → the 404 page that hides a flag.*

## Why I built it

When I started learning Linux and CTF tooling, the information was everywhere and nowhere: `man` pages are complete but unreadable for beginners, blog posts contradict each other, and cheat sheets show flags without explaining what they change. I kept wishing for an MDN for the terminal — one index where every command had the same honest structure: syntax, the flags that actually matter, copy-paste examples **with the output you should expect**, and what to reach for next.

So LinuxDocs is:

- **The reference I wanted** — 132 hand-checked entries (95 Linux utilities, 37 CTF tools) in a consistent MDN-style layout, each with a *Command Builder* that assembles the real flag string as you toggle options, plus "Spotted a mistake? Report it." because accuracy is the product.
- **The practice I needed** — 8 guided learning paths with 24 lessons and quizzes; a safe, simulated practice terminal where 13 missions across 3 ranks ("Boot Camp" → "Operator") must be solved to unlock more helper hints — like a real operator earning their way; flip-style flashcards over all 95 Linux utilities; a speed drill; achievements; daily streaks.
- **The engineering exercise of doing auth right** — silent-refresh JWT sessions, and every deployment decision justified below.

## What's inside

| Area | Details |
|---|---|
| 📚 **Reference** | 95 Linux + 37 CTF tools — syntax, flag tables with per-flag examples, worked examples with sample output, related commands, tags; Ctrl+K command palette (keyboard-first, reachable from every page) |
| 🎓 **Learn** | 8 paths × 24 lessons (Linux foundations → permissions → processes → systemd; CTF recon → web → crypto → forensics), quiz builder with difficulty + question-count controls |
| 🖥️ **Practice terminal** | Simulated filesystem (`ls`, `cat`, `man`, `grep`, pipes…) + 13 missions over 3 ranks; helpers are retired as you rank up; ↑ history, Ctrl+L clear |
| 🔁 **Flashcards** | Flip-style spaced repetition over every Linux utility with "Again / Got it" marking |
| ⚡ **Speed drill** | Timed command-identification drill with per-session scoring |
| 🏆 **Progress** | Achievements, streaks, per-path progress, all synced to your account when signed in |
| 🔐 **Accounts** | Register / sign in / silent refresh / sign out; bookmarks, per-command notes (Ctrl+S autosave), history — synced across devices |

<div align="center">
  <img src="docs/screenshots/landing.png" alt="Landing page" width="600">
  <img src="docs/screenshots/command-page.png" alt="Command documentation page" width="600">
</div>

## Screenshots

| | |
|---|---|
| ![Command palette](docs/screenshots/command-palette.png) | ![Dashboard](docs/screenshots/dashboard.png) |
| *Ctrl+K palette — filters 132 entries by name, category, and tags* | *Dashboard — progress across paths, quizzes, missions + achievements* |

<p align="center">
  <img src="docs/screenshots/mobile-terminal.png" alt="Practice terminal on mobile" width="260">
  &nbsp;&nbsp;&nbsp;
  <img src="docs/screenshots/mobile-flashcards.png" alt="Flashcards on mobile" width="260">
</p>
<p align="center"><sub>The practice sandbox and flashcards are fully phone-sized friendly (390×844).</sub></p>

Mistyped a URL? The 404 page is itself a terminal — type `cat flag.hidden` and you'll find it hides a flag for curious learners: ![404 void terminal](docs/screenshots/not-found.png)

## How it is verified

The repo ships its own test harnesses (in `qa/`, untracked):

```powershell
# 84 pytest backend tests
cd backend; .\venv\Scripts\pytest           # 84 passed

# 14-step API smoke test (stdlib only): register → login →
# refresh → logout → revoked-after-logout → 401/404 shape checks
python qa/smoke_api.py                      # 14/14 PASS

# Real-browser QA (Chrome DevTools Protocol, headless): drives the exact
# 10-minute manual checklist — sign-up redirect, session surviving a hard
# reload, sign out, protected-route gate, fake-URL 404, the void-terminal
# flag, 8 random command pages, Ctrl+K palette, then a 390×844 phone
# viewport running the practice terminal, a full quiz, and flashcards —
# while logging every console message per page.
python qa/browser_check.py                  # 22/22 PASS, zero red console errors
```

`qa/browser_check.py` types with real CDP input events (not synthetic ones), captures Network responses for the auth calls, and reports console errors per page — that last check is how a "signed-out visitor gets a 401 console line on every page" bug was found in the auth boot flow and fixed with a session-hint in `AuthContext`.

## Architecture

```
Browser ──(one origin)──► Vercel  ──/api/* proxy──► Render (Flask API) ──► Render Postgres
                          │                              ▲
                          └── static React SPA (Vite)     └── host-allowlist + rate limits + CORS
```

- **Frontend** — Vite + React 19 + TypeScript + Tailwind CSS v4. Route-level code splitting (the intro's 3D scene loads only on `/intro` or first visit). All state flows through typed services (`src/services/api.ts`).
- **Auth model** — JWT access token lives **in memory only** (15 min); the refresh credential is an **HttpOnly, SameSite=Strict cookie** (30 days) backed by opaque rotating session tokens with reuse (theft) detection. A single-flight refresh promise stops a tab full of failing requests from stampeding the auth endpoint.
- **The same-origin trick** — `vercel.json` proxies `/api/*` to the Render API, so the browser only ever talks to one domain. That makes the refresh cookie first-party on the frontend origin — no `SameSite=None`, no third-party-cookie breakage, no CORS drama. In dev, `vite.config.ts` does the identical thing to `localhost:5000`.
- **Backend** — Flask 3 + SQLAlchemy + Bcrypt + JWT-Extended. Env-driven config; request logging; per-endpoint **and** global rate limits; account lockout with attempt windows; CSRF origin checks; **Host-header allowlist**; payload clamps; hardened security headers (CSP/HSTS) in production.
- **Data durability** — SQLite runs WAL + `synchronous=FULL` + automatic verified backups with self-healing restore on corruption. Point `DATABASE_URL` at Postgres (Render blueprint does exactly that) and the SQLite-only machinery disables itself cleanly — no forks, no code changes.

## Quick start (local)

Prerequisites: Node 20+, Python 3.11+.

```powershell
git clone <your-repo-url>
cd LinuxDocs
npm install

cd backend
python -m venv venv
.\venv\Scripts\pip install -r requirements.txt
copy .env.example .env      # then fill in the two secrets (see below)
cd ..

npm run dev:all             # Vite on :5173 (proxies /api) + Flask on :5000
```

Frontend: http://localhost:5173 — API: http://localhost:5000/api

Required `.env` variables (in `backend/.env` — never commit it):

| Variable | Value |
|---|---|
| `SECRET_KEY` | `python -c "import secrets; print(secrets.token_hex(32))"` |
| `JWT_SECRET_KEY` | same generator, different value |
| `DATABASE_URL` | `sqlite:///instance/app.db` (local default) |
| `FRONTEND_ORIGIN` | `http://localhost:5173` |

## Deploy your own

**1. Create the backend on Render** — Push the repo, then in Render: **New + → Blueprint** and pick the repository. `render.yaml` provisions the `linuxdocs-api` web service (gunicorn) **and** the free partners Postgres, wiring `DATABASE_URL`, strong regenerated `SECRET_KEY`/`JWT_SECRET_KEY` automatically.

**2. Point it at your frontend** — After the first deploy, Render gives the service a URL like `https://linuxdocs-api.onrender.com`. Set its env vars:

| Variable | Set to |
|---|---|
| `FRONTEND_ORIGIN` | your Vercel site URL (`https://…vercel.app`) |
| `ALLOWED_HOSTS` | the Render service host (`linuxdocs-api.onrender.com`) |

**3. Create the frontend on Vercel** — **New Project → Import repo**. Vercel auto-detects the `vercel.json`: builds with `npm run build`, serves `dist/`, and applies the two rewrites:

```jsonc
"rewrites": [
  { "source": "/api/:path*", "destination": "https://linuxdocs-api.onrender.com/api/:path*" }, // API proxy
  { "source": "/:path*",     "destination": "/index.html" }                                    // SPA fallback
]
```

Then update `FRONTEND_ORIGIN`/`ALLOWED_HOSTS` on Render with the final Vercel URL and redeploy once — accounts, refresh cookies, and rate limiting all work across the proxy exactly like they do locally.

**4. Password reset without email** — No mail provider is needed. On `/password-reset` a user enters the registered email and the **one-time reset link is returned by the API and shown on the page immediately** — no inbox, no SMTP, nothing to configure. The link is single-use and expires in 30 minutes; consuming it also signs that user out of every other session.

*Deployment-model trade-off, stated plainly:* because the link is returned in the response, the endpoint **does** reveal whether an email is registered (it is not enumeration-proof like an email-based reset would be). Appropriate for this project's personal/demo deployment model; rate limiting caps abuse. The token itself keeps every hardening property: opaque, stored hashed, single-use, 30-minute TTL.

*Why the rewrite matters:* with `/api` on the site's own origin, the HttpOnly refresh cookie is first-party `SameSite=Strict`. The whole scary class of cross-site auth issues (third-party cookie deprecation, `SameSite=None` + cross-domain CSRF) simply does not apply.

## API endpoints

All under `/api` (CORS restricted to `FRONTEND_ORIGIN`):

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/auth/register` | — | Register (rate-limited) |
| POST | `/auth/login` | — | Login → access token + HttpOnly refresh cookie |
| POST | `/auth/refresh` | Refresh cookie | New access token (single-flight on client) |
| POST | `/auth/logout` | — | Revoke session + clear cookie |
| GET | `/auth/me` | Access token | Current user |
| POST | `/auth/request-password-reset` | — | In-app single-use reset link |
| POST | `/auth/reset-password` | — | Complete reset with token |
| GET/POST | `/user/bookmarks` (+`/toggle`) | Access token | Bookmark sync |
| GET/POST/DELETE | `/user/notes[/:slug]` | Access token | Per-command notes |
| GET/POST | `/user/history` (+`/add`) | Access token | Recently viewed |
| POST | `/user/change-password` | Access token | Change password |
| POST | `/user/data/import` | Access token | Import synced progress |
| DELETE | `/user/delete-account` | Access token | Full cascade delete |

## Project structure

```
LinuxDocs/
├── src/                      # Frontend (React 19 + TS)
│   ├── components/           #   Command pages, palette, intro scene, header…
│   ├── context/              #   Auth (silent refresh + session hint), Theme
│   ├── data/                 #   132 hand-checked command entries (source of truth)
│   ├── pages/                #   Reference, Learn, PracticeTerminal, Flashcards, …
│   └── services/api.ts       #   Typede API client + single-flight refresh
├── backend/                  # Flask 3 API
│   ├── app/                  #   factory, models, auth, user, security, sessions, persistence
│   ├── tests/                #   84 pytest cases (incl. the in-app reset suite)
│   └── requirements.txt      #   pinned (incl. gunicorn + psycopg2 for Render)
├── docs/screenshots/          # README assets (captured by the QA run)
├── qa/                        # browser_check.py / smoke_api.py (gitignored)
├── render.yaml                # Render blueprint: API + Postgres
└── vercel.json                # /api/* proxy + SPA fallback
```

## License

MIT
