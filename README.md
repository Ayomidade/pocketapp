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

### 3. Start Metro for the mobile app

In a separate terminal, start the Expo Metro server and leave it running while testing the debug app:

```bash
cd ~/Desktop/pocketapp/mobile
export EXPO_PUBLIC_API_URL="http://YOUR_COMPUTER_WIFI_IP:4000/api/v1"
npx expo start --dev-client --localhost
```

Replace `YOUR_COMPUTER_WIFI_IP` with the computer's Wi-Fi IP address. For a phone connected through Android debugging, run `adb -s PHONE_SERIAL reverse tcp:8081 tcp:8081` so the app can reach Metro. See the local Android instructions below for setup and installation.

### 4. Android APK via EAS
```bash
cd mobile
npx eas build --platform android --profile preview
```

### 5. Build and install on an Android phone locally

These commands build a **debug APK**. It needs Metro running on the computer to load the JavaScript. Install Android Studio or the Android SDK, Android platform tools (`adb`), Java 17, and the project dependencies first. Run each command on its own line. The commands below assume the repository is at `~/Desktop/pocketapp` and the Android SDK is at `~/Android/Sdk`; adjust the paths if yours differ.

1. From the repository root, install dependencies and start PostgreSQL and Redis. Configure the root `.env` first; its database and Redis URLs must match `docker-compose.yml`.

   ```bash
   cd ~/Desktop/pocketapp
   npm ci
   docker compose up -d postgres redis
   docker compose ps
   npm run migrate
   ```

2. In a terminal, start the API and leave it running:

   ```bash
   cd ~/Desktop/pocketapp
   npm run dev:server
   ```

   To run background jobs, start `npm run dev:worker` from the repository root in another terminal.

3. Connect the phone with USB debugging or pair it using Android wireless debugging. In another terminal, set the SDK path and list connected devices:

   ```bash
   export ANDROID_HOME="$HOME/Android/Sdk"
   export PATH="$ANDROID_HOME/platform-tools:$PATH"
   adb devices -l
   ```

   The phone must show `device`. If it says `unauthorized`, unlock the phone and accept the debugging prompt. If more than one device or emulator is listed, use the phone's serial from the first column with every `adb -s` command below. A wireless serial looks like `192.168.1.20:12345`; a USB serial looks different.

4. Build the APK. This example builds for an ARM64 phone; check yours with `adb -s PHONE_SERIAL shell getprop ro.product.cpu.abi` and substitute its ABI if necessary.

   ```bash
   cd ~/Desktop/pocketapp/mobile/android
   ./gradlew app:assembleDebug -x lint -x test --max-workers=2 -PreactNativeArchitectures=arm64-v8a
   ```

   The APK is written to `mobile/android/app/build/outputs/apk/debug/app-debug.apk`. The first build may download dependencies and take several minutes.

5. Install the APK. Replace `PHONE_SERIAL` with the serial from `adb devices -l`:

   ```bash
   cd ~/Desktop/pocketapp
   adb -s PHONE_SERIAL install -r mobile/android/app/build/outputs/apk/debug/app-debug.apk
   adb -s PHONE_SERIAL reverse tcp:8081 tcp:8081
   ```

   `-r` updates an existing compatible installation without clearing its app data. If Android reports insufficient storage, free space on the phone and retry the install. If the signing certificate differs, Android may refuse the update; investigate before uninstalling, since uninstalling removes local app data.

6. Start Metro in a separate terminal and leave it running. First find your computer's Wi-Fi IP with `hostname -I` or `ip -4 addr show`. Replace `YOUR_COMPUTER_WIFI_IP` with the address the phone can reach; do not use `localhost` for the API URL on a physical phone.

   ```bash
   cd ~/Desktop/pocketapp/mobile
   export EXPO_PUBLIC_API_URL="http://YOUR_COMPUTER_WIFI_IP:4000/api/v1"
   npx expo start --dev-client --localhost
   ```

   Open PocketOps on the phone. The `adb reverse` command lets the phone reach Metro at port 8081 while debugging is connected. Repeat it after reconnecting the device if necessary. The phone must also be able to reach the API over the network; GitHub sign-in additionally requires the configured OAuth callback to be reachable by the phone's browser.

## Verification
```bash
npm run test:server
npm run lint:server
npm run test:mobile
```
