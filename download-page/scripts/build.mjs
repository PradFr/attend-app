import { createHash } from 'node:crypto';
import { copyFile, cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = path.join(root, 'dist');
const fileName = 'KAHE-Attendance-1.0.6.apk';
const expected = '175c3271b9ec3d4487783da20d7ef0da3a86e8fdaa9a7d4eef61440c8946a115';
// Fetch the published release and verify it before hosting the exact same APK.
const publicApk = `https://github.com/PradFr/attend-app/releases/download/android-v1.0.6/${fileName}`;
let bytes;
if (process.env.APK_LOCAL_PATH) {
  bytes = await readFile(process.env.APK_LOCAL_PATH);
} else {
  const response = await fetch(publicApk, { signal: AbortSignal.timeout(120000) });
  if (!response.ok) throw new Error(`APK download failed (HTTP ${response.status}).`);
  bytes = Buffer.from(await response.arrayBuffer());
}
if (createHash('sha256').update(bytes).digest('hex') !== expected) throw new Error('APK checksum mismatch. Refusing to publish an unverified file.');
await rm(output, { recursive: true, force: true });
await mkdir(path.join(output, 'downloads'), { recursive: true });
for (const name of ['index.html', 'styles.css']) await copyFile(path.join(root, name), path.join(output, name));
await cp(path.join(root, 'assets'), path.join(output, 'assets'), { recursive: true });
await writeFile(path.join(output, 'downloads', fileName), bytes);
await writeFile(path.join(output, 'downloads', 'SHA256SUMS.txt'), `${expected}  ${fileName}\n`);
console.log(`Built static page and verified Android APK (${bytes.byteLength} bytes).`);
