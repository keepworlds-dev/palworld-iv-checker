/**
 * The IV checker page: pick a save, pick a world, see every Pal in it. **Read-only and
 * entirely in the browser**: nothing is written back, nothing is downloaded, and no
 * network request ever carries save bytes away. Everything that reads bytes is in
 * `../viewer/worker.ts`; this file only handles picking files and worlds.
 *
 * # Three kinds of input, one path
 *
 * A SaveGames folder, a single world folder and a `.tar.gz` backup all become "relative
 * path + file" for the worker, which finds the worlds with the same classifier the
 * converter uses. Phones have neither folder picking nor drag-and-drop, so archives and
 * loose .sav files go through a second picker.
 *
 * # A new save means a new worker
 *
 * The previous save's bytes are freed along with the wasm heap, and a late reply from the
 * old worker can never land on the new list. That does not depend on remembering to reset
 * one more field.
 *
 * # The Paldex data is loaded on demand
 *
 * The name tables are `import()`ed only once a save is picked, in parallel with parsing
 * (the reasoning is in `../dex/save-dex.ts`).
 */
import type { SaveDex } from "../dex/save-dex";
import { relOf } from "../core/paths";
import {
  createPalViewerClient,
  isViewerAborted,
  VIEWER_ERRORS,
  type PalViewerClient,
  type ViewerWorld,
  type ViewerWorldEntry,
} from "../viewer/index";
import { copyField, h, setChildren } from "./dom";
import { filesFromDrop } from "./dropped-files";
import { renderResult } from "./result";
import { HOSTED_URL, SOURCE_URL, dateTime, en } from "./strings";
import "./style.css";

const t = en;
document.documentElement.lang = t.lang;

type Phase = "idle" | "opening" | "choosing" | "parsing" | "ready";

const state = {
  phase: "idle" as Phase,
  worlds: [] as ViewerWorldEntry[],
  result: null as { world: ViewerWorld; dex: SaveDex; dir: string } | null,
  /** A `VIEWER_ERRORS` code, one of the page's own codes below, or a raw message. */
  error: null as string | null,
};

let client: PalViewerClient | null = null;
let dexPromise: Promise<SaveDex> | null = null;

function loadDex(): Promise<SaveDex> {
  return import("../dex/save-dex").then((m) => m.saveDexFor(t.dexLocale));
}

// ---- Static layout ----

const app = document.getElementById("app") as HTMLElement;

let inputSeq = 0;
const folderId = `pick-${++inputSeq}`;
const filesId = `pick-${++inputSeq}`;

// Always clear the input's value, and do it **before** handling the files: otherwise
// picking the same folder again (the usual fix for "picked the wrong level") fires no
// change event and the click appears to do nothing.
const pick = (e: Event) => {
  const input = e.target as HTMLInputElement;
  const picked = [...(input.files ?? [])];
  input.value = "";
  void onFiles(picked);
};

// `webkitdirectory` is non-standard but implemented by all major browsers. Browsers
// without it degrade to a plain multi-file picker, which is what `multiple` is for.
const folderInput = h("input", { id: folderId, type: "file", multiple: true, class: "sr-only", onchange: pick });
folderInput.setAttribute("webkitdirectory", "");
folderInput.setAttribute("directory", "");
// A second input **without** webkitdirectory picks files: backup archives, loose .sav
// files, and the only path that works on a phone.
const filesInput = h("input", {
  id: filesId,
  type: "file",
  multiple: true,
  accept: ".gz,.tgz,.tar,.sav",
  class: "sr-only",
  onchange: pick,
});

