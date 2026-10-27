// Orca custom editor for spreadsheets, read-only. Orca posts the file's bytes; this frame parses
// them with SheetJS and shows every visible sheet in a virtualized grid (see build/README.md).
import { read } from 'xlsx'
import { rangeAddress } from './address.js'
import { cellFormula, cellRawValue, cellText } from './cell-display.js'
import { parseDocumentMessage } from './document-message.js'
import { createGridView } from './grid-view.js'
import { MESSAGES } from './messages.js'
import { openWorkbook } from './open-workbook.js'
import { rangeToHtml, rangeToTsv, selectionStats } from './range-copy.js'
import { clampSelection, rangeCellCount } from './selection.js'
import { buildWorkbookModel, getCell } from './workbook-model.js'

const GRID_FONT = '12px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
// Rich-text copies of huge ranges cost more than they are worth; plain text is always included.
const MAX_HTML_COPY_CELLS = 100_000
const STATUS_NOTE_MS = 2500
const ANNOUNCE_DELAY_MS = 300

const $ = (id) => document.getElementById(id)
const ui = {
  message: $('message'),
  workbook: $('workbook'),
  address: $('address'),
  formula: $('detail-formula'),
  value: $('detail-value'),
  raw: $('detail-raw'),
  gridHost: $('grid-host'),
  sheetMessage: $('sheet-message'),
  tabs: $('tabs'),
  hiddenNote: $('hidden-note'),
  dims: $('status-dims'),
  stats: $('status-stats'),
  note: $('status-note'),
  live: $('live')
}

const numberFormat = new Intl.NumberFormat(undefined, { maximumFractionDigits: 6 })
const countFormat = new Intl.NumberFormat(undefined)
const measureContext = document.createElement('canvas').getContext('2d')
measureContext.font = GRID_FONT
const measured = new Map()
function measureText(text) {
  let width = measured.get(text)
  if (width === undefined) {
    width = measureContext.measureText(text).width
    if (measured.size > 50_000) measured.clear()
    measured.set(text, width)
  }
  return width
}

let lastVersion = -Infinity
let loadToken = 0
let model = null
let activeIndex = -1
const sheetStates = new Map()
let noteTimer = 0
let announceTimer = 0

const grid = createGridView(ui.gridHost, {
  measureText,
  onSelectionChange: updateSelectionDetails,
  onSwitchSheet: (delta) => {
    if (!model) return
    const next = activeIndex + delta
    if (next >= 0 && next < model.sheets.length) {
      showSheet(next)
      grid.focus()
    }
  }
})
grid.element.id = 'grid'

function showMessage(text) {
  ui.workbook.hidden = true
  ui.message.hidden = false
  ui.message.textContent = text
}

function receive({ version, bytes }) {
  // Why: a late or repeated document must not replace a newer one.
  if (version <= lastVersion) return
  lastVersion = version
  const token = ++loadToken
  if (!model) showMessage(MESSAGES.opening)
  // Why: let "Opening" paint before the parse, which holds the main thread for large files.
  setTimeout(() => {
    if (token === loadToken) load(bytes)
  }, 0)
}

function load(bytes) {
  const result = openWorkbook({ read }, bytes)
  const previousName = currentSheet()?.name ?? null
  const previousIndex = activeIndex
  if (previousName !== null && !ui.gridHost.hidden) sheetStates.set(previousName, grid.state())
  model = null
  activeIndex = -1
  if (result.status !== 'ok') {
    showMessage(MESSAGES[result.status])
    return
  }
  const next = buildWorkbookModel(result.workbook)
  if (next.sheets.length === 0) {
    showMessage(next.hiddenCount > 0 ? MESSAGES.allHidden : MESSAGES.noSheets)
    return
  }
  model = next
  ui.message.hidden = true
  ui.workbook.hidden = false
  renderTabs()
  const keep = model.sheets.findIndex((sheet) => sheet.name === previousName)
  showSheet(keep >= 0 ? keep : Math.min(Math.max(previousIndex, 0), model.sheets.length - 1), keep >= 0)
}

function renderTabs() {
  ui.tabs.replaceChildren(
    ...model.sheets.map((sheet, index) => {
      const tab = document.createElement('button')
      tab.type = 'button'
      tab.className = 'tab'
      tab.id = `tab-${index}`
      tab.setAttribute('role', 'tab')
      tab.setAttribute('aria-controls', 'grid')
      tab.textContent = sheet.name
      tab.title = sheet.name
      tab.addEventListener('click', () => showSheet(index))
      return tab
    })
  )
  ui.hiddenNote.hidden = model.hiddenCount === 0
  ui.hiddenNote.textContent =
    model.hiddenCount === 1 ? '1 hidden sheet not shown' : `${countFormat.format(model.hiddenCount)} hidden sheets not shown`
}

