# LinuxDocs — Website Summary

**LinuxDocs** is a professional, MDN-style reference and learning platform for **Linux commands and CTF security tools** — precise syntax, real flags, copy-ready examples — combined with a full interactive learning system: guided paths, quizzes, a sandboxed practice terminal, flashcards, a speed-drill arena, achievements, and streaks.

> Status: ✅ production build green · lint zero findings · **117 backend tests passing** (incl. the catalog-API suite) · browser QA **34/34** (zero React update-depth console hits) · API smoke **19/19** (unauth 401 gates on every dataset endpoint) · sync probe **15/15** (legacy guest migration) · terminal probe **62/62** · reset probe **8/8** · dataset docs-accuracy audit **PASSED** (132 entries re-validated from `backend/data`, 19 warnings, 82 thin pending review) · bundle carries **zero command prose** (`qa/dist_probe.py` DIST CLEAN — docs chunk deleted, entry chunk **134.41 kB gzip**) · **Part 1 of the improvement plan (sign-in first + dataset behind the authed API) committed on `improve/main-plan`** · earlier rounds: Task 4 `92b8371`, Task 5 `37120d8`, Task 6 `cfedee7`, Part 0 = one-shot QA runner + baseline (`docs/baseline.md`).

---

## 1. Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19 + TypeScript (strict), Vite 8 (rolldown), Tailwind CSS 4 |
| Routing | React Router 7 (`BrowserRouter`) |
| Search | Fuse.js fuzzy search (Command Palette) |
| Icons / Motion | lucide-react · framer-motion · react-icons |
| Backend | Flask (Python) — auth, bookmarks, notes, history, durable persistence (SQLite locally / Postgres in production), security hardening + tests |
| Quality tools | `tsc -b` (build), `oxlint` (lint), `qa/dataset_audit.py` (docs-accuracy audit), per-feature browser/API probe suites |
| Dev experience | `npm run dev:all` runs Vite (:5173) + Flask (:5000) together, with `/api` proxy and strict-port CSRF-safe setup |
| Deployment | `render.yaml` (Flask API on Render, gunicorn) + `vercel.json` (Vercel SPA with `/api` proxy rewrites) |

---

## 2. Content at a Glance

- **132 fully documented commands** — 95 Linux + 37 CTF tools (each entry carries: summary, syntax, options with descriptions, examples with output, use cases, related commands, tags, warnings). Since improvement-plan **Part 1** the corpus's **single source of truth lives in `backend/data`** (one per-slug JSON per command + `commands-order.json` + `categories.json`/`domains.json`), compiled by `node backend/scripts/build_commands.mjs` into `commands.json` (aggregate) + `commands-index.json` (light) and re-validated by `qa/dataset_audit.py`. The SPA no longer bundles any of it: after login the app fetches the light index from `GET /api/catalog/index` and every command doc on demand from `GET /api/commands/<slug>` (both JWT-protected, ETag/304, `Cache-Control: private`) into an in-memory cache cleared on logout — the shipped bundle carries zero command prose. Thin entries (82) are flagged with a "docs pending review" chip on their pages.
- **13 Linux categories** — File & Directory, Permissions & Ownership, Text Processing, Process Management, Networking, Package Management, Disk & Storage, Archiving & Compression, Users & Groups, Shell & Scripting, System Info & Monitoring, Search & Find, Services & Logs.
- **10 CTF domains** — Reconnaissance, Web Hacking, Cryptography, Reverse Engineering, Forensics, Pwn (Binary Exploitation), OSINT, Mobile Security, Container Security, Cloud Security.

---

## 3. Pages & Routes

