# PocketOps

**Build, deploy, monitor, and respond to your applications — anywhere.**

PocketOps is a mobile-first developer operations platform built with **React Native + Expo (JavaScript/JSX)**, **Node.js + Express**, **PostgreSQL + Sequelize**, and **Redis + BullMQ**. It connects GitHub (PKCE OAuth + GitHub App), Render deployments, active health probing, push alerts, and auditable incident response into a single mobile recovery workflow.

## Workspace Layout

- `mobile/` — Expo Router mobile application (JavaScript/JSX), Signalframe Light/Dark design system, CodeMirror 6 WebView editor, encrypted SQLite offline drafts, SecureStore token storage, and EAS Build config.
- `server/` — Node.js + Express `/api/v1` REST API, Sequelize models & PostgreSQL migrations, BullMQ background workers, Octokit GitHub App integration, Render API client, and Expo Push delivery.
- `docs/` — Product requirements, architecture, security model, PostgreSQL schema, OpenAPI 3.1 specification, Signalframe screen map, design tokens, notification architecture, test plan, roadmap, and honest status tracker.

## Local Development Setup

### Prerequisites
- Node.js 20+ (verified with Node v22)
- PostgreSQL 15+
- Redis 7+
- Expo CLI / Android SDK (or EAS Build account for Android APK builds)

### 1. Configure Environment
Copy `.env.example` into `server/.env` and `mobile/.env` and fill in your GitHub OAuth, GitHub App, Render, PostgreSQL, and Redis credentials.

### 2. Backend Setup
```bash
cd server
npm install
npm run db:migrate
npm run db:seed
npm run dev      # Express API on :4000
npm run worker   # BullMQ push + health check worker
```

### 3. Mobile Setup
```bash
cd mobile
npm install
npx expo start
```

### 4. Android APK via EAS
```bash
cd mobile
npx eas build --platform android --profile preview
```

## Verification
```bash
npm run test:server
npm run lint:server
npm run test:mobile
```
