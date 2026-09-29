# Findings

11 bugs, most serious first. Each one has at least one automated test that
fails today because of it. Run all of them with `npm test`: the 15 failing
tests are exactly these bugs, and the other 66 pass.

| # | Bug | Severity | Type |
|---|---|---|---|
| 1 | Public search leaks the draft catalogue's products and prices | **Critical** | Security |
| 2 | Staff can publish a catalogue through the edit API | **High** | Security |
| 3 | Staff can create a catalogue that is published straight away | **High** | Security |
| 4 | Staff can delete a catalogue | **High** | Security |
| 5 | Public search still returns prices from an expired catalogue | Medium | Data exposure |
| 6 | Enquiries are accepted for draft and expired catalogues | Medium | Logic |
| 7 | Two enquiries can get the same reference, and the second is lost | Medium | Logic |
| 8 | Admin screens show live catalogues as "expired" and the reverse | Medium | Logic |
| 9 | A listing ID from catalogue B can be changed through catalogue A's URL | Medium | Access control |
| 10 | Import auto-mapping puts "List Price" into offer price and "Min Order Qty" into stock | Medium | Logic |
| 11 | Import silently drops prices written like `₹1,20,000 / piece` | Low | Logic (lower confidence) |

---

## 1. Public search leaks the draft catalogue's products and prices

**What happens**

The draft catalogue's page correctly returns 404 to the public. The search
endpoint behind that page never checks the catalogue's status, so anyone who
knows or guesses the slug gets every product name, SKU and offer price in the
draft, with no login.

**Steps to reproduce**

1. Do not sign in.
2. `curl "http://localhost:3001/api/catalogues/festive-overstock-2026/search?q=a"`
3. The response is `200` with all 4 products and their `offerPrice`, from the
   catalogue whose description reads *"Confidential. Holding pricing agreed with
   Northstar Retail pending sign-off. Do not share."*
4. For comparison, `http://localhost:3001/catalogue/festive-overstock-2026`
   returns `404`.

(`q` only has to match something. A single letter like `a` returns
nearly everything.)

**What should happen instead**

Treat the catalogue exactly as the page does: `404` unless it is published and
not expired.
`src/app/api/catalogues/[slug]/search/route.ts` should apply the same checks as
`getPublishedCatalogue()` in `src/lib/catalogue-queries.ts`.

**Impact**

Critical. This is the leak the README warns about: pricing negotiated for one
buyer (Northstar), not yet signed off, readable by anyone, including
Northstar's competitors. Slugs are human-readable names (`festive-overstock-2026`),
so they are easy to guess, and they get shared in chats and emails before a
catalogue is ready. No sign-in, no error, nothing in the logs.

**Failing test**

`tests/api/public-catalogue-search.test.ts` — `does not reveal anything from a draft catalogue`

---

## 2. Staff can publish a catalogue through the edit API

**What happens**

Only admin may publish. The publish button is hidden from staff, and the
`setCatalogueStatus` server action refuses them. But the catalogue edit API
(`PATCH /api/admin/catalogues/[id]`) accepts `"status": "published"` from any
signed-in user, including staff.

**Steps to reproduce**

1. Sign in as `staff@catalogue.test`.
2. `GET /api/admin/catalogues/<draft id>` to read the current details.
3. Send them back with `PATCH /api/admin/catalogues/<draft id>`, changing only
   `"status": "published"`.
4. The response is `200` and the catalogue is live.

I checked this against the running app with a real staff session, not
only with the mocked session in the test. Publishing the seeded Northstar draft
this way turned its public page from `404` into `200`. I set it back to draft
straight after.

**What should happen instead**

`403` for staff whenever the status would change to (or from) `published`.
Staff should still be able to edit a draft's name, description and so on
through this API. The fix must not block that, and there is a passing test
that guards it.

**Impact**

