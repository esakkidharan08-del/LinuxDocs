# LinuxDocs — Project Progress & Structure

> Snapshot of **current** project state. Covers what exists, what's finished,
> what's still work-in-progress, the feature inventory, and the site structure.

**Last updated:** session snapshot (intro + contact + kinetic-loader work landed, uncommitted)

---

## 1. Project at a Glance

An MDN-style reference for **Linux commands** plus a **CTF / security-tooling section**, wrapped in an editorial "terminal" UI with a **cyberpunk 3D intro** and hosted user accounts (bookmarks, notes, history).

| | |
|---|---|
| **Frontend** | Vite 8 + React 19 + TypeScript + Tailwind CSS v4 (+ Framer Motion, react-icons, lucide-react, fuse.js) |
| **Backend** | Flask + Flask-SQLAlchemy + Flask-Bcrypt + Flask-JWT-Extended + Flask-CORS |
| **Database** | SQLite (`backend/instance/app.db`) local / PostgreSQL for production |
| **Auth** | JWT access token (15 min) + HttpOnly refresh cookie (30 days), silent refresh |
| **Docs dataset** | **58 commands** — 39 Linux · 19 CTF — across **23 categories/domains** (13 Linux + 10 CTF) |

**Files that describe how to run it:** `RUN.md` (step-by-step, Windows PowerShell) and `README.md` (setup + verification checklist).

---

## 2. Current Progress

### 2.1 Committed history (most recent first)
| Commit | What |
|---|---|
| `69caf3d` | Complete progress import and feature checklist |
| `15e23ab` | Protect account routes |
| `23025ae` | Add password reset flow |
| `eb533ac` | Add command tools and auth token refresh |
| `31e03ad` | Add searchable command cheat sheets |
| `4d2af09` | Add local learning paths and quizzes |
| `1a8a26d` | Add browser-only practice terminal |
| `6adfd4c` | Add dataset-backed command explainer |
| `87ad756` | Add structured command builders |
| `e7fc989` | Expand Linux text command catalog |

### 2.2 Work logged in `TODO.md` — all checked ✅
Command builders · Explain This Command · Practice Terminal (+ progress persistence) · quizzes/learning paths · print-friendly cheat sheets · command comparison · Command of the Day · bookmark/note export & JSON import · keyboard-shortcuts help · session security + dev password reset · report-a-mistake links · final verification.

### 2.3 Uncommitted work in progress ⚠️
Everything below is **not committed yet** and lives on top of `69caf3d`.

**New feature work (this session):**
- **Cyberpunk 3D intro** — `src/pages/IntroPage.tsx` + `src/components/IntroScene.ts`
  - Boot typewriter → **ENTER DOMAIN** word → `[INITIATE]` → kinetic loading screen → **ACCESS GRANTED** → `[ENTER LINUXDOCS]` → home.
  - Canvas-2D 3D scene (double icosahedron + octahedron, data rings, Tron grid, 260 motes, chromatic core); runs once per session via `sessionStorage['linuxdocs_intro_seen']`; `/intro` route always shows it ("Replay intro" link in footer).
  - **No auto-advance anywhere** — the user must click INITIATE and then ENTER.
- **VengeanceUI SocialFlipButton** — `src/components/ui/SocialFlipButton.tsx`
  - 7 flip tiles spelling **C·O·N·T·A·C·T**; each flips to reveal a real profile: LinkedIn, GitHub, Fiverr, Email, X/Twitter, Instagram, Discord. Mounted in the hero and in a footer **Contact bar**.
- **VengeanceUI KineticTextLoader** — `src/components/ui/KineticTextLoader.tsx`
  - The loading screen after INITIATE; themed with the main UI's editorial tokens (`var(--terminal-green)`, `var(--text-heading)`); respects `prefers-reduced-motion`.
