# Adding or updating a plugin

This repository holds Orca's official plugin catalog and the official plugins themselves.
`orca-catalog.json` pins every release to an exact commit and a hash of the plugin's files. Orca
refuses to install bytes that differ from what is listed.

- **Official plugins** (published by `stablyai`) live in `plugins/<name>/`, one directory each.
  Orca installs only that directory, so changing one plugin never changes another's hash.
- **Community plugins** stay in their authors' own repositories. List them in the community
  directory; don't copy their code here.

The field reference is in Orca's
[catalog reference](https://github.com/stablyai/orca/blob/main/docs/reference/plugin-catalog.md)
and the
[plugin author guide](https://github.com/stablyai/orca/blob/main/docs/reference/plugin-authoring.md).

You need a checkout of [Orca](https://github.com/stablyai/orca) with dependencies installed
(`pnpm install`, then `pnpm run build:packages`). Below, `ORCA_DIR` is its path. CI uses the Orca
commit in `ORCA_REF` of `.github/workflows/validate-catalog.yml`.

## 1. Change the plugin and commit it

Use manifest format 2 (`"manifestVersion": 2`) and choose the lowest `execution` profile that
fits: `data` for themes, syntaxes and translations; `declarative` for commands, shortcuts and
recipes; `sandboxed-ui` for panels; `trusted-worker` only when you need code running in Orca.
Keep a `LICENSE` file in the plugin directory and set `license` in the manifest to match.

Bump `version` in `orca-plugin.json` for any change to a plugin that has already been merged:
a released version is never rebuilt with different bytes.

- **New official plugin:** create `plugins/<name>/` and add an entry to `orca-catalog.json` with
  `id` (`<publisher>.<id>` from the manifest), `source`
  (`{"kind": "git", "url": "https://github.com/stablyai/orca-plugins.git", "ref": "main", "path": "plugins/<name>"}`),
  a `description`, `categories` and `"releases": []`.

Commit the plugin change on its own. The release pins the last commit that changed the plugin's
directory, and a commit cannot name itself.

## 2. Write the release entry

```sh
ORCA_DIR=/path/to/orca node scripts/release-entry.mjs --write
```

For every directory in `plugins/`, this runs Orca's validator and writes the release it prints
(version, commit, `contentHash`, execution profile, minimum Orca, contributions, capabilities,
file types) into `orca-catalog.json`. A new version goes **first** in `releases`; an unchanged
version is updated in place. Don't edit these fields by hand: CI recomputes them and fails when
they are stale. Commit `orca-catalog.json`.

When a release raises `engines.orca`, keep the previous release listed beneath it. Older Orca
installs the first release it supports, so removing the old one leaves those users with nothing
to install.

You may add display-only fields to a release: `changelog`, `updatedAt`, `license`, `homepage`,
`themePreview`, `images`. The script keeps them.

## 3. Add a cover image (recommended)

Put images under `assets/<plugin id>/` and reference them from the release's `images`, with
`path`, `alt` text, `sha256`, `width` and `height`. Limits:

| Image | Formats | Size |
| --- | --- | --- |
| icon | PNG, WEBP, square | at least 128×128, at most 256 KB |
| cover | PNG, JPEG, WEBP | at least 800×500 (1600×1000 recommended), at most 1024 KB |
| screenshots (up to 6) | PNG, JPEG, WEBP | at least 1280×800, at most 1536 KB |

Images must be static, show the real plugin, and not imitate Orca's trust badges. CI fails on any
file under `assets/` that no release references.

## 4. Check locally

Orca builds released before catalog format 2 read only `orca-marketplace.json`. Don't edit it.
Plugins in `plugins/` are left out of it, because those builds cannot install a subdirectory;
older builds keep the original listings. Run the same checks CI runs:

```sh
ORCA_DIR=/path/to/orca node scripts/release-entry.mjs
ORCA_DIR=/path/to/orca node scripts/check-catalog.mjs
```

If `check-catalog.mjs` says `orca-marketplace.json` is out of date, regenerate it with
`--write-legacy` rather than editing it.

## 5. Open a pull request

CI checks that every release in `plugins/` is current, validates the catalog with Orca's own
validator and fetches every listed commit to recompute its `contentHash`. It also checks images
and that `orca-marketplace.json` matches the export. An
Orca maintainer then reviews the plugin against [REVIEW_POLICY.md](REVIEW_POLICY.md). Say in
the PR what the plugin does and, for anything above `data`, why it needs that profile.
