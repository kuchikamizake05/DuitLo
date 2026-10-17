# Development guide

[Back to FinTrack](../README.md) · [Database releases](database-release.md) · [Operations](operations.md)

This guide covers local setup and optional integrations. Use `.env.example` as the configuration source of truth; older optional workflows may require separate setup.

## Getting started

### Prerequisites

- Node.js **20.9.0 or newer**
- pnpm **10.30.3** (pinned in `package.json`)
- A Supabase project
- Git

Optional integrations require an n8n instance, Telegram bot, Gemini API key, and/or Groq API key.

### 1. Clone and install

```bash
git clone https://github.com/kuchikamizake05/FinTrack.git
cd FinTrack
corepack enable
pnpm install --frozen-lockfile
```

If migrating an existing npm checkout, remove the old `node_modules` directory before installing with pnpm so leftover npm binaries cannot shadow the new dependencies. If Corepack is unavailable, install the pinned pnpm version using the [official installation guide](https://pnpm.io/installation).

### 2. Create the local environment file

macOS or Linux:

```bash
cp .env.example .env.local
```

Windows PowerShell:

```powershell
Copy-Item .env.example .env.local
```

Replace every placeholder required by the integrations you plan to use. Never commit `.env.local`.

### 3. Prepare Supabase

Follow the [reviewed database setup and release guide](../docs/database-release.md). Use the reviewed bootstrap manifest for fresh databases and reconcile existing migration history before applying changes. Do not replay the historical migration directory blindly.

### 4. Start development

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Supabase setup

FinTrack uses Supabase for both identity and data ownership. A configured Supabase project is required for the authenticated application.

1. Create a new Supabase project.
2. Validate the [reviewed manifest](../supabase/bootstrap/manifest.json) with `node scripts/database/preflight.mjs`.
3. For a new, empty managed Supabase project, apply the reviewed SQL in manifest dependency order using its existing Auth and Storage schemas. Never run `postgres-fixtures.sql` against managed Supabase; it is only for disposable plain PostgreSQL tests.
4. For an existing project, reconcile its deployed schema and migration history first. Follow [database release and recovery](../docs/database-release.md); do not reset or repair production history automatically.
5. Confirm RLS and real two-user API isolation, then test backup recovery.
6. Copy the project URL and anon key into the appropriate environment configuration. Keep staging credentials separate from production; see `.env.example`.

The schema and migrations create the financial ledger, account transfers, goals, investment executions, forex journal, equity snapshots, AI trade review storage, and opt-in monthly report archives. Ownership policies are based on the authenticated user's `auth.uid()`.

> [!IMPORTANT]
> Do not edit a migration after it has been applied. Add a new dated migration for subsequent database changes.

### Storage for receipt automation

If the Telegram receipt workflow is enabled, create a private Supabase Storage bucket named `receipts-temp`. Apply a narrow policy appropriate for the n8n service role and your retention requirements. Receipt images and temporary OCR data must not be public by default.

### Monthly report automation

Migration `20260904000000_add_monthly_financial_reports.sql` creates opt-in schedules, immutable report metadata, and private `financial-reports` Storage policies. Users manage schedules and download only their own archives at `/reports`; the CSV is the sole transaction-level snapshot.

[`monthly-reports.yml`](../.github/workflows/monthly-reports.yml) runs daily at 01:17 UTC and processes the latest completed UTC month. Its schedule lookup also keeps the Supabase database active without a separate keepalive job. GitHub can disable scheduled workflows after roughly 60 days of public-repository inactivity; a commit, push, or manual `workflow_dispatch` restores the schedule. Add `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` as GitHub Actions repository secrets, then use `workflow_dispatch` for an initial or recovery run. Never expose the service-role key to browser code or logs.

The Go worker lives in [`worker/`](../worker/) and uses only the standard library. Each user-period is idempotent; retries do not replace an existing CSV or report row. Frankfurter FX lookup failure leaves original-currency totals intact and records missing conversion metadata.

## Authentication setup

### Email and password

1. Open **Authentication > Providers > Email** in Supabase.
2. Enable email/password authentication.
3. Decide whether new accounts must confirm their email address.
4. If email templates are customized, preserve `{{ .RedirectTo }}` in confirmation and recovery links.

### Google OAuth

1. Create a **Web application** OAuth client in Google Auth Platform.
2. In Supabase, open the Google provider and copy its callback URL.
3. Add that callback URL as an authorized redirect URI in Google.
4. Store the Google Client ID and Client Secret in Supabase—not in this repository or the Next.js environment.
5. Enable the Google provider in Supabase.

### Redirect URLs

In **Authentication > URL Configuration**, add the URLs used by your environments, for example:

```text
http://localhost:3000/**
https://your-preview-domain.example/**
https://your-production-domain.example/**
```

Use the stable production origin as the Supabase Site URL after the application has a permanent domain.

## Environment variables

The canonical template is [`.env.example`](../.env.example).

| Variable | Required | Scope | Purpose |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Browser-safe | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Browser-safe | Supabase anon key; safe only with correct RLS policies |
| `GROQ_API_KEY` | For AI insights | Server only | Generates the optional Smart Insights explanation |
| `GROQ_INSIGHTS_MODEL` | No | Server only | Groq model ID; defaults to `openai/gpt-oss-20b` |
| `GEMINI_API_KEY` | For receipt extraction | Server only | Powers automatic receipt parsing from shared images |
| `GEMINI_RECEIPT_MODEL` | No | Server only | Gemini model ID; defaults to `gemini-1.5-flash` |
| `N8N_TRADE_REVIEW_WEBHOOK_URL` | For trade review | Server only | n8n webhook receiving authenticated review jobs |
| `N8N_TRADE_REVIEW_SHARED_SECRET` | For trade review | Server only | Shared secret sent to and verified by n8n |
| `SUPABASE_URL` | Monthly report workflow | Server only | Supabase project HTTPS URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Monthly report workflow | Server only | Privileged worker access; GitHub Actions secret only |

Variables prefixed with `NEXT_PUBLIC_` are included in the browser bundle by design. Provider keys, service-role keys, webhook secrets, and OAuth client secrets must never use that prefix.

## Optional n8n and Telegram automation

The [`n8n/`](../n8n/) directory contains sanitized and inactive workflow templates:

| Workflow | Purpose |
| --- | --- |
| `telegram-text-workflow.json` | Parse a Telegram text message and create a transaction |
| `telegram-receipt-workflow.json` | Download a receipt, run OCR, and store structured transaction data |
| `forex-trade-review-workflow.json` | Generate an on-demand advisory review for one trade |
| `forex-weekly-review-workflow.json` | Generate and store a weekly trading review |

### n8n environment

Configure the required values in the n8n secret/environment store—not inside exported workflow JSON:

| Variable | Used by |
| --- | --- |
| `TELEGRAM_ALLOWED_USER_ID` | Telegram allowlist |
| `GEMINI_API_KEY` | Text parsing, OCR, and trade reviews |
| `SUPABASE_URL` | Supabase REST and Storage endpoints |
| `SUPABASE_SERVICE_ROLE_KEY` | Privileged server-side n8n access |
| `SUPABASE_USER_ID` | Owner assigned to automated records |
| `N8N_TRADE_REVIEW_SHARED_SECRET` | Validates requests from the FinTrack server |

After importing a template:

1. Attach the correct Telegram credential to Telegram nodes.
2. Restrict the bot with `TELEGRAM_ALLOWED_USER_ID`.
3. Verify the Supabase user ID that will own generated records.
4. Match the trade review shared secret with the application environment.
5. Test with dummy financial data.
6. Activate the workflow only after every success and failure path has been reviewed.

Never export live n8n credentials. Use the `.private.json` suffix for local private exports so Git ignores them.

## Available scripts

| Command | Description |
| --- | --- |
| `pnpm dev` | Start the Next.js development server |
| `pnpm build` | Create a production build |
| `pnpm start` | Serve the production build |
| `pnpm lint` | Run ESLint |
| `pnpm typecheck` | Run TypeScript without emitting files |
| `pnpm test` | Run the Vitest unit suite once |
| `pnpm test:coverage` | Run unit tests with coverage |
| `pnpm test:e2e` | Run Playwright across desktop and mobile projects |
| `pnpm test:e2e:list` | List all discovered Playwright tests |
| `pnpm check` | Run lint, typecheck, unit tests, and production build |
| `pnpm audit:security` | Audit production dependencies at high severity or above |

Playwright starts its own production server on port `3100`; do not start the application manually before running E2E tests.

## Testing and CI

Before opening a pull request, run:

```bash
pnpm check
pnpm audit:security
pnpm test:e2e
```

See [current CI coverage](ci.md) for the maintained browser flows and their boundaries. The test suite covers deterministic finance calculations, configuration and security boundaries, authentication, onboarding, application smoke routes, Smart Insights, production headers, PWA behavior, and responsive overflow.

GitHub Actions runs the following checks on pull requests and pushes to `main` and `codex/**`:

- **Quality:** lint, typecheck, unit tests, and production build
- **Security:** production dependency audit
- **E2E:** Playwright tests against a production build on desktop and mobile Chromium

The separate **Monthly financial reports** workflow runs the Go worker on its UTC schedule or manual dispatch.

Playwright reports are uploaded as CI artifacts even when E2E tests fail.

## Project structure

```text
FinTrack/
|-- .github/workflows/       GitHub Actions CI
|-- docs/                    Architecture documentation
|-- e2e/                     Playwright specs and controlled fixtures
|-- n8n/                     Sanitized workflow templates
|-- public/                  Brand assets, PWA icons, and service worker
|-- src/
|   |-- app/                 App Router pages and API routes
|   |-- components/          Shared components and UI primitives
|   |-- config/              Configuration and security headers
|   |-- infrastructure/      Supabase client boundaries
|   |-- lib/                 Domain rules and calculations
|   |-- server/              Server-only HTTP helpers
|   `-- types/               Global declarations
|-- supabase/
|   |-- migrations/          Ordered, immutable database migrations
|   `-- schema.sql           Base schema and RLS policies
|-- .env.example             Safe environment template
|-- next.config.ts           Next.js and security-header configuration
|-- playwright.config.ts     E2E projects and production test server
`-- package.json             Scripts and dependency manifest
```

## Security

FinTrack handles personal financial information and treats public and private execution boundaries explicitly:

- Supabase RLS restricts records by authenticated user ownership.
- API routes authenticate access tokens independently and validate resource ownership.
- App-owned API responses use no-store caching policies.
- Security headers include a constrained Content Security Policy and related browser protections.
- Smart Insights receives bounded aggregate metrics instead of raw transaction records.
- n8n service-role credentials remain in the automation environment only.
- `.env.local`, exports, receipts, database dumps, and private workflow files are ignored by Git.

Do not report vulnerabilities in a public issue. Follow [SECURITY.md](../SECURITY.md) and use the repository's private security reporting channel.

## Deployment

FinTrack can run on Vercel or another Node.js-compatible platform.

### Vercel

1. Import the GitHub repository into Vercel.
2. Keep the detected Next.js build settings.
3. Add the required environment variables for Preview and Production.
4. Add the Vercel preview and production origins to the Supabase redirect allowlist.
5. Deploy, then verify authentication, security headers, PWA assets, and API integrations.

Use Node.js 22 to match the current CI environment, or any supported runtime satisfying the project's `>=20.9.0` engine requirement.

When self-hosting, place the app behind HTTPS and keep n8n on a separately protected origin. Never expose an n8n editor, Supabase service-role key, or private webhook without authentication.

## Contributing

1. Create a focused branch from the latest `main`.
2. Keep domain calculations deterministic and covered by unit tests.
3. Add or update Playwright coverage for user-visible flows.
4. Preserve the client/server and public/private configuration boundaries documented in [the architecture guide](../docs/architecture.md).
5. Run the complete validation commands before opening a pull request.
6. Explain database migration and environment changes explicitly in the pull request description.

Financial data, credentials, receipts, local exports, and private automation state must never be included in a contribution.

