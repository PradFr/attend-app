import { CameraView, useCameraPermissions } from 'expo-camera';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, Vibration, View } from 'react-native';
import { useEffect, useRef, useState } from 'react';
import { AttendanceApiError, getStudentFlow, submitAttendanceAttempt, submitProfessorScan, type AuthSession } from '../lib/api';
import { attendanceOutcome, decodeAttendanceQr, createScanDeduplicator, type ScanOutcome } from '../lib/scanning';
import type { Role } from '../lib/navigation';
import { colors, getErrorMessage } from '../theme';
import { styles } from '../styles';
import { Action, Back, ConfirmModal } from '../components/ui';



export function UniversalScanner({ auth, role, onBack, expectedSessionId, embedded = false, onResult }: { auth: AuthSession; role: Role; onBack: () => void; expectedSessionId?: string; embedded?: boolean; onResult?: () => void }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState('');
  const [outcome, setOutcome] = useState<ScanOutcome | null>(null);
  const [cameraError, setCameraError] = useState('');
  const [cameraKey, setCameraKey] = useState(0);
  const [torch, setTorch] = useState(false);
  const locked = useRef(false);
  const acceptScan = useRef(createScanDeduplicator());
  const mounted = useRef(true);
  const faculty = role === 'faculty';
  const [pendingScan, setPendingScan] = useState<string | null>(null);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  useEffect(() => {
    if (!faculty || !outcome) return;
    const timer = setTimeout(() => setOutcome(null), 3000);
    return () => clearTimeout(timer);
  }, [faculty, outcome]);

  const scan = async ({ data }: { data: string }, confirmOutsideSchedule = false) => {
    if ((!confirmOutsideSchedule && locked.current) || (!faculty && !confirmed)) return;
    if (!confirmOutsideSchedule && faculty && !acceptScan.current(data)) return;
    locked.current = true;
    let awaitingConfirmation = false;
    setOutcome(null);
    Vibration.vibrate(60);
    setBusy(true);
    setPhase('QR detected. Checking the class...');
    try {
      const qr = decodeAttendanceQr(data);
      if (expectedSessionId && qr.sessionId !== expectedSessionId) throw new Error('This QR belongs to a different session. Scan the classroom code for the session you opened.');
      if (faculty) {
        if (qr.type !== 'STUDENT_PERSONAL') throw new Error('This is a classroom QR. Scan a student pass on a faculty account.');
        setPhase('QR detected. Recording student attendance...');
        const result = await submitProfessorScan(auth.token, qr.sessionId, data, confirmOutsideSchedule);
        if (result.decision !== 'ACCEPT') throw new Error(result.decisionReason || 'Attendance was not recorded.');
        if (mounted.current) setOutcome({ kind: 'success', title: 'Student marked present', message: result.studentName + (result.enrollmentId ? ' · ' + result.enrollmentId : '') + '. Attendance is saved.', badge: 'PRESENT' });
      } else {
        if (qr.type !== 'SESSION_BROADCAST') throw new Error('This is a student pass. Scan the QR shown on the classroom screen.');
        const flow = await getStudentFlow(auth.token, qr.sessionId);
        if (flow.policy.requiresBiometric || flow.policy.requiresBle) throw new Error('This class requires professor verification. Show your class QR pass to your professor.');
        setPhase('QR detected. Saving your attendance...');
        const result = await submitAttendanceAttempt(auth.token, { sessionId: qr.sessionId, clientTimestamp: new Date().toISOString(), qrPayload: data, declarationAccepted: confirmed });
        if (mounted.current) setOutcome(attendanceOutcome(result));
        if (mounted.current) onResult?.();
      }
    } catch (error) {
      if (!mounted.current) return;
      if (error instanceof AttendanceApiError && error.code === 'OUTSIDE_SCHEDULE') { awaitingConfirmation = true; setPendingScan(data); return; }
      if (mounted.current) setOutcome({ kind: 'error', title: 'Attendance not confirmed', message: getErrorMessage(error), badge: 'NOT CONFIRMED' });
    } finally {
      // Faculty can scan the next pass immediately; students keep their result.
      if (faculty && !awaitingConfirmation) locked.current = false;
      if (mounted.current) setBusy(false);
    }
  };

  const retry = () => { locked.current = false; setOutcome(null); setPhase(''); setBusy(false); setCameraError(''); setCameraKey(value => value + 1); };

  if (outcome && !faculty) {
    const success = outcome.kind === 'success';
    const review = outcome.kind === 'review';
    const tone = success ? colors.primary : review ? colors.amber : colors.danger;
    return <ScrollView style={styles.screen} contentContainerStyle={styles.scanOutcomeContent}>
      <View style={styles.scanOutcomeCard} accessibilityRole="alert" accessibilityLiveRegion="assertive">
        <MaterialCommunityIcons name={success ? 'check-circle' : review ? 'clock-outline' : 'alert-circle-outline'} size={68} color={tone} />
        <Text style={[styles.resultBadgeText, { color: tone, marginTop: 16 }]}>{outcome.badge}</Text>
        <Text style={styles.resultTitle}>{outcome.title}</Text>
        <Text style={styles.resultMessage}>{outcome.message}</Text>
        <View style={{ width: '100%', marginTop: 24, gap: 12 }}>
          <Action onPress={onBack}><Text style={styles.actionPrimaryText}>Done</Text></Action>
          <Action kind="secondary" onPress={retry}><Text style={styles.actionSecondaryText}>{success ? 'Scan another code' : 'Try scanning again'}</Text></Action>
        </View>
      </View>
    </ScrollView>;
  }

  if (!permission?.granted) return <ScrollView contentContainerStyle={styles.scanOutcomeContent}>
    {!embedded && <Back onPress={onBack} />}
    <MaterialCommunityIcons name="camera-outline" size={52} color={colors.primary} />
    <Text style={styles.permissionTitle}>Allow camera access</Text>
    <Text style={styles.permissionLead}>Use the camera to scan a classroom QR or a student pass.</Text>
    <Action onPress={() => { if (permission?.canAskAgain === false) void Linking.openSettings(); else void requestPermission(); }}><Text style={styles.actionPrimaryText}>{permission?.canAskAgain === false ? 'Open phone settings' : 'Allow camera'}</Text></Action>
  </ScrollView>;

  const tone = outcome?.kind === 'success' ? colors.primary : colors.danger;
  return <ScrollView style={styles.screen} contentContainerStyle={styles.scannerContent} keyboardShouldPersistTaps="handled">
    <ConfirmModal visible={pendingScan !== null} title="Outside scheduled time" message="This session has not started yet or has already ended. Mark this student anyway?" confirmText="Continue and mark" onConfirm={() => { const data = pendingScan!; setPendingScan(null); void scan({ data }, true); }} onCancel={() => { setPendingScan(null); retry(); }} />
    {!embedded && <Back onPress={onBack} />}
    {!embedded && <Text style={styles.screenTitle}>{faculty ? 'Scan student pass' : 'Scan classroom QR'}</Text>}
    <Text style={styles.screenLead}>Keep the code inside the fixed square. The frame stays still.</Text>
    <View style={styles.fixedCameraBox}>
      <CameraView key={cameraKey} style={StyleSheet.absoluteFill} facing="back" zoom={0} enableTorch={torch} barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={busy || pendingScan !== null || (!faculty && !confirmed) || cameraError ? undefined : event => { void scan(event); }}
        onMountError={() => setCameraError('The camera could not start. Close other camera apps and try again.')} />
      <View pointerEvents="none" style={styles.fixedCameraGuide}>
        <View style={[styles.cornerBracket, styles.cornerTopLeft]} /><View style={[styles.cornerBracket, styles.cornerTopRight]} /><View style={[styles.cornerBracket, styles.cornerBottomLeft]} /><View style={[styles.cornerBracket, styles.cornerBottomRight]} />
      </View>
      {faculty && outcome && <View pointerEvents="none" style={[styles.scanResultOverlay, { borderColor: tone }]} accessibilityRole="alert" accessibilityLiveRegion="assertive">
        <MaterialCommunityIcons name={outcome.kind === 'success' ? 'check-circle' : 'alert-circle-outline'} size={28} color={tone} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.scanResultTitle, { color: tone }]}>{outcome.title}</Text>
          <Text style={styles.scanResultMessage}>{outcome.message}</Text>
        </View>
      </View>}
    </View>
    {!faculty && <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: confirmed, disabled: busy }} disabled={busy} onPress={() => setConfirmed(value => !value)} style={styles.presenceCheckbox}>
      <MaterialCommunityIcons name={confirmed ? 'checkbox-marked' : 'checkbox-blank-outline'} size={26} color={colors.primary} />
      <Text style={styles.presenceText}>I confirm I am physically present in the class I scan.</Text>
    </Pressable>}
    <View style={styles.scanStatusCard} accessibilityLiveRegion="polite">
      {busy ? <ActivityIndicator color={colors.primary} /> : <MaterialCommunityIcons name="qrcode-scan" size={22} color={colors.primary} />}
      <Text style={styles.scanStatusText}>{cameraError || (busy ? phase : !faculty && !confirmed ? 'Confirm your presence above to enable scanning.' : faculty ? 'Ready for the next student. Results appear over the camera.' : 'Ready to scan. Detection will vibrate and show a result.')}</Text>
    </View>
    {cameraError ? <Action onPress={retry}><Text style={styles.actionPrimaryText}>Restart camera</Text></Action> : <Action kind="secondary" disabled={busy} onPress={() => setTorch(value => !value)}><Text style={styles.actionSecondaryText}>{torch ? 'Turn flashlight off' : 'Turn flashlight on'}</Text></Action>}
  </ScrollView>;
}
