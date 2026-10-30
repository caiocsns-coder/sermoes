/**
 * Sermões · servidor (Google Apps Script), usado como API pela página no GitHub Pages.
 *
 * Os dados ficam numa planilha: aba "Mensagens", uma linha por sermão.
 * - Script criado a partir de uma planilha (Extensões > Apps Script): usa essa planilha.
 * - Script avulso (script.google.com): cria a planilha "Sermões · banco de dados" no primeiro uso.
 *
 * Implantação: App da Web, "Executar como: eu", "Quem pode acessar: Qualquer pessoa".
 * Quem protege os dados é o login com Google (verificarLogin_), não a implantação.
 * Propriedades do script usadas: GOOGLE_CLIENT_ID, DONO_EMAIL (opcional), APP_URL (opcional),
 * YOUVERSION_KEY, PLANILHA_ID (criada sozinha).
 */

const ABA = 'Mensagens';
const COLUNAS = ['id', 'tema', 'pasta', 'tempo', 'dados', 'atualizado'];
const PASTA_IMAGENS = 'Sermões · imagens';

/* ---------------- porta de entrada (API) ---------------- */

/* O link /exec aberto no navegador só aponta para o app novo */
function doGet() {
  const url = PropertiesService.getScriptProperties().getProperty('APP_URL') || '';
  const link = url ? '<p><a href="' + url + '" target="_top">Abrir o app Sermões</a></p>' : '';
  return HtmlService.createHtmlOutput(
    '<div style="font:16px/1.5 system-ui,sans-serif;padding:24px;background:#131218;color:#efecf5;min-height:100vh">' +
    '<h1 style="margin-top:0">Sermões</h1><p>Este endereço agora é só o servidor do app. A interface fica no GitHub Pages.</p>' + link + '</div>'
  ).setTitle('Sermões · servidor');
}

/**
 * Corpo (texto JSON):
 *   { fn: 'entrar', token: '<ID token do Google>' }  → { sessao, exp, email }  (sessão de 30 dias)
 *   { fn: 'gerarCodigo', sessao }                     → { codigo, validade }  (código de 6 dígitos, 10 min)
 *   { fn: 'entrarComCodigo', codigo }                 → { sessao, exp, email } (para o app instalado no iPad)
 *   { fn: 'sair', sessao }                            → true
 *   { fn: '<função da API>', args: [...], sessao }    → o retorno da função
 * Resposta: { ok: true, data } ou { ok: false, erro: 'mensagem', auth?: true }
 * A página envia com Content-Type text/plain para não disparar a checagem prévia de CORS.
 */
function doPost(e) {
  const API = {
    listarMensagens, obterMensagem, salvarMensagem, excluirMensagem, duplicarMensagem,
    listarEventos, enviarImagem, buscarVersiculo,
    listarVersoes, restaurarVersao, listarExcluidos, restaurarExcluido, fazerBackup,
  };
  let saida;
  try {
    const req = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    let data;
    if (req.fn === 'entrar') data = abrirSessao_(verificarLogin_(req.token));
    else if (req.fn === 'entrarComCodigo') data = entrarComCodigo_(req.codigo);
    else if (req.fn === 'gerarCodigo') data = gerarCodigo_(verificarSessao_(req.sessao));
    else if (req.fn === 'sair') data = fecharSessao_(req.sessao);
    else {
      verificarSessao_(req.sessao);
      const fn = API[req.fn];
      if (!fn) throw new Error('Função desconhecida: ' + req.fn);
      data = fn.apply(null, Array.isArray(req.args) ? req.args : []);
    }
    saida = { ok: true, data };
  } catch (err) {
    saida = { ok: false, erro: String((err && err.message) || err) };
    if (err && err.auth) saida.auth = true;
  }
  return ContentService.createTextOutput(JSON.stringify(saida)).setMimeType(ContentService.MimeType.JSON);
}

function erroLogin_(msg) { const e = new Error(msg); e.auth = true; return e; }

