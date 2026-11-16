# PocketOps Feature Status Matrix (`STATUS.md`)

Classification key: `Implemented and verified` | `Implemented but unverified` | `Mock/demo only` | `Blocked` | `Not started`

| Capability | Status | Verification Notes |
| :--- | :--- | :--- |
| Security crypto, PKCE, HMAC-SHA256 webhooks | Implemented and verified | Verified via Vitest unit & Supertest integration tests (`server/tests/`) |
| Auth refresh rotation & replay family revocation | Implemented and verified | Verified via Supertest + Sequelize test suite |
| Projects, Incident lifecycle, Idempotency, Audit & Inbox APIs | Implemented and verified | Verified via Supertest + Sequelize test suite |
| Diff engine & Signalframe Light/Dark design tokens | Implemented and verified | Verified via mobile Jest unit tests (`mobile/tests/`) |
| PostgreSQL migrations (`server/migrations/`) | Implemented but unverified | No live PostgreSQL server inside AI Studio container |
| Redis + BullMQ push/health workers | Implemented but unverified | No live Redis server or FCM credentials inside AI Studio container |
| Live GitHub OAuth / App & Render API calls | Implemented but unverified | Requires user `.env` OAuth/App/Render credentials |
| Expo Router UI & CodeMirror 6 WebView (`mobile/`) | Implemented but unverified | AI Studio lacks Android Expo emulator runtime; requires `expo start` or `eas build` |
