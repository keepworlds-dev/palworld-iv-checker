/**
 * The screen after a world has been read: overview, filters, table. Read-only; nothing is
 * written back or downloaded.
 *
 * # Where names come from
 *
 * The worker only returns codes and numbers (it does not know the UI language); names and
 * elements are matched up here against `SaveDex`. Codes it cannot find are **shown as
 * stored**, not dropped: game updates always land before the Paldex data catches up, and
 * dropping them would make new Pals vanish from the list.
 *
 * # Only one page is rendered at a time
 *
 * A world with a few hundred hours in it holds one or two thousand Pals. Rendering them all
 * at once means thousands of badges, re-laid out on every keystroke in the search box, so
 * the table shows {@link PAGE} rows and "Show more" appends the next batch.
 */
import type { SaveDex, SaveDexCharacter } from "../dex/save-dex";
import type { ViewerPal, ViewerWorld } from "../viewer/index";
import { h, selectField, setChildren, setPressed, toggle, type Child } from "./dom";
import { num, type Strings } from "./strings";

const PAGE = 100;

const SORTS = ["ivTotal", "attack", "defense", "hp", "level", "rank", "name"] as const;
type SortKey = (typeof SORTS)[number];

const LOCATIONS = ["party", "palbox", "dps", "base", "other"] as const;

const FLAGS = ["rare", "boss", "condensed", "souled"] as const;
type Flag = (typeof FLAGS)[number];

/** Option values for "any" and "base". Not real player IDs, so they cannot collide with one. */
const ANY = "__any__";
const BASE_OWNER = "__base__";

/** Palbox pages hold 30 slots; the page number only helps people find the Pal in game. */
const PALBOX_PAGE = 30;

const ivTotal = (p: ViewerPal) => p.talent.hp + p.talent.attack + p.talent.defense;

/** A Pal with its Paldex entry; when none is found `entry` is null and the name falls back to the code. */
type Row = { pal: ViewerPal; entry: SaveDexCharacter | null; name: string };

function lookup(dex: SaveDex, code: string): SaveDexCharacter | null {
  const lower = code.toLowerCase();
  // An Alpha variant upstream has no entry for: fall back to the base species without
  // BOSS_; it has the same name.
  return dex.characters[lower] ?? dex.characters[lower.replace(/^boss_/, "")] ?? null;
}

/** An IV from 0 to 100. High ones are bold and low ones muted, so near-perfect Pals stand out at a glance. */
function iv(value: number): HTMLElement {
  return h("span", { class: value >= 90 ? "iv iv-high" : value < 30 ? "iv iv-low" : "iv" }, String(value));
}

/**
 * The first letter on the colour of the first element. This repository ships no Pal icons
 * (the artwork belongs to Pocketpair), so this is what identifies a row at a glance.
 */
function avatar(name: string, element: string | undefined): HTMLElement {
  return h("span", { class: `avatar${element ? ` el-${element}` : ""}`, "aria-hidden": "true" }, [...name][0] ?? "?");
}