/* ---------- sessões (uma por aparelho, 30 dias) ---------- */
const DIAS_SESSAO = 30;
function hashSessao_(s) {
  return 'sessao_' + Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(s))).slice(0, 43);
}
function abrirSessao_(email) {
  const props = PropertiesService.getScriptProperties();
  const sessao = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '');
  const exp = Date.now() + DIAS_SESSAO * 864e5;
  props.setProperty(hashSessao_(sessao), JSON.stringify({ email, exp }));
  limparSessoes_();
  return { sessao, exp, email };
}
function verificarSessao_(sessao) {
  if (!sessao) throw erroLogin_('Entre com a sua conta Google.');
  const props = PropertiesService.getScriptProperties(), chave = hashSessao_(sessao);
  const v = props.getProperty(chave);
  if (!v) throw erroLogin_('Sua sessão terminou. Entre de novo com o Google.');
  const d = JSON.parse(v);
  if (d.exp < Date.now()) { props.deleteProperty(chave); throw erroLogin_('Sua sessão terminou. Entre de novo com o Google.'); }
  return d.email;
}
function fecharSessao_(sessao) {
  if (sessao) PropertiesService.getScriptProperties().deleteProperty(hashSessao_(sessao));
  return true;
}
/* ---------- código de pareamento ----------
 * O login do Google não funciona no app instalado na Tela de Início do iPad (o iOS isola o armazenamento
 * e a janela do Google não volta). Num aparelho já conectado, gerarCodigo cria um código de 6 dígitos,
 * de uso único e válido por 10 minutos; no app instalado, entrarComCodigo troca o código por uma sessão.
 * Proteção contra tentativa e erro: no máximo 10 códigos errados a cada 10 minutos (para todos os aparelhos).
 */
const VALIDADE_CODIGO = 600; // segundos
function gerarCodigo_(email) {
  const cache = CacheService.getScriptCache();
  let codigo;
  do {
    codigo = String(100000 + parseInt(Utilities.getUuid().replace(/-/g, '').slice(0, 8), 16) % 900000);
  } while (cache.get('codigo_' + codigo));
  cache.put('codigo_' + codigo, email, VALIDADE_CODIGO);
  return { codigo, validade: VALIDADE_CODIGO };
}
function entrarComCodigo_(codigo) {
  const cache = CacheService.getScriptCache(), chaveT = 'codigo_tentativas';
  const erradas = Number(cache.get(chaveT) || 0);
  if (erradas >= 10) throw erroLogin_('Muitas tentativas erradas. Espere 10 minutos e gere um código novo.');
  const c = String(codigo || '').replace(/\D/g, '');
  const email = c.length === 6 ? cache.get('codigo_' + c) : null;
  if (!email) {
    cache.put(chaveT, String(erradas + 1), VALIDADE_CODIGO);
    throw erroLogin_('Código inválido ou vencido. Gere um novo no aparelho já conectado.');
  }
  cache.remove('codigo_' + c);
  return abrirSessao_(email);
}

/* apaga sessões vencidas (rodado a cada login) */
function limparSessoes_() {
  const props = PropertiesService.getScriptProperties(), todas = props.getProperties(), agora = Date.now();
  Object.keys(todas).forEach(k => {
    if (k.indexOf('sessao_') !== 0) return;
    try { if (JSON.parse(todas[k]).exp < agora) props.deleteProperty(k); } catch (e) { props.deleteProperty(k); }
  });
}
/* para encerrar todas as sessões (por exemplo, se perder o iPad): rode pelo editor */
function encerrarTodasAsSessoes() {
  const props = PropertiesService.getScriptProperties();
  Object.keys(props.getProperties()).forEach(k => { if (k.indexOf('sessao_') === 0) props.deleteProperty(k); });
}

/*
 * Confere o ID token do "Fazer login com o Google":
 * emitido pelo Google, para o nosso Client ID, ainda válido, e da conta dona do app.
 * O resultado fica no cache até o token vencer (no máximo 50 min), para não consultar o Google a cada chamada.
 */
function verificarLogin_(token) {
  if (!token) throw erroLogin_('Entre com a sua conta Google.');
  const props = PropertiesService.getScriptProperties();
  const clientId = props.getProperty('GOOGLE_CLIENT_ID');
  if (!clientId) throw new Error('Falta GOOGLE_CLIENT_ID nas Propriedades do script.');
  const dono = String(props.getProperty('DONO_EMAIL') || Session.getEffectiveUser().getEmail() || '').toLowerCase();

  const cache = CacheService.getScriptCache();
  const chave = 'login_' + Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, token));
  const salvo = cache.get(chave);
  if (salvo) return salvo;

  const resp = UrlFetchApp.fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(token), { muteHttpExceptions: true });
  if (resp.getResponseCode() !== 200) throw erroLogin_('Sua sessão expirou. Entre de novo com o Google.');
  const info = JSON.parse(resp.getContentText());
  const agora = Math.floor(Date.now() / 1000);
  if (info.aud !== clientId) throw erroLogin_('Login de outro aplicativo. Entre de novo pelo app Sermões.');
  if (['accounts.google.com', 'https://accounts.google.com'].indexOf(info.iss) < 0) throw erroLogin_('Login inválido.');
  if (Number(info.exp) <= agora) throw erroLogin_('Sua sessão expirou. Entre de novo com o Google.');
  if (String(info.email_verified) !== 'true' || String(info.email || '').toLowerCase() !== dono) {
    throw erroLogin_('A conta ' + (info.email || '?') + ' não tem acesso a este app.');
  }
  cache.put(chave, info.email, Math.max(60, Math.min(3000, Number(info.exp) - agora - 60)));
  return info.email;
}

