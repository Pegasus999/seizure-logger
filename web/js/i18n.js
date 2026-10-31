// Toutes les chaînes visibles (français). Source : glossaire-fr.md.
const NB = " "; // espace fine insécable avant ; ! ? (le deux-points prend une espace insécable normale)
export const T = {
  app_name: "Journal des crises",
  // navigation
  nav_home: "Accueil", nav_history: "Historique", nav_insights: "Analyses", nav_report: "Rapport", nav_settings: "Réglages",
  profile: "Profil", profile_setup: "Configuration du profil", profile_edit: "Modifier le profil",
  about: "À propos", event_details: "Détails de la crise", symptoms: "Symptômes", intensity_guide: "Guide des intensités",
  // auth
  sign_in: "Connexion", sign_in_busy: "Connexion…", create_account: "Créer un compte", create_busy: "Création…",
  email: "E-mail", password: "Mot de passe", sign_out: "Se déconnecter", delete_account: "Supprimer le compte",
  pw_min: "Le mot de passe doit contenir au moins 6 caractères.",
  auth_hint: "Première visite ? Saisissez votre e-mail et un mot de passe d'au moins 6 caractères, puis touchez « Créer un compte ».",
  auth_switch_to_create: "Pas encore de compte ? Créer un compte", auth_switch_to_signin: "Déjà un compte ? Connexion",
  email_required: "Saisissez votre adresse e-mail.",
  not_configured: "La synchronisation n'est pas configurée",
  not_configured_help: "Renseignez SUPABASE_URL et SUPABASE_ANON_KEY dans config.js.",
  // intensity / enums
  intensity: "Intensité", intensity_low: "Légère", intensity_medium: "Modérée", intensity_high: "Forte",
  after: "Après", after_effect: "Effet après la crise",
  after_woke_fully: "S'est complètement réveillé", after_stayed_asleep: "Est resté endormi",
  after_sleepy_confused: "Somnolent ou confus", after_other: "Autre",
  context: "Contexte",
  tag_missed_medication: "Médicament oublié", tag_illness_fever: "Maladie ou fièvre", tag_poor_sleep: "Mauvais sommeil", tag_other: "Autre",
  // event fields
  date: "Date", time: "Heure", duration: "Durée", notes: "Notes", add_symptom: "Ajouter un symptôme",
  delete: "Supprimer", save: "Enregistrer", save_start: "Enregistrer et commencer", cancel: "Annuler", undo: "Annuler",
  deleted: "Supprimée", saved: "Enregistré", confirm: "Confirmer", retry: "Réessayer", loading: "Chargement…",
  // profile fields
  display_name: "Prénom de l'enfant", birth_year: "Année de naissance", medications_note: "Traitement en cours",
  last_visit_date: "Date de la dernière consultation", optional: "facultatif",
  name_required: "Saisissez le prénom ou les initiales de l'enfant.",
  year_invalid: "L'année de naissance doit être comprise entre 1990 et 2100.",
  profile_saved: "Profil enregistré",
  profile_setup_intro: "Pour commencer, indiquez le prénom ou les initiales de votre enfant. Le reste est facultatif.",
  // periods
  all: "Tout", last_7d: "7 derniers jours", last_30d: "30 derniers jours", last_3m: "3 derniers mois",
  last_4w: "4 dernières semaines", last_12m: "12 derniers mois", since_visit: "Depuis la dernière consultation",
  custom: "Personnalisé", from: "Du", to: "Au",
  // stats / report
  total: "Total", avg_per_week: "Moyenne par semaine", longest: "Durée la plus longue",
  per_week: "Crises par semaine", per_month: "Crises par mois", detailed_log: "Journal détaillé",
  top_symptoms: "Symptômes les plus fréquents", intensity_defs: "Définitions d'intensité utilisées",
  hour_of_night: "Heure de la nuit", generated: "Généré le", period: "Période", no_data: "Aucune donnée pour le moment",
  gen_pdf: "Générer le PDF", preview_print: "Aperçu / imprimer", export_csv: "Exporter en CSV", export_all_csv: "Exporter tout en CSV",
  // settings
  night_mode: "Mode nuit", app_lock: "Verrouillage de l'application", weekly_reminder: "Rappel hebdomadaire",
  sync_status: "État de la synchronisation", sync_now: "Synchroniser maintenant",
  synced: "Synchronisé", pending: "En attente", offline: "Hors ligne",
  // about
  about_important: "Avertissement", about_privacy: "Confidentialité", about_what: "Ce qu'est cette application",
  about_what_text: "Journal des crises n'est pas un dispositif médical. Il enregistre ce que vous observez et prépare un rapport pour le médecin.",
  version: "Version",
  disclaimer: "Cette application est un outil de suivi personnel. Elle ne fournit ni conseil médical ni diagnostic. Si une crise dure plus de cinq minutes, ou si l'enfant est blessé ou ne récupère pas, appelez les secours.",
  privacy: "Journal des crises enregistre le prénom ou les initiales de votre enfant, une année de naissance et une note sur le traitement (facultatives), ainsi que les crises et les détails que vous saisissez. Ces informations sont conservées dans la base de données Supabase privée de votre famille, protégée de sorte que seul votre compte puisse la lire. Rien n'est partagé avec qui que ce soit, sauf si vous choisissez d'exporter un rapport. Vous pouvez tout supprimer à tout moment depuis les Réglages.",
  report_footer: "Journal tenu par un proche aidant. Il ne s'agit pas d'un dossier médical.",
  // errors (jamais d'anglais brut)
  err_network: "Impossible de joindre le serveur. Vérifiez votre connexion Internet et réessayez.",
  err_generic: "Une erreur est survenue. Réessayez dans un instant.",
  err_server: "Le serveur rencontre un problème. Réessayez dans un instant.",
  err_session: "Votre session a expiré. Veuillez vous reconnecter.",
  err_forbidden: "Cette action n'est pas autorisée.",
  err_bad_credentials: "E-mail ou mot de passe incorrect.",
  err_exists: "Un compte existe déjà avec cet e-mail. Utilisez « Connexion ».",
  err_weak: "Le mot de passe est trop faible. Choisissez-en un plus long.",
  err_email: "Cette adresse e-mail n'est pas valide.",
  err_rate: "Trop de tentatives. Patientez un instant avant de réessayer.",
  err_signup_closed: "La création de compte n'est pas disponible pour le moment.",
  err_confirm_needed: "Compte créé. Confirmez votre adresse e-mail puis connectez-vous.",
  err_dropped: "Modification non enregistrée : une version plus récente existe déjà. Rechargez la page.",
  err_view: "Impossible d'afficher cet écran.",
  err_no_child: "Aucun profil enfant n'est configuré.",
  err_not_found: "Crise introuvable.",
};
export const INTENSITY_LABEL = { low: T.intensity_low, medium: T.intensity_medium, high: T.intensity_high };
export const INTENSITY_COLOR = { low: "#4C8DD6", medium: "#D9A441", high: "#D0566B" };
export const INTENSITY_DIM = { low: "#22303F", medium: "#3A3222", high: "#3A232A" };
export const INTENSITY_GLYPH = { low: "●", medium: "▲", high: "■" };
export const AFTER_EFFECTS = { woke_fully: T.after_woke_fully, stayed_asleep: T.after_stayed_asleep, sleepy_confused: T.after_sleepy_confused, other: T.after_other };
export const CONTEXT_TAGS = { missed_medication: T.tag_missed_medication, illness_fever: T.tag_illness_fever, poor_sleep: T.tag_poor_sleep, other: T.tag_other };
export const DEFAULT_INTENSITY_GUIDE = {
  low: "Mouvements ou sons brefs et légers, l'enfant reste endormi.",
  medium: "Mouvements ou raidissement notables, réveil parfois partiel.",
  high: "Convulsions fortes, raidissement, réveil, regard fixe ou absence de réaction.",
};
export const DEFAULT_SYMPTOMS = [
  "Secousses", "Mâchoires serrées", "Raidissement", "Réveil avec regard fixe", "Absence de réaction", "Yeux révulsés",
  "Bave", "Cris ou vocalisations", "Perte d'urine", "Changements de respiration", "Changement de couleur (pâle ou bleuâtre)",
];
export const DURATION_PRESETS = [
  { label: "Moins de 30 s", seconds: 20 }, { label: "30 s – 1 min", seconds: 45 }, { label: "1 – 2 min", seconds: 90 },
  { label: "2 – 5 min", seconds: 210 }, { label: "Plus de 5 min", seconds: 330 },
];
export const UNDO_WINDOW_MS = 10000;
/** Pluriel français : zéro est singulier. plural(0,"crise") -> "0 crise", plural(2,"crise") -> "2 crises". */
export function plural(n, word, pluralWord) { return `${n} ${n > 1 ? (pluralWord || word + "s") : word}`; }
/** "Période : x" avec espace insécable avant le deux-points. */
export function colon(label, value) { return `${label} : ${value}`; }
export { NB };
