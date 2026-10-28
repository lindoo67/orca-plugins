// Builds ../editor/index.html: one self-contained file, because the editor frame's CSP allows only
// inline scripts and styles and data: fonts and images. Also writes ../THIRD_PARTY_NOTICES.txt
// from the packages that end up in the bundle.
// Usage: npm ci && node build.mjs
import { build } from 'esbuild'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'

const HERE = import.meta.dirname
const PLUGIN = path.resolve(HERE, '..')
const OUT = path.join(PLUGIN, 'editor', 'index.html')
const NOTICES = path.join(PLUGIN, 'THIRD_PARTY_NOTICES.txt')
const EXCALIDRAW_DIST = path.join(HERE, 'node_modules', '@excalidraw', 'excalidraw', 'dist', 'prod')
// Why: the CJK font alone is 12 MB in ~200 shards; those characters fall back to a system font.
// Liberation Sans is the GPL-licensed fallback of the deprecated Helvetica family.
const SKIPPED_FONT_FAMILIES = new Set(['Xiaolai', 'Liberation'])

const dataUrl = (file) => `data:font/woff2;base64,${readFileSync(file).toString('base64')}`

// Why: pica's WebAssembly resizer needs 'wasm-unsafe-eval', which the frame CSP refuses (it then
// falls back to JavaScript anyway, after logging a CSP violation).
const PICA_FEATURES = 'features:["js","wasm"]'
let picaFeaturesPatched = false

/** Adapts Excalidraw's prebuilt files to the frame: embedded fonts, and no WebAssembly resizing. */
const adaptExcalidrawDist = {
  name: 'adapt-excalidraw-dist',
  setup(context) {
    context.onLoad({ filter: /[\\/]@excalidraw[\\/]excalidraw[\\/]dist[\\/]prod[\\/].*\.js$/ }, (args) => {
      let code = readFileSync(args.path, 'utf8').replace(
        /"\.\/fonts\/([A-Za-z]+)\/([\w.-]+\.woff2)"/g,
        (_, family, file) =>
          // Why `local:`: Excalidraw resolves that prefix to no URL, so it never fetches the font.
          SKIPPED_FONT_FAMILIES.has(family)
            ? JSON.stringify(`local:${family}`)
            : JSON.stringify(dataUrl(path.join(EXCALIDRAW_DIST, 'fonts', family, file)))
      )
      if (code.includes(PICA_FEATURES)) {
        code = code.replaceAll(PICA_FEATURES, 'features:["js"]')
        picaFeaturesPatched = true
      }
      return { contents: code, loader: 'js' }
    })
  }
}

/** Stand-ins for code the frame can never run; each would otherwise cost megabytes. */
const stubUnreachableModules = {
  name: 'stub-unreachable-modules',
  setup(context) {
    // Why: the editor always runs in English (the host sends no locale); Excalidraw imports others lazily.
    context.onResolve({ filter: /^\.\/locales\/[\w-]+\.js$/ }, (args) =>
      /^\.\/locales\/(en|percentages)-/.test(args.path) ? undefined : { path: 'locale', namespace: 'stub' }
    )
    // Why: font subsetting is 1.8 MB of WebAssembly, which the frame CSP refuses to compile; exports
    // then embed whole fonts instead of subsets.
    context.onResolve({ filter: /^\.\/subset-(shared|worker)\.chunk\.js$/ }, (args) => ({
      path: args.path.includes('worker') ? 'subset-worker' : 'subset-shared',
      namespace: 'stub'
    }))
    context.onLoad({ filter: /.*/, namespace: 'stub' }, (args) => ({
      contents: readFileSync(path.join(HERE, 'src', 'stubs', `${args.path}.js`), 'utf8'),
      resolveDir: path.join(HERE, 'src', 'stubs'),
      loader: 'js'
    }))
  }
}

const result = await build({
  entryPoints: [path.join(HERE, 'src', 'editor.jsx')],
  bundle: true,
  write: false,
  outdir: path.join(HERE, 'out'),
  format: 'iife',
  platform: 'browser',
  conditions: ['production'],
  target: 'chrome120',
  minify: true,
  jsx: 'automatic',
  legalComments: 'none',
  metafile: true,
  logLevel: 'warning',
  absWorkingDir: HERE,
  define: { 'process.env.NODE_ENV': '"production"', 'process.env.IS_PREACT': '"false"' },
  loader: { '.woff2': 'dataurl' },
  plugins: [stubUnreachableModules, adaptExcalidrawDist]
})

