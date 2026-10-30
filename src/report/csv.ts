import { formatDuration, afterEffectLabel, contextTagLabel } from '../lib/format';
import { formatTime, dayKey } from '../lib/dates';
import type { EventWithDetails } from '../types';

const HEADER = 'date,time,intensity,duration_seconds,duration,symptoms,after_effect,context,notes';

function field(v: string): string {
  let s = v;
  if (/^[=+\-@]/.test(s)) s = `'${s}`;
  if (/[",\r\n]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function buildCsv(events: EventWithDetails[]): string {
  const sorted = [...events].sort(
    (a, b) => new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime(),
  );
  const rows = sorted.map((e) => {
    const d = new Date(e.occurred_at);
    return [
      dayKey(d),
      formatTime(d),
      e.intensity,
      e.duration_seconds === null ? '' : String(e.duration_seconds),
      e.duration_seconds === null ? '' : formatDuration(e.duration_seconds),
      e.symptoms.map((s) => s.label).join('; '),
      e.after_effect ? afterEffectLabel(e.after_effect) : '',
      e.context_tags.map(contextTagLabel).join('; '),
      e.notes ?? '',
    ]
      .map(field)
      .join(',');
  });
  return '﻿' + [HEADER, ...rows].join('\r\n') + '\r\n';
}
