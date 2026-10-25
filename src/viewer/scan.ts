/**
 * Scan bytes, without parsing: does a Dimensional Pal Storage file hold any Pals?
 *
 * # Why this step exists
 *
 * Every player's `_dps.sav` has 9600 slots, and empty slots still write every field with
 * its default value. Decompressed it is about 70 MB; a full vendor parse takes around a
 * second and hundreds of MB of objects. In one real six-player world only 3 of 5 storage
 * files held Pals (18 in total). On a busy server, parsing them all means tens of seconds
 * of spinner while most files are empty. So they are scanned first; empty ones are skipped
 * whole and only those with Pals go to vendor.
 *
 * # What it looks for
 *
 * A GVAS property is written as "name FString, type FString, u64 size, optional GUID,
 * value". This finds the `CharacterID` + `NameProperty` header and reads the value: empty
 * slots hold `None`. It only decides "parse or not", never supplies data; values still come
 * from vendor, so a wrong scan costs one needless parse, not a wrong value on screen.
 *
 * Imports nothing, so `scripts/check.mjs` tests it on synthetic bytes directly.
 */

function fstringBytes(s: string): Uint8Array {
  const out = new Uint8Array(4 + s.length + 1);
  new DataView(out.buffer).setInt32(0, s.length + 1, true);
  for (let i = 0; i < s.length; i++) out[4 + i] = s.charCodeAt(i);
  return out;
}

const NEEDLE = (() => {
  const a = fstringBytes("CharacterID");
  const b = fstringBytes("NameProperty");
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
})();

/** Read the FString at `at` (positive length: Latin-1 with a trailing NUL; negative: UTF-16). null when it cannot be read. */
function readFString(buf: Uint8Array, view: DataView, at: number): string | null {
  if (at + 4 > buf.length) return null;
  const len = view.getInt32(at, true);
  if (len === 0) return "";
  if (len > 0) {
    if (at + 4 + len > buf.length) return null;
    return String.fromCharCode(...buf.subarray(at + 4, at + 4 + len - 1));
  }
  const n = -len;
  if (at + 4 + n * 2 > buf.length) return null;
  let s = "";
  for (let i = 0; i < n - 1; i++) s += String.fromCharCode(view.getUint16(at + 4 + i * 2, true));
  return s;
}

/** Whether the decompressed GVAS has at least one entry whose `CharacterID` is not `None` (or empty). */
export function hasCharacters(gvas: Uint8Array): boolean {
  const view = new DataView(gvas.buffer, gvas.byteOffset, gvas.byteLength);
  const first = NEEDLE[0];
  outer: for (let i = gvas.indexOf(first); i !== -1 && i + NEEDLE.length <= gvas.length; i = gvas.indexOf(first, i + 1)) {
    for (let j = 1; j < NEEDLE.length; j++) if (gvas[i + j] !== NEEDLE[j]) continue outer;
    // After the header: the u64 size, then one byte saying whether a 16-byte GUID follows.
    let at = i + NEEDLE.length + 8;
    if (at >= gvas.length) return false;
    at += gvas[at] ? 17 : 1;
    const value = readFString(gvas, view, at);
    // Unreadable counts as "has Pals": better one needless parse than a missed storage file.
    if (value === null || (value !== "" && value !== "None")) return true;
  }
  return false;
}
