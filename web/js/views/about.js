import { el } from "../ui.js";
import { T } from "../i18n.js";

const VERSION = "1.0.0";

export function render(root) {
  root.append(
    el("h1", { text: T.app_name }),
    el("p", { class: "muted", text: `${T.version} ${VERSION}` }),
    el("section", { class: "card danger" }, el("h2", { text: T.about_important }), el("p", { class: "big", text: T.disclaimer })),
    el("section", { class: "card" }, el("h2", { text: T.about_privacy }), el("p", { text: T.privacy })),
    el("section", { class: "card" }, el("h2", { text: T.about_what }), el("p", { text: T.about_what_text })));
}
