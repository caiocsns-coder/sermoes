// Teste de fumaça: abre docs/index.html como se estivesse no GitHub Pages (https://app.test/),
// com a API simulada (tools/mock-server.js + servidor/Seed.gs) e o login do Google simulado.
// Cobre: login, código de pareamento (app instalado), inserir blocos, citações de Ellen White, busca de versículo, seleção, desfazer, tempo por parte,
// salvamento automático, conflito, sessão vencida, busca na lista, importar/exportar, modo sem internet, Pregar e Holyrics.
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const { criarServidor } = require('./mock-server');
const root = path.join(__dirname, '..'), docs = path.join(root, 'docs');

const html0 = fs.readFileSync(path.join(docs, 'index.html'), 'utf8');
if (/`|\$\{/.test(html0.replace(/<style>[\s\S]*?<\/style>/, ''))) { console.error('FALHA: docs/index.html ainda tem crase ou ${ — rode npm run build'); process.exit(1); }
if (!/Mostra qualquer erro na tela/.test(html0)) { console.error('FALHA: o primeiro <script> (erros na tela) sumiu'); process.exit(1); }
// configuração de teste no lugar da real
const html = html0
  .replace(/(<meta name="sermoes:api" content=")[^"]*"/, '$1https://api.test/exec"')
  .replace(/(<meta name="sermoes:client" content=")[^"]*"/, '$1cliente-teste.apps.googleusercontent.com"');

const GIS_FALSO = `window.google={accounts:{id:{
  initialize:function(c){window.__gcb=c.callback;}, prompt:function(){}, disableAutoSelect:function(){},
  renderButton:function(el){el.innerHTML='<button id="gtest">Entrar com Google (teste)</button>';el.firstChild.onclick=function(){window.__gcb({credential:'id-token-teste'});};}
}}};`;

const srv = criarServidor(fs.readFileSync(path.join(root, 'servidor/Seed.gs'), 'utf8'));
const ESPERA = 3300;
/* avança a hora da página e confere (o fastForward do Playwright às vezes é ignorado logo depois de um runFor) */
const avancar = async (pg, ms) => {
  const antes = await pg.evaluate(() => Date.now());
  for (let k = 0; k < 5 && (await pg.evaluate(() => Date.now())) < antes + ms; k++) {
    await pg.clock.setSystemTime(antes + ms + 50); await pg.clock.runFor(600);
  }
  if ((await pg.evaluate(() => Date.now())) < antes + ms) throw new Error('relógio do teste não avançou');
};
const foto = async (pg, nome) => { if (process.env.SHOTS) await pg.screenshot({ path: path.join(process.env.SHOTS, nome + '.png') }); }; // SHOTS=pasta npm test // um pouco mais que o salvamento automático (2,5 s)

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1024, height: 900 }, serviceWorkers: 'block' });
  const p = await ctx.newPage();
  await p.clock.install();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  const falhar = async (msg, extra) => { console.error('FALHA: ' + msg, extra === undefined ? '' : extra); await b.close(); process.exit(1); };
  let ok = 0; const passou = () => ok++;

  const rotas = async (ctx, { semGoogle } = {}) => {
  await ctx.route('https://app.test/**', route => {
    const u = new URL(route.request().url());
    const arq = u.pathname === '/' ? 'index.html' : u.pathname.slice(1);
    if (arq === 'index.html') return route.fulfill({ contentType: 'text/html; charset=utf-8', body: html });
    const f = path.join(docs, arq);
    return fs.existsSync(f) ? route.fulfill({ path: f }) : route.fulfill({ status: 404, body: '' });
  });
  await ctx.route('https://accounts.google.com/**', route => semGoogle ? route.abort('failed') : route.fulfill({ contentType: 'text/javascript', body: GIS_FALSO }));
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, route => route.fulfill({ contentType: 'text/css', body: '' }));
  await ctx.route('https://api.test/**', route => {
    if (srv.estado.apiForaDoAr) return route.abort('internetdisconnected');
    const req = JSON.parse(route.request().postData() || '{}');
    return route.fulfill({ contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(srv.responder(req)) });
  });
  };
  await rotas(ctx);

  // 1) login com Google
  await p.goto('https://app.test/'); await p.waitForTimeout(800);
  if (!(await p.locator('#login.on #gtest').isVisible())) await falhar('tela de login não apareceu');
  await p.click('#gtest'); await p.waitForTimeout(500);
  if (await p.locator('#login.on').count() || !(await p.locator('.card').count())) await falhar('login não liberou a lista');
  passou();

  // 2) código de pareamento: o "app instalado" (sem login do Google) entra com o código gerado aqui
  await p.click('[data-a="parear"]'); await p.waitForTimeout(300);
  const codigo = (await p.locator('.codigo').innerText()).replace(/\D/g, '');
  if (codigo.length !== 6) await falhar('código de pareamento não apareceu', codigo);
  await p.click('.md [data-a="fecharModal"]');
  const ctx2 = await b.newContext({ viewport: { width: 1024, height: 900 }, serviceWorkers: 'block' });
  await ctx2.addInitScript(() => Object.defineProperty(navigator, 'standalone', { get: () => true }));
  await rotas(ctx2, { semGoogle: true });
  const p2 = await ctx2.newPage(); p2.on('pageerror', e => errs.push('[app instalado] ' + e.message));
  await p2.goto('https://app.test/'); await p2.waitForTimeout(600);
  if (!(await p2.locator('#lcodigo').isVisible())) await falhar('campo do código não apareceu no app instalado');
  await p2.fill('#lcodigo', '000000'); await p2.click('[data-a="entrarCodigo"]'); await p2.waitForTimeout(300);
  if (!/inválido/.test(await p2.locator('#lmsg').innerText())) await falhar('código errado não foi recusado');
  await p2.fill('#lcodigo', codigo); await p2.press('#lcodigo', 'Enter'); await p2.waitForTimeout(500);
  if (await p2.locator('#login.on').count() || !(await p2.locator('.card').count())) await falhar('entrar com código não liberou a lista');
  await ctx2.close();
  passou();

  await p.click('.card'); await p.waitForTimeout(300);
  await p.click('[data-a="vincular"]'); await p.waitForTimeout(200); await p.click('[data-a="pickEvento"][data-i="0"]');
  await p.click('[data-a="toggle"][data-t="1"]');
  const antes = await p.locator('.bl[data-t="1"]').count();

  // 3) inserir blocos: botão "+", "/v" + Enter e texto livre + Enter
  await p.click('[data-a="inserir"][data-t="1"]'); await p.click('[data-a="addBloco"][data-t="1"][data-v="lista"]');
  await p.fill('[data-f="ins"][data-t="1"]', '/v'); await p.press('[data-f="ins"][data-t="1"]', 'Enter');
  await p.fill('[data-f="ins"][data-t="1"]', 'Frase de teste'); await p.press('[data-f="ins"][data-t="1"]', 'Enter');
  const tipos = await p.locator('.bl[data-t="1"]').evaluateAll(els => els.slice(-3).map(e => e.className));
  if (await p.locator('.bl[data-t="1"]').count() !== antes + 3 || !/t-lista/.test(tipos[0]) || !/t-biblico/.test(tipos[1]) || !/t-texto/.test(tipos[2])) await falhar('inserir blocos', tipos);
  passou();

  // citação de Ellen White: /e, colar do EGW Writings com {código}, marca "conferida"
  const conferir = async () => { const m = (await p.locator('#tlcap').innerText()).match(/(\d+) citaç(?:ão|ões) a conferir/); return m ? +m[1] : 0; };
  const antesConf = await conferir();
  await p.fill('[data-f="ins"][data-t="1"]', '/e'); await p.press('[data-f="ins"][data-t="1"]', 'Enter');
  const cit = () => p.locator('.bl.t-citacao[data-t="1"]').last();
  if (await cit().locator('[data-f="fonte"]').inputValue() !== 'Ellen G. White, ') await falhar('inserir citação de Ellen White');
  await cit().locator('[data-f="texto"]').evaluate((el, txt) => {
    const dt = new DataTransfer(); dt.setData('text/plain', txt);
    el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  }, '“Com a vigilante espera, combinam ativo serviço.” {DTN 558.2}');
  await p.waitForTimeout(200);
  const fonteCol = await cit().locator('[data-f="fonte"]').inputValue(), textoCol = await cit().locator('[data-f="texto"]').inputValue();
  if (fonteCol !== 'Ellen G. White, O Desejado de Todas as Nações, p. 558 (DTN 558.2)' || textoCol !== 'Com a vigilante espera, combinam ativo serviço.') await falhar('colar do EGW Writings', fonteCol + ' | ' + textoCol);
  if (await conferir() !== antesConf + 1) await falhar('contador de citações a conferir', await conferir());
  await cit().scrollIntoViewIfNeeded(); await foto(p, 'citacao');
  await cit().locator('[data-f="conferida"]').check(); await p.waitForTimeout(100);
  if (await conferir() !== antesConf) await falhar('marcar citação como conferida');
  await cit().locator('[data-f="texto"]').fill('Texto mudado depois de conferir'); await p.waitForTimeout(100);
  if (await cit().locator('[data-f="conferida"]').isChecked() || await conferir() !== antesConf + 1) await falhar('editar a citação não derrubou a marca');
  await cit().locator('[data-f="fonte"]').fill('Ellen G. White, O Desejado de Todas as Nações'); await p.waitForTimeout(100);
  if (!/Falta a página/.test(await cit().innerText())) await falhar('aviso de fonte sem página');
  await cit().locator('[data-a="blDel"]').click();
  passou();

  // 4) buscar versículo; versão fora do catálogo mostra erro
  const vers = () => p.locator('.bl.t-biblico[data-t="1"]').last();
  await vers().locator('[data-f="ref"]').fill('João 3:16');
  await vers().locator('[data-a="buscarVers"]').click(); await p.waitForTimeout(250);
  if (await vers().locator('[data-f="texto"]').inputValue() !== 'Texto de teste de João 3:16' || !(await vers().locator('.copy').count())) await falhar('buscar versículo');
  await vers().locator('[data-f="versao"]').fill('ARA');
  p.once('dialog', d => d.accept());
  await vers().locator('[data-a="buscarVers"]').click(); await p.waitForTimeout(250);
  if (!(await p.locator('#toast.err').count())) await falhar('erro de versão não apareceu');
  passou();

  // 5) seleção e desfazer
  const primeiro = p.locator('.bl[data-t="1"][data-b="0"]');
  await p.evaluate(() => document.activeElement && document.activeElement.blur());
  await p.locator('.tlcap').click();
  if (await primeiro.locator('[data-a="blDel"]').isVisible()) await falhar('botões do bloco visíveis sem seleção');
  await primeiro.locator('.bh span').click();
  if (!(await primeiro.locator('[data-a="blDel"]').isVisible())) await falhar('botões do bloco não apareceram ao selecionar');
  const n1 = await p.locator('.bl[data-t="1"]').count();
  await primeiro.locator('[data-a="blDel"]').click();
  if (await p.locator('.bl[data-t="1"]').count() !== n1 - 1) await falhar('remover bloco');
  await p.click('#toast .undo');
  if (await p.locator('.bl[data-t="1"]').count() !== n1) await falhar('desfazer remoção');
  passou();

  // 6) tempo por parte + salvamento automático
  await p.fill('[data-f="ttempo"][data-t="1"]', '7');
  if (!/previsto/.test(await p.locator('#tlcap').innerText())) await falhar('legenda da linha do tempo');
  await p.waitForTimeout(ESPERA);
  const id = Object.keys(srv.DB)[0];
  if (srv.DB[id].topicos[1].tempo !== 7 || !srv.DB[id].topicos[1].blocos.some(x => x.texto === 'Frase de teste')) await falhar('salvamento automático');
  if (!/^Salvo às/.test(await p.locator('#status').innerText())) await falhar('status depois de salvar', await p.locator('#status').innerText());
  passou();

  // 7) conflito: outro aparelho salvou antes; o usuário mantém a versão daqui
  srv.DB[id].atualizado = '2000-01-01T00:00:00.000Z';
  let perguntou = '';
  p.once('dialog', d => { perguntou = d.message(); d.accept(); });
  await p.fill('[data-f="tema"]', 'Tema alterado no teste');
  await p.waitForTimeout(ESPERA);
  if (!/outro aparelho/.test(perguntou) || srv.DB[id].tema !== 'Tema alterado no teste') await falhar('conflito entre aparelhos', perguntou);
  // a versão substituída fica em Versões e pode ser restaurada
  await p.click('[data-a="versoes"]'); await p.waitForTimeout(300);
  if (!/outro aparelho/.test(await p.locator('.md').innerText())) await falhar('versão substituída não aparece em Versões');
  await foto(p, 'versoes');
  p.once('dialog', d => d.accept());
  await p.click('[data-a="restaurarVersao"][data-i="0"]'); await p.waitForTimeout(600);
  if (await p.locator('[data-f="tema"]').inputValue() !== 'Servindo em Sua Casa até que Ele Venha' || srv.DB[id].tema !== 'Servindo em Sua Casa até que Ele Venha') await falhar('restaurar versão', srv.DB[id].tema);
  if (!srv.HIST.some(h => h.motivo === 'antes de restaurar' && h.tema === 'Tema alterado no teste')) await falhar('versão atual não foi guardada antes de restaurar');
  passou();

  // 8) sessão vencida no servidor: pede login de novo e continua
  srv.estado.sessoes.clear();
  await p.click('[data-a="voltar"]'); await p.waitForTimeout(400);
  if (!(await p.locator('#login.on #gtest').isVisible())) await falhar('sessão vencida não pediu login');
  await p.click('#gtest'); await p.waitForTimeout(500);
  if (!(await p.locator('#res .card').count())) await falhar('lista não voltou depois do novo login');
  passou();

  // 9) busca na lista
  await p.fill('[data-f="filtro"]', 'lucas 19');
  if (await p.locator('#res .card').count() !== 1) await falhar('busca por versículo na lista');
  await p.fill('[data-f="filtro"]', 'xyz-nada');
  if (await p.locator('#res .card').count() !== 0) await falhar('busca sem resultado');
  await p.fill('[data-f="filtro"]', '');
  passou();

  // 10) importar e exportar .sermao.json
  const arquivo = { formato: 'sermoes/1', sermao: { tema: 'Sermão importado no teste', pasta: 'Testes', tempo: 45, topicos: [
    { titulo: 'Abertura', tempo: 5, blocos: [{ tipo: 'texto', texto: 'Olá' }, { tipo: 'biblico', ref: 'Salmo 23', versao: 'NBV', texto: '' }, { tipo: 'xyz' }] },
    { titulo: 'Fim', blocos: [{ tipo: 'lista', itens: ['a', 'b'] }, { tipo: 'desconhecido', texto: 'vira parágrafo' }] } ] } };
  await p.setInputFiles('[data-f="importar"]', { name: 'teste.sermao.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(arquivo)) });
  await p.waitForTimeout(400);
  const avisoImp = await p.locator('#toast').innerText();
  if (await p.locator('[data-f="tema"]').inputValue() !== 'Sermão importado no teste' || !/Buscar/.test(avisoImp) || !/ignorado/.test(avisoImp) || !/40 min/.test(avisoImp)) await falhar('importar arquivo', avisoImp);
  await p.waitForTimeout(ESPERA);
  const imp = Object.values(srv.DB).find(m => m.tema === 'Sermão importado no teste');
  if (!imp || imp.tempo !== 40 || imp.topicos[0].tempo !== 5 || imp.topicos[0].blocos.length !== 2 || imp.topicos[1].blocos[1].tipo !== 'texto') await falhar('sermão importado no servidor', imp);
  const [baixado] = await Promise.all([p.waitForEvent('download'), p.click('[data-a="exportar"]')]);
  const exp = JSON.parse(fs.readFileSync(await baixado.path(), 'utf8'));
  if (exp.formato !== 'sermoes/1' || exp.sermao.tema !== 'Sermão importado no teste' || exp.sermao.topicos.length !== 2 || baixado.suggestedFilename() !== 'sermao-importado-no-teste.sermao.json') await falhar('exportar arquivo', baixado.suggestedFilename());
  await p.click('[data-a="voltar"]'); await p.waitForTimeout(400);
  await p.setInputFiles('[data-f="importar"]', { name: 'ruim.json', mimeType: 'application/json', buffer: Buffer.from('{"nada": 1}') });
  await p.waitForTimeout(300);
  if (!(await p.locator('#toast.err').count()) || !/partes/.test(await p.locator('#toast').innerText())) await falhar('arquivo inválido não foi recusado');
  passou();

  // lixeira: excluir com desfazer, excluir de novo e restaurar pela Lixeira
  const cardImp = () => p.locator('.card', { hasText: 'Sermão importado no teste' });
  await cardImp().locator('[data-a="excluir"]').click(); await p.waitForTimeout(500);
  if (await cardImp().count()) await falhar('excluir sermão');
  await p.click('#toast .undo'); await p.waitForTimeout(500);
  if (!(await cardImp().count())) await falhar('desfazer exclusão');
  await cardImp().locator('[data-a="excluir"]').click(); await p.waitForTimeout(500);
  await p.click('[data-a="lixeira"]'); await p.waitForTimeout(300);
  if (!/Sermão importado no teste/.test(await p.locator('.md').innerText()) || (await p.locator('.md .vr').count()) !== 1) await falhar('sermão não aparece (uma vez só) na Lixeira');
  await foto(p, 'lixeira');
  await p.click('[data-a="restaurarExcluido"][data-i="0"]'); await p.waitForTimeout(600);
  if (!(await cardImp().count())) await falhar('restaurar da Lixeira');
  await p.click('[data-a="backup"]'); await p.waitForTimeout(300);
  if (!/Backup feito/.test(await p.locator('#toast').innerText())) await falhar('backup no Drive');
  passou();

  // 11) sem internet: editar e criar sermão ficam no aparelho; ao voltar a conexão, tudo é enviado
  srv.estado.apiForaDoAr = true;
  await p.reload(); await p.waitForTimeout(800);
  if (!(await p.locator('.aviso').count()) || !(await p.locator('#res .card').count())) await falhar('lista do aparelho sem internet');
  await p.locator('.card', { hasText: 'Servindo em Sua Casa' }).first().click(); await p.waitForTimeout(400);
  await p.fill('[data-f="tema"]', 'Editado sem internet');
  await p.waitForTimeout(ESPERA);
  if (!/Salvo no aparelho/.test(await p.locator('#status').innerText())) await falhar('status sem internet', await p.locator('#status').innerText());
  await p.click('[data-a="voltar"]'); await p.waitForTimeout(400);
  await p.click('[data-a="nova"]'); await p.fill('[data-f="tema"]', 'Criado sem internet'); await p.waitForTimeout(ESPERA);
  await p.click('[data-a="voltar"]'); await p.waitForTimeout(400);
  if (await p.locator('.pendtag').count() < 2) await falhar('marcas de "não enviado" na lista');
  srv.estado.apiForaDoAr = false;
  await p.evaluate(() => window.dispatchEvent(new Event('online'))); await p.waitForTimeout(1200);
  const temas = Object.values(srv.DB).map(m => m.tema);
  if (!temas.includes('Editado sem internet') || !temas.includes('Criado sem internet')) await falhar('sincronização ao voltar a internet', temas);
  if (await p.evaluate(() => JSON.parse(localStorage.getItem('sermoes.pend') || '[]').length)) await falhar('pendências não foram limpas');
  passou();

  // 12) Pregar, com tempo da parte
  await p.locator('.card', { hasText: 'Editado sem internet' }).first().click(); await p.waitForTimeout(400);
  // teleprompter: ligado por sermão; rola sozinho e pausa quando pedido
  await p.click('[data-a="teleprompter"]');
  if (!/ligado/.test(await p.locator('[data-a="teleprompter"]').innerText())) await falhar('ligar teleprompter');
  await p.click('[data-a="pregar"]'); await p.waitForTimeout(700);
  for (let k = 0; k < 7; k++) await p.click('[data-a="fonte"][data-v="1"]');
  await p.clock.runFor(12000);
  const rolou = await p.locator('#pgc').evaluate(c => c.scrollTop);
  if (!(rolou > 0)) await falhar('teleprompter não rolou o texto', rolou);
  await p.click('[data-a="teleRolar"]');
  const parado = await p.locator('#pgc').evaluate(c => c.scrollTop);
  await p.clock.runFor(5000);
  if (await p.locator('#pgc').evaluate(c => c.scrollTop) !== parado) await falhar('pausa da rolagem');
  await foto(p, 'teleprompter');
  await p.click('[data-a="teleRolar"]');
  for (let k = 0; k < 7; k++) await p.click('[data-a="fonte"][data-v="-1"]');
  const titulo = await p.locator('.pgt').innerText();
  await avancar(p, 120000);
  await p.click('[data-a="pgIr"][data-v="1"]'); await p.waitForTimeout(300);
  if (!/de 7 min/.test(await p.locator('#tparte').innerText())) await falhar('tempo previsto da parte 2', await p.locator('#tparte').innerText());
  await avancar(p, 90000);
  await p.screenshot({ path: path.join(__dirname, '.pregar.png') });
  passou();

  // relatório da pregação: ao sair, o tempo real de cada parte fica registrado no sermão
  await p.click('[data-a="sairPregar"]'); await p.waitForTimeout(300);
  const resumo = await p.locator('.md').innerText();
  await foto(p, 'resumo');
  if (!/Pregação registrada/.test(resumo) || (await p.locator('.ptab tbody tr').count()) !== 7) await falhar('resumo da pregação', resumo.slice(0, 200));
  await p.click('.md [data-a="fecharModal"]'); await p.waitForTimeout(ESPERA);
  const sermao = Object.values(srv.DB).find(m => m.tema === 'Editado sem internet');
  const reg = sermao && sermao.pregacoes && sermao.pregacoes[0];
  if (!reg || reg.total < 200 || reg.partes[0].seg < 110 || reg.partes[1].seg < 85) await falhar('registro da pregação no servidor', JSON.stringify(reg && { total: reg.total, p0: reg.partes[0].seg, p1: reg.partes[1].seg }));
  if (!sermao.opcoes || sermao.opcoes.teleprompter !== true) await falhar('preferência do teleprompter não foi salva', sermao.opcoes);
  if (!/pregado 1×/.test(await p.locator('#tlcap').innerText())) await falhar('legenda sem o registro da pregação');
  await foto(p, 'legenda');
  passou();

  // Holyrics: ligado neste aparelho; telão de retorno; projetar versículo e citação; limpar; sair
  await p.click('[data-a="voltar"]'); await p.waitForTimeout(400);
  await p.click('[data-a="holyrics"]'); await p.waitForTimeout(200);
  await p.check('[data-hol="ativo"]'); await p.waitForTimeout(100); await p.check('[data-hol="telao"]');
  await p.click('[data-a="hTestar"]'); await p.waitForTimeout(300);
  if (!/Conectado/.test(await p.locator('#hres').innerText())) await falhar('testar conexão do Holyrics');
  await foto(p, 'holyrics');
  await p.click('.md [data-a="fecharModal"]');
  await p.locator('.card', { hasText: 'Editado sem internet' }).first().click(); await p.waitForTimeout(400);
  srv.estado.holyrics.length = 0;
  await p.click('[data-a="pregar"]'); await p.waitForTimeout(600);
  const acoes = () => srv.estado.holyrics.map(x => x.acao);
  if (!acoes().includes('StartCountdownCP') || !srv.estado.holyrics.some(x => x.acao === 'SetTextCP' && /Parte 1 de 7/.test(x.dados.text))) await falhar('telão de retorno ao entrar', acoes());
  await p.locator('.r-bib [data-a="hProjetar"]').first().click(); await p.waitForTimeout(300);
  const verso = srv.estado.holyrics.find(x => x.acao === 'ShowVerse');
  if (!verso || verso.dados.references !== 'Mateus 24:45-47' || verso.dados.quick_presentation !== true) await falhar('projetar versículo', verso);
  await p.click('[data-a="pgIr"][data-v="1"]'); await p.waitForTimeout(300);
  if (!srv.estado.holyrics.some(x => x.acao === 'SetTextCP' && /Parte 2 de 7/.test(x.dados.text))) await falhar('telão ao trocar de parte');
  await foto(p, 'projetar');
  await p.locator('.r-cit [data-a="hProjetar"]').first().click(); await p.waitForTimeout(300);
  const citP = srv.estado.holyrics.find(x => x.acao === 'ShowQuickPresentation');
  if (!citP || !/Escola Sabatina deve ser/.test(citP.dados.text) || !/— Ellen G. White/.test(citP.dados.text)) await falhar('projetar citação', citP);
  await p.click('[data-a="hLimpar"]'); await p.waitForTimeout(300);
  await p.click('[data-a="sairPregar"]'); await p.waitForTimeout(300);
  if (!acoes().includes('CloseCurrentPresentation') || !acoes().includes('StopCountdownCP')) await falhar('limpar tela e encerrar o telão', acoes());
  passou();

  const banner = await p.locator('#erro-fatal').count();
  await b.close();
  if (errs.length || banner) { console.error('FALHA', errs); process.exit(1); }
  console.log('OK · ' + ok + ' verificações passaram · modo Pregar abriu em:', titulo);
})();
