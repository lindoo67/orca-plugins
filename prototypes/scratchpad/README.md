# Scratchpad sidebar preview

Approved direction: one global sidebar scratchpad with a light paper tint and a
single kind of item. No workspace switch, document tabs, folders, rich-text
toolbar, item types or additional notes.

Open `index.html` in a browser. Type in the "Add something…" row and press Enter
to add an item. Click an item to edit it; Enter finishes editing. Ticking an item
moves it into a collapsed "Done" section at the bottom (unticking moves it back),
and "Clear" empties that section. Hover an item for its × to delete it; Backspace
on an empty item also deletes it, and items left empty are removed when you click
away. The paper uses a pale cream in light mode and a dark warm brown in dark
mode. It follows host theme changes (or system preference in a standalone
browser). The light/dark preview control is outside the proposed plugin UI.

This is an interactive design prototype, **not an installable or persistent
plugin**. Edits are kept only in memory and reset on reload. No storage calls,
browser-storage workaround, worker bridge or unsupported host API is used.

The sidebar surface is intentional. The user chose to wait for panel storage
support instead of using a file-backed custom editor. Once supported by Orca,
connect global plugin storage, add load/save/error states, and verify restart
persistence and concurrent panels before packaging it as a plugin. Workspace
identity is not needed for this global-only version.

Visual research: [Memos](https://github.com/usememos/memos) and
[PaperTodo](https://github.com/snownico0722/PaperTodo). This prototype is original;
it does not copy their code, artwork or assets. PaperTodo has a restrictive
noncommercial license, so its implementation should not be imported.
