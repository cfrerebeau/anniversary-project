# Cagnotte: message history (guest-side) + admin list with CSV export

## Context

- Table `cagnotte_messages` has `guest_id uuid references guests(...)` (web/supabase/migrations/20260509000001_initial.sql:30) — but `submitCagnotteMessage` (web/app/actions/cagnotte-message.ts:33) **does not** set it. Today's rows are tied only by `display_name` + `ip_hash`, not by guest.
- The "your own submissions" pattern already exists for photos (web/app/photos/page.tsx:27-31), filtered by `guest_id`.
- Admin home (web/app/admin/page.tsx) has cards for guests/photos/quizz but only a one-line `N messages cagnotte` for messages — no detail page.
- Admin photo/quizz list pages (web/app/admin/photos/page.tsx, web/app/admin/quizz/page.tsx) give us a layout template to follow.
- `cagnotte_messages.amount_cents` is `int` nullable — the form only sends it when positive, so `NULL` is a meaningful "amount not given", not 0.

## Plan

### 1. Tie new messages to the logged-in guest

In `web/app/actions/cagnotte-message.ts`:
- Call `getCurrentGuest()` at the top (mirror `submitQuizz` — NOT `requireGuest`, which throws via `redirect()` and would short-circuit the `{ ok, error }` contract the client form expects).
- If no guest: `return { ok: false, error: 'Session expirée. Reviens via ton lien.' }` (same string as quizz).
- Insert `guest_id: guest.id` on the row. Keep `display_name` from the form (users sometimes change it).
- Rate limit bucket: switch from `cagnotte:${ipHash}` to `cagnotte:${guest.id}` now that the action is authenticated — IP hash stays in the row for forensics but bucket-by-guest is more meaningful.

The existing `MessageForm` already surfaces `res.error` (web/components/cagnotte/message-form.tsx:111), so the new error renders without UI changes.

No migration needed — column already exists, nullable. Old rows stay `NULL` and won't appear in any guest's "Tes mots" — acceptable for a one-off event with no real prior history.

### 2. Show the user their own messages on `/cagnotte`

