export type Intensity = 'low' | 'medium' | 'high';
export const INTENSITIES: Intensity[] = ['low', 'medium', 'high'];

export type AfterEffect = 'woke_fully' | 'stayed_asleep' | 'sleepy_confused' | 'other';
export type ContextTag = 'missed_medication' | 'illness_fever' | 'poor_sleep' | 'other';

export type IntensityGuide = Record<Intensity, string>;

export interface Synced {
  updated_at: string;        // ISO, set by the device on every change (LWW key)
  deleted_at: string | null; // soft delete
}

export interface Child extends Synced {
  id: string;
  owner_id: string;
  display_name: string;
  birth_year: number | null;
  medications_note: string | null;
  intensity_guide: IntensityGuide | null; // null = use DEFAULT_INTENSITY_GUIDE
  last_visit_date: string | null;         // 'YYYY-MM-DD', for the "since last visit" preset
  created_at: string;
}

export interface SeizureEvent extends Synced {
  id: string;
  child_id: string;
  occurred_at: string;
  intensity: Intensity;
  duration_seconds: number | null;
  after_effect: AfterEffect | null;
  notes: string | null;
  created_at: string;
}

export interface Symptom extends Synced {
  id: string;
  owner_id: string;
  label: string;
  is_default: boolean;
  created_at: string;
}

export interface EventSymptom extends Synced { event_id: string; symptom_id: string; }
export interface EventContextTag extends Synced { event_id: string; tag: ContextTag; }

export interface EventWithDetails extends SeizureEvent {
  symptoms: { id: string; label: string }[];
  context_tags: ContextTag[];
}

export interface WeekBucket { weekStart: string; low: number; medium: number; high: number; } // weekStart 'YYYY-MM-DD' (Monday, local)
export interface MonthBucket { month: string; low: number; medium: number; high: number; }    // 'YYYY-MM'

export interface ReportStats {
  total: number;
  byIntensity: Record<Intensity, number>;
  avgPerWeek: number;                 // total / max(1, weeks in range), 1 decimal
  longestDurationSeconds: number | null;
  weekly: WeekBucket[];               // every week overlapping the range, zeros included, ascending
  monthly: MonthBucket[];             // every month overlapping the range, ascending
  byHour: number[];                   // length 24, local hour of occurred_at
  topSymptoms: { label: string; count: number }[]; // descending count, then label
}

export type RangePreset = '30d' | '3m' | 'since_visit' | 'custom';
