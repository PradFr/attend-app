import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { timetableBatches, timetableForDay } from '../lib/timetable';
import { useHardwareBack } from '../lib/use-hardware-back';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import type { AuthSession, MobileTimetableSlot } from '../lib/api';
import type { Role, Screen } from '../lib/navigation';
import { useTimetable } from '../lib/use-timetable';
import { colors, WEEK_DAYS } from '../theme';
import { styles } from '../styles';
import { Back } from '../components/ui';
import { SessionCard } from '../components/SessionCard';

export function TimetableScreen({ auth, role, onOpenStudentQr, onOpenFacultyQr, onBack }: {
  auth: AuthSession; role: Role; onNavigate: (screen: Screen) => void;
  onOpenStudentQr: (slot: MobileTimetableSlot) => void; onOpenFacultyQr: (slot: MobileTimetableSlot) => void; onBack: () => void;
}) {
  const campusDate = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  const today = new Date(`${campusDate}T12:00:00+05:30`).getUTCDay();
  const [selectedDay, setSelectedDay] = useState(today || 1);
  const { slots, loading, error } = useTimetable(auth.token);
  const [selectedBatch, setSelectedBatch] = useState<string | null>(null);
  const batches = timetableBatches(slots);
  const batch = batches.find(item => item.key === selectedBatch);
  const student = role === 'student';
  const showBatches = !student && !batch;
  const handleBack = () => { if (!student && selectedBatch) setSelectedBatch(null); else onBack(); };
  useHardwareBack(() => { handleBack(); return true; });
  const filtered = timetableForDay(slots, selectedDay, student ? undefined : batch?.key);
  if (showBatches) return <ScrollView style={styles.screen} contentContainerStyle={styles.screenContent}>
    <Back onPress={handleBack} />
    <Text style={styles.screenTitle}>Batch timetables</Text>
    <Text style={styles.screenLead}>Choose a batch to view its weekly timetable.</Text>
    {loading && <Text style={styles.loadingText}>Loading batches...</Text>}
    {!!error && <Text accessibilityRole="alert" style={styles.errorBannerText}>{error}</Text>}
    {batches.map(item => <Pressable key={item.key} accessibilityRole="button" accessibilityLabel={`View timetable for ${item.name}`} onPress={() => setSelectedBatch(item.key)} style={({ pressed }) => [styles.batchTimetableCard, pressed && styles.pressedState]}>
      <MaterialCommunityIcons name="account-group-outline" size={28} color={colors.primary} />
      <View style={{ flex: 1, gap: 5 }}>
        <Text style={styles.emptyCardTitle}>{item.name}</Text>
        {item.code && item.code !== item.name && <Text style={styles.screenLead}>{item.code}</Text>}
        <Text style={styles.batchSessionCount}>{item.count} scheduled session{item.count === 1 ? '' : 's'}</Text>
      </View>
      <MaterialCommunityIcons name="chevron-right" size={24} color={colors.primary} />
    </Pressable>)}
    {!loading && !error && !batches.length && <View style={styles.emptyCard}><Text style={styles.emptyCardTitle}>No batch sessions scheduled yet</Text></View>}
  </ScrollView>;
  return <ScrollView style={styles.screen} contentContainerStyle={styles.screenContent}>
    <Back onPress={handleBack} />
    <Text style={styles.screenTitle}>{student ? 'Weekly timetable' : batch?.name}</Text>
    <Text style={styles.screenLead}>{student ? 'Select a session to scan or show your QR.' : 'Select a session to show its QR or scan student passes.'}</Text>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, flexShrink: 0 }} contentContainerStyle={styles.daySelectorBar}>
      {WEEK_DAYS.map(day => <Pressable accessibilityRole="button" key={day.day} onPress={() => setSelectedDay(day.day)} accessibilityState={{ selected: selectedDay === day.day }} style={[styles.dayButton, selectedDay === day.day && styles.dayButtonActive]}><Text style={[styles.dayButtonText, selectedDay === day.day && styles.dayButtonTextActive]}>{day.name}</Text></Pressable>)}
    </ScrollView>
    {loading && <Text style={styles.loadingText}>Loading sessions...</Text>}
    {!!error && <Text accessibilityRole="alert" style={styles.errorBannerText}>{error}</Text>}
    {filtered.map(slot => <SessionCard key={slot.id} slot={slot} student={student} onPress={() => student ? onOpenStudentQr(slot) : onOpenFacultyQr(slot)} />)}
    {!loading && !filtered.length && <View style={styles.emptyCard}><Text style={styles.emptyCardTitle}>No sessions on {WEEK_DAYS.find(day => day.day === selectedDay)?.full}</Text></View>}
  </ScrollView>;
}