In `web/app/cagnotte/page.tsx`:
- **Fold** the new fetch into the existing `Promise.all` (don't add a sequential await):
  ```ts
  const [total, { count }, { data: myMessages, error: myErr }] = await Promise.all([
    getCagnotteTotalCents(),
    service.from('cagnotte_messages').select('id', { count: 'exact', head: true }),
    service.from('cagnotte_messages')
      .select('id, display_name, amount_cents, message, created_at')
      .eq('guest_id', guest.id)
      .order('created_at', { ascending: false }),
  ])
  if (myErr) console.error('[cagnotte/page:my-messages]', myErr, { guestId: guest.id })
  ```
- **Render inline** (no new client component): below `<MessageForm />` in the right column, render a `<section>` only if `myMessages?.length > 0` — no empty card.
- Section structure (server-rendered):
  - `BAEyebrow` with "Tes mots"
  - Stacked `BACard`s, one per row, oldest-first or newest-first to match the admin pages (newest-first).
  - Each card: date (use `formatDateFR(new Date(row.created_at), { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })`), amount via `formatEUR(row.amount_cents)` **only if non-null** — if null, omit the amount line entirely (do NOT render `0 €`), and the message body.
- **No** client component, no `'use client'`. Keeps the access path server-only and avoids leaking guest_id ownership logic into the browser. If delete/edit gets added later, it should follow the photos API pattern: `getCurrentGuest()` in route handler, then scope every operation by both `id` AND `guest_id`.

### 3. Admin list page `/admin/messages`

New file `web/app/admin/messages/page.tsx`:
- `requireAdmin()` (page redirects are fine).
- Query (default Supabase select on `guests(...)` produces a LEFT join via the FK — legacy rows with `guest_id IS NULL` appear with `guests: null`):
  ```ts
  service.from('cagnotte_messages')
    .select('id, display_name, amount_cents, message, created_at, guests(email, full_name)')
    .order('created_at', { ascending: false })
  ```
  Log on error, render empty state on failure (don't crash the page).
- Render: stacked `BACard`s, same structure as `admin/quizz/page.tsx`. Reuse the same local `Intl.DateTimeFormat` constant as that page (it's not worth pulling to `lib/format.ts` for two callsites).
- Each card:
  - `display_name ?? '—'` (top)
  - Plain-text guest email and full name with fallback `'—'` for each (no mailto link, no guest-detail link — those don't exist)
  - Amount: `formatEUR(row.amount_cents)` if non-null, else "Montant non indiqué"
  - Message body (preserve newlines with `whitespace-pre-wrap`)
  - Date (right-aligned, font-mono, matches quizz page)
- Empty state: `Aucun message cagnotte pour l'instant.` (mirror admin/quizz wording).
- Top-right "Exporter CSV" button: a plain `<a href="/api/admin/messages/export.csv" download>` styled like `BAStamp`. Anchor + `download` attribute — no JS needed.

Update `web/app/admin/page.tsx`:
- Drop the one-line `{cagnotteMessagesCount.count} messages cagnotte` div.
- Promote to a fourth `NavCard` linking to `/admin/messages` (pick a `tagColor` distinct from olive/gold/stamp — e.g. add `bg-ink` or reuse `bg-olive` with `abbr="mots"`).
- Change the NavCard grid from `lg:grid-cols-3` to `lg:grid-cols-2` so four cards form a clean 2×2 on desktop. Mobile stays single-column.

### 4. CSV export route

New file `web/app/api/admin/messages/export.csv/route.ts`:

**Auth (route handlers should return status codes, not redirect HTML for a download link):**
```ts
const guest = await getCurrentGuest()
if (!guest) return new Response('Unauthorized', { status: 401 })
if (!guest.is_admin) return new Response('Forbidden', { status: 403 })
```
Do NOT call `requireAdmin()` here — its `redirect()` would send 307 HTML to a tool expecting CSV, and the admin page already guards the UI.

**Query + error handling:**
- Same join as the admin page, ordered by `created_at` desc.
- On query error: `console.error(...)` and `return new Response('Server error', { status: 500 })`. Do NOT emit a header-only CSV on failure — silent empty exports are worse than an HTTP error.

**CSV building — formula-injection-safe helper:**

Inline (or as a local helper in the route file — not a shared lib, this is the only caller):
```ts
const FORMULA_PREFIXES = /^[=+\-@\t\r]/
function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return ''
  const s = String(value)
  const safe = FORMULA_PREFIXES.test(s) ? `'${s}` : s  // prefix with apostrophe to neutralise
  return `"${safe.replace(/"/g, '""')}"`
}
```
Apply `csvCell` to **every text cell** — `display_name`, `guest_email`, `guest_full_name`, `message` — not just `message`. Numbers (amount_eur) don't need the formula prefix but still benefit from being quoted-or-empty.

**Columns (in order):** `created_at` (ISO), `display_name`, `guest_email`, `guest_full_name`, `amount_eur` (empty string if null, else `(amount_cents / 100).toFixed(2)`), `message`.

**Encoding:** Build with `\r\n` line terminators. Prefix the final string with UTF-8 BOM (`﻿`) so Excel opens accents correctly. Wrap in `new Response(...)` with:
- `Content-Type: text/csv; charset=utf-8`
- `Content-Disposition: attachment; filename="cagnotte-messages-${new Date().toISOString().slice(0, 10)}.csv"`

**Why server route, not client-side:** the export must cover the full dataset (not the rendered page), and it must enforce admin auth via the same Supabase service path as the rest of the admin area.

### 5. Tradeoffs explicitly accepted

- **No index on `(guest_id, created_at desc)`.** At ~50–200 guests with maybe a few messages each, the existing `idx_cagnotte_messages_created` plus a filtered scan is fine. If this ever moves to a recurring product, add `create index ... on cagnotte_messages(guest_id, created_at desc)`.
- **Legacy `guest_id IS NULL` rows stay invisible in guest history.** Acceptable since the only such rows are pre-feature noise.
- **No CSV helper extracted to `lib/csv.ts`.** Single caller; inlining is simpler than a premature shared util.
- **No edit/delete on user messages.** Read-only history. Trivially additive later via a route handler mirroring `/api/photos/delete`.

### 6. Tests

Vitest, narrow scope (this codebase has loose test coverage; don't over-invest):
- Unit test for the CSV `csvCell` helper covering: null, empty string, plain text, double-quotes, newlines, accented characters, and the four formula-injection prefixes (`=`, `+`, `-`, `@`).
- No tests on the route handler or page (consistent with the rest of the admin surface).

### 7. Verification (manual, including unhappy paths)

Guest side:
- Submit two messages as a guest → reload `/cagnotte` → both appear under "Tes mots", newest first.
- Submit a message with the amount field blank → row created with `amount_cents = NULL` → "Tes mots" omits the amount line (no "0 €").
- Log out, then call `submitCagnotteMessage` (e.g. via DevTools) → form shows `Session expirée. Reviens via ton lien.`
- Guest with zero messages: "Tes mots" section is absent (not an empty card).

Admin side:
- `/admin/messages` lists all rows; legacy `guest_id IS NULL` rows show `—` for guest email/full name but still show `display_name` and message body.
- Click "Exporter CSV" → file downloads; open in Excel/Numbers:
  - Accents render correctly (BOM working)
  - A message containing `=HYPERLINK("https://evil","click")` opens as literal text, not a hyperlink
  - A message containing `"` and `\n` is preserved on a single CSV row
  - `amount_eur` is empty for null-amount rows, not `0` or `0.00`
- Unauthenticated `GET /api/admin/messages/export.csv` → `401`.
- Authenticated non-admin guest → `403`.

### Files touched

- `web/app/actions/cagnotte-message.ts` — set `guest_id`, switch rate-limit bucket to guest, return session-expired error
- `web/app/cagnotte/page.tsx` — fold message fetch into `Promise.all`, render "Tes mots" inline server-side
- `web/app/admin/page.tsx` — drop the one-line count, add 4th NavCard, switch NavCard grid to `lg:grid-cols-2`
- `web/app/admin/messages/page.tsx` (new) — list + export button
- `web/app/api/admin/messages/export.csv/route.ts` (new) — CSV endpoint with explicit 401/403/500 and formula-injection-safe helper
- `web/tests/csv-cell.test.ts` (new) — unit tests for `csvCell` (or co-located if the codebase prefers)

No DB migration. No new dependencies. No new client component.