| Route | Page | What it does |
|---|---|---|
| `/` | LandingPage | Terminal-editorial hero + **8-tile tools band** linking every tool on the site (responsive 1/2/4 columns) |
| `/intro` | IntroPage | Cinematic first-visit intro (skipped for returning users; footer "Replay intro") |
| `/linux/:categoryId` | CategoryPage | Command index per Linux category |
| `/linux/:categoryId/:slug` · `/ctf/:domainId/:slug` | CommandDetailPage | Full command docs, builder, bookmarks, notes, copy buttons |
| `/ctf` · `/ctf/:domainId` | CTF trio | Tool catalog grouped by security domain |
| `/learn` | **LearningPage** | Two-stage learning system + quizzes (section 4) |
| `/practice-terminal` | **PracticeTerminalPage** | Sandboxed shell with 13 missions in 3 levels (section 5) |
| `/flashcards` | **FlashcardsPage** | Flip-card decks built from the dataset (section 6) |
| `/speed-drill` | **SpeedDrillPage** | 60-second quiz arena (section 7) |
| `/explain` | ExplainCommandPage | Type any command, get a structured breakdown |
| `/cheat-sheets` | CheatSheetsPage | Printable category cheat sheets |
| `/compare` | ComparePage | Two commands side by side, flags and all |
| `/command-of-the-day` | CommandOfDayPage | Deterministic daily command + shuffle |
| `/dashboard` 🔒 | DashboardPage | Learning summary, 12 achievements, bookmarks, notes, history |
| `/settings` 🔒 | SettingsPage | Theme, profile, shortcuts |
| `/export-import` | ExportImportPage | One-file backup/restore of all progress (section 9) |
| `/sign-in` · `/sign-up` · `/password-reset` | Auth pages | Sign-up/sign-in drop you straight into the app (dashboard); `/password-reset` emails the account holder a **single-use link** and shows an identical neutral confirmation whether or not the address is registered. **Sign-in first (Part 1):** these pages, the legal pages and 404 are the *only* public routes — every other deep link hits `ProtectedRoute` and bounces to `/sign-in?next=<where>`, and login returns you exactly where you started |
| `/privacy` · `/terms` | LegalPage | Legal docs |
| `*` | NotFoundPage | `/dev/void` easter-egg terminal with one hidden flag 🏴 |

Since Part 1 *every* route marked 🔒 — and indeed **all content routes** — sit behind `ProtectedRoute`; the 🔒 markers are kept as historical decoration. Gate behavior: a signed-out visit lands on `/sign-in?next=<path>`, and after logging in the app resumes at that path. Invalid categories/domains/commands all render proper "not found" states — no dead ends.

---

## 4. Learning System (`/learn`)

- **Two stages, 8 paths.** Stage 1 = Shell Basics, Text Tools, System & Networking, Security & CTF. Stage 2 = Permissions & Ownership, Shell Automation, Services & Logs, Secure Ops.
- **Stage gating:** completing **all four Stage-1 paths** (via lessons *or* quiz) unlocks Stage 2, with an unlock banner + CTA to the next path.
- **Lessons:** reading every lesson in a path auto-completes it (celebration flash + persistent ✓ badge).
- **Quizzes:** strict rules — pick difficulty first (Easy/Easy+Medium/All), *then* a question count chip (1–10, hard-capped at **10**; chips above the pool size of the chosen difficulty are disabled). Question banks: **22 per path** (10 easy / 6 medium / 6 hard) → 176 questions total.
- **Results:** score ring, correct/total, per-question review list with explanations.
- Every path exposes `LEARNING_PATHS` from `LearningPage.tsx`, consumed by the Dashboard.

## 5. Practice Terminal (`/practice-terminal`)

- A WASM-free, JS-interpreted sandbox shell supporting dozens of real commands (`ls`, `cd`, `cat`, `grep`, `chmod`, `ps`, `kill`, `systemctl`, and more).
- **13 missions across 3 levels.** Finishing every mission in a level opens the next level.
- **Command chips** under the prompt shrink with level: **Level 1 → 6 chips, Level 2 → 4, Level 3 → 1, beyond → 0** (self-reliance ramp).
- Progress is **merge-only**: solved missions never un-complete, even if the transcript is replayed. Save state = `{ lines, history, solved, commandsRun }`.
- Fully mobile-responsive drawer + keyboard history (↑/↓).

## 6. Flashcards (`/flashcards`)

- Decks generated straight from the dataset: **All Linux**, one per Linux category, **All CTF**, one per CTF domain, plus a bookmarks-only deck when bookmarks exist.
- Front: command name + tags · Back: summary, syntax, up to 5 flags (+count of more), the first example command, the warning note **when the entry has one**, and an in-app link to the command's full docs page.
- Session controls: **Got it / Again**, segment strip, keyboard `Space`/`←`/`→`/`G`/`X`, end-of-session summary with retention % and revisit links.

## 7. Speed Drill (`/speed-drill`) — unique feature

