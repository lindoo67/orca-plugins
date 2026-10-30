// Build a CSP-compatible, offline editor from a pinned upstream checkout.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { resolve, dirname, extname } from 'node:path'
import { gzipSync } from 'node:zlib'
import { execFileSync } from 'node:child_process'
import vm from 'node:vm'
const root = resolve(import.meta.dirname, '..')
const upstream = resolve(process.env.DRAWIO_DIR || '/tmp/orca-drawio-upstream')
const revision = '84487b4891cbc0f32d7e30f34cf878c87cb1f414'
if (execFileSync('git', ['rev-parse', 'HEAD'], { cwd: upstream, encoding: 'utf8' }).trim() !== revision) throw Error('Use the pinned upstream revision: ' + revision)
const web = resolve(upstream, 'src/main/webapp')
const read = p => readFileSync(resolve(web, p), 'utf8')
const mime = {'.png':'image/png','.gif':'image/gif','.svg':'image/svg+xml','.jpg':'image/jpeg','.woff':'font/woff','.woff2':'font/woff2'}
const asset = p => {
  p = p.replace(/^\.\.\//, '')
  if (!mime[extname(p)] || !existsSync(resolve(web, p))) return null
  return `data:${mime[extname(p)]};base64,${readFileSync(resolve(web,p)).toString('base64')}`
}
let js = ['js/app.min.js','js/shapes-14-6-5.min.js','js/stencils.min.js'].map(read).join('\n;\n')
// Upstream uses relative image names in constructors and CSS. Embed those assets.
js = js.replace(/(['"])((?:images|img|mxgraph\/images)\/[^'"\s]+)\1/g, (all,q,p) => asset(p) ? q + asset(p) + q : all)
new vm.Script(js)
const resources = Object.fromEntries(['resources/dia.txt','resources/dia_zh.txt','styles/default.xml','styles/dark-default.xml'].map(p => [p,read(p)]))
let css = ['styles/grapheditor.css','mxgraph/css/common.css'].map(p => read(p).replace(/url\(['"]?([^)'"\s]+)['"]?\)/g, (all,path) => {
  const a = asset(resolve(web,dirname(p),path).slice(web.length+1))
  return a ? `url("${a}")` : all
})).join('\n')
const payload = gzipSync(JSON.stringify({ js, css, resources }), {level:9,mtime:0}).toString('base64')
const boot = readFileSync(resolve(import.meta.dirname,'src/bootstrap.js'),'utf8')
const editor = readFileSync(resolve(import.meta.dirname,'src/editor.js'),'utf8')
// Script bodies are source, so escape closing tags rather than every less-than operator.
const safe = s => s.replace(/<\/script/gi,'<\\/script').replace(/<!--/g,'\\x3c!--')
const html = `<meta charset="utf-8"><style>html,body{height:100%;margin:0;overflow:hidden}#message{position:fixed;inset:0;display:grid;place-content:center;background:var(--orca-background,#fff);color:var(--orca-foreground,#222);font:14px system-ui;z-index:99999;padding:32px;white-space:pre-wrap}#message[hidden]{display:none}</style><div id="message" role="status">正在加载 draw.io…</div><script>${safe(boot)}\n(async()=>{try{const bytes=Uint8Array.from(atob('${payload}'),c=>c.charCodeAt(0));const data=JSON.parse(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text());window.drawioResources=data.resources;const style=document.createElement('style');style.textContent=data.css;document.head.append(style);const script=document.createElement('script');script.textContent=data.js;document.head.append(script);${safe(editor)}\n}catch(error){document.getElementById('message').textContent='draw.io 加载失败：'+error.message;console.error(error)}})();</script>`
if (Buffer.byteLength(html)>10*1024*1024) throw Error('Editor exceeds Orca entry limit')
mkdirSync(resolve(root,'editor'),{recursive:true})
writeFileSync(resolve(root,'editor/index.html'),html)
writeFileSync(resolve(root,'THIRD_PARTY_NOTICES.txt'),`draw.io ${readFileSync(resolve(upstream,'VERSION'),'utf8').trim()}\nhttps://github.com/jgraph/drawio\nRevision: ${revision}\n\n`+readFileSync(resolve(upstream,'LICENSE'),'utf8'))
console.log(`Built editor/index.html (${Buffer.byteLength(html)} bytes)`)
