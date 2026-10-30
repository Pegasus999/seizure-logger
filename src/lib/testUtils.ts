import type { EventWithDetails, Intensity } from '../types';

export function ev(
  id: string,
  at: Date,
  intensity: Intensity = 'low',
  extra: Partial<EventWithDetails> = {},
): EventWithDetails {
  return {
    id,
    child_id: 'c',
    occurred_at: at.toISOString(),
    intensity,
    duration_seconds: null,
    after_effect: null,
    notes: null,
    created_at: at.toISOString(),
    updated_at: at.toISOString(),
    deleted_at: null,
    symptoms: [],
    context_tags: [],
    ...extra,
  };
}