function showSheet(index, keepState = true) {
  const previous = currentSheet()
  if (previous && index !== activeIndex && !ui.gridHost.hidden) sheetStates.set(previous.name, grid.state())
  activeIndex = index
  const sheet = model.sheets[index]
  ui.tabs.querySelectorAll('[role="tab"]').forEach((tab, i) => {
    tab.setAttribute('aria-selected', String(i === index))
    tab.tabIndex = i === index ? 0 : -1
  })
  ui.tabs.children[index]?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  const empty = sheet.kind !== 'worksheet' || sheet.rowCount === 0 || sheet.columnCount === 0
  ui.gridHost.hidden = empty
  ui.sheetMessage.hidden = !empty
  ui.sheetMessage.textContent =
    sheet.kind === 'chart' ? MESSAGES.chartSheet : sheet.kind === 'other' ? MESSAGES.otherSheet : MESSAGES.emptySheet
  ui.dims.textContent = empty
    ? ''
    : `${countFormat.format(sheet.rowCount)} ${sheet.rowCount === 1 ? 'row' : 'rows'} × ` +
      `${countFormat.format(sheet.columnCount)} ${sheet.columnCount === 1 ? 'column' : 'columns'}`
  if (empty) {
    clearDetails()
    announce(`${sheet.name}. ${ui.sheetMessage.textContent}`)
    return
  }
  const saved = keepState ? sheetStates.get(sheet.name) : undefined
  const selection = saved && clampSelection(saved.selection, sheet.rowCount, sheet.columnCount)
  grid.setSheet(sheet, selection ? { ...saved, selection } : {})
  updateSelectionDetails()
  announce(`Sheet ${sheet.name}`)
}

function clearDetails() {
  ui.address.textContent = ''
  ui.formula.textContent = ''
  ui.value.textContent = ''
  ui.raw.textContent = ''
  ui.stats.textContent = ''
}

function currentSheet() {
  return model && activeIndex >= 0 ? model.sheets[activeIndex] : null
}

function updateSelectionDetails() {
  const sheet = currentSheet()
  if (!sheet) return
  const { active } = grid.selection
  const cell = getCell(sheet, active.r, active.c)
  const formula = cellFormula(cell)
  const text = cellText(cell)
  const raw = cellRawValue(cell)
  ui.address.textContent = grid.activeAddress()
  ui.formula.textContent = formula ?? ''
  ui.formula.hidden = !formula
  ui.value.textContent = formula ? (text === '' ? '' : `= ${text}`) : text
  ui.value.classList.toggle('result', Boolean(formula))
  ui.raw.textContent = raw === null ? '' : `Stored value ${raw}`

  const range = grid.range()
  const cells = rangeCellCount(range)
  if (cells > 1) {
    const stats = selectionStats(range, sheet.data)
    const parts = [`${rangeAddress(range)}`, `Count ${countFormat.format(stats.count)}`]
    if (stats.numericCount > 0) {
      parts.push(`Sum ${numberFormat.format(stats.sum)}`, `Average ${numberFormat.format(stats.average)}`)
    }
    ui.stats.textContent = parts.join('  ·  ')
  } else {
    ui.stats.textContent = ''
  }
  clearTimeout(announceTimer)
  announceTimer = setTimeout(() => {
    announce(cells > 1 ? `Selected ${rangeAddress(range)}` : formula ? `${ui.address.textContent}, formula ${formula}` : ui.address.textContent)
  }, ANNOUNCE_DELAY_MS)
}

function announce(text) {
  // Why: re-setting the same text is not re-announced; clearing first makes it a new message.
  ui.live.textContent = ''
  requestAnimationFrame(() => (ui.live.textContent = text))
}

function showNote(text) {
  ui.note.textContent = text
  clearTimeout(noteTimer)
  noteTimer = setTimeout(() => (ui.note.textContent = ''), STATUS_NOTE_MS)
}

function onCopy(event) {
  const sheet = currentSheet()
  if (!sheet || ui.gridHost.hidden || !event.clipboardData) return
  // A text selection outside the grid (say, a formula in the detail bar) copies as usual.
  const textSelection = document.getSelection()
  if (textSelection && !textSelection.isCollapsed && !grid.element.contains(textSelection.anchorNode)) return
  const range = grid.range()
  const getter = (r, c) => getCell(sheet, r, c)
  event.preventDefault()
  event.clipboardData.setData('text/plain', rangeToTsv(range, getter, grid.merges()))
  const cells = rangeCellCount(range)
  if (cells <= MAX_HTML_COPY_CELLS) event.clipboardData.setData('text/html', rangeToHtml(range, getter, grid.merges()))
  const text = `Copied ${countFormat.format(cells)} ${cells === 1 ? 'cell' : 'cells'}`
  showNote(text)
  announce(text)
}

function onTabsKeyDown(event) {
  if (!model) return
  const last = model.sheets.length - 1
  const next =
    event.key === 'ArrowRight' ? Math.min(last, activeIndex + 1)
      : event.key === 'ArrowLeft' ? Math.max(0, activeIndex - 1)
        : event.key === 'Home' ? 0
          : event.key === 'End' ? last
            : null
  if (next === null) return
  event.preventDefault()
  showSheet(next)
  ui.tabs.children[next].focus()
}

ui.tabs.addEventListener('keydown', onTabsKeyDown)
document.addEventListener('copy', onCopy)
window.addEventListener('message', (event) => {
  if (event.source !== window.parent) return
  const message = parseDocumentMessage(event.data)
  if (message) receive(message)
})
showMessage(MESSAGES.opening)
window.parent.postMessage({ type: 'orca-editor-ready' }, '*')
