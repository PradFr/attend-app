import { useEffect, useState } from 'react';
import { ActivityIndicator, AppState, Image, Pressable, ScrollView, Text, View } from 'react-native';
import { AttendanceApiError, getSessionRecords, launchSlotSession, type AuthSession, type MobileTimetableSlot } from '../lib/api';
import { colors, formatAmPm, getErrorMessage } from '../theme';
import { styles } from '../styles';
import { BigScreenPairing } from './BigScreenPairing';
import { UniversalScanner } from '../screens/UniversalScanner';
import { Action, ConfirmModal, ModalViewport } from './ui';
import { useQrDisplay } from '../lib/use-qr-display';
import { sessionName } from './SessionCard';

export function FacultyClassQrModal({ auth, slot, visible, onClose }: { auth: AuthSession; slot: MobileTimetableSlot; visible: boolean; onClose: () => void }) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const { qr, loading: qrLoading, error: qrError, refresh: refreshQr, onImageError } = useQrDisplay(auth.token, sessionId, 'faculty', visible);
  const [tab, setTab] = useState<'qr' | 'scan'>('qr');
  const [error, setError] = useState('');
  const [warning, setWarning] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [pairing, setPairing] = useState(false);
  const [recordsError, setRecordsError] = useState('');
  const [recordCount, setRecordCount] = useState<number | null>(null);
  useEffect(() => {
    if (!visible) return;
    let active = true;
    setLoading(true); setError('');
    void launchSlotSession(auth.token, slot.id, slot.batchId, confirmed).then(result => {
      if (active) { setSessionId(result.sessionId); setWarning(false); }
    }).catch(err => {
      if (!active) return;
      if (err instanceof AttendanceApiError && err.code === 'OUTSIDE_SCHEDULE') setWarning(true);
      else setError(getErrorMessage(err));
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [auth.token, slot.id, slot.batchId, visible, confirmed, revision]);

  useEffect(() => {
    if (!sessionId || !visible) return;
    let active = true;
    const records = async () => {
      try {
        const next = await getSessionRecords(auth.token, sessionId);
        if (active) { setRecordCount(next.records.filter(row => ['PRESENT', 'LATE', 'EXCUSED'].includes(row.status)).length); setRecordsError(''); }
      } catch (err) { if (active) setRecordsError(getErrorMessage(err)); }
    };
    void records();
    const poll = setInterval(() => { if (AppState.currentState === 'active') void records(); }, 5000);
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') { void records(); } });
    return () => { active = false; clearInterval(poll); subscription.remove(); };
  }, [auth.token, sessionId, visible, revision]);
  if (!visible) return null;
  if (pairing && sessionId) return <BigScreenPairing auth={auth} sessionId={sessionId} onClose={() => setPairing(false)} />;
  const valid = Boolean(qr);
  return <ModalViewport onClose={onClose}><View style={[styles.passModalCard, { width: '100%' }]}>
    <Text style={styles.passModalTitle}>{sessionName(slot)}</Text>
    <Text style={styles.passTimeText}>{formatAmPm(slot.startTime)} - {formatAmPm(slot.endTime)}</Text>
    <View style={styles.sessionTabs}>
      {(['qr', 'scan'] as const).map(value => <Pressable accessibilityRole="tab" accessibilityState={{ selected: tab === value }} key={value} onPress={() => setTab(value)} style={[styles.sessionTab, { backgroundColor: tab === value ? colors.primary : colors.cardSubtle }]}><Text style={[styles.sessionTabText, { color: tab === value ? '#fff' : colors.text }]}>{value === 'qr' ? 'Classroom QR' : 'Scan student QR'}</Text></Pressable>)}
    </View>
    <ConfirmModal visible={warning} title="Outside scheduled time" message="This session has not started yet or has already ended. Display its QR anyway?" confirmText="Continue" onConfirm={() => { setWarning(false); setConfirmed(true); }} onCancel={onClose} />
    {loading ? <ActivityIndicator color={colors.primary} /> : sessionId && tab === 'scan'
      ? <ScrollView style={{ width: '100%', maxHeight: 520 }}><UniversalScanner auth={auth} role="faculty" expectedSessionId={sessionId} embedded onBack={onClose} /></ScrollView>
      : sessionId ? <>
        <Text style={styles.passInstructions}>Students scan this code to mark their attendance.</Text>
        {qr ? <Image accessibilityLabel="Classroom attendance QR" source={{ uri: qr.dataUrl }} style={styles.responsiveQrImage} resizeMode="contain" onError={onImageError} /> : <View style={styles.qrLoadingBox}><Text style={styles.loadingText}>{qrError ? 'QR unavailable' : 'Loading QR...'}</Text></View>}
        {!!qrError && <Text accessibilityRole="alert" style={styles.errorBannerText}>{qrError}</Text>}
        <Action kind="secondary" disabled={qrLoading} onPress={refreshQr}><Text style={styles.actionSecondaryText}>{qrLoading ? 'Refreshing QR...' : qrError ? 'Retry QR' : 'Refresh QR'}</Text></Action>
        {!!recordsError && <Text accessibilityRole="alert" style={styles.errorBannerText}>Attendance count could not refresh. It will retry automatically.</Text>}
        {recordCount !== null && <Text accessibilityLiveRegion="polite" style={styles.passInstructions}>{recordCount} student{recordCount === 1 ? '' : 's'} marked present</Text>}
        <Action kind="secondary" disabled={!valid} onPress={() => setPairing(true)}><Text style={styles.actionSecondaryText}>Show on big screen</Text></Action>
      </> : null}
    {!!error && <><Text accessibilityRole="alert" style={[styles.errorBannerText, { marginVertical: 12 }]}>{error}</Text><Action onPress={() => setRevision(value => value + 1)}><Text style={styles.actionPrimaryText}>Retry</Text></Action></>}
    <Action kind="secondary" onPress={onClose}><Text style={styles.actionSecondaryText}>Close</Text></Action>
  </View></ModalViewport>;
}