/* ---------------- planilha ---------------- */

function aba_() {
  let ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    const props = PropertiesService.getScriptProperties();
    const id = props.getProperty('PLANILHA_ID');
    if (id) {
      ss = SpreadsheetApp.openById(id);
    } else {
      ss = SpreadsheetApp.create('Sermões · banco de dados');
      props.setProperty('PLANILHA_ID', ss.getId());
    }
  }
  let sh = ss.getSheetByName(ABA);
  if (!sh) {
    sh = ss.insertSheet(ABA);
    sh.getRange(1, 1, 1, COLUNAS.length).setValues([COLUNAS]).setFontWeight('bold');
    sh.getRange('A:F').setNumberFormat('@'); // tudo como texto
    sh.setFrozenRows(1);
    sh.setColumnWidth(5, 400);
  }
  return sh;
}

function linhas_() {
  const sh = aba_();
  const n = sh.getLastRow() - 1;
  if (n < 1) return [];
  return sh.getRange(2, 1, n, COLUNAS.length).getValues();
}

function linhaDoId_(id) {
  const sh = aba_();
  const n = sh.getLastRow() - 1;
  if (n < 1) return -1;
  const ids = sh.getRange(2, 1, n, 1).getValues();
  for (let i = 0; i < ids.length; i++) if (String(ids[i][0]) === String(id)) return i + 2;
  return -1;
}

/* ---------------- API chamada pela página ---------------- */

const LIMITE_DADOS = 49000; // caracteres do JSON de eventos + partes numa célula

/* texto extra para a busca da lista: títulos das partes e referências bíblicas */
function textoBusca_(dados) {
  return (dados.topicos || []).map(t => [t.titulo || '']
    .concat((t.blocos || []).filter(b => b && b.tipo === 'biblico').map(b => b.ref || ''))
    .join(' ')).join(' ').replace(/\s+/g, ' ').trim().slice(0, 2000);
}

function listarMensagens() {
  return linhas_()
    .filter(r => r[0])
    .map(r => {
      let nTopicos = 0, busca = '';
      try { const d = JSON.parse(r[4] || '{}'); nTopicos = (d.topicos || []).length; busca = textoBusca_(d); } catch (e) {}
      return { id: String(r[0]), tema: String(r[1]), pasta: String(r[2]), tempo: Number(r[3]) || 30, nTopicos, atualizado: String(r[5]), busca };
    })
    .sort((a, b) => (a.atualizado < b.atualizado ? 1 : -1));
}

function obterMensagem(id) {
  const linha = linhaDoId_(id);
  if (linha < 0) throw new Error('Sermão não encontrado. Ele pode ter sido excluído em outro aparelho.');
  const r = aba_().getRange(linha, 1, 1, COLUNAS.length).getValues()[0];
  let dados;
  try { dados = JSON.parse(r[4] || '{}'); }
  catch (e) { throw new Error('Os dados deste sermão estão corrompidos na planilha (linha ' + linha + ', coluna "dados"). Abra a planilha e confira o texto da célula.'); }
  return {
    id: String(r[0]), tema: String(r[1]), pasta: String(r[2]), tempo: Number(r[3]) || 30,
    eventos: dados.eventos || [], topicos: dados.topicos || [], pregacoes: dados.pregacoes || [], opcoes: dados.opcoes || {}, atualizado: String(r[5]),
  };
}

/**
 * Salva (cria se msg.id vier vazio).
 * Proteção entre aparelhos: msg.atualizado deve ser o valor recebido ao abrir/salvar.
 * Se a planilha tiver outro valor, alguém salvou antes → erro que começa com "CONFLITO:".
 * msg._sobrescrever = true ignora a checagem (o usuário escolheu manter a versão dele).
 */
