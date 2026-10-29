import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { strToU8, zipSync } from 'fflate'
import { fixture } from './fixture.mjs'
import { launch, openEditor, postFile } from './harness.mjs'

let browser
before(async () => { browser = await launch() })
after(async () => { await browser?.close() })

test('renders pages, tables, headers and footers in light and dark themes', async () => {
  for (const theme of ['light', 'dark']) {
    const { page, frame, errors } = await openEditor(browser, { theme })
    await postFile(page, frame, fixture(), 'docx')
    assert.equal(await frame.locator('section.docx').count(), 2)
    assert.match(await frame.locator('section.docx').first().textContent(), /Quarterly report/)
    assert.match(await frame.locator('table').textContent(), /\$128,000/)
    assert.equal(await frame.locator('header').count(), 2)
    assert.equal(await frame.locator('footer').count(), 2)
    assert.equal(await frame.locator('#pages').evaluate(async (node) => {
      const image = node.shadowRoot.querySelector('img')
      await image.decode()
      return image.src.startsWith('data:') && image.naturalWidth === 1
    }), true)
    assert.equal(await frame.locator('#count').textContent(), '2 pages')
    assert.equal(await frame.locator('.footer .label').textContent(), 'Word document · Read only')
    assert.equal(await frame.locator('section.docx').first().evaluate((node) => getComputedStyle(node).backgroundColor), 'rgb(255, 255, 255)')
    assert.equal(await frame.locator('section.docx').first().evaluate((node) => getComputedStyle(node).color), 'rgb(0, 0, 0)')
    assert.deepEqual(errors, [])
    await page.close()
  }
})

test('supports zoom, fit, Ctrl-wheel, and bookmarks', async () => {
  const { page, frame, errors } = await openEditor(browser)
  await postFile(page, frame, fixture(), 'docx')
  const initial = parseInt(await frame.locator('#percent').textContent())
  await frame.getByRole('button', { name: 'Zoom in', exact: true }).click()
  assert.ok(parseInt(await frame.locator('#percent').textContent()) > initial)
  await frame.getByRole('button', { name: 'Fit to width', exact: true }).click()
  assert.equal(parseInt(await frame.locator('#percent').textContent()), initial)
  await frame.locator('#viewport').dispatchEvent('wheel', { ctrlKey: true, deltaY: -25, clientX: 200, clientY: 200 })
  assert.ok(parseInt(await frame.locator('#percent').textContent()) > initial)
  await frame.getByRole('link', { name: 'Jump to details' }).click()
  assert.ok(await frame.locator('#viewport').evaluate((node) => node.scrollTop) > 500)
  assert.deepEqual(errors, [])
  await page.close()
})

test('keeps zoom and scroll through external rewrites; ignores stale and text documents', async () => {
  const { page, frame, errors } = await openEditor(browser)
  await postFile(page, frame, fixture(), 'docx')
  await frame.getByRole('button', { name: 'Zoom in', exact: true }).click()
  const scale = await frame.locator('#percent').textContent()
  await frame.locator('#viewport').evaluate((node) => { node.scrollTop = 800 })
  await page.evaluate((base64) => window.__postBytes(base64, 'docx'), Buffer.from(fixture({ title: 'Updated report' })).toString('base64'))
  await frame.getByText('Updated report', { exact: true }).waitFor()
  assert.equal(await frame.locator('#percent').textContent(), scale)
  assert.ok(await frame.locator('#viewport').evaluate((node) => node.scrollTop) >= 795)
  await page.evaluate((base64) => {
    window.__postBytes(base64, 'docx', 1)
    window.__post({ version: 100, content: { kind: 'text', text: 'wrong kind' } })
  }, Buffer.from(fixture({ title: 'Stale report' })).toString('base64'))
  await frame.waitForTimeout(80)
  assert.equal(await frame.getByText('Stale report', { exact: true }).count(), 0)
  assert.equal(await frame.getByText('Updated report', { exact: true }).count(), 1)
  assert.deepEqual(errors, [])
  await page.close()
})

test('external links are copyable and cannot navigate; active document content never runs', async () => {
  const { page, frame, errors } = await openEditor(browser)
  const requests = []
  page.on('request', (request) => requests.push(request.url()))
  await postFile(page, frame, fixture({ hostile: true }), 'docx')
  await frame.getByRole('link', { name: 'View report online' }).click()
  assert.equal(await frame.locator('#link').inputValue(), 'https://example.com/report')
  assert.equal(await frame.locator('#link').evaluate((node) => node.selectionEnd - node.selectionStart), 26)
  assert.equal(await frame.getByText('Unsafe link', { exact: true }).getAttribute('role'), null)
  assert.equal(await frame.locator('#pages').evaluate((node) => node.shadowRoot.querySelectorAll('iframe,script,object,embed,[href]').length), 0)
  assert.equal(await frame.locator('#pages').evaluate((node) => node.shadowRoot.textContent.includes('ALTCHUNK SHOULD NOT RENDER')), false)
  assert.equal(await frame.locator('.footer').isVisible(), true)
  assert.equal(await frame.locator('#fonts').textContent(), '')
  assert.equal(await frame.evaluate(() => globalThis.docxExecuted), undefined)
  assert.equal(frame.url(), 'about:srcdoc')
  assert.deepEqual(requests, [])
  assert.deepEqual(errors, [])
  assert.equal(await page.evaluate(() => window.__messages.some((message) => message.method?.includes('applyEdit'))), false)
  await page.close()
})

test('rejects files over the input limit before parsing', async () => {
  const { page, frame, errors } = await openEditor(browser)
  await page.evaluate(() => window.__post({ version: 1, content: { kind: 'bytes', bytes: new ArrayBuffer(51 * 1024 * 1024) } }))
  await frame.locator('[role="alert"]').waitFor()
  assert.match(await frame.locator('[role="alert"]').textContent(), /50 MiB/)
  assert.deepEqual(errors, [])
  await page.close()
})

test('refuses damaged and oversized XML archives, and recovers on a later valid document', async () => {
  const { page, frame, errors } = await openEditor(browser)
  await postFile(page, frame, strToU8('bad zip'), 'docx', { waitFor: '[role="alert"]' })
  assert.match(await frame.locator('[role="alert"]').textContent(), /damaged/)
  const bomb = zipSync({ 'word/media/disguised.png': strToU8(`<x>${'x'.repeat(33 * 1024 * 1024)}</x>`) })
  await page.evaluate((base64) => window.__postBytes(base64, 'docx'), Buffer.from(bomb).toString('base64'))
  await frame.waitForFunction(() => document.getElementById('message').textContent.includes('expands past'))
  assert.equal(await frame.locator('section.docx').count(), 0)
  await page.evaluate((base64) => window.__postBytes(base64, 'docx'), Buffer.from(fixture()).toString('base64'))
  await frame.locator('section.docx').first().waitFor()
  assert.equal(await frame.locator('[role="alert"]').count(), 0)
  assert.deepEqual(errors, [])
  await page.close()
})

test('a valid ZIP without a Word document shows a readable error', async () => {
  const { page, frame, errors } = await openEditor(browser)
  await postFile(page, frame, zipSync({ 'note.txt': strToU8('not Word') }), 'docx', { waitFor: '[role="alert"]' })
  assert.match(await frame.locator('[role="alert"]').textContent(), /Unable to preview this Word document/)
  assert.deepEqual(errors, [])
  await page.close()
})
