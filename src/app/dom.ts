/**
 * A few small DOM helpers. Controls are built once and updated in place rather than
 * re-rendered: re-creating the search box on every keystroke would drop focus and caret
 * position while someone is typing.
 */
import type { Strings } from "./strings";

type Attrs = Record<string, string | boolean | number | EventListener | undefined>;
export type Child = Node | string | null | undefined | false;

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined || value === false) continue;
    if (key.startsWith("on") && typeof value === "function") {
      el.addEventListener(key.slice(2), value);
    } else if (key === "class") {
      el.className = String(value);
    } else if (value === true) {
      el.setAttribute(key, "");
    } else {
      el.setAttribute(key, String(value));
    }
  }
  append(el, children);
  return el;
}

export function append(el: Element, children: Child[]): void {
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    el.append(typeof c === "string" ? document.createTextNode(c) : c);
  }
}

/** Replace all children. */
export function setChildren(el: Element, ...children: Child[]): void {
  el.replaceChildren();
  append(el, children);
}

/**
 * Text to paste elsewhere (a path) plus a Copy button.
 *
 * The button carries a word, not just an icon: most readers are seeing these paths for the
 * first time and may not recognise a lone icon as "copy". It is always visible because
 * touch screens have no hover.
 */
export function copyField(t: Strings, text: string): HTMLElement {
  const code = h("code", { class: "copy-text" });
  // Allow wrapping right after separators: breaking anywhere would split LOCALAPPDATA in the
  // middle and look like the path itself is broken.
  text.split(/(?<=[\\/=])/).forEach((part, i) => {
    if (i > 0) code.append(h("wbr"));
    code.append(part);
  });
  const btn = h("button", { type: "button", class: "btn btn-outline btn-sm" }, t.copy);
  let timer = 0;
  btn.addEventListener("click", () => {
    void navigator.clipboard?.writeText(text).then(() => {
      btn.textContent = t.copied;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => (btn.textContent = t.copy), 1500);
    });
  });
  return h("div", { class: "copy-field" }, code, btn);
}

/** A labelled `<select>` whose options can be replaced without losing the control. */
export function selectField(label: string, onChange: (value: string) => void): {
  root: HTMLElement;
  select: HTMLSelectElement;
  setOptions: (items: [value: string, label: string][], value: string) => void;
} {
  const select = h("select", { class: "input select" });
  select.addEventListener("change", () => onChange(select.value));
  const root = h("label", { class: "select-field" }, h("span", { class: "sr-only" }, label), select);
  return {
    root,
    select,
    setOptions(items, value) {
      select.replaceChildren(...items.map(([v, text]) => h("option", { value: v }, text)));
      select.value = value;
    },
  };
}

/** A toggle button whose pressed state lives in `aria-pressed`. */
export function toggle(label: Child[], onToggle: (pressed: boolean) => void): HTMLButtonElement {
  const btn = h("button", { type: "button", class: "chip", "aria-pressed": "false" }, ...label);
  btn.addEventListener("click", () => onToggle(btn.getAttribute("aria-pressed") !== "true"));
  return btn;
}

export function setPressed(btn: HTMLElement, pressed: boolean): void {
  btn.setAttribute("aria-pressed", String(pressed));
}