const dropIcon = h("span", { class: "drop-icon", "aria-hidden": "true" });
const dropStatus = h("p", { class: "strong", role: "status" });
const dropPickers = h(
  "div",
  { class: "drop-pickers" },
  // The triggers are <label>s: the browser forwards the click to the visually hidden input,
  // and keyboard focus lands on the input itself.
  h("label", { for: folderId, class: "btn btn-lg btn-primary" }, t.pickFolder),
  h("label", { for: filesId, class: "link-muted small" }, t.pickFiles),
);
const dropZone = h(
  "div",
  { class: "drop-zone" },
  folderInput,
  filesInput,
  dropIcon,
  dropPickers,
  dropStatus,
  h("p", { class: "muted small hint" }, t.dropHint),
);
dropZone.addEventListener("dragover", (e) => {
  e.preventDefault();
  dropZone.classList.add("over");
});
dropZone.addEventListener("dragleave", () => dropZone.classList.remove("over"));
dropZone.addEventListener("drop", (e) => {
  e.preventDefault();
  dropZone.classList.remove("over");
  if (!e.dataTransfer || busy()) return;
  // Reading can fail: OneDrive / iCloud placeholder files and files locked by the game make
  // one file() call reject. Report "nothing was read" rather than showing no reaction.
  void filesFromDrop(e.dataTransfer).then(onFiles, () => onFiles([]));
});

const errorBox = h("div", { class: "alert alert-error", role: "alert" });
const worldHead = h("div", { class: "world-head" });
const chooser = h("div", { class: "stack" });
const resultRoot = h("div", { class: "result" });

const whereSection = h(
  "section",
  { class: "stack" },
  h("h2", {}, t.whereTitle),
  h("p", { class: "muted" }, t.whereLead),
  h(
    "div",
    { class: "where-grid" },
    ...t.where.map((w) =>
      h(
        "div",
        { class: "card stack-sm" },
        h("h3", {}, w.title),
        w.path ? copyField(t, w.path) : null,
        h("p", { class: "muted small" }, w.desc),
      ),
    ),
  ),
);

const columnsSection = h(
  "section",
  { class: "stack" },
  h("h2", {}, t.columnsTitle),
  h("p", { class: "muted" }, t.columnsLead),
  h(
    "dl",
    { class: "columns" },
    ...t.columns.flatMap((c) => [h("dt", {}, c.title), h("dd", { class: "muted" }, c.desc)]),
  ),
);

const footer = h(
  "footer",
  { class: "footer muted small" },
  h("p", {}, t.footer.credits, " ", h("a", { href: SOURCE_URL, rel: "noopener" }, t.footer.source), "."),
  h("p", {}, h("a", { href: HOSTED_URL, rel: "noopener" }, t.footer.maintained)),
);

app.append(
  h(
    "header",
    { class: "page-head" },
    h("h1", {}, t.title),
    h("p", { class: "lead" }, t.lead),
    h("p", { class: "trust" }, t.trust),
  ),
  h("section", { class: "tool stack" }, dropZone, worldHead, errorBox, chooser, resultRoot),
  whereSection,
  columnsSection,
  footer,
);

// ---- Actions ----

const busy = () => state.phase === "opening" || state.phase === "parsing";

function fail(err: unknown) {
  if (isViewerAborted(err)) return;
  state.error = err instanceof Error ? err.message : String(err);
  state.phase = state.result ? "ready" : "idle";
  render();
}

async function view(c: PalViewerClient, dir: string) {
  state.phase = "parsing";
  state.error = null;
  render();
  try {
    dexPromise ??= loadDex();
    const [world, dex] = await Promise.all([c.view(dir), dexPromise]);
    if (client !== c) return;
    state.result = { world, dex, dir };
    state.phase = "ready";
    render();
    renderResult(resultRoot, world, dex, t);
  } catch (err) {
    // A failed Paldex load (network hiccup, assets replaced on deploy) is not cached; the
    // next attempt loads it again.
    dexPromise = null;
    fail(err);
  }
}

