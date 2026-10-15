# React Doctor follow-up and transaction version checks

The source-only React Doctor 0.9.18 scan at revision a85aca2 reported 112 diagnostics: one error and 111 warnings. Its score API returned 49/100 (Critical) for those source diagnostics. Generated build output was excluded, so this is a source-only score rather than an unfiltered repository score. No source file contents or credentials were submitted; the score request contained diagnostic records with fileContext removed.

Largest groups: 32 complex React functions, 21 state-only-in-handler warnings, seven date/hydration warnings, six client redirects, six Suspense warnings, and six loading-flag warnings. The Supabase client-owned-field error remains a static heuristic; deployed RLS/helper permissions were separately inspected and tested. These counts are scanner findings rather than confirmed exploitable bugs.

Code inspection confirmed that online transaction edits and status changes lacked an updated_at precondition. An old open form could overwrite a newer version. Edits, delete, approval, and restore now require the authenticated owner, ID, and original updated_at to match atomically in the update query; zero returned rows produces an explicit conflict. Missing versions fail closed. Existing offline edits already use a version predicate.

Verification: 265 unit tests passed, typecheck and production build passed, and ten browser tests passed across mobile and desktop. Browser cases simulate another tab changing the record before edit/delete, verify the old version is sent, and assert the newer server amount/status remains unchanged. Retry/reload and offline replay regression tests also passed. The version helper has 100% line, statement, function, and branch coverage. Production dependency audit found no known vulnerabilities.

This is client-workflow concurrency protection, not a new database access policy. No production migration was needed. A new request after reload uses fresh server data; ambiguous failed edits currently report a conflict rather than automatically resolving their outcome.
