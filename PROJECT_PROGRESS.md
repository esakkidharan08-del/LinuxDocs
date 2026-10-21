# LinuxDocs — Project Progress & Structure

> Snapshot of **current** project state. Covers what exists, what's finished,
> what's still work-in-progress, the feature inventory, and the site structure.

**Last updated:** final QA + polish round — repo is deployment-ready (Render blueprint + Vercel rewrites), README shipped with screenshots/GIF, browser + API QA suites both green.

---

## 1. Project at a Glance

An MDN-style reference for **Linux commands** plus a **CTF / security-tooling section**, wrapped in an editorial "terminal" UI with a **cyberpunk 3D intro** and hosted user accounts (bookmarks, notes, history) — plus a full learning system (paths, practice terminal, flashcards, speed drill, achievements).

| | |
|---|---|
| **Frontend** | Vite 8 + React 19 + TypeScript + Tailwind CSS v4 (+ Framer Motion, react-icons, lucide-react, fuse.js) |
| **Backend** | Flask + Flask-SQLAlchemy + Flask-Bcrypt + Flask-JWT-Extended + Flask-CORS (gunicorn in production) |
| **Database** | SQLite (`backend/instance/app.db`) local / **PostgreSQL in production (Render blueprint)** — SQLAlchemy reads `DATABASE_URL`, SQLite-only persistence machinery auto-disables on Postgres |
| **Auth** | JWT access token (15 min, memory-only) + HttpOnly refresh cookie (30 days), opaque rotating sessions with theft detection, silent refresh |
| **Docs dataset** | **132 commands** — 95 Linux · 37 CTF — across **23 categories/domains** (13 Linux + 10 CTF) |
| **Deploy** | `render.yaml` (API + Postgres blueprint) + `vercel.json` (`/api/*` proxy → one origin) |

**Files that describe how to run it:** `README.md` (features, architecture, local setup, deploy-your-own) and `RUN.md` (step-by-step, Windows PowerShell).

---

## 2. Current Progress

### 2.1 Committed history (most recent first)
| Commit | What |
|---|---|
| `22b46ed` | WEBSITE_SUMMARY.md (accurate site overview) |
| `5641ff6` | Full site polish: learning paths v3, terminal missions, flashcards, speed drill, achievements, 404 void terminal, route code-splitting |
| `69caf3d` | Complete progress import and feature checklist |
| `15e23ab` | Protect account routes |
| `23025ae` | Add password reset flow |
| `eb533ac` | Add command tools and auth token refresh |
| `31e03ad` | Add searchable command cheat sheets |
| `4d2af09` | Add local learning paths and quizzes |
| `1a8a26d` | Add browser-only practice terminal |
| `6adfd4c` | Add dataset-backed command explainer |

*Earlier commits: dataset expansion, command builders, exhausting TODO checklist landing.*

### 2.2 Committed this final round
- **Auth boot fix** — `src/context/AuthContext.tsx`: a `linuxdocs.auth-visible` session-hint in localStorage now gates the boot refresh call. Signed-out visitors no longer produce a red `401` console line on every page (the hint is set on sign-in/register/refresh success, cleared on logout or failed refresh).
- **Dataset accuracy fixes** — `systemctl` closed-bracket syntax; `expand -i` example corrected to real GNU semantics (leading tabs convert; tabs after words are preserved).
- **Deployment scaffolding** — `render.yaml` (Flask gunicorn service + free partners Postgres, `DATABASE_URL`/secrets autowired), `vercel.json` (`/api/:path*` → Render + SPA fallback), `backend/requirements.txt` + `gunicorn` + `psycopg2-binary`.
- **README rewrite** — hero + demo GIF + screenshots ("what I built and why", architecture with the same-origin rewrite rationale, quick start, deploy steps, verified endpoint table).

### 2.3 QA work (artifacts in gitignored `qa/`, scripts kept for re-runs)
- `qa/smoke_api.py` — 14-step stdlib API smoke: register → login → me → bookmark toggle → note save → history add → cookie-only refresh → logout → revoked-after-logout → API 404 shape → bad password 401 → duplicate register 400 → **14/14 PASS**.
- `qa/browser_check.py` — headless-Chrome CDP driver replicating the 10-minute manual checklist, typing with **real CDP input events**, capturing Network responses for the auth calls and every page's console: sign-up→redirect, session survives hard reload, sign out, protected-route gate, fake-URL 404, void-terminal flag, 8 sampled command pages, Ctrl+K palette, and a 390×844 phone viewport running the practice terminal (`ls -la` with real output), a full quiz (difficulty → start → answer → feedback) and flashcards (deck → flip → mark) — **22/22 PASS, zero console errors on every page**.
- `qa/shots_extra.py` — README/GIF frame captures (intro, landing, desktop terminal/flashcards, mobile landing).
- `qa/make_gif.py` — stitches the 8-frame demo GIF + exports the README stills into `docs/screenshots/`.
- `qa/slugs.json`, `qa/pick_slugs.py` — seeded random QA picks (`slugs.json` = parsed 132-entry index; picks: expand, grep, cp, lsof, uname / whois, theharvester, gdb).

