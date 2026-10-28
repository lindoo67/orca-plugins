export const MESSAGES = {
  opening: 'Opening spreadsheet…',
  corrupt:
    "This file couldn't be read as a spreadsheet. It may be damaged or in a format Spreadsheet Viewer doesn't support.",
  encrypted: "This workbook is password-protected. Spreadsheet Viewer can't open encrypted files.",
  'too-large':
    'This file is too large to view. Its contents expand to more than 256 MB or 4,000 parts, which Spreadsheet Viewer refuses to unpack.',
  noSheets: 'This workbook has no sheets.',
  allHidden: 'Every sheet in this workbook is hidden.',
  emptySheet: 'This sheet is empty',
  chartSheet: 'This is a chart sheet. Spreadsheet Viewer shows cell data only.',
  otherSheet: 'This is a macro or dialog sheet. Spreadsheet Viewer shows worksheets only.'
}
