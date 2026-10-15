# Navigation and receipt state audit

## Confirmed and fixed

- Telegram settings navigated to Insights instead of Telegram information. It now opens its own information dialog and accurately explains that connection settings are not available in the app.
- Google Drive backup displayed generic account synchronization information and a refresh action. It now explains that Drive backup is not available and offers navigation to CSV reports. Export copy only advertises the implemented CSV format.
- Switching shared receipt IDs preserved the previous merchant, note, amount, and parsing state. A receipt-specific keyed component now owns the form and abortable request lifecycle, resetting all draft state on a new ID.

Menu guide access, the Settings footer/install layout, the Home subtitle, and Sign out shadow adjustments from the preceding UI requests are retained in the same local change set.

## Evidence

Before the fixes, integration navigation and receipt draft-switching browser tests failed; goal create deep-link loading passed. After the fixes, 20 targeted browser tests passed on mobile and desktop, including a deliberately delayed old parse response, menu guide, and PWA installation. All 251 unit tests, typecheck, production build, and targeted ESLint checks passed. Dependency audit reported no known production vulnerabilities.

The first combined browser run also encountered request cancellation during test setup and one intermittent tutorial failure. Tests now wait for the initial page requests to settle before receipt navigation; the complete final run passed with two workers.

The goal timer cancellation concern was not reproduced in the tested create-link flow, so that code was not changed. Date-boundary behavior and session-expiry redirects were not exhaustively audited in this slice.

Latest source-only React Doctor scan: 112 diagnostics (1 error, 111 warnings). The remaining error is the client-owned Supabase-field heuristic; deployed ownership RLS and helper restrictions were separately tested in the ledger hardening audit. Scanner warnings are not equivalent to confirmed runtime bugs.
