# PocketOps Engineering Guide (`AGENTS.md`)

1. **Language & Stack**: Keep `mobile/` strictly in JavaScript/JSX (Expo Router) and `server/` in Node.js CommonJS/Express with PostgreSQL + Sequelize migrations.
2. **Design Fidelity**: All operational UI uses the Signalframe Light/Dark token palette (`mobile/src/theme/tokens.js`). Keep the PocketOps Relay logo palette (`#0B1F36`, `#FF7A59`, `#00D4B3`, `#F5F7FA`) strictly scoped to launcher icons, splash screen, onboarding hero, and brand surfaces.
3. **Security Invariants**:
   - Never embed GitHub App private keys, OAuth secrets, or Render API keys in `mobile/`.
   - Never auto-resolve an incident from a single health check or deploy completion.
   - Never silently overwrite remotely modified files; verify base SHA before committing.
   - Require `Idempotency-Key` headers on commits, pull requests, redeployments, and incident resolution.
4. **Database Changes**: Add forward/backward Sequelize migrations in `server/migrations/`; never use destructive `sequelize.sync({ force: true })` outside test harnesses.
