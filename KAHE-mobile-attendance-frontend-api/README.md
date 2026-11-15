# KAHE Attendance mobile and web app

Expo SDK 57 / React Native 0.86 app for students and faculty. Development agents should read [AGENTS.md](AGENTS.md).

## Development

```sh
npm ci
npm run web
```

Optional client configuration belongs in the deployment environment. Use `.env.example` as the variable-name reference and keep local values out of Git. Client configuration is included in the generated app and must not contain credentials.

Students open a session to scan the classroom QR or select **My QR**. Teachers choose a batch to view its timetable, show classroom codes, or scan student passes continuously.

## Source layout

- `App.tsx`: authentication and navigation.
- `screens/`: login, home, timetable, student session, scanner and profile.
- `components/`: session cards, QR passes, classroom dialogs and shared controls.
- `lib/`: app services, storage, QR handling and navigation helpers.
- `styles.ts`, `theme.ts`: shared presentation.
- `tests/`: automated regression checks.

## Verification

```sh
npm test
node node_modules/typescript/bin/tsc --noEmit
npm run build:web
```

On Linux, if npm inherits a Windows shell setting, use `npm --script-shell=/bin/sh` for npm scripts.

## Vercel deployment

Connect `PradFr/attend-app`, select `main` as the production branch, and set the root directory to `KAHE-mobile-attendance-frontend-api`. Use the **Other** framework preset. The checked-in `vercel.json` installs dependencies, runs `npm run build:web`, and publishes `dist`.

Camera access requires HTTPS and browser permission. A web deployment does not create an APK. Native Android behavior should also be checked on a phone.

## Android releases

Release version and Android version code are defined in `app.json`. The Android workflow builds for both 32-bit and 64-bit ARM, verifies signing continuity, and produces an APK with its checksum. Preserve the existing signing identity for updates.

## Branding

University artwork is stored in `assets/`. Native icon changes require a new Android build; web branding is updated by a web deployment.
