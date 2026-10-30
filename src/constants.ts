import type { AfterEffect, ContextTag, Intensity, IntensityGuide } from './types';

export const DEFAULT_SYMPTOMS: string[] = [
  'Jerking',
  'Teeth clenching',
  'Stiffening',
  'Woke up and staring',
  'Unresponsive',
  'Eyes rolling',
  'Drooling',
  'Vocalizing or crying out',
  'Loss of bladder control',
  'Breathing changes',
  'Color change (pale or bluish)',
];

export const DURATION_PRESETS: { label: string; seconds: number }[] = [
  { label: 'Under 30 sec', seconds: 20 },
  { label: '30 sec – 1 min', seconds: 45 },
  { label: '1 – 2 min', seconds: 90 },
  { label: '2 – 5 min', seconds: 210 },
  { label: 'Over 5 min', seconds: 330 },
];

export const AFTER_EFFECTS: Record<AfterEffect, string> = {
  woke_fully: 'Woke up fully',
  stayed_asleep: 'Stayed asleep',
  sleepy_confused: 'Sleepy or confused',
  other: 'Other',
};

export const CONTEXT_TAGS: Record<ContextTag, string> = {
  missed_medication: 'Missed medication',
  illness_fever: 'Illness or fever',
  poor_sleep: 'Poor sleep earlier',
  other: 'Other',
};

export const DEFAULT_INTENSITY_GUIDE: IntensityGuide = {
  low: 'Brief, mild movement or sounds, child stays asleep.',
  medium: 'Noticeable movement or stiffening, may partially wake.',
  high: 'Strong convulsive movement, stiffening, waking, staring, or unresponsiveness.',
};

export const INTENSITY_META: Record<
  Intensity,
  { label: string; color: string; dimColor: string; glyph: string }
> = {
  low: { label: 'Low', color: '#4C8DD6', dimColor: '#22303F', glyph: '●' },
  medium: { label: 'Medium', color: '#D9A441', dimColor: '#3A3222', glyph: '▲' },
  high: { label: 'High', color: '#D0566B', dimColor: '#3A232A', glyph: '■' },
};

export const UNDO_WINDOW_MS = 10_000;

export const EMERGENCY_DISCLAIMER =
  'This app is a personal logging tool. It does not provide medical advice or diagnosis. If a seizure lasts more than five minutes, or the child is hurt or not recovering, seek emergency care.';

export const REPORT_FOOTER = 'Caregiver-recorded log. Not a medical record.';

export const PRIVACY_NOTE =
  "Seizure Log stores your child's display name or initials, an optional birth year and medication note, and the seizure entries and details you record. This information is kept on this phone and in your family's private Supabase database, which is protected so that only your account can read it. Nothing is shared with anyone unless you choose to export a report. You can delete everything at any time from Settings.";
