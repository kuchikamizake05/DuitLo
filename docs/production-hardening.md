# Production hardening: 16 October 2026

This records local changes and their verification, separately from deployment approval. Billing stays disabled by default. No production database, merchant configuration, credentials, deployment, or remote branch was changed.

## Audit findings addressed

| Finding | Local change |
| --- | --- |
| Transfer and goal retry duplication | Owner-scoped durable operation IDs, matching-payload recovery, authoritative balance refresh, and replay regressions |
| Goal balance overwritten by metadata | Metadata excludes saved amounts; database rejects direct balance edits and funded currency changes |
| Invisible reserved savings | Separate wallet funds, goal funds, and tracked assets; archived savings retained; incomplete FX totals withheld |
| Unfunded goal creation | New goals start at zero; funding uses the source-account deposit RPC; historical balances preserved |
| Shared-device receipt exposure | Owner-bound metadata and transient drafts, cross-tab claim locking, expiry, legacy cache cleanup, and owner-specific recovery |
| Truncated financial aggregates | Stable paginated reads with explicit count, repeat detection, and failure on inconsistent results |
| Wallet deletion bypass | Database rejects nonzero balances and historical financial references |
| Redis silently unavailable | Production provider routes reject requests when shared limiting cannot be verified; bounded timeouts and readiness probes |
| Missing operational diagnostics | Correlation IDs, redacted structured failures, dependency readiness, and recovery runbooks |
| Missing monetization enforcement | Xendit Payment Sessions foundation, provider-confirmed settlement, atomic quotas, planning caps, and Pro investment write enforcement |
| Missing privacy/support controls | Public policies and authenticated owner-bound support/export/correction/deletion requests with status and cancellation |
| Inert integration promises | Unavailable reminders disabled; Drive and Telegram state explained; usable CSV export retained |
| Broken fresh SQL setup | Reviewed checksum manifest, isolated bootstrap runner, actual PostgreSQL regression suites, and database/worker CI |
| Stale browser checks and generated lint noise | Pagination-aware mocks, current selectors, retained financial assertions, and generated-artifact exclusions |

## Verification

- TypeScript passed.
- 357 unit tests passed; instrumented-code coverage: 88.27% statements, 85.23% branches, 91.28% lines. This is not a claim that every component is instrumented.
- Production dependency audit found no known vulnerabilities. A separate development-only `braces` advisory remains in the existing lint dependency chain without a safe available patch; no dependency downgrade was forced.
- Fresh PostgreSQL 16.15: 19 manifest SQL files and six SQL suites passed in an isolated local cluster, stopped afterward. Five Node database-runner safety tests and Go worker tests passed.
- Production build passed as part of the coordinated desktop/mobile browser run. Full run: 345 passed, four failed, three intentionally skipped (device-specific hover/overflow checks). The four failures were stale test setup: two tutorial overlays and two batch-payload expectations. After correction, all four passed in a targeted desktop/mobile rerun against the same production build. Combined case coverage: 349 passed and three skipped; a second full suite was not run after these test-only corrections.
- Source lint: zero errors, 75 existing warnings. Rules remain active for application source; generated promotional assets and separate Node test-runner files are excluded only from inappropriate runners.

## Release gates requiring the deployment operator

1. Reconcile the deployed Supabase migration history and role/grant differences against a restored staging clone. The fresh manifest is not an automatic repair of an existing migration history. Verify the new migrations there, then approve production application.
2. Complete and record a database plus object-storage restore drill, RPO/RTO, recovery access, and financial reconciliation. Follow `database-release.md`.
3. Configure production Redis, dependency alerts and safe log retention. Exercise limiter failure/recovery against staging. Follow `operations.md`.
4. Select and approve the price/term, configure Xendit sandbox credentials and Payment Session callbacks, and complete the acceptance cases in `billing-xendit.md`. Establish support, refund/chargeback and reconciliation procedures before accepting money. Keep billing disabled until these pass.
5. Assign the data-request queue operator and rehearse verified storage/account deletion plus backup handling. A submitted request is not an automatic deletion. Follow `data-control-operations.md`.
6. Drive backup, Telegram automation and scheduled daily reminders remain unavailable integrations. Enable their UI only after their services and delivery have been implemented and verified.

Wallet AAL2 enforcement remains an explicit operator policy rollout after compatible MFA enrollment and recovery are verified; the new financial deletion guards do not claim to provide MFA.
