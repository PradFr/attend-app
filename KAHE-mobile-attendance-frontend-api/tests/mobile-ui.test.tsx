import React from 'react';
const testRequire = require('node:module').createRequire(import.meta.url);
testRequire.extensions['.png'] = (module: { exports: unknown }) => { module.exports = 'test-image'; };
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  backHandlers: [] as Array<() => boolean>,
  keyboard: {} as Record<string, () => void>,
  submit: vi.fn(),
  slots: [] as any[],
}));
vi.mock('react-native', () => ({
  ActivityIndicator: 'ActivityIndicator', Image: 'Image', KeyboardAvoidingView: 'KeyboardAvoidingView',
  Pressable: 'Pressable', ScrollView: 'ScrollView', Text: 'Text', TextInput: 'TextInput', View: 'View',
  Modal: 'Modal', Platform: { OS: 'android' }, Linking: { openSettings: vi.fn() },
  Vibration: { vibrate: vi.fn() }, StyleSheet: { create: (styles: unknown) => styles, absoluteFill: {} },
  BackHandler: { addEventListener: (_: string, handler: () => boolean) => {
    mocks.backHandlers.push(handler);
    return { remove: () => { mocks.backHandlers = mocks.backHandlers.filter(item => item !== handler); } };
  } },
  Keyboard: { addListener: (event: string, handler: () => void) => {
    mocks.keyboard[event] = handler;
    return { remove: () => { delete mocks.keyboard[event]; } };
  } },
}));
vi.mock('@expo/vector-icons/MaterialCommunityIcons', () => ({ default: 'Icon' }));
vi.mock('expo-status-bar', () => ({ StatusBar: 'StatusBar' }));
vi.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView', SafeAreaProvider: 'SafeAreaProvider', initialWindowMetrics: null }));
vi.mock('expo-camera', () => ({ CameraView: 'CameraView', useCameraPermissions: () => [{ granted: true }, vi.fn()] }));
vi.mock('../lib/api', () => ({
  AttendanceApiError: class AttendanceApiError extends Error { code = 'OUTSIDE_SCHEDULE'; },
  submitProfessorScan: mocks.submit, login: vi.fn(),
}));
vi.mock('../lib/use-timetable', () => ({ useTimetable: () => ({ slots: mocks.slots, loading: false, error: '' }) }));
vi.mock('../components/SessionCard', () => ({ SessionCard: 'SessionCard' }));

vi.mock('../lib/auth-storage', () => ({ readAuth: async () => ({ token: 'token', user: { role: 'faculty', fullName: 'Teacher' } }), saveAuth: vi.fn() }));
vi.mock('../components/CaptureBoundary', () => ({ CaptureBoundary: ({ children }: { children: React.ReactNode }) => children }));
vi.mock('../screens/Home', () => ({ Home: 'Home' }));
vi.mock('../screens/ProfileScreen', () => ({ ProfileScreen: 'ProfileScreen' }));
vi.mock('../screens/StudentSession', () => ({ StudentSession: 'StudentSession' }));
vi.mock('../components/ClassQrModals', () => ({ FacultyClassQrModal: 'FacultyClassQrModal' }));

import App from '../App';
import { UniversalScanner } from '../screens/UniversalScanner';
import { TimetableScreen } from '../screens/TimetableScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { useHardwareBack } from '../lib/use-hardware-back';
import { AttendanceApiError } from '../lib/api';

const auth = { token: 'token', user: { role: 'faculty', fullName: 'Teacher' } } as any;
const qr = (id: string) => btoa(JSON.stringify({ type: 'STUDENT_PERSONAL', sessionId: 'session', nonce: id }));
const hardwareBack = () => [...mocks.backHandlers].reverse().some(handler => handler());
let tree: ReactTestRenderer;
const render = async (element: React.ReactElement) => { await act(async () => { tree = create(element); }); };
const detect = async (data: string) => { await act(async () => { await tree.root.findByType('CameraView' as any).props.onBarcodeScanned({ data }); }); };
const text = () => JSON.stringify(tree.toJSON());

beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  mocks.backHandlers = []; mocks.keyboard = {}; mocks.slots = []; mocks.submit.mockReset();
});
afterEach(async () => { if (tree!) await act(async () => tree.unmount()); vi.useRealTimers(); });

