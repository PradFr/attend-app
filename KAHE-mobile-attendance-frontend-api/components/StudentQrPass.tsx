import { ActivityIndicator, Image, Text, View } from 'react-native';
import type { AuthSession } from '../lib/api';
import { useQrDisplay } from '../lib/use-qr-display';
import { Action } from './ui';
import { styles } from '../styles';
import { colors } from '../theme';

export function StudentQrPass({ auth, sessionId }: { auth: AuthSession; sessionId: string }) {
  const { qr, loading, error, refresh, onImageError } = useQrDisplay(auth.token, sessionId, 'student');
  return <View style={{ alignItems: 'center', width: '100%', gap: 14 }}>
    <Text style={styles.screenLead}>Show this QR to your professor. Attendance is marked after their scan is accepted.</Text>
    {qr ? <Image accessibilityLabel="Your attendance QR pass" source={{ uri: qr.dataUrl }} style={styles.responsiveQrImage} resizeMode="contain" onError={onImageError} />
      : <View style={styles.qrLoadingBox}>{loading ? <ActivityIndicator color={colors.primary} /> : <Text style={styles.loadingText}>{error ? 'QR unavailable' : 'Refreshing your QR...'}</Text>}</View>}
    {qr && <Text style={styles.qrExpText}>Refreshes automatically</Text>}
    {!!error && <Text accessibilityRole="alert" style={styles.errorBannerText}>{error}</Text>}
    <Action kind="secondary" disabled={loading} onPress={refresh}><Text style={styles.actionSecondaryText}>{error ? 'Retry' : 'Refresh QR'}</Text></Action>
  </View>;
}
