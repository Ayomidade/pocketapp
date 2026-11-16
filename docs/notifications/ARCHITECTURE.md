# Notification & Alerting Architecture (`ARCHITECTURE.md`)

1. **Event Sources**: GitHub webhooks (`/webhooks/github`), Render webhooks (`/webhooks/render`), BullMQ scheduled health checks, and manual incident creation.
2. **Persistence First**: Every notification is persisted in `notifications` (with 5-minute `dedupKey` suppression) before enqueueing push delivery so alerts remain visible in `AC-01` even if mobile push delivery fails.
3. **Background Delivery**: BullMQ `pocketops-notifications` queue processes jobs with exponential backoff (4 attempts), evaluates `notification_preferences`, routes to Android notification channels (`incidents`, `deployments`, `health`, `git`), and automatically marks `DeviceNotRegistered` tokens inactive.
4. **Deep Linking**: Tapping any push notification parses `pocketops://incidents/:id`, `pocketops://services/:id`, or `pocketops://repositories/:id` inside Expo Router `_layout.js`.