---

## 3. Feature Inventory

### 3.1 Reference & content
- **132 hand-checked entries** — 95 Linux utilities across 13 categories, 37 CTF tools across 10 domains; every entry: syntax, description, flag table with per-flag examples, worked examples with sample output, use cases, related commands, tags.
- Command detail pages with breadcrumbs, ToC, copy-code blocks, **Command Builder** (live flag assembly + plain-English breakdown), bookmark star, Ctrl+S notes, "report a mistake".
- Cheat sheets (searchable, print-friendly), **Explain This Command** (`/explain` — every token accounted for from the dataset), Compare (`/compare`), Command of the Day.

### 3.2 Learning system
- **Learning paths** (`/learn`) — 8 paths, 24 lessons, quiz builder with difficulty (easy/medium/hard/mixed) + count selector, per-path progress, pass marks, stage unlocks.
- **Practice terminal** (`/practice-terminal`) — simulated filesystem shell (30+ commands, pipes) + **13 missions over 3 ranks** ("Boot Camp" → "Operator"); helper chips retire as ranks rise; ↑ history, Ctrl+L.
- **Flashcards** (`/flashcards`) — flip-style deck over all 95 Linux utilities with "Again / Got it" marking and session tracking.
- **Speed drill** (`/speed-drill`) — timed command-identification scores.
- **Achievements + streaks** — 12 achievements, daily streak, all synced server-side when signed in.

### 3.3 Accounts & data (backend)
- Register / login / logout / refresh with **opaque, rotating, revocable server-side sessions** (HttpOnly cookies, silent refresh, single-flight client refresh).
- Password change, delete account (cascade), password reset (single-use hashed tokens).
- Bookmarks (toggle/list), per-command notes (upsert/delete), history (last 15) — `ProtectedRoute` gates account pages; `/dashboard` tabs; `/settings`.
- **Context/AuthContext** — boot session-hint (see §2.2) so guest page loads make zero auth requests.

### 3.4 Shell / UX / presentation
- **Cyberpunk 3D intro** — boot typewriter → INITIATE → kinetic loader → ACCESS GRANTED → enter (click-gated all the way; once per session; `/intro` replays).
- Editorial terminal theme — dark/light via CSS-variable tokens; sticky blurred header; sidebar with per-category counts; noise overlay; footer contact bar with the 7-tile C·O·N·T·A·C·T flip button.
- **Command palette** (Ctrl/Cmd+K, fuse.js) from every page + shortcuts dialog (`?`); reduced-motion support.
- Route-level code splitting (intro scene loads only when needed) — 404 page hides an in-page flag for the void terminal (`cat flag.hidden`).

### 3.5 Security hardening (backend) — already shipped, still true
Opaque rotating sessions + theft detection; sliding-window rate limits + account lockout; `SameSite=Strict` refresh + CSRF Origin checks; JSON/415 + 1 MiB body cap; cookie flag policy; Host-header allowlist (`TRUST_PROXY_HEADERS=1` behind proxies); CSP/HSTS in production; breached-password list; audit log (`SEC-EVENT`).

---

## 4. Website Structure

### 4.1 Routes
| Route | Page | Notes |
|---|---|---|
| `/` | Landing (cyberpunk intro owns first visit) | `[ESC] skip` available |
| `/intro` | Intro always | footer "Replay intro" |
| `/linux/:categoryId` + `/:slug` | Category + command pages | |
| `/ctf` + `/:domainId` + `/:slug` | CTF domain + tool pages | |
| `/cheat-sheets` | Searchable cheat sheets | |
| `/explain` | Explain a command | |
| `/practice-terminal` | Mission-based sandbox | |
| `/learn` | Learning paths + quizzes | |
| `/flashcards` | Flip decks | |
| `/speed-drill` | Speed drill | |
| `/compare` | Side-by-side commands | |
| `/command-of-the-day` | Random highlight | |
| `/export-import` | Progress JSON export/import | |
| `/sign-in` `/sign-up` `/password-reset` | Auth | terminal-styled |
| `/dashboard` `/settings` | Account | `ProtectedRoute` |
| `/privacy` `/terms` | Legal | |
| `*` | 404 void terminal | hides a flag |

### 4.2 App shell
```
Header (sticky, blurred): ☰ · logo · nav · Ctrl+K search · theme · account menu
Sidebar: Linux (13 cats) · CTF (10 domains) — drawer on mobile
Main: route content
Footer: 3 nav columns + C·O·N·T·A·C·T bar
Overlays: palette (Ctrl+K), shortcuts (?), mobile drawer, intro (first visit)
```