- **Editorial design system** — `src/index.css` (theme tokens, `.dark`/`.light` variants, cyberpunk kit `.cp-*`, kinetic keyframes), `src/components/ThemeContext.tsx`, `src/lib/utils.ts` (`cn`), `src/components/ui/*`.
- **Keyboard shortcuts dialog** — `src/components/ShortcutsDialog.tsx` + `?` shortcut.
- **New pages** — `src/pages/LegalPage.tsx` (privacy/terms), `src/pages/IntroPage.tsx`.
- **Backend security hardening** — `backend/app/security.py` (new), `backend/app/sessions.py` (new), `backend/app/models.py` (+`Session`, +`PasswordResetToken`), `backend/app/auth.py`, `backend/app/user.py`, `backend/app/__init__.py`, `backend/tests/test_security.py` (new, 16 tests), `backend/.env.example`. See §3.5 for the full control list.

**Pre-existing uncommitted changes (do NOT touch):**
- Modified: `src/services/api.ts`, plus a broad sweep of the other `src/` files, `index.html`, `package.json`/`.json`.
- Untracked helpers: `public/og-image.svg`, `src/context/CatalogContext.tsx`, `src/data/catalog.ts`, `.agents/` (skills), `RUN.md`, `skills-lock.json`.
- Local junk (untracked, generated): `backend/cookies*.txt`, `backend/runtime-*.log`, `runtime-stderr.log`, `runtime-stdout.log` — safe to ignore/delete.
- Note: `backend/app/__init__.py`, `auth.py`, `models.py`, `user.py` now also contain **this session's hardening work** (§3.5) on top of their prior uncommitted edits.

---

## 3. Feature Inventory

### 3.1 Content & reference
- **Command reference** — 58 hand-checked commands, each with syntax, description, flags/options (with examples), real-looking outputs, use cases, related commands, tags, notes and warnings. Modeled in `src/types.ts` (`Command`, `CommandOption`, `CommandExample`).
- **Linux section** — 39 commands across 13 categories (file & directory, permissions & ownership, text processing, process management, networking, package management, disk & storage, archiving & compression, users & groups, shell & scripting, system info & monitoring, search & find, services & logs).
- **CTF & security section** — 19 tools across 10 domains (recon, web, crypto, reverse-engineering, forensics, pwn, osint, mobile, cloud, containers), each domain with recommended external tools.
- **Command detail pages** — breadcrumbs, table of contents, copy-code blocks, bookmark star, per-command notes (Ctrl+S autosave), related commands, "report a mistake" links.
- **Command of the Day / random command** — `/command-of-the-day`.
- **Print-friendly cheat sheets** — `/cheat-sheets`, searchable, print stylesheet.

### 3.2 Interactive tools
- **Command Builder** (`src/components/CommandBuilder.tsx`) — assemble flags for opt-in commands interactively.
- **Explain This Command** (`/explain`) — paste a one-liner; every token is accounted for from the dataset.
- **Practice Terminal** (`/practice-terminal`) — browser-only simulated shell with progress persistence (never touches the machine).
- **Compare commands** (`/compare`) — two utilities side-by-side, flags and all.
- **Learning paths & quizzes** (`/learn`) — guided questions with per-path progress.
- **Export / import** (`/export-import`) — bookmarks & notes as JSON, import back.

### 3.3 Accounts & data (backend)
- Register / login / logout / refresh with **opaque, rotating, revocable server-side sessions** (HttpOnly cookies, CSRF-safe, silent refresh).
- Password change, delete account (with cascade), password reset with single-use hashed tokens.
- **Bookmarks** (toggle, starred list), **Notes** (per-command upsert + delete), **History** (last 15 viewed).
- **Dashboard** (`/dashboard`) — tabs for Bookmark / Notes / History. **Settings** (`/settings`).
- Rate-limited auth endpoints, per-account lockout, server-side validation; `ProtectedRoute` gates account pages.

### 3.4 Shell / UX / presentation
- **Cyberpunk 3D intro** on first visit (see §2.3) with full click-through flow.
- **Editorial terminal theme** — dark/light toggle (`.dark`/`.light` on `<html>`, persisted in `localStorage['linuxdocs_theme']`) driven by CSS variables, not Tailwind `dark:` variants.
- **Layout chrome** — sticky blurred header, off-canvas → docked sidebar (with per-category command counts), skip-to-content link, noise overlay, footer.
- **Command palette** (`Ctrl/Cmd+K`) with fuse.js search + **shortcuts dialog** (`?`).
- **Keyboard navigation / Esc shortcuts**; reduced-motion support (media-query + global CSS kill-switch).
- **Contact (VengeanceUI flip button)** with 7 real channels in hero + footer.

