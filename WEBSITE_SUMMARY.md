# LinuxDocs — Website Summary

**LinuxDocs** is a professional, MDN-style reference and learning platform for **Linux commands and CTF security tools** — precise syntax, real flags, copy-ready examples — combined with a full interactive learning system: guided paths, quizzes, a sandboxed practice terminal, flashcards, a speed-drill arena, achievements, and streaks.

> Status: ✅ production build green · lint zero findings · **102 backend tests passing** · browser QA **22/22** · API smoke **14/14** · datasets fully synced · all progress committed to git (`9dc822d`).

---

## 1. Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19 + TypeScript (strict), Vite 8 (rolldown), Tailwind CSS 4 |
| Routing | React Router 7 (`BrowserRouter`) |
| Search | Fuse.js fuzzy search (Command Palette) |
| Icons / Motion | lucide-react · framer-motion · react-icons |
| Backend | Flask (Python) — auth, bookmarks, notes, history, SQLite persistence, security hardening + tests |
| Quality tools | `tsc -b` (build), `oxlint` (lint), link-check script, security test suite |
| Dev experience | `npm run dev:all` runs Vite (:5173) + Flask (:5000) together, with `/api` proxy and strict-port CSRF-safe setup |
| Deployment | `render.yaml` (Flask API on Render, gunicorn) + `vercel.json` (Vercel SPA with `/api` proxy rewrites) |

---

## 2. Content at a Glance

- **132 fully documented commands** — 95 Linux + 37 CTF tools (both entries carry: summary, syntax, options with descriptions, examples with output, use cases, related commands, tags, warnings). Frontend (`src/data/commands.ts`) and backend (`backend/data/commands.json`) are byte-level synced — verified 132 = 132, zero slug mismatches.
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
| `/sign-in` · `/sign-up` · `/password-reset` | Auth pages | Sign-up/sign-in drop you straight into the app (dashboard); `/password-reset` emails the account holder a **single-use link** and shows an identical neutral confirmation whether or not the address is registered |
| `/privacy` · `/terms` | LegalPage | Legal docs |
| `*` | NotFoundPage | `/dev/void` easter-egg terminal with one hidden flag 🏴 |

🔒 = requires sign-in (ProtectedRoute). Invalid categories/domains/commands all render proper "not found" states — no dead ends.

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
- Front: command name + tags · Back: summary, syntax, notable flags, example, warnings, docs link.
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
| bookmarks / notes / history | Synced to the account via the Flask API when signed in (plus guest mode) |

Mission IDs `m1`–`m13` are stable contracts — saved progress survives upgrades. Signed-in users also get server-side bookmarks/notes/history sync.

## 10. Backend & Security

- Flask + SQLite under `backend/` with session cookies, CSRF origin checks, hardened auth, and session management (token rotation on refresh, session-cap eviction, single-use reset tokens).
- **Offline-friendly data sync**: a dashboard chip shows the honest five-state truth ("All changes saved · Syncing… · Synced · Saved locally — syncs automatically · Sync failed"); "Synced" appears only after the server's 2xx. Changes made offline land in a persisted end-state op queue that retries with exponential backoff (online event, 30 s ticker, or chip click), guests can bookmark and build history on-device and the data merges deterministically into the account at sign-in (guest wins for touched records), and account switches never leak state (per-user queued ops + stale-response guards). Exports/imports carry a schema version with strict client+server validation.
- Modules: `auth.py` · `commands.py` · `user.py` · `models.py` · `security.py` · `sessions.py` · `persistence.py` (auto-backup of the DB on startup/manual/scheduled triggers + maintenance prune).
- **Password reset by email** (`/password-reset`): the request endpoint answers a byte-identical generic response for registered/unknown addresses (no user enumeration, timing equalized with a dummy bcrypt round) and emails a branded message with a **single-use, 30-minute link** built from the trusted `FRONTEND_ORIGIN`. Tokens are stored only as SHA-256 hashes, expire in 30 minutes, are consumed **atomically** (concurrent claims: exactly one wins), and a successful reset **revokes every session** on the account. Tokens never appear in API responses, logs, DOM, or referrer data. Providers: Resend API or any SMTP server via env vars; local development uses a safe **dev outbox backend** that writes `.eml` mailbox files and logs nothing. Both reset endpoints are rate-limited (5 requests + 10 token attempts per hour/IP).
- Five test suites — `test_auth.py` (32) + `test_hardening.py` (30) + `test_security.py` (17) + `test_mailer.py` (14) + `test_user_data.py` (9) — **102 pytest cases**.
- `.env.example` documents required secrets (`SECRET_KEY`, `JWT_SECRET_KEY`, `DATABASE_URL`, `FRONTEND_ORIGIN`); cookies/logs/instance DBs are git-ignored (never committed).

## 11. Performance & UX System

- **Route-level code splitting:** 21 lazy page chunks + lazy Command Palette (fuse.js loads on first Ctrl+K) + lazy intro. Entry chunk ≈ **544 kB min / 172 kB gzip** (down from 852 kB), largest page chunk ≈ 77 kB.
- **Command Palette** (Ctrl+K / Ctrl+⌘K): fuzzy search across all 132 commands → jump-to-page.
- **Shortcuts dialog** (`?`), theme toggle (dark/light, persisted), sidebar with "Study & Tools" group, skip-to-content link, ARIA labels, full mobile responsiveness, terminal-editorial design tokens.

## 12. Quality Gates (latest run)

| Check | Result |
|---|---|
| `npm run build` (tsc strict + vite) | ✅ passes, no warnings (entry ≈ 544 kB min / 172 kB gzip) |
| `npm run lint` (oxlint) | ✅ zero findings |
| Backend tests (`backend\venv\Scripts\pytest`) | ✅ **102 passed** (32 auth + 30 hardening + 17 security + 14 mailer + 9 user-data) |
| `qa/browser_check.py` real-Chrome suite | ✅ **22/22 PASS** — zero console errors, phone viewport included |
| `qa/smoke_api.py` endpoint checklist | ✅ **14/14 PASS** |
| `qa/sync_probe.py` sync-hardening suite | ✅ **14/14 PASS** — guest merge, offline queue, auto-drain, account isolation, import validation |
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
cd backend; .\venv\Scripts\pytest    # 102 backend tests
```

Full Windows-PowerShell walkthrough lives in `RUN.md`; the ongoing work log lives in `PROJECT_PROGRESS.md`.

## 14. Key Files Map

```
src/
├─ App.tsx                     routes + lazy loading + shell (streak, palette, shortcuts)
├─ pages/ LearningPage · PracticeTerminalPage · FlashcardsPage · SpeedDrillPage
│         DashboardPage · CommandDetailPage · ToolsPages (compare/day/export) …
├─ components/ Header · Sidebar · Footer · CommandPalette · ShortcutsDialog
│              CommandBuilder · CodeBlock · Breadcrumbs · ThemeContext · IntroScene …
├─ lib/ streak.ts              daily-streak record/read helpers
├─ context/ AuthContext.tsx · CatalogContext.tsx
├─ data/ commands.ts           132 commands + categories + domains (single source of truth)
backend/
├─ app/ auth.py · commands.py · security.py · sessions.py · persistence.py · user.py · models.py
├─ data/ commands.json         mirrored dataset for the API
└─ tests/ test_auth.py · test_hardening.py · test_security.py · test_mailer.py · test_user_data.py  (102 cases)
```
