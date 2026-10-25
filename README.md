**English** | [한국어](README.ko.md) | [日本語](README.ja.md) | [繁體中文](README.zh-Hant.md) | [简体中文](README.zh-CN.md)

# Palworld IV Checker

List every Pal in a Palworld world with its IVs, passives, skills, condensation, soul boosts and owner, read straight from the save. Everything runs in your browser: the save never leaves your computer and is never changed.

**Use it online:** [Palworld IV Checker](https://www.keepworlds.com/tools/palworld-iv-checker?utm_source=github&utm_medium=referral&utm_campaign=palworld_2610_github_ivchecker)

## Why you need it

In game you can only check Pals one at a time, and on a dedicated server you cannot see the Pals of players who are offline. The save already holds all of it. This tool lists every Pal in the world in one table, so you can sort by IVs to pick breeding stock or see what each player owns.

## What it shows

- **IVs** for HP, Attack and Defense (0 to 100). 90 and up is bold, under 30 is greyed out. 1.0 saves record a single Attack IV.
- **Condensation** stars, **soul boost** levels (HP, Attack, Defense, Work Speed, up to 20 each), **passives** (good ones green, bad ones red), equipped **skills** and how many more it has learned.
- **Owner**: which player the Pal belongs to. Pals working at a base have no current owner in the save and show as "Base".
- **Location**: party slot, Palbox page (30 slots per page), Dimensional Pal Storage, or a base. Bases are grouped by number; the numbers do not match the base names in the game.
- An overview with the number of Pals, players, Paldeck entries collected and Lucky Pals, plus Pals per player.
- Search by name, nickname, passive or skill; filter by owner, location, Lucky, Alpha, condensed or soul boosted; sort by IV total, any single IV, level, condensation or name.
- Alphas, variants and captured humans get their proper names. Pals or skills newer than the bundled Paldex data are shown by their code instead of being dropped.
- Works with Palworld 1.0 saves (Oodle-compressed `PlM`) and older zlib saves (`PlZ`), from Steam local worlds and dedicated servers. Xbox, PlayStation and PC Game Pass saves are not supported.

It only reads. An edited save can load fine and then break in game, and on a dedicated server, changing IVs and passives affects the other players too, so this tool does not edit anything.

## How to use

1. **Find your save.** Any of these can be picked or dropped in; you do not need to find a specific file.
   - A world on your Windows PC (Steam): `%LOCALAPPDATA%\Pal\Saved\SaveGames`. Paste it into File Explorer's address bar and pick the `SaveGames` folder. Every world inside is listed.
   - A dedicated server world: `Pal/Saved/SaveGames/0` inside the server's install folder. Copy it to your computer first. If a hosting panel gave you a `.zip`, unzip it.
   - A `.tar.gz` backup of a save folder: pick or drop it as is, no need to extract. This also works on a phone.
2. **Open the tool** and choose the folder, or drop it onto the page.
3. **Pick a world** if there is more than one.
4. **Sort and filter** the list.

Large worlds take ten seconds or more to read. Empty Dimensional Pal Storage files are skipped without being parsed, which keeps big servers quick.

## Run it locally

Requires Node.js 22.18 or later.

```sh
npm install
npm run dev
```

`npm run build` writes a static site to `dist/` that you can serve from anywhere. `npm run check` runs the type-check and the static checks in `scripts/check.mjs`.

## Credits

The save parser comes unmodified from [zlmitchell/palworld-save-toolkit](https://github.com/zlmitchell/palworld-save-toolkit), and Oodle decompression from [SnosMe/ooz-wasm](https://github.com/SnosMe/ooz-wasm) (based on [powzix/ooz](https://github.com/powzix/ooz)), both under GPL-3.0. Pal, passive and skill names are exported from [KrisCris/Palworld-Pal-Editor](https://github.com/KrisCris/Palworld-Pal-Editor) (GPL-3.0), and element names from [tylercamp/palcalc](https://github.com/tylercamp/palcalc) (MIT). Field layouts follow [palworld-save-tools](https://github.com/cheahjs/palworld-save-tools) (MIT). No game artwork is included. See [THIRD_PARTY.md](THIRD_PARTY.md).

## License

[GPL-3.0](LICENSE).

Maintained by [KeepWorlds](https://www.keepworlds.com/?utm_source=github&utm_medium=referral&utm_campaign=palworld_2610_github_ivchecker), Palworld dedicated server hosting. Not affiliated with Pocketpair.