async function onFiles(files: File[]) {
  client?.terminate();
  state.result = null;
  state.worlds = [];
  state.error = null;
  resultRoot.replaceChildren();
  if (files.length === 0) {
    state.error = "empty";
    state.phase = "idle";
    render();
    return;
  }
  const c = createPalViewerClient();
  client = c;
  state.phase = "opening";
  render();
  // In parallel with reading files: parsing a world takes seconds, and the tables arrive
  // in the meantime.
  dexPromise ??= loadDex();
  try {
    const opened = await c.open(files.map((f) => ({ rel: relOf(f), file: f })));
    if (client !== c) return;
    if (opened.worlds.length === 0) {
      state.error = opened.fromArchive ? "noWorldArchive" : VIEWER_ERRORS.noWorld;
      state.phase = "idle";
      render();
      return;
    }
    if (opened.worlds.length === 1) {
      await view(c, opened.worlds[0].dir);
      return;
    }
    state.worlds = opened.worlds;
    state.phase = "choosing";
    render();
  } catch (err) {
    fail(err);
  }
}

function reset() {
  client?.terminate();
  client = null;
  state.result = null;
  state.worlds = [];
  state.error = null;
  state.phase = "idle";
  resultRoot.replaceChildren();
  render();
}

// ---- Rendering ----

function errorText(code: string): string {
  switch (code) {
    case VIEWER_ERRORS.zip:
      return t.errors.zip;
    case VIEWER_ERRORS.badArchive:
      return t.errors.badArchive;
    case VIEWER_ERRORS.noWorld:
      return t.errors.noWorld;
    case "noWorldArchive":
      return t.errors.noWorldArchive;
    case "empty":
      return t.errors.empty;
    default:
      return t.errors.generic(code);
  }
}

function render() {
  const ready = state.phase === "ready" && state.result !== null;
  const isBusy = busy();

  dropZone.hidden = ready;
  dropIcon.classList.toggle("spin", isBusy);
  dropPickers.hidden = isBusy;
  dropStatus.hidden = !isBusy;
  dropStatus.textContent = state.phase === "opening" ? t.opening : state.phase === "parsing" ? t.parsing : "";
  folderInput.disabled = isBusy;
  filesInput.disabled = isBusy;

  errorBox.hidden = state.error === null;
  errorBox.textContent = state.error === null ? "" : errorText(state.error);

  worldHead.hidden = !ready;
  if (ready && state.result) {
    const w = state.result.world;
    setChildren(
      worldHead,
      h(
        "div",
        { class: "world-title" },
        h("p", { class: "strong" }, w.name ?? t.worldUnnamed),
        w.inGameDay !== null ? h("p", { class: "muted small" }, t.worldDay(w.inGameDay)) : null,
      ),
      h(
        "div",
        { class: "world-actions" },
        state.worlds.length > 1
          ? h(
              "button",
              {
                type: "button",
                class: "btn btn-outline btn-sm",
                onclick: () => {
                  state.phase = "choosing";
                  render();
                },
              },
              t.otherWorld,
            )
          : null,
        h("button", { type: "button", class: "btn btn-outline btn-sm", onclick: reset }, t.reset),
      ),
    );
  }

  chooser.hidden = state.phase !== "choosing";
  if (state.phase === "choosing") {
    setChildren(
      chooser,
      h("p", { class: "strong small" }, t.chooseWorld(state.worlds.length)),
      h(
        "ul",
        { class: "world-list" },
        ...state.worlds.map((w) =>
          h(
            "li",
            {},
            h(
              "button",
              {
                type: "button",
                class: `world${state.result?.dir === w.dir ? " current" : ""}`,
                onclick: () => client && void view(client, w.dir),
              },
              h("span", { class: "strong" }, w.name ?? t.worldUnnamed),
              h("span", { class: "muted small mono" }, w.dir.split("/").pop() || w.dir),
              h(
                "span",
                { class: "muted small" },
                w.inGameDay !== null ? `${t.worldDay(w.inGameDay)} · ` : "",
                t.worldModified(dateTime(w.lastModified)),
              ),
            ),
          ),
        ),
      ),
    );
  }

  resultRoot.hidden = !ready;
}

render();