describe('faculty scanner', () => {
  it('keeps the camera mounted and scans another student without a button', async () => {
    vi.useFakeTimers();
    mocks.submit.mockResolvedValue({ decision: 'ACCEPT', studentName: 'Student One', enrollmentId: 'ONE' });
    await render(<UniversalScanner auth={auth} role="faculty" onBack={vi.fn()} />);
    const camera = tree.root.findByType('CameraView' as any);
    await detect(qr('one'));
    expect(text()).toContain('Student marked present');
    expect(text()).toContain('Student One');
    expect(tree.root.findByType('CameraView' as any)).toBe(camera);
    expect(text()).not.toContain('Scan another code');
    await detect(qr('one'));
    expect(mocks.submit).toHaveBeenCalledTimes(1);
    mocks.submit.mockResolvedValue({ decision: 'REJECT', decisionReason: 'Student is not enrolled' });
    await detect(qr('two'));
    expect(mocks.submit).toHaveBeenCalledTimes(2);
    expect(text()).toContain('Attendance not confirmed');
    expect(text()).toContain('Student is not enrolled');
    await act(async () => { vi.advanceTimersByTime(3000); });
    expect(text()).not.toContain('Attendance not confirmed');
    expect(tree.root.findByType('CameraView' as any)).toBe(camera);
  });
  it('serializes submissions and resumes after a failed request', async () => {
    let reject!: (reason: Error) => void;
    mocks.submit.mockImplementationOnce(() => new Promise((_, fail) => { reject = fail; }));
    await render(<UniversalScanner auth={auth} role="faculty" onBack={vi.fn()} />);
    const callback = tree.root.findByType('CameraView' as any).props.onBarcodeScanned;
    let pending: Promise<void>;
    await act(async () => { pending = callback({ data: qr('one') }); callback({ data: qr('two') }); });
    expect(mocks.submit).toHaveBeenCalledTimes(1);
    await act(async () => { reject(new Error('Network unavailable')); await pending; });
    expect(text()).toContain('Network unavailable');
    mocks.submit.mockResolvedValue({ decision: 'ACCEPT', studentName: 'Student Two' });
    await detect(qr('two'));
    expect(mocks.submit).toHaveBeenCalledTimes(2);
    expect(text()).toContain('Student Two');
  });
  it('requires explicit confirmation outside the schedule and resumes on cancellation', async () => {
    mocks.submit.mockRejectedValueOnce(new AttendanceApiError('Outside schedule'));
    await render(<UniversalScanner auth={auth} role="faculty" onBack={vi.fn()} />);
    await detect(qr('one'));
    expect(text()).toContain('Outside scheduled time');
    expect(tree.root.findByType('CameraView' as any).props.onBarcodeScanned).toBeUndefined();
    const modal = tree.root.findByType('Modal' as any);
    await act(async () => modal.props.onRequestClose());
    expect(text()).not.toContain('Outside scheduled time');
    mocks.submit.mockResolvedValue({ decision: 'ACCEPT', studentName: 'Next Student' });
    await detect(qr('two'));
    expect(text()).toContain('Next Student');
  });
});

