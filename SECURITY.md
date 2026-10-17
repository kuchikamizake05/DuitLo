# Security policy

DuitLo processes personal financial data. Please do not disclose a suspected vulnerability in a public issue.

Use the repository's **Security** tab to submit a private vulnerability report. Include the affected route or component, reproduction steps, impact, and a minimal proof of concept. Do not include real credentials, access tokens, financial records, or other personal data.

Only the latest `main` branch is currently supported with security fixes.

## Dependency audit status (2026-10-08)

Production dependencies pass `npm audit --omit=dev` after updating Next.js to
16.3.8 and Sharp to 0.35.5. Vitest and its coverage provider use 4.1.11.

The full audit still reports five high-severity entries from one unpatched
development dependency: `braces`, via `micromatch`, `fast-glob`, and the Next.js
ESLint plugin/config. See [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm).
The published advisory has no patched version. This chain is used by lint tooling,
not production runtime dependencies. Keep lint configuration trusted; the current
configuration does not supply `settings.next.rootDir` glob patterns.

Do not apply the suggested forced downgrade to Next.js ESLint 14. Track an
upstream fix and rerun the full audit when updating the lint dependency chain.
