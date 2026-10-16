# Xendit billing deployment checklist

The implementation is a local foundation. Billing is **off by default**; it does not imply a live merchant account, approved channels, a published price or automatic renewal. No live invoice or charge was created during development.

## Product and configuration

Free: 3 active wallets, 3 budget categories per month, 1 active goal and 15 successful/reserved receipt scans per UTC calendar month. Pro: unlimited planning capacity, 150 scans per UTC calendar month and investment/trading writes. Expiry never deletes records and preserves reads and exports. Existing wallets/goals above the Free cap may be viewed, edited and archived; additional creation/reactivation is blocked until below the cap. Budget edits remain available; moving into another month counts toward that month's cap. Other transaction recording remains available.

Investment/trading accounts become read-only on expiry, including direct balance edits, retyping, transactions, transfers (including withdrawals), recurring rules, reconciliations, snapshots and linked goal deposits. Both the old and new account links are checked on edits, so unlinking a record cannot evade the restriction. Ordinary bank/e-wallet recording remains available. Stock/forex journals and stored trade reviews also require Pro for mutations. This is a journal feature restriction; FinTrack does not custody money or prevent withdrawals through the actual broker.

With `BILLING_ENABLED=false` (default), private beta behavior remains unrestricted. With billing enabled, both server environment and the database singleton must explicitly agree; uncertainty fails closed. Client-side plan labels cannot grant access.

Required server-only settings:

- `BILLING_ENABLED=true`
- `XENDIT_SECRET_KEY`: sandbox key first; never expose with a public prefix.
- `XENDIT_CALLBACK_TOKEN`: the dashboard webhook verification token, separate from the API key.
- `XENDIT_BUSINESS_ID`: the merchant business ID. Provider responses and callbacks must match it.
- `BILLING_PRO_PRICE_IDR`: approved positive integer IDR price. No price is inferred from the earlier pricing hypotheses.
- `BILLING_PRO_TERM_DAYS`: approved access term, integer 1–366 days. This is a single payment granting a fixed term, not a recurring subscription.
- `BILLING_APP_URL`: canonical HTTPS application origin for return URLs.
- `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`: server database connectivity. Never put the service role key in a public environment variable.

Deploy migration `202610160002_billing_entitlements.sql` with the reviewed bootstrap/migration procedure. Its singleton is created disabled. After sandbox validation, a privileged administrator explicitly enables `public.billing_settings`. Coordinate application and database rollout; never set one side to disabled to bypass a configuration error.

## Payment flow and trust boundaries

Authenticated checkout receives an operation UUID, not an amount, term, owner or external reference. It stores the approved price/term before any provider request. The external reference is derived from that durable operation. Repeated requests reuse the same checkout. An uncertain provider response stays pending and does not create a second invoice automatically; reconcile it through the merchant dashboard before retrying a new operation.

Pending sessions retain their original approved price and term. Before changing prices, reconcile or let existing sessions expire and explain any retained offer; the provider's payment page displays the amount actually due. Never overwrite an in-flight operation with a new amount.

Checkout uses the current Payment Sessions API: `POST /sessions` with `session_type=PAY`, `mode=PAYMENT_LINK`, `capture_method=AUTOMATIC` and payment-method saving disabled. No legacy invoice endpoint is called. Internal database names `invoice_id`, `invoice_url` and `billing_settle_invoice` refer to the Payment Session ID and hosted checkout URL.

The callback compares `x-callback-token` in constant time, validates the `payment_session.completed` event, merchant business ID, session type, country, currency, stored session ID, reference and expected amount, then fetches `GET /sessions/{id}` with the secret API key to confirm the same `COMPLETED` paid `PAY` session and its captured `payment_id`. Sessions do not expose the legacy invoice `paid_amount` field; the internal payment adapter normalizes the confirmed session amount for the common expected-payment check. SQL locks the owner and operation, checks the payment again and grants access once. Duplicated delivery cannot extend the term twice. Browser redirects are informational and cannot grant Pro.

Do not acknowledge an unbound or mismatched completed callback as fulfilled. Xendit retries failed delivery; dashboard replay/reconciliation handles failures outside that window. Completion and expiry events may arrive out of order. This implementation grants access only for a validated completed PAY session and never revokes an already fulfilled payment on a later expiry event.

## Usage accounting

