// Authentification Supabase (e-mail + mot de passe) et REST via fetch. Aucune autre requête réseau.
import { T } from "./i18n.js";

const KEY = "sl.session";
const url = () => String(window.SUPABASE_URL || "").replace(/\/+$/, "");
const anon = () => window.SUPABASE_ANON_KEY || "";
export const isConfigured = () => !!(url() && anon());

export class ApiError extends Error {
  constructor(message, status = 0, detail = null) { super(message); this.name = "ApiError"; this.status = status; this.detail = detail; }
}

let session = null;
try { session = JSON.parse(localStorage.getItem(KEY) || "null"); } catch { session = null; }
const listeners = new Set();

export function getSession() { return session; }
export function setSession(s) {
  session = s || null;
  try { session ? localStorage.setItem(KEY, JSON.stringify(session)) : localStorage.removeItem(KEY); } catch { /* stockage indisponible */ }
  listeners.forEach((cb) => cb(session));
}
/** Extra : abonnement aux changements de session. */
export function onSessionChange(cb) { listeners.add(cb); return () => listeners.delete(cb); }

async function http(u, init) {
  try { return await fetch(u, init); } catch { throw new ApiError(T.err_network, 0); }
}
async function parse(res) {
  const t = await res.text();
  if (!t) return null;
  try { return JSON.parse(t); } catch { return t; }
}
const toSession = (b) => ({
  access_token: b.access_token, refresh_token: b.refresh_token, user: b.user,
  expires_at: b.expires_at || Math.floor(Date.now() / 1000) + (b.expires_in || 3600),
});
function authMessage(res, b) {
  const code = (b && (b.error_code || b.code)) || "";
  const msg = String((b && (b.msg || b.message || b.error_description || b.error)) || "");
  if (res.status === 429 || code === "over_request_rate_limit" || code === "over_email_send_rate_limit") return T.err_rate;
  if (code === "invalid_credentials" || /invalid login/i.test(msg)) return T.err_bad_credentials;
  if (code === "user_already_exists" || /already (registered|exists)/i.test(msg)) return T.err_exists;
  if (code === "weak_password" || /password/i.test(msg) && /(short|least|weak|characters)/i.test(msg)) return T.err_weak;
  if (code === "email_address_invalid" || /email.*invalid|invalid.*email/i.test(msg)) return T.err_email;
  if (code === "signup_disabled") return T.err_signup_closed;
  if (res.status >= 500) return T.err_server;
  return T.err_generic;
}
async function authPost(path, payload) {
  const res = await http(`${url()}/auth/v1/${path}`, {
    method: "POST", headers: { apikey: anon(), "Content-Type": "application/json" }, body: JSON.stringify(payload),
  });
  return { res, body: await parse(res) };
}

export async function signIn(email, password) {
  if (!isConfigured()) return { error: T.not_configured };
  try {
    const { res, body } = await authPost("token?grant_type=password", { email, password });
    if (!res.ok || !body || !body.access_token) return { error: authMessage(res, body) };
    setSession(toSession(body));
    return {};
  } catch (e) { return { error: e.message }; }
}
export async function signUp(email, password) {
  if (!isConfigured()) return { error: T.not_configured };
  try {
    const { res, body } = await authPost("signup", { email, password });
    if (!res.ok) return { error: authMessage(res, body) };
    if (body && body.access_token) { setSession(toSession(body)); return {}; }
    return { error: T.err_confirm_needed }; // confirmation activée côté serveur : pas de session immédiate
  } catch (e) { return { error: e.message }; }
}
export async function signOut() {
  const s = session;
  if (s && isConfigured()) {
    try {
      await fetch(`${url()}/auth/v1/logout`, { method: "POST", headers: { apikey: anon(), Authorization: `Bearer ${s.access_token}` } });
    } catch { /* hors ligne : on déconnecte quand même localement */ }
  }
  setSession(null);
  return {};
}

let inflight = null;
/** true si la session est (ou reste) valide. Faux sans effacer la session en cas d'échec réseau. */
export function refresh() {
  if (inflight) return inflight;
  inflight = (async () => {
    if (!session || !session.refresh_token) return false;
    try {
      const { res, body } = await authPost("token?grant_type=refresh_token", { refresh_token: session.refresh_token });
      if (res.ok && body && body.access_token) { setSession(toSession(body)); return true; }
      if (res.status >= 400 && res.status < 500) setSession(null); // refresh refusé : session morte
      return false;
    } catch { return false; }
  })().finally(() => { inflight = null; });
  return inflight;
}

function restMessage(status) {
  if (status === 401) return T.err_session;
  if (status === 403) return T.err_forbidden;
  if (status >= 500) return T.err_server;
  return T.err_generic;
}
/** rest('GET'|'POST'|'PATCH'|..., 'table?select=*', body, {upsert, prefer, headers}) */
export async function rest(method, path, body, opts = {}) {
  return call(`${url()}/rest/v1/${path}`, method, body, opts);
}
export async function rpc(name, args) {
  return call(`${url()}/rest/v1/rpc/${name}`, "POST", args || {}, {});
}
async function call(u, method, body, opts) {
  if (!isConfigured()) throw new ApiError(T.not_configured, 0);
  const m = method.toUpperCase();
  const send = () => {
    const h = { apikey: anon(), Authorization: `Bearer ${session ? session.access_token : ""}`, "Content-Type": "application/json", ...(opts.headers || {}) };
    if (m !== "GET" && m !== "HEAD") h.Prefer = opts.prefer || (opts.upsert ? "resolution=merge-duplicates,return=representation" : "return=representation");
    return http(u, { method: m, headers: h, body: body === undefined ? undefined : JSON.stringify(body) });
  };
  let res = await send();
  if (res.status === 401) {
    if (await refresh()) res = await send();
  }
  const data = await parse(res);
  if (!res.ok) throw new ApiError(restMessage(res.status), res.status, data);
  return data;
}
