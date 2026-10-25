/**
 * The save viewer's worker: unpacks backup archives, finds worlds, parses and extracts.
 * **Read-only**: it never writes a byte back.
 *
 * # Why it has to be a worker, and why a new save means a new worker
 *
 * A large world's Level.sav is tens of MB once decompressed, and a full GVAS parse of it on
 * the main thread freezes the page long enough for the browser to call it unresponsive.
 * Terminating the worker is also the only way to give back the wasm heap: the ooz wrapper
 * only frees its previous buffer on the next call, so the last decompression result would
 * otherwise stay pinned.
 *
 * This is the only place in the viewer that imports vendor. It shares vendor,
 * `../core/paths.ts` and `../core/type-hints.ts` with the save converter, and only reads
 * from them.
 */
import { classifyWorldFile, isRollingBackup } from "../core/paths";
// Fills gaps in the vendor type table; must take effect before any parse. See that file's header.
import "../core/type-hints";
import { formatGuid, parseLevel, parsePlayer } from "../vendor/migrate.js";
import { decompressSav } from "../vendor/sav.js";
import {
  extractWorld,
  relevantLevelWarnings,
  uidOf,
  type CharacterEntry,
  type DpsSlot,
} from "./extract";
import { VIEWER_ERRORS, type ViewerInputFile, type ViewerRequest, type ViewerResponse } from "./protocol";
import { hasCharacters } from "./scan";
import { gunzip, isGzip, isTar, readTar } from "./tar";
import type { ViewerOpenResult, ViewerWorld, ViewerWorldEntry } from "./types";

type OozDecompress = (data: Uint8Array, rawSize: number) => Uint8Array;

/**
 * The Oodle decompressor lives in `public/ooz-wasm/` and is **loaded from a URL at runtime,
 * bypassing the bundler**. The emscripten output carries a Node environment branch
 * (`await import("module")`) that a bundler tries to resolve and fails on, even though it
 * never runs in a browser; working around that would mean editing vendor or configuring
 * aliases.
 *
 * The URL is built from Vite's `BASE_URL`, so the app also works under a sub-path. It is
 * made fully qualified on purpose: the Vite dev server appends `?import` to root-relative
 * dynamic imports, and a public file requested that way is refused (404). `@vite-ignore`
 * keeps Vite from warning about the non-static import.
 *
 * The promise is cached rather than the result, so concurrent callers initialise the
 * runtime only once, but **failures are not cached**: with a cached rejection, one network
 * hiccup would make every later read fail with the same stale error until a reload.
 */
const OOZ_URL = new URL(`${import.meta.env.BASE_URL}ooz-wasm/index.js`, self.location.origin).href;

let oozPromise: Promise<OozDecompress> | null = null;

function loadOoz(): Promise<OozDecompress> {
  if (oozPromise === null) {
    oozPromise = (
      import(/* @vite-ignore */ OOZ_URL) as Promise<{
        decompress: OozDecompress;
      }>
    )
      .then((m) => m.decompress)
      .catch((err: unknown) => {
        oozPromise = null;
        throw err;
      });
  }
  return oozPromise;
}

/** One readable file: a `File` picked from a folder, or a slice of bytes unpacked from an archive. */
type Item = { rel: string; mtime: number; read: () => Promise<Uint8Array> };

/**
 * Flatten what was picked into files. Archives are recognised by content (gzip / ustar
 * magic); the extension only decides whether to peek at the header at all, otherwise every
 * .sav would be read one extra time.
 */
async function expand(files: ViewerInputFile[]): Promise<{ items: Item[]; fromArchive: boolean }> {
  const items: Item[] = [];
  let fromArchive = false;

  for (const { rel, file } of files) {
    const lower = rel.toLowerCase();
    // Zip exports from other hosting panels are not accepted yet: vendor can write zips but
    // not read them.
    if (lower.endsWith(".zip")) throw new Error(VIEWER_ERRORS.zip);
    if (/\.(tar\.gz|tgz|gz|tar)$/.test(lower)) {
      const head = new Uint8Array(await file.slice(0, 512).arrayBuffer());
      let entries;
      try {
        const tar = isGzip(head)
          ? await gunzip(file)
          : isTar(head)
            ? new Uint8Array(await file.arrayBuffer())
            : null;
        if (tar === null) throw new Error("not an archive");
        entries = readTar(tar);
      } catch {
        throw new Error(VIEWER_ERRORS.badArchive);
      }
      fromArchive = true;
      for (const e of entries) items.push({ rel: e.path, mtime: e.mtime, read: async () => e.bytes });
      continue;
    }
    items.push({
      rel,
      mtime: file.lastModified,
      read: async () => new Uint8Array(await file.arrayBuffer()),
    });
  }
  return { items, fromArchive };
}

const dirOf = (rel: string) => rel.split("/").slice(0, -1).join("/");

/** Every file of one world directory. An empty `dir` means the world directory itself (or loose files) was picked, so every file belongs to it. */
function filesOf(items: Item[], dir: string): Item[] {
  const own = dir === "" ? items : items.filter((it) => it.rel.startsWith(`${dir}/`));
  return own.filter((it) => !isRollingBackup(it.rel));
}

