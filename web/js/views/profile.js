import { el, field, toast } from "../ui.js";
import { T, DEFAULT_INTENSITY_GUIDE } from "../i18n.js";
import * as store from "../store.js";
import { navigate } from "../app.js";

const INT = ["low", "medium", "high"];

export function render(root) {
  const c = store.state.child;
  const setup = !c;
  const guide = Object.assign({}, DEFAULT_INTENSITY_GUIDE, (c && c.intensity_guide) || {});
  const name = field({ label: T.display_name, name: "display_name", value: c ? c.display_name : "", maxlength: 60, required: true, autocomplete: "off" });
  const year = field({ label: `${T.birth_year} (${T.optional})`, type: "number", name: "birth_year", value: c && c.birth_year ? c.birth_year : "", min: 1990, max: 2100, inputmode: "numeric" });
  const meds = field({ label: `${T.medications_note} (${T.optional})`, type: "textarea", value: c ? c.medications_note || "" : "" });
  const visit = field({ label: `${T.last_visit_date} (${T.optional})`, type: "date", value: c ? c.last_visit_date || "" : "" });
  const gf = INT.map((k) => field({ label: T["intensity_" + k], type: "textarea", value: guide[k] }));
  const err = el("div", { class: "err", role: "alert", hidden: true });
  const save = el("button", { class: "btn primary block", type: "submit", text: setup ? T.save_start : T.save });
  const fail = (m) => { err.textContent = m; err.hidden = false; };

  const form = el("form", { class: "stack", novalidate: true,
    onsubmit: async (e) => {
      e.preventDefault(); err.hidden = true;
      const dn = name.input.value.trim();
      if (!dn) return fail(T.name_required);
      const y = year.input.value.trim();
      if (y && !(Number(y) >= 1990 && Number(y) <= 2100)) return fail(T.year_invalid);
      const g = {}; INT.forEach((k, i) => { g[k] = gf[i].input.value.trim() || DEFAULT_INTENSITY_GUIDE[k]; });
      const isDefault = INT.every((k) => g[k] === DEFAULT_INTENSITY_GUIDE[k]);
      save.disabled = true;
      try {
        await store.saveChild({
          display_name: dn, birth_year: y ? Number(y) : null,
          medications_note: meds.input.value.trim() || null,
          last_visit_date: visit.input.value || null,
          intensity_guide: isDefault ? null : g,
        });
      } catch (ex) { save.disabled = false; return fail(ex.message || T.err_generic); }
      save.disabled = false;
      if (setup) navigate("home"); else toast(T.profile_saved);
    } },
    err, name.wrap, year.wrap, meds.wrap, visit.wrap,
    el("h2", { text: T.intensity_guide }), ...gf.map((f) => f.wrap), save);

  root.append(el("h1", { text: setup ? T.profile_setup : T.profile_edit }),
    setup ? el("p", { class: "muted", text: T.profile_setup_intro }) : null,
    el("div", { class: "card" }, form));
}
