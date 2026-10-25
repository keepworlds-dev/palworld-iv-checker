// Static checks for everything that can be decided without a real save: the backup
// archive reader, the Dimensional Pal Storage pre-scan, field extraction, the Paldex data,
// vendor integrity and license files.
//
// # Why synthetic inputs
//
// Real saves contain players' names and IDs, so none are in this repository, not even as
// test fixtures. The reader, the scan and the extraction are pure functions, so they are
// tested on inputs assembled here in the shape vendor's parser produces. How those shapes
// were checked against real 1.0 worlds is written down in CONTRIBUTING.md.
//
// What this cannot prove: that vendor still parses the current Palworld version. That
// needs a real save (see CONTRIBUTING.md).
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { VERIFIED_TYPE_HINTS } from "../src/core/type-hints.ts";
import { CHARACTERS, ELEMENTS, LOCALES, PALS, PASSIVES, UPSTREAM_COMMIT as PALDEX_COMMIT, WAZA } from "../src/dex/index.ts";
import { PALWORLD_TYPE_HINTS } from "../src/vendor/gvas.js";
import { extractWorld, relevantLevelWarnings, uidOf } from "../src/viewer/extract.ts";
import { hasCharacters } from "../src/viewer/scan.ts";
import { gunzip, isGzip, isTar, readTar } from "../src/viewer/tar.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const problems = [];

function report(where, message) {
  problems.push(`${where}: ${message}`);
}

function concat(parts) {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

// ---- Backup archives ----

/** One ustar block: name, type, data. The checksum follows tar's rule (the checksum field counts as 8 spaces). */
function tarBlock(name, type, data = new Uint8Array(0)) {
  const h = new Uint8Array(512);
  const put = (s, at) => h.set(new TextEncoder().encode(s), at);
  put(name.slice(0, 100), 0);
  put("0000644\0", 100);
  put(`${data.length.toString(8).padStart(11, "0")}\0`, 124);
  put(`${(1_700_000_000).toString(8).padStart(11, "0")}\0`, 136);
  h[156] = type.charCodeAt(0);
  put("ustar\0", 257);
  put("00", 263);
  h.fill(32, 148, 156);
  const sum = h.reduce((a, b) => a + b, 0);
  put(`${sum.toString(8).padStart(6, "0")}\0 `, 148);
  const padded = new Uint8Array(Math.ceil(data.length / 512) * 512);
  padded.set(data);
  return [h, padded];
}

{
  const enc = new TextEncoder();
  const longPath = `SaveGames/0/${"A".repeat(32)}/Players/${"B".repeat(32)}_dps_with_a_very_long_tail_name.sav`;
  const paxPath = `SaveGames/0/${"A".repeat(32)}/Players/${"C".repeat(32)}.sav`;
  const paxRecord = (() => {
    const body = `path=${paxPath}\n`;
    let len = body.length + 3;
    if (`${len} ${body}`.length !== len) len = `${len} ${body}`.length;
    return enc.encode(`${len} ${body}`);
  })();
  const tar = concat([
    ...tarBlock("SaveGames/0/", "5"),
    ...tarBlock(`SaveGames/0/${"A".repeat(32)}/Level.sav`, "0", enc.encode("level-bytes")),
    ...tarBlock("././@LongLink", "L", enc.encode(`${longPath}\0`)),
    ...tarBlock("ignored-short-name", "0", enc.encode("dps")),
    ...tarBlock("PaxHeader", "x", paxRecord),
    ...tarBlock("ignored-too", "0", enc.encode("player")),
    new Uint8Array(1024),
  ]);
  if (!isTar(tar)) report("tar", "the ustar magic was not recognised");
  const entries = readTar(tar);
  const got = entries.map((e) => `${e.path}=${new TextDecoder().decode(e.bytes)}`);
  const want = [
    `SaveGames/0/${"A".repeat(32)}/Level.sav=level-bytes`,
    `${longPath}=dps`,
    `${paxPath}=player`,
  ];
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    report("tar", `wrong entries: ${JSON.stringify(got)}`);
  }
  if (entries[0]?.mtime !== 1_700_000_000_000) report("tar", "mtime was not converted from seconds to milliseconds");

  // A truncated archive must throw: silently missing a few player files is harder to
  // notice than an archive that will not open (see the header of tar.ts).
  let threw = false;
  try {
    readTar(tar.subarray(0, 512 + 512 + 100));
  } catch {
    threw = true;
  }
  if (!threw) report("tar", "a truncated archive did not throw");

  const broken = tar.slice();
  broken[512 + 10] ^= 0xff;
  threw = false;
  try {
    readTar(broken);
  } catch {
    threw = true;
  }
  if (!threw) report("tar", "an archive with a bad header checksum did not throw");

  // gzip round trip: browsers and Node both have CompressionStream.
  const gz = new Uint8Array(
    await new Response(new Blob([tar]).stream().pipeThrough(new CompressionStream("gzip"))).arrayBuffer(),
  );
  if (!isGzip(gz)) report("tar", "the gzip magic was not recognised");
  const back = await gunzip(new Blob([gz]));
  if (back.length !== tar.length || !back.every((b, i) => b === tar[i])) {
    report("tar", "gunzip round trip does not match");
  }
}

