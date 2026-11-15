import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { qrDisplayDeadline } from '../lib/qr-display';

const mocks = vi.hoisted(() => ({ context: vi.fn(), student: vi.fn(), faculty: vi.fn(), resume: null as null | ((state: string) => void) }));
vi.mock('react-native', () => ({
  View: 'View', Text: 'Text', Pressable: 'Pressable', ScrollView: 'ScrollView', StyleSheet: { create: (styles: unknown) => styles },
  AppState: { currentState: 'active', addEventListener: (_: string, callback: (state: string) => void) => { mocks.resume = callback; return { remove: vi.fn() }; } },
}));
vi.mock('../lib/api', () => ({ AttendanceApiError: class AttendanceApiError extends Error {}, getSlotContext: mocks.context, getStudentQr: mocks.student, getFacultyQrExport: mocks.faculty }));
vi.mock('../components/ui', () => ({ Action: 'Action', Back: 'Back' }));
vi.mock('../components/SessionCard', () => ({ AttendanceBadge: 'AttendanceBadge', sessionName: () => 'Today class' }));
vi.mock('../components/StudentQrPass', () => ({ StudentQrPass: 'StudentQrPass' }));
vi.mock('../screens/UniversalScanner', () => ({ UniversalScanner: 'UniversalScanner' }));
import { StudentSession } from '../screens/StudentSession';
import { useQrDisplay } from '../lib/use-qr-display';

const response = (suffix = 'one') => ({ dataUrl: `data:image/png;base64,${suffix}`, timestamp: 100, expiresAt: 130, expiresInSeconds: 30 });
let state: ReturnType<typeof useQrDisplay>;
let tree: ReactTestRenderer | undefined;
function Display({ session = 'class', role = 'student' }: { session?: string; role?: 'student' | 'faculty' }) {
  state = useQrDisplay('token', session, role);
  return null;
}
const render = async (role: 'student' | 'faculty' = 'student') => { await act(async () => { tree = create(<Display role={role} />); }); };
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  vi.useFakeTimers(); mocks.student.mockReset(); mocks.faculty.mockReset();
  mocks.student.mockResolvedValue(response()); mocks.faculty.mockResolvedValue(response());
});
afterEach(async () => { if (tree) await act(async () => tree!.unmount()); tree = undefined; vi.useRealTimers(); });

describe('QR display lifetime', () => {
  it('uses the server lifetime and includes network time without using the phone clock', () => {
    expect(qrDisplayDeadline(response(), 5000)).toBe(34000);
    vi.setSystemTime(new Date('2050-01-01'));
    expect(qrDisplayDeadline(response(), 5000)).toBe(34000);
  });
  it('rejects malformed or expired QR metadata with an actionable error', () => {
    expect(() => qrDisplayDeadline({ ...response(), expiresInSeconds: NaN }, 0)).toThrow('invalid QR');
    expect(() => qrDisplayDeadline({ ...response(), dataUrl: '' }, 0)).toThrow('invalid QR');
    expect(() => qrDisplayDeadline({ ...response(), expiresAt: 99 }, 0)).toThrow('expired');
  });
});

describe('QR refresh recovery', () => {
  it.each(['student', 'faculty'] as const)('keeps a valid %s QR during a refresh failure, then hides it when expired', async role => {
    await render(role);
    const fetchQr = role === 'student' ? mocks.student : mocks.faculty;
    expect(state.qr?.dataUrl).toBe(response().dataUrl);
    fetchQr.mockRejectedValue(new Error('Connection interrupted'));
    await act(async () => state.refresh());
    expect(state.error).toBe('Connection interrupted');
    expect(state.qr?.dataUrl).toBe(response().dataUrl);
    await act(async () => { await vi.advanceTimersByTimeAsync(30000); });
    expect(state.qr).toBeNull();
    expect(state.error).toBe('Connection interrupted');
    fetchQr.mockResolvedValue(response('fresh'));
    await act(async () => state.refresh());
    expect(state.qr?.dataUrl).toBe(response('fresh').dataUrl);
    expect(state.error).toBe('');
  });
  it('shows a fresh pass even when the phone date is years ahead of the server', async () => {
    vi.setSystemTime(new Date('2050-01-01'));
    await render();
    expect(state.qr).not.toBeNull();
  });
  it('turns image failures into a persistent retry and recovers without restarting the screen', async () => {
    await render();
    await act(async () => state.onImageError());
    expect(state.qr).toBeNull();
    expect(state.error).toContain('image could not load');
    mocks.student.mockResolvedValue(response('retry'));
    await act(async () => state.refresh());
    expect(state.qr?.dataUrl).toBe(response('retry').dataUrl);
    expect(state.error).toBe('');
  });
  it('refreshes when returning from the background and clears a previous session immediately', async () => {
    await render();
    mocks.student.mockResolvedValue(response('foreground'));
    await act(async () => mocks.resume?.('active'));
    expect(state.qr?.dataUrl).toBe(response('foreground').dataUrl);
    mocks.student.mockRejectedValue(new Error('Next class unavailable'));
    await act(async () => tree!.update(<Display session="different-class" />));
    expect(state.qr).toBeNull();
    expect(state.error).toBe('Next class unavailable');
  });
  it('rejects a QR that expires while the request is still in flight', async () => {
    let resolve!: (value: ReturnType<typeof response>) => void;
    mocks.student.mockReturnValue(new Promise(done => { resolve = done; }));
    await render();
    await act(async () => { await vi.advanceTimersByTimeAsync(31000); resolve(response()); });
    expect(state.qr).toBeNull();
    expect(state.error).toContain('expired while loading');
  });
});


describe('student session QR access', () => {
  const auth = { token: 'token', user: { id: 'student', role: 'STUDENT', fullName: 'Student' } };
  const slot = { id: 'slot', dayOfWeek: 1, scheduleType: 'WEEKLY', startTime: '09:00', endTime: '10:00', targetType: 'BATCH', professorId: 'teacher', classroomId: 'room' };
  const openPass = async () => {
    await act(async () => { tree = create(<StudentSession auth={auth} slot={slot} onBack={vi.fn()} />); });
    await act(async () => tree!.root.findAllByType('Pressable' as any).find(item => item.props.children?.props?.children === 'My QR')!.props.onPress());
  };
  it('allows My QR to display even when attendance is already marked', async () => {
    mocks.context.mockResolvedValue({ sessionId: 'live-session', sessionActive: false, attendanceStatus: 'MARKED' });
    await openPass();
    expect(tree!.root.findByType('StudentQrPass' as any).props.sessionId).toBe('live-session');
  });
  it('explains why a pass is unavailable for a session without a class today', async () => {
    mocks.context.mockResolvedValue({ sessionId: null, sessionActive: false, attendanceStatus: 'NOT_MARKED' });
    await openPass();
    expect(JSON.stringify(tree!.toJSON())).toContain('Your QR pass is available for today’s classes only');
    expect(tree!.root.findAllByType('StudentQrPass' as any)).toHaveLength(0);
  });
});
