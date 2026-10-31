// Réglages : port adapté de SettingsScreen / SymptomsScreen / IntensityGuideScreen.
// Omis volontairement (sans objet sur le web) : mode nuit, verrouillage biométrique, rappel hebdomadaire, état de synchronisation.
import { el, field, toast, confirmDialog } from "../ui.js";
import { T, INTENSITY_LABEL, INTENSITY_GLYPH, DEFAULT_INTENSITY_GUIDE } from "../i18n.js";
import * as store from "../store.js";
import * as api from "../api.js";
import { dayKey } from "../fmt.js";
import { buildCsv, downloadCsv, symptomLabels } from "./report.js";

const INT = ["low", "medium", "high"];
const S = {
  child: "Enfant", guide: T.intensity_guide, guide_intro: "Rédigez-les avec vos propres mots et relisez-les avec le médecin, pour que les crises soient notées de façon cohérente. L'application ne détermine pas la gravité.",
  guide_label: (k) => `Définition de l'intensité ${INTENSITY_LABEL[k].toLowerCase()}`, reset: "Rétablir les définitions suggérées", guide_saved: "Guide des intensités enregistré", guide_reset: "Définitions suggérées rétablies",
  symptoms: T.symptoms, new_sym: "Nouveau symptôme", add: "Ajouter", default_tag: "Par défaut",
  sym_note: "Supprimer un symptôme le conserve sur les crises passées.", sym_exists: "Ce symptôme existe déjà.", sym_added: "Symptôme ajouté", sym_deleted: "Symptôme supprimé",
  sym_del_q: (l) => `Supprimer « ${l} » ?`, sym_del_body: "Il reste affiché sur les crises passées qui l'utilisent.",
  data: "Données", sync: "Synchronisation", sync_text: "Cette page lit et écrit directement dans votre base en ligne : rien n'est mis en attente, il n'y a donc rien à synchroniser.",
  account: "Compte", signed_as: "Connecté en tant que", edit_profile: "Modifier le profil", about: "Confidentialité et à propos",
  export_done: "Fichier CSV téléchargé", export_fail: "Export impossible. Réessayez.",
  del_btn: "Supprimer le compte et toutes les données", del_title: "Supprimer le compte et toutes les données ?",
  del_body: "Cela supprime définitivement votre compte et toutes les crises, les symptômes et le profil de l'enfant. Les données sont détruites et ne pourront pas être récupérées.",
  del_title2: "En êtes-vous sûr ?", del_body2: "Cette action est irréversible. Si vous voulez conserver une copie, exportez d'abord tout en CSV.",
  del_cont: "Continuer", del_all: "Tout supprimer", del_fail: "Suppression impossible. Réessayez dans un instant.",
  signout_q: "Se déconnecter ?", signout_body: "Vos crises restent enregistrées dans votre compte. Vous pourrez vous reconnecter à tout moment.",
};
const errMsg = (e) => (e instanceof api.ApiError ? e.message : T.err_generic);
const section = (id, title, ...kids) => el("section", { class: "card stack", "aria-labelledby": id }, el("h2", { id, text: title }), ...kids);

