# Transaction retry safety

Online create operations from QuickTransactionDialog and TransactionsPage previously let PostgreSQL generate a fresh ID for each attempt. If the insert committed but its response failed, retrying could create a second ledger entry.

Both forms now retain one client-generated transaction ID for the current draft and synchronously lock submission before awaiting authentication. A duplicate ID is acknowledged only after an owner-filtered read confirms all submitted fields match. A changed payload or invisible record produces a conflict rather than silently claiming success. The existing primary key prevents a second insert and corresponding balance trigger.

Offline create replay uses the same verification instead of acknowledging any existing matching ID. Its synchronization lock is acquired before the asynchronous authentication call to prevent concurrent replays within the component. Network failures leave operations queued; differing server data is marked for review. No database schema change is required.

Validation:

- 258 unit tests passed; the new transaction-write helper has 100% statements, lines, functions, and branch coverage.
- Four browser tests passed on mobile and desktop: duplicate submit events produce one request, then a simulated committed insert with a failed response is retried with the same ID and leaves one row, through both entry points.
- Four receipt scan browser tests passed in the preceding combined run.
- Typecheck, production build, targeted ESLint, and production dependency audit passed.
- Existing live ledger regression passed again inside a rolled-back transaction, covering insert/update/delete balance adjustments, transfer adjustments, goal deposit retries, and access denial.

Limits: the online draft ID is held in component memory, so closing/reloading the form starts a new draft. This change does not provide durable recovery of an ambiguous online save across browser restarts. Shared-receipt upload saving is a separate path and is not covered by this helper. Full IndexedDB replay through an actual interrupted network was not browser-tested in this slice; replay routing was reviewed and helper/unit scenarios were tested.

## Follow-up: durable recovery and shared receipts

The preceding limitations are addressed for same-browser retry recovery. Before sending an online create, the owner-scoped pending ID and payload are persisted to localStorage. Opening the form again restores an uncertain draft; differing data is blocked until the original attempt is resolved. A failed storage write stops the request before insertion. Successful acknowledgement clears the matching attempt. Shared receipts use separate per-share scopes, restore their pending form, and reuse a deterministic owner-scoped upload path with upsert rather than creating another storage object on retry.

The offline browser test also found a real rendering bug: projected queued creates lacked created_at, which ActivityView formats. Queued projections now carry their operation timestamps.

Final follow-up verification: 262 unit tests, typecheck, targeted lint, production build, and eight mobile/desktop browser cases passed. The recovery helper has 100% line/statement/function/branch coverage. Browser cases cover manual reload recovery through both entry points, shared receipt reload recovery with the same upload path, and offline reconnect after a committed response failure leaving one row and an empty queue. Dependency audit found no known production vulnerabilities.

Recovery is local to the current browser profile and account. Clearing browser storage removes pending recovery; atomic coordination of separate tabs or separate devices is not guaranteed. The existing server primary key remains the final guard for repeated attempts carrying the same ID. No new production database migration was applied in this follow-up.