High. It breaks the one rule the README calls out: publishing "exposes pricing
to the public internet" and needs an admin. Hiding the button is not a control.
Anyone who opens browser dev tools, or any future UI that reuses the edit form,
gets around it.

**Failing test**

`tests/api/access-control.test.ts` — `staff cannot publish through the catalogue edit API either`

(The passing tests next to it show the rule is intended:
`staff are refused by the publish action the UI uses` and
`admin can publish a complete draft through the edit API`.)

---

## 3. Staff can create a catalogue that is published straight away

**What happens**

The "create catalogue" server action (`createCatalogueWithProducts`) takes
`publish: true` from any signed-in user. It never checks the role, so a
staff member can create a catalogue that is live the moment it is created.

**Steps to reproduce**

1. Sign in as staff.
2. Call `createCatalogueWithProducts({ ..., publish: true, productIds: [...] })`.
   The create dialog calls the same action.
3. Result: `{ ok: true, published: true }`. The catalogue is public.

**What should happen instead**

Refuse `publish: true` for staff with an error, or create the catalogue as a
draft.

**Impact**

High. It is a second way around the same rule as bug 2.

**Failing test**

`tests/api/access-control.test.ts` — `staff cannot create a catalogue that is published straight away`

---

## 4. Staff can delete a catalogue

**What happens**

`deleteCatalogue` in `src/app/admin/actions.ts` checks that someone is signed
in, but never calls `isAdmin()`. The function directly above it,
`setCatalogueStatus`, does. The delete button is hidden from staff, but the
server action runs for them.

**Steps to reproduce**

1. Sign in as staff.
2. Call the `deleteCatalogue(<id>)` server action. It is the same call the
   hidden button makes.
3. Result: `{ ok: true }` and the catalogue is gone.

**What should happen instead**

`{ error: "Only an admin can ..." }` and the catalogue remains.

**Impact**

High, with one limit worth stating. A catalogue that already has enquiries
cannot be deleted (the database foreign key refuses), so lead history itself is
safe. What staff *can* destroy is any catalogue with no leads yet: its product
selection, order, badges and banners, and its public link, which starts
returning 404 to buyers who were sent it. That work cannot be recovered.

**Failing test**

`tests/api/access-control.test.ts` — `staff cannot delete a catalogue`

---

## 5. Public search still returns prices from an expired catalogue

**What happens**

Same endpoint and same cause as bug 1. `monsoon-clearance-2026` expired on 15 Aug
2026, and its page correctly shows a "closed" screen. The search endpoint still
returns every product with its old offer price.

**Steps to reproduce**

1. Do not sign in.
2. `curl "http://localhost:3001/api/catalogues/monsoon-clearance-2026/search?q=a"`
3. The response contains 3 products with `offerPrice`.

**What should happen instead**

No products and no prices: the same result as the page.

**Impact**

Medium. The prices are stale, not secret. But a buyer who sees them can hold
the sales team to a price that is no longer on offer. The README is explicit
that stale pricing "must not be shown as if it were still on offer".

**Failing test**

`tests/api/public-catalogue-search.test.ts` — `does not return prices from a catalogue whose validity date has passed`

---

## 6. Enquiries are accepted for draft and expired catalogues

**What happens**

`POST /api/enquiries` checks that the products are listed and visible in the
catalogue. It never checks that the catalogue itself is published and still
valid. The lead is saved with today's price as its "price at enquiry".

**Steps to reproduce**

The realistic case: a buyer opens a live catalogue, leaves the tab open, and
submits after the validity date has passed.

1. Take a published catalogue whose `expires_at` is in the past (the test
   creates one).
2. `POST /api/enquiries` with that `catalogueId` and a valid product and quantity.
3. The response is `201` and a new lead shows the stale price.

The same happens for a draft catalogue.

**What should happen instead**

Refuse with a clear message (for example `410` "This catalogue has closed").
Save no lead.

**Impact**

Medium. The sales team gets leads quoting prices the company no longer honours,
and the buyer is told "Enquiry sent" as if the offer still stood.

