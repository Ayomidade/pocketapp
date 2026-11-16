# PocketOps PostgreSQL Database Schema (`SCHEMA.md`)

Managed exclusively via forward/backward Sequelize migrations in `server/migrations/`.

## Entity Relationship Summary
- **Identity & Security**: `users` 1─* `sessions`, `users` 1─* `audit_logs`, `users` 1─* `idempotency_records`, `oauth_states` (ephemeral PKCE).
- **Integrations**: `users` 1─1 `github_connections`, `users` 1─* `github_installations` 1─* `authorized_repositories`, `users` 1─1 `render_connections`.
- **Operations**: `users` 1─* `projects` *─* `authorized_repositories` (via `project_repositories`), `projects` *─* `services` (via `project_services`), `services` 1─* `deployments`, `services` 1─* `health_checks`.
- **Incidents & Alerts**: `users` 1─* `incidents` 1─* `incident_events` & `incident_resources`, `users` 1─* `notifications`, `users` 1─* `push_devices`, `users` 1─1 `notification_preferences`.

## Retention Rules
- `oauth_states`: Purged 24 hours after expiration/consumption.
- `idempotency_records`: 24-hour TTL keyed by `(user_id, idempotency_key, method, path)`.
- `health_checks`: Raw probe samples retained for 30 days.
- `audit_logs` & `incident_events`: Immutable append-only operational history retained 365+ days.
