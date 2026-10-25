/**
 * Picks the fields the viewer needs out of a parsed save. **A pure function that does not
 * import vendor**: its input is the property tree vendor produces and it only reads by
 * structure, so `scripts/check.mjs` can test it on synthetic property trees.
 *
 * Vendor's `inspectWorld` is not used: it lacks skills, soul boosts and the container a Pal
 * sits in, and it parses Level.sav once more on its own, which doubles time and peak memory
 * on large worlds.
 *
 * How fields are read (names, defaults, how location is decided) was checked against
 * three real 1.0 worlds; the rules are written down in CONTRIBUTING.md. Comments below only
 * mark the places where the code is not self-explanatory.
 *
 * **Type imports only**: the check script runs this .ts file directly in Node, where
 * extensionless relative imports do not resolve. So GUIDs do not go through
 * `../core/paths`' `guid32`; everything uses the string form of vendor's UUID, and callers
 * key their maps the same way (see `ExtractInput`).
 */
import type { ViewerLocation, ViewerPal, ViewerPlayer, ViewerWorld } from "./types";

/** One property in vendor's tree. The value may be wrapped once more as `{type, value}` (Byte / Enum properties); see `val`. */
type Prop = { value?: unknown } | undefined;
type Props = Record<string, Prop>;

/** One entry of `CharacterSaveParameterMap`. */
export type CharacterEntry = {
  key: { PlayerUId?: Prop; InstanceId?: Prop };
  value: { RawData: { value: unknown } };
};

/** One slot of a Dimensional Pal Storage file's `SaveParameterArray`. */
export type DpsSlot = { SaveParameter: { value: Props }; InstanceId?: Prop };

export type ExtractInput = {
  meta: { name: string | null; inGameDay: number | null };
  characters: CharacterEntry[];
  /** How many warnings the parser left (`level.warnings.length`). */
  warnings: number;
  /** Each player file's `SaveData`, keyed by player ID in the {@link uidOf} form. */
  playerFiles: Map<string, Props>;
  /** Dimensional Pal Storage slots, keyed by the player ID the file name starts with, in the {@link uidOf} form. */
  dpsFiles: Map<string, DpsSlot[]>;
};

/** Same as `val` in vendor's `migrate.js`: strip the extra layer of Byte / Enum properties and turn 64-bit integers into numbers. */
function val(prop: Prop): unknown {
  if (prop === null || prop === undefined) return null;
  let v = prop.value;
  if (v !== null && typeof v === "object" && !Array.isArray(v) && "value" in v) {
    v = (v as { value: unknown }).value;
  }
  return typeof v === "bigint" ? Number(v) : v;
}