// ---- Dimensional Pal Storage pre-scan ----

{
  /** One `CharacterID` NameProperty: name, type, u64 size, GUID flag, value. */
  const fstr = (s) => {
    const out = new Uint8Array(4 + s.length + 1);
    new DataView(out.buffer).setInt32(0, s.length + 1, true);
    out.set(new TextEncoder().encode(s), 4);
    return out;
  };
  const characterId = (value, withGuid = false) =>
    concat([
      fstr("CharacterID"),
      fstr("NameProperty"),
      new Uint8Array(8),
      withGuid ? concat([Uint8Array.of(1), new Uint8Array(16)]) : Uint8Array.of(0),
      fstr(value),
    ]);
  const noise = Uint8Array.of(12, 0, 0, 0, 67, 104, 97, 114, 0, 12, 12);
  const empty = concat([noise, characterId("None"), characterId("None", true), noise]);
  if (hasCharacters(empty)) report("scan", "storage holding only None was judged to have Pals");
  if (!hasCharacters(concat([empty, characterId("SheepBall")]))) {
    report("scan", "storage with a Pal was judged empty; it would be skipped and the Pal would vanish");
  }
  if (!hasCharacters(concat([empty, characterId("BOSS_Anubis", true)]))) {
    report("scan", "an entry with the GUID flag set was misread");
  }
}

// ---- Field extraction ----

