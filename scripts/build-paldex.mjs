// Exports `src/dex/paldex.json` from the assets of the upstream Palworld-Pal-Editor.
//
// # Why "export" and not a vendored copy
//
// Upstream's assets are several MB each, while the fields we actually use come to a few
// hundred KB. The save parser in `src/vendor/` is **code** and is copied verbatim so that
// upstream fixes can be diffed in; this is **a projection of data**, and squeezing MBs into
// the repository would buy nothing except redoing the squeeze on every update.
//
// The price is that this step needs the network, so it is **not part of `npm run check`**:
// `scripts/check.mjs` only verifies offline that the output is self-consistent (entry
// counts, all five languages present, references resolve). Run this script by hand when
// following upstream.
//
// # GPL-3.0
//
// Upstream is GPL-3.0 (license text in `src/dex/vendor/LICENSE`, commit in
// `UPSTREAM-COMMIT`). The output is a derivative work, so **its corresponding source is
// upstream at that commit plus this script**, both of which are public.
//
// This differs from `src/vendor/`, which is used unmodified: there the corresponding source
// is the upstream repository itself; here there is one more layer, this script.
//
// The output also covers fields this viewer does not read (breeding data, work
// suitability, passive descriptions). It is kept identical to the data the hosted tool
// ships, so the two can be compared byte for byte.
//
// Usage: node scripts/build-paldex.mjs [--check]
//   --check only compares, without writing; exits non-zero when the output differs from
//   upstream (use it to see the diff when following upstream).
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const vendorDir = join(root, "src/dex/vendor");
const outPath = join(root, "src/dex/paldex.json");

const sha = readFileSync(join(vendorDir, "UPSTREAM-COMMIT"), "utf8").trim();
const raw = (p) =>
  `https://raw.githubusercontent.com/KrisCris/Palworld-Pal-Editor/${sha}/src/palworld_pal_editor/assets/data/${p}`;

/**
 * Upstream locale keys -> ours.
 *
 * **zh-TW -> zh-Hant is a rename, not a translation**: upstream keys by region (zh-TW),
 * we key by script (zh-Hant). Both mean the same official Traditional Chinese text.
 */
const LOCALES = { en: "en", ja: "ja", ko: "ko", "zh-CN": "zh-CN", "zh-Hant": "zh-TW" };

/** palcalc's locale keys (it keys Chinese by script). Only element names use them. */
const PALCALC_LOCALES = { en: "en", ja: "ja", ko: "ko", "zh-CN": "zh-Hans", "zh-Hant": "zh-Hant" };

/**
 * Display order. **The values themselves come from the data; this only sorts them.** A
 * hand-copied list of internal names ends up one letter off from upstream (`Normal` vs
 * `Neutral`, `ProduceMedicine` vs `ProductMedicine`), and that kind of mistake shows up as
 * a column that is silently empty.
 *
 * Values that are in neither list are appended at the end with a warning: when upstream
 * adds a new element or work type we want to know, not have it quietly sorted last.
 */
const ELEMENT_ORDER = [
  "Neutral", "Fire", "Water", "Grass", "Electric", "Ice", "Ground", "Dark", "Dragon",
];
const WORK_ORDER = [
  "EmitFlame", "Watering", "Seeding", "GenerateElectricity", "Handcraft", "Collection",
  "Deforest", "Mining", "ProductMedicine", "Cool", "Transport", "MonsterFarm",
];

/** Sort by `order`; anything not in `order` goes last (and the caller is warned). */
function ordered(values, order, what) {
  const known = order.filter((k) => values.has(k));
  const extra = [...values].filter((v) => !order.includes(v)).sort();
  if (extra.length > 0) {
    console.warn(`warning: upstream has new ${what}: ${extra.join(", ")}; sorted last, check the display order`);
  }
  const missing = order.filter((k) => !values.has(k));
  if (missing.length > 0) {
    console.warn(`warning: upstream no longer has ${what}: ${missing.join(", ")}; renamed?`);
  }
  return [...known, ...extra];
}

/** `EPalTribeID::SheepBall` -> `SheepBall`. Upstream's tribe matches InternalName. */
function tribeOf(v) {
  return typeof v === "string" ? v.split("::").pop() : null;
}

