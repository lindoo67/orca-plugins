# Scratchpad

Install and enable **Scratchpad** in Settings → Plugins. Create an empty file named
`notes.scratchpad` in your project and open it. Orca selects the Scratchpad editor
for `.scratchpad` files; use the editor selector if Source is selected.

Type in “Add something…” and press Enter. Click text to edit; Enter finishes,
Shift+Enter adds a line. Tick items to move them to Done, expand Done to reopen
items, or use Clear to delete completed items. Hover or focus a row for Delete.

Use **⌘S / Ctrl+S** to save. Orca manages the file, dirty state, save errors,
external changes, and remote files. The Scratchpad sends edits to the document
buffer; it does not claim that updating the buffer saves the file to disk. Invalid
files show an error without overwriting them. Read-only files disable editing.
Conflicting external edits preserve the local view; copy unsaved text before
reopening the file to load the newer contents.

Version 2 uses the existing custom editor document API on Orca >=1.4.245 and
requests no capabilities. It opens in an editor tab, replacing the nonfunctional
sidebar integration from version 1. No private storage API is needed. To share one
scratchpad between workspaces, open the same file in each workspace.

The file format is JSON: `{ "version": 1, "items": [{ "id": "unique-id",
"text": "Remember this", "done": false }] }`. An empty file starts an empty list.

Development: run `node plugins/scratchpad/build/build.mjs` after editing the
scripts or HTML template. Shipped HTML inlines scripts for Orca's sandbox CSP.
