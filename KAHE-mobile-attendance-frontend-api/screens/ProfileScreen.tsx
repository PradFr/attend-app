import { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { getMyProfile, type AuthSession, type UserProfile } from '../lib/api';
import { styles } from '../styles';
import { Back } from '../components/ui';

export function ProfileScreen({ auth, onBack }: { auth: AuthSession; onBack: () => void }) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    void getMyProfile(auth.token)
      .then(result => { if (active) setProfile(result.user); })
      .catch(() => { if (active) setError('Could not load profile. Your sign-in is still saved.'); });
    return () => { active = false; };
  }, [auth.token]);

  const details = {
    Email: profile?.email,
    'Register number': profile?.enrollmentId,
    Department: profile?.departmentCode,
    Year: profile?.yearOfStudy,
    Phone: profile?.phoneNumber,
  };
  return <ScrollView style={styles.screen} contentContainerStyle={styles.screenContent}>
    <Back onPress={onBack} />
    <Text style={styles.screenTitle}>Settings</Text>
    <View style={[styles.profileViewCard, { marginTop: 16 }]}>
      <Text style={styles.profileNameDisplay}>{profile?.fullName || auth.user.fullName}</Text>
      {!!error && <Text accessibilityRole="alert" style={[styles.errorBannerText, { marginTop: 12 }]}>{error}</Text>}
      {Object.entries(details).map(([label, value]) => <View key={label} style={styles.profileInfoRow}>
        <Text style={styles.profileInfoLabel}>{label}</Text>
        <Text selectable style={styles.profileInfoValue}>{value ?? '—'}</Text>
      </View>)}
      <Text style={[styles.screenLead, { marginTop: 16 }]}>Your administrator manages these details.</Text>
    </View>
  </ScrollView>;
}
