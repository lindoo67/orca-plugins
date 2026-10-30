# Scratchpad

Install **Scratchpad** in Settings → Plugins and enable it, then click the file-text
Scratchpad icon in the right sidebar. One global list follows you between workspaces.

Type in “Add something…” and press Enter. Click text to edit; Enter finishes,
Shift+Enter adds a line. Tick items to move them to Done, expand Done to reopen
items, or use Clear to delete completed items. Hover or focus a row for Delete.

Items save automatically to Orca's private plugin storage on this device. The
status says Saved only after the host acknowledges the write. Load failures keep
editing disabled; save failures retain edits and offer Retry. Concurrent panels
use compare-and-set writes: a stale panel reports a conflict instead of replacing
another panel's notes. Copy its unsaved text before reopening it to load the latest
list. Closing while the status says Saving or Not saved can lose pending edits.

Requires Orca's `storage.compareAndSet` panel API. Older hosts show an update
message and keep editing disabled. No browser storage, filesystem access, network,
or worker is used. The sole capability, `storage:own`, stores this plugin's notes.

Development: run `node plugins/scratchpad/build/build.mjs` after editing panel
scripts or the HTML template. The shipped HTML inlines scripts because Orca's
sandbox CSP blocks external script files.
