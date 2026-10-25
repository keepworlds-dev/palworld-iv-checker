# Third-party code, data and licenses

This project is distributed under the GNU General Public License version 3 (see
[LICENSE](LICENSE)). It includes code used unmodified and data derived from the projects
below. Their original license files are kept next to them.

## Included verbatim

### zlmitchell/palworld-save-toolkit

- Repository: https://github.com/zlmitchell/palworld-save-toolkit
- Pinned commit: `e71370ede118311e1a2b354caadb6d527ca9bcd2` (also recorded in
  [`src/vendor/UPSTREAM-COMMIT`](src/vendor/UPSTREAM-COMMIT))
- Files: `src/vendor/gvas.js`, `sav.js`, `migrate.js`, `paldata.js`, `zip.js`, copied from
  `docs/js/` at that commit without any change
- License: GPL-3.0 ([`src/vendor/LICENSE`](src/vendor/LICENSE)). The upstream README
  states "Licensed GPL-3.0" without saying "or later", so we treat it as GPL-3.0-only.

`scripts/check.mjs` verifies on every CI run that these files are byte-identical to the
upstream tree at the pinned commit (by git blob hash).

According to their own headers and the upstream README, these files are ports of, or based
on, the following MIT-licensed projects:

- [cheahjs/palworld-save-tools](https://github.com/cheahjs/palworld-save-tools) (GVAS
  reader/writer, `.sav` container codec, custom property parsers)
- [quadrantbs/palworld-hostfix-toolkit](https://github.com/quadrantbs/palworld-hostfix-toolkit)
  (Palworld 1.0 parsers and `PlM` handling)

Their MIT notices are reproduced at the end of this file.

### SnosMe/ooz-wasm

- Repository: https://github.com/SnosMe/ooz-wasm (WebAssembly build of
  [powzix/ooz](https://github.com/powzix/ooz), an open-source Oodle Kraken decompressor)
- Files: `public/ooz-wasm/index.js` and `public/ooz-wasm/build/ooz.js`, as vendored by
  palworld-save-toolkit at the commit above (`docs/vendor/ooz-wasm/`). They are
  byte-identical to the `ooz-wasm@2.0.0` package on npm.
- License: GPL-3.0-or-later (`"license"` in its `package.json`; the C++ sources carry
  powzix's "version 3 of the License, or (at your option) any later version" notice).
  License text: [`public/ooz-wasm/LICENSE`](public/ooz-wasm/LICENSE).
- Corresponding source: `build/ooz.js` is an Emscripten build with the WebAssembly module
  embedded as base64 (`-s SINGLE_FILE=1`). Its complete source, the C++ decompressor in
  `lib/` plus `CMakeLists.txt` with every compiler and linker flag, is in the
  SnosMe/ooz-wasm repository; the 2.0.0 release was published from its `v2.0` commit,
  [`ebed82851988add824e092dc4db320c8fa39aaca`](https://github.com/SnosMe/ooz-wasm/tree/ebed82851988add824e092dc4db320c8fa39aaca).
  To rebuild it, install the Emscripten SDK and run:

  ```sh
  emcmake cmake -B build -DCMAKE_BUILD_TYPE=Release
  cmake --build build
  ```

## Derived data

### KrisCris/Palworld-Pal-Editor

- Repository: https://github.com/KrisCris/Palworld-Pal-Editor
- Pinned commit: `1b400624d25259b2b6b51b52b9eb359b231128d1` (also recorded in
  [`src/dex/vendor/UPSTREAM-COMMIT`](src/dex/vendor/UPSTREAM-COMMIT) and in the
  `upstream` field of `src/dex/paldex.json`)
- What is used: `pal_data.json`, `pal_passives.json`, `pal_attacks.json` and
  `human_data.json` from `src/palworld_pal_editor/assets/data/` at that commit: internal
  codes, names in five languages, elements, passive ratings and the variant-to-species
  mapping.
- License: GPL-3.0 ([`src/dex/vendor/LICENSE`](src/dex/vendor/LICENSE)).

Unlike `src/vendor/`, this is **not** a verbatim copy. `src/dex/paldex.json` is a
projection of those files written by [`scripts/build-paldex.mjs`](scripts/build-paldex.mjs),
so it is a derivative work, and its corresponding source is **upstream at the pinned commit
plus that script**, both public. Running `node scripts/build-paldex.mjs --check` re-exports
from upstream and confirms the file in this repository is exactly what the script
produces.

No icons or other artwork from that repository (or from the game) are included.

## Referenced or used as data under MIT

- **tylercamp/palcalc** (MIT): the official five-language names of the nine elements in
  `src/dex/paldex.json` come from its `PalCalc.Model/db.json`, fetched by
  `scripts/build-paldex.mjs`.
- **cheahjs/palworld-save-tools** and its 1.0-era fork
  [oMaN-Rod/palworld-save-tools](https://github.com/oMaN-Rod/palworld-save-tools) (MIT):
  the extra map types in [`src/core/type-hints.ts`](src/core/type-hints.ts) follow their
  `paltypes.py`. Only the type names were used; no code was copied.

## MIT notices

palworld-save-tools:

```text
MIT License

Copyright (c) 2024 Jun Siang Cheah
```

palworld-hostfix-toolkit:

```text
MIT License

Copyright (c) 2026
```

palcalc:

```text
Copyright 2024, Tyler Camp
```

All three are followed by the standard MIT permission notice:

```text
Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

Palworld is a trademark of Pocketpair, Inc. Pal names and other game text belong to
Pocketpair. This project is not affiliated with or endorsed by Pocketpair.