{
  // Vendor's GUIDs are UUID objects whose `String()` is lowercase with hyphens; objects of
  // the same shape stand in for them here.
  const uuid = (n) => ({ toString: () => `0000000${n}-0000-0000-0000-000000000000` });
  const guid = (n) => ({ value: uuid(n) });
  const container = (n) => ({ value: { ID: guid(n) } });
  const byte = (v) => ({ value: { type: "None", value: v } });
  const names = (arr) => ({ value: { values: arr } });
  const pal = (id, sp) => ({
    key: { PlayerUId: guid(0), InstanceId: guid(id) },
    value: { RawData: { value: { object: { SaveParameter: { value: sp } } } } },
  });
  const slot = (c, i) => ({ value: { ContainerId: container(c), SlotIndex: { value: i } } });

  const characters = [
    {
      key: { PlayerUId: guid(1), InstanceId: guid(90) },
      value: {
        RawData: {
          value: { object: { SaveParameter: { value: { IsPlayer: { value: true }, NickName: { value: "Host" }, Level: byte(40) } } } },
        },
      },
    },
    // In the party, every field present. Attack IV comes from Talent_Shot; Talent_Melee
    // must not be read as attack.
    pal(10, {
      CharacterID: { value: "Sheepball" },
      OwnerPlayerUId: guid(1),
      SlotId: slot(2, 1),
      Level: byte(30),
      Rank: byte(5),
      Rank_Attack: byte(20),
      Talent_HP: byte(80),
      Talent_Shot: byte(95),
      Talent_Melee: byte(3),
      Talent_Defense: byte(70),
      Gender: { value: { type: "EPalGenderType", value: "EPalGenderType::Female" } },
      IsRarePal: { value: true },
      PassiveSkillList: names(["Rare", "CraftSpeed_up1"]),
      EquipWaza: names(["EPalWazaID::AquaJet"]),
      MasteredWaza: names(["EPalWazaID::Bite"]),
    }),
    // In the Palbox, with no optional fields written: they must read as their defaults.
    pal(11, { CharacterID: { value: "BOSS_Anubis" }, OwnerPlayerUId: guid(1), SlotId: slot(3, 31) }),
    // At bases: no current owner. Two containers; the one with more Pals is number 1.
    pal(12, { CharacterID: { value: "Anubis" }, SlotId: slot(7, 0) }),
    pal(13, { CharacterID: { value: "Anubis" }, SlotId: slot(8, 0) }),
    pal(14, { CharacterID: { value: "Anubis" }, SlotId: slot(8, 1) }),
    // An entry that failed to decode.
    { key: { InstanceId: guid(15) }, value: { RawData: { value: new Uint8Array(4) } } },
    // A player with a character entry but no player file.
    {
      key: { PlayerUId: guid(5), InstanceId: guid(91) },
      value: { RawData: { value: { object: { SaveParameter: { value: { IsPlayer: { value: true } } } } } } },
    },
  ];
  const playerFiles = new Map([
    [uidOf(String(uuid(1))), { OtomoCharacterContainerId: container(2), PalStorageContainerId: container(3) }],
  ]);
  const dpsSlot = (sp) => ({ SaveParameter: { value: sp } });
  const dpsFiles = new Map([
    [
      uidOf("0000000A-0000-0000-0000-000000000000"),
      [
        dpsSlot({ CharacterID: { value: "None" }, Gender: { value: { type: "EPalGenderType", value: "EPalGenderType::None" } } }),
        dpsSlot({ CharacterID: { value: "ElecCat" }, OwnerPlayerUId: guid(1), SlotId: slot(9, 4), Rank: byte(1) }),
        dpsSlot({ CharacterID: { value: "Kitsunebi" }, Gender: { value: { type: "EPalGenderType", value: "EPalGenderType::None" } } }),
      ],
    ],
  ]);

  const w = extractWorld({ meta: { name: "W", inGameDay: 3 }, characters, warnings: 2, playerFiles, dpsFiles });
  const byKey = new Map(w.pals.map((p) => [p.code, p]));
  const expect = (cond, msg) => cond || report("extract", msg);

  expect(w.players.length === 2 && w.players[0].name === "Host", `players read wrong: ${JSON.stringify(w.players)}`);
  expect(w.undecoded === 1, `undecoded entries should be 1, got ${w.undecoded}`);
  expect(w.missingPlayerFiles === 1, `players without a player file should be 1, got ${w.missingPlayerFiles}`);
  expect(w.pals.length === 7, `7 Pals expected (5 + 2 from storage), got ${w.pals.length}`);

  const sheep = byKey.get("Sheepball");
  expect(sheep?.location.kind === "party" && sheep.location.slot === 1, "the party Pal's location is wrong");
  expect(sheep?.talent.attack === 95, "the attack IV must come from Talent_Shot");
  expect(sheep?.rank === 5 && sheep.soul.attack === 20 && sheep.rare === true, "condensation / soul / lucky read wrong");
  expect(sheep?.gender === "female", "gender read wrong");
  expect(
    JSON.stringify(sheep?.equipped) === '["AquaJet"]' && JSON.stringify(sheep?.mastered) === '["Bite"]',
    "the EPalWazaID:: prefix was not stripped from skill codes",
  );

  const anubisBoss = byKey.get("BOSS_Anubis");
  expect(anubisBoss?.boss === true && anubisBoss.location.kind === "palbox", "the Alpha in the Palbox read wrong");
  expect(
    anubisBoss?.level === 1 &&
      anubisBoss.rank === 1 &&
      anubisBoss.talent.hp === 0 &&
      anubisBoss.soul.craft === 0 &&
      anubisBoss.gender === null,
    "missing fields were not read as their defaults",
  );

  const bases = w.pals.filter((p) => p.location.kind === "base");
  expect(w.bases === 2 && bases.length === 3 && bases.every((p) => p.owner === null), "base Pals should have no owner and form two groups");
  expect(bases.filter((p) => p.location.base === 1).length === 2, "bases should be numbered by Pal count, largest first");

  const dps = w.pals.filter((p) => p.location.kind === "dps");
  expect(dps.length === 2, "empty storage slots were not skipped");
  expect(byKey.get("ElecCat")?.owner === uidOf(String(uuid(1))), "a storage Pal's owner should be the one written in the file");
  expect(
    byKey.get("Kitsunebi")?.owner === uidOf("0000000A-0000-0000-0000-000000000000"),
    "a storage Pal without an owner should belong to the player the file is named after",
  );
  expect(byKey.get("Kitsunebi")?.gender === null, "EPalGenderType::None should read as no gender");

  // Only warnings under the character table count: in 1.0 worlds, warnings from structures
  // like enemy-camp treasure boxes have nothing to do with the list, and counting them would
  // flag every save as "possibly incomplete". The wording follows the vendor's gvas.js.
  const warn = (path) => `Struct type for ${path} not found, assuming StructProperty`;
  expect(
    relevantLevelWarnings([
      warn(".worldSaveData.EnemyCampSaveData.EnemyCampStatusMap.Value.TreasureBoxInfoMapBySpawnerName.Value"),
      warn(".worldSaveData.LockGimmickSaveData.Value"),
      warn(".worldSaveData.CharacterSaveParameterMap.Value.RawData.SaveParameter.Unknown"),
    ]) === 1,
    "only parser warnings under the character table should count",
  );
}

