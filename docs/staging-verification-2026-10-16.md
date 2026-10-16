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

## Xendit and Preview preparation

The staging secret key was confirmed to use a test-key prefix. A single PAY / PAYMENT_LINK sandbox session was created with the configured test price and then fetched by its returned ID. The reference, amount, currency IDR, country ID and sandbox checkout hostname matched. The session was ACTIVE; no payment was performed and no Pro entitlement was granted. Its business ID was saved into `STAGING_XENDIT_BUSINESS_ID` without displaying the secret key or verification token. The local ignored probe record retains the stable reference/session ID and prevents recreating an unresolved request.

Callback verification-token presence is confirmed, but authenticity and delivery are not yet verified. That requires a public staging webhook plus an actual Xendit test callback. The discovery probe is not an application checkout order and must not be used to grant Pro.

A production build using staging Supabase/Redis and billing disabled passed. The build was started temporarily on local port 3200: `/api/health?ready=1` returned HTTP 200 with database/limiter ready; `/privacy` returned 200. That process was stopped afterward. The local dev server and production deployment were unchanged.

### Prepared Preview rollout scope

- Vercel project: existing `fintrack`, team `kuchikamizakes-projects`.
- Git branch: `codex/production-hardening-2026-10-16`; production branch `main` is excluded.
- Push only reviewed commits; do not stage unrelated marketing assets or local environment files.
- Configure branch-scoped Preview variables from the matching `STAGING_*` credentials. Map staging Supabase, Redis and Xendit values to the application's standard variable names; never use production database credentials for this Preview.
- Begin with billing disabled, obtain the actual Preview URL, then use that origin for the sandbox return URLs and webhook configuration. Subsequent sandbox enablement applies only to staging, with server and database billing toggles kept consistent.
- Payment Session webhook path: `/api/billing/webhook`. Delivery and idempotent entitlement activation still require verification after deployment.
- User approved the branch push, isolated Preview configuration/deployment and sandbox webhook setup. Production deployments, live payment keys and production billing remain outside this rollout.

## Remaining release work

- Full managed database and object-storage backup/restore verification, including production backup protection.
- Monitoring and alert delivery verification; deployed HTTP readiness now passes as recorded below.
- Broader deployed UI coverage beyond the authenticated staging dashboard and Pro plan smoke checks.
- Refund/reconciliation operations and live pricing approval. Sandbox checkout, provider webhook delivery, entitlement activation and duplicate-callback handling passed as recorded below.
- Production migration reconciliation and separate release approval.

Production billing remains unchanged. Sandbox billing is enabled only on the hardening branch Preview and staging database.


## Deployed Preview and sandbox payment verification

User authorized publishing the hardening branch to Preview and adding its protected webhook URL to Xendit Test Mode. Branch-specific Preview variables use staging Supabase, Redis and Xendit credentials; production environment metadata fingerprints were unchanged. Billing is enabled in both this Preview and its staging database. External AI/review integrations are blank overrides on this branch to avoid inheriting production integrations.

Preview: https://fintrack-git-codex-production-ha-2bc4be-kuchikamizakes-projects.vercel.app

- Deployed HTTP readiness returned 200, with both required dependencies ready. Privacy, terms and support pages returned 200.
- Fifteen deployed checks passed: dummy staging authentication, billing availability, application-created sandbox checkout, stable checkout retry, rejected foreign origin/anonymous checkout/forged token, one persisted order, authoritative provider order matching, and rejection of an invented completed status without granting Pro.
- Xendit Test Mode Payment Session Completed and Expired webhook URLs were saved using the existing Vercel automation bypass token. The token and composed URL remain private in local configuration. No global deployment-protection settings were changed.
- Xendit's dashboard test fixtures reached the endpoint and returned 400 because their fixed merchant identity differs from this merchant. This rejection is expected; these fixtures do not represent valid application payments.
- Opened the application's sandbox checkout, selected QRIS and generated a test payment request. Used Xendit's documented test-only `POST /v3/payment_requests/{id}/simulate` with API version `2024-11-11`. No real funds were transferred.
- The actual provider session became COMPLETED and its automatic webhook changed the matching application order to paid. The authenticated status API reported the Pro plan.
- Replayed the completed callback: HTTP 200; the stored Pro expiry did not change. This confirms duplicate delivery does not grant a second term. The real browser plan page displayed FinTrack Pro and its expiry date. Reloading Xendit settings confirmed both webhook URLs remained saved.
- Browser smoke: real dummy-user sign-in succeeded and the dashboard displayed the expected fixture wallet balance Rp875,000, expense Rp25,000 and goal reserve Rp100,000.

The first database CI run exposed CRLF/LF-dependent manifest hashes. Canonical UTF-8/LF checksums fixed the issue without changing SQL semantics. All five local manifest regression checks and the subsequent PostgreSQL 17 database CI passed. The application CI on commit 6e75841 passed quality, security and both desktop/mobile E2E jobs; the rerun for checksum-only commit a0b389c is tracked separately.

Official simulation reference: https://docs.xendit.co/apidocs/simulate-payment-test-mode

Ignored local evidence contains the fixture operation/session IDs and redacted check results. Production remains on its prior deployment; nothing was merged into main.
