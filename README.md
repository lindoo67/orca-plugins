# Orca plugins

The official plugin catalog for [Orca](https://github.com/stablyai/orca), and the source of the
official plugins. Orca reads the catalog to show the plugins you can install from Settings →
Plugins.

| Path | What it is |
| --- | --- |
| `plugins/<name>/` | Official plugins, one directory each, with its own manifest and licence. |
| `orca-catalog.json` | Read by Orca builds that support catalog format 2. Each release is pinned to an exact commit and file hash. |
| `orca-marketplace.json` | Read by older Orca builds. Frozen: it keeps the original listings, which install from each plugin's old repository. |
| `legacy-v1-only.json` | The ids in `orca-marketplace.json` that the export does not produce. |
| `assets/` | Listing images referenced by releases. |
| `scripts/release-entry.mjs` | Prints and checks the catalog release of every plugin in `plugins/`. |
| `scripts/check-catalog.mjs` | Validates the catalog, every release, images and `orca-marketplace.json`. |

Community plugins live in their authors' own repositories. The catalog can list them, but their
code is not copied here.

- To add or update a plugin, see [CONTRIBUTING.md](CONTRIBUTING.md).
- To learn how plugins are reviewed and taken down, see [REVIEW_POLICY.md](REVIEW_POLICY.md).

Every pull request is checked by `.github/workflows/validate-catalog.yml`, which runs Orca's own
validator at a pinned Orca commit.
