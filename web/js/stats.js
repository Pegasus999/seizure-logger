// Port de src/lib/stats.ts (mêmes formules).
import { state } from "./store.js";
import { addDays, dayKey, monthKey, startOfWeek, shortDay, shortMonth } from "./fmt.js";

export function filterEvents(events, from, to) {
  const a = from.getTime(), b = to.getTime();
  return events.filter((e) => {
    if (e.deleted_at) return false;
    const t = new Date(e.occurred_at).getTime();
    return t >= a && t <= b;
  });
}

export function computeStats(events, from, to) {
  const list = filterEvents(events, from, to);
  const labels = new Map(state.symptoms.map((s) => [s.id, s.label]));

  const weekly = [], weekIdx = new Map();
  for (let w = startOfWeek(from); w.getTime() <= to.getTime(); w = addDays(w, 7)) {
    const b = { key: dayKey(w), label: shortDay(w), low: 0, medium: 0, high: 0 };
    weekly.push(b); weekIdx.set(b.key, b);
  }
  const monthly = [], monthIdx = new Map();
  for (let y = from.getFullYear(), m = from.getMonth(); ;) {
    const d = new Date(y, m, 1);
    if (d.getTime() > to.getTime()) break;
    const b = { key: monthKey(d), label: shortMonth(d), total: 0 };
    monthly.push(b); monthIdx.set(b.key, b);
    if (++m > 11) { m = 0; y += 1; }
  }

  const c = { low: 0, medium: 0, high: 0 };
  const byHour = new Array(24).fill(0);
  const counts = new Map();
  let longest = null;
  for (const e of list) {
    const d = new Date(e.occurred_at);
    c[e.intensity] += 1;
    byHour[d.getHours()] += 1;
    const wb = weekIdx.get(dayKey(startOfWeek(d))); if (wb) wb[e.intensity] += 1;
    const mb = monthIdx.get(monthKey(d)); if (mb) mb.total += 1;
    if (e.duration_seconds !== null && e.duration_seconds !== undefined && (longest === null || e.duration_seconds > longest)) longest = e.duration_seconds;
    for (const id of e.symptomIds || []) {
      const label = labels.get(id);
      if (label) counts.set(label, (counts.get(label) || 0) + 1);
    }
  }
  const topSymptoms = [...counts.entries()].map(([label, count]) => ({ label, count }))
    .sort((x, y) => y.count - x.count || x.label.localeCompare(y.label, "fr"));
  const total = list.length;
  return {
    total, low: c.low, medium: c.medium, high: c.high,
    avgPerWeek: Math.round((total / Math.max(1, weekly.length)) * 10) / 10,
    longestSeconds: longest, weekly, monthly, byHour, topSymptoms,
  };
}
