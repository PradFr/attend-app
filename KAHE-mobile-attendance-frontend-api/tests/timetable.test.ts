import { describe, expect, it } from 'vitest';
import type { MobileTimetableSlot } from '../lib/api';
import { timetableBatches, timetableForDay } from '../lib/timetable';

const slot = (id: string, values: Partial<MobileTimetableSlot> = {}): MobileTimetableSlot => ({
  id, scheduleType: 'WEEKLY', dayOfWeek: 1, startTime: '09:00', endTime: '10:00', targetType: 'BATCH', professorId: 'teacher', classroomId: 'room', ...values,
});

describe('batch timetables', () => {
  it('keeps batches with the same display name separate and counts their sessions', () => {
    const slots = [slot('a', { batchId: 'one', batchName: 'Training' }), slot('b', { batchId: 'two', batchName: 'Training' }), slot('c', { batchId: 'one', batchName: 'Training' })];
    expect(timetableBatches(slots).map(batch => batch.count)).toEqual([2, 1]);
    expect(timetableForDay(slots, 1, 'id:one').map(item => item.id)).toEqual(['a', 'c']);
  });
  it('preserves sessions without batch metadata', () => {
    expect(timetableBatches([slot('a')])).toEqual([{ key: 'unassigned', name: 'Other sessions', code: undefined, count: 1 }]);
    expect(timetableForDay([slot('a'), slot('b', { batchId: 'batch' })], 1, 'unassigned').map(item => item.id)).toEqual(['a']);
  });
  it('uses the specific date instead of the recurring weekday and orders sessions by time', () => {
    const slots = [slot('late', { startTime: '14:00' }), slot('early'), slot('dated', { specificDate: '2026-11-17' })];
    expect(timetableForDay(slots, 1).map(item => item.id)).toEqual(['early', 'late']);
    expect(timetableForDay(slots, 2).map(item => item.id)).toEqual(['dated']);
  });
});
