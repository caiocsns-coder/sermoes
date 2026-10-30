// Testes do servidor: roda o apps-script/Code.gs (gerado pelo build) num Apps Script simulado
// (tools/apps-script-falso.js). Cobre login, sessões, pareamento, salvar com conflito, histórico,
// lixeira, backup, Bíblia (YouVersion), Holyrics e imagens. Rode com: npm run test:servidor
const fs = require('fs'), path = require('path'), assert = require('assert/strict');
const { carregar } = require('./apps-script-falso');

let ok = 0; const falhas = [];
function caso(nome, fn) {
  try { fn(); ok++; } catch (e) { falhas.push(nome + '\n    ' + String(e.message).split('\n').join('\n    ')); }
}
const erro = (fn, re) => assert.throws(fn, e => { assert.match(e.message, re); return true; });

/* ---------------- arquivo gerado ---------------- */
const codeGs = fs.readFileSync(path.join(__dirname, '..', 'apps-script', 'Code.gs'), 'utf8');
caso('Code.gs sem template literals', () => { assert.ok(!/`/.test(codeGs), 'tem crase'); assert.ok(!/\$\{/.test(codeGs), 'tem ${'); });
caso('assinaturas da API mantidas', () => {
  const { gs } = carregar();
  const esperado = { listarMensagens: 0, obterMensagem: 1, salvarMensagem: 1, excluirMensagem: 1, duplicarMensagem: 1, listarEventos: 0, enviarImagem: 2 };
  for (const [n, a] of Object.entries(esperado)) { assert.equal(typeof gs[n], 'function', n + ' sumiu'); assert.equal(gs[n].length, a, n + ' mudou de parâmetros'); }
});

/* ---------------- login, sessões e pareamento ---------------- */
{
  const seg = () => Math.floor(Date.now() / 1000);
  const tokens = {
    bom: { aud: 'cli.apps.googleusercontent.com', iss: 'https://accounts.google.com', exp: seg() + 3000, email: 'caio@x.com', email_verified: 'true' },
    outroApp: { aud: 'x', iss: 'accounts.google.com', exp: seg() + 3000, email: 'caio@x.com', email_verified: 'true' },
    intruso: { aud: 'cli.apps.googleusercontent.com', iss: 'accounts.google.com', exp: seg() + 3000, email: 'mal@x.com', email_verified: 'true' },
  };
  const w = carregar({ agora: Date.now(), props: { GOOGLE_CLIENT_ID: 'cli.apps.googleusercontent.com', DONO_EMAIL: 'caio@x.com' },
    rede: url => { const t = tokens[decodeURIComponent(String(url).split('id_token=')[1] || '')]; return t ? { body: t } : { code: 400, body: { error: 'invalid' } }; } });
  w.gs.listarMensagens = () => ['lista ok']; // a planilha não importa aqui
  const { post } = w;
  const negado = (r, re) => { assert.equal(r.ok, false); assert.equal(r.auth, true); if (re) assert.match(r.erro, re); };

  caso('sem sessão pede login', () => negado(post({ fn: 'listarMensagens' }), /Entre com a sua conta Google/));
  caso('entrar sem token', () => negado(post({ fn: 'entrar' })));
  caso('token de outro app', () => negado(post({ fn: 'entrar', token: 'outroApp' }), /outro aplicativo/));
  caso('outra conta Google', () => negado(post({ fn: 'entrar', token: 'intruso' }), /mal@x\.com não tem acesso/));
  caso('token inválido', () => negado(post({ fn: 'entrar', token: 'lixo' })));
  let s;
  caso('entrar e usar a sessão', () => {
    const e = post({ fn: 'entrar', token: 'bom' }); assert.equal(e.ok, true); s = e.data.sessao;
    assert.equal(e.data.email, 'caio@x.com'); assert.ok(e.data.exp > Date.now() + 29 * 864e5);
    assert.deepEqual(post({ fn: 'listarMensagens', sessao: s }).data, ['lista ok']);
    assert.ok(!Object.keys(w.props).some(k => k.includes(s)), 'a sessão não pode ficar guardada em texto puro');
  });
  caso('só funções da lista são chamáveis', () => {
    assert.match(post({ fn: 'encerrarTodasAsSessoes', sessao: s }).erro, /Função desconhecida/);
    assert.match(post({ fn: 'verificarSessao_', sessao: s }).erro, /Função desconhecida/);
  });
  caso('sair encerra a sessão', () => { assert.equal(post({ fn: 'sair', sessao: s }).ok, true); negado(post({ fn: 'listarMensagens', sessao: s }), /terminou/); });
  caso('sessão vencida', () => {
    const s2 = post({ fn: 'entrar', token: 'bom' }).data.sessao;
    const k = Object.keys(w.props).find(x => x.startsWith('sessao_')); const d = JSON.parse(w.props[k]); d.exp = 0; w.props[k] = JSON.stringify(d);
    negado(post({ fn: 'listarMensagens', sessao: s2 }), /terminou/);
  });
  caso('link /exec mostra o aviso', () => assert.match(w.gs.doGet(), /só o servidor/));

  const s3 = () => post({ fn: 'entrar', token: 'bom' }).data.sessao;
  caso('gerar código exige sessão', () => negado(post({ fn: 'gerarCodigo' })));
  caso('entrar com código de pareamento (uso único)', () => {
    const g = post({ fn: 'gerarCodigo', sessao: s3() }); assert.match(g.data.codigo, /^\d{6}$/); assert.equal(g.data.validade, 600);
    negado(post({ fn: 'entrarComCodigo', codigo: g.data.codigo === '000001' ? '000002' : '000001' }), /inválido ou vencido/);
    const e = post({ fn: 'entrarComCodigo', codigo: g.data.codigo }); assert.equal(e.ok, true);
    assert.deepEqual(post({ fn: 'listarMensagens', sessao: e.data.sessao }).data, ['lista ok']);
    negado(post({ fn: 'entrarComCodigo', codigo: g.data.codigo }), /inválido ou vencido/);
  });
  caso('código bloqueado depois de 10 erros', () => {
    for (let i = 0; i < 10; i++) post({ fn: 'entrarComCodigo', codigo: '12345' + i });
    const g = post({ fn: 'gerarCodigo', sessao: s3() });
    negado(post({ fn: 'entrarComCodigo', codigo: g.data.codigo }), /Muitas tentativas/);
  });
}

/* ---------------- sermões, conflito, histórico, lixeira e backup ---------------- */
{
  const w = carregar(), gs = w.gs;
  let id;
  caso('salvar e abrir (com pregações e opções)', () => {
    id = gs.salvarMensagem({ tema: 'A', pasta: '', tempo: 40, opcoes: { teleprompter: true }, topicos: [{ titulo: 'P1', tempo: 7, blocos: [], _open: true }], pregacoes: [{ data: 'x', total: 100 }] }).id;
    const m = gs.obterMensagem(id);
    assert.equal(m.pregacoes.length, 1); assert.equal(m.opcoes.teleprompter, true); assert.equal(m.topicos[0].tempo, 7);
    assert.ok(!('_open' in m.topicos[0]), '_open não vai para a planilha');
    assert.match(m.atualizado, /^\d{4}-\d\d-\d\dT/);
  });
  caso('salvar em seguida não cria versão', () => { w.avancar(1); gs.salvarMensagem(Object.assign(gs.obterMensagem(id), { tema: 'A2' })); assert.equal(gs.listarVersoes(id).length, 0); });
  caso('nova sessão de edição guarda a versão anterior', () => {
    w.avancar(40); gs.salvarMensagem(Object.assign(gs.obterMensagem(id), { tema: 'A3' }));
    const v = gs.listarVersoes(id); assert.equal(v.length, 1); assert.equal(v[0].tema, 'A2'); assert.equal(v[0].motivo, 'edição');
  });
  caso('conflito entre aparelhos', () => {
    w.avancar(1); const m = gs.obterMensagem(id);
    erro(() => gs.salvarMensagem(Object.assign({}, m, { tema: 'X', atualizado: '2026-01-01T00:00:00.000Z' })), /^CONFLITO: .*às \d\d:\d\d/);
    gs.salvarMensagem(Object.assign({}, m, { tema: 'A4', atualizado: 'velho', _sobrescrever: true }));
    const v = gs.listarVersoes(id); assert.equal(v[0].motivo, 'substituída por outro aparelho'); assert.equal(v[0].tema, 'A3');
  });
  caso('restaurar versão guarda o estado atual', () => {
    w.avancar(1); const v = gs.listarVersoes(id); gs.restaurarVersao(id, v[v.length - 1].guardado);
    assert.equal(gs.obterMensagem(id).tema, 'A2'); assert.equal(gs.listarVersoes(id)[0].motivo, 'antes de restaurar');
  });
  caso('lixeira: excluir e restaurar', () => {
    gs.excluirMensagem(id); assert.equal(gs.listarMensagens().length, 0); assert.equal(gs.listarExcluidos().length, 1);
    gs.restaurarExcluido(id); assert.equal(gs.obterMensagem(id).tema, 'A2'); assert.equal(gs.listarExcluidos().length, 0);
  });
  caso('limite de 15 versões por sermão', () => {
    for (let i = 0; i < 20; i++) { w.avancar(31); gs.salvarMensagem(Object.assign(gs.obterMensagem(id), { tema: 'V' + i })); }
    assert.equal(gs.listarVersoes(id).length, 15);
  });
  caso('cópia começa sem pregações', () => { const d = gs.duplicarMensagem(id); assert.equal(gs.obterMensagem(d.id).pregacoes.length, 0); gs.excluirMensagem(d.id); });
  caso('lixeira apaga depois de 60 dias', () => {
    const antes = gs.listarExcluidos().map(x => x.id); assert.equal(antes.length, 1);
    w.avancar(61 * 24 * 60); const b = gs.salvarMensagem({ tema: 'B', topicos: [] }).id; w.avancar(31); gs.excluirMensagem(b);
    assert.ok(!gs.listarExcluidos().some(x => x.id === antes[0]));
  });
  caso('listar resume os sermões', () => {
    const l = gs.listarMensagens(); assert.equal(l.length, 1); assert.equal(l[0].id, id); assert.equal(l[0].nTopicos, 1);
  });
  caso('célula corrompida dá erro claro', () => {
    const aba = w.planilha.getSheetByName('Mensagens'); aba.L.push(['zz', 'Z', '', '30', '{quebrado', '2026-10-21T19:00:00.000Z']);
    erro(() => gs.obterMensagem('zz'), /corrompidos na planilha \(linha \d+, coluna "dados"\)/);
    aba.L.pop();
  });
  caso('backup semanal guarda as 8 pastas mais recentes', () => {
    for (let i = 0; i < 10; i++) { w.avancar(60 * 24 * 7); gs.backupSemanal(); }
    const raiz = w.drive.raiz.find(p => p.nome === 'Sermões · backups');
    assert.equal(raiz.filhas.filter(p => !p.lixo).length, 8);
    const ultimo = w.drive.arquivos[w.drive.arquivos.length - 1], arq = JSON.parse(ultimo.txt);
    assert.match(ultimo.nome, /^v19-[0-9a-f-]{6}\.sermao\.json$/); assert.equal(arq.formato, 'sermoes/1'); assert.ok(Array.isArray(arq.sermao.topicos));
  });
  caso('instalar backup cria um gatilho só', () => { gs.instalarBackupSemanal(); gs.instalarBackupSemanal(); assert.equal(w.gatilhos.length, 1); });
  caso('enviar imagem para o Drive', () => {
    const url = gs.enviarImagem('data:image/jpeg;base64,' + Buffer.from('oi').toString('base64'), 'a.jpg');
    assert.match(url, /^https:\/\/drive\.google\.com\/thumbnail\?id=.+&sz=w1600$/);
    erro(() => gs.enviarImagem('lixo'), /Imagem inválida/);
  });
}

/* ---------------- Bíblia (YouVersion) ---------------- */
{
  // API falsa: GEN 1 tem 31 versículos, GEN 2 tem 25, GEN 3 tem 24; JHN 3 tem 36.
  const caps = { 'GEN.1': 31, 'GEN.2': 25, 'GEN.3': 24, 'JHN.3': 36 };
  const yv = estrita => (url, params) => {
    assert.equal((params.headers || {})['X-YVP-App-Key'], 'K', 'App Key no cabeçalho');
    const m = String(url).match(/passages\/([^?]+)/); if (!m) return { body: { copyright: '© teste' } };
    const u = m[1].split('.'), ch = u[0] + '.' + u[1], n = caps[ch]; if (!n) return { code: 404, body: {} };
    let a = 1, b = n; if (u[2]) { const [x, y] = u[2].split('-').map(Number); a = x; b = y || x; }
    if (a > n) return { code: 404, body: {} }; if (b > n) { if (estrita) return { code: 404, body: {} }; b = n; }
    const vs = []; for (let i = a; i <= b; i++) vs.push(ch + ':' + i);
    return { body: { content: vs.join(' '), reference: ch + ':' + a + '-' + b } };
  };
  const { gs } = carregar({ props: { YOUVERSION_KEY: 'K' }, rede: yv(false) });
  caso('referências em português viram USFM', () => {
    const casos = { 'Mateus 24:45-47': ['MAT.24.45-47'], 'Mt 24.45-47': ['MAT.24.45-47'], 'Sl 23': ['PSA.23'], 'Salmo 119:105': ['PSA.119.105'],
      '1 Coríntios 13:4-7': ['1CO.13.4-7'], 'I Co 13': ['1CO.13'], '1Co 13:4': ['1CO.13.4'], 'Jó 1:1': ['JOB.1.1'], 'Jo 3:16,18': ['JHN.3.16', 'JHN.3.18'],
      'João 3,16': ['JHN.3.16'], 'Apocalipse 22:20 (NBV)': ['REV.22.20'], 'Hebreus 10:24–25': ['HEB.10.24-25'], '2 Timóteo 3:16-17': ['2TI.3.16-17'],
      'Cântico dos Cânticos 2:4': ['SNG.2.4'], '3 João 1:2': ['3JN.1.2'], 'Lucas 19:10': ['LUK.19.10'] };
    for (const [ref, usfm] of Object.entries(casos)) assert.deepEqual(JSON.parse(JSON.stringify(gs.referenciaUsfm_(ref))), usfm, ref);
    assert.deepEqual(JSON.parse(JSON.stringify(gs.referenciaUsfm_('Gn 1:26-2:3'))), [{ livro: 'GEN', c1: 1, v1: 26, c2: 2, v2: 3 }]);
    erro(() => gs.referenciaUsfm_('Xyz 1:1'), /Não reconheci o livro "Xyz"/);
  });
  caso('versões', () => {
    assert.equal(gs.versaoYV_('NBV'), 1966); assert.equal(gs.versaoYV_('nbv-p'), 1966); assert.equal(gs.versaoYV_('NVI'), 129);
    assert.equal(gs.versaoYV_('BLT'), 3254); assert.equal(gs.versaoYV_('1966'), 1966);
    erro(() => gs.versaoYV_('ARA'), /ARA não está disponível/);
  });
  caso('buscar versículo', () => {
    const r = gs.buscarVersiculo('Jo 3:16-17', 'nvi');
    assert.equal(r.texto, 'JHN.3:16 JHN.3:17'); assert.equal(r.versao, 'NVI'); assert.equal(r.copyright, '© teste');
  });
  for (const estrita of [false, true]) caso('trecho entre capítulos (API ' + (estrita ? 'estrita' : 'tolerante') + ')', () => {
    const r = carregar({ props: { YOUVERSION_KEY: 'K' }, rede: yv(estrita) }).gs.buscarVersiculo('Gn 1:29-3:2', 'NVI');
    const v = r.texto.split(' '); assert.equal(v.length, 30); assert.equal(v[0], 'GEN.1:29'); assert.equal(v[v.length - 1], 'GEN.3:2');
    assert.equal(r.referencia, 'Gn 1:29-3:2');
  });
  caso('trecho invertido', () => erro(() => gs.buscarVersiculo('Gn 2:3-1:2', 'NVI'), /precisa ser depois/));
  caso('sem YOUVERSION_KEY', () => erro(() => carregar().gs.buscarVersiculo('Jo 3:16', 'NVI'), /YOUVERSION_KEY/));
}

/* ---------------- Holyrics ---------------- */
{
  let resposta = null;
  const w = carregar({ props: { HOLYRICS_API_KEY: 'K', HOLYRICS_TOKEN: 'T' }, rede: () => ({ body: resposta }) });
  const gs = w.gs, ultima = () => w.chamadas[w.chamadas.length - 1];
  caso('projetar versículo', () => {
    resposta = { status: 'ok' };
    gs.projetarHolyrics('ShowVerse', { references: 'Mt 24:45-47', version: 'NVI', quick_presentation: true });
    assert.equal(ultima().url, 'https://api.holyrics.com.br/send/ShowVerse');
    assert.equal(ultima().params.headers.api_key, 'K'); assert.equal(ultima().params.headers.token, 'T');
    assert.equal(JSON.parse(ultima().params.payload).references, 'Mt 24:45-47');
  });
  caso('ação fora da lista', () => erro(() => gs.projetarHolyrics('DeleteEverything', {}), /./));
  caso('Holyrics desligado', () => { resposta = { status: 'error', error: { code: 9, key: 'device_disconnected' } }; erro(() => gs.projetarHolyrics('ShowVerse', {}), /./); });
  caso('API_KEY errada', () => { resposta = { status: 'error', error: { code: 403, key: 'invalid_api_key' } }; erro(() => gs.testarHolyrics(), /./); });
  caso('token sem permissão', () => {
    resposta = { status: 'ok', response_status: 'ok', response: { status: 'error', error: { unauthorized_actions: 'SetTextCP,StartCountdownCP' } } };
    erro(() => gs.testarHolyrics(), /não tem permissão para: SetTextCP,StartCountdownCP/);
  });
  caso('Holyrics sem resposta', () => { resposta = { status: 'ok', response_status: 'timeout' }; erro(() => gs.testarHolyrics(), /não respondeu a tempo/); });
  caso('teste de conexão ok', () => {
    resposta = { status: 'ok', response_status: 'ok', response: { status: 'ok' } };
    const r = gs.testarHolyrics(); assert.equal(r.ok, true); assert.equal(r.acoes.length, 6);
    assert.equal(ultima().url, 'https://api.holyrics.com.br/request/CheckPermissions');
  });
  caso('Holyrics sem configuração', () => { delete w.props.HOLYRICS_TOKEN; erro(() => gs.projetarHolyrics('ShowVerse', {}), /HOLYRICS_API_KEY e HOLYRICS_TOKEN/); });
}

if (falhas.length) {
  console.error('FALHOU · ' + falhas.length + ' de ' + (ok + falhas.length) + ' testes do servidor:\n  ✗ ' + falhas.join('\n  ✗ '));
  process.exit(1);
}
console.log('OK · ' + ok + ' testes do servidor passaram');
