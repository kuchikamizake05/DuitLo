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