The server reserves a receipt operation before calling the model. Postgres serializes reservations per owner and counts both in-flight reservations and successful scans. Duplicate operation IDs never trigger another provider call. Successful scans are settled; failed scans are refunded idempotently. A settled success cannot later be refunded by replay.

### Abandoned receipt reservation recovery

A crashed process can leave a reservation. There is deliberately no automatic age-based refund: a slow or fulfilled request must not receive a free second attempt. A trusted operator must first verify request/provider traces, confirm there was no successful result and no worker or request remains active, and record the incident/reference in the reason. Unknown outcome stays reserved pending investigation.

Review candidates with a privileged read of `billing_usage_operations` where `status='reserved'` and `created_at <= now()-interval '24 hours'`. Recover one verified operation using the service-role-only RPC `billing_reconcile_abandoned_usage(p_user_id,p_operation_id,p_verified_failure=true,p_reason)`. The reason must contain 20–1000 characters and should identify the support incident, request trace and verification evidence. No public API exposes this administrative operation.

The RPC locks the owner and operation, refuses recent or successful reservations, writes one immutable `billing_usage_reconciliations` record (reason, database actor and timestamp), then marks the operation refunded. Calling it again is a no-op. The original usage row is never deleted: reserving the same operation ID after recovery still returns `replayed=true,reserved=false`, so it cannot start another provider call. A user must start a new scan with a new operation ID. This recovery grants back only a demonstrably failed scan; it is not a generic quota reset.

Privacy deletion requests remain available on every plan. Fulfillment is a privileged, verified support workflow, not an ordinary investment-edit operation. Operators must use the reviewed deletion procedure and an atomic maintenance transaction, preserve the prior billing setting, and restore it before commit if a temporary transaction-local entitlement exemption is needed. Other database sessions must never observe billing disabled for that maintenance. Never require a user to purchase Pro to obtain deletion of their data.

## Sandbox acceptance before enabling checkout

1. Confirm the merchant account supports the current Payment Sessions API and intended IDR payment channels. This implementation uses a one-time PAY session, not the legacy invoice API or a recurring subscription. It omits optional customer details and disables saved payment methods; verify that account/channel policy accepts this minimal flow before enabling sales.
2. Configure the **Payment Session** webhook URL to `/api/billing/webhook` in the sandbox dashboard and use its verification token. Do not use the legacy Invoice callback setting. This setup is a separate, explicitly authorized third-party action.
3. Pay a sandbox session, verify one term grant, replay the callback and verify no second grant. Test incorrect token, merchant business ID, session ID, amount and currency; none may activate Pro. A forged completion must also fail authoritative session confirmation.
4. Interrupt checkout after provider creation and verify no duplicate session on retry. Reconcile pending operations against the merchant dashboard. Verify webhook-before-binding retry behavior and payment after application downtime. If an operation is unknown to the provider, verify it has no payable session before privileged expiry; never expire an ambiguous payable session merely to unblock checkout.
5. Verify 16th Free scan /151st Pro scan rejection with concurrent requests, failed scan refund, month rollover in UTC, expiry above planning caps, retained reads/exports, Pro-only journal writes and migration rollback/recovery on a disposable database.
6. Establish refunds/chargebacks and manual reconciliation runbooks, renewal disclosure, tax/receipt obligations, support contact and monitoring. Refunds/chargebacks are not automated by this one-time payment foundation. Do not launch sales until these operational decisions are approved. Completion grants are settled even if the database quota toggle was subsequently disabled: already accepted payments must be fulfilled; keep configured webhook credentials available while any session can still pay.

## Official references

Checked 16 October 2026:

- [Xendit handling webhooks](https://docs.xendit.co/docs/handling-webhooks): verification token, duplicate/out-of-order delivery and retries.
- [Invoice to Payment Session migration](https://docs.xendit.co/docs/migrate-to-payment-session): legacy invoice endpoint/fields and current Sessions replacement.
- [Create Payment Session](https://docs.xendit.co/apidocs/create-session): hosted session creation and redirect fields.
- [Payment Session webhook schema](https://docs.xendit.co/apidocs/webhook-notification-sent-defined-webhook-url-updates-payment-session): event, session ID, reference, amount, type and payment ID.
- [Get Payment Session](https://docs.xendit.co/apidocs/get-session): authoritative session confirmation.

No external merchant configuration or production database changes are part of this local implementation.
