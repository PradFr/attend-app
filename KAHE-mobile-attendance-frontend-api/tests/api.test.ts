import { afterEach, describe, expect, it, vi } from "vitest";
import { API_BASE_URL, authHeaders, getStudentFlow, submitAttendanceAttempt, login, getSlotContext, getStudentQr, launchSlotSession } from "../lib/api";

describe("attendance API client configuration", () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.useRealTimers(); });

  it('uses the fixed institution API by default', () => {
    expect(API_BASE_URL).toBe('https://189.72.146.93/api/v1');
  });

  it("formats authenticated requests with a bearer token", () => {
    expect(authHeaders("example-token")).toEqual({ Authorization: "Bearer example-token" });
  });

  it('ignores legacy saved server overrides', async () => {
    vi.stubGlobal('localStorage', { getItem: () => 'https://old-preview.example/api/v1', setItem: vi.fn() });
    vi.resetModules();
    const api = await import('../lib/api');
    expect(api.getApiBaseUrl()).toBe('https://189.72.146.93/api/v1');
    expect(api.getClassroomDisplayUrl()).toBe('https://189.72.146.93/display/');
    expect(api).not.toHaveProperty('setCustomApiBaseUrl');
  });

  it('does not send fabricated coordinates when GPS is missing', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 202, json: async () => ({ decision: 'CHALLENGE' }) });
    vi.stubGlobal('fetch', fetchMock);
    await submitAttendanceAttempt('token', { sessionId: 'session', clientTimestamp: new Date().toISOString(), declarationAccepted: true });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body).not.toHaveProperty('coordinates');
    expect(body).not.toHaveProperty('telemetry');
  });

  it('rejects an invalid server-driven flow', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ policy: {} }) }));
    await expect(getStudentFlow('token', 'session')).rejects.toThrow('Invalid attendance flow');
  });

  it('rejects an invalid sign-in response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ token: 'invalid' }) }));
    await expect(login('email', 'password')).rejects.toThrow('Invalid sign-in');
  });

  it('surfaces service failures rather than treating them as successful attendance', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 403, json: async () => ({ message: 'Not enrolled.' }) }));
    await expect(submitAttendanceAttempt('token', { sessionId: 'session', clientTimestamp: '' })).rejects.toThrow('Not enrolled.');
  });

  it('returns rejected attendance decisions for a clear red result screen', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 403, json: async () => ({ decision: 'REJECT', decisionReason: 'EXPIRED_QR_TOKEN' }) }));
    await expect(submitAttendanceAttempt('token', { sessionId: 'session', clientTimestamp: '' })).resolves.toEqual({ decision: 'REJECT', decisionReason: 'EXPIRED_QR_TOKEN' });
  });

  it('sends explicit confirmation for an out-of-schedule session without GPS', async () => {
    const mocked = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ sessionId: 'sess_live', status: 'ACTIVE' }) });
    vi.stubGlobal('fetch', mocked);
    await launchSlotSession('token', 'slot_lecture', undefined, true);
    expect(JSON.parse(mocked.mock.calls[0][1].body)).toEqual({ slotId: 'slot_lecture', confirmOutsideSchedule: true });
  });

  it('loads persisted attendance for the selected slot, then requests its actual session QR', async () => {
    const mocked = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ sessionId: 'sess_live', sessionActive: true, attendanceStatus: 'NOT_MARKED' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ sessionId: 'sess_live', dataUrl: 'data:image/png;base64,test', expiresAt: 1234 }) });
    vi.stubGlobal('fetch', mocked);
    const context = await getSlotContext('token', 'slot_lecture');
    await getStudentQr('token', context.sessionId!);
    expect(mocked.mock.calls[0][0]).toContain('/sessions/for-slot/slot_lecture');
    expect(mocked.mock.calls[1][0]).toContain('/student-qr?sessionId=sess_live');
  });

  it('stops waiting when the network request never answers', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', (_url: string, options: RequestInit) => new Promise((_resolve, reject) => options.signal?.addEventListener('abort', () => reject(new Error('Aborted')))));
    const checked = expect(login('email', 'password')).rejects.toThrow('server took too long');
    await vi.advanceTimersByTimeAsync(15000);
    await checked;
    vi.useRealTimers();
  });

  it('keeps the hardcoded API in a release even on another web origin', async () => {
    vi.stubGlobal('__DEV__', false);
    vi.stubGlobal('window', { location: { protocol: 'https:', hostname: 'attendance.example.edu', origin: 'https://attendance.example.edu' } });
    vi.resetModules();
    const releaseApi = await import('../lib/api');
    expect(releaseApi.getApiBaseUrl()).toBe('https://189.72.146.93/api/v1');
  });

  it('connects native releases to the hardcoded API without manual setup', async () => {
    vi.stubGlobal('__DEV__', false);
    vi.stubGlobal('window', undefined);
    vi.resetModules();
    const nativeApi = await import('../lib/api');
    expect(nativeApi.getApiBaseUrl()).toBe('https://189.72.146.93/api/v1');
  });

  it('keeps the same fixed server in development without a build-time override', async () => {
    vi.stubGlobal('__DEV__', true);
    vi.stubGlobal('window', { location: { protocol: 'http:', hostname: 'localhost', origin: 'http://localhost:8081' } });
    vi.resetModules();
    const api = await import('../lib/api');
    expect(api.getApiBaseUrl()).toBe('https://189.72.146.93/api/v1');
  });
});