### 3.5 Security hardening (backend)
Defense-in-depth added on top of the existing stack (no new dependencies):

- **Persistent "remember me" sessions** — refresh is no longer a stateless JWT. Login/register issue an opaque random token; only its **SHA-256 hash** is stored in a new `sessions` table. Sessions are **rotated on every refresh** (sliding expiry; remember-me ≈ 1 year, plain ≈ 24 h) and are **revocable** server-side. Presenting a rotated-out token after a short grace window is treated as **token theft** and revokes *all* of the user's sessions.
- **Brute-force protection** — sliding-window **rate limiting** per IP on every sensitive endpoint (login, register, refresh, reset, change-password, delete-account) plus **per-account lockout** after repeated failed logins. Limits are env-configurable and auto-disabled under `TESTING`.
- **CSRF defense** — refresh cookie is `SameSite=Strict` (configurable via `SESSION_COOKIE_SAMESITE`); state-changing auth endpoints reject requests whose `Origin` header is not the configured frontend origin (blocks login-CSRF and cross-site refreshes).
- **Request hygiene** — `application/json` enforced on write endpoints (415 otherwise), 1 MiB body cap (413), strict cookie flags (`HttpOnly`, `Secure` in prod, `SameSite=Strict`, `Path=/`), `X-Request-ID` correlation, and structured `SEC-EVENT` audit logging (logins, lockouts, rotations, theft, origin mismatch, resets).
- **Security headers** on every response — `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`, and (production) `Strict-Transport-Security` + a strict **CSP** (self + Google Fonts + hashed inline theme script).
- **Stronger passwords** — shared policy on register/reset/change (length, mixed case, digit, special, no username/email, rejects a list of common breached passwords).
- **Input caps** — slug/note length limits, import item caps, type guards on every parsed field.

---

## 4. Website Structure

### 4.1 Routes / Sitemap

| Route | Page | Notes |
|---|---|---|
| `/` | Landing page | On first visit per session the **cyberpunk intro owns `/`**; afterwards it shows the landing page |
| `/intro` | Cyberpunk intro (always) | Linked as "Replay intro" in the footer |
| `/linux/:categoryId` | Category page | e.g. `/linux/networking` |
| `/linux/:categoryId/:slug` | Command detail | e.g. `/linux/file-and-directory/ls` |
| `/ctf` | CTF home | |
| `/ctf/:domainId` | CTF domain page | e.g. `/ctf/recon` |
| `/ctf/:domainId/:slug` | Command detail (CTF) | |
| `/cheat-sheets` | Searchable cheat sheets | |
| `/explain` | Explain a command | |
| `/practice-terminal` | Practice terminal | |
| `/learn` | Learning paths & quizzes | |
| `/compare` | Compare commands | |
| `/command-of-the-day` | Command of the day / random | |
| `/export-import` | Bookmark/note JSON export & import | |
| `/sign-in` `/sign-up` | Auth | terminal-styled |
| `/password-reset` | Dev password reset | |
| `/dashboard` | Bookmarks · Notes · History | `ProtectedRoute` |
| `/settings` | Change password, delete account | `ProtectedRoute` |
| `/privacy` `/terms` | Legal | shared `LegalPage` |
| `*` | 404 | NotFoundPage, themed |

### 4.2 Page anatomy (app shell)
```
┌──────────────────────────────────────────────┐
│ Header — sticky, blurred                      │
│   ☰ menu · logo · nav · Ctrl+K search ·      │
│   theme toggle · account menu (sign in/out)  │
├────────┬─────────────────────────────────────┤
│Sidebar │ Main (#main)                        │
│• Linux │  per-route page content             │
│  (13   │                                     │
│  cats) │                                     │
│• CTF   │                                     │
│  (10   │                                     │
│  doms) │                                     │
├────────┴─────────────────────────────────────┤
│ Footer — 3 nav columns (Reference/Tools/More)│
│   + Contact bar: "Contact" · 7 flip tiles ·  │
│     © copyright                              │
└──────────────────────────────────────────────┘
Overlays: CommandPalette (Ctrl+K), ShortcutsDialog (?),
          sidebar mobile drawer, intro (first visit or /intro)
```

