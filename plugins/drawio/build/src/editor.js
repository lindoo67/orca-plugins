mxResources.parse(drawioResources['resources/dia.txt']);
mxResources.parse(drawioResources['resources/dia_zh.txt']);
const resource = url => drawioResources[url.split('?')[0]];
const request = url => {
  const text = resource(url);
  if (text == null) throw Error('未打包的离线资源：'+url);
  return {getText:()=>text,getStatus:()=>200,getXml:()=>mxUtils.parseXml(text),getDocumentElement:()=>mxUtils.parseXml(text).documentElement};
};
mxUtils.load = request;
mxUtils.get = (url,done,fail) => { try { const r=request(url); done?.(r); return r; } catch(e) { fail?.(e); } };
Editor.enableServiceWorker = false;
Editor.defaultCompressed = false;
EditorUi.enableLogging = false;
const MAX_DOCUMENT_BYTES = 16 * 1024 * 1024;
const MAX_COMPRESSED_BYTES = 8 * 1024 * 1024;
const MAX_DOCUMENT_ELEMENTS = 100000;
const MAX_PAGES = 100;
const utf8 = new TextEncoder();
const byteLength = text => utf8.encode(text).byteLength;
// The upstream helper inflates into an unbounded string. Stream chunks instead so a
// small compressed page cannot allocate an arbitrarily large renderer payload.
Graph.decompress = function(data, inflate, checked) {
  if (data == null || data.length === 0 || typeof pako === 'undefined') return data;
  if (data.length > Math.ceil(MAX_COMPRESSED_BYTES * 4 / 3) + 4) throw Error('压缩图表超过 8 MB 限制');
  const encoded = atob(data);
  if (encoded.length > MAX_COMPRESSED_BYTES) throw Error('压缩图表超过 8 MB 限制');
  const chunks = [];
  let size = 0;
  const decoder = new pako.Inflate({raw: !inflate});
  decoder.onData = chunk => {
    size += chunk.length;
    if (size > MAX_DOCUMENT_BYTES) throw Error('图表展开后超过 16 MB 限制');
    chunks.push(chunk);
  };
  decoder.push(Graph.stringToArrayBuffer(encoded), true);
  if (decoder.err) throw Error(decoder.msg || '无法解压图表');
  let escaped = '';
  for (const chunk of chunks) escaped += Graph.arrayBufferToString(chunk);
  const result = decodeURIComponent(escaped);
  if (byteLength(result) > MAX_DOCUMENT_BYTES) throw Error('图表展开后超过 16 MB 限制');
  return checked ? result : Graph.zapGremlins(result);
};
const validateModel = (text, totals) => {
  if (byteLength(text) > MAX_DOCUMENT_BYTES) throw Error('图表页面超过 16 MB 限制');
  const xml = mxUtils.parseXml(text);
  if (xml.getElementsByTagName('parsererror').length) throw Error('图表页面 XML 无效');
  totals.elements += xml.getElementsByTagName('*').length;
  if (totals.elements > MAX_DOCUMENT_ELEMENTS) throw Error('图表超过 100,000 个 XML 元素限制');
};
const validateDocument = text => {
  if (byteLength(text) > MAX_DOCUMENT_BYTES) throw Error('图表文件超过 16 MB 限制');
  const xml = mxUtils.parseXml(text);
  if (xml.getElementsByTagName('parsererror').length || !['mxfile','mxGraphModel'].includes(xml.documentElement.nodeName)) throw Error('不是有效的 draw.io XML');
  const totals = {elements: xml.getElementsByTagName('*').length};
  if (totals.elements > MAX_DOCUMENT_ELEMENTS) throw Error('图表超过 100,000 个 XML 元素限制');
  if (xml.documentElement.nodeName === 'mxfile') {
    const pages = xml.getElementsByTagName('diagram');
    if (pages.length > MAX_PAGES) throw Error('图表超过 100 页限制');
    for (const page of pages) {
      const child = page.firstElementChild;
      validateModel(child ? mxUtils.getXml(child) : Graph.decompress(mxUtils.getNodeValue(page)), totals);
    }
  }
  return xml;
};
window.isMermaidEnabled = false;
EditorUi.isMermaidSupported = () => false;
EditorUi.isNativePlantUmlSupported = () => false;
document.body.classList.add('geEditor','geClassic');
const ui = new EditorUi(new Editor());
window.drawioUi = ui;
ui.hsplitPosition=210;
ui.formatWidth=240;
ui.sidebar.showEntries('general;uml;er;bpmn;flowchart;basic;arrows2');
ui.refresh();
const message = document.getElementById('message');
let version = null, readOnly = true, loading = false, baseline = null, lastPosted = null, timer, pending = Promise.resolve();
const serialize = () => ui.getFileData(true);
const showError = error => { message.textContent='无法显示 draw.io 文件：'+error.message+'\n请切换到 Source 检查文件内容。'; message.hidden=false; };
const flush = (commitEditing = true) => {
  clearTimeout(timer);
  if (commitEditing) ui.editor.graph.stopEditing(false);
  pending = pending.then(async () => {
    if (readOnly || loading || baseline == null || version == null) return;
    const text = serialize();
    if (text === baseline) return;
    const previous = baseline;
    baseline = text;
    lastPosted = text;
    try {
      await window.orca.document.applyEdit({baseVersion:version,content:{kind:'text',text}});
      if (baseline === text && serialize() === text) {
        ui.getCurrentFile()?.setModified(false);
        ui.editor.setStatus('已同步 Orca · Ctrl/Cmd+S 保存文件');
      }
    } catch(error) {
      if (baseline === text) { baseline=previous; lastPosted=null; }
      throw error;
    }
  });
  const result = pending;
  pending = result.catch(error => { ui.editor.setStatus('保存失败：'+error.message); });
  return result;
};
const changed = () => { if (!loading && !readOnly) { clearTimeout(timer); timer=setTimeout(()=>flush(false).catch(()=>{}),200); } };
ui.editor.addListener('change',changed);
ui.editor.graph.model.addListener(mxEvent.CHANGE,changed);
for (const event of ['gridSizeChanged','shadowVisibleChanged']) ui.editor.graph.addListener(event,changed);
for (const event of ['pageFormatChanged','pageScaleChanged','backgroundColorChanged','backgroundImageChanged','foldingEnabledChanged','mathEnabledChanged','gridEnabledChanged','guidesEnabledChanged','tooltipsEnabledChanged','pageViewChanged','connectionPointsChanged','connectionArrowsChanged']) ui.addListener(event,changed);
// File operations belong to Orca; keep editing menus and local diagram tools.
ui.menus.defaultMenuItems = ['edit','view','arrange','extras'];
ui.menubar.container.replaceChildren();
ui.menubar = ui.menus.createMenubar(ui.menubar.container);
for (const name of ['save','saveAs','new','open','export','print']) {
  const action=ui.actions.get(name);
  if (action) { action.funct=()=>flush(); action.setEnabled(name==='save'); }
}
// Parsers and network-backed integrations are intentionally absent from this build.
for (const name of ['mermaid','plantUml','importVisio','generate']) {
  const action=ui.actions.get(name);
  if (action) {
    action.funct=()=>{};
    action.setEnabled(false);
    action.setVisible(false);
    action.isEnabled=()=>false;
    action.isVisible=()=>false;
  }
}
const theme = () => ui.setDarkMode(document.documentElement.classList.contains('dark'));
theme();
new MutationObserver(theme).observe(document.documentElement,{attributes:true,attributeFilter:['class']});
window.orca.document.onDidChange(doc => {
  if (!Number.isSafeInteger(doc.version) || doc.content?.kind!=='text') return;
  version=doc.version;
  readOnly=doc.readOnly===true;
  if (doc.content.text===lastPosted && baseline != null) {
    const file=ui.getCurrentFile();
    if (file) file.editable=!readOnly;
    ui.fileEditable=null;
    ui.setGraphEnabled(!readOnly);
    ui.updateUi();
    return;
  }
  clearTimeout(timer);
  loading=true;
  baseline=null;
  lastPosted=null;
  ui.editor.graph.setEnabled(false);
  try {
    const text=doc.content.text.trim();
    if (text) {
      validateDocument(text);
    }
    const file = new LocalFile(ui,text || '<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/></root></mxGraphModel>','diagram.drawio',true,null,null,!readOnly);
    file.isAutosave=()=>false;
    file.addUnsavedStatus=()=>ui.editor.setStatus('修改待同步 Orca…');
    file.save=()=>flush();
    file.saveAs=()=>flush();
    if (!ui.fileLoaded(file,true)) throw ui.fileLoadedError || Error('加载图表失败');
    ui.editor.undoManager.clear();
    baseline=serialize();
    message.hidden=true;
    ui.editor.graph.setEnabled(!readOnly);
    ui.editor.setStatus(readOnly?'只读':'由 Orca 保存 · Ctrl/Cmd+S');
  } catch(error) { showError(error); }
  finally { loading=false; }
});
window.orca.on('editor.flush',flush);
