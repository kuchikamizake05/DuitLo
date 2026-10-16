# Deployed readiness check — 16 October 2026

Decision: **hold release of the hardened build and paid Pro** until staging, migrations and provider configuration are verified. The currently deployed application responds, but it does not contain the local production-hardening work.

## Management API follow-up after read-only access was provided

Verified on 16 October 2026 using the supplied token, without displaying or persisting it outside the existing local environment file:

- Project `fintrack`: `ACTIVE_HEALTHY`, region `ap-south-1`.
- Backup listing returned HTTP 200, zero listed backups and `pitr_enabled=false`. This establishes no listed restore point was available to this check; it does not establish that an independent off-platform backup does not exist. No restore was attempted.
- Migration ledger returned five entries: `20260913000000` (financial journey), `20260914000000` (journey streak), `202610130001` (profile photos), `202610140001` (goal deposits), and `202610150001` (ledger helper restrictions). The three `20261016...` hardening migrations are not recorded. Earlier schema objects exist beyond this ledger; reconciliation remains necessary.
- Project branch listing returned an empty list. A separately created staging project outside this token's scope has not been established by this result.
- The dedicated read-only SQL endpoint returned catalog evidence: RLS enabled on all 19 public tables. This verifies the flags, not the correctness of every policy or real two-user isolation.
- `apply_account_delta` is security-definer, owned by `postgres`, with direct EXECUTE denied to both `anon` and `authenticated`.
- `deposit_to_financial_goal` is security-definer, owned by `postgres`, denied to `anon`, and executable by `authenticated`.
- New `guard_goal_ledger_amount` and `guard_wallet_deletion` functions were absent; `financial_goals` has only its timestamp trigger. The pre-existing `guard_financial_account_lifecycle` trigger is present on accounts and is distinct from the new guard.

These findings supersede the initial lack of management evidence below for migration ledger, backup listing, RLS flags, and the named function/trigger metadata. Backup schedule/retention, restore success, complete policy comparison, and isolated staging remain unverified. Next prerequisite is a separate staging project; production remains unchanged.

This check used authenticated read-only Vercel/GitHub metadata, public HTTP requests and bundle inspection, and read-only Supabase schema/storage metadata. No financial rows were read or modified. No deployment, migration, merchant setting, environment variable, backup, or remote Git ref was changed. Secret values were not printed or saved.

## Verified findings

| Area | Evidence | Result |
| --- | --- | --- |
| Active production | Vercel deployment Ready; GitHub deployment commit `e17c05118b3136607eb78ea79bf0a07a06787490`, deployed 15 October 2026; production branch `main` | Local hardening commits through `e4d3801` are not deployed |
| Public availability | `https://fintrack-olive-mu.vercel.app/` and `/login` return 200; login password form present | Basic public availability passed; no authenticated financial actions exercised |
| Response protection | HSTS and CSP present; landing/login responses use private/no-store cache controls | Basic response checks passed; not a complete CSP effectiveness audit |
| New public routes | `/privacy` returns 404; `/api/health?ready=1` returns 404 | New policy/readiness functionality absent on active production |
| Production database identity | Public login bundles reference the same Supabase project as the local linked FinTrack project | Database metadata below applies to the project's current public application |
| Database capabilities | OpenAPI exposes `deposit_to_financial_goal` and `financial_goal_deposits`; HEAD on goal-deposit relation returns 200 | Existing deposit capability present; function body, grants and new integrity trigger not verified by this API check |
| New database features | `billing_settings` and `data_control_requests` relations return 404; submit/cancel data-control RPCs absent from exposed schema | New billing/data-control migrations are not available through the deployed API |
| Vercel configuration | Project environment metadata contains Supabase URL/key and Gemini/Groq settings only | Redis URL/token, Xendit credentials/business ID, billing price/term/origin/enable flag, and server service-role key are absent from project environment configuration |
| Preview configuration | Supabase URL/key are configured for Production only; AI settings also exist for Preview | Preview cannot yet serve as a verified isolated end-to-end staging environment |
| Preview access | Existing preview redirects unauthenticated access to Vercel SSO; protection metadata confirms deployment protection | Preview functionality was not bypassed or tested as an authenticated application user |
| CI | Latest deployed commit's CI failed; monthly financial-report workflow succeeded | New local fixes have no remote CI result yet; old deployment is not backed by a green full CI run |
| Storage metadata | Receipts, financial reports, and profile photos are private buckets; profile-photo size cap is 1 MiB | Private-bucket flags verified; no receipt/report bucket-level size cap shown; app-side limits are separate |

Absence of an environment variable is based on Vercel project metadata as observed during this check. It does not imply any third-party account is absent or that credentials could not be configured elsewhere. No replacement credentials were invented.

## Not verified

- Supabase backup schedule, PITR availability, backup retention, migration ledger, trigger definitions, function owners/grants, and restore results. A management token/database connection was not available; the local service role supports API inspection but does not establish these properties.
- A separate Supabase staging project. GitHub records Production and Preview environments, but these labels do not establish a separate database or safe test data.
- Actual Xendit sandbox payment, callback delivery, refunds or reconciliation. Required Xendit configuration is missing from the deployment.
- Shared Redis reachability/outage behavior, production dependency monitoring, and alert delivery. Required Redis configuration is missing.
- Data-request queue staffing and a verified deletion/storage cleanup rehearsal.

## Concrete next work

1. Establish an isolated staging database and provide its deployment configuration. Do not point a preview at live user data merely to make it render.
2. Obtain read-only Supabase management/database evidence for the migration ledger, grants and backup configuration; run the documented restore drill into isolation.
3. Apply the three reviewed migrations to staging after reconciliation, then test real two-user authorization and retry behavior against PostgREST/Storage.
4. Configure staging Redis and check readiness, rate exhaustion, controlled dependency failure and recovery.
5. Configure Xendit sandbox and an approved price/term; complete payment-session acceptance tests while billing remains disabled in production.
6. Run remote CI for the reviewed commits, approve production migration/deployment separately, then verify the deployed commit and readiness endpoint.

Detailed procedures: `database-release.md`, `operations.md`, `billing-xendit.md`, and `data-control-operations.md`.
