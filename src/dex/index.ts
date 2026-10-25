/**
 * Paldex data: names and elements of Pals, passives, skills and other characters.
 *
 * The data is in `paldex.json`, exported by `scripts/build-paldex.mjs` from the upstream
 * Palworld-Pal-Editor (GPL-3.0; license and commit in `vendor/`). **This file knows no
 * Pal's name**; it only declares the shape of the fields the viewer reads. The JSON has
 * more (breeding data, work suitability, passive descriptions) that nothing here uses.
 *
 * Do not import this from the page's entry module: it closes over half a megabyte of JSON.
 * The viewer `import()`s `save-dex.ts` on demand instead; see that file.
 */
import data from "./paldex.json" with { type: "json" };

export const LOCALES = ["en", "ja", "ko", "zh-CN", "zh-Hant"] as const;
export type Locale = (typeof LOCALES)[number];

export type Pal = {
  code: string;
  names: Record<Locale, string>;
  elements: string[];
};

export type Passive = {
  code: string;
  /** Upstream's Rating: positive is a good trait, negative a bad one. */
  rating: number;
  names: Record<Locale, string>;
};

/** The nine elements with their official names (from palcalc; see build-paldex.mjs). */
export type Element = { code: string; names: Record<Locale, string> };

/** An active skill. `code` is the part after `EPalWazaID::` in the save; a null `element` is a non-elemental move. */
export type Waza = { code: string; element: string | null; names: Record<Locale, string> };

/**
 * A character outside the Paldeck that can appear in saves. Where the two shapes come from
 * is explained in `build-paldex.mjs`: variants point at their base species in the Paldeck,
 * everything else carries its own name. `icon` is unused here (no icons are shipped).
 */
export type Character = { code: string; icon?: string } & (
  | { family: string }
  | { names: Record<Locale, string>; elements: string[]; human?: true }
);

// Cast through `unknown`: the type inferred from JSON is a literal type per entry, which
// tsc refuses to assert directly to these declarations. The shape is guaranteed on the
// data side by `scripts/check.mjs`, not by the type assertion.
export const PALS: Pal[] = data.pals as unknown as Pal[];
export const PASSIVES: Passive[] = data.passives as unknown as Passive[];
export const ELEMENTS: Element[] = data.elements as unknown as Element[];
export const WAZA: Waza[] = data.waza as unknown as Waza[];
export const CHARACTERS: Character[] = data.characters as unknown as Character[];
/** The upstream commit the data was exported from. */
export const UPSTREAM_COMMIT: string = data.upstream;
