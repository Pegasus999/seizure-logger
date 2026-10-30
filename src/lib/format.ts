import { AFTER_EFFECTS, CONTEXT_TAGS, DURATION_PRESETS } from '../constants';
import type { AfterEffect, ContextTag } from '../types';

export function formatDuration(seconds: number | null): string {
  if (seconds === null || seconds === undefined) return '—';
  const preset = DURATION_PRESETS.find((p) => p.seconds === seconds);
  if (preset) return preset.label;
  const s = Math.max(0, Math.round(seconds));
  if (s < 60) return `${s} sec`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return r === 0 ? `${m} min` : `${m} min ${r} sec`;
}

export function afterEffectLabel(a: AfterEffect | null): string {
  return a ? AFTER_EFFECTS[a] ?? a : '—';
}

export function contextTagLabel(t: ContextTag): string {
  return CONTEXT_TAGS[t] ?? t;
}

export function symptomSummary(labels: string[], max = 3): string {
  if (labels.length <= max) return labels.join(', ');
  return `${labels.slice(0, max).join(', ')} +${labels.length - max}`;
}
