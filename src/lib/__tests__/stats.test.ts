/// <reference types="jest" />
import { computeStats } from '../stats';
import { ev } from '../testUtils';

const from = new Date(2026, 9, 5, 0, 0); // Monday
const to = new Date(2026, 9, 25, 23, 59, 59, 999); // Sunday, 3 weeks

describe('computeStats', () => {
  const sym = (l: string) => ({ id: l, label: l });
  const events = [
    ev('1', new Date(2026, 9, 5, 2, 30), 'low', { duration_seconds: 45, symptoms: [sym('Jerking'), sym('Drooling')] }),
    ev('2', new Date(2026, 9, 6, 2, 10), 'high', { duration_seconds: 200, symptoms: [sym('Drooling')] }),
    ev('3', new Date(2026, 9, 20, 23, 0), 'medium', { symptoms: [sym('Jerking')] }),
    ev('4', new Date(2026, 9, 4, 23, 59), 'high'), // out of range
    ev('5', new Date(2026, 9, 10, 10, 0), 'high', { deleted_at: '2026-10-11T00:00:00Z' }),
    ev('6', new Date(2026, 9, 26, 0, 0), 'low'), // out
  ];
  const s = computeStats(events, from, to);
  it('counts', () => {
    expect(s.total).toBe(3);
    expect(s.byIntensity).toEqual({ low: 1, medium: 1, high: 1 });
    expect(s.longestDurationSeconds).toBe(200);
  });
  it('weekly zero-filled ascending', () => {
    expect(s.weekly.map((w) => w.weekStart)).toEqual(['2026-10-05', '2026-10-12', '2026-10-19']);
    expect(s.weekly[0]).toMatchObject({ low: 1, high: 1 });
    expect(s.weekly[1]).toMatchObject({ low: 0, medium: 0, high: 0 });
    expect(s.weekly[2].medium).toBe(1);
    expect(s.avgPerWeek).toBe(1);
    expect(s.monthly).toEqual([{ month: '2026-10', low: 1, medium: 1, high: 1 }]);
  });
  it('byHour', () => {
    expect(s.byHour).toHaveLength(24);
    expect(s.byHour[2]).toBe(2);
    expect(s.byHour[23]).toBe(1);
  });
  it('top symptoms ties by label', () => {
    expect(s.topSymptoms).toEqual([
      { label: 'Drooling', count: 2 },
      { label: 'Jerking', count: 2 },
    ]);
  });
  it('empty', () => {
    const e = computeStats([], from, to);
    expect(e.longestDurationSeconds).toBeNull();
    expect(e.avgPerWeek).toBe(0);
  });
  it('avg rounds to 1 decimal', () => {
    const many = [1, 2, 3, 4].map((i) => ev(String(i), new Date(2026, 9, 6, i)));
    expect(computeStats(many, from, to).avgPerWeek).toBe(1.3);
  });
});
