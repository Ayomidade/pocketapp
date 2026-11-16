# PocketOps Test Plan (`TEST_PLAN.md`)

## Automated Suites
1. **Backend Unit Tests (`server/tests/crypto.test.js`)**: AES-256-GCM credential encryption/decryption, PKCE S256 challenge verification, timing-safe HMAC-SHA256 GitHub webhook signature verification.
2. **Backend API Integration Tests (`server/tests/api.integration.test.js`)**: Supertest + Sequelize suite covering `/health`, JWT auth guard, refresh token rotation & replay family revocation, project creation, incident lifecycle (`open -> investigating -> resolved`), mandatory `Idempotency-Key` enforcement, persistent notification emission, audit logging, and webhook signature rejection/acceptance.
3. **Mobile Unit Tests (`mobile/tests/core.test.js`)**: LCS unified diff computation (`ED-06`) and Signalframe/Relay design token separation.

## External / Device Verification Checklist
- Live PostgreSQL migration (`npm run migrate`) & Redis BullMQ worker execution (`npm run worker`).
- GitHub OAuth PKCE browser round-trip and GitHub App installation verification on real repositories.
- Render API service discovery, live logs streaming, and redeployment tracking.
- EAS Android preview APK build and FCM push notification delivery on physical Android hardware.
