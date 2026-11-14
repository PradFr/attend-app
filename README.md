# KAHE Attendance app

Standalone copy of the KAHE mobile and browser frontend. The original `PradFr/attendance` repository is unchanged.

- Android download: https://github.com/PradFr/attend-app/releases/latest/download/KAHE-Attendance-1.0.4.apk
- Browser app: https://kahe-attendance.vercel.app
- Backend API: https://189.72.146.93/api/v1

The application is in `KAHE-mobile-attendance-frontend-api/`. `src/types/` contains the shared TypeScript contracts required by the frontend; no backend implementation or database is included.

This repository initially republishes the existing Android 1.0.4 (build 5) APK unchanged. Copying the source and publishing that APK do not require a rebuild. Future app changes require a rebuild with the existing signing identity to install as an update.