// ---- The entries we add to the vendor type table ----
//
// `type-hints.ts` only adds keys upstream lacks. If, after following upstream, upstream
// registers the same key: if the type agrees, delete ours; if it disagrees, find out who
// is right first, because ours never took effect. This compares against the **raw upstream
// table**, so it re-reads vendor source without our patch applied.
{
  const vendorSrc = readFileSync(join(root, "src/vendor/gvas.js"), "utf8");
  for (const [path, type] of Object.entries(VERIFIED_TYPE_HINTS)) {
    const m = new RegExp(`"${path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}":\\s*"([^"]+)"`).exec(vendorSrc);
    if (m) {
      report(
        "type-hints",
        m[1] === type
          ? `upstream now registers ${path}; delete that entry from src/core/type-hints.ts`
          : `upstream registers ${path} as ${m[1]}, which conflicts with our ${type}`,
      );
    }
    if (PALWORLD_TYPE_HINTS[path] !== type) report("type-hints", `${path} is not ${type} after patching`);
  }
}

// ---- Paldex data ----
//
// The viewer looks codes up in these tables and shows the raw code when it finds nothing.
// So broken data does not throw; a whole column quietly falls back to codes. These checks
// are what notices.
{
  const where = "paldex";
  // Entry counts are the first thing to go when upstream changes shape: if a filter stops
  // matching, the count jumps to 0 or doubles, while the page only gets shorter or longer.
  if (PALS.length < 250 || PALS.length > 400) report(where, `${PALS.length} Pals is outside the expected range (297 at export)`);
  if (PASSIVES.length < 100 || PASSIVES.length > 200) report(where, `${PASSIVES.length} passives is outside the expected range (115 at export)`);
  if (WAZA.length < 300 || WAZA.length > 500) report(where, `${WAZA.length} skills is outside the expected range (380 at export)`);
  if (ELEMENTS.length !== 9) report(where, `there should be 9 elements, there are ${ELEMENTS.length}`);

  const codes = new Set(PALS.map((p) => p.code));
  const elementSet = new Set(ELEMENTS.map((e) => e.code));

  for (const e of ELEMENTS) {
    for (const loc of LOCALES) if (!e.names?.[loc]) report(where, `element ${e.code} has no ${loc} name`);
  }
  for (const p of PALS) {
    for (const loc of LOCALES) if (!p.names[loc]) report(where, `Pal ${p.code} has no ${loc} name`);
    if (p.elements.length === 0) report(where, `Pal ${p.code} has no element`);
    for (const e of p.elements) if (!elementSet.has(e)) report(where, `Pal ${p.code} has unknown element ${e}`);
  }
  for (const s of PASSIVES) {
    for (const loc of LOCALES) if (!s.names[loc]) report(where, `passive ${s.code} has no ${loc} name`);
  }

  const wazaCodes = new Set();
  for (const w of WAZA) {
    if (wazaCodes.has(w.code)) report(where, `skill ${w.code} is duplicated`);
    wazaCodes.add(w.code);
    if (w.code.includes("::")) report(where, `skill ${w.code} still has the EPalWazaID:: prefix; extraction looks up stripped codes`);
    if (w.element !== null && !elementSet.has(w.element)) {
      report(where, `skill ${w.code} has unknown element ${w.element}; WAZA_ELEMENT in build-paldex.mjs is behind`);
    }
    for (const loc of LOCALES) if (!w.names[loc]) report(where, `skill ${w.code} has no ${loc} name`);
  }

  // Codes match case-insensitively (saves are inconsistent about case), so uniqueness is
  // judged in lowercase too. A clash with a Paldeck entry would never be used: lookups hit
  // the Paldeck entry first.
  const palLower = new Set(PALS.map((p) => p.code.toLowerCase()));
  const charLower = new Set();
  let humans = 0;
  for (const c of CHARACTERS) {
    const lower = c.code.toLowerCase();
    if (charLower.has(lower)) report(where, `character ${c.code} is duplicated (ignoring case)`);
    charLower.add(lower);
    if (palLower.has(lower)) report(where, `character ${c.code} has the same code as a Paldeck entry`);
    if ("family" in c) {
      if (!codes.has(c.family)) report(where, `character ${c.code}'s base species ${c.family} is not in the Paldeck`);
      continue;
    }
    if (c.human) humans++;
    for (const loc of LOCALES) if (!c.names?.[loc]) report(where, `character ${c.code} has no ${loc} name`);
    for (const e of c.elements) if (!elementSet.has(e)) report(where, `character ${c.code} has unknown element ${e}`);
  }
  // If the human table was not exported at all, every captured human shows as a code.
  if (humans < 200) report(where, `only ${humans} humans among the characters (421 at export); is the human_data.json join broken?`);

  // Translations must actually differ: when upstream loses a whole language, the fallback
  // fills it with English, and nothing throws.
  for (const loc of ["ja", "ko", "zh-CN"]) {
    const same = PALS.filter((p) => p.names[loc] === p.names.en).length;
    if (same > PALS.length * 0.5) report(where, `${same}/${PALS.length} Pals have the same ${loc} name as English; that language is probably missing`);
  }

  const pinned = join(root, "src/dex/vendor/UPSTREAM-COMMIT");
  if (!existsSync(pinned) || readFileSync(pinned, "utf8").trim() !== PALDEX_COMMIT) {
    report(where, `src/dex/vendor/UPSTREAM-COMMIT must match the "upstream" field of paldex.json (${PALDEX_COMMIT})`);
  }
}