- Questions are **generated at runtime from the real dataset** (no hand-written content, unlimited variety): 4 shapes — flag→purpose, purpose→flag, command→summary, summary→command.
- **60-second countdown**, keys `1–4`, combo bonus (+1 point per every 3rd consecutive hit), 🔥 live combo badge.
- Personal best + rounds played persisted; results show score, accuracy %, longest streak, "NEW PERSONAL BEST!" detection.

## 8. Achievements & Streak (Dashboard)

- **12 derived badges** with progress bars and unlock hints, computed from existing saved progress — Pop quiz, Quiz ace (90%+), Stage 1 cleared, Full curriculum, Field operator (5 missions), Box mastered (13 missions), Deck runner, Deck marathon, Quick reflexes, Drill sergeant, On a roll (5-day streak), Habit locked in (30-day).
- Learning summary panel: paths completed, lessons read, quiz average, missions solved, current streak + jump links to each feature.
- **Daily streak** (`src/lib/streak.ts`): recorded once per app load from the shell; resets to 0 unless yesterday's visit is consecutive; best streak persists forever.

## 9. Data Architecture — where progress lives

All progress is local-first (works signed-out) and included in Export/Import:

| localStorage key | Contents |
|---|---|
| `linuxdocs.learning-progress-v3` | Per-path: lessons read, quiz bests, completed flags, stage progression |
| `linuxdocs.practice-terminal` | Terminal lines, history, solved missions, commands-run counter |
| `linuxdocs.flashcards` | Last deck, per-deck session completes |
| `linuxdocs.speeddrill` | Personal best, rounds played |
| `linuxdocs.streak` | Current streak, best streak, last-visit date |
| bookmarks / notes / history | Synced to the account via the Flask API when signed in; **guest mode no longer exists** since Part 1 — a pre-existing legacy device store is instead migrated once into the account at first sign-in (guest records win for the records the guest touched, unseen server records survive); offline edits queue as idempotent end-state ops and replay with exponential backoff |
| `linuxdocs.sync-queue-v1` | Persisted per-user sync queue (idempotent end-state ops, same-key collapse) |
| `linuxdocs.guest-data-v1` | Legacy artifact from the guest-mode era — the app no longer writes it; at sign-in it is absorbed into the queue as queued ops and the key is deleted |

Mission IDs `m1`–`m13` are stable contracts — saved progress survives upgrades. Signed-in users also get server-side bookmarks/notes/history sync.

## 10. Backend & Security

