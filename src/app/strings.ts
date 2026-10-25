/**
 * Every user-facing string in the UI. Kept in one object so another language can be added
 * later by providing a second object of the same `Strings` type and picking one at start-up
 * (the Paldex data already carries five languages; see `saveDexFor`).
 *
 * Messages with parameters are functions; numbers go through `num()` so they are formatted
 * for the UI language rather than printed raw.
 */
import type { Locale } from "../dex/index";

const LOCALE = "en";
const numberFormat = new Intl.NumberFormat(LOCALE);
const dateFormat = new Intl.DateTimeFormat(LOCALE, { dateStyle: "medium", timeStyle: "short" });

export const num = (n: number): string => numberFormat.format(n);
export const dateTime = (ms: number): string => dateFormat.format(new Date(ms));

export const HOSTED_URL =
  "https://www.keepworlds.com/tools/palworld-iv-checker?utm_source=github&utm_medium=referral&utm_campaign=palworld_2610_github_ivchecker";
export const SOURCE_URL = "https://github.com/keepworlds-dev/palworld-iv-checker";

export const en = {
  lang: LOCALE,
  /** Which language of the Paldex data to show names in. */
  dexLocale: "en" as Locale,
  title: "Palworld IV Checker",
  lead:
    "Pick your save folder and every Pal in the world is listed at once: IVs, passives, skills, condensation and soul boosts, including other players' Pals on a dedicated server.",
  trust: "Runs entirely in your browser. Your save is never uploaded anywhere and never changed.",

  pickFolder: "Choose Save Folder",
  pickFiles: "or choose a backup archive or .sav files",
  dropHint:
    "You can also drop a folder or a .tar.gz backup here. Read in your browser only; nothing is uploaded or changed.",
  opening: "Reading files…",
  parsing: "Parsing the world. Large worlds take ten seconds or more…",
  chooseWorld: (n: number) => `Found ${num(n)} worlds. Pick one to view:`,
  worldUnnamed: "Unnamed world",
  worldDay: (day: number) => `Day ${num(day)}`,
  worldModified: (time: string) => `Modified ${time}`,
  otherWorld: "View Another World",
  reset: "Use Another Save",

  errors: {
    zip: ".zip files aren't supported yet. Unzip it first, then pick the SaveGames folder inside.",
    badArchive:
      "This archive couldn't be read. It may not have finished downloading, or it isn't a .tar.gz of a save folder. Download it again and retry.",
    noWorld: "No Level.sav found. Pick the SaveGames folder, a world's folder, or a .tar.gz backup of one.",
    noWorldArchive: "No Level.sav found in the archive. Make sure it's a backup of a Palworld save folder.",
    empty:
      "No files were read. If the save is in OneDrive or iCloud, set the folder to always keep on this device and try again.",
    generic: (detail: string) => `Couldn't read the save: ${detail}`,
  },

  summary: {
    title: "Overview",
    pals: "Pals",
    players: "Players",
    dex: "Paldeck",
    dexValue: (n: number, total: number) => `${num(n)} / ${num(total)}`,
    rare: "Lucky Pals",
  },
  unnamedPlayer: (n: number) => `Player ${num(n)}`,
  unknownPlayer: "Unknown player",
  ownerOption: (name: string, n: number) => `${name} (${num(n)})`,
  notes: {
    dps: (n: number) => `Includes ${num(n)} Pals from Dimensional Pal Storage.`,
    base: (n: number) =>
      `Base Pals are grouped into ${num(n)} bases by number. The numbers don't match the base names in the game.`,
    missingPlayers: (n: number) =>
      `${num(n)} players have no player file, so their party and Palbox can't be told apart. Their Pals are under "Other".`,
    undecoded: (n: number) => `${num(n)} Pals couldn't be parsed and aren't listed.`,
    warnings: (n: number) =>
      `The save has ${num(n)} structures the parser doesn't recognize. A few values may be incomplete.`,
  },

  listTitle: "Pal list",
  filters: {
    search: "Search name, nickname, passive or skill",
    owner: "Owner",
    ownerAll: "All owners",
    ownerBase: "Base",
    location: "Location",
    locationAll: "All locations",
    sort: "Sort by",
  },
  location: {
    party: "Party",
    palbox: "Palbox",
    dps: "Dimensional Pal Storage",
    base: "Base",
    other: "Other",
  },
  locationDetail: {
    party: (n: number) => `Party slot ${num(n)}`,
    palbox: (page: number) => `Palbox page ${num(page)}`,
    base: (n: number) => `Base ${num(n)}`,
  },
  sort: {
    ivTotal: "IV total",
    attack: "Attack IV",
    defense: "Defense IV",
    hp: "HP IV",
    level: "Level",
    rank: "Condensation",
    name: "Name",
  },
  flags: {
    rare: "Lucky",
    boss: "Alpha",
    condensed: "Condensed",
    souled: "Soul boosted",
  },
  shownCount: (shown: number, total: number) => `Showing ${num(shown)} of ${num(total)}`,
  empty: "No Pals match these filters.",
  col: {
    pal: "Pal",
    level: "Lv",
    rank: "Condensed",
    hp: "HP",
    attack: "Atk",
    defense: "Def",
    soul: "Souls",
    passives: "Passives",
    skills: "Skills",
    owner: "Owner",
    location: "Location",
  },
  unknownCode: "Not in the Paldex data yet; shown as stored",
  gender: { male: "Male", female: "Female" },
  tags: { rare: "Lucky", boss: "Alpha", human: "Human" },
  stars: (n: number) => `Condensed ${num(n)}★`,
  soul: {
    hp: (n: number) => `HP Lv ${num(n)}`,
    attack: (n: number) => `Atk Lv ${num(n)}`,
    defense: (n: number) => `Def Lv ${num(n)}`,
    craft: (n: number) => `Work Lv ${num(n)}`,
  },
  mastered: (n: number) => `+${num(n)} learned`,
  showMore: (n: number) => `Show ${num(n)} More`,

  whereTitle: "Where your save is",
  whereLead:
    "Any of these can be picked or dropped in directly. You don't need to find a specific file; the tool finds the worlds inside.",
  where: [
    {
      title: "A world on your own PC",
      path: "%LOCALAPPDATA%\\Pal\\Saved\\SaveGames",
      desc:
        "Steam single-player or invite-code co-op saves. Paste the path above into File Explorer's address bar, press Enter, and pick the SaveGames folder that opens. Every world inside is listed.",
    },
    {
      title: "A dedicated server world",
      path: "Pal/Saved/SaveGames/0",
      desc:
        "On a server you run yourself, the save lives under this folder inside the server's install folder. Copy the whole folder to your PC and pick it. If a hosting panel gave you a .zip, unzip it first.",
    },
    {
      title: "A .tar.gz backup",
      path: null,
      desc:
        "An archive of a world's save folder, for example one downloaded from your server host. No need to extract it: pick it or drop it in. This one also works on a phone.",
    },
  ],

  columnsTitle: "Reading the columns",
  columnsLead: "Every value is taken straight from the save. Nothing is estimated.",
  columns: [
    {
      title: "IVs (HP / Attack / Defense)",
      desc:
        "Three random stats each Pal is born with, from 0 to 100. Higher means a stronger stat at the same level. 90 and up is shown in bold, under 30 is greyed out. Sort by IV total to find good breeding stock fastest. 1.0 saves record a single Attack IV.",
    },
    {
      title: "Condensation",
      desc: 'How many stars the Pal has been condensed to, up to 4. Shows "—" if it never was.',
    },
    {
      title: "Soul boosts",
      desc:
        "Which stats were boosted with Pal Souls, and to what level, up to 20 each. HP, Attack, Defense and Work Speed are listed separately; stats that were never boosted aren't shown.",
    },
    {
      title: "Passives",
      desc: "Green are good traits, red are bad ones. Names are the game's official translations.",
    },
    {
      title: "Skills",
      desc:
        'The active skills currently equipped. Skills it has learned but not equipped show as "+n learned"; hover over it to see which.',
    },
    {
      title: "Owner",
      desc:
        'Which player the Pal belongs to now, so each player\'s Pals on a dedicated server are kept apart. Pals assigned to work at a base have no current owner in the save and show as "Base".',
    },
    {
      title: "Location",
      desc:
        "Party, Palbox, Dimensional Pal Storage or a base. Palbox entries give a page number at 30 slots per page. Bases are only grouped by number, which doesn't match the base names in the game.",
    },
  ],

  copy: "Copy",
  copied: "Copied",

  footer: {
    credits:
      "Save parsing by zlmitchell/palworld-save-toolkit and Oodle decompression by SnosMe/ooz-wasm, both GPL-3.0. Pal, skill and passive names from KrisCris/Palworld-Pal-Editor (GPL-3.0).",
    source: "Source code",
    maintained: "Maintained by KeepWorlds.",
  },
};

export type Strings = typeof en;
