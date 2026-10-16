# Database release and recovery

The historical Supabase migrations are **not replayable as a normal numbered history**. Seven files share version `20260714` and `20260714_add_account_equity_snapshots.sql` contains the literal `ga`. They remain unchanged because changing deployed history would conceal drift. Do not run `supabase db reset`, `db push`, or `migration repair` against production from this checkout.

## Reviewed fresh build

`supabase/bootstrap/manifest.json` records exact SHA-256 digests and dependency order for the existing schema and reviewed SQL. It explicitly excludes the malformed placeholder; the already-existing `20260820000000` repair creates the effective snapshot schema. This is a deterministic replay manifest, not an invented replacement for Supabase's deployed migration ledger. New migrations must be reviewed and added explicitly. A changed digest or unlisted migration fails closed.

Read-only checks, from repository root:

```sh
node --test scripts/database/preflight.test.mjs
node scripts/database/preflight.mjs
node scripts/database/preflight.mjs --history
```

The final command deliberately returns exit code 1 and lists the historical defects. Successful manifest verification does not mean historical migration versions became valid.

For an **empty disposable plain PostgreSQL database only**, set normal `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, and `PGDATABASE=fintrack_test` (or `fintrack_ci`). Set `FINTRACK_DISPOSABLE_DATABASE=YES`, then run:

```sh
node scripts/database/run-disposable.mjs
```

With an existing local PostgreSQL installation on Linux/WSL, `bash scripts/database/check-local-postgres.sh` creates its own temporary cluster, with TCP disabled and its own Unix socket, then stops it on exit. Set `FINTRACK_PG_BIN` to the installed PostgreSQL bin directory if different from `/usr/lib/postgresql/16/bin`. It leaves logs/data in the printed `/tmp/fintrack-pg-hardening.*` directory for review and does not modify an existing cluster. No downloads or package installation are performed.

The runner creates fixture roles and auth/storage objects, then runs manifest files and rollback SQL tests with `ON_ERROR_STOP`. Existing schemas/roles cause failure; it never resets or drops databases. The name/explicit flag is an accident-prevention guard, not proof the target is safe: the operator must verify host and database. Never use production credentials. Fixture grants mimic Supabase application roles, not all Supabase internals; these checks prove SQL, RLS and trigger behavior in Postgres but do not validate GoTrue, Storage HTTP APIs, PostgREST or production grants. CI runs this against PostgreSQL 17. The standalone journey SQL creates its own schemas/roles inside a rollback transaction and runs before bootstrap on the empty instance.

## Existing deployment gate

1. Export deployed schema, grants, policies, function owners and `supabase_migrations.schema_migrations`. Compare them against this manifest and the original migration files. Resolve every mismatch in a reviewed reconciliation document, with evidence of which changes are actually deployed. Never mark duplicate historical versions applied merely to silence tooling.
2. Confirm snapshots repair, goal-deposit migration and ledger-helper restrictions are already present. New migration `202610160001_financial_integrity.sql` depends on them. Apply new migrations in order only after staging restore verification: `202610160001_financial_integrity.sql`, `202610160002_billing_entitlements.sql`, then `202610160003_data_control_requests.sql`. Record migration checksum, timestamp and operator. These files do not fix or renumber the old migration ledger automatically.
3. Confirm `deposit_to_financial_goal` is owned by a trusted non-client role. New goals must start at zero; existing historical amounts are not rewritten. Direct authenticated amount changes are denied; the security-definer deposit RPC can mutate balances and acknowledge an already-committed request after its goal is archived. New deposits to archived goals remain denied. Name/target/date metadata edits remain allowed; currency changes are rejected after any saved amount or deposit history exists, including a goal later zeroed by an administrator. Nonzero wallets or wallets with references cannot be deleted, including when clients bypass UI; archive zero-balance historical wallets instead. Administrative deletion/export processes must handle retained financial references deliberately.
4. Verify direct client helper execution remains denied. Run rollback integrity and ledger-access tests on a **staging clone**, plus two real authenticated users through the actual API. Do not rely solely on fixture role tests.
5. The optional `supabase/manual/20260822_sensitive-account-delete-step-up.sql` remains outside bootstrap: it requires real Supabase MFA/AAL2 and an operator decision. Do not claim device-local passkeys provide server step-up evidence.

## Backup and restore drill

Before approval, record backup identifier/time, retention and access, RPO/RTO targets, schema/migration checksums, and storage object backup location. A database dump alone does not back up receipt/profile/report object contents or provider configuration. Keep dumps outside the repository in access-controlled encrypted storage; never commit user data or credentials.

1. Obtain the provider snapshot/PITR or a consistent `pg_dump --format=custom` backup using a read-only backup role with sufficient privileges. Record completion and checksum; use supported provider instructions for managed auth/storage roles.
2. Restore into a new isolated staging project/database, with provider keys, webhooks, cron jobs, Telegram, AI and payment outbound actions disabled. Use `pg_restore --exit-on-error --no-owner --no-acl` only if the staging roles/grants are intentionally reconstructed and reviewed; those flags alone do not reproduce production security. Restore storage object contents separately and test access.
3. Record elapsed restore time. Compare per-owner counts and financial totals, current balances, goal deposit totals, migration versions, RLS policies, function ownership/grants, receipt object checksums and ability to export. Run two-user access tests and the SQL suite, then manually verify transaction/transfer/deposit retry once through the API.
4. Apply the new migrations to that clone, repeat the checks, and record reviewer sign-off. Reject deployment if balances, access boundaries or history do not reconcile.
5. For rollback, stop writes and restore a validated snapshot/forward-fix under a reviewed incident plan; do not drop the integrity guards while writes are live. Restore may discard writes since backup: obtain the operator's recovery decision first.

## Evidence status

Verified on 2026-10-16:

| Check | Evidence |
| --- | --- |
| Node preflight/runner safety regressions | 5/5 passed |
| Fresh bootstrap | All 19 manifest SQL files applied successfully to PostgreSQL 16.15 |
| Real SQL regressions | `financial-journey.sql`, `ledger-helper-access.sql`, `financial-integrity.sql`, `billing-entitlements.sql`, `data-control-requests.sql`, `billing-investment-isolation.sql` passed with `ON_ERROR_STOP`; rollback fixtures |
| Go worker | `go test ./...` passed |
| Isolation | Latest run `/tmp/fintrack-pg-hardening.SHZvzj` cluster, local Unix socket, TCP disabled; server stopped cleanly after tests; existing main cluster untouched |

Windows has no installed `psql`/`postgres`; starting Docker Desktop was attempted, but its backend crashes while initializing the Inference manager socket. An existing PostgreSQL 16.15 installation was found in WSL Ubuntu, allowing the disposable local runner without a download. The machine's existing PostgreSQL cluster was not used. CI PostgreSQL 17 execution, actual Supabase role/grant comparison, migration reconciliation and the restore drill remain separate release gates. No production SQL, reset, repair or credential change was performed by this work.
