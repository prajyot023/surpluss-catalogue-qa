# Surpluss Catalogue — QA Automation Assessment

This is a trimmed copy of an internal Surpluss tool: a **product catalogue
builder**. Our sales team uses it to assemble catalogues of surplus inventory,
share them with buyers, and collect enquiries.

Everything here runs on your machine. It does not connect to any Surpluss
system, and the data is entirely made up.

Your brief is in **`ASSESSMENT.md`**. Read that first — this file only covers
getting the thing running.

---

## Setup

You need **Node 20+** and **Docker**.

```bash
cp .env.example .env
npm install
docker compose up -d          # Postgres on localhost:5544
npm run db:deploy             # apply migrations
npm run db:seed               # load sample data and sign-in accounts
npm run dev                   # http://localhost:3001
```

To wipe and start over at any point:

```bash
npm run db:reset
```

### Sign-in accounts

These are seeded local accounts. The passwords are in this file on purpose —
the database is disposable and never leaves your laptop.

| Email | Password | Role |
| --- | --- | --- |
| `admin@catalogue.test` | `Admin#2026` | admin |
| `staff@catalogue.test` | `Staff#2026` | staff |

**The two roles are not the same, and the difference matters.** `staff` is the
sales team: they build catalogues, manage products and work leads. `admin` can
additionally **publish** a catalogue and **delete** one — the two actions that
either expose pricing to the public internet or destroy lead history.

### If setup fails

Email us. Losing two hours to a Docker problem tells us nothing about you as a
tester, and we would rather unblock you than have you burn your time budget on
it.

---

## Running the tests

```bash
npm run test          # Vitest — unit, integration, API
npm run test:watch
npm run test:e2e      # Playwright — starts the dev server itself
npm run typecheck
npm run lint
```

Vitest picks up `*.test.ts` under `src/` and `tests/`. Playwright looks in
`e2e/`. Both are wired up and both currently find **nothing** — writing the
tests is the exercise, so an empty run passing is expected, not a broken setup.

`.env` is loaded for you in Vitest (see `vitest.setup.ts`), so tests that talk
to the database work without extra wiring.

For Playwright you will need the browser binaries once:

```bash
npx playwright install chromium
```

### Signing in from a test

Auth.js needs a CSRF token before it will accept a sign-in, which is fiddly the
first time. This is not the part we are assessing, so here it is:

```bash
# 1. token + cookie
curl -s -c jar.txt http://localhost:3001/api/auth/csrf

# 2. sign in (returns 302 and sets the session cookie)
curl -s -b jar.txt -c jar.txt -X POST   http://localhost:3001/api/auth/callback/credentials   -d "csrfToken=<token from step 1>"   -d "email=staff@catalogue.test"   -d "password=Staff%232026"

# 3. confirm who you are
curl -s -b jar.txt http://localhost:3001/api/auth/session
```

In Playwright, signing in through the login form once and reusing
`storageState` is usually simpler than the above.

Server actions (the functions in `src/app/admin/*/actions.ts`) are easiest to
test by importing them into Vitest and mocking `@/auth`.

---

## What the product does

**Products** live in one shared library, keyed by SKU — name, brand, category,
MRP, offer price, available quantity, MOQ, images.

A **catalogue** is a named, ordered selection of those products with a public
URL slug, for example `/catalogue/premium-corporate-essentials`. A catalogue is
either **draft** or **published**, and may carry a **validity date**.

- A **draft** catalogue is internal. Nobody outside the sales team should be
  able to reach it or its contents.
- A **published** catalogue is public — no login, anyone with the link.
- A published catalogue **past its validity date** is closed: the pricing in it
  is stale and must not be shown as if it were still on offer.

**Buyers** browse a published catalogue without signing in, add products to an
enquiry with quantities, and submit it with their contact details. Each item
must respect that product's MOQ and available quantity.

An **enquiry** lands in the admin **leads** inbox with a reference like
`ENQ-24071`. Enquiry items store a price snapshot, so lead history survives
later price edits.

Admins can also **bulk import** products from a spreadsheet: upload a CSV, map
its columns onto product fields, review the validation report, then commit.

### Two things about the real world this lives in

**Seller data is messy.** Inventory sheets arrive with inconsistent units,
duplicate rows, blank prices, and prices written as `₹1,20,000 / piece` rather
than a number.

**Leaks cost money.** A draft catalogue reaching the public, or one buyer seeing
another buyer's negotiated pricing, is a commercial problem — not a cosmetic
one.

---

## Seeded data

| Catalogue | Slug | State |
| --- | --- | --- |
| Premium corporate essentials | `premium-corporate-essentials` | published, no expiry |
| Festive overstock 2026 — Northstar pricing | `festive-overstock-2026` | **draft**, confidential |
| Monsoon clearance 2026 | `monsoon-clearance-2026` | published, **expired** |

Plus 9 products and 19 enquiries against the live catalogue.

---

## Notes on the environment

- **Image upload, email and WhatsApp are not configured**, on purpose. Those
  code paths talk to AWS, SES and WATI. With the environment variables blank the
  app degrades gracefully — uploads return `503`, notifications are skipped. You
  do not need to sign up for anything.
- The stack is Next.js (App Router) + TypeScript + Prisma + PostgreSQL, with
  Auth.js for sign-in. Business logic sits in `src/lib/`, HTTP handlers in
  `src/app/api/`, and server actions next to the pages that call them.
- `npm run db:studio` opens Prisma Studio if you want to poke at the data
  directly.
