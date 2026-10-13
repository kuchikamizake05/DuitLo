# Device lock

The normal login continues to use Supabase email/password or Google authentication. The optional device lock is enabled from Settings only after a six-digit PIN is confirmed and a registered passkey is available. PIN entry is the default unlock screen; WebAuthn runs only after the fingerprint button is clicked.

PIN records are scoped to the signed-in user and device browser storage. They contain a random 16-byte salt and a PBKDF2-SHA-256 hash (600,000 iterations), never the PIN. Five incorrect attempts start a one-minute cooldown. PIN verification works locally; this is a privacy screen for an existing session, not a replacement for server authentication or row-level authorization.

Existing biometric-only installations verify their passkey before configuring the new PIN. Cancelling enrollment leaves the lock disabled and removes the unfinished PIN. Disabling the setting, removing the last passkey, or signing out clears the device PIN. The forgotten-PIN action signs out the local session successfully before clearing its lock and returning to normal login.

Automated tests cover PIN validation, cooldowns, account scoping, setup confirmation, failed enrollment, explicit native credential requests, recovery after cancellation, and both visual themes on desktop and mobile. A physical fingerprint/face sensor still relies on the operating system WebAuthn implementation.
