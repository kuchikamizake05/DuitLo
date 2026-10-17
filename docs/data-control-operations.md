# Data and support requests

Implemented routes: `/privacy`, `/terms`, `/support` (public), `/data-controls` (authenticated). Privacy copy describes the configured Supabase, Qwen through OpenRouter, Groq, review workflow, and Xendit flows; it does not claim legal certification, a support email, or a response SLA.

## Deployment gate

Apply `202610160003_data_control_requests.sql` through the reviewed database release process before enabling the request UI. Run `supabase/tests/data-control-requests.sql` against a disposable database; its transaction rolls back fixture users and records. Do not run this test against production. The bootstrap manifest must include the migration and rollback test.

The migration enables owner-only SELECT RLS. Authenticated clients cannot INSERT, UPDATE, or DELETE rows directly. Submit/cancel functions bind identity to `auth.uid()`, enforce five new requests per rolling 24 hours, serialize requests by owner, preserve UUID retries with matching payloads, and allow one pending/processing account deletion. Only pending requests can be cancelled. Repeated cancellation is safe. A service-role operator can update processing outcomes; the key must never enter browser code.

## Operator queue

There is no automatic email, background operator, or automatic account deletion. A release operator must own this queue and establish an internal review cadence before public launch. Inspect it using a trusted database administration environment:

```sql
select id,user_id,kind,status,created_at
from public.data_control_requests
where status in ('pending','processing')
order by created_at;
```

Review the request details only when needed; avoid copying financial notes into logs or tickets. Transition a selected pending request atomically to processing, recording the operator action in your restricted operations log. Do not accept an account identifier supplied by an unauthenticated message as authority: the queued row's owner is the authenticated submitter. For high-risk changes, reverify control of the same authenticated account using the established identity-recovery process. Do not ask for a password or PIN.

```sql
update public.data_control_requests
set status='processing',updated_at=now()
where id=:'request_id' and status='pending'
returning id,user_id,kind;
```

If this returns no row, stop and inspect the current status; the owner may have cancelled. Processing requests are not client-cancellable. For support, export, or correction, perform only the scoped requested action. Deliver any export through an authenticated private channel; never attach it to a public ticket or unscoped storage URL.

## Account deletion checklist

1. Verify the queued `user_id` and request is still processing. Record the account's authoritative UUID, not an email match alone. Resolve ambiguous unacknowledged financial writes, outstanding billing questions, and requested export delivery before destructive work.
2. Inventory all owned database tables from the deployed schema and their foreign-key delete behavior. Include ledger/transfer/deposit history, accounts, budgets, goals, trading/investment records, profile/passkeys, billing/quota rows, and support requests. Confirm any retention obligations with the operator responsible for policy; this application does not invent a mandatory payment-record retention period.
3. Inventory Supabase Storage objects in receipt and profile-photo buckets under this exact owner's prefix. Remove them using the Storage administration API, paginating every result. Do not delete arbitrary matching filenames or another owner's prefix. Verify the object list is empty after deletion. Deleting `auth.users` alone does not reliably remove stored objects.
4. Use the tested owner deletion procedure or Supabase Auth administrative deletion only after storage cleanup and reviewed dependency behavior. Never run a generic SQL `delete from auth.users` without reviewing ledger triggers and foreign-key constraints. Do not adjust monetary history piecemeal while the account remains usable. Record any failure and resume the same operation rather than submitting a second delete request.
5. Verify the account can no longer authenticate, owned current database rows and objects are removed as intended, and no other account changed. Invalidate applicable sessions. Device-local storage on other devices cannot be remotely erased; the privacy page states this limit.
6. Because this request row cascades when its owner is deleted, capture a minimal restricted operator completion record before deleting the auth identity, then append outcome verification afterward. Store no receipt or transaction contents there. For requests whose owner remains, write a concise user-visible outcome and `resolved_at`; do not falsely mark a failed deletion completed.

```sql
update public.data_control_requests
set status='completed',outcome=:'safe_outcome',resolved_at=now(),updated_at=now()
where id=:'request_id' and status='processing';
```

Use `rejected` with a factual safe outcome when the requested action cannot be performed. Restored backups can reintroduce deleted records; maintain the restricted deletion log and reapply completed deletions after a restore before reopening access. Backup expiration and provider-side deletion require actual infrastructure/provider evidence; no guaranteed schedule is claimed here.

## Evidence still required before launch

- Disposable Postgres test pass and deployed migration/ACL verification.
- A named queue operator, restricted admin access, and an actual owner-scoped deletion rehearsal including storage pagination, trigger dependencies, and restore handling.
- Verified backup retention and provider-side data practices; update the public policy if operational facts change.
- Browser request submission, lost-response replay, status listing, cancellation, and access isolation checks.
