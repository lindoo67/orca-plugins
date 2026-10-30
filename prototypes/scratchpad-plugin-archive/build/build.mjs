import { readFileSync, writeFileSync } from 'node:fs';
const root = new URL('../', import.meta.url);
let html = readFileSync(new URL('build/panel.html', root), 'utf8');
for (const name of ['storage', 'panel']) {
  const script = readFileSync(new URL(`panel/${name}.js`, root), 'utf8');
  html = html.replace(`<script src="${name}.js"></script>`, `<script>\n${script}\n</script>`);
}
writeFileSync(new URL('panel/index.html', root), html);