**Failing tests**

`tests/api/enquiries.test.ts` — `refuses an enquiry against a draft catalogue`
`tests/api/enquiries.test.ts` — `refuses an enquiry against a catalogue whose validity date has passed`

---

## 7. Two enquiries can get the same reference, and the second is lost

**What happens**

The reference is `ENQ-` plus the last 7 digits of `Date.now()` (milliseconds).
References must be unique, so when two enquiries get the same number the second
one fails with a `500`. The buyer sees "Could not send your enquiry" and the
lead is gone.

**Steps to reproduce**

1. Send two valid enquiries in the same millisecond. The test pins `Date.now()`
   so this happens every run instead of by chance.
2. The first gets `201`. The second gets `500 "Could not save the enquiry."`

**What should happen instead**

Both are saved, with different references.

**Impact**

Medium, and it grows with time. It is not only same-millisecond requests: the
last 7 digits of a millisecond clock repeat every 10,000,000 ms, which is about
**2 hours 47 minutes**. So a new enquiry also collides with *any* earlier
enquiry that landed at the same point in an earlier cycle. With 10,000 stored
leads, roughly 1 in 1,000 new enquiries would fail. Each one is a buyer who
wanted to buy, and whom we lose silently.

**Failing test**

`tests/api/enquiries.test.ts` — `saves two enquiries sent in the same millisecond as two separate leads`

---

## 8. Admin screens show live catalogues as "expired" and the reverse

**What happens**

`effectiveStatus()` in `src/lib/catalogue-status.ts` has its date comparison the
wrong way round (`expiresAt > new Date()` should be `<`). A published catalogue
with a *future* validity date is labelled "expired", and one whose date has
*passed* is labelled "published".

**Steps to reproduce**

1. Sign in and open **Catalogues**.
2. `Monsoon clearance 2026` (expired 15 Aug 2026) shows as **published**.
3. Give any published catalogue a validity date in the future: it shows as
   **expired**.

**What should happen instead**

Future date means published. Past date means expired.

**Impact**

Medium. Buyers are not affected: the public page does its own, correct check.
But the sales team makes decisions from this label. They will keep sharing a
closed catalogue they think is live, or ignore a live one they think has closed.
The same label appears on the catalogue list, the catalogue page and the admin
search.

**Failing tests**

`tests/unit/catalogue-status.test.ts` — `keeps a published catalogue whose validity date is in the future as published`
`tests/unit/catalogue-status.test.ts` — `shows a published catalogue whose validity date has passed as expired`

---

## 9. A listing ID from catalogue B can be changed through catalogue A's URL

**What happens**

`PATCH` and `DELETE /api/admin/catalogues/[id]/listings/[listingId]` look the
listing up by `listingId` only. They ignore the catalogue `[id]` in the URL. A
request to catalogue A's URL with catalogue B's listing ID hides, re-badges or
removes the product from catalogue B.

**Steps to reproduce**

1. Sign in (staff is enough).
2. `PATCH /api/admin/catalogues/<A>/listings/<listing that belongs to B>` with
   `{ "isVisible": false }`.
3. The response is `200`, and the product disappears from B's public page.

**What should happen instead**

`404`: that listing is not in catalogue A. The reorder endpoint in the same
folder already does this check correctly, and there is a passing test showing it.

**Impact**