function num(prop: Prop, fallback: number): number {
  const v = val(prop);
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

/**
 * The single form for IDs: lowercase with hyphens, which is what `String()` of a vendor
 * UUID object gives. The extra `toLowerCase` covers keys callers build from file names
 * (those are uppercase).
 */
export function uidOf(text: string): string {
  return text.toLowerCase();
}

function guidOf(prop: Prop): string | null {
  const v = prop?.value;
  return v === null || v === undefined ? null : uidOf(String(v));
}

/** Strings in an array property (Name and Enum arrays both sit in `value.values`). */
function strings(prop: Prop): string[] {
  const values = (prop?.value as { values?: unknown } | undefined)?.values;
  return Array.isArray(values) ? values.filter((x): x is string => typeof x === "string") : [];
}

/** `EPalWazaID::AquaJet` -> `AquaJet`, matching the skill codes in the Paldex data (`scripts/build-paldex.mjs`). */
const wazaCode = (s: string) => s.slice(s.lastIndexOf("::") + 2);

/** A container ID, wrapped in an `{ ID: <Guid> }` struct. A Pal's SlotId and both containers in a player file have this shape. */
function containerGuid(prop: Prop): string | null {
  const inner = prop?.value as { ID?: Prop } | undefined;
  return inner?.ID ? guidOf(inner.ID) : null;
}

function slotOf(sp: Props): { container: string | null; index: number } {
  const slot = sp.SlotId?.value as { ContainerId?: Prop; SlotIndex?: Prop } | undefined;
  return { container: containerGuid(slot?.ContainerId), index: num(slot?.SlotIndex, 0) };
}

function genderOf(prop: Prop): ViewerPal["gender"] {
  const v = val(prop);
  if (v === "EPalGenderType::Male") return "male";
  if (v === "EPalGenderType::Female") return "female";
  // A missing field (humans) and `EPalGenderType::None` (empty storage slots write out the
  // defaults too) both mean "none".
  return null;
}

function palOf(sp: Props, key: string, owner: string | null, location: ViewerLocation): ViewerPal {
  const code = String(val(sp.CharacterID) ?? "");
  const nickname = val(sp.NickName);
  return {
    key,
    code,
    nickname: typeof nickname === "string" && nickname !== "" ? nickname : null,
    // The fallbacks below are what the game means when it leaves a field out: saves do not
    // write fields that hold their default value.
    level: num(sp.Level, 1),
    gender: genderOf(sp.Gender),
    boss: /^boss_/i.test(code),
    rare: val(sp.IsRarePal) === true,
    rank: num(sp.Rank, 1),
    talent: {
      hp: num(sp.Talent_HP, 0),
      attack: num(sp.Talent_Shot, 0),
      defense: num(sp.Talent_Defense, 0),
    },
    soul: {
      hp: num(sp.Rank_HP, 0),
      attack: num(sp.Rank_Attack, 0),
      defense: num(sp.Rank_Defence, 0),
      craft: num(sp.Rank_CraftSpeed, 0),
    },
    passives: strings(sp.PassiveSkillList),
    equipped: strings(sp.EquipWaza).map(wazaCode),
    mastered: strings(sp.MasteredWaza).map(wazaCode),
    owner,
    location,
  };
}

/** An empty Dimensional Pal Storage slot: the code is `None` (or empty) and every other field holds its default. */
const isEmptySlot = (code: string) => code === "" || code === "None";

export function extractWorld(input: ExtractInput): ViewerWorld {
  // Container ID -> whose party or Palbox. Without a player's file their two containers
  // cannot be recognised, and their Pals land under "Other".
  const roles = new Map<string, { kind: "party" | "palbox"; owner: string }>();
  for (const [uid, sd] of input.playerFiles) {
    const party = containerGuid(sd.OtomoCharacterContainerId);
    const box = containerGuid(sd.PalStorageContainerId);
    if (party) roles.set(party, { kind: "party", owner: uid });
    if (box) roles.set(box, { kind: "palbox", owner: uid });
  }

  const players: ViewerPlayer[] = [];
  const pals: ViewerPal[] = [];
  /** Base Pals are collected by container first and numbered by count at the end. */
  const baseOf = new Map<ViewerPal, string>();
  let undecoded = 0;

  for (const entry of input.characters) {
    const raw = entry.value.RawData.value as { object?: { SaveParameter?: { value?: Props } } } | null;
    const sp = raw?.object?.SaveParameter?.value;
    if (!sp) {
      undecoded++;
      continue;
    }
    if (val(sp.IsPlayer) === true) {
      const uid = guidOf(entry.key.PlayerUId);
      if (uid === null) continue;
      const nickname = val(sp.NickName);
      players.push({
        uid,
        name: typeof nickname === "string" && nickname !== "" ? nickname : null,
        level: num(sp.Level, 1),
      });
      continue;
    }

    const key = String(entry.key.InstanceId?.value ?? pals.length);
    const owner = guidOf(sp.OwnerPlayerUId);
    const { container, index } = slotOf(sp);
    const role = container ? roles.get(container) : undefined;

    if (role) {
      pals.push(palOf(sp, key, owner, { kind: role.kind, slot: index }));
    } else if (owner === null && container !== null) {
      // A base Pal: in no player's party or Palbox, and without a current owner.
      const pal = palOf(sp, key, null, { kind: "other" });
      baseOf.set(pal, container);
      pals.push(pal);
    } else {
      pals.push(palOf(sp, key, owner, { kind: "other" }));
    }
  }

  // Numbered by Pal count, largest first, ties broken by container ID, so the same save
  // gets the same numbers every time it is opened.
  const sizes = new Map<string, number>();
  for (const c of baseOf.values()) sizes.set(c, (sizes.get(c) ?? 0) + 1);
  const order = [...sizes.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const baseNo = new Map(order.map(([c], i) => [c, i + 1]));
  for (const [pal, c] of baseOf) pal.location = { kind: "base", base: baseNo.get(c) ?? 0 };

  for (const [fileUid, slots] of input.dpsFiles) {
    slots.forEach((slot, i) => {
      const sp = slot.SaveParameter?.value;
      if (!sp || isEmptySlot(String(val(sp.CharacterID) ?? ""))) return;
      const { index } = slotOf(sp);
      // Ownership as written in the file; when absent, the player the file is named after
      // (Dimensional Pal Storage is personal).
      const owner = guidOf(sp.OwnerPlayerUId) ?? fileUid;
      pals.push(palOf(sp, `dps:${fileUid}:${i}`, owner, { kind: "dps", slot: index }));
    });
  }

  // Players who only have a player file and no character entry (rare) are listed too;
  // otherwise the owner column could not show a name for their Pals.
  const known = new Set(players.map((p) => p.uid));
  for (const uid of input.playerFiles.keys()) {
    if (!known.has(uid)) players.push({ uid, name: null, level: null });
  }

  return {
    name: input.meta.name,
    inGameDay: input.meta.inGameDay,
    players,
    pals,
    bases: sizes.size,
    missingPlayerFiles: players.filter((p) => !input.playerFiles.has(p.uid)).length,
    warnings: input.warnings,
    undecoded,
  };
}
