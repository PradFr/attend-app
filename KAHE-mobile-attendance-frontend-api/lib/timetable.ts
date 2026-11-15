import type { MobileTimetableSlot } from './api';

export function batchKey(slot: MobileTimetableSlot): string {
  if (slot.batchId) return `id:${slot.batchId}`;
  if (slot.batchCode) return `code:${slot.batchCode}`;
  if (slot.batchName) return `name:${slot.batchName}`;
  return 'unassigned';
}

export function timetableBatches(slots: MobileTimetableSlot[]) {
  const batches = new Map<string, { key: string; name: string; code?: string; count: number }>();
  for (const slot of slots) {
    const key = batchKey(slot);
    const batch = batches.get(key);
    if (batch) batch.count += 1;
    else batches.set(key, { key, name: slot.batchName || slot.batchCode || 'Other sessions', code: slot.batchCode, count: 1 });
  }
  return [...batches.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function timetableForDay(slots: MobileTimetableSlot[], day: number, batch?: string) {
  return slots.filter(slot => (!batch || batchKey(slot) === batch) &&
    (slot.specificDate ? new Date(`${slot.specificDate}T12:00:00Z`).getUTCDay() === day : slot.dayOfWeek === day))
    .sort((a, b) => a.startTime.localeCompare(b.startTime));
}