Medium. I want to be accurate about how serious this is. Any signed-in user can
already edit catalogue B through B's own URL, so this does **not** give anyone
new powers. The risk is changing the wrong live catalogue by accident: a stale
tab, a copied ID, or a UI bug. It also refreshes A's page cache instead of B's,
so B's public page can keep showing old data after the change. It is also the
exact pattern the brief asks about ("change an ID in a URL to one belonging to
a different catalogue").

**Failing tests**

`tests/api/access-control.test.ts` — `PATCH /catalogues/A/listings/<B's listing> does not touch catalogue B`
`tests/api/access-control.test.ts` — `DELETE /catalogues/A/listings/<B's listing> does not remove it from catalogue B`

---

## 10. Import auto-mapping puts "List Price" into offer price and "Min Order Qty" into stock

**What happens**

`autoMap()` in `src/lib/import-mapping.ts` guesses which spreadsheet column is
which by checking whether the header *contains* a keyword, trying fields in a
fixed order:

- **"List Price"** (a common name for MRP) contains "price", which is checked
  as an offer-price keyword before MRP's "listprice". So MRP values go into
  **offer price**. "Retail Price" does the same. The real "Selling Price" column
  then has nowhere to go and becomes a custom attribute.
- **"Min Order Qty"** contains "qty", a stock keyword. When it comes before the
  stock column, MOQ values go into **available quantity**, and the real stock
  column becomes a custom attribute.

**Steps to reproduce**

1. Import a CSV with headers `SKU, Product Name, List Price, Selling Price, Qty`.
2. In the mapping step, "List Price" is pre-selected as **Offer price**.

**What should happen instead**

Exact synonym matches should win over partial matches: "List Price" maps to
MRP, "Min Order Qty" to MOQ.

**Impact**

Medium. A person reviews the mapping before committing, which limits the
damage. But a pre-filled wrong guess on a 500-row sheet is easy to accept.
Accepting it writes MRP-level prices into offer price (the product looks like
0% off at full price) or MOQ numbers into stock (buyers are capped at a tiny
quantity), across every catalogue that lists those SKUs.

**Failing tests**

`tests/unit/import-mapping.test.ts` — `maps a 'List Price' column to MRP, not to offer price`
`tests/unit/import-mapping.test.ts` — `maps 'Min Order Qty' to MOQ even when it comes before the stock column`

---

## 11. Import silently drops prices written like `₹1,20,000 / piece` (lower confidence)

**What happens**

`parseNumber()` removes `₹`, commas and spaces, but not a unit suffix. So
`₹1,20,000 / piece` becomes `120000/piece`, which is not a number, and the
price is silently set to empty. The validation report then says the product
"doesn't have both prices yet", which is not true: the sheet had one.

**Steps to reproduce**

1. Import a row whose offer price cell is `₹1,20,000 / piece`.
2. The report counts it under "don't have both prices yet". No warning points
   at the row or the cell.

**What should happen instead**

Either read `120000`, or flag that exact row: "couldn't read the price
'₹1,20,000 / piece'".

**Impact**

Low. The product cannot be published without a price, so nothing wrong reaches
buyers. The cost is time: someone re-enters prices the seller already gave us.

**Why lower confidence:** it could be a deliberate choice to reject anything
that is not a plain number. I report it because the README uses this exact
format as its example of messy seller data, and silently dropping it is the one
outcome that doesn't help anyone. The test accepts either fix.

**Failing test**

`tests/unit/import-mapping.test.ts` — `does not silently drop a price written as '₹1,20,000 / piece'`

---

## Noticed, not reported as bugs

Things I saw but chose not to write tests for, and why:

- **MOQ larger than stock.** Nothing stops a product having MOQ 50 and stock 20.
  The buyer dialog then lets the buyer pick 50, and the server always refuses
  it. That product can never be enquired about. It is a data problem, so I
  would fix it with validation on save.
- **Offer price of 0.** A product with offer price `0` passes the publish check
  and shows as ₹0 on a live catalogue. That could be intended (free sample) or
  a typo. I would ask before calling it a bug.
- **Archived products can be added to a catalogue** through
  `POST /api/admin/catalogues/[id]/listings`. The product picker hides them,
  but the API does not refuse them.
- **The discount badge rounds up.** `Math.round` turns a 49.5% discount into
  "50% off". It is tiny, but it is a claim made to buyers. `Math.floor` is the
  safe choice.
- **README says 9 products; the seed creates 8.** Documentation only.
