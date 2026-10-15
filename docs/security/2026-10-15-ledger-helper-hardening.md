# Ledger helper access hardening

Applied to the linked FinTrack database on 15 October 2026 with user approval.

## Finding

`public.apply_account_delta(uuid,numeric)` was a security-definer function with EXECUTE available to anonymous and authenticated database roles. Its body updated a supplied account ID without checking the caller's ownership. The table's RLS policy did not protect this function's privileged update.

The internal `assert_account_owner(uuid,uuid)` helper also allowed direct execution. Catalog inspection confirmed both grants. An HTTP OpenAPI probe returned 401 for the configured local public key, so direct HTTP exploitation was not attempted or claimed.

## Change

Migration `202610150001_restrict_ledger_helpers.sql` revokes both helpers from PUBLIC, anon, and authenticated. The transaction and transfer ledger trigger functions now run as security definers with a fixed `public, pg_temp` search path, allowing their existing balance adjustments to continue. These trigger-returning functions cannot be called as ordinary RPC functions. Goal deposits already run as a security definer with authenticated ownership checks.

The migration and its exact version record were committed together in one database transaction. No other pending migration was applied.

## Verification

The regression script failed before the change because direct helper execution remained granted. A trial applied the migration and ran tests in a transaction ending in ROLLBACK. The same tests passed again after permanent deployment:

- Direct balance-helper calls denied to anon and authenticated.
- Transaction insert, amount update, and deletion adjust and restore balances.
- Transfer insert, amount update, and deletion adjust both balances.
- Goal deposit works, and retrying the same request does not debit twice.
- A different authenticated subject cannot read, update, or delete fixture accounts, spoof their owner, or deposit into their goal.
- Anonymous access cannot read the fixture account.

Every test uses newly generated fixture IDs and rolls back. All 19 public application tables still have RLS enabled. This is a focused regression test, not a full security audit of every table, function, or HTTP endpoint.