if (!picaFeaturesPatched) {
  throw new Error(`${PICA_FEATURES} is no longer in Excalidraw; recheck image resizing under the frame CSP`)
}
const bundledJs = result.outputFiles.find((file) => file.path.endsWith('.js')).text
const css = result.outputFiles.find((file) => file.path.endsWith('.css')).text
// Why: `<!--` then `<script` inside an inline script puts the HTML parser in a state where `</script>`
// no longer ends it. Every occurrence is inside a string or regex literal, where `\x3C` reads the same.
const js = bundledJs.replace(/<(!--|script)/gi, '\\x3C$1')
new vm.Script(js)
if (/<\/script/i.test(js) || /<\/style/i.test(css)) {
  throw new Error('the bundle contains a closing script or style tag; it cannot be inlined')
}
if (/\beval\(|new Function\(/.test(js)) {
  console.warn('warning: the bundle contains eval or new Function; the frame CSP refuses both')
}

const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>Excalidraw</title>
<style>
html, body, #root { height: 100%; margin: 0; overflow: hidden; }
.orca-excalidraw-message { box-sizing: border-box; display: flex; height: 100%; align-items: center;
  justify-content: center; padding: 24px; text-align: center; font: 13px/1.5 system-ui, sans-serif;
  color: var(--orca-muted-foreground, #737373); background: var(--orca-background, transparent); }
/* The library lives only in memory here and its browser is an external site, so it stays hidden. */
.default-sidebar-trigger, .library-menu-browse-button { display: none !important; }
</style>
<style>${css}</style>
</head>
<body>
<div id="root"></div>
<script>${js}</script>
</body>
</html>
`
mkdirSync(path.dirname(OUT), { recursive: true })
writeFileSync(OUT, html)

// Notices: every npm package with code in the bundle, then the embedded fonts.
const packages = new Map()
for (const input of Object.keys(result.metafile.inputs)) {
  const at = input.lastIndexOf('node_modules/')
  if (at === -1) continue
  const name = /^(?:@[^/]+\/)?[^/]+/.exec(input.slice(at + 'node_modules/'.length))[0]
  const dir = path.join(HERE, input.slice(0, at), 'node_modules', name)
  packages.set(dir, { ...JSON.parse(readFileSync(path.join(dir, 'package.json'), 'utf8')), dir })
}
const missingLicences = []
const licenceText = (dir, name) => {
  const file = readdirSync(dir).find((entry) => /^(licen[cs]e|copying)(\.|$)/i.test(entry))
  if (file) return readFileSync(path.join(dir, file), 'utf8').trim()
  // Why: some packages publish no licence file; their repository's licence is kept in build/licenses.
  for (const fallback of [name.replace('/', '__'), name.split('/')[0]]) {
    const file = path.join(HERE, 'licenses', `${fallback}.txt`)
    if (existsSync(file)) return readFileSync(file, 'utf8').trim()
  }
  missingLicences.push(`build/licenses/${name.replace('/', '__')}.txt`)
  return ''
}
const sections = [...packages.values()]
  .sort((a, b) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version))
  .filter((pkg, index, all) => index === 0 || `${pkg.name}@${pkg.version}` !== `${all[index - 1].name}@${all[index - 1].version}`)
  .map((pkg) => `${pkg.name}@${pkg.version} (${pkg.license ?? 'see below'})\n\n${licenceText(pkg.dir, pkg.name)}`)
if (missingLicences.length > 0) {
  throw new Error(`packages without a licence file; add:\n${missingLicences.join('\n')}`)
}
const fonts = readFileSync(path.join(HERE, 'font-notices.txt'), 'utf8').trim()
writeFileSync(
  NOTICES,
  `The Excalidraw editor in editor/index.html bundles the following software and fonts.\n\n` +
    `${[...sections, fonts].join(`\n\n${'='.repeat(78)}\n\n`)}\n`
)

console.log(`editor/index.html: ${Buffer.byteLength(html)} bytes, ${packages.size} packages`)
