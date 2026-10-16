# Operations and release checks

`GET /api/health` is liveness only: an HTTP 200 means this process responds. It does not certify deployment configuration.

`GET /api/health?ready=1` returns 200 only when Supabase REST accepts the configured public key and the shared Redis limiter answers PING. Missing/invalid configuration, network failure, or a bounded timeout returns 503 with generic dependency statuses. No credentials, account identifiers, or provider bodies are returned. These probes do not verify migrations, RLS policies, AI models, payment callbacks, or backup recovery; run the separate release checks for those.

Public production requires HTTPS `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`. Each limit operation is atomic in Redis and has a 1.5 second timeout covering headers and JSON body. Unavailable Redis rejects expensive routes with 503 and Retry-After: 5; exhausted allowance returns 429. Local fallback is allowed only in development/test, or with the explicit private single-instance opt-in `RATE_LIMIT_ALLOW_LOCAL=true`. Do not set this opt-in on public/multi-instance deployments.

API failures carry a generated correlation ID in the response/header. Server JSON error events include only fixed route, code, HTTP status and correlation ID. Raw provider errors, request bodies, image contents, tokens, email addresses and account IDs are never included. Search deployment logs by the correlation ID when investigating a user report. Retain logs only for the operational retention period configured by the deployment operator; telemetry vendor and alert routing are intentionally not assumed.

Before release, verify readiness from the deployed URL; exercise a controlled Redis outage and confirm 503 without a provider call; verify recovery, rate exhaustion/Retry-After, and log redaction. Configure alerts for elevated 5xx, readiness failures and payment callback failures. Record the operator, environment, date, results and links to evidence in the release checklist. Never test failure injection against customers' live financial operations.
