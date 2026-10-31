import type { AfterEffect, ContextTag, Intensity, IntensityGuide } from './types';

export const DEFAULT_SYMPTOMS: string[] = [
  'Secousses',
  'Mâchoires serrées',
  'Raidissement',
  'Réveil avec regard fixe',
  'Absence de réaction',
  'Yeux révulsés',
  'Bave',
  'Cris ou vocalisations',
  'Perte d\'urine',
  'Changements de respiration',
  'Changement de couleur (pâle ou bleuâtre)',
];

export const DURATION_PRESETS: { label: string; seconds: number }[] = [
  { label: 'Moins de 30 s', seconds: 20 },
  { label: '30 s – 1 min', seconds: 45 },
  { label: '1 – 2 min', seconds: 90 },
  { label: '2 – 5 min', seconds: 210 },
  { label: 'Plus de 5 min', seconds: 330 },
];

export const AFTER_EFFECTS: Record<AfterEffect, string> = {
  woke_fully: 'S\'est complètement réveillé',
  stayed_asleep: 'Est resté endormi',
  sleepy_confused: 'Somnolent ou confus',
  other: 'Autre',
};

export const CONTEXT_TAGS: Record<ContextTag, string> = {
  missed_medication: 'Médicament oublié',
  illness_fever: 'Maladie ou fièvre',
  poor_sleep: 'Mauvais sommeil',
  other: 'Autre',
};

export const DEFAULT_INTENSITY_GUIDE: IntensityGuide = {
  low: 'Mouvements ou sons brefs et légers, l\'enfant reste endormi.',
  medium: 'Mouvements ou raidissement notables, réveil parfois partiel.',
  high: 'Convulsions fortes, raidissement, réveil, regard fixe ou absence de réaction.',
};

export const INTENSITY_META: Record<
  Intensity,
  { label: string; color: string; dimColor: string; glyph: string }
> = {
  low: { label: 'Légère', color: '#4C8DD6', dimColor: '#22303F', glyph: '●' },
  medium: { label: 'Modérée', color: '#D9A441', dimColor: '#3A3222', glyph: '▲' },
  high: { label: 'Forte', color: '#D0566B', dimColor: '#3A232A', glyph: '■' },
};

export const UNDO_WINDOW_MS = 10_000;

export const EMERGENCY_DISCLAIMER =
  'Cette application est un outil de suivi personnel. Elle ne fournit ni conseil médical ni diagnostic. Si une crise dure plus de cinq minutes, ou si l\'enfant est blessé ou ne récupère pas, appelez les secours.';

export const REPORT_FOOTER = 'Journal tenu par un proche aidant. Il ne s\'agit pas d\'un dossier médical.';

export const PRIVACY_NOTE =
  "Journal des crises enregistre le prénom ou les initiales de votre enfant, une année de naissance et une note sur le traitement (facultatives), ainsi que les crises et les détails que vous saisissez. Ces informations sont conservées sur ce téléphone et dans la base de données Supabase privée de votre famille, protégée de sorte que seul votre compte puisse la lire. Rien n'est partagé avec qui que ce soit, sauf si vous choisissez d'exporter un rapport. Vous pouvez tout supprimer à tout moment depuis les Réglages.";
