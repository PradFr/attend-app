# KAHE Attendance download page

Public download page: https://kahe-attendance-download.vercel.app
Web app for iPhone, iPad and computers: https://kahe-attendance.vercel.app

Android downloads the 32-bit and 64-bit ARM APK (Android 7.0+). The adjacent iOS/Web button opens the browser app, not an iOS installer. The demo dashboard uses a generic Demo Student identity and contains no personal account names. The public page omits the technical download verification panel.

Build: `node scripts/build.mjs`. Vercel root: `download-page`; output: `dist`; no dependencies. Builds reuse the published GitHub release APK and verify its SHA-256 before publishing. `APK_LOCAL_PATH` optionally supplies a local copy. No private GitHub credentials or expiring artifact URL are needed. Do not commit APK files.

The page supports phone, tablet and desktop layouts, visible keyboard focus, a skip link, reduced motion and readable contrast. The dashboard asset is an illustrative demo, not a live student record.
