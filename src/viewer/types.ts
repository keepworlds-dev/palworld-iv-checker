/**
 * Types that cross between the main thread and the viewer worker. **Does not import
 * vendor**: the UI imports this file, and that must not pull the GVAS parser into the page
 * bundle.
 *
 * Only raw facts from the save live here (codes, numbers, ownership). Names, elements and
 * the like are matched up by the page against the Paldex data; the worker does not know
 * which language the page is in.
 */

/** A world found by `open`. Only LevelMeta has been read; Level.sav is untouched so far. */
export type ViewerWorldEntry = {
  /** The world directory relative to the picked root (or archive); `view` takes it to pick the world. Empty when the world directory itself was picked. */
  dir: string;
  /** The world name from LevelMeta; null when it could not be read, and the page falls back to the directory name. */
  name: string | null;
  inGameDay: number | null;
  /** Level.sav's modification time in milliseconds. Inside an archive, the mtime from the tar header. */
  lastModified: number;
};

export type ViewerOpenResult = {
  worlds: ViewerWorldEntry[];
  /** Whether the picked files included an archive. When no world is found the page words its hint differently. */
  fromArchive: boolean;
};

export type ViewerPlayer = {
  /** Player ID, lowercase with hyphens (`uidOf` in `extract.ts`). Only used to match ownership, never shown. */
  uid: string;
  /** null when Level.sav has no character entry for this player (only a player file is left). */
  name: string | null;
  level: number | null;
};

/**
 * Where a Pal is. Decided by the container IDs in the player files; Pals working at a base
 * have no current owner.
 *
 * The `base` number only groups Pals from the same base together and **does not match the
 * base names in the game**: base data is a blob the parser leaves undecoded. Numbers go by
 * Pal count, largest first, so the biggest base is 1.
 */
export type ViewerLocation =
  | { kind: "party"; slot: number }
  | { kind: "palbox"; slot: number }
  | { kind: "dps"; slot: number }
  | { kind: "base"; base: number }
  | { kind: "other" };

export type ViewerPal = {
  /** Only a list key: an instance ID or a Dimensional Pal Storage slot position, never shown. */
  key: string;
  /** `CharacterID` exactly as stored, case unchanged (the game itself is inconsistent about case). */
  code: string;
  nickname: string | null;
  level: number;
  gender: "male" | "female" | null;
  /** The code has a `BOSS_` prefix: an Alpha. */
  boss: boolean;
  /** `IsRarePal`: a Lucky (shiny) Pal. */
  rare: boolean;
  /** Condensation `Rank`, 1-5, where 1 means no stars. The star count shown is this minus 1. */
  rank: number;
  /** IVs, 0-100. Attack comes from `Talent_Shot`: 1.0 saves have no `Talent_Melee`. */
  talent: { hp: number; attack: number; defense: number };
  /** Soul boost levels 0-20: `Rank_HP` / `Rank_Attack` / `Rank_Defence` / `Rank_CraftSpeed`. */
  soul: { hp: number; attack: number; defense: number; craft: number };
  passives: string[];
  /** Equipped active skills, with `EPalWazaID::` already stripped. */
  equipped: string[];
  /** Learned but not equipped (`MasteredWaza`), also stripped. */
  mastered: string[];
  /** The owner's uid (same as `ViewerPlayer.uid`). null for base Pals, which have no current owner. */
  owner: string | null;
  location: ViewerLocation;
};

export type ViewerWorld = {
  name: string | null;
  inGameDay: number | null;
  players: ViewerPlayer[];
  pals: ViewerPal[];
  /** Number of bases with Pals in them (counted by container), for the overview. */
  bases: number;
  /** Players with a character entry but no `Players/<guid>.sav`: their party and Palbox cannot be told apart, so their Pals go under "Other". */
  missingPlayerFiles: number;
  /** How many warnings the parser left for structures it does not recognise. Nothing is written back, so the page only says "a few values may be incomplete". */
  warnings: number;
  /** Character table entries that could not be decoded. Those Pals are not in the list, and the page has to say so. */
  undecoded: number;
};
