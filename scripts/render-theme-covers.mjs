// Rebuild the editor-preview covers from the plugins' own app, syntax and terminal colors.
// Requires agent-browser with Chromium installed. Usage: node scripts/render-theme-covers.mjs
import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const root = path.resolve(import.meta.dirname, '..')
const plugins = ['github-light-theme', 'solarized-light-theme', 'dracula-theme', 'gruvbox-theme']
const scratch = mkdtempSync(path.join(tmpdir(), 'orca-theme-covers-'))
const session = execFileSync('agent-browser', ['session', 'id', '--scope', 'worktree', '--prefix', 'theme-cover-render'], { cwd: root, encoding: 'utf8' }).trim()
const browser = (...args) => execFileSync('agent-browser', ['--session', session, ...args], { cwd: root, stdio: 'pipe' })
const json = (file) => JSON.parse(readFileSync(file, 'utf8'))
const escape = (value) => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char])

function preview(pluginDir, contribution) {
  const theme = json(path.join(pluginDir, contribution.path))
  const manifest = json(path.join(pluginDir, 'orca-plugin.json'))
  const terminalContribution = manifest.contributes.terminalThemes.find((entry) => entry.id === contribution.id)
  const terminal = json(path.join(pluginDir, terminalContribution.path)).terminal
  const t = theme.tokens
  const color = (name) => theme.tokenColors.find((rule) => rule.name === name)?.settings.foreground ?? t['--foreground']
  const span = (text, name) => `<span style="color:${escape(color(name))}">${escape(text)}</span>`
  const k = (text) => span(text, 'Keywords')
  const s = (text) => span(text, 'Strings')
  const f = (text) => span(text, 'Functions')
  const ty = (text) => span(text, 'Types')
  const n = (text) => span(text, 'Numbers')
  const lines = [
    `<i style="color:${color('Comments')}">// Resolve the palette for the active workspace.</i>`,
    `${k('import')} { ${f('createTheme')} } ${k('from')} ${s("'./theme'")}`,
    '',
    `${k('export interface')} ${ty('Workspace')} {`,
    `  name: ${ty('string')}`,
    `  tabs: ${ty('number')}`,
    '}',
    '',
    `${k('export function')} ${f('openWorkspace')}(ws: ${ty('Workspace')}) {`,
    `  ${k('const')} theme = ${f('createTheme')}({ contrast: ${n('0.92')} })`,
    `  ${k('if')} (ws.tabs &gt; ${n('12')}) ${k('return')} theme.${f('compact')}()`,
    `  ${k('return')} { ...theme, title: ws.name + ${s("' — Orca'")} }`,
    '}'
  ]
  const swatches = [t['--background'], t['--sidebar'], t['--accent'], t['--foreground'], t['--primary'], ...['Comments', 'Keywords', 'Strings', 'Numbers', 'Functions', 'Types'].map(color)]
  const cssVars = Object.entries(t).map(([key, value]) => `${key}:${value}`).join(';')
  return `<section class="window" style="${cssVars};--terminal-bg:${terminal.background};--terminal-fg:${terminal.foreground};--terminal-green:${terminal.green};--terminal-blue:${terminal.blue};--terminal-cyan:${terminal.cyan}">
    <header><div class="traffic"><b></b><b></b><b></b></div><span>atlas — Orca</span><span class="theme-name">${escape(contribution.title)}</span></header>
    <div class="workspace"><aside><h2>EXPLORER</h2>${['src', '  components', '    Sidebar.tsx', '    theme.ts', '  server', '    router.ts', 'package.json', 'README.md', 'tsconfig.json'].map((file) => `<div class="file ${file.trim() === 'theme.ts' ? 'selected' : ''}" style="padding-left:${18 + (file.length - file.trimStart().length) * 8}px"><b></b>${escape(file.trim())}</div>`).join('')}</aside>
    <main><nav><span class="active">theme.ts</span><span>router.ts</span><span>README.md</span></nav>
    <div class="editor">${lines.map((line, i) => `<div class="line"><span class="number">${i + 1}</span><code>${line || ' '}</code></div>`).join('')}</div>
    <div class="terminal"><div class="terminal-tabs">TERMINAL <span>zsh — atlas</span></div><pre><span class="prompt">~/atlas</span> <span class="branch">main</span>
<span class="chevron">❯</span> git status --short
 <span class="branch">M</span> src/theme.ts
 <span class="branch">M</span> src/palette.ts
<span class="chevron">❯</span> <span class="cursor"> </span></pre></div>
    </main></div><div class="palette">${swatches.map((value) => `<b style="background:${value}"></b>`).join('')}</div>
  </section>`
}

