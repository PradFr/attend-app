# Standalone app copy

Copied from `PradFr/attendance` commit `c2ffe65b777f481c4b9983c95fd327ad32063c29`.

All tracked mobile app files are copied byte-for-byte, together with shared `src/types/` and `src/config/constants.ts` imports. No backend server, database, admin dashboard, secrets, signing keys or download website is included. The original repository has not been modified.

The existing 1.0.4 APK is published without compiling or changing it. Its SHA-256 is `d46143d7a2398303313a17f2a7f7aecd238983ecfc8e8c55e5b2609e40929477`.

`Android APK` is a manual workflow for future builds. Do not run it simply to change repository location: a regenerated preview signing key may not update existing installations. Retain the existing signing identity for future updates. The separate release workflow only downloads, checksum-verifies, and uploads the existing public APK.

Some copied mobile documentation records historical prototypes. Current app release identity is `app.json` (1.0.4, version code 5), and the fixed backend is `https://189.72.146.93/api/v1`. The app has no server-switching UI. Copying the repository does not fix the backend security findings from the prior review.
