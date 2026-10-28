# Building the Excalidraw editor

`../editor/index.html` is generated. Orca loads it as one document inside a sandboxed frame whose
CSP allows only inline scripts and styles and `data:` fonts and images, so the build inlines
everything: the bundle, its CSS, and the Latin fonts as `data:` URLs.

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

## Talking to Orca

The editor uses the `window.orca` API Orca injects into the frame; Orca keeps the buffer, dirty
state and saving.

- `orca.document.onDidChange(doc)`: the file's text, on open and on every outside change.
- `orca.document.applyEdit({ baseVersion, content: { kind: 'text', text } })`: the whole new
  text after a user change (debounced 250 ms). On a refusal the next change resends the scene.
- `orca.on('editor.flush', …)`: about to save; the pending edit is sent and Orca waits for it.
