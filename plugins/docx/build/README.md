# Building Word Document Viewer

`../editor/index.html` is generated from the source here. Orca loads it in a sandboxed frame
with inline scripts/styles and data-URL images/fonts allowed; network, workers, and eval are
blocked. Everything is bundled into one file, with no runtime downloads.

```sh
npm ci --ignore-scripts
npm run build
npm test
```

Browser tests use the Chromium headless shell expected by `playwright-core`; install it with
`npx playwright-core install chromium-headless-shell` if needed. The harness reproduces Orca's
opaque-origin `sandbox="allow-scripts"` frame, CSP, theme tokens, and document API. Tests cover
page rendering, header/footer/table content, zoom/fit, bookmarks, link isolation, external
rewrites, stale document versions, invalid files, encrypted/ZIP64 archives, size lies and bombs.

The build is deterministic. It refuses eval, `new Function`, and unescaped closing script/style
tags. It generates third-party notices from bundled packages and compares their licence text
against reviewed copies in `licenses/` before succeeding. Only bundled-package licences are kept.

## Dependencies and CSP

`docx-preview` is pinned to 0.4.1; npm's lockfile pins JSZip and every transitive dependency.
`fflate` is pinned to 0.8.3 (the fixed version for GHSA-px8p-9vwx-vf98; the affected `unzipSync`
API is not used here). `npm audit` should remain clean after updates.

JSZip's prebundled browser distribution contains a legacy `new Function` string-callback
fallback. The build uses JSZip's original entry instead, replacing only that scheduler with a
small `MessageChannel` function-only shim. A second shim declares Node streams unavailable,
since this viewer accepts only ArrayBuffers. No package files are patched.

## Rendering boundary

The renderer settings and archive inspector originate in
[stablyai/orca#35061](https://github.com/stablyai/orca/pull/35061) at
`ba58f712a5ca51073df93397b7520f8c3fa12bca`; see `UPSTREAM_NOTICE.txt` for authorship and the MIT
notice included in the generated notices.

The plugin API already reads binary documents locally and remotely, so no native IPC, host
changes or broad capabilities are needed. The viewer only calls `orca.document.onDidChange`.
Orca handles saving and app shortcuts; the viewer sends no edits.

Unlike the native PR, the sandbox cannot create workers or access a script-free nested frame
with `allow-same-origin`. The archive guard instead yields between bounded inflate chunks and
cancels superseded versions. Rendering keeps all document CSS in a shadow root. Only parsed
`@font-face` rules are promoted into a separate outer stylesheet because Chromium ignores font
faces defined inside shadow roots. Active elements and event handlers are removed, HTTP(S)
links become copyable addresses, and bookmark links are handled within the preview. The host
CSP remains the network and script-policy boundary.

| File | Purpose |
| --- | --- |
| `src/editor.js`, `src/editor.css` | Frame API, reload/version state, scrolling, zoom, controls |
| `src/render-document.js` | Renderer options, document/style isolation, fonts and link sanitization |
| `src/archive-budget.js` | Entry/byte limits with actual bounded inflation before rendering |
| `src/document-message.js` | Versioned byte-document validation and the input size cap |
| `src/set-immediate.js`, `src/no-node-stream.js` | CSP-compatible browser shims for JSZip |
| `test/harness.mjs`, `test/fixture.mjs` | Orca-like sandbox and synthetic Word documents |
