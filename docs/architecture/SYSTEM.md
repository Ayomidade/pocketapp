# PocketOps System Architecture (`SYSTEM.md`)

```text
+---------------------------+        HTTPS / JWT        +-----------------------------------+
|  PocketOps Mobile (Expo)  | <-----------------------> |  Express API (/api/v1)            |
|  - Expo Router (JS/JSX)   |                           |  - Auth & Refresh Rotation        |
|  - Zustand + TanStack     |                           |  - GitHub OAuth + Octokit App     |
|  - Encrypted SQLite Draft |                           |  - Render API v1 Client           |
|  - CodeMirror 6 WebView   |                           |  - Idempotency & Audit Guard      |
+-------------^-------------+                           +---------+---------------+---------+
              | pocketops:// deep link                            |               |
              |                                                   v               v
+-------------+-------------+                           +---------------+  +----------------+
|  Expo Push / Android FCM  | <---- BullMQ Workers ---- |  Redis        |  |  PostgreSQL    |
|  - Channel-routed alerts  |       - Push delivery     |  Queues       |  |  (Sequelize    |
|  - Retry & token prune    |       - Health probing    |               |  |   Migrations)  |
+---------------------------+                           +---------------+  +----------------+
```

## Module Boundaries
- **Mobile (`mobile/`)**: Presentation, TanStack Query caching, SecureStore session secrets, encrypted offline SQLite drafts, and sandboxed CodeMirror 6 WebView (`v1` message bridge).
- **Backend (`server/`)**: Credential encryption, OAuth PKCE exchange, GitHub App JWT signing, Render API proxy, health probing, incident state machine, and persistent notification inbox.
