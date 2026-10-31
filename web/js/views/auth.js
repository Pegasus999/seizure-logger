import { el, field, spinner } from "../ui.js";
import { T } from "../i18n.js";
import * as api from "../api.js";
import * as store from "../store.js";
import { navigate } from "../app.js";

export function render(root) {
  let creating = false, busy = false;
  const email = field({ label: T.email, type: "email", name: "email", autocomplete: "username", inputmode: "email", required: true, autocapitalize: "none", spellcheck: "false" });
  const pw = field({ label: T.password, type: "password", name: "password", minlength: 6, required: true });
  const err = el("div", { class: "err", role: "alert", hidden: true });
  const submit = el("button", { class: "btn primary block", type: "submit" });
  const toggle = el("button", { class: "btn ghost block", type: "button" });
  const hint = el("p", { class: "muted" });
  const sync = () => {
    pw.input.autocomplete = creating ? "new-password" : "current-password";
    submit.textContent = busy ? (creating ? T.create_busy : T.sign_in_busy) : (creating ? T.create_account : T.sign_in);
    toggle.textContent = creating ? T.auth_switch_to_signin : T.auth_switch_to_create;
    hint.textContent = creating ? T.auth_hint : "";
    hint.hidden = !creating;
    submit.disabled = toggle.disabled = busy;
  };
  const fail = (m) => { err.textContent = m; err.hidden = false; };

  const form = el("form", { class: "stack", novalidate: true,
    onsubmit: async (e) => {
      e.preventDefault();
      err.hidden = true;
      const em = email.input.value.trim(), p = pw.input.value;
      if (!em) return fail(T.email_required);
      if (p.length < 6) return fail(T.pw_min);
      busy = true; sync();
      const r = creating ? await api.signUp(em, p) : await api.signIn(em, p);
      if (r.error) { busy = false; sync(); return fail(r.error); }
      try {
        await store.init();
      } catch (ex) { busy = false; sync(); return fail(ex.message || T.err_generic); }
      navigate(store.state.child ? "home" : "profile");
    } },
    err, email.wrap, pw.wrap, hint, submit, toggle);
  toggle.addEventListener("click", () => { creating = !creating; err.hidden = true; sync(); });
  sync();
  root.append(el("h1", { text: T.app_name }), el("div", { class: "card" }, form));
}
