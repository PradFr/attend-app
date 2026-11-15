/** Use the server's token lifetime so a wrong phone clock cannot hide a fresh QR. */
export function qrDisplayDeadline(qr: { dataUrl: string; expiresInSeconds: number; expiresAt: number; timestamp?: number }, requestStartedAt: number): number {
  if (!qr.dataUrl?.startsWith('data:image/png;base64,') || !Number.isFinite(qr.expiresInSeconds) || qr.expiresInSeconds <= 0 || !Number.isFinite(qr.expiresAt)) {
    throw new Error('The server returned an invalid QR. Tap Retry to request a fresh code.');
  }
  const lifetime = qr.timestamp === undefined ? qr.expiresInSeconds : Math.min(qr.expiresInSeconds, qr.expiresAt - qr.timestamp);
  if (!Number.isFinite(lifetime) || lifetime <= 0) throw new Error('The QR has expired. Tap Retry for a fresh code.');
  // Count network time against the token lifetime and leave a one-second margin.
  return requestStartedAt + lifetime * 1000 - 1000;
}
