# Orca Run

A pixel art, Chrome Dino-inspired endless runner starring a little black-and-white orca. Jump icebergs,
duck seabirds, and see how far you can swim. Opens from the **Orca Run** (lightning bolt)
icon in Orca's right sidebar. It was called Orca Runner before 1.2.0; the plugin ID is still `orca-runner`, so
existing installs update in place.

## Try it in Orca

Requires Orca **1.4.245 or later**.

1. Open **Settings → Plugins → Development folders…**.
2. Add this directory (`plugins/orca-runner`), then review and enable the plugin.
3. Select **Orca Run** in the right sidebar, click the game and press **Space**.

The game runs offline in a `sandboxed-ui` panel with **no requested capabilities**. It has no
worker, dependencies, network requests, tracking, or access to the workspace. Best scores are
kept for the current panel instance; switching sidebar panels, closing, or reloading resets them. Switching focus
or hiding the document pauses gameplay. Resume with Space, P or a tap.

## Controls

| Input | Action |
| --- | --- |
| Space / ↑ / tap the game | Jump (hold for more airtime); start or restart a run |
| ↓ (hold) | Swim underwater to avoid seabirds; descend faster in the air; start or resume a run |
| P / Escape | Pause or resume |

Click the game to focus keyboard input. Controls only handle keys inside the panel and leave
Cmd/Ctrl shortcuts to Orca. Speed increases with distance; birds join after the opening stretch, and the sky turns
from day to dusk to an aurora night as you swim.
Release ↓ to surface again. Icebergs extend underwater, so jump over them.
Like the offline dino page, the panel is just the game: score, best and prompts are drawn inside it.
The page follows Orca's light/dark theme and the game fits narrow sidebars.

Pixel art is the game's only visual style: each frame is painted on a grid of up to 240×94 art pixels (one per 3 world units) with
hand-placed sprites and ordered-dither gradients, then scaled up by the browser without smoothing. Physics and
collision boxes use the same world units as before, so the art never changes how a run plays.

## Development

Source lives in `src/`. After editing it, rebuild the installable, self-contained HTML:

```sh
node plugins/orca-runner/scripts/build.mjs
node --test plugins/orca-runner/tests/*.test.mjs
```

To preview outside Orca, open `panel/index.html` in a browser, or serve the repository with a
static HTTP server. No install step is required. To validate against an Orca checkout:

```sh
node "$ORCA_DIR/config/scripts/validate-plugin-files.mjs" plugins/orca-runner
```

The generated `panel/index.html` is committed with the source because Orca's sandbox only
allows inline styles/scripts and data images. No build runs at installation. To list a public
release in the official catalog, follow the repository's `CONTRIBUTING.md`: commit the plugin,
then generate its pinned release and content hash.

## Open-source research and license

We evaluated [wayou/t-rex-runner](https://github.com/wayou/t-rex-runner) (BSD-3-Clause), an
extraction of Chromium's runner, and
[KarthikNedunchezhiyan/google-chrome-dino](https://github.com/KarthikNedunchezhiyan/google-chrome-dino)
(MIT). Both can be adapted, but this plugin uses an original, small Canvas implementation to
fit Orca's opaque-origin sandbox without Chromium page APIs, audio assets, or storage access.
No source code or sprites from either project are included. The sprites are drawn as text grids in `src/game.js`.

Code and artwork are MIT licensed; see `LICENSE`.