/** `EPalGenderType::Female` -> `"female"`; `None` (any) -> null. */
function genderOf(v) {
  const g = typeof v === "string" ? v.split("::").pop() : null;
  return g === "Male" || g === "Female" ? g.toLowerCase() : null;
}

/**
 * Retry with backoff when the connection is dropped (ECONNRESET): behind some proxies, TLS
 * connections to raw.githubusercontent are cut, several concurrent requests get cut
 * together, and an immediate retry gets cut again; reconnecting a second or two later
 * works. HTTP error codes are not retried: those mean a wrong URL or commit.
 */
async function fetchJson(url) {
  for (let attempt = 1; ; attempt++) {
    let res;
    try {
      res = await fetch(url);
    } catch (err) {
      if (attempt >= 5) throw err;
      await new Promise((r) => setTimeout(r, 1000 * attempt));
      continue;
    }
    if (!res.ok) throw new Error(`${res.status} ${res.statusText} - ${url}`);
    return res.json();
  }
}

/** Upstream I18n holds both `{Name, Description}` objects and bare strings; accept both. */
function i18nField(node, field) {
  if (node === undefined || node === null) return null;
  if (typeof node === "string") return field === "Name" ? node : null;
  return node[field] ?? null;
}

function localized(i18n, field) {
  const out = {};
  for (const [ours, theirs] of Object.entries(LOCALES)) {
    const v = i18nField((i18n ?? {})[theirs], field);
    // Fall back to English rather than leaving it empty: an empty name is an invisible row.
    out[ours] = v ?? i18nField((i18n ?? {}).en, field) ?? "";
  }
  return out;
}

/**
 * Names upstream uses as placeholders: `en Text`, `de_Text`, `-`, `Unidentified Pal`, or
 * just the internal name.
 *
 * Only the two tables the save viewer adds (skills, characters) use this. The Paldex and
 * passives keep `localized`'s "fall back to English", so their output stays byte-identical
 * to before (`--check`).
 */
function isPlaceholder(name, code) {
  const s = String(name ?? "").trim();
  return (
    s === "" ||
    s === code ||
    /^-+$/.test(s) ||
    /^[a-z]{2}(-[A-Za-z]+)?[_ ]text$/i.test(s) ||
    /^unidentified pal$/i.test(s)
  );
}

/**
 * Names in five languages; a language that is a placeholder falls back to English. When
 * English itself is a placeholder this returns null and the caller drops the entry.
 *
 * Dropped rather than exported with the placeholder: the viewer shows unknown codes as
 * stored, and "en Text" is harder to recognise than the code, and looks like our bug.
 */
function realNames(i18n, code) {
  const en = i18nField((i18n ?? {}).en, "Name");
  if (isPlaceholder(en, code)) return null;
  const out = {};
  for (const [ours, theirs] of Object.entries(LOCALES)) {
    const v = i18nField((i18n ?? {})[theirs], "Name");
    out[ours] = isPlaceholder(v, code) ? en : v;
  }
  return out;
}

/**
 * The skill table spells elements differently (like palcalc: `Leaf` / `Electricity` /
 * `Earth` / `Normal`); map them to the Paldex's nine internal names. `None` is a
 * non-elemental move (throws, scratches) and is exported as null.
 */
const WAZA_ELEMENT = {
  Normal: "Neutral",
  Fire: "Fire",
  Water: "Water",
  Leaf: "Grass",
  Electricity: "Electric",
  Ice: "Ice",
  Earth: "Ground",
  Dark: "Dark",
  Dragon: "Dragon",
  None: null,
};

const PALCALC_DB =
  "https://raw.githubusercontent.com/tylercamp/palcalc/main/PalCalc.Model/db.json";

// The sources are independent, so fetch them concurrently: serially would add several full
// round trips, and they are files of several MB each.
const [palData, passiveData, palcalc, attackData, humanData] = await Promise.all([
  fetchJson(raw("pal_data.json")),
  fetchJson(raw("pal_passives.json")),
  fetchJson(PALCALC_DB),
  fetchJson(raw("pal_attacks.json")),
  fetchJson(raw("human_data.json")),
]);

/**
 * Official element names come from **another source**: tylercamp/palcalc's db.json (MIT).
 *
 * Pal-Editor's assets have no localised element names (its UI uses icons), and these nine
 * names cannot be guessed: in Korean, 무속성 and 노멀 do not mean the same thing. palcalc
 * carries the official five-language names, matched by **English name** (the internal
 * names differ: it writes Normal/Leaf/Electricity/Earth, Pal-Editor writes
 * Neutral/Grass/Electric/Ground).
 */
