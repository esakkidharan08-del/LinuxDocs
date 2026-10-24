# Password-reset emails: making them really send

You are setting up **one thing**: the API needs permission to send email on
behalf of LinuxDocs, plus it needs to know *where* to point the links.
Everything else (tokens, expiry, single-use links, the pages) is already
built and tested — no code change needed, only dashboard settings.

```
User clicks "Forgot password?"
      │
      ▼
Vercel site ── /api rewrite ──► Render API
                                    │  creates a single-use token (30 min)
                                    │  sends email via: ✅ Resend (this guide)
                                    ▼
                             user's inbox → link like
       https://linuxdocs-frontend.vercel.app/password-reset?token=…
```

Time needed: **~10 minutes**. The API key is pasted into the Render
dashboard only — it never goes into the git repository, chat, or code.

---

## Part 1 — Create the Resend account + API key

1. Go to <https://resend.com> → **Get started / Sign up**. An Instagram-free
   email signup works; log in.
2. In the left sidebar pick **API Keys** → **Create API Key**.
   - Name: `linuxdocs-production`
   - Permission: **Full access** (needs it to send).
3. **Copy the key right away** — it starts with `re_` and is shown only
   once. Keep the tab open; you'll paste it in Part 2.

> **Why Resend?** Free tier (3 000 emails/month) is plenty for password
> resets, and it needs no SMTP ports, which are blocked on Render.

## Part 2 — One-time note about the free testing address

While `MAIL_FROM` is `onboarding@resend.dev`, Resend will **only deliver to
the inbox of the email you used to register the Resend account**. That is
perfect for the first verification test (Part 4) — you can send to
yourself immediately, zero extra setup.

To send to *any* user (friends' accounts, etc.) you finish **Part 5**
(domain verification) and swap `MAIL_FROM` to your own domain.

## Part 3 — Add the variables on Render

1. Go to <https://dashboard.render.com> → the LinuxDocs **API service**
   (the one that serves the `/api` requests).
2. Left sidebar → **Environment**.
3. Check these three vars — add or fix them so the values read:

   | Key | Value | Why |
   |---|---|---|
   | `RESEND_API_KEY` | the `re_…` key from Part 1 | lets the API send mail |
   | `MAIL_FROM` | `onboarding@resend.dev` | the From: address (Part 5 changes this) |
   | `FRONTEND_ORIGIN` | `https://linuxdocs-frontend.vercel.app` | the reset **link** must point at the site, not at the API |

   ⚠️ `FRONTEND_ORIGIN` must be present and correct **even if email worked**
   — every emailed link is built from it. If it already exists (it probably
   does, CORS needs it), just confirm it is the live Vercel URL, lowercase,
   no trailing slash.
4. Click **Save changes**. Render redeploys the service automatically
   (takes ~1–2 minutes — wait until the deploy shows *Live*).

## Part 4 — Verify it actually works (2 minutes)

1. Open the deployed site → **Sign in** → **Forgot password?**
2. Enter the email of **the account you used for Resend signup**.
3. The green message should now say *…Check your inbox (and spam folder)*.
   If it still says "No email provider is configured…" → Render did not
   pick up the variables (redeploy, re-check spelling of `RESEND_API_KEY`).
4. Check the inbox (and the spam folder) for
   **“Reset your LinuxDocs password”** with a green terminal-styled button.
5. Open the link, set a new password, then sign in with the new one.

**Extra checks that the feature is safe by design (no action needed):**

- The link works exactly once and expires after 30 minutes.
- Every previous login session is killed after a successful reset.
- Unknown emails get the exact same response — nobody can probe whether a
  given address is registered.
- Rate limit: max **5 requests per IP per hour** — seeing "Too many
  requests" after submitting many times in a row is normal.

## Part 5 — (Optional) send to everyone via a real domain

Only needed if the test user is not the Resend account owner:

1. Resend dashboard → **Domains** → **Add Domain** → enter a domain you own
   (e.g. something like `linuxdocs.example` — any domain you can change DNS
   for, bought on any registrar).
2. Resend shows a list of DNS records (mostly `TXT` + `CNAME`, plus `MX`
   for Stripe-billing accounts). Add them at your registrar → click
   **Verify**. Propagation can take minutes to a few hours.
3. Back on Render, change one variable:
   `MAIL_FROM=LinuxDocs <no-reply@yourdomain.com>`
4. Redeploy → re-test with a colleague's email address.

## Troubleshooting

| Symptom | Fix |
|---|---|
| Message on the site still says “No email provider is configured” | `RESEND_API_KEY` missing/misspelled on Render, or deploy not finished re-running. |
| Message says “Check your inbox” but the mail never arrives | Look in **spam**. If absent: your Resend account email and the submitted address must match while using the free `onboarding@resend.dev` sender (see Part 2). |
| Reset link 404s when clicked | `FRONTEND_ORIGIN` on Render is wrong — it must be the **Vercel** URL, not `http://localhost:5173`. |
| “Reset link is invalid or expired” | The link was already used, or older than 30 min → start over from “Forgot password?”. |
| “Too many requests” | 5/hour/IP limit — wait an hour or ask the API owner to raise `RESET_REQUEST_RATE_LIMIT`. |
| Colleague never receives the mail while you do | You're still on the free testing sender — do Part 5. |

## For local development (no email account needed)

When you run the API locally with no mail variables, it uses the **dev
mailbox**: each request writes a real `.eml` file to

```
backend/instance/dev_outbox/reset-<timestamp>.eml
```

Open it in any mail client (or drag it into Outlook/Gmail webmail), copy
the link, continue. Secrets/tokens never appear anywhere else — not in the
dev console, never in the HTTP response.
