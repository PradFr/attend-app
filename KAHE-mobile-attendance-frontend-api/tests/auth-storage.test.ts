import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readAuth, saveAuth } from '../lib/auth-storage';

describe('persisted sign-in', () => {
  beforeEach(() => {
    const data = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => data.get(key) || null,
      setItem: (key: string, value: string) => data.set(key, value),
      removeItem: (key: string) => data.delete(key),
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('restores a saved sign-in and can clear its local credentials', async () => {
    const auth = { token: 'session-token', user: { id: 'student', fullName: 'Student', role: 'STUDENT' } };
    await saveAuth(auth);
    expect(await readAuth()).toEqual(auth);
    await saveAuth(null);
    expect(await readAuth()).toBeNull();
  });

  it('does not restore a saved account from another server', async () => {
    localStorage.setItem('kahe_session', JSON.stringify({
      server: 'https://different.example/api/v1',
      auth: { token: 'session-token', user: { id: 'student', fullName: 'Student', role: 'STUDENT' } },
    }));
    expect(await readAuth()).toBeNull();
  });
});
