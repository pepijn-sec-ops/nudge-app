# Android APK (Capacitor)

The UI is your Vite React build wrapped with **Capacitor**. API calls use `VITE_API_BASE_URL` so the phone talks to your **deployed** server, not your PC.

## Prerequisites

- Node.js 20+
- Android Studio (SDK, platform tools, a device or emulator)
- A deployed Nudge API over **HTTPS** (recommended)

## 1. Point the app at your backend

Create `client/.env.production` (or export before build):

```bash
VITE_API_BASE_URL=https://YOUR-API-HOST
```

Use the **origin only** (no `/api` suffix). Example: `https://nudge-api.fly.dev`

Set the server `CLIENT_ORIGIN` to include your Capacitor origin, for example:

```text
CLIENT_ORIGIN=https://YOUR-API-HOST,https://YOUR-FRONTEND-HOST,capacitor://localhost
```

(Adjust to your real URLs; `capacitor://localhost` covers many WebView cases.)

## 2. Install Capacitor (once)

From the `client` folder:

```bash
npm install
npx cap add android
```

`npx cap add android` creates the `android/` project (not committed by default).

## 3. Build web assets and sync

```bash
npm run build
npx cap sync
```

Or use the shortcut:

```bash
npm run cap:sync
```

## 4. Open Android Studio and build APK

```bash
npm run cap:open:android
```

In Android Studio: **Build → Build Bundle(s) / APK(s) → Build APK(s)**.  
For Play Store use an App Bundle (AAB) instead.

Install the APK on your phone (USB debugging or share the file).

## 5. Troubleshooting

- **Network errors**: Confirm `VITE_API_BASE_URL` was set **before** `npm run build`, then `cap sync` again.
- **CORS blocked**: Add the exact WebView origin to `CLIENT_ORIGIN` on the server; keep HTTPS on the API.
- **Cleartext HTTP**: Avoid HTTP in production; Android blocks cleartext unless you change network security config.

## 6. Sharing with your brother

Ship the same APK file, or publish to **Google Play Internal testing**. He still needs a valid account on **your** backend (invite code or account you create in Admin).
