/**
 * The shape of messages between the main thread and the viewer worker.
 *
 * A file of its own so that the UI's module graph never has an edge pointing at the
 * worker.
 */
import type { ViewerOpenResult, ViewerWorld } from "./types";

/**
 * One picked file and its path relative to the picked root.
 *
 * **The path travels separately** instead of relying on `File.webkitRelativePath`: for
 * dropped files the main thread fills that in with `defineProperty`, and structured clone
 * does not carry own properties, so on the worker side only the bare file name would be
 * left.
 */
export type ViewerInputFile = { rel: string; file: File };

export type ViewerRequest =
  /** Read what was picked (files from a folder, loose .sav files or a backup archive) and find the worlds in it. */
  | { id: number; kind: "open"; files: ViewerInputFile[] }
  /** Parse one of the worlds `open` found. `dir` is `ViewerWorldEntry.dir`. */
  | { id: number; kind: "view"; dir: string };

/**
 * Known failures the worker reports to the page. The page shows its own wording for these
 * and shows any other error as is. They live in the protocol rather than in the worker
 * because importing the worker's module from the page would pull vendor into the page
 * bundle.
 */
export const VIEWER_ERRORS = {
  zip: "palsave-viewer:zip",
  badArchive: "palsave-viewer:bad-archive",
  noWorld: "palsave-viewer:no-world",
} as const;

export type ViewerResponse =
  | { id: number; ok: true; value: ViewerOpenResult | ViewerWorld }
  | { id: number; ok: false; message: string };