const elementNames = new Map(
  (palcalc.Elements ?? []).map((e) => [
    e.Name,
    Object.fromEntries(
      Object.entries(PALCALC_LOCALES).map(([ours, theirs]) => [
        ours,
        e.LocalizedNames[theirs] ?? e.Name,
      ]),
    ),
  ]),
);

// `base` is the Paldeck entry; boss / alpha / raid variants share it and get no row of
// their own. Upstream's tribe and InternalName occasionally differ in case
// (`Blueplatypus` vs `BluePlatypus`), so codes always resolve case-insensitively. Without
// that, those two unique recipes would silently point at nothing.
const codeByLower = new Map(
  Object.values(palData)
    .filter((p) => !p.Invalid)
    .map((p) => [String(p.InternalName).toLowerCase(), p.InternalName]),
);
const resolveCode = (v) => (v === null ? null : (codeByLower.get(v.toLowerCase()) ?? v));

const pals = Object.values(palData)
  .filter((p) => p.VariantKind === "base" && !p.Invalid)
  .map((p) => {
    const b = p.Breeding ?? {};
    const work = {};
    for (const [k, v] of Object.entries(p.Suitabilities ?? {})) {
      const short = k.split("::").pop();
      if (v > 0) work[short] = v;
    }
    return {
      code: p.InternalName,
      dex: p.PaldeckIndex ?? null,
      suffix: p.PaldeckSuffix ?? "",
      names: localized(p.I18n, "Name"),
      elements: p.Elements ?? [],
      rank: b.CombiRank ?? null,
      // Breaks ties (lower wins). Without it, pairs with equal rank drift with array order.
      priority: b.CombiDuplicatePriority ?? null,
      // Not part of the "nearest rank" rule; only reachable through uniqueRecipes (legendaries).
      ignoreCombi: Boolean(b.IgnoreCombi),
      // Unique recipes. Upstream records tribes (`EPalTribeID::X`), which match our codes.
      // **The child must be kept**: one parent pair can appear in several Pals' tables
      // (mirrored records), so storing only the pair would map it to several children.
      // **Genders must be kept**: one pair in the whole table (CatMage x FoxMage) gives a
      // different child depending on which parent is male. `EPalGenderType::None` means
      // any and is exported as null.
      uniqueRecipes: (b.UniqueRecipes ?? []).map((r) => ({
        a: resolveCode(tribeOf(r.ParentTribeA)),
        ga: genderOf(r.ParentGenderA),
        b: resolveCode(tribeOf(r.ParentTribeB)),
        gb: genderOf(r.ParentGenderB),
        child: resolveCode(r.ChildCharacterID ?? null),
      })),
      work,
    };
  })
  .sort((a, b) => (a.dex ?? 9999) - (b.dex ?? 9999) || a.suffix.localeCompare(b.suffix));

const passives = Object.values(passiveData)
  .map((s) => ({
    code: s.InternalName,
    rating: s.Rating ?? 0,
    names: localized(s.I18n, "Name"),
    descs: localized(s.I18n, "Description"),
  }))
  .sort((a, b) => b.rating - a.rating || a.names.en.localeCompare(b.names.en));

// ---- The two extra tables the save viewer needs ----

/**
 * Active skills. Saves write `EPalWazaID::AquaJet`; this stores the part after the prefix,
 * and extraction strips it the same way.
 *
 * Entries whose names are placeholders in every language are not exported: the viewer
 * shows those as codes, like any unknown code.
 */
const unknownWazaElements = new Set();
const waza = Object.values(attackData)
  .map((a) => {
    const code = String(a.InternalName).split("::").pop();
    const names = realNames(a.I18n, code);
    if (!(a.Element in WAZA_ELEMENT)) unknownWazaElements.add(a.Element);
    return names && { code, element: WAZA_ELEMENT[a.Element] ?? null, names };
  })
  .filter(Boolean)
  .sort((a, b) => a.code.localeCompare(b.code));
if (unknownWazaElements.size > 0) {
  console.warn(`warning: the skill table has new elements: ${[...unknownWazaElements].join(", ")}; add them to WAZA_ELEMENT`);
}

