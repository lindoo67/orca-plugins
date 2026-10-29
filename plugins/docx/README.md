# Word Document Viewer

Open `.docx` files as read-only pages in Orca's editor. The preview shows page layout, tables,
headers, footers, footnotes, images and embedded fonts. Select and copy text as usual. Zoom with
the footer controls or Ctrl+wheel / trackpad pinch, and use **Fit** to fit the page to the pane.
The controls follow Orca's light or dark theme; document pages keep their original colours.

Orca supplies the document bytes through its custom-editor API for local, SSH and paired-host
files, and sends a new version when the file changes outside the editor. The viewer keeps the
current zoom and scroll position on reload. It never edits or writes back to the document.
Requires Orca 1.4.245 or later.

Bookmark links scroll to their target in the document. Clicking an HTTP or HTTPS link selects its
address in a copy field below the pages. Orca's current plugin API does not offer opening URLs,
so copy the address to open it in a browser. Other link schemes are disabled.

## Limits

- `.docx` only; legacy `.doc`, password-encrypted documents and ZIP64 archives are unsupported.
- Files are limited to 50 MiB, 2,000 archive entries, 256 MiB of inflated content, and 32 MiB per
  XML part. Actual inflated sizes are checked before parsing, including XML disguised as media.
- Complex Word layout may differ from Microsoft Word. Tracked changes, comments and embedded
  HTML (`altChunk`) are not rendered. There is no editing, search or saved zoom between sessions.
- Documents cannot run macros or scripts, load network resources, or style Orca. Rendering runs
  in Orca's sandboxed editor frame; document styles are isolated from the controls in a shadow root.

## Credits and licence

The archive guard, rendering options and default page layout are adapted from
[Kazuki Hanai's DOCX preview PR](https://github.com/stablyai/orca/pull/35061), addressing
[issue #35060](https://github.com/stablyai/orca/issues/35060). The original commit credits Kazuki
Hanai (`@kazuki-hanai`) and co-author Claude Opus 5.5. This plugin replaces the native viewer
integration with Orca's sandboxed custom-editor API.

MIT. Bundled libraries include [docx-preview](https://github.com/VolodymyrBaydalka/docxjs)
(Apache-2.0), JSZip (MIT), fflate (MIT), and their dependencies; see
[THIRD_PARTY_NOTICES.txt](THIRD_PARTY_NOTICES.txt). Build instructions and tests are in
[build/README.md](build/README.md).