// ---- Vendor files are the upstream files, unmodified ----
//
// The license notices and CONTRIBUTING.md rely on `src/vendor/` and `public/ooz-wasm/`
// being byte-identical copies of upstream at the pinned commit. These are git blob hashes
// (`git hash-object`) of the files in zlmitchell/palworld-save-toolkit at that commit
// (docs/js/ and docs/vendor/ooz-wasm/), so they can be compared with the upstream tree
// directly. When following upstream, update them together with src/vendor/UPSTREAM-COMMIT.
const UPSTREAM_COMMIT = "e71370ede118311e1a2b354caadb6d527ca9bcd2";
const VENDOR_BLOBS = {
  "src/vendor/gvas.js": "731635d85b9d770170ef18f848f2a9ce1b51a4b7",
  "src/vendor/migrate.js": "4b04173b570136030634df34122e729a2459a132",
  "src/vendor/paldata.js": "2a7eccd99a3afc45fad6df2dd4fc196c004153ce",
  "src/vendor/sav.js": "27bfb5316338f61db32091b18d20f19b135de9a7",
  "src/vendor/zip.js": "f0557668a74928ff6b942252c5bfc8b0b4a01a17",
  "src/vendor/LICENSE": "f288702d2fa16d3cdf0035b15a9fcbc552cd88e7",
  "public/ooz-wasm/index.js": "d5015fe3ed236f2b53f3ea7968cc40bb159bad8e",
  "public/ooz-wasm/build/ooz.js": "46d210aac4851a8adb7a5353eb1f295beef8515a",
  "public/ooz-wasm/LICENSE": "f288702d2fa16d3cdf0035b15a9fcbc552cd88e7",
};
const gitBlobHash = (buf) =>
  createHash("sha1").update(`blob ${buf.length}\0`).update(buf).digest("hex");
{
  const pinned = join(root, "src/vendor/UPSTREAM-COMMIT");
  if (!existsSync(pinned) || readFileSync(pinned, "utf8").trim() !== UPSTREAM_COMMIT) {
    report("vendor", `src/vendor/UPSTREAM-COMMIT must contain ${UPSTREAM_COMMIT}; update VENDOR_BLOBS when following upstream`);
  }
  for (const [rel, expected] of Object.entries(VENDOR_BLOBS)) {
    const file = join(root, rel);
    if (!existsSync(file)) {
      report("vendor", `${rel} is missing`);
      continue;
    }
    const got = gitBlobHash(readFileSync(file));
    if (got !== expected) {
      report("vendor", `${rel} differs from upstream (${got} != ${expected}); vendor files must not be edited`);
    }
  }
}

