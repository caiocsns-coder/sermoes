// Gera docs/ (o que o GitHub Pages publica) a partir de web/ e config.json,
// e apps-script/ (o que se cola no Apps Script) a partir de servidor/.
//
// Página:
// - web/index.html é a casca; o build troca /*@@CSS@@*/ pelos web/css/*.css (em ordem de nome)
//   e /*@@JS@@*/ pelo pacote de web/js/main.js (esbuild junta os módulos);
// - o pacote vai dentro de uma IIFE com 'use strict' (nenhuma variável global) e passa pelo Babel,
//   que troca template literals por concatenação: docs/index.html sai sem crases nem ${;
// - o primeiro <script> da casca (mostra erros na tela) é copiado como está;
// - config.json preenche as <meta> sermoes:api e sermoes:client;
// - sw.js: VERSAO trocada por um hash do index, para o service worker atualizar as cópias.
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const babel = require('@babel/core'), esbuild = require('esbuild');
const root = path.join(__dirname, '..');
const web = path.join(root, 'web'), docs = path.join(root, 'docs');

const cfg = JSON.parse(fs.readFileSync(path.join(root, 'config.json'), 'utf8'));
const faltando = ['apiUrl', 'googleClientId'].filter(k => !cfg[k] || /^\{\{/.test(cfg[k]));
if (faltando.length) console.warn('AVISO: config.json sem ' + faltando.join(' e ') + ' — o app vai mostrar "Configuração pendente".');
const attr = v => String(v).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const semCrases = code => babel.transformSync(code, { babelrc: false, configFile: false, compact: false, retainLines: false,
  plugins: ['@babel/plugin-transform-template-literals'], assumptions: { ignoreToPrimitiveHint: true, mutableTemplateObject: true } }).code;

// CSS
const pastaCss = path.join(web, 'css');
const css = fs.readdirSync(pastaCss).filter(f => f.endsWith('.css')).sort()
  .map(f => fs.readFileSync(path.join(pastaCss, f), 'utf8').trimEnd()).join('\n\n');

// JS: módulos → um arquivo, dentro da IIFE
const pacote = esbuild.buildSync({
  entryPoints: [path.join(web, 'js', 'main.js')], bundle: true, write: false, format: 'esm',
  target: ['safari15', 'chrome100'], charset: 'utf8', legalComments: 'inline', logLevel: 'silent',
});
for (const a of pacote.warnings) console.warn('AVISO esbuild: ' + a.text);
let js = pacote.outputFiles[0].text.replace(/^"use strict";\n/, '');
if (/^\s*(export|import)\b/m.test(js)) throw new Error('o pacote ainda tem import/export');
js = "(function () {\n'use strict';\n" + semCrases(js).trim() + '\n})();';

let html = fs.readFileSync(path.join(web, 'index.html'), 'utf8');
const scripts = (html.match(/<script>/g) || []).length;
if (!/^<script>\n\/\* Mostra qualquer erro/m.test(html)) throw new Error('o primeiro <script> (erros na tela) sumiu da casca');
html = html.replace('/*@@CSS@@*/', () => css).replace('/*@@JS@@*/', () => js);
if (/@@(CSS|JS)@@/.test(html)) throw new Error('marcador @@CSS@@ ou @@JS@@ não encontrado na casca');
if (!faltando.includes('apiUrl')) html = html.replace('{{API_URL}}', attr(cfg.apiUrl));
if (!faltando.includes('googleClientId')) html = html.replace('{{GOOGLE_CLIENT_ID}}', attr(cfg.googleClientId));
const crases = (html.match(/`/g) || []).length, interp = (html.match(/\$\{/g) || []).length;
if (crases || interp) throw new Error('docs/index.html ficaria com ' + crases + ' crases e ' + interp + ' ${');

fs.rmSync(docs, { recursive: true, force: true });
fs.mkdirSync(path.join(docs, 'icons'), { recursive: true });
fs.writeFileSync(path.join(docs, 'index.html'), html);
const versao = crypto.createHash('sha256').update(html).digest('hex').slice(0, 10);
fs.writeFileSync(path.join(docs, 'sw.js'), fs.readFileSync(path.join(web, 'sw.js'), 'utf8').replace('__VERSAO__', versao));
fs.copyFileSync(path.join(web, 'manifest.webmanifest'), path.join(docs, 'manifest.webmanifest'));
for (const f of fs.readdirSync(path.join(web, 'icons'))) fs.copyFileSync(path.join(web, 'icons', f), path.join(docs, 'icons', f));
fs.writeFileSync(path.join(docs, '.nojekyll'), '');

// Servidor: servidor/NN-*.gs → apps-script/Code.gs (um arquivo só, para colar no editor do Apps Script).
// No Apps Script todos os .gs dividem o mesmo escopo global, então juntar não muda nada.
const pastaGs = path.join(root, 'servidor'), saidaGs = path.join(root, 'apps-script');
const partesGs = fs.readdirSync(pastaGs).filter(f => /^\d\d-.+\.gs$/.test(f)).sort();
const codeGs = '// GERADO por npm run build a partir de servidor/' + ' (' + partesGs.length + ' arquivos). Não edite aqui: edite servidor/ e rode o build.\n'
  + partesGs.map(f => fs.readFileSync(path.join(pastaGs, f), 'utf8').trimEnd()).join('\n\n') + '\n';
if (/`/.test(codeGs)) console.warn('AVISO: Code.gs tem crases (template literals). O editor do Apps Script aceita, mas a regra do projeto é concatenação.');
fs.rmSync(saidaGs, { recursive: true, force: true });
fs.mkdirSync(saidaGs);
fs.writeFileSync(path.join(saidaGs, 'Code.gs'), codeGs);
fs.copyFileSync(path.join(pastaGs, 'Seed.gs'), path.join(saidaGs, 'Seed.gs'));
fs.copyFileSync(path.join(pastaGs, 'appsscript.json'), path.join(saidaGs, 'appsscript.json'));
const versaoGs = crypto.createHash('sha256').update(codeGs).digest('hex').slice(0, 10);

console.log('docs/ gerado · módulos', fs.readdirSync(path.join(web, 'js')).length, '· scripts', scripts,
  '· crases 0 · versão', versao);
console.log('apps-script/ gerado · Code.gs de', partesGs.length, 'arquivos ·', codeGs.split('\n').length, 'linhas · versão', versaoGs);