### 4.3 Intro flow (stage machine)
```
boot (typewriter) ──► domain ("ENTER DOMAIN" + [INITIATE])
     ──[click INITIATE]──► loading (KineticTextLoader "Loadıng")
     ──(2.8s)──► ACCESS GRANTED  ──[click ENTER LINUXDOCS]──► /
Everything is click-gated; Esc or [SKIP] exits early.
```

---

## 5. Project Structure (annotated)

```
LinuxDocs/
├── src/                          # Frontend
│   ├── App.tsx                   # Providers + router; AppShell gates the intro (sessionStorage)
│   ├── main.tsx                  # Entry point
│   ├── index.css                 # Theme tokens (.dark/.light), editorial kit,
│   │                             #   cyberpunk kit (.cp-*), kinetic-loader keyframes
│   ├── types.ts                  # Command / CategoryInfo / CTFDomainInfo models
│   ├── components/
│   │   ├── ui/                   # VengeanceUI adaptions
│   │   │   ├── SocialFlipButton.tsx   # 7-tile C·O·N·T·A·C·T contact (real URLs)
│   │   │   └── KineticTextLoader.tsx  # kinetic word loader (main UI tokens)
│   │   ├── IntroScene.ts         # Dependency-free Canvas-2D cyberpunk 3D renderer
│   │   ├── Header.tsx / Sidebar.tsx / Footer.tsx / Breadcrumbs.tsx
│   │   ├── CodeBlock.tsx / TableOfContents.tsx / CommandBuilder.tsx
│   │   ├── CommandPalette.tsx / ShortcutsDialog.tsx / ProtectedRoute.tsx
│   │   └── ThemeContext.tsx      # dark/light theme provider
│   ├── context/
│   │   ├── AuthContext.tsx       # auth state, silent refresh
│   │   └── CatalogContext.tsx    # (new) fetches catalog from API after auth
│   ├── data/
│   │   ├── commands.ts           # SOURCE OF TRUTH: COMMANDS, LINUX_CATEGORIES, CTF_DOMAINS
│   │   ├── commandBuilders.ts    # builder definitions
│   │   └── catalog.ts            # path helper for commands
│   ├── lib/utils.ts              # cn() helper
│   ├── pages/                    # 18 pages (see route table above)
│   └── services/api.ts           # API client (proxied /api → :5000)
├── backend/                      # Flask API
│   ├── app/
│   │   ├── __init__.py           # App factory, env validation, CORS, security middleware, blueprints
│   │   ├── auth.py               # register / login / refresh / logout / me / password reset
│   │   ├── user.py               # bookmarks, notes, history, password, account
│   │   ├── commands.py           # GET /api/commands[/:slug] (jwt-protected)
│   │   ├── security.py           # rate limiter, lockout, headers, CSRF origin, request-id
│   │   ├── sessions.py           # opaque rotating sessions + reset tokens + cookie helpers
│   │   └── models.py             # User, Bookmark, UserNote, RecentlyViewed, Session, PasswordResetToken
│   ├── data/                     # commands.json (183 KB) + batch2/3
│   ├── scripts/build_commands.mjs
│   ├── tests/                    # test_auth.py (32) + test_security.py (16) — 48 passing
│   ├── requirements.txt / .env.example / pytest.ini / check_links.py
├── qa/check-links.ts             # npm run check:links
├── public/og-image.svg
├── README.md / RUN.md / TODO.md  # setup, run steps, feature checklist
└── package.json / vite.config.ts / tsconfig*.json / .oxlintrc.json
```

---

## 6. Backend API Surface

