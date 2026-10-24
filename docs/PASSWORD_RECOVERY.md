# Password recovery: the knowledge quiz (no email)

Forgot-password is **no longer an email flow**. Nobody gets a link in any
inbox — instead the user proves ownership by answering **10 questions about
their own learning activity**. There is nothing to configure on any host:
the quiz is generated live from the account's stored progress, needs zero
external services, and works the same in every environment.

```
User clicks "Forgot password?" on the sign-in page
      │
      ▼  enters the account email
POST /api/auth/recovery/start
      │
      ├─ account has learning activity ──► 10 questions served in-page
      │                                          │ submit answers
      │                                          ▼
      │                              POST /api/auth/recovery/verify
      │                              8+/10 correct → grant verified
      │                                          │
      └─ brand-new / empty account ────► skip straight to the
                                                 new-password form
                                                 │
                                                 ▼
                                 POST /api/auth/recovery/complete
                                 password changed, every session killed
```

## The rules

| Rule | Value |
|---|---|
| Questions per round | 10 (four options each) |
| Pass mark | **8 of 10 correct** |
| Failed rounds | 3 maximum, then the grant is burned and the user starts over |
| Grant lifetime | 15 minutes, strictly single-use |
| Rate limits | 5 starts/hour/IP · 10 verify + 10 complete/hour/IP |
| Session impact | A successful reset signs the user out of every device |

## Where the questions come from

Each round is generated **from that account's own stored data** — the
server picks 10 facts it knows the legitimate owner can plausibly answer:

- lessons read per learning path, completed paths
- best quiz percentages per path
- current / best learning streak, freeze tokens
- speed-drill personal best, rounds played
- terminal missions solved
- flashcard decks finished, spaced-repetition queue size
- bookmark count + which commands are bookmarked
- personal notes written
- the most recently opened command

The correct choice is computed server-side and **never sent to the
browser** — the client only sees four options. Wrong and right accounts get
mode-based branching, and guessing everything blind wins with probability
≈ 0.4% per burned grant (starts are IP-capped).

## The empty-account shortcut (by design)

A brand-new account holds no learning data and cannot answer — so per the
product decision it skips the quiz entirely and goes straight to the
new-password form. Trade-off, documented and accepted: anyone who knows the
email of an *empty* account can reset its password. An account with even
sparse activity (fewer than 10 answerable facts, e.g. 1 bookmark) also
takes the direct path. To tighten this later, email confirmation can be
layered on without changing the endpoints (`/recovery/start` would only
branch to `direct` for signed-up-but-inactive users that also pass an
email proof).

> Note: `/recovery/start` answers `unavailable` for an unknown email but
> `direct` for an existing empty one — so it does signal whether an email
> is registered. Registration already reveals that publicly, so no new
> enumeration channel is opened.

## Deployment notes (the person who manages the backend)

- **New migration exists:** `004_recovery_challenges` (adds
  `password_recovery_challenges` + the same RLS lockdown used by every
  other table). Run `flask db upgrade` through the **session pooler** on
  Supabase after deploying this version, exactly like every previous
  migration.
- **No env vars to add.** If `RESEND_API_KEY`/`MAIL_FROM` were configured
  earlier for the old email flow, they are now unused and can stay or be
  removed — nothing sends mail anymore.
- Optional knobs (all have sane defaults, see `backend/.env.example`):
  `RECOVERY_START_RATE_LIMIT`, `RECOVERY_VERIFY_RATE_LIMIT`,
  `RECOVERY_COMPLETE_RATE_LIMIT`, `RECOVERY_TTL_MINUTES`.

## Testing

`backend/tests/test_recovery.py` covers the whole surface: empty-account
direct mode, unknown-email branch, full quiz round-trip (correct answers
found by reading the stored row), typo-not-burning-grant, three-wrong
bundles burning, malformed answer sets, stale/newer grant invalidation,
expiry, single-use completion, and old-password-dead/new-password-works.