function salvarMensagem(msg) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const id = msg.id || Utilities.getUuid();
    const sh = aba_();
    const linha = msg.id ? linhaDoId_(id) : -1;
    const anterior = linha > 0 ? sh.getRange(linha, 1, 1, COLUNAS.length).getValues()[0] : null;
    if (anterior) {
      const atual = String(anterior[5]);
      const diferente = atual && msg.atualizado && atual !== String(msg.atualizado);
      if (diferente && !msg._sobrescrever) {
        const hora = Utilities.formatDate(new Date(atual), 'America/Sao_Paulo', "dd/MM 'às' HH:mm");
        throw new Error('CONFLITO: este sermão foi alterado em outro aparelho em ' + hora + '.');
      }
      /* histórico: a versão do outro aparelho, quando substituída, e o estado anterior a cada nova sessão de edição */
      if (diferente) guardarVersao_(anterior, 'substituída por outro aparelho');
      else if (Date.now() - Date.parse(atual) > INTERVALO_VERSAO) guardarVersao_(anterior, 'edição');
    }
    const atualizado = new Date().toISOString();
    const topicos = (msg.topicos || []).map(t => {
      const p = { titulo: t.titulo || '', blocos: t.blocos || [] };
      if (Number(t.tempo) > 0) p.tempo = Number(t.tempo);
      return p;
    });
    const opcoes = msg.opcoes && msg.opcoes.teleprompter ? { teleprompter: true } : {}; // preferências do sermão
    const dados = JSON.stringify({ eventos: msg.eventos || [], topicos, pregacoes: (msg.pregacoes || []).slice(-MAX_PREGACOES), opcoes });
    if (dados.length > LIMITE_DADOS) {
      throw new Error('Sermão grande demais para uma célula da planilha (' + dados.length + ' de ' + LIMITE_DADOS + ' caracteres). Divida em dois sermões ou remova imagens e textos longos.');
    }
    const valores = [[id, msg.tema || '', msg.pasta || '', String(msg.tempo || 30), dados, atualizado]];
    if (linha > 0) sh.getRange(linha, 1, 1, COLUNAS.length).setValues(valores);
    else sh.getRange(sh.getLastRow() + 1, 1, 1, COLUNAS.length).setValues(valores);
    return { id, atualizado };
  } finally {
    lock.releaseLock();
  }
}

function excluirMensagem(id) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const linha = linhaDoId_(id);
    if (linha > 0) {
      const sh = aba_();
      guardarVersao_(sh.getRange(linha, 1, 1, COLUNAS.length).getValues()[0], 'excluído'); // vai para a lixeira
      sh.deleteRow(linha);
    }
    return true;
  } finally {
    lock.releaseLock();
  }
}

function duplicarMensagem(id) {
  const m = obterMensagem(id);
  m.id = '';
  m.tema = (m.tema || 'Sem tema') + ' (cópia)';
  m.pregacoes = []; // a cópia começa sem histórico de pregações
  return salvarMensagem(m);
}

/* ---------------- histórico de versões e lixeira (aba "Historico") ----------------
 * Uma linha por versão guardada: as 6 colunas do sermão + guardado (ISO) + motivo.
 * Motivos: 'edição' (estado antes de uma nova sessão de edição, 30 min depois do último salvamento),
 * 'substituída por outro aparelho' (conflito resolvido com "manter a minha"),
 * 'antes de restaurar' e 'excluído' (lixeira).
 */
const ABA_HIST = 'Historico';
const COLUNAS_HIST = COLUNAS.concat(['guardado', 'motivo']);
const INTERVALO_VERSAO = 30 * 60 * 1000;
const VERSOES_POR_SERMAO = 15;
const DIAS_LIXEIRA = 60;
const MAX_PREGACOES = 20;

function abaHistorico_() {
  const ss = aba_().getParent();
  let sh = ss.getSheetByName(ABA_HIST);
  if (!sh) {
    sh = ss.insertSheet(ABA_HIST);
    sh.getRange(1, 1, 1, COLUNAS_HIST.length).setValues([COLUNAS_HIST]).setFontWeight('bold');
    sh.getRange('A:H').setNumberFormat('@');
    sh.setFrozenRows(1);
  }
  return sh;
}
function linhasHistorico_() {
  const sh = abaHistorico_(), n = sh.getLastRow() - 1;
  return n < 1 ? [] : sh.getRange(2, 1, n, COLUNAS_HIST.length).getValues();
}
function guardarVersao_(valores, motivo) {
  const sh = abaHistorico_();
  const v = valores.slice(0, COLUNAS.length).map(String).concat([new Date().toISOString(), motivo]);
  sh.getRange(sh.getLastRow() + 1, 1, 1, COLUNAS_HIST.length).setValues([v]);
  podarHistorico_(sh, v[0]);
}
/* mantém as 15 versões mais recentes por sermão e a lixeira por 60 dias */
function podarHistorico_(sh, id) {
  const n = sh.getLastRow() - 1;
  if (n < 1) return;
  const rows = sh.getRange(2, 1, n, COLUNAS_HIST.length).getValues(), apagar = [], limite = Date.now() - DIAS_LIXEIRA * 864e5;
  const doSermao = [];
  rows.forEach((r, i) => {
    if (r[7] === 'excluído') { if (Date.parse(r[6]) < limite) apagar.push(i + 2); }
    else if (String(r[0]) === String(id)) doSermao.push(i + 2);
  });
  apagar.push(...doSermao.slice(0, Math.max(0, doSermao.length - VERSOES_POR_SERMAO)));
  apagar.sort((a, b) => b - a).forEach(l => sh.deleteRow(l));
}
const resumoVersao_ = r => {
  let nTopicos = 0;
  try { nTopicos = (JSON.parse(r[4] || '{}').topicos || []).length; } catch (e) {}
  return { id: String(r[0]), tema: String(r[1]), pasta: String(r[2]), atualizado: String(r[5]), guardado: String(r[6]), motivo: String(r[7]), nTopicos };
};