export function render(root) {
  const child = store.state.child;

  /* --- Guide des intensités --- */
  const gErr = el("div", { class: "err", role: "alert", hidden: true });
  const guideNow = () => Object.assign({}, DEFAULT_INTENSITY_GUIDE, store.state.child.intensity_guide || {});
  const gf = INT.map((k) => {
    const f = field({ label: S.guide_label(k), type: "textarea", value: guideNow()[k], maxlength: 500 });
    return { k, ...f };
  });
  const gSave = el("button", { class: "btn primary block", type: "submit", text: T.save });
  const gReset = el("button", { class: "btn block", type: "button", text: S.reset });
  async function saveGuide(value, msg) {
    gErr.hidden = true; gSave.disabled = gReset.disabled = true;
    try {
      await store.saveChild({ intensity_guide: value });
      const g = guideNow(); gf.forEach((f) => { f.input.value = g[f.k]; });
      toast(msg);
    } catch (e) { gErr.textContent = errMsg(e); gErr.hidden = false; }
    finally { gSave.disabled = gReset.disabled = false; }
  }
  const guideForm = el("form", { class: "stack", onsubmit: (e) => {
    e.preventDefault();
    const g = {}; gf.forEach((f) => { g[f.k] = f.input.value.trim() || DEFAULT_INTENSITY_GUIDE[f.k]; });
    saveGuide(g, S.guide_saved);
  } }, gErr,
  gf.map((f) => el("div", { class: "stack" }, el("span", { class: "badge " + f.k, text: `${INTENSITY_GLYPH[f.k]} ${INTENSITY_LABEL[f.k]}` }), f.wrap)), gSave, gReset);
  gReset.addEventListener("click", () => saveGuide(null, S.guide_reset));

  /* --- Symptômes --- */
  const sErr = el("div", { class: "err", role: "alert", hidden: true });
  const sList = el("ul", { class: "list sym-list" });
  const nf = field({ label: S.new_sym, name: "symptom", maxlength: 60, autocomplete: "off" });
  const addBtn = el("button", { class: "btn", type: "submit", text: S.add });
  function drawSymptoms() {
    sList.replaceChildren(...store.state.symptoms.map((x) => el("li", { class: "sym-item" },
      el("span", { class: "grow", text: x.label }),
      x.is_default ? el("span", { class: "muted small", text: S.default_tag })
        : el("button", { class: "btn ghost", type: "button", text: T.delete, "aria-label": `${T.delete} ${x.label}`, onclick: async () => {
          if (!(await confirmDialog(`${S.sym_del_q(x.label)} ${S.sym_del_body}`, { ok: T.delete, danger: true }))) return;
          try { sErr.hidden = true; await store.deleteSymptom(x.id); toast(S.sym_deleted); }
          catch (e) { sErr.textContent = errMsg(e); sErr.hidden = false; }
        } }))));
  }
  const symForm = el("form", { class: "row sym-add", onsubmit: async (e) => {
    e.preventDefault(); sErr.hidden = true;
    const l = nf.input.value.trim();
    if (!l) { nf.input.focus(); return; }
    if (store.state.symptoms.some((x) => x.label.toLowerCase() === l.toLowerCase())) { sErr.textContent = S.sym_exists; sErr.hidden = false; return; }
    addBtn.disabled = true;
    try { await store.addSymptom(l); nf.input.value = ""; toast(S.sym_added); nf.input.focus(); }
    catch (ex) { sErr.textContent = errMsg(ex); sErr.hidden = false; }
    finally { addBtn.disabled = false; }
  } }, el("div", { class: "grow" }, nf.wrap), addBtn);

  /* --- Données --- */
  const dErr = el("div", { class: "err", role: "alert", hidden: true });
  const expBtn = el("button", { class: "btn block", type: "button", text: T.export_all_csv, onclick: async () => {
    dErr.hidden = true; expBtn.disabled = true;
    try {
      const labels = await symptomLabels();
      downloadCsv(buildCsv(store.state.events, labels), `journal-des-crises_tout_${dayKey(new Date())}.csv`);
      toast(S.export_done);
    } catch { dErr.textContent = S.export_fail; dErr.hidden = false; }
    finally { expBtn.disabled = false; }
  } });

  /* --- Compte --- */
  const aErr = el("div", { class: "err", role: "alert", hidden: true });
  const outBtn = el("button", { class: "btn block", type: "button", text: T.sign_out, onclick: async () => {
    if (await confirmDialog(`${S.signout_q} ${S.signout_body}`, { ok: T.sign_out })) await api.signOut();
  } });
  const delBtn = el("button", { class: "btn danger block", type: "button", text: S.del_btn, onclick: async () => {
    aErr.hidden = true;
    if (!(await confirmDialog(`${S.del_title} ${S.del_body}`, { ok: S.del_cont, danger: true }))) return;
    if (!(await confirmDialog(`${S.del_title2} ${S.del_body2}`, { ok: S.del_all, danger: true }))) return;
    delBtn.disabled = true;
    try { await store.deleteAccount(); }
    catch (e) { delBtn.disabled = false; aErr.textContent = e instanceof api.ApiError ? `${S.del_fail} ${e.message}` : S.del_fail; aErr.hidden = false; }
  } });
  const email = store.state.user && store.state.user.email;

  const stop = store.onChange(() => { if (!root.isConnected) return stop(); drawSymptoms(); });
  drawSymptoms();

  root.append(el("h1", { text: T.nav_settings }),
    section("st-c", S.child,
      el("p", { text: child ? child.display_name : "", class: "big" }),
      el("div", { class: "row" }, el("a", { class: "btn grow", href: "#/profil", text: S.edit_profile }), el("a", { class: "btn grow", href: "#/apropos", text: S.about }))),
    section("st-g", S.guide, el("p", { class: "muted", text: S.guide_intro }), guideForm),
    section("st-s", S.symptoms, sErr, symForm, sList, el("p", { class: "muted small", text: S.sym_note })),
    section("st-d", S.data, dErr, expBtn),
    section("st-y", S.sync, el("p", { class: "muted", text: S.sync_text })),
    section("st-a", S.account, aErr, email ? el("p", {}, `${S.signed_as} `, el("strong", { text: email })) : null, outBtn),
    el("section", { class: "card danger stack", "aria-labelledby": "st-x" }, el("h2", { id: "st-x", text: T.delete_account }), el("p", { class: "muted", text: S.del_body }), delBtn));
}
