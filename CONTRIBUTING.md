# Contributing

Issues and pull requests are welcome. Before opening one, run:

```sh
npm ci
npm run check   # type-check + scripts/check.mjs
npm run build
```

Please never attach a real save to an issue or add one to the repository: saves contain
players' names and IDs. Describe what you see, or share counts, codes and values instead.

## Layout

| Path | What it is | Edit? |
| --- | --- | --- |
| `src/viewer/` | The worker: archive reading, the storage pre-scan, field extraction | Yes |
| `src/core/` | File classification and type hints, shared with [palworld-save-converter](https://github.com/keepworlds-dev/palworld-save-converter) | Keep in sync |
| `src/dex/` | Paldex data (`paldex.json`, generated) and the lookup tables built from it | Data: regenerate only |
| `src/app/` | The single-page UI | Yes |
| `src/vendor/` | Save parser from zlmitchell/palworld-save-toolkit | **Never** |
| `public/ooz-wasm/` | Oodle decompressor from SnosMe/ooz-wasm | **Never** |
| `scripts/check.mjs` | Static checks run in CI | Yes |
| `scripts/build-paldex.mjs` | Exports `src/dex/paldex.json` from upstream | Yes |

## Never edit `src/vendor/` or `public/ooz-wasm/`

These files are byte-for-byte copies of upstream, and `npm run check` fails if they differ.
There are two reasons:

1. **Following upstream.** Every time Palworld changes its save format, community save
   tools break together. The way to catch up is to diff upstream's fix in. Once our copy
   has been edited or rewritten, that diff no longer applies and every update becomes a
   reimplementation.
2. **License notices.** THIRD_PARTY.md says these are unmodified copies of upstream at a
   pinned commit. Editing them would make that untrue.

To change behaviour, change `src/viewer/`. Missing map types for the GVAS parser go in
`src/core/type-hints.ts`, which adds keys to the vendor table at runtime without touching
the file.

`src/core/` is the same code as in palworld-save-converter. A change there belongs in both
repositories.

## How fields are read

`src/viewer/extract.ts` reads the property tree vendor produces. These rules were checked
against three real Palworld 1.0 worlds (a single-player world, the same world moved to a
dedicated server, and a six-player server world with 1,760 Pals plus Dimensional Pal
Storage) and against the field semantics in Palworld-Pal-Editor's `pal_entity.py`.

- **Defaults are not written.** A field holding its default value is left out of the
  save, so a missing field means the default, not "unreadable": `Level` 1; condensation
  `Rank` 1 (no stars; only 2 to 5 appear); soul boosts `Rank_HP` / `Rank_Attack` /
  `Rank_Defence` / `Rank_CraftSpeed` 0 (max 20); `Talent_*` 0; `IsRarePal` only appears
  when true.
- **The Attack IV is `Talent_Shot`.** None of the 1,760 Pals had `Talent_Melee`, and
  Palworld-Pal-Editor computes attack from `Talent_Shot` only.
- **Codes match case-insensitively.** The same species is `Sheepball` in one save and
  `SheepBall` in another; the game itself is inconsistent.
- **Variants** (`BOSS_` for Alphas, `POLICE_ThunderDog`, `BOSS_KingWhale_otomo`, ...) map to
  their base species through upstream's `FamilyID`.
- **Humans** can be captured in 1.0. Their names come from upstream's `human_data.json`.
  Humans have no `Gender` field, so a missing gender shows nothing.
- **Unknown codes are shown as stored**, never dropped. Game updates land before the
  Paldex data catches up.
- **Party and Palbox** are decided by container: a Pal whose `SlotId.ContainerId` equals a
  player file's `OtomoCharacterContainerId` is in that player's party, and
  `PalStorageContainerId` means their Palbox.
- **Base Pals** sit in other containers and have no `OwnerPlayerUId`, so their owner shows
  as "Base". `OldOwnerPlayerUIds` cannot stand in for the owner: its order is not stable.
  Pals in the same container form one group, numbered by size; base names live in a blob
  the parser leaves undecoded.
- **Dimensional Pal Storage** (`Players/<guid>_dps.sav`) has 9600 slots per player; empty
  slots have `CharacterID` `None`. `src/viewer/scan.ts` skips files whose slots are all
  empty without parsing them.

The mapping from save values to what the game shows is indirect: stars = `Rank` - 1 and
the soul boost levels follow upstream's semantics, and Palbox pages of 30 slots are
inferred from slot indices. If you find a Pal whose in-game panel disagrees, please open an
issue with the values from both.

## Following upstream

### The save parser

```sh
git clone https://github.com/zlmitchell/palworld-save-toolkit /tmp/pst
cd /tmp/pst && git log -1 --format=%H    # the commit you are syncing to

# Compare (only these five files and the ooz-wasm folder are used here)
diff -u src/vendor/gvas.js    /tmp/pst/docs/js/gvas.js
diff -u src/vendor/sav.js     /tmp/pst/docs/js/sav.js
diff -u src/vendor/migrate.js /tmp/pst/docs/js/migrate.js
diff -u src/vendor/paldata.js /tmp/pst/docs/js/paldata.js
diff -u src/vendor/zip.js     /tmp/pst/docs/js/zip.js
diff -ru public/ooz-wasm      /tmp/pst/docs/vendor/ooz-wasm
```

Then:

1. Copy the changed files over unmodified.
2. Write the new commit hash into `src/vendor/UPSTREAM-COMMIT`.
3. Update `UPSTREAM_COMMIT` and the `VENDOR_BLOBS` hashes in `scripts/check.mjs`
   (`git hash-object <file>` prints them, and they should match the upstream tree).
4. Run `npm run check` and `npm run build`. If check reports that upstream now registers
   one of our type hints, delete that entry from `src/core/type-hints.ts`.
5. Note the new commit in THIRD_PARTY.md.

`npm run check` proves types and file integrity, but **not that parsing is still correct**.
Open a real world from the current game version in the viewer, check the totals, and
compare a few Pals with their in-game status panel.

### The Paldex data

1. Write the new Palworld-Pal-Editor commit into `src/dex/vendor/UPSTREAM-COMMIT`.
2. Run `npm run build:paldex` (needs network access) and review the diff of
   `src/dex/paldex.json`. Warnings about new elements or work types mean the order lists in
   the script need a look.
3. Run `npm run check`; it verifies counts, five-language names and references.
4. Note the new commit in THIRD_PARTY.md.

## Code style

- Comments explain **why**, not what.
- No runtime dependencies, no analytics, and no network requests except loading the app's
  own static files. Save files must never leave the browser.
- The viewer is read-only. Changes that write to a save are out of scope.