export function renderResult(root: HTMLElement, world: ViewerWorld, dex: SaveDex, t: Strings): void {
  const state = {
    query: "",
    owner: ANY,
    location: ANY,
    sort: "ivTotal" as SortKey,
    flags: new Set<Flag>(),
    shown: PAGE,
  };

  const counts = new Map<string, number>();
  for (const p of world.pals) if (p.owner) counts.set(p.owner, (counts.get(p.owner) ?? 0) + 1);
  const players = world.players
    .map((pl, i) => ({ ...pl, label: pl.name ?? t.unnamedPlayer(i + 1), count: counts.get(pl.uid) ?? 0 }))
    .sort((a, b) => b.count - a.count);
  const playerName = new Map(players.map((p) => [p.uid, p.label]));

  const rows: Row[] = world.pals.map((pal) => {
    const entry = lookup(dex, pal.code);
    return { pal, entry, name: entry?.name ?? pal.code };
  });

  const collected = new Set<string>();
  for (const r of rows) if (r.entry?.dex) collected.add(r.entry.dex);
  const stats = {
    dex: collected.size,
    rare: rows.filter((r) => r.pal.rare).length,
    dps: rows.filter((r) => r.pal.location.kind === "dps").length,
    base: rows.filter((r) => r.pal.location.kind === "base").length,
  };

  // ---- Overview: four numbers, then Pals per player. A name chip filters by that owner. ----

  const tiles = h(
    "div",
    { class: "tiles" },
    ...[
      [t.summary.pals, num(world.pals.length)],
      [t.summary.players, num(world.players.length)],
      [t.summary.dex, t.summary.dexValue(stats.dex, dex.dexSize)],
      [t.summary.rare, num(stats.rare)],
    ].map(([label, value]) => h("div", { class: "tile" }, h("span", { class: "muted small" }, label), h("span", { class: "tile-value" }, value))),
  );

  const ownerChips = new Map<string, HTMLButtonElement>();
  const chip = (value: string, label: string, n: number) => {
    const btn = toggle([label, " ", h("span", { class: "muted" }, num(n))], (on) =>
      setFilter(() => (state.owner = on ? value : ANY)),
    );
    ownerChips.set(value, btn);
    return btn;
  };
  const chips = h(
    "div",
    { class: "chips" },
    ...players.map((p) => chip(p.uid, p.label, p.count)),
    stats.base > 0 ? chip(BASE_OWNER, t.filters.ownerBase, stats.base) : null,
  );

  const notes: Child[] = [
    stats.dps > 0 ? t.notes.dps(stats.dps) : null,
    stats.base > 0 ? t.notes.base(world.bases) : null,
    world.missingPlayerFiles > 0 ? t.notes.missingPlayers(world.missingPlayerFiles) : null,
    world.undecoded > 0 ? t.notes.undecoded(world.undecoded) : null,
    world.warnings > 0 ? t.notes.warnings(world.warnings) : null,
  ].filter(Boolean);
  const notesEl = notes.length > 0 ? h("ul", { class: "notes muted small" }, ...notes.map((n) => h("li", {}, n))) : null;

  // ---- Filters ----

  const search = h("input", {
    type: "search",
    class: "input search",
    placeholder: t.filters.search,
    "aria-label": t.filters.search,
    spellcheck: "false",
    autocomplete: "off",
  });
  search.addEventListener("input", () => setFilter(() => (state.query = search.value)));

  const ownerSelect = selectField(t.filters.owner, (v) => setFilter(() => (state.owner = v)));
  ownerSelect.setOptions(
    [
      [ANY, t.filters.ownerAll],
      ...players.map((p): [string, string] => [p.uid, t.ownerOption(p.label, p.count)]),
      ...(stats.base > 0 ? [[BASE_OWNER, t.filters.ownerBase] as [string, string]] : []),
    ],
    ANY,
  );
  const locationSelect = selectField(t.filters.location, (v) => setFilter(() => (state.location = v)));
  locationSelect.setOptions(
    [[ANY, t.filters.locationAll], ...LOCATIONS.map((l): [string, string] => [l, t.location[l]])],
    ANY,
  );
  const sortSelect = selectField(t.filters.sort, (v) => setFilter(() => (state.sort = v as SortKey)));
  sortSelect.setOptions(
    SORTS.map((s): [string, string] => [s, t.sort[s]]),
    state.sort,
  );

  const flagButtons = FLAGS.map((f) => {
    const btn = toggle([t.flags[f]], (on) =>
      setFilter(() => {
        if (on) state.flags.add(f);
        else state.flags.delete(f);
      }),
    );
    return [f, btn] as const;
  });

  const shownLine = h("p", { class: "muted small", "aria-live": "polite" });
  const tbody = h("tbody");
  const table = h(
    "div",
    { class: "table-wrap" },
    h(
      "table",
      { class: "pals" },
      h(
        "thead",
        {},
        h(
          "tr",
          {},
          h("th", {}, t.col.pal),
          h("th", { class: "num" }, t.col.level),
          h("th", {}, t.col.rank),
          h("th", { class: "num" }, t.col.hp),
          h("th", { class: "num" }, t.col.attack),
          h("th", { class: "num" }, t.col.defense),
          h("th", {}, t.col.soul),
          h("th", {}, t.col.passives),
          h("th", {}, t.col.skills),
          h("th", {}, t.col.owner),
          h("th", {}, t.col.location),
        ),
      ),
      tbody,
    ),
  );
  const emptyEl = h("p", { class: "empty muted small" }, t.empty);
  const moreBtn = h("button", { type: "button", class: "btn btn-outline more" });
  moreBtn.addEventListener("click", () => {
    state.shown += PAGE;
    renderList();
  });

  setChildren(
    root,
    h(
      "section",
      { class: "stack" },
      h("h2", { class: "sr-only" }, t.summary.title),
      tiles,
      chips,
      notesEl,
    ),
    h(
      "section",
      { class: "stack" },
      h("h2", { class: "sr-only" }, t.listTitle),
      h(
        "div",
        { class: "filters" },
        search,
        ownerSelect.root,
        locationSelect.root,
        sortSelect.root,
        h("div", { class: "chips" }, ...flagButtons.map(([, b]) => b)),
      ),
      shownLine,
      emptyEl,
      table,
      moreBtn,
    ),
  );

  // ---- Filtering and rendering ----

  /** Changing any filter goes back to the first page: staying at "800 shown" would bury the start of the new results. */
  function setFilter(change: () => void) {
    change();
    state.shown = PAGE;
    renderList();
  }

  function filtered(): Row[] {
    const q = state.query.trim().toLowerCase();
    const matches = (r: Row) => {
      if (q === "") return true;
      const haystack = [
        r.name,
        r.pal.code,
        r.pal.nickname ?? "",
        ...r.pal.passives.map((c) => dex.passives[c.toLowerCase()]?.name ?? c),
        ...r.pal.equipped.map((c) => dex.waza[c.toLowerCase()]?.name ?? c),
      ];
      return haystack.some((s) => s.toLowerCase().includes(q));
    };
    const out = rows.filter((r) => {
      const p = r.pal;
      if (state.owner === BASE_OWNER ? p.location.kind !== "base" : state.owner !== ANY && p.owner !== state.owner) {
        return false;
      }
      if (state.location !== ANY && p.location.kind !== state.location) return false;
      if (state.flags.has("rare") && !p.rare) return false;
      if (state.flags.has("boss") && !p.boss) return false;
      if (state.flags.has("condensed") && p.rank <= 1) return false;
      if (state.flags.has("souled") && p.soul.hp + p.soul.attack + p.soul.defense + p.soul.craft === 0) {
        return false;
      }
      return matches(r);
    });
    const by: Record<SortKey, (a: Row, b: Row) => number> = {
      ivTotal: (a, b) => ivTotal(b.pal) - ivTotal(a.pal),
      attack: (a, b) => b.pal.talent.attack - a.pal.talent.attack,
      defense: (a, b) => b.pal.talent.defense - a.pal.talent.defense,
      hp: (a, b) => b.pal.talent.hp - a.pal.talent.hp,
      level: (a, b) => b.pal.level - a.pal.level,
      rank: (a, b) => b.pal.rank - a.pal.rank,
      name: (a, b) => a.name.localeCompare(b.name),
    };
    // Ties go by name, so Pals with equal values do not swap places on every filter change.
    return out.sort((a, b) => by[state.sort](a, b) || a.name.localeCompare(b.name));
  }

  function locationText(p: ViewerPal): string {
    const l = p.location;
    switch (l.kind) {
      case "party":
        return t.locationDetail.party(l.slot + 1);
      case "palbox":
        return t.locationDetail.palbox(Math.floor(l.slot / PALBOX_PAGE) + 1);
      case "base":
        return t.locationDetail.base(l.base);
      default:
        return t.location[l.kind];
    }
  }

  function rowEl({ pal, entry, name }: Row): HTMLTableRowElement {
    const souls = (["hp", "attack", "defense", "craft"] as const).filter((k) => pal.soul[k] > 0);
    const tags: Child[] = [
      pal.rare ? h("span", { class: "tag tag-rare" }, t.tags.rare) : null,
      pal.boss ? h("span", { class: "tag" }, t.tags.boss) : null,
      entry?.human ? h("span", { class: "tag" }, t.tags.human) : null,
      ...(entry?.elements ?? []).map((e) => h("span", { class: `tag el-${e}` }, dex.elements[e] ?? e)),
    ];
    return h(
      "tr",
      {},
      h(
        "td",
        { class: "pal-cell" },
        h(
          "div",
          { class: "pal" },
          avatar(name, entry?.elements[0]),
          h(
            "div",
            { class: "pal-main" },
            h(
              "span",
              { class: "pal-name" },
              h("span", { class: entry ? "strong" : "strong mono small", title: entry ? pal.code : t.unknownCode }, name),
              pal.gender
                ? h(
                    "span",
                    { class: "muted small", title: t.gender[pal.gender], "aria-label": t.gender[pal.gender] },
                    pal.gender === "male" ? "♂" : "♀",
                  )
                : null,
            ),
            pal.nickname ? h("span", { class: "muted small nickname" }, pal.nickname) : null,
            tags.some(Boolean) ? h("span", { class: "tags" }, ...tags) : null,
          ),
        ),
      ),
      h("td", { class: "num" }, String(pal.level)),
      h(
        "td",
        { class: "nowrap" },
        pal.rank > 1
          ? h(
              "span",
              { class: "stars", title: t.stars(pal.rank - 1), "aria-label": t.stars(pal.rank - 1) },
              "★".repeat(Math.min(pal.rank - 1, 4)),
            )
          : h("span", { class: "muted" }, "—"),
      ),
      h("td", { class: "num" }, iv(pal.talent.hp)),
      h("td", { class: "num" }, iv(pal.talent.attack)),
      h("td", { class: "num" }, iv(pal.talent.defense)),
      h(
        "td",
        { class: "small nowrap" },
        souls.length === 0
          ? h("span", { class: "muted" }, "—")
          : h("span", { class: "lines" }, ...souls.map((k) => h("span", {}, t.soul[k](pal.soul[k])))),
      ),
      h(
        "td",
        { class: "wide" },
        h(
          "span",
          { class: "tags" },
          ...pal.passives.map((c) => {
            const p = dex.passives[c.toLowerCase()];
            const tone = !p || p.rating === 0 ? "" : p.rating > 0 ? " good" : " bad";
            return h("span", { class: `tag passive${tone}${p ? "" : " mono"}`, title: p ? undefined : t.unknownCode }, p?.name ?? c);
          }),
        ),
      ),
      h(
        "td",
        { class: "wide small" },
        h(
          "span",
          { class: "lines" },
          ...pal.equipped.map((c) => {
            const w = dex.waza[c.toLowerCase()];
            return h("span", { class: w ? undefined : "mono" }, w?.name ?? c);
          }),
          pal.mastered.length > 0
            ? h(
                "span",
                { class: "muted", title: pal.mastered.map((c) => dex.waza[c.toLowerCase()]?.name ?? c).join(" / ") },
                t.mastered(pal.mastered.length),
              )
            : null,
        ),
      ),
      h("td", { class: "nowrap" }, pal.owner ? (playerName.get(pal.owner) ?? t.unknownPlayer) : t.location.base),
      h("td", { class: "nowrap muted" }, locationText(pal)),
    );
  }

  function renderList() {
    const list = filtered();
    const visible = list.slice(0, state.shown);
    shownLine.textContent = t.shownCount(visible.length, list.length);
    emptyEl.hidden = list.length > 0;
    table.hidden = list.length === 0;
    tbody.replaceChildren(...visible.map(rowEl));
    const rest = list.length - state.shown;
    moreBtn.hidden = rest <= 0;
    moreBtn.textContent = t.showMore(Math.min(PAGE, Math.max(rest, 0)));

    // Controls are kept in sync with state rather than rebuilt, so focus stays put.
    ownerSelect.select.value = state.owner;
    for (const [value, btn] of ownerChips) setPressed(btn, state.owner === value);
    for (const [f, btn] of flagButtons) setPressed(btn, state.flags.has(f));
  }

  renderList();
}
