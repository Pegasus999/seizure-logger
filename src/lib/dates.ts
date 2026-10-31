import type { RangePreset } from '../types';

const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const DAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];

export const MONTH_NAMES_SHORT = MONTHS;

const pad = (n: number): string => (n < 10 ? `0${n}` : String(n));

export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function monthKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

export function endOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

/** Monday 00:00 local. */
export function startOfWeek(d: Date): Date {
  const dow = (d.getDay() + 6) % 7; // Mon=0 .. Sun=6
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - dow, 0, 0, 0, 0);
}

/** Calendar-day addition (DST safe); keeps time of day. */
export function addDays(d: Date, n: number): Date {
  return new Date(
    d.getFullYear(),
    d.getMonth(),
    d.getDate() + n,
    d.getHours(),
    d.getMinutes(),
    d.getSeconds(),
    d.getMilliseconds(),
  );
}

/** Parse 'YYYY-MM-DD' as a LOCAL date. Returns null when invalid. */
export function parseLocalDate(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

function monthsEarlier(d: Date, months: number): Date {
  const total = d.getFullYear() * 12 + d.getMonth() - months;
  const y = Math.floor(total / 12);
  const m = total - y * 12;
  const lastDay = new Date(y, m + 1, 0).getDate();
  return new Date(y, m, Math.min(d.getDate(), lastDay));
}

export function rangeForPreset(
  preset: RangePreset,
  opts: { now?: Date; lastVisitDate?: string | null; from?: Date; to?: Date } = {},
): { from: Date; to: Date } {
  const now = opts.now ?? new Date();
  const to = endOfDay(now);
  const thirty = { from: startOfDay(addDays(now, -29)), to };
  switch (preset) {
    case '30d':
      return thirty;
    case '3m':
      return { from: startOfDay(monthsEarlier(now, 3)), to };
    case 'since_visit': {
      const v = opts.lastVisitDate ? parseLocalDate(opts.lastVisitDate) : null;
      return v ? { from: startOfDay(v), to } : thirty;
    }
    case 'custom': {
      const a = opts.from ?? thirty.from;
      const b = opts.to ?? now;
      const [lo, hi] = a.getTime() <= b.getTime() ? [a, b] : [b, a];
      return { from: startOfDay(lo), to: endOfDay(hi) };
    }
  }
}

export function formatDate(d: Date): string {
  return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function formatTime(d: Date): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function formatDateTime(d: Date): string {
  return `${formatDate(d)}, ${formatTime(d)}`;
}

export function formatDayHeading(d: Date, now: Date = new Date()): string {
  const k = dayKey(d);
  if (k === dayKey(now)) return 'Aujourd\'hui';
  if (k === dayKey(addDays(now, -1))) return 'Hier';
  return formatDate(d);
}