All under `/api`, CORS restricted to `FRONTEND_ORIGIN`. **Every** response carries the
security headers; write endpoints enforce `application/json`, an Origin check, a body
size cap, and per-IP rate limits (see §3.5).

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/health` | — | Health check (`{"status":"ok"}`) |
| POST | `/auth/register` | rate-limited | Create account + remembered session |
| POST | `/auth/login` | rate-limited · lockout | Login (Origin-checked); `remember` → 1-year sliding session |
| POST | `/auth/refresh` | cookie | Rotate session token + issue access token |
| POST | `/auth/logout` | cookie | Revoke current session + clear cookies |
| POST | `/auth/request-password-reset` | rate-limited | Always `202`; issues hashed single-use token |
| POST | `/auth/reset-password` | rate-limited | Consume reset token, set new password, revoke sessions |
| GET | `/auth/me`, `/user/me` | JWT | Current user |
| GET | `/commands` | JWT | Categories, domains, commands |
| GET | `/commands/<slug>` | JWT | Single command |
| GET / POST | `/user/bookmarks[/toggle]` | JWT | Bookmark list / toggle |
| GET / POST / DELETE | `/user/notes[/…]` | JWT | Note list / upsert / delete |
| GET / POST | `/user/history[/add]` | JWT | Recent views (15) |
| POST | `/user/change-password` | JWT | Change password (revokes other sessions) |
| DELETE | `/user/delete-account` | JWT | Delete account + cascade |

---

## 7. Verification Status

| Check | Result |
|---|---|
| `npm run build` (`tsc -b && vite build`) | ✅ passes |
| `npm run lint` (oxlint) | ✅ passes — pre-existing warnings only (fast-refresh on exported constants, a couple of hooks deps, one unused expression in CommandBuilder) |
| Backend tests (`backend\venv\Scripts\python -m pytest`) | ✅ **48 passed** (32 original + 16 security) |
| Live HTTP smoke test (real server, temp DB) — health · register · me · refresh rotation · cross-origin `403` · non-JSON `415` · bad password `401` · logout · post-logout `401` | ✅ ALL PASS |
| `create_all` on the existing `instance/app.db` | ✅ adds `sessions` + `password_reset_tokens`; existing 7 users & data untouched |
| Command link check (`npm run check:links` / backend `check_links.py`) | ✅ PASS |
| Headless CDP flow checks (intro click-through, flip tiles, kinetic loader) | ✅ PASS |

**Known issues / notes:**
- Build warns: main bundle > 500 kB after minification (framer-motion + react-icons) — non-blocking; code-splitting is a possible follow-up.
- `npm audit` reports 2 high-severity findings — not yet acted on.
- Theme switch is CSS-variable driven (no `@custom-variant dark`), so Tailwind `dark:` variants follow `prefers-color-scheme`, not the class — theme components use `var(--...)` tokens only.
- The intro renders on `/` until `sessionStorage['linuxdocs_intro_seen']` is set; `/intro` always shows it.

**Production / deployment notes (backend hardening):**
- Set `FLASK_ENV=production` → enables `Secure` cookies, HSTS, and the strict CSP. This **requires HTTPS**; `Secure` cookies are not sent over plain HTTP.
- The refresh cookie defaults to `SameSite=Strict` (CSRF-hardened) and assumes the SPA and API are **same-site** (same host or a shared parent domain). If they are truly cross-site, set `SESSION_COOKIE_SAMESITE=Lax` (or `None`) — `None` forces `Secure` cookies and needs HTTPS. The default is the safest choice for the current same-host deployment.
- Flask only emits the security headers on `/api` responses. The SPA's own HTML is served by the static host/Vite — replicate the CSP/HSTS headers at that layer (nginx/CDN).
- Run behind a production WSGI server (gunicorn/waitress), not the dev server; only set `TRUST_PROXY_HEADERS=1` when actually behind a proxy you control (it affects client-IP rate limiting).

---

## 8. Suggested Next Steps (open items)

1. **Commit the current work** — cyberpunk intro · SocialFlipButton · KineticTextLoader · backend security hardening (§3.5) · design system · ShortcutsDialog · LegalPage · PROJECT_PROGRESS.md (and decide what to do with the pre-existing uncommitted sweep).
2. Optional: split the >500 kB bundle via dynamic `import()` per route.
3. Optional: address the 2 npm audit advisories, or document them as accepted.
4. Optional: wire real email delivery for password reset (tokens are already opaque/hashed/single-use; dev logs the raw token only when `RESET_LOG_TOKENS=1`).
5. Optional: add a production build + preview check into automation (currently manual per confirmed features).