function listarVersoes(id) {
  return linhasHistorico_().filter(r => String(r[0]) === String(id) && r[7] !== 'excluído')
    .map(resumoVersao_).sort((a, b) => (a.guardado < b.guardado ? 1 : -1));
}

/* volta o sermão para uma versão guardada; o estado atual vira uma versão "antes de restaurar" */
function restaurarVersao(id, guardado) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const v = linhasHistorico_().find(r => String(r[0]) === String(id) && String(r[6]) === String(guardado));
    if (!v) throw new Error('Versão não encontrada. Ela pode ter sido apagada pelo limite de 15 versões.');
    const sh = aba_(), linha = linhaDoId_(id), atualizado = new Date().toISOString();
    const valores = [[String(v[0]), String(v[1]), String(v[2]), String(v[3]), String(v[4]), atualizado]];
    if (linha > 0) {
      guardarVersao_(sh.getRange(linha, 1, 1, COLUNAS.length).getValues()[0], 'antes de restaurar');
      sh.getRange(linha, 1, 1, COLUNAS.length).setValues(valores);
    } else sh.getRange(sh.getLastRow() + 1, 1, 1, COLUNAS.length).setValues(valores);
    return { id: String(v[0]), atualizado };
  } finally { lock.releaseLock(); }
}

function listarExcluidos() {
  const existentes = new Set(linhas_().map(r => String(r[0])));
  const vistos = {};
  linhasHistorico_().filter(r => r[7] === 'excluído' && !existentes.has(String(r[0]))).forEach(r => {
    const x = resumoVersao_(r);
    if (!vistos[x.id] || vistos[x.id].guardado < x.guardado) vistos[x.id] = x;
  });
  return Object.keys(vistos).map(k => vistos[k]).sort((a, b) => (a.guardado < b.guardado ? 1 : -1));
}

function restaurarExcluido(id) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    if (linhaDoId_(id) > 0) throw new Error('Este sermão já está na lista.');
    const v = linhasHistorico_().filter(r => r[7] === 'excluído' && String(r[0]) === String(id))
      .sort((a, b) => (a[6] < b[6] ? 1 : -1))[0];
    if (!v) throw new Error('Sermão não encontrado na lixeira.');
    const sh = aba_(), atualizado = new Date().toISOString();
    sh.getRange(sh.getLastRow() + 1, 1, 1, COLUNAS.length).setValues([[String(v[0]), String(v[1]), String(v[2]), String(v[3]), String(v[4]), atualizado]]);
    return { id: String(v[0]), atualizado };
  } finally { lock.releaseLock(); }
}

/* ---------------- backup no Drive ----------------
 * Uma pasta por data em "Sermões · backups", com um .sermao.json por sermão (importável pelo app).
 * Guarda as 8 mais recentes. Para rodar toda segunda às 4h: execute instalarBackupSemanal() uma vez no editor.
 */
const PASTA_BACKUP = 'Sermões · backups';
const BACKUPS_GUARDADOS = 8;

function pastaRaiz_(nome) {
  const it = DriveApp.getFoldersByName(nome);
  return it.hasNext() ? it.next() : DriveApp.createFolder(nome);
}
const slug_ = s => semAcento_(s).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'sermao';

function backupSemanal() {
  const raiz = pastaRaiz_(PASTA_BACKUP);
  const nome = Utilities.formatDate(new Date(), 'America/Sao_Paulo', 'yyyy-MM-dd HH.mm');
  const pasta = raiz.createFolder(nome);
  let n = 0;
  linhas_().filter(r => r[0]).forEach(r => {
    let d = {};
    try { d = JSON.parse(r[4] || '{}'); } catch (e) {}
    const arq = { formato: 'sermoes/1', exportado: new Date().toISOString(),
      sermao: { tema: String(r[1]), pasta: String(r[2]), tempo: Number(r[3]) || 30, opcoes: d.opcoes || {}, topicos: d.topicos || [] } };
    pasta.createFile(slug_(r[1]) + '-' + String(r[0]).slice(0, 6) + '.sermao.json', JSON.stringify(arq, null, 2), 'application/json');
    n++;
  });
  const todas = [], it = raiz.getFolders();
  while (it.hasNext()) todas.push(it.next());
  todas.sort((a, b) => (a.getName() < b.getName() ? 1 : -1)).slice(BACKUPS_GUARDADOS).forEach(f => f.setTrashed(true));
  return { pasta: PASTA_BACKUP + ' / ' + nome, sermoes: n, url: pasta.getUrl() };
}
/* chamado pelo botão "Backup no Drive agora" do app */
function fazerBackup() { return backupSemanal(); }