function page(pluginDir, contributions) {
  const first = json(path.join(pluginDir, contributions[0].path)).tokens
  const last = json(path.join(pluginDir, contributions.at(-1).path)).tokens
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  *{box-sizing:border-box}html,body{margin:0;width:1600px;height:1000px;overflow:hidden}
  body{font-family:Arial,sans-serif;background:linear-gradient(120deg,${first['--sidebar']},${last['--accent']})}
  .window{position:absolute;left:110px;top:90px;width:1380px;height:820px;border:1px solid var(--border);border-radius:13px;overflow:hidden;background:var(--background);color:var(--foreground);box-shadow:0 28px 64px #0002}
  header{height:40px;background:var(--card);border-bottom:1px solid var(--border);display:flex;align-items:center;gap:26px;padding:0 16px;font-size:13px}
  .traffic{display:flex;gap:8px}.traffic b{display:block;width:12px;height:12px;border-radius:50%;background:#ff5f57}.traffic b:nth-child(2){background:#febc2e}.traffic b:nth-child(3){background:#28c840}
  .theme-name{margin-left:auto;color:var(--muted-foreground);font-size:12px}
  .workspace{display:flex;height:calc(100% - 40px)}aside{width:248px;flex-shrink:0;background:var(--sidebar);border-right:1px solid var(--sidebar-border);padding:0 10px;color:var(--sidebar-foreground)}
  h2{font-size:12px;letter-spacing:.5px;margin:18px 8px 13px}.file{height:28px;display:flex;align-items:center;gap:10px;font-size:13px;border-radius:6px;white-space:pre}.file b{height:7px;width:7px;background:currentColor;opacity:.45;border-radius:2px}.selected{background:var(--sidebar-accent);color:var(--sidebar-accent-foreground)}
  main{position:relative;flex:1;min-width:0;background:var(--editor-surface)}nav{height:40px;display:flex;background:var(--card);border-bottom:1px solid var(--border);font-size:13px}nav span{padding:12px 18px;border-right:1px solid var(--border);color:var(--muted-foreground)}nav .active{border-top:2px solid var(--primary);padding-top:10px;background:var(--editor-surface);color:var(--foreground)}
  .editor{padding:20px 0 22px;height:430px}.line{display:flex;line-height:26px;white-space:pre;font-size:16px;font-family:Menlo,Consolas,monospace}.number{width:56px;text-align:right;padding-right:24px;color:var(--muted-foreground);opacity:.8;flex-shrink:0}code{font:inherit}
  .terminal{height:310px;border-top:1px solid var(--border);background:var(--terminal-bg);color:var(--terminal-fg)}.terminal-tabs{height:34px;display:flex;align-items:center;gap:30px;border-bottom:1px solid var(--border);padding:0 23px;font-size:11px;letter-spacing:.5px;color:var(--muted-foreground)}.terminal-tabs span{letter-spacing:0;font-size:12px}pre{margin:18px 25px;font-family:Menlo,Consolas,monospace;font-size:15px;line-height:25px}.prompt{color:var(--terminal-blue)}.branch{color:var(--terminal-green)}.chevron{color:var(--terminal-cyan)}.cursor{background:var(--terminal-fg);opacity:.6}
  .palette{position:absolute;right:28px;bottom:28px;display:flex;height:32px;border:1px solid var(--border);border-radius:6px;overflow:hidden}.palette b{width:36px}
  .duo .window{width:1180px;transform:scale(.68);transform-origin:top left;left:70px;top:90px}.duo .window:nth-child(2){left:710px;top:320px}
  </style></head><body class="${contributions.length > 1 ? 'duo' : ''}">${contributions.map((entry) => preview(pluginDir, entry)).join('')}</body></html>`
}

try {
  browser('set', 'viewport', '1600', '1000')
  for (const name of plugins) {
    const pluginDir = path.join(root, 'plugins', name)
    const manifest = json(path.join(pluginDir, 'orca-plugin.json'))
    const html = path.join(scratch, `${name}.html`)
    writeFileSync(html, page(pluginDir, manifest.contributes.themes))
    mkdirSync(path.join(pluginDir, 'images'), { recursive: true })
    browser('open', pathToFileURL(html).href)
    browser('screenshot', path.join(pluginDir, 'images', 'cover.png'))
    console.log(`Rendered plugins/${name}/images/cover.png`)
  }
} finally {
  browser('close')
  rmSync(scratch, { recursive: true, force: true })
}