// ---- GPL-3.0 license texts ----
//
// All three upstreams are GPL-3.0, and shipping them to a visitor's browser is conveying in
// the GPL sense. The repository LICENSE and the upstream copies must all be on disk and be
// the same text. Palworld-Pal-Editor's copy differs only in lacking a final newline, so it
// is compared with trailing whitespace trimmed. If one of them ever changes to a different
// variant, this goes red, and that is the moment to re-read the notices in THIRD_PARTY.md,
// not an assertion to edit away.
{
  const licenses = ["LICENSE", "src/vendor/LICENSE", "public/ooz-wasm/LICENSE", "src/dex/vendor/LICENSE"];
  const missing = licenses.filter((f) => !existsSync(join(root, f)));
  for (const f of missing) {
    report("licenses", `${f} is missing; upstream license files must not be deleted`);
  }
  if (missing.length === 0) {
    const text = (f) => readFileSync(join(root, f), "utf8").trimEnd();
    const first = text(licenses[0]);
    for (const f of licenses.slice(1)) {
      if (text(f) !== first) {
        report("licenses", `${f} is no longer the same text as LICENSE; re-check the notices in THIRD_PARTY.md`);
      }
    }
  }
}

if (problems.length > 0) {
  console.error("check failed:\n");
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}

console.log(
  "check OK: backup archives (ustar, GNU long names, PAX, truncation, gzip) read correctly; " +
    "storage pre-scan and field extraction match the synthetic saves; " +
    `Paldex data consistent (${PALS.length} Pals, ${PASSIVES.length} passives, ${WAZA.length} skills, ${CHARACTERS.length} other characters); ` +
    "vendor files match upstream; license files present and identical.",
);