function instalarBackupSemanal() {
  ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === 'backupSemanal').forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('backupSemanal').timeBased().onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(4).create();
  return backupSemanal();
}

/* ---------------- agenda ---------------- */

function listarEventos() {
  const agora = new Date();
  const ini = new Date(agora.getTime() - 7 * 864e5);
  const fim = new Date(agora.getTime() + 90 * 864e5);
  return CalendarApp.getDefaultCalendar().getEvents(ini, fim).slice(0, 80).map(e => ({
    id: e.getId(), titulo: e.getTitle(), data: e.getStartTime().toISOString(),
  }));
}

/* ---------------- Bíblia (YouVersion Platform) ---------------- */
/*
 * A App Key fica em Propriedades do script → YOUVERSION_KEY (nunca no código).
 * Só funcionam as versões licenciadas para a chave no portal platform.youversion.com.
 */

const YV_BASE = 'https://api.youversion.com';
/* sigla digitada no bloco (sem espaços nem hífen, em maiúsculas) → id da versão no YouVersion */
const YV_VERSOES = { NBV: 1966, NBVP: 1966, NVI: 129, BLT: 3254, PTNVI: 4360, NVI2011: 4360, OL: 1967 };

/* código USFM → nomes e abreviações em português (sem acento, minúsculas) */
const LIVROS = {
  GEN: 'genesis gn', EXO: 'exodo ex', LEV: 'levitico lv', NUM: 'numeros nm', DEU: 'deuteronomio dt',
  JOS: 'josue js', JDG: 'juizes jz', RUT: 'rute rt', '1SA': '1samuel 1sm', '2SA': '2samuel 2sm',
  '1KI': '1reis 1rs', '2KI': '2reis 2rs', '1CH': '1cronicas 1cr', '2CH': '2cronicas 2cr',
  EZR: 'esdras ed', NEH: 'neemias ne', EST: 'ester et', JOB: 'job', PSA: 'salmos salmo sl',
  PRO: 'proverbios pv', ECC: 'eclesiastes ec', SNG: 'canticos cantares canticodoscanticos ct',
  ISA: 'isaias is', JER: 'jeremias jr', LAM: 'lamentacoes lm', EZK: 'ezequiel ez', DAN: 'daniel dn',
  HOS: 'oseias os', JOL: 'joel jl', AMO: 'amos am', OBA: 'obadias ob', JON: 'jonas jn',
  MIC: 'miqueias mq', NAM: 'naum na', HAB: 'habacuque hc', ZEP: 'sofonias sf', HAG: 'ageu ag',
  ZEC: 'zacarias zc', MAL: 'malaquias ml',
  MAT: 'mateus mt', MRK: 'marcos mc', LUK: 'lucas lc', JHN: 'joao jo', ACT: 'atos at',
  ROM: 'romanos rm', '1CO': '1corintios 1co', '2CO': '2corintios 2co', GAL: 'galatas gl',
  EPH: 'efesios ef', PHP: 'filipenses fp', COL: 'colossenses cl', '1TH': '1tessalonicenses 1ts',
  '2TH': '2tessalonicenses 2ts', '1TI': '1timoteo 1tm', '2TI': '2timoteo 2tm', TIT: 'tito tt',
  PHM: 'filemom filemon fm', HEB: 'hebreus hb', JAS: 'tiago tg', '1PE': '1pedro 1pe', '2PE': '2pedro 2pe',
  '1JN': '1joao 1jo', '2JN': '2joao 2jo', '3JN': '3joao 3jo', JUD: 'judas jd', REV: 'apocalipse ap',
};

