# Repository instructions

## Plugin release metadata

Whenever a change modifies anything under an existing `plugins/<name>/` directory, include the corresponding generated release update in `orca-catalog.json` in the same change. This includes manifest version bumps, theme or syntax changes, assets, and documentation stored in that plugin directory.

Do not hand-author release hashes or commits. After the plugin change is committed, generate the entry with:

```sh
ORCA_DIR=/path/to/orca node scripts/release-entry.mjs --write
```

Commit the resulting `orca-catalog.json` change, then verify it with:

```sh
ORCA_DIR=/path/to/orca node scripts/release-entry.mjs
ORCA_DIR=/path/to/orca node scripts/check-catalog.mjs
```

For a new official plugin, add its catalog entry before generating its first release. Do not manually edit `orca-marketplace.json`; regenerate it only through `scripts/check-catalog.mjs --write-legacy` when that validation explicitly requires it.
