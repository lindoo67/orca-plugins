# Building the Excalidraw editor

`../editor/index.html` is generated. Orca loads it as one document inside a sandboxed frame whose
CSP allows only inline scripts and styles and `data:` fonts and images, with no network, so the
build inlines everything: the bundle, its CSS, and the Latin fonts as `data:` URLs.

```sh
npm ci --ignore-scripts
node build.mjs
```

The build is deterministic: the same lockfile produces the same bytes. It also rewrites
`../THIRD_PARTY_NOTICES.txt` from the packages that end up in the bundle and `font-notices.txt`.

What the build leaves out, and why:

- Excalidraw's other locales: the editor always runs in English.
- Font subsetting (WebAssembly, which the CSP refuses): image exports embed whole fonts.
- The CJK font Xiaolai (12 MB) and Liberation Sans: those fall back to system fonts.

## Protocol

The frame talks to its editor tab with `postMessage`; Orca keeps the buffer, dirty state and saving.

| Direction | Message | Meaning |
| --- | --- | --- |
| frame → Orca | `{ type: 'orca-editor-ready' }` | Listening; send the document. |
| Orca → frame | `{ type: 'orca-editor-document', text, readOnly }` | The file's full text, on open and on every outside change. |
| frame → Orca | `{ type: 'orca-editor-edit', text }` | The whole new text after a user change (debounced 250 ms). |
| Orca → frame | `{ type: 'orca-editor-flush', requestId }` | About to save: post any pending edit now. |
| frame → Orca | `{ type: 'orca-editor-flushed', requestId }` | Done flushing. |