/**
 * Characters outside the Paldeck that still show up in saves: Alphas and other variants,
 * base species upstream marks Invalid, and captured humans.
 *
 * Two shapes:
 *   - `{ code, family }`: a variant of a Paldeck entry (`BOSS_SheepBall`,
 *     `POLICE_ThunderDog`); name and elements come from the base species. Matched by
 *     upstream's `FamilyID`, not by stripping prefixes, because suffixes such as
 *     `BOSS_KingWhale_otomo` exist too.
 *   - `{ code, names, elements }`: not in the Paldeck, but upstream has a real name for it
 *     (Invalid base species such as `KingWhale`; humans such as `Hunter_Rifle`). `human`
 *     marks humans, for which the viewer shows no elements.
 *
 * `icon` is only included when the icon file name differs from both the code and the base
 * species (humans mostly share one). This repository does not ship icons; the field is
 * kept so the output stays identical to the hosted tool's.
 */
const palCodes = new Set(pals.map((p) => p.code.toLowerCase()));
const upstreamByLower = new Map(
  Object.values(palData).map((p) => [String(p.InternalName).toLowerCase(), p]),
);
const characters = new Map();
const iconUnlessSame = (iconKey, ...same) =>
  iconKey && !same.some((s) => s && s.toLowerCase() === String(iconKey).toLowerCase())
    ? { icon: iconKey }
    : {};

for (const p of Object.values(palData)) {
  const code = String(p.InternalName);
  if (palCodes.has(code.toLowerCase())) continue;
  const familyLower = String(p.FamilyID ?? "").toLowerCase();
  if (palCodes.has(familyLower)) {
    const family = resolveCode(p.FamilyID);
    characters.set(code.toLowerCase(), { code, family, ...iconUnlessSame(p.IconKey, code, family) });
    continue;
  }
  const base = upstreamByLower.get(familyLower) ?? p;
  const names = realNames(base.I18n, String(base.InternalName));
  if (!names) continue;
  characters.set(code.toLowerCase(), {
    code,
    names,
    elements: base.Elements ?? [],
    ...iconUnlessSame(p.IconKey, code),
  });
}
for (const h of Object.values(humanData)) {
  const code = String(h.InternalName);
  // When a code appears on both sides, the Pal entry wins: it has elements.
  if (palCodes.has(code.toLowerCase()) || characters.has(code.toLowerCase())) continue;
  const names = realNames(h.I18n, code);
  if (!names) continue;
  characters.set(code.toLowerCase(), {
    code,
    names,
    elements: [],
    human: true,
    ...iconUnlessSame(h.IconKey, code),
  });
}

const out = {
  // Shows at a glance which commit the output came from; check.mjs compares it too.
  upstream: sha,
  elements: ordered(new Set(pals.flatMap((p) => p.elements)), ELEMENT_ORDER, "elements").map(
    (code) => ({ code, names: elementNames.get(code) ?? null }),
  ),
  work: ordered(new Set(pals.flatMap((p) => Object.keys(p.work))), WORK_ORDER, "work types"),
  pals,
  passives,
  waza,
  characters: [...characters.values()].sort((a, b) => a.code.localeCompare(b.code)),
};

const text = JSON.stringify(out, null, 2) + "\n";
const digest = (s) => createHash("sha256").update(s).digest("hex").slice(0, 12);

if (process.argv.includes("--check")) {
  const current = readFileSync(outPath, "utf8");
  if (current === text) {
    console.log(`paldex matches upstream ${sha.slice(0, 8)}: ${pals.length} Pals, ${passives.length} passives.`);
    process.exit(0);
  }
  console.error(
    `paldex.json differs from upstream ${sha.slice(0, 8)}: on disk ${digest(current)}, exported ${digest(text)}\n` +
      "  -> run `node scripts/build-paldex.mjs` to export again, and review the diff by hand",
  );
  process.exit(1);
}

writeFileSync(outPath, text);
console.log(
  `Wrote src/dex/paldex.json: ${pals.length} Pals, ${passives.length} passives, ` +
    `${pals.filter((p) => p.uniqueRecipes.length > 0).length} with unique recipes, ` +
    `${waza.length} skills, ${out.characters.length} characters outside the Paldeck (upstream ${sha.slice(0, 8)}).`,
);
