# Supabase staging verification — 16 October 2026

Target: `fintrack-staging`, project ref `ksfokcliskiflaflyagf`, region `ap-southeast-2`, PostgreSQL 17.11. Production is a different project and was not modified.

## Bootstrap

Before writing, verified project identity, healthy status, zero public tables, zero Auth users, zero Storage buckets and an empty migration ledger. All five staging credential fields were present; anon and service-role keys authenticated successfully against the staging host. The initial token lacked migration-write permission; that attempt was rejected without creating schema. The replacement token successfully applied the reviewed schema.

Applied the 19 files in `supabase/bootstrap/manifest.json` in dependency order, excluding the malformed historical placeholder and excluding all disposable Auth/Storage fixture schemas. Standalone transaction wrappers were removed to produce one reviewed managed-staging baseline. Source file SHA-256 checks were validated before application.

- Baseline name: `staging_reviewed_manifest_93048eeb392a`
- Recorded migration version: `20261016083531`
- Combined SQL SHA-256: `93048eeb392afe56157b8a9b3ce6450431d9de337abe4433f4164a21b3a5ec3c`
- Result: **25 public tables, RLS enabled on all 25**.
- Existing Supabase Auth and Storage schemas were preserved.

This is an explicit baseline for a newly empty staging project. It does not renumber historical source files, repair production history, or mean each source file has a separate entry in staging's migration ledger.

## Managed PostgreSQL regression tests

All five suites passed through the staging Management API, with fixture writes rolled back:

- `ledger-helper-access.sql`
- `financial-integrity.sql`
- `billing-entitlements.sql`
- `data-control-requests.sql`
- `billing-investment-isolation.sql`

Verified zero Auth fixtures remained after those transactions and billing was disabled.

## Real Auth / PostgREST / Storage checks

Created two clearly named dummy Auth accounts using confirmed-email test fixtures, without sending email. Tested using their actual password-login access tokens, not forged JWT claims or mocked APIs.

**20 checks passed**, covering:

- Password authentication; owner wallet creation/read; other-user read and forged-owner insert denial.
- Expense debit against authoritative balances.
- Stable-ID transfer duplicate rejection with exactly one balance movement.
- Idempotent goal deposit, direct balance-overwrite denial, funded currency-change denial and historical wallet deletion denial.
- Denial of direct privileged ledger-helper execution.
- Idempotent support request, owner cancellation and denial of other-user visibility/cancellation.
- Private receipt upload, exact byte download by owner and denied download by the other user.

Dummy data remains for staging inspection: two wallets, one expense, one transfer, one goal/deposit, a cancelled support request and a tiny receipt fixture. Generated test passwords and detailed fixture records are stored only in ignored local audit files. No real customer records were copied.

## Application-data recovery rehearsal

Exported all 25 public staging tables, dummy Auth identity references, bucket configuration and object metadata to a local ignored snapshot. Restored them to a new isolated PostgreSQL 16 cluster with TCP disabled. Compared every public table row after type normalization: **all 25 matched**. The temporary cluster was stopped cleanly.

Snapshot SHA-256: `d0dad8118865e8ead37ca57e7b9444d70ac494cd473b7bef34d76dc502b13e5c`.

This is an **application-data restore rehearsal**, not a full managed-Supabase disaster-recovery test. It does not restore GoTrue credentials/provider configuration, complete Storage internals or object bytes, or verify Supabase PITR. PostgreSQL 17 dump/restore tooling and a managed-project recovery target are still needed for full-service verification; the available local client/server is PostgreSQL 16. Do not treat the snapshot as a production backup.

## Redis staging follow-up

Staging Redis REST credentials authenticated successfully: HTTP 200 and `PONG`. Four integration tests using the application limiter/readiness helpers against actual staging Redis and Supabase passed:

- Production-mode readiness with local fallback disabled reported both dependencies ready.
- Exactly two of six concurrent requests were admitted under a shared limit of two; four were denied with positive retry delays.
- Exhausted allowance admitted a new request after TTL expiration.
- Intentionally invalid probe credentials failed closed without local fallback; valid credentials recovered. Only the individual probe request used invalid credentials; the provider account and stored configuration were unchanged.

The live check found a readiness bug: anonymous access to Supabase OpenAPI discovery returned 401 while application table queries accepted the same key. Replaced discovery with a zero-row HEAD query on categories. The regression failed before the change, then all 12 targeted unit tests and all four live integration tests passed. This verifies the helpers with explicit staging environment mapping; it is not yet a deployed Preview HTTP readiness result.

Test Redis keys were random, short-lived verification counters. No database flush, provider configuration change, or production Redis use occurred. Staging credentials remain separate; Preview wiring must map them to the application's standard environment names.

## Remaining release work

- Full managed database and object-storage backup/restore verification, including production backup protection.
- Deployed HTTP readiness checks and monitoring/alert delivery; staging Redis helper checks above are complete.
- Preview environment wiring and deployed UI tests against staging.
- Xendit sandbox credentials, approved price/term and end-to-end payment testing.
- Production migration reconciliation and separate release approval.

Billing remains disabled. Production credentials, data and deployed application were unchanged.
