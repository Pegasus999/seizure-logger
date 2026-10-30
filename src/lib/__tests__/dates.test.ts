/// <reference types="jest" />
import { dayKey, rangeForPreset, startOfWeek, endOfDay, formatDayHeading, formatDate, formatTime } from '../dates';

describe('dates', () => {
  const now = new Date(2026, 9, 30, 15, 20);
  it('30d spans 30 days incl today', () => {
    const r = rangeForPreset('30d', { now });
    expect(dayKey(r.from)).toBe('2026-10-01');
    expect(r.from.getHours()).toBe(0);
    expect(r.to.getTime()).toBe(endOfDay(now).getTime());
  });
  it('3m clamps day of month', () => {
    const r = rangeForPreset('3m', { now: new Date(2026, 4, 31, 10) });
    expect(dayKey(r.from)).toBe('2026-02-28');
    const r2 = rangeForPreset('3m', { now: new Date(2028, 4, 31, 10) });
    expect(dayKey(r2.from)).toBe('2028-02-29');
    expect(dayKey(rangeForPreset('3m', { now }).from)).toBe('2026-07-30');
  });
  it('since_visit uses local date and falls back', () => {
    expect(dayKey(rangeForPreset('since_visit', { now, lastVisitDate: '2026-09-15' }).from)).toBe('2026-09-15');
    expect(dayKey(rangeForPreset('since_visit', { now, lastVisitDate: null }).from)).toBe('2026-10-01');
  });
  it('custom swaps reversed', () => {
    const r = rangeForPreset('custom', { now, from: new Date(2026, 9, 20, 12), to: new Date(2026, 9, 10, 12) });
    expect(dayKey(r.from)).toBe('2026-10-10');
    expect(dayKey(r.to)).toBe('2026-10-20');
    expect(r.to.getHours()).toBe(23);
  });
  it('startOfWeek Sunday and Monday', () => {
    expect(dayKey(startOfWeek(new Date(2026, 9, 25, 10)))).toBe('2026-10-19'); // Sunday
    expect(dayKey(startOfWeek(new Date(2026, 9, 26, 0, 5)))).toBe('2026-10-26'); // Monday
  });
  it('formatting', () => {
    expect(formatDate(new Date(2026, 9, 30))).toBe('Fri 30 Oct 2026');
    expect(formatTime(new Date(2026, 9, 5, 2, 3))).toBe('02:03');
    expect(formatDayHeading(now, now)).toBe('Today');
    expect(formatDayHeading(new Date(2026, 9, 29), now)).toBe('Yesterday');
  });
});
