# Spreadsheet Viewer

Opens Excel and OpenDocument spreadsheets in Orca's editor, read-only: `.xlsx`, `.xlsm`, `.xlsb`,
`.xls` and `.ods`. Every visible sheet gets a tab along the bottom, and the grid shows each cell as
the file formats it — currency, percentages, dates, errors such as `#DIV/0!` — with merged cells
drawn as one. The bar above the grid shows the selected cell's address, its value, its formula and,
when it differs from what is displayed, the value stored in the file. The status bar shows the
sheet's size and, for a selection, its count, sum and average.

CSV and TSV files are not handled here: Orca opens those in its own editable table view.

## Keyboard

| Keys | Does |
| --- | --- |
| Arrow keys | Move the active cell |
| Ctrl/Cmd + arrow | Jump to the edge of the data |
| Shift + any move, or Shift + click | Extend the selection |
| Tab / Shift+Tab, Enter / Shift+Enter | Move right / left, down / up; inside a selection, walk its cells |
| Page Up / Page Down | Move a screen up or down |
| Home / End | First column / last filled cell of the row |
| Ctrl/Cmd + Home / End | First cell / last cell of the sheet |
| Ctrl/Cmd + A | Select the whole sheet |
| Shift+Space / Ctrl+Space | Select the row / column |
| Ctrl/Cmd + Page Up / Page Down, or Alt + Left / Right | Previous / next sheet |
| Ctrl/Cmd + C | Copy the selection |

Click and drag to select a range; click a row number or column letter to select the row or column,
and the corner to select everything. Tab leaves the grid from its last cell, and the sheet tabs
take Left, Right, Home and End.

Copying puts the selection on the clipboard as tab-separated text, as Excel does, so it pastes into
spreadsheets, documents and terminals; rich-text targets also get an HTML table. Cells are copied
as they are displayed, not as raw numbers.

## Limits

- **Read-only.** Nothing is ever written back to the file.
- **Formulas are not recalculated.** The grid shows the results saved in the file by the
  application that last wrote it; a file saved without results shows those cells empty.
- **Macros never run.** `.xlsm` workbooks open as plain data.
- **Cell data only.** Charts, images, comments, conditional formatting, fonts, colours and borders
  are not shown. Chart sheets say so; hidden sheets are left out (the tab bar counts them), and
  hidden rows and columns stay hidden.
- **Size.** Orca opens files of up to 16 MiB. Zip-based workbooks (`.xlsx`, `.xlsm`, `.xlsb`,
  `.ods`) are also refused if their contents expand past 256 MB or 4,000 parts, so a damaged or
  hostile file cannot exhaust memory.
- **Encrypted workbooks** (password to open) are not supported; a password that only protects
  sheets from editing does not matter here.
- Old `.xls` files that use a non-Western code page (BIFF5 and earlier) may show garbled text;
  `.xls` files from Excel 97 and later are fine.

The viewer runs in Orca's sandboxed editor frame, with no network access.

## Licence

MIT. The viewer bundles [SheetJS Community Edition](https://sheetjs.com/) (Apache-2.0); see
[THIRD_PARTY_NOTICES.txt](THIRD_PARTY_NOTICES.txt). How it is built is in
[build/README.md](build/README.md).
