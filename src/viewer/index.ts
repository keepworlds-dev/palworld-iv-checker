/**
 * The UI-side entry point of the save viewer. **Parses nothing**: it only starts the worker
 * and wraps its messages in promises. Everything that reads bytes is in `worker.ts`.
 */
import type { ViewerInputFile, ViewerRequest, ViewerResponse } from "./protocol";
import type { ViewerOpenResult, ViewerWorld } from "./types";

export { VIEWER_ERRORS, type ViewerInputFile } from "./protocol";
export type {
  ViewerLocation,
  ViewerOpenResult,
  ViewerPal,
  ViewerPlayer,
  ViewerWorld,
  ViewerWorldEntry,
} from "./types";

/**
 * The error that requests still pending after `terminate()` receive. Callers ignore it
 * entirely: it only means the user moved on to another save.
 */
export const VIEWER_ABORTED = "palsave-viewer:aborted";

export function isViewerAborted(err: unknown): boolean {
  return err instanceof Error && err.message === VIEWER_ABORTED;
}

/**
 * The request body without `id`. A plain `Omit` over the union would collapse it to the
 * keys every member shares and lose the per-kind fields, so omit member by member.
 */
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
type Body = DistributiveOmit<ViewerRequest, "id">;

export type PalViewerClient = {
  open(files: ViewerInputFile[]): Promise<ViewerOpenResult>;
  view(dir: string): Promise<ViewerWorld>;
  terminate(): void;
};

/**
 * Start a worker. **One client per pick**: when the user switches to another save, the old
 * one is `terminate()`d first and a new one created, so the previous save's bytes are freed
 * together with the wasm heap, and a late reply from the old one can never land on the new
 * list.
 */
export function createPalViewerClient(): PalViewerClient {
  const worker = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });
  const pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();
  let nextId = 1;
  let dead = false;

  worker.addEventListener("message", (e: MessageEvent<ViewerResponse>) => {
    const res = e.data;
    const slot = pending.get(res.id);
    if (!slot) return;
    pending.delete(res.id);
    if (res.ok) slot.resolve(res.value);
    else slot.reject(new Error(res.message));
  });

  // When the worker itself crashes (most likely a large world exhausting memory and the
  // browser killing it), fail the pending requests too, or the spinner would spin forever.
  worker.addEventListener("error", (e: ErrorEvent) => {
    const message = e.message || "worker crashed";
    for (const [, slot] of pending) slot.reject(new Error(message));
    pending.clear();
  });

  function send<T>(body: Body): Promise<T> {
    if (dead) return Promise.reject(new Error(VIEWER_ABORTED));
    const id = nextId++;
    return new Promise<T>((resolve, reject) => {
      pending.set(id, { resolve: resolve as (v: unknown) => void, reject });
      worker.postMessage({ ...body, id });
    });
  }

  return {
    open: (files) => send<ViewerOpenResult>({ kind: "open", files }),
    view: (dir) => send<ViewerWorld>({ kind: "view", dir }),
    terminate() {
      dead = true;
      for (const [, slot] of pending) slot.reject(new Error(VIEWER_ABORTED));
      pending.clear();
      worker.terminate();
    },
  };
}