function semAcento_(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/* "1 Coríntios", "I Co", "1º Jo", "Sl", "Jó" → código USFM */
function livroUsfm_(nome) {
  const bruto = String(nome).trim().toLowerCase().replace(/\./g, '');
  if (bruto === 'jó') return 'JOB'; // "Jo" (sem acento) é João
  let s = semAcento_(bruto)
    .replace(/^(iii|3º|3o|3a|terceira)\s*/, '3').replace(/^(ii|2º|2o|2a|segunda)\s*/, '2')
    .replace(/^(i|1º|1o|1a|primeira)\s+/, '1').replace(/\s+/g, '');
  for (const cod in LIVROS) if (LIVROS[cod].split(' ').indexOf(s) >= 0) return cod;
  return '';
}

/*
 * "Mateus 24:45-47" → ['MAT.24.45-47'];  "Sl 23" → ['PSA.23'];  "Jo 3:16,18" → ['JHN.3.16', 'JHN.3.18']
 * Aceita ":" "." ou "," entre capítulo e versículo.
 * Trecho entre capítulos ("Gn 1:26-2:3") vira um objeto { livro, c1, v1, c2, v2 }, que buscarVersiculo divide,
 * porque a API só aceita intervalos dentro de um capítulo.
 */
function referenciaUsfm_(ref) {
  const limpo = String(ref || '').replace(/[–—]/g, '-').replace(/\(.*?\)/g, '').trim();
  const m = limpo.match(/^(.+?)\s*(\d+)(?:\s*[:.,]\s*(.+))?$/);
  if (!m) throw new Error('Não entendi a referência "' + ref + '". Use, por exemplo, Mateus 24:45-47.');
  const livro = livroUsfm_(m[1]);
  if (!livro) throw new Error('Não reconheci o livro "' + m[1].trim() + '".');
  const cap = Number(m[2]);
  if (!m[3]) return [livro + '.' + cap];
  return m[3].split(/[,;]/).map(p => p.replace(/\s+/g, '')).filter(Boolean).map(p => {
    const x = p.match(/^(\d+)-(\d+)[:.](\d+)$/);
    if (x) {
      const c2 = Number(x[2]);
      if (c2 <= cap) throw new Error('O capítulo final ("' + p + '") precisa ser depois do capítulo ' + cap + '.');
      return { livro, c1: cap, v1: Number(x[1]), c2, v2: Number(x[3]) };
    }
    if (!/^\d+(-\d+)?$/.test(p)) throw new Error('Não entendi os versículos "' + p + '".');
    return livro + '.' + cap + '.' + p;
  });
}

function versaoYV_(versao) {
  const sigla = String(versao || 'NBV').toUpperCase().replace(/[\s-]/g, '');
  if (/^\d+$/.test(sigla)) return Number(sigla);
  const id = YV_VERSOES[sigla];
  if (!id) throw new Error('A versão ' + String(versao || '').toUpperCase() + ' não está disponível na busca. Disponíveis: NBV, NVI, NVI 2011, BLT e OL (O Livro, de Portugal). Para ARA, NAA e outras, preencha o texto à mão.');
  return id;
}

function chamarYouVersion_(caminho) {
  const chave = PropertiesService.getScriptProperties().getProperty('YOUVERSION_KEY');
  if (!chave) throw new Error('Falta a chave do YouVersion. Cadastre YOUVERSION_KEY em Configurações do projeto → Propriedades do script.');
  const resp = UrlFetchApp.fetch(YV_BASE + caminho, {
    headers: { 'X-YVP-App-Key': chave, 'Accept': 'application/json' },
    muteHttpExceptions: true,
  });
  return { codigo: resp.getResponseCode(), corpo: resp.getContentText() };
}

/*
 * O copyright costuma vir em dois parágrafos (português e inglês). Fica só o primeiro,
 * inteiro; se for longo demais, corta no fim de uma palavra.
 */
function resumirCopyright_(c) {
  const paragrafos = String(c || '').split(/\n\s*\n|\r\n\s*\r\n|\n/).map(p => p.replace(/\s+/g, ' ').trim()).filter(Boolean);
  let txt = paragrafos[0] || '';
  /* se veio tudo numa linha só, separa na versão em inglês ("Copyright © … by") */
  const ingles = txt.search(/\s(Holy Bible|[A-Z][^.]{0,80}Copyright ©)/);
  if (ingles > 40) txt = txt.slice(0, ingles).trim();
  if (txt.length > 400) txt = txt.slice(0, 400).replace(/\s+\S*$/, '') + '…';
  return txt;
}

/* copyright da versão (para a atribuição exigida pela licença); guardado 6 h no cache */
function copyrightYV_(id) {
  const cache = CacheService.getScriptCache(), chave = 'yv_copy2_' + id;
  const salvo = cache.get(chave);
  if (salvo !== null) return salvo;
  let txt = '';
  try {
    const r = chamarYouVersion_('/v1/bibles/' + id);
    if (r.codigo === 200) {
      const b = JSON.parse(r.corpo);
      txt = resumirCopyright_(b.copyright);
    }
  } catch (e) {}
  cache.put(chave, txt, 21600);
  return txt;
}

/**
 * Busca o texto de uma referência numa versão licenciada.
 * @return {{texto: string, referencia: string, versao: string, copyright: string}}
 */
/* um trecho dentro de um capítulo; lança erros em português conforme o código HTTP */
function trechoYV_(id, versao, usfm) {
  const r = chamarYouVersion_('/v1/bibles/' + id + '/passages/' + usfm + '?format=text');
  if (r.codigo === 401 || r.codigo === 403) {
    throw new Error('A versão ' + versao + ' ainda não está liberada para a sua chave. Peça a licença em platform.youversion.com → Licensing.');
  }
  if (r.codigo === 404) {
    throw new Error('Não encontrei ' + usfm.replace(/\./g, ' ') + ' na versão ' + versao + '. Confira a referência, ou se a versão já está licenciada.');
  }
  if (r.codigo !== 200) throw new Error('O YouVersion respondeu ' + r.codigo + '. Tente de novo em instantes.');
  const j = JSON.parse(r.corpo);
  return { texto: String(j.content || '').replace(/\s+/g, ' ').trim(), ref: j.reference || '' };
}

/*
 * Do versículo v até o fim do capítulo. Primeiro tenta um intervalo até 176 (o maior capítulo, Salmo 119).
 * Se a API recusar, busca versículo por versículo em paralelo (fetchAll) até o primeiro que não existir.
 */
function ateFimDoCapitulo_(id, versao, livro, cap, v) {
  const base = livro + '.' + cap + '.';
  const r = chamarYouVersion_('/v1/bibles/' + id + '/passages/' + base + v + '-176?format=text');
  if (r.codigo === 200) {
    const j = JSON.parse(r.corpo);
    const t = String(j.content || '').replace(/\s+/g, ' ').trim();
    if (t) return t;
  }
  const chave = PropertiesService.getScriptProperties().getProperty('YOUVERSION_KEY');
  const pedidos = [];
  for (let k = v; k < v + 80 && k <= 176; k++) {
    pedidos.push({ url: YV_BASE + '/v1/bibles/' + id + '/passages/' + base + k + '?format=text',
      headers: { 'X-YVP-App-Key': chave, 'Accept': 'application/json' }, muteHttpExceptions: true });
  }
  const textos = [];
  const resps = UrlFetchApp.fetchAll(pedidos);
  for (let i = 0; i < resps.length; i++) {
    if (resps[i].getResponseCode() !== 200) break;
    textos.push(String(JSON.parse(resps[i].getContentText()).content || '').replace(/\s+/g, ' ').trim());
  }
  if (!textos.length) return trechoYV_(id, versao, base + v).texto; // gera a mensagem de erro adequada
  return textos.join(' ');
}

function buscarVersiculo(ref, versao) {
  versao = String(versao || 'NBV').trim().toUpperCase();
  const id = versaoYV_(versao);
  const partes = referenciaUsfm_(ref);
  const textos = [], refs = [];
  let atravessa = false;
  partes.forEach(p => {
    if (typeof p === 'string') {
      const t = trechoYV_(id, versao, p);
      textos.push(t.texto); if (t.ref) refs.push(t.ref);
      return;
    }
    atravessa = true;
    if (p.c2 - p.c1 > 5) throw new Error('Trecho longo demais (mais de 5 capítulos). Divida em blocos menores.');
    textos.push(ateFimDoCapitulo_(id, versao, p.livro, p.c1, p.v1));
    for (let c = p.c1 + 1; c < p.c2; c++) textos.push(trechoYV_(id, versao, p.livro + '.' + c).texto);
    textos.push(trechoYV_(id, versao, p.livro + '.' + p.c2 + '.1-' + p.v2).texto);
  });
  /* entre capítulos, a referência digitada é mais legível que a soma das partes */
  const referencia = atravessa ? String(ref).trim() : refs.join('; ');
  return { texto: textos.join(' '), referencia, versao, copyright: copyrightYV_(id) };
}

/* ---------------- imagens (Google Drive) ---------------- */

function enviarImagem(dataUrl, nome) {
  const m = String(dataUrl).match(/^data:(.+?);base64,(.*)$/);
  if (!m) throw new Error('Imagem inválida.');
  const blob = Utilities.newBlob(Utilities.base64Decode(m[2]), m[1], nome || 'imagem.jpg');
  const it = DriveApp.getFoldersByName(PASTA_IMAGENS);
  const pasta = it.hasNext() ? it.next() : DriveApp.createFolder(PASTA_IMAGENS);
  const arquivo = pasta.createFile(blob);
  try { arquivo.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (e) {}
  return 'https://drive.google.com/thumbnail?id=' + arquivo.getId() + '&sz=w1600';
}