- Flask backend under `backend/` — SQLite locally, **PostgreSQL in production** via `DATABASE_URL` (render.yaml autowires it; the SQLite-only WAL/backup machinery detects non-SQLite URIs and disables itself) — with session cookies, CSRF origin checks, hardened auth, and session management (token rotation on refresh, session-cap eviction, single-use reset tokens).
- **Offline-friendly data sync**: a dashboard chip shows the honest five-state truth ("All changes saved · Syncing… · Synced · Saved locally — syncs automatically · Sync failed"); "Synced" appears only after the server's 2xx. Changes made offline land in a persisted end-state op queue that retries with exponential backoff (online event, 30 s ticker, or chip click), guests can bookmark and build history on-device and the data merges deterministically into the account at sign-in (guest wins for touched records), and account switches never leak state (per-user queued ops + stale-response guards). Exports/imports carry a schema version with strict client+server validation.
- **Practice terminal, hardened**: the sandbox is a pure interpreted module (no eval, no host execution) with explicit resource limits — command lines capped at 2000 chars (interpreter + `maxLength`), 400-line scrollback, prototype-safe file lookups (`cat __proto__` reads nothing), and trick-free `man` coverage (builtins **and** all 132 dataset tools). Unknown commands suggest the closest real command ("did you mean 'ls'?"), `grep`/`wc`/`find` parse real flags, and **missions complete only when the expected output was actually produced** — error-tone turns never count. Still 13 missions across 3 levels.
- Modules: `auth.py` · `commands.py` · `user.py` · `models.py` · `security.py` · `sessions.py` · `persistence.py` (auto-backup of the DB on startup/manual/scheduled triggers + maintenance prune).
- **Password reset by email** (`/password-reset`): the request endpoint answers a byte-identical generic response for registered/unknown addresses (no user enumeration, timing equalized with a dummy bcrypt round) and emails a branded message with a **single-use, 30-minute link** built from the trusted `FRONTEND_ORIGIN`. Tokens are stored only as SHA-256 hashes, expire in 30 minutes, are consumed **atomically** (concurrent claims: exactly one wins), and a successful reset **revokes every session** on the account. Tokens never appear in API responses, logs, DOM, or referrer data. Providers: Resend API or any SMTP server via env vars; local development uses a safe **dev outbox backend** that writes `.eml` mailbox files and logs nothing. Both reset endpoints are rate-limited (5 requests + 10 token attempts per hour/IP).
- Six test suites — `test_auth.py` (32) + `test_hardening.py` (30) + `test_security.py` (17) + `test_mailer.py` (14) + `test_user_data.py` (9) + `test_dataset.py` (7, docs-accuracy rules over the 132-entry dataset) — **109 pytest cases**.
- `.env.example` documents required secrets (`SECRET_KEY`, `JWT_SECRET_KEY`, `DATABASE_URL`, `FRONTEND_ORIGIN`); cookies/logs/instance DBs are git-ignored (never committed).
- **Deployment scaffold, inspected line-by-line (Task 6)**:
  - `render.yaml`: Postgres `DATABASE_URL` autowired from the blueprint database; `SECRET_KEY` / `JWT_SECRET_KEY` are **generated by Render at first boot** (never inside the repo); `TRUST_PROXY_HEADERS=1` so client-IP rate limits read the Vercel→Render proxy chain; gunicorn with an `/api/health` healthcheck. The two documented post-deploy edits are the Vercel URL (`FRONTEND_ORIGIN`) and the real service host (`ALLOWED_HOSTS`).
  - `vercel.json`: `/api/:path*` proxy to the Render service + SPA fallback — the browser always talks **same-origin**, so SameSite=Strict refresh cookies and the `require_trusted_origin` CSRF guard hold with no extra origin configuration beyond `FRONTEND_ORIGIN`.
  - **Cookies verified in code** (`sessions.py`): refresh cookie is HttpOnly ✓, Secure outside localhost ✓ (forced when SameSite=None), SameSite=Strict default ✓ (Lax/None opt-in via env).
  - **Secret hygiene verified on the artifact**: the production bundle contains no `SECRET_KEY` / `JWT_SECRET` / `RESEND_API` / `SMTP_PASSWORD` material (the only matches are a curl *example string* in the docs data and the API client's memory-only access-token plumbing); the dev-only `"__linuxdocsTerminal"` hook is absent from `dist/`; git tracks only the templated `.env.example`.
  - **Remaining step is user-side, not code**: create the Render + Vercel services, replace the two URL placeholders, set mail env vars if email delivery is wanted (README "Deploy your own" walks through it). A live deployment was not exercised here.

## 11. Performance & UX System

- **Route-level code splitting:** 21 lazy page chunks + lazy Command Palette (fuse.js loads on first Ctrl+K) + lazy intro. Entry chunk ≈ **420 kB min / 135 kB gzip** (down from 552.7 kB after Task 5, which was itself down from 852 kB): the shell loads the lightweight dataset index only; the full 132-entry docs ship as a **134 kB async chunk** (~40 kB gzip) fetched by the lazy routes that need it. Largest page chunk ≈ 77 kB.
- **Command Palette** (Ctrl+K / Ctrl+⌘K): fuzzy search across all 132 commands → jump-to-page.
- **Shortcuts dialog** (`?`), theme toggle (dark/light, persisted), sidebar with "Study & Tools" group, skip-to-content link, ARIA labels, full mobile responsiveness, terminal-editorial design tokens.

## 12. Quality Gates (latest run)

| Check | Result |
|---|---|
| `npm run build` (tsc strict + vite) | ✅ passes, no warnings (entry ≈ 420 kB min / 135 kB gzip after the Task-5 split; full docs now a 134 kB async chunk) |
| `npm run lint` (oxlint) | ✅ zero findings |
| `qa/dataset_audit.py` docs-accuracy audit | ✅ **AUDIT PASSED** — 132 entries validated from `backend/data` (per-slug JSON): structure, flags/aliases, warnings (19), aggregate/index sync, index/counts cross-check, thin-docs queue |
| `qa/dist_probe.py` bundle-leak scan | ✅ **DIST CLEAN** — 5 distinctive dataset sentences (from `ls`, `cd`, `touch`, `less`, `find`) grep'd across all 49 built `dist/` artifacts: zero hits; the lazy docs-data chunk is gone from the build |
| Backend tests (`backend\venv\Scripts\pytest`) | ✅ **117 passed** (32 auth + 30 hardening + 17 security + 14 mailer + 9 user-data + 7 dataset + 8 catalog-API) |
| `qa/browser_check.py` real-Chrome suite | ✅ **34/34 PASS** — the auth-gated world: logged-out deep links bounce to `/sign-in?next=…`, sign-up redirect, hard-reload session, 8 sampled command pages, docs-pending chip (thin shows / complete hides), Ctrl+K palette, sign-in honors `?next` and returns to the command page, logout + browser-back shows no command content, 404 void terminal, phone viewport — **and zero React update-depth console hits** |
| `qa/smoke_api.py` endpoint checklist | ✅ **19/19 PASS** — with a token the light index serves only `name/summary/tags/slug/category` and the detail endpoint serves the full doc; without one every dataset endpoint is a hard 401; the legacy full-doc list route `GET /commands` is gone (404) |
| `qa/sync_probe.py` sync-hardening suite | ✅ **15/15 PASS** — legacy guest-store migration (bookmarks + note land server-confirmed, key deleted), offline queue honesty ("Saved locally" never claims synced), auto-drain, account isolation, import validation |
| `qa/terminal_probe.py` terminal-hardening suite | ✅ **62/62 PASS** — all command families + flags, `man` over the authed light index via the manual-lookup provider, resource limits, prototype-chain negatives, semantic mission validation, 13/13 UI playthrough to "Mastered" |
| `qa/reset_probe.py` real-browser reset-security suite | ✅ **8/8 PASS** — byte-identical generic responses, token only in the dev mailbox (never in responses/DOM/filenames), full token→reset→login loop |
| Dataset sync FE ↔ BE | ✅ 132 = 132, 95 Linux + 37 CTF, 0 mismatches |
| Landing tools-band audit (`qa/grid_shots.py`) | ✅ border matrix 6/6 in dark+light × 360/768/1280, focus & hover probed |
| Not-found handling | ✅ every dynamic route |
| Git | ✅ clean tree; runtime artifacts & secrets ignored |

## 13. How to Run

```powershell
npm run dev:all        # Vite :5173 + Flask :5000 together (recommended)
npm run dev            # frontend only
npm run dev:backend    # Flask only
npm run build          # type-check + production build → dist/
npm run preview        # serve the production build
npm run lint           # oxlint
cd backend; .\venv\Scripts\pytest    # 117 backend tests
node backend/scripts/build_commands.mjs   # compile the per-slug files in backend/data/commands/ into aggregate + light index
python qa/dataset_audit.py                # docs-accuracy audit over all 132 entries
```

Full Windows-PowerShell walkthrough lives in `RUN.md`; the ongoing work log lives in `PROJECT_PROGRESS.md`.

## 14. Key Files Map

```
src/
├─ App.tsx                     routes + lazy loading + shell (streak, palette, shortcuts, ProtectedRoute)
├─ pages/ LearningPage · PracticeTerminalPage · FlashcardsPage · SpeedDrillPage
│         DashboardPage · CommandDetailPage · ToolsPages (compare/day/export) …
├─ components/ Header · Sidebar (counts from catalog lights) · Footer · CommandPalette
│              CommandBuilder · CodeBlock · Breadcrumbs · ThemeContext · IntroScene …
├─ lib/ streak.ts · syncState.ts (phases/queue + legacy guest migration) · terminal.ts (sandbox + missions + manual provider)
├─ context/ AuthContext.tsx (stable callbacks + sync chip) · CatalogContext.tsx (light index + per-slug docs, in-memory, cleared on logout)
├─ data/commandBuilders.ts     interactive builder specs (UI tool; command docs live behind the API)
├─ types.ts                     Command · CategoryInfo · CTFDomainInfo contracts
backend/
├─ app/ auth.py · commands.py (catalog/detail API) · user.py · security.py · sessions.py · persistence.py · models.py · mailer.py
├─ data/ commands/*.json        132 per-slug docs + commands-order/categories/domains manifests (source of truth);
│                               generated commands.json (aggregate) + commands-index.json (light) by the pipeline
├─ scripts/ build_commands.mjs  the dataset pipeline (per-slug JSON → aggregate + light index; fails on violations)
└─ tests/ test_auth.py · test_hardening.py · test_security.py · test_mailer.py
           test_user_data.py · test_dataset.py · test_catalog.py  (117 cases)
```
