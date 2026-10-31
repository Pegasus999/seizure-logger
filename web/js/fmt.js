// Formatage fr-FR : dates, heures (24 h), durées, nombres.
const L = "fr-FR";
const pad = (n) => (n < 10 ? "0" + n : String(n));
const toDate = (d) => (d instanceof Date ? d : new Date(d));
const fDate = new Intl.DateTimeFormat(L, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
const fTime = new Intl.DateTimeFormat(L, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

export function formatDate(d) { return fDate.format(toDate(d)); }
export function formatTime(d) { return fTime.format(toDate(d)); }
export function formatDateTime(d) { return `${formatDate(d)} à ${formatTime(d)}`; }
export function formatDayHeading(d) {
  const x = toDate(d), now = new Date();
  if (dayKey(x) === dayKey(now)) return "Aujourd'hui";
  if (dayKey(x) === dayKey(addDays(now, -1))) return "Hier";
  return formatDate(x);
}
export function formatDuration(s) {
  if (s === null || s === undefined || Number.isNaN(Number(s))) return "—";
  s = Math.round(Number(s));
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60), r = s % 60;
  return r ? `${m} min ${r} s` : `${m} min`;
}
export function formatNumber(n) { return Number(n).toLocaleString(L); }
export function dayKey(d) { d = toDate(d); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
export function monthKey(d) { d = toDate(d); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; }
/** Lundi 00:00 local. */
export function startOfWeek(d) {
  d = toDate(d);
  const dow = (d.getDay() + 6) % 7;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - dow, 0, 0, 0, 0);
}
// Extras (non prévus au contrat, utiles aux vues)
export function addDays(d, n) { d = toDate(d); return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, d.getHours(), d.getMinutes(), d.getSeconds(), d.getMilliseconds()); }
export function startOfDay(d) { d = toDate(d); return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
export function endOfDay(d) { d = toDate(d); return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999); }
/** 'YYYY-MM-DD' -> Date locale, ou null. */
export function parseLocalDate(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s || "");
  if (!m) return null;
  const d = new Date(+m[1], +m[2] - 1, +m[3]);
  return Number.isNaN(d.getTime()) ? null : d;
}
/** Date -> valeur pour <input type="datetime-local"> (heure locale). */
export function toLocalInput(d) { d = toDate(d); return `${dayKey(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`; }
export function shortDay(d) { return toDate(d).toLocaleDateString(L, { day: "numeric", month: "short" }); }
export function shortMonth(d) { return toDate(d).toLocaleDateString(L, { month: "short", year: "numeric" }); }
