import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { getFacultyQrExport, getStudentQr } from './api';
import { qrDisplayDeadline } from './qr-display';
import { getErrorMessage } from '../theme';

export function useQrDisplay(token: string, sessionId: string | null, role: 'student' | 'faculty', enabled = true) {
  const [qr, setQr] = useState<{ dataUrl: string; deadline: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [now, setNow] = useState(() => performance.now());
  const refreshRef = useRef<() => void>(() => {});
  useEffect(() => {
    setQr(null); setError(''); setLoading(false);
    if (!sessionId || !enabled) return;
    let active = true, busy = false;
    const refresh = async () => {
      if (busy || !active) return;
      busy = true; setLoading(true);
      const started = performance.now();
      try {
        const next = role === 'student' ? await getStudentQr(token, sessionId) : await getFacultyQrExport(token, sessionId, 60);
        const deadline = qrDisplayDeadline(next, started);
        if (deadline <= performance.now()) throw new Error('The QR expired while loading. Tap Retry for a fresh code.');
        if (active) { setQr({ dataUrl: next.dataUrl, deadline }); setNow(performance.now()); setError(''); }
      } catch (err) {
        // Preserve the previous code until its own deadline on transient failures.
        if (active) setError(getErrorMessage(err));
      } finally { busy = false; if (active) setLoading(false); }
    };
    refreshRef.current = () => { void refresh(); };
    void refresh();
    const timer = setInterval(() => { if (AppState.currentState === 'active') void refresh(); }, role === 'student' ? 10000 : 30000);
    const clock = setInterval(() => setNow(performance.now()), 1000);
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') {
        // A suspended app must request a fresh pass rather than reuse its old image.
        setQr(null); setNow(performance.now()); void refresh();
      }
    });
    return () => { active = false; refreshRef.current = () => {}; clearInterval(timer); clearInterval(clock); subscription.remove(); };
  }, [token, sessionId, role, enabled]);
  return {
    qr: qr && qr.deadline > now ? qr : null,
    loading,
    error,
    refresh: () => refreshRef.current(),
    onImageError: () => { setQr(null); setError('The QR image could not load. Tap Retry for a fresh code.'); },
  };
}
