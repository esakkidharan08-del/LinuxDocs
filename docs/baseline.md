# QA Baseline — improvement plan, Part 0

**Date:** 2026-10-22 · **Commit:** `ab1d02c` · **Branch:** `improve/main-plan`
**Environment:** Windows 11 / PowerShell · Python 3.11 · Node 26 · Chrome (headless, CDP)
**Runner:** `npm run qa` → `python qa/run_all.py` (added in Part 0; runs every gate in order, keeps per-suite logs in `qa/last-qarun/`)

## Verified baseline (final run, 09:03, exit 0)

| # | Suite | Key | Result | Detail |
|---|---|---|---|---|
| 1 | `npm run build` | build | ✅ PASS | `tsc -b` clean · entry **419.60 kB / 135.35 kB gzip** · built in 0.9 s |
| 2 | `npm run lint` | lint | ✅ PASS | oxlint clean |
| 3 | backend pytest | pytest | ✅ PASS | **109 passed** in 71 s (incl. `test_dataset.py` 7 cases) |
| 4 | dataset docs-accuracy audit | audit | ✅ PASS | **132 entries** · 19 documented warnings · 82 pending-review · `AUDIT PASSED` |
| 5 | `qa/browser_check.py` | browser | ✅ PASS | **24/24** real-Chrome checks · zero console errors |
| 6 | `qa/smoke_api.py` | smoke | ✅ PASS | **14/14** API checks |
| 7 | `qa/sync_probe.py` | sync | ✅ PASS | **14** hardening checks (guest merge, offline queue, isolation, import) |
| 8 | `qa/terminal_probe.py` | terminal | ✅ PASS | **61** checks incl. semantic 13/13 mission playthrough |
| 9 | `qa/reset_probe.py` | reset | ✅ PASS | **8** checks incl. mailbox + neutral-UI + real token loop |

## First full-gate attempt (08:40): 2 failures, both root-caused as tooling

The very first `npm run qa` run of the new runner failed 2 of 9 suites. Both were
diagnosed before any change; neither was an app regression.

### 1. Reset probe: "UI not neutral" → sliding-window rate limit, by design

- **What failed:** `FAIL UI not neutral: submitted=submitted ui={"neutral":false,"leaked":0,"anyToken":false}` — 7/8 checks.
- **Evidence:** `backend/instance/dev_outbox/` timestamps — the Task-6 gate round (~07:58–07:59) had placed 3 delivered reset requests on the *same* still-running dev Flask; the 08:40 round added the registered request (eml 08:44:12 = count 5) and the ghost (allowed 202). The probe's UI submit was **hit #6**; `backend/app/auth.py:160` caps `reset-request:ip:{ip}` at `RESET_REQUEST_RATE_LIMIT` (default **5/hour**, sliding window). The UI request was rejected 429 → error box → `neutral:false` — while `leaked:0` / `anyToken:false` and all mail-loop checks stayed correct. No `eml` was written after 08:44:12, exactly matching a rejected request. (pytest's own reset tests write to the same outbox dir but run in a separate process, so they never touched the dev server's in-memory budget — consistent with the ghost 202 passing.)
- **Classification:** tooling, not product. The documented QA relief (`RESET_REQUEST_RATE_LIMIT`) simply was not set on the long-lived external dev server.
- **Fixes shipped in Part 0:**
  - `qa/run_all.py` now starts its *own* Flask with `RESET_REQUEST_RATE_LIMIT=50` and, when servers are external, warns that a full gate spends ~3 of the 5/hour budget (restart the QA server with the relief between hour-gated reruns).
  - The external QA Flask was restarted with `RESET_REQUEST_RATE_LIMIT=50`.
- **Verified by:** full-gate rerun at 09:03 → reset probe **8/8 PASS**.

### 2. Browser probe: sign out / protected-route → transient timing flake

- **What failed:** `FAIL sign out` + `FAIL protected route -> /sign-in` (22/24).
- **Diagnosis:** the step clicked the user menu then slept a fixed 0.6 s before clicking `Sign Out`; immediately after the 77 s pytest churn the host was busy, so the dropdown had not mounted yet. Both steps failing together matches "logout never happened" (user stays signed in → `/dashboard` no longer redirects). A standalone reproduction (`DOM telemetry dump at each step`) passed on the same build — menu opens, `Sign Out` navigates to `/sign-in`, session revoked — so the code path is correct; the probe's fixed sleep was flaky.
- **Fix shipped (assertion unchanged):** the sign-out step now *polls* for `aria-expanded="true"` before clicking, retries the sequence once on a first-attempt miss (a real failure fails the retry too), and prints telemetry on the retry path; the failed-`record` line now carries a detail (e.g. `state=…`).
- **Verified by:** full-gate rerun at 09:03 → browser probe **24/24 PASS**, zero console errors.

## Runner contract (`qa/run_all.py`)

- Runs the 9 suites in the order above; saves each suite's full output to `qa/last-qarun/<key>.log` and prints a bounded tail + a final `[PASS]/[FAIL]` table with timings; exit code 0 only when every suite passed.
- Server handling: if Flask :5000 / Vite :5173 respond, they are left untouched (and the reset-budget note is printed); otherwise the runner starts them, waits up to 60 s for health, and terminates only what it spawned.
- Parsing is done against real marker lines (`109 passed`, `AUDIT PASSED`, `BROWSER RESULT: x/y PASS`, `ALL … CHECKS PASSED`, entry-chunk kB) — no pass/fail is invented from successful exit codes alone.
- Tracked in git (`!qa/run_all.py` exception in `.gitignore`); probe scripts/logs/screenshots remain untracked.

## Not verified here / known limitations

- No production deployment was exercised live (Render/Vercel remains code-verified only, per round 6).
- `npm run qa` was exercised on this Windows/PowerShell environment only.
- The 08:40 first-attempt failures are documented from log evidence + outbox timestamps + a standalone reproduction; Flask's request log from that window was lost when its host shell was reaped mid-diagnosis, so the exact 429 response line is inferred from the rate-limit arithmetic + outbox gap, not read from a stored log line.
