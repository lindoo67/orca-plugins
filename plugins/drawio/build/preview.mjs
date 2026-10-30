// Render genuine editor previews; also export generated raster art to marketplace sizes.
import { readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
const require=createRequire(resolve(process.env.ORCA_DIR || '/data/LinDoo/orca','package.json'))
const {chromium}=require('playwright')
const root=resolve(import.meta.dirname,'..')
const browser=await chromium.launch({headless:true,args:['--no-sandbox']})
try {
  const page=await browser.newPage({viewport:{width:1600,height:1000},deviceScaleFactor:1})
  // Resize/re-encode the original AI-generated assets, without changing their design.
  for (const [input,output,width,height,type,quality] of [
    [process.env.DRAWIO_ICON_SOURCE,'icon.png',256,256,'image/png',undefined],
    [process.env.DRAWIO_ICON_SOURCE,'tab-icon.png',128,128,'image/png',undefined],
    [process.env.DRAWIO_COVER_SOURCE,'cover.webp',1600,1000,'image/webp',0.88]
  ]) {
    if (!input) continue
    await page.setContent('<canvas></canvas>')
    const data=await page.evaluate(async({source,width,height,type,quality})=>{
      const img=new Image();img.src=source;await img.decode();const canvas=document.querySelector('canvas');canvas.width=width;canvas.height=height;canvas.getContext('2d').drawImage(img,0,0,width,height);return canvas.toDataURL(type,quality).split(',')[1]
    },{source:'data:image/png;base64,'+readFileSync(input).toString('base64'),width,height,type,quality})
    writeFileSync(resolve(root,'images',output),Buffer.from(data,'base64'))
  }
  const html=readFileSync(resolve(root,'editor/index.html'),'utf8')
  const template=readFileSync(resolve(root,'templates/empty.drawio'),'utf8')
  const prelude=`<meta http-equiv="Content-Security-Policy" content="default-src 'none'; connect-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; font-src data:; base-uri 'none'; form-action 'none'"><script>
  window.current={version:1,readOnly:false,content:{kind:'text',text:${JSON.stringify(template)}}};window.orca={document:{onDidChange(fn){window.receive=fn;fn(current)},async applyEdit(edit){current={...current,version:current.version+1,content:edit.content};receive(current)}},on(name,fn){window.flush=fn}};</script>`
  await page.setContent('<style>html,body{margin:0;height:100%;overflow:hidden}iframe{width:100%;height:100%;border:0}</style><iframe sandbox="allow-scripts"></iframe>')
  await page.locator('iframe').evaluate((el,html)=>el.srcdoc=html,prelude+html)
  const frame=page.frames()[1]
  await frame.waitForFunction(()=>document.getElementById('message')?.hidden,null,{timeout:30000})
  await frame.evaluate(async()=>{
    const ui=drawioUi,g=ui.editor.graph,p=g.getDefaultParent();g.model.beginUpdate();
    const box=(id,text,x,y,w,h,color,stroke,extra='')=>g.insertVertex(p,id,text,x,y,w,h,`rounded=1;whiteSpace=wrap;html=1;fontSize=16;fillColor=${color};strokeColor=${stroke};strokeWidth=2;${extra}`);
    const edge=(a,b,text='')=>g.insertEdge(p,null,text,a,b,'edgeStyle=orthogonalEdgeStyle;rounded=1;html=1;fontSize=13;strokeWidth=2;strokeColor=#64748b;');
    try {
      box('title','离线图表工作流',60,45,660,50,'none','none','fontSize=27;fontStyle=1;align=left;');
      box('subtitle','Draw.io × Orca · 本地编辑 · 多页图表 · 版本保护',60,102,720,35,'none','none','fontSize=15;align=left;');
      const file=box('file','打开 .drawio 文件',80,190,190,70,'#dae8fc','#6c8ebf');
      const editor=box('editor','绘制与编辑',385,190,190,70,'#ffe6cc','#d79b00');
      const buffer=box('buffer','Orca 文档缓冲区',385,355,190,70,'#d5e8d4','#82b366');
      const save=box('save','保存本地文件',690,355,190,70,'#dae8fc','#6c8ebf');
      const pages=box('pages','多页图表',80,520,190,70,'#e1d5e7','#9673a6');
      const history=box('history','撤销 / 重做',385,520,190,70,'#e1d5e7','#9673a6');
      const conflict=box('conflict','版本冲突保护',690,520,190,70,'#f8cecc','#b85450');
      edge(file,editor,'XML');edge(editor,buffer,'同步修改');edge(buffer,save,'Ctrl / Cmd + S');edge(pages,history);edge(history,conflict);
      box('note','无需联网 · 文件保存由 Orca 管理',80,675,800,55,'#f5f5f5','#cccccc','fontSize=16;');
    } finally {g.model.endUpdate()}
    g.clearSelection();await flush();ui.editor.setStatus('已同步 Orca · Ctrl/Cmd+S 保存文件');
  })
  for (const [name,dark,selected] of [['editing-light.png',false,false],['editing-dark.png',true,false],['editing-selection.png',false,true]]) {
    await frame.evaluate(({dark,selected})=>{document.documentElement.classList.toggle('dark',dark);const g=drawioUi.editor.graph;if(selected)g.setSelectionCell(g.model.getCell('editor'));else g.clearSelection()},{dark,selected})
    await page.waitForTimeout(350)
    await page.screenshot({path:resolve(root,'images',name)})
  }
  console.log('Exported marketplace art and three real editor previews')
} finally {await browser.close()}