describe('batch selection and Android Back', () => {
  it('opens only the selected batch and returns to batches before leaving the timetable', async () => {
    mocks.slots = [
      { id: 'one', batchId: 'one', batchName: 'Batch One', dayOfWeek: 1, startTime: '09:00' },
      { id: 'two', batchId: 'two', batchName: 'Batch Two', dayOfWeek: 1, startTime: '10:00' },
    ];
    const onBack = vi.fn();
    await render(<TimetableScreen auth={auth} role="faculty" onNavigate={vi.fn()} onBack={onBack} onOpenStudentQr={vi.fn()} onOpenFacultyQr={vi.fn()} />);
    expect(tree.root.findAllByType('SessionCard' as any)).toHaveLength(0);
    await act(async () => tree.root.findByProps({ accessibilityLabel: 'View timetable for Batch One' }).props.onPress());
    await act(async () => tree.root.findAllByType('Pressable' as any).find(item => item.props.children?.props?.children === 'Mon')!.props.onPress());
    expect(tree.root.findAllByType('SessionCard' as any).map(item => item.props.slot.id)).toEqual(['one']);
    await act(async () => { expect(hardwareBack()).toBe(true); });
    expect(text()).toContain('Batch timetables');
    expect(onBack).not.toHaveBeenCalled();
    await act(async () => { hardwareBack(); });
    expect(onBack).toHaveBeenCalledOnce();
  });
  it('uses the latest back action and removes the subscription on unmount', async () => {
    function Screen({ onBack }: { onBack: () => boolean }) { useHardwareBack(onBack); return null; }
    const first = vi.fn(() => true), next = vi.fn(() => true);
    await render(<Screen onBack={first} />);
    expect(hardwareBack()).toBe(true);
    await act(async () => tree.update(<Screen onBack={next} />));
    expect(hardwareBack()).toBe(true);
    expect(first).toHaveBeenCalledOnce(); expect(next).toHaveBeenCalledOnce();
    await act(async () => tree.unmount());
    expect(hardwareBack()).toBe(false);
  });
});

describe('login controls', () => {
  it('toggles password visibility without replacing the value and compacts the header for the keyboard', async () => {
    await render(<LoginScreen onAuthenticated={vi.fn()} />);
    const password = () => tree.root.findByProps({ accessibilityLabel: 'Password' });
    await act(async () => password().props.onChangeText('secret123'));
    expect(password().props.secureTextEntry).toBe(true);
    await act(async () => tree.root.findByProps({ accessibilityLabel: 'Show password' }).props.onPress());
    expect(password().props.secureTextEntry).toBe(false);
    expect(password().props.value).toBe('secret123');
    await act(async () => tree.root.findByProps({ accessibilityLabel: 'Hide password' }).props.onPress());
    expect(password().props.secureTextEntry).toBe(true);
    await act(async () => mocks.keyboard.keyboardDidShow());
    expect(tree.root.findAllByType('Image' as any)).toHaveLength(0);
    expect(tree.root.findByType('KeyboardAvoidingView' as any).props.behavior).toBe('height');
    await act(async () => mocks.keyboard.keyboardDidHide());
    expect(tree.root.findAllByType('Image' as any)).toHaveLength(1);
  });
});


describe('app hardware navigation', () => {
  it('returns from profile and scanner to home and closes session details first', async () => {
    await render(<App />);
    await act(async () => tree.root.findByType('Home' as any).props.onNavigate('profile'));
    expect(tree.root.findAllByType('ProfileScreen' as any)).toHaveLength(1);
    await act(async () => { expect(hardwareBack()).toBe(true); });
    expect(tree.root.findAllByType('Home' as any)).toHaveLength(1);
    await act(async () => tree.root.findByType('Home' as any).props.onNavigate('scanner'));
    expect(tree.root.findAllByType('CameraView' as any)).toHaveLength(1);
    await act(async () => { hardwareBack(); });
    expect(tree.root.findAllByType('Home' as any)).toHaveLength(1);
    await act(async () => tree.root.findByType('Home' as any).props.onOpenStudentQr({ id: 'session' }));
    expect(tree.root.findAllByType('StudentSession' as any)).toHaveLength(1);
    await act(async () => { hardwareBack(); });
    expect(tree.root.findAllByType('Home' as any)).toHaveLength(1);
    // At the home screen Android retains its usual exit behavior.
    expect(hardwareBack()).toBe(false);
  });
  it('lets the batch timetable handle Back before the app root', async () => {
    mocks.slots = [{ id: 'one', batchId: 'one', batchName: 'Batch One', dayOfWeek: 1, startTime: '09:00' }];
    await render(<App />);
    await act(async () => tree.root.findByType('Home' as any).props.onNavigate('timetable'));
    await act(async () => tree.root.findByProps({ accessibilityLabel: 'View timetable for Batch One' }).props.onPress());
    await act(async () => { hardwareBack(); });
    expect(text()).toContain('Batch timetables');
    expect(tree.root.findAllByType('Home' as any)).toHaveLength(0);
    await act(async () => { hardwareBack(); });
    expect(tree.root.findAllByType('Home' as any)).toHaveLength(1);
  });
});