---

## 5. Project Structure (annotated)

```
LinuxDocs/
├── src/                          # Frontend (React 19 + TS)
│   ├── App.tsx                   # Providers + router; intro gating
│   ├── index.css                 # Theme tokens (.dark/.light), editorial + cyberpunk kits
│   ├── types.ts                  # Command / CategoryInfo / CTFDomainInfo models
│   ├── components/               # Header, Sidebar, CommandPalette, CommandBuilder, IntroScene…
│   ├── context/                  # AuthContext (silent refresh + session-hint), ThemeContext, CatalogContext
│   ├── data/                     # commands.ts (132 entries, source of truth), commandBuilders.ts, catalog.ts
│   ├── pages/                    # 18 pages (route table above)
│   └── services/api.ts           # Typed API client + single-flight refresh (API_BASE='/api')
├── backend/                      # Flask API
│   ├── app/                      # __init__ (env validation/CORS/headers), auth, user, commands,
│   │                             #   security (limits/lockout/CSRF/host), sessions, models, persistence
│   ├── tests/                    # 79 pytest cases (auth 32 + hardening 30 + security 17)
│   ├── requirements.txt          # pinned; gunicorn + psycopg2-binary for Render
│   └── .env.example / pytest.ini / check_links.py
├── docs/screenshots/             # README assets (intro/landing/command-page/palette/dashboard/
│                                 #   not-found/mobile-terminal/mobile-flashcards/demo.gif)
├── qa/ (gitignored)              # smoke_api.py, browser_check.py, shots_extra.py, make_gif.py, slugs.json
├── render.yaml                   # Render blueprint: linuxdocs-api (gunicorn) + linuxdocs-db (Postgres)
├── vercel.json                   # /api/:path* → Render + SPA fallback (comments in README)
├── README.md / RUN.md / WEBSITE_SUMMARY.md / PROJECT_PROGRESS.md
└── package.json / vite.config.ts / tsconfig*.json / .oxlintrc.json
```

---

## 6. Backend API Surface

All under `/api` (CORS restricted to `FRONTEND_ORIGIN`); every response carries security headers; write endpoints enforce JSON + Origin + size cap + rate limits.

| Method | Endpoint | Auth |
|---|---|---|
| GET | `/health` | — |
| POST | `/auth/register`, `/auth/login` | rate-limited (lockout on login) |
| POST | `/auth/refresh`, `/auth/logout` | refresh cookie |
| POST | `/auth/request-password-reset`, `/auth/reset-password` | rate-limited |
| GET | `/auth/me`, `/user/me` | JWT |
| GET | `/commands`, `/commands/<slug>` | JWT |
| GET/POST | `/user/bookmarks[/toggle]` | JWT |
| GET/POST/DELETE | `/user/notes[/<slug>]` | JWT |
| GET/POST | `/user/history[/add]` | JWT |
| POST | `/user/change-password`, `/user/data/import` | JWT |
| DELETE | `/user/delete-account` | JWT |

---

## 7. Verification Status

| Check | Result |
|---|---|
| `npm run build` (`tsc -b && vite build`) | ✅ passes (route-split chunks, no 500 kB warning) |
| `npm run lint` (oxlint) | ✅ zero warnings |
| Backend tests | ✅ **79 passed** |
| `qa/smoke_api.py` (API-level checklist) | ✅ **14/14 PASS** |
| `qa/browser_check.py` (real browser, phone viewport included) | ✅ **22/22 PASS — zero console errors** |
| Command accuracy spot-check (expand, grep, cp, lsof, uname, whois, gdb flavored scan + whole-dataset syntax bracket audit) | ✅ 2 defects found & fixed (`systemctl` bracket, `expand -i` example) |
| README screenshots/GIF | ✅ captured by the QA harness into `docs/screenshots/` |

**Known notes:**
- Render's free Postgres tier sleeps/expires per Render policy — upgrade the plan for a persistent deployment.
- `vercel.json`/`render.yaml` placeholders (`FRONTEND_ORIGIN`, `ALLOWED_HOSTS`) must be pointed to the final URLs after first deploy (steps in README "Deploy your own").

---

## 8. Open items / nice-to-haves
1. Push to GitHub → create Render blueprint + Vercel project → fill the two placeholder env vars → capture the live URL into README.
2. Optional: real email delivery for password reset (tokens are already opaque/hashed/single-use; dev logs raw token only with `RESET_LOG_TOKENS=1`).
3. Optional: sitemap.xml / robots.txt + OG image polish for the live domain.
4. Optional: scheduled CI run of `qa/smoke_api.py` against a staging deployment.
