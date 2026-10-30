import type { EventWithDetails, MonthBucket, ReportStats, WeekBucket } from '../types';
import { addDays, dayKey, monthKey, startOfWeek } from './dates';

export function filterEvents(events: EventWithDetails[], from: Date, to: Date): EventWithDetails[] {
  const a = from.getTime();
  const b = to.getTime();
  return events.filter((e) => {
    if (e.deleted_at) return false;
    const t = new Date(e.occurred_at).getTime();
    return t >= a && t <= b;
  });
}

export function computeStats(events: EventWithDetails[], from: Date, to: Date): ReportStats {
  const list = filterEvents(events, from, to);

  const weekly: WeekBucket[] = [];
  const weekIdx = new Map<string, WeekBucket>();
  for (let w = startOfWeek(from); w.getTime() <= to.getTime(); w = addDays(w, 7)) {
    const b: WeekBucket = { weekStart: dayKey(w), low: 0, medium: 0, high: 0 };
    weekly.push(b);
    weekIdx.set(b.weekStart, b);
  }

  const monthly: MonthBucket[] = [];
  const monthIdx = new Map<string, MonthBucket>();
  for (let y = from.getFullYear(), m = from.getMonth(); ; ) {
    const d = new Date(y, m, 1);
    if (d.getTime() > to.getTime()) break;
    const b: MonthBucket = { month: monthKey(d), low: 0, medium: 0, high: 0 };
    monthly.push(b);
    monthIdx.set(b.month, b);
    m += 1;
    if (m > 11) {
      m = 0;
      y += 1;
    }
  }

  const byIntensity = { low: 0, medium: 0, high: 0 };
  const byHour = new Array<number>(24).fill(0);
  const symptomCounts = new Map<string, number>();
  let longest: number | null = null;

  for (const e of list) {
    const d = new Date(e.occurred_at);
    byIntensity[e.intensity] += 1;
    byHour[d.getHours()] += 1;
    const wb = weekIdx.get(dayKey(startOfWeek(d)));
    if (wb) wb[e.intensity] += 1;
    const mb = monthIdx.get(monthKey(d));
    if (mb) mb[e.intensity] += 1;
    if (e.duration_seconds !== null && (longest === null || e.duration_seconds > longest)) {
      longest = e.duration_seconds;
    }
    for (const s of e.symptoms) symptomCounts.set(s.label, (symptomCounts.get(s.label) ?? 0) + 1);
  }

  const topSymptoms = [...symptomCounts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((x, y) => y.count - x.count || x.label.localeCompare(y.label));

  const total = list.length;
  return {
    total,
    byIntensity,
    avgPerWeek: Math.round((total / Math.max(1, weekly.length)) * 10) / 10,
    longestDurationSeconds: longest,
    weekly,
    monthly,
    byHour,
    topSymptoms,
  };
}
