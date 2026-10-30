// Gera docs/ (o que o GitHub Pages publica) a partir de web/ e config.json.
// - index.html: template literals convertidos em concatenação (regra do projeto) e config preenchida
// - sw.js: VERSAO trocada por um hash do index, para o service worker atualizar as cópias
// - manifest, ícones e .nojekyll copiados
const fs = require('fs'), path = require('path'), crypto = require('crypto'), babel = require('@babel/core');
const root = path.join(__dirname, '..');
const web = path.join(root, 'web'), docs = path.join(root, 'docs');

const cfg = JSON.parse(fs.readFileSync(path.join(root, 'config.json'), 'utf8'));
const faltando = ['apiUrl', 'googleClientId'].filter(k => !cfg[k] || /^\{\{/.test(cfg[k]));
if (faltando.length) console.warn('AVISO: config.json sem ' + faltando.join(' e ') + ' — o app vai mostrar "Configuração pendente".');
const attr = v => String(v).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

let n = 0;
let html = fs.readFileSync(path.join(web, 'index.src.html'), 'utf8').replace(/<script>([\s\S]*?)<\/script>/g, (m, code) => {
  const r = babel.transformSync(code, { babelrc: false, configFile: false, compact: false, retainLines: false,
    plugins: ['@babel/plugin-transform-template-literals'], assumptions: { ignoreToPrimitiveHint: true, mutableTemplateObject: true } });
  n++; return '<script>\n' + r.code + '\n</script>';
});
if (!faltando.includes('apiUrl')) html = html.replace('{{API_URL}}', attr(cfg.apiUrl));
if (!faltando.includes('googleClientId')) html = html.replace('{{GOOGLE_CLIENT_ID}}', attr(cfg.googleClientId));

fs.rmSync(docs, { recursive: true, force: true });
fs.mkdirSync(path.join(docs, 'icons'), { recursive: true });
fs.writeFileSync(path.join(docs, 'index.html'), html);
const versao = crypto.createHash('sha256').update(html).digest('hex').slice(0, 10);
fs.writeFileSync(path.join(docs, 'sw.js'), fs.readFileSync(path.join(web, 'sw.js'), 'utf8').replace('__VERSAO__', versao));
fs.copyFileSync(path.join(web, 'manifest.webmanifest'), path.join(docs, 'manifest.webmanifest'));
for (const f of fs.readdirSync(path.join(web, 'icons'))) fs.copyFileSync(path.join(web, 'icons', f), path.join(docs, 'icons', f));
fs.writeFileSync(path.join(docs, '.nojekyll'), '');

console.log('docs/ gerado · scripts', n, '· backticks restantes', (html.match(/`/g) || []).length,
  '· ${ restantes', (html.match(/\$\{/g) || []).length, '· versão', versao);
