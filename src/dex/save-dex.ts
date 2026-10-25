/**
 * The viewer's lookup tables: character code -> name and elements; passive and skill
 * codes -> names.
 *
 * # Loaded on demand
 *
 * Projected to one language this is still around 150 KB (over a thousand characters, four
 * in ten of them captured humans), and it is of no use before the user has picked a save.
 * Putting it in the entry bundle would make everyone who only reads the instructions carry
 * it. So the page `import()`s this module after a save is picked, in parallel with the
 * worker's parse; parsing a world takes seconds anyway, so nobody waits longer. **Do not
 * import it statically**: that would put the whole `paldex.json` back on first load.
 *
 * # Keys are always lowercase
 *
 * Saves are not even consistent about one species' case (`Sheepball` / `SheepBall`), so
 * codes are lowercased before lookup.
 */
import { CHARACTERS, ELEMENTS, PALS, PASSIVES, WAZA, type Locale } from "./index";

/** What a character code in a save resolves to. */
export type SaveDexCharacter = {
  name: string;
  elements: string[];
  /** Which Paldeck entry it counts as (lowercase code), for the overview's Paldeck count. Humans and Pals outside the Paldeck have none. */
  dex: string | null;
  human: boolean;
};

export type SaveDex = {
  characters: Record<string, SaveDexCharacter>;
  passives: Record<string, { name: string; rating: number }>;
  waza: Record<string, { name: string; element: string | null }>;
  /** Element code -> name. */
  elements: Record<string, string>;
  /** Number of Paldeck entries, the denominator of the Paldeck count. */
  dexSize: number;
};

export function saveDexFor(locale: Locale): SaveDex {
  const characters: Record<string, SaveDexCharacter> = {};
  const byCode = new Map(PALS.map((p) => [p.code, p]));

  for (const p of PALS) {
    characters[p.code.toLowerCase()] = {
      name: p.names[locale],
      elements: p.elements,
      dex: p.code.toLowerCase(),
      human: false,
    };
  }
  for (const c of CHARACTERS) {
    if ("family" in c) {
      const base = byCode.get(c.family);
      // Cannot happen (check.mjs verifies every family resolves); if it does, the code is
      // shown as an unknown one.
      if (!base) continue;
      characters[c.code.toLowerCase()] = {
        name: base.names[locale],
        elements: base.elements,
        dex: base.code.toLowerCase(),
        human: false,
      };
    } else {
      characters[c.code.toLowerCase()] = {
        name: c.names[locale],
        elements: c.elements,
        dex: null,
        human: c.human === true,
      };
    }
  }

  return {
    characters,
    passives: Object.fromEntries(
      PASSIVES.map((s) => [s.code.toLowerCase(), { name: s.names[locale], rating: s.rating }]),
    ),
    waza: Object.fromEntries(
      WAZA.map((w) => [w.code.toLowerCase(), { name: w.names[locale], element: w.element }]),
    ),
    elements: Object.fromEntries(ELEMENTS.map((e) => [e.code, e.names[locale]])),
    dexSize: PALS.length,
  };
}
