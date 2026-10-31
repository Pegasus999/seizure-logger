// Petits utilitaires DOM. Pas de framework.
import { T } from "./i18n.js";

export function el(tag, props, ...children) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k === "class") n.className = v;
    else if (k === "text") n.textContent = v;
    else if (k === "html") n.innerHTML = v;
    else if (k === "style" && typeof v === "object") Object.assign(n.style, v);
    else if (k === "value") n.value = v;
    else if (k === "checked" || k === "disabled" || k === "selected") n[k] = !!v;
    else if (k.startsWith("on") && typeof v === "function") n.addEventListener(k.slice(2).toLowerCase(), v);
    else n.setAttribute(k, v === true ? "" : v);
  }
  for (const c of children.flat(Infinity)) {
    if (c === null || c === undefined || c === false) continue;
    n.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return n;
}

export function clear(node) { node.replaceChildren(); return node; }

let host;
function toastHost() {
  if (!host || !host.isConnected) { host = el("div", { class: "toast-host", "aria-live": "polite" }); document.body.append(host); }
  return host;
}
/** toast(message, {action, onAction, ms}) -> fonction de fermeture. */
export function toast(message, { action, onAction, ms = 4000 } = {}) {
  let timer;
  const close = () => { clearTimeout(timer); t.remove(); };
  const t = el("div", { class: "toast", role: "status" }, el("span", { text: message }),
    action ? el("button", { class: "btn ghost", type: "button", text: action, onclick: () => { close(); if (onAction) onAction(); } }) : null);
  toastHost().append(t);
  timer = setTimeout(close, ms);
  return close;
}

export function confirmDialog(message, { ok = T.confirm, cancel = T.cancel, danger = false } = {}) {
  return new Promise((resolve) => {
    const prev = document.activeElement;
    const done = (v) => { ov.remove(); document.removeEventListener("keydown", onKey); if (prev && prev.focus) prev.focus(); resolve(v); };
    const onKey = (e) => { if (e.key === "Escape") done(false); };
    const okBtn = el("button", { class: "btn " + (danger ? "danger" : "primary"), type: "button", text: ok, onclick: () => done(true) });
    const ov = el("div", { class: "overlay", onclick: (e) => { if (e.target === ov) done(false); } },
      el("div", { class: "dialog", role: "alertdialog", "aria-modal": "true" },
        el("p", { class: "big", text: message }),
        el("div", { class: "row" }, el("button", { class: "btn ghost", type: "button", text: cancel, onclick: () => done(false) }), okBtn)));
    document.body.append(ov);
    document.addEventListener("keydown", onKey);
    okBtn.focus();
  });
}

let uid = 0;
/** field({label, type, value, oninput, hint, options, ...attrs}) -> {wrap, input}. type: text|email|password|number|date|datetime-local|textarea|select */
export function field({ label, type = "text", value, oninput, hint, options, ...attrs } = {}) {
  const id = attrs.id || "f" + ++uid;
  let input;
  if (type === "textarea") input = el("textarea", { id, ...attrs });
  else if (type === "select") {
    input = el("select", { id, ...attrs }, (options || []).map((o) => el("option", { value: o.value, text: o.label })));
  } else input = el("input", { id, type, ...attrs });
  if (value !== undefined && value !== null) input.value = value;
  if (oninput) input.addEventListener("input", oninput);
  const wrap = el("div", { class: "field" }, label ? el("label", { for: id, text: label }) : null, input, hint ? el("div", { class: "hint", text: hint }) : null);
  return { wrap, input };
}

export function chip({ label, selected = false, onclick } = {}) {
  const b = el("button", { class: "chip", type: "button", text: label, "aria-pressed": String(!!selected) });
  b.addEventListener("click", (e) => { if (onclick) onclick(e); });
  return b;
}

export function spinner() { return el("div", { class: "spinner", role: "status", "aria-label": T.loading }); }
