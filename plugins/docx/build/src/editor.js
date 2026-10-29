import { ArchiveRejectedError, inspectArchive } from './archive-budget.js'
import { MAX_DOCUMENT_BYTES, parseDocument } from './document-message.js'
import { mountNodes, renderNodes } from './render-document.js'

const $ = (id) => document.getElementById(id)
const ui = Object.fromEntries(['message', 'viewport', 'pages', 'fonts', 'out', 'fit', 'in', 'percent', 'count', 'link-bar', 'link', 'close-link'].map((id) => [id, $(id)]))
const shadow = ui.pages.attachShadow({ mode: 'open' })
let version = -Infinity
let generation = 0
let wrapper = null
let scale = 1
let fit = true
let savedScroll = { top: 0, left: 0 }
const clamp = (value) => Math.min(5, Math.max(0.1, value))

function controls() {
  ui.out.disabled = !wrapper || scale <= 0.1
  ui.in.disabled = !wrapper || scale >= 5
  ui.fit.disabled = !wrapper
  ui.percent.textContent = `${Math.round(scale * 100)}%`
  ui.fit.setAttribute('aria-pressed', String(fit))
}

function layout() {
  if (!wrapper) return
  if (fit) scale = clamp(ui.viewport.clientWidth / (wrapper.getBoundingClientRect().width / scale))
  wrapper.style.zoom = String(scale)
  controls()
}

function zoom(next, anchor = { x: 0, y: 0 }) {
  if (!wrapper) return
  const previous = scale
  const x = ui.viewport.scrollLeft + anchor.x
  const y = ui.viewport.scrollTop + anchor.y
  fit = next === 'fit'
  if (!fit) scale = clamp(next)
  wrapper.style.zoom = String(scale)
  layout()
  ui.viewport.scrollLeft = x * scale / previous - anchor.x
  ui.viewport.scrollTop = y * scale / previous - anchor.y
}

function showMessage(text, error = false) {
  ui.message.hidden = false
  ui.message.setAttribute('role', error ? 'alert' : 'status')
  ui.message.textContent = text
}

async function receive(doc) {
  if (doc.version <= version) return
  version = doc.version
  const token = ++generation
  if (wrapper) savedScroll = { top: ui.viewport.scrollTop, left: ui.viewport.scrollLeft }
  const scroll = savedScroll
  wrapper = null
  shadow.replaceChildren()
  ui.fonts.textContent = ''
  ui.count.textContent = ''
  ui['link-bar'].hidden = true
  controls()
  showMessage('Opening Word document…')
  if (doc.bytes.byteLength > MAX_DOCUMENT_BYTES) {
    showMessage('This document exceeds the 50 MiB preview limit.', true)
    return
  }
  try {
    await new Promise((resolve) => setTimeout(resolve, 0))
    if (token !== generation) return
    await inspectArchive(doc.bytes, { cancelled: () => token !== generation })
    const nodes = await renderNodes(doc.bytes)
    if (token !== generation) return
    wrapper = mountNodes(shadow, ui.fonts, nodes)
    if (!wrapper) throw new Error('This document has no previewable pages.')
    wrapper.style.zoom = String(scale)
    ui.message.hidden = true
    layout()
    ui.viewport.scrollTop = scroll.top
    ui.viewport.scrollLeft = scroll.left
    const count = shadow.querySelectorAll('section.docx').length
    ui.count.textContent = `${count} ${count === 1 ? 'page' : 'pages'}`
  } catch (error) {
    if (token !== generation) return
    wrapper = null
    showMessage(error instanceof ArchiveRejectedError ? error.message : 'Unable to preview this Word document. It may be damaged or use an unsupported format.', true)
    controls()
  }
}

function activateLink(event) {
  const anchor = event.target instanceof Element ? event.target.closest('a[data-docx-href]') : null
  if (!anchor) return
  event.preventDefault()
  const href = anchor.dataset.docxHref
  if (href.startsWith('#')) {
    shadow.getElementById(href.slice(1))?.scrollIntoView({ block: 'start' })
  } else if (event.type !== 'auxclick') {
    // API 1.0 has no open-link method. Let users copy the address without navigating the frame.
    ui['link-bar'].hidden = false
    ui.link.value = href
    ui.link.focus()
    ui.link.select()
  }
}

shadow.addEventListener('click', activateLink, true)
shadow.addEventListener('auxclick', activateLink, true)
shadow.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && event.target.matches('a[data-docx-href]')) activateLink(event)
})
ui.out.addEventListener('click', () => zoom(scale / 1.2))
ui.in.addEventListener('click', () => zoom(scale * 1.2))
ui.fit.addEventListener('click', () => zoom('fit'))
ui['close-link'].addEventListener('click', () => { ui['link-bar'].hidden = true; ui.viewport.focus() })
ui.viewport.addEventListener('wheel', (event) => {
  if (!wrapper || !event.ctrlKey) return
  event.preventDefault()
  const rect = ui.viewport.getBoundingClientRect()
  const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? ui.viewport.clientHeight : 1)
  zoom(scale * Math.exp(-Math.max(-100, Math.min(100, delta)) * 0.01), { x: event.clientX - rect.left, y: event.clientY - rect.top })
}, { passive: false })
new ResizeObserver(layout).observe(ui.viewport)
controls()
showMessage('Opening Word document…')
window.orca.document.onDidChange((doc) => {
  const message = parseDocument(doc)
  if (message) void receive(message)
})
