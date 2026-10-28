# Building Spreadsheet Viewer

`../editor/index.html` is generated. Orca loads it as one document inside a sandboxed frame whose
CSP allows only inline scripts and styles and no workers, so the build inlines
everything into that one file. There is no framework: the grid is plain DOM, and the only
dependency in the bundle is SheetJS.

```sh
npm ci --ignore-scripts
node build.mjs
npm test            # unit tests, then the headless browser tests against the built file
```

The build is deterministic: the same lockfile produces the same bytes. It also rewrites
`../THIRD_PARTY_NOTICES.txt` from the packages in the bundle, and fails if a package's licence
differs from the reviewed copy in `licenses/`.

## SheetJS

SheetJS Community Edition is pinned to the official tarball,
`https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz` (the lockfile records its integrity hash).
The `xlsx` package on the npm registry stopped at 0.18.5, which has known vulnerabilities
(CVE-2023-30533, prototype pollution; CVE-2024-22363, ReDoS); do not switch to it. To update,
check <https://cdn.sheetjs.com/> for a newer release, change the URL in `package.json`, run
`npm install --ignore-scripts`, review the licence and update `licenses/xlsx.txt` if it changed.

Workbooks are read with `dense: true` (rows as arrays, which is what makes 50,000-row sheets cheap),
`cellFormula: true` and SheetJS's formatted text (`.w`). `cellStyles: true` is set only because
SheetJS reads column widths and row heights under it.

What the build leaves out, and why:

- SheetJS's code-page tables (`cpexcel`, ~470 KB): only BIFF5-and-earlier `.xls` files with
  non-Western code pages need them.
- Writing, and every format other than the five Orca routes here.

## Safety checks before parsing

- Zip-based files (`.xlsx`, `.xlsm`, `.xlsb`, `.ods`): the zip central directory is walked without
  inflating anything, and the file is refused if it declares more than 256 MB uncompressed or more
  than 4,000 entries (`src/zip-budget.js`). This guard is adapted from the Office zip check in
  [stablyai/orca#29678](https://github.com/stablyai/orca/pull/29678) by @nebourocket.
- Bytes that are not a zip, a compound file, a BIFF stream or markup (SpreadsheetML/HTML saved as
  `.xls`) are refused as damaged, because SheetJS would otherwise read them as CSV text.
- Encrypted packages and password-protected `.xls` files are recognised from SheetJS's errors.

## Source layout

| File | What it holds |
| --- | --- |
| `src/editor.js` | Entry: `window.orca` documents, workbook state, sheet tabs, detail and status bars, copy |
| `src/grid-view.js` | The virtualized grid: rendering, scrolling, keyboard and pointer input |
| `src/open-workbook.js` | Container sniffing, the zip check, SheetJS options, error classification |
| `src/zip-budget.js` | The zip-bomb guard |
| `src/workbook-model.js` | Sheets, used extent, column widths and row heights from a SheetJS workbook |
| `src/selection.js` | Selection and navigation, as a pure reducer |
| `src/merge-index.js` | Merged-cell lookup by cell and by window |
| `src/range-copy.js` | Selection to TSV and HTML, and the status bar's count/sum/average |
| `src/cell-display.js`, `src/address.js` | Cell text, kinds, formulas; A1 addresses |
| `src/document-message.js` | Validation of the document `window.orca` delivers |
| `scripts/make-fixtures.mjs` | Writes the test workbooks to `/private/tmp/xlsx-fixtures` (or `$SPREADSHEET_FIXTURES`) |
| `test/harness.mjs` | An Orca-like host: the same CSP, tokens and sandboxed `srcdoc` frame, in headless Chromium |

The browser tests use the Chromium that `playwright-core` expects (`npx playwright-core install
chromium-headless-shell` if it is missing). Set `SPREADSHEET_SCREENSHOTS=<dir>` to save screenshots.

## Protocol

The frame talks to its editor tab with `postMessage`. The viewer does not edit cells yet, so it never posts edits.

| Direction | Message | Meaning |
| --- | --- | --- |
| frame → Orca | `{ type: 'orca-editor-ready' }` | Listening; send the document. |
| Orca → frame | `{ type: 'orca-editor-document', version, readOnly, fileType, content: { kind: 'bytes', bytes } }` | The file's bytes as a transferred `ArrayBuffer`, on open and whenever the file changes on disk; `version` grows with each change. The active sheet, selection and scroll position are kept when the sheet still exists. |

Messages from anything but the parent window, documents whose `version` is not newer than the
last one rendered, and `content.kind: 'text'` documents are ignored. `fileType` is informational; the format is detected from the bytes. Orca
answers its watchdog pings in the frame shell, so the editor yields before parsing and keeps every
step well under the 5 s pong timeout (a 50,000 × 12 workbook parses in under a second). Copy works
through the native `copy` event, which Orca's Edit menu fires in the frame; the sandbox grants no
clipboard API.
