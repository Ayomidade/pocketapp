# PocketOps Security Architecture (`SECURITY.md`)

## 1. Authentication & Session Lifecycle
- GitHub OAuth uses **S256 PKCE** (`code_verifier` / `code_challenge`) and single-use, time-bounded `oauth_states` records to prevent CSRF and callback replay.
- PocketOps issues short-lived **JWT access tokens** (`15m`) and rotating **refresh tokens** stored in `expo-secure-store`.
- Refresh token rotation detects reuse of any previously rotated token and immediately revokes the entire session `familyId`, logging `auth.refresh.replay_detected` to `audit_logs`.

## 2. Privilege Separation & Credential Encryption
- **Zero Mobile Secrets**: GitHub OAuth client secret, GitHub App RSA private key, webhook secrets, and Render API keys remain exclusively on the backend.
- **Encryption at Rest**: User GitHub OAuth tokens and Render API keys are encrypted via **AES-256-GCM** (`iv.tag.ciphertext`) before storage in PostgreSQL.
- **Authorization Enforcement**: Every repository, project, service, deployment, and incident endpoint scopes queries by `userId` and verifies active GitHub App installation ownership before mutating upstream resources.

## 3. Source-Code & Production Safety
- **Remote SHA Guard**: Commits validate `expectedSha` against the remote blob SHA and return HTTP `409 REMOTE_REVISION_CONFLICT` with remote content for explicit reconciliation (`ED-07`).
- **Hardened WebView Bridge**: CodeMirror 6 runs with `allowFileAccess={false}` and `domStorageEnabled={false}`, communicating only via allowlisted `v1.0` JSON message types.
- **Idempotency & Explicit Confirmation**: Commits, PR creation, Render redeployments (`confirmProduction: true`), and incident resolutions (`confirmResolution: true`) require `Idempotency-Key` headers.
- **Webhook Verification**: GitHub webhooks are verified via constant-time `crypto.timingSafeEqual` against `X-Hub-Signature-256` HMAC-SHA256 digests.
