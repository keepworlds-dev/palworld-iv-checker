/**
 * Reads backup archives (`.tar.gz`). Read-only, regular files only.
 *
 * Hosting panels pack a world with paths relative to the save root, such as
 * `SaveGames/0/<world>/Level.sav`. Unpacked paths therefore look the same as when a folder
 * is picked, and worlds are then found with the same classifier (`../core/paths.ts`).
 *
 * Imports nothing from vendor and never touches the DOM: both the worker and
 * `scripts/check.mjs` run it directly.
 */

export type TarEntry = { path: string; bytes: Uint8Array; mtime: number };

/** The gzip magic. Recognised by content, not extension: browsers may save a `.tar.gz` download as `.gz` or `.tgz`. */
export function isGzip(head: Uint8Array): boolean {
  return head.length >= 2 && head[0] === 0x1f && head[1] === 0x8b;
}

/** The ustar magic at offset 257. Old v7 tars lack it; backups are never that format. */
export function isTar(head: Uint8Array): boolean {
  return head.length >= 262 && String.fromCharCode(...head.subarray(257, 262)) === "ustar";
}

/**
 * Decompress gzip with the browser's own `DecompressionStream` instead of bundling a JS
 * implementation: it streams in native code, so archives of tens of MB do not stall the
 * worker, and Chrome, Safari and Firefox all have it.
 */
export async function gunzip(data: Blob): Promise<Uint8Array> {
  const stream = data.stream().pipeThrough(new DecompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

const decoder = new TextDecoder();

function cString(b: Uint8Array, start: number, len: number): string {
  const field = b.subarray(start, start + len);
  const end = field.indexOf(0);
  return decoder.decode(end === -1 ? field : field.subarray(0, end));
}

/**
 * A numeric tar header field. Usually octal text; GNU and Go write numbers that do not fit
 * as base-256 (top bit of the first byte set). Save files never reach 8 GB, but fields such
 * as mtime may be written that way, and misreading one should only give a wrong time, not a
 * failed archive.
 */
function numeric(b: Uint8Array, start: number, len: number): number {
  if (b[start] & 0x80) {
    let n = b[start] & 0x7f;
    for (let i = start + 1; i < start + len; i++) n = n * 256 + b[i];
    return n;
  }
  const s = cString(b, start, len).trim();
  return s === "" ? 0 : parseInt(s, 8);
}

/** A PAX extended header: `<length> <key>=<value>\n` records back to back. Only `path` is used. */
function paxPath(data: Uint8Array): string | null {
  const text = decoder.decode(data);
  let i = 0;
  let path: string | null = null;
  while (i < text.length) {
    const sp = text.indexOf(" ", i);
    if (sp === -1) break;
    const len = parseInt(text.slice(i, sp), 10);
    if (!Number.isFinite(len) || len <= 0) break;
    const record = text.slice(sp + 1, i + len - 1);
    const eq = record.indexOf("=");
    if (eq !== -1 && record.slice(0, eq) === "path") path = record.slice(eq + 1);
    i += len;
  }
  return path;
}

/**
 * List the regular files in a tar. Long names are understood in both forms: GNU `L`
 * entries and PAX `path`.
 *
 * The returned `bytes` are views on the original buffer, not copies: a large world is tens
 * of MB decompressed, and copying would double the peak. A truncated archive or a bad
 * header checksum throws. Finding half a world and silently missing a few player files is
 * harder to notice than an archive that will not open.
 */
export function readTar(tar: Uint8Array): TarEntry[] {
  const out: TarEntry[] = [];
  let pos = 0;
  let longName: string | null = null;
  let ended = false;

  while (pos + 512 <= tar.length) {
    const h = tar.subarray(pos, pos + 512);
    // The end is two all-zero blocks; the first one is enough.
    if (h.every((x) => x === 0)) {
      ended = true;
      break;
    }

    // The checksum is a sum of unsigned bytes; a few old implementations sum signed bytes.
    // Go accepts both when reading, and so does this.
    let unsigned = 0;
    let signed = 0;
    for (let i = 0; i < 512; i++) {
      const b = i >= 148 && i < 156 ? 32 : h[i];
      unsigned += b;
      signed += b > 127 ? b - 256 : b;
    }
    const want = numeric(h, 148, 8);
    if (want !== unsigned && want !== signed) throw new Error(`tar header checksum mismatch at ${pos}`);

    const size = numeric(h, 124, 12);
    const type = String.fromCharCode(h[156]);
    const dataStart = pos + 512;
    const dataEnd = dataStart + size;
    if (dataEnd > tar.length) throw new Error("tar archive is truncated");
    const data = tar.subarray(dataStart, dataEnd);

    if (type === "L") {
      longName = cString(data, 0, data.length);
    } else if (type === "x") {
      longName = paxPath(data) ?? longName;
    } else if (type === "0" || type === "\0") {
      const prefix = cString(h, 345, 155);
      const name = cString(h, 0, 100);
      const path = longName ?? (prefix ? `${prefix}/${name}` : name);
      out.push({ path: path.replace(/^\.\//, ""), bytes: data, mtime: numeric(h, 136, 12) * 1000 });
      longName = null;
    } else {
      // Directories, links and global PAX headers (`g`) are not save content.
      longName = null;
    }
    pos = dataStart + Math.ceil(size / 512) * 512;
  }
  // No all-zero end block: the archive was cut off after some entry, and there is no
  // telling how many player files are missing.
  if (!ended) throw new Error("tar archive is truncated");
  return out;
}