/** World name and in-game day from LevelMeta. Any failure yields nulls, so the world list still opens. */
async function readMeta(files: Item[]): Promise<{ name: string | null; inGameDay: number | null }> {
  try {
    const meta = files.find((it) => classifyWorldFile(it.rel).kind === "levelMeta");
    if (!meta) return { name: null, inGameDay: null };
    const parsed = (await parsePlayer(await meta.read(), await loadOoz())) as unknown as {
      player: { properties: { SaveData: { value: Record<string, { value?: unknown }> } } };
    };
    const sd = parsed.player.properties.SaveData.value;
    const name = typeof sd.WorldName?.value === "string" ? sd.WorldName.value : null;
    const day = sd.InGameDay?.value;
    const inGameDay = typeof day === "number" ? day : typeof day === "bigint" ? Number(day) : null;
    return { name: name !== null && name !== "" ? name : null, inGameDay };
  } catch {
    return { name: null, inGameDay: null };
  }
}

let items: Item[] = [];

async function open(files: ViewerInputFile[]): Promise<ViewerOpenResult> {
  const expanded = await expand(files);
  items = expanded.items;

  // The same criterion as the converter's world list: find Level.sav with the classifier in
  // `../core/paths.ts`, skipping rolling backups.
  const levels = new Map<string, Item>();
  for (const it of items) {
    if (isRollingBackup(it.rel) || classifyWorldFile(it.rel).kind !== "level") continue;
    levels.set(dirOf(it.rel), it);
  }

  // Sequential rather than concurrent: every LevelMeta goes through the same ooz runtime,
  // and concurrency would only hold several decompression buffers at once.
  const worlds: ViewerWorldEntry[] = [];
  for (const [dir, level] of levels) {
    const meta = await readMeta(filesOf(items, dir));
    worlds.push({ dir, name: meta.name, inGameDay: meta.inGameDay, lastModified: level.mtime });
  }
  // Most recently modified first: "the one I just played" is most likely the one to view.
  worlds.sort((a, b) => b.lastModified - a.lastModified);
  return { worlds, fromArchive: expanded.fromArchive };
}

type ParsedLevel = {
  properties: { worldSaveData: { value: { CharacterSaveParameterMap: { value: CharacterEntry[] } } } };
  warnings?: unknown[];
};
type ParsedPlayer = { player: { properties: Record<string, { value?: unknown }> } };

async function view(dir: string): Promise<ViewerWorld> {
  const files = filesOf(items, dir);
  const levelItem = files.find((it) => classifyWorldFile(it.rel).kind === "level");
  if (!levelItem) throw new Error(VIEWER_ERRORS.noWorld);

  const ooz = await loadOoz();
  const meta = await readMeta(files);
  const { level } = (await parseLevel(await levelItem.read(), ooz)) as unknown as { level: ParsedLevel };
  let warnings = relevantLevelWarnings(level.warnings ?? []);

  const playerFiles = new Map<string, Record<string, { value?: unknown }>>();
  const dpsFiles = new Map<string, DpsSlot[]>();
  // One broken player file or storage file must not stop the whole world from opening:
  // that player's Pals land under "Other" or go missing, it counts as a warning, and the
  // page says "a few values may be incomplete".
  for (const it of files) {
    const kind = classifyWorldFile(it.rel);
    const base = it.rel.split("/").pop() ?? "";
    try {
      if (kind.kind === "player") {
        const { player } = (await parsePlayer(await it.read(), ooz)) as unknown as ParsedPlayer;
        const sd = player.properties.SaveData?.value as Record<string, { value?: unknown }> | undefined;
        if (!sd) continue;
        // Keyed by the ID written inside the file, not the file name: the same source and
        // form as PlayerUId in the character table.
        const uid = sd.PlayerUId?.value;
        playerFiles.set(uidOf(uid !== undefined ? String(uid) : formatGuid(kind.guid as string)), sd);
      } else if (kind.kind === "sidecar") {
        const m = /^([0-9A-Fa-f]{32})_dps\.sav$/.exec(base);
        if (!m) continue;
        const bytes = await it.read();
        // Empty Dimensional Pal Storage is skipped whole: 70 MB and a second of parsing
        // each, and most players' storage is empty (see scan.ts).
        const { gvas } = (await decompressSav(bytes, ooz)) as { gvas: Uint8Array };
        if (!hasCharacters(gvas)) continue;
        const { player } = (await parsePlayer(bytes, ooz)) as unknown as ParsedPlayer;
        const arr = player.properties.SaveParameterArray?.value as { values?: DpsSlot[] } | undefined;
        if (Array.isArray(arr?.values)) dpsFiles.set(uidOf(formatGuid(m[1])), arr.values);
      }
    } catch {
      warnings++;
    }
  }

  return extractWorld({
    meta,
    characters: level.properties.worldSaveData.value.CharacterSaveParameterMap.value,
    warnings,
    playerFiles,
    dpsFiles,
  });
}

// The tsconfig lib has no webworker, so the two members we use are declared structurally.
const ctx = self as unknown as {
  postMessage(value: ViewerResponse): void;
  addEventListener(type: "message", fn: (e: MessageEvent<ViewerRequest>) => void): void;
};

async function handle(req: ViewerRequest): Promise<ViewerOpenResult | ViewerWorld> {
  switch (req.kind) {
    case "open":
      return open(req.files);
    case "view":
      return view(req.dir);
  }
}

ctx.addEventListener("message", (e) => {
  const req = e.data;
  void handle(req).then(
    (value) => ctx.postMessage({ id: req.id, ok: true, value }),
    (err: unknown) =>
      ctx.postMessage({
        id: req.id,
        ok: false,
        message: err instanceof Error ? err.message : String(err),
      }),
  );
});
