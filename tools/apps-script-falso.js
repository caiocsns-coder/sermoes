// Ambiente do Google Apps Script simulado em Node, para testar o apps-script/Code.gs sem a conta Google.
// Cada chamada a carregar() cria um mundo novo: propriedades, cache, planilha, Drive, relógio e rede falsos.
const fs = require('fs'), path = require('path'), vm = require('vm'), crypto = require('crypto');
const CODE_GS = path.join(__dirname, '..', 'apps-script', 'Code.gs');

// Planilha em memória: cada aba guarda as linhas como arrays de strings (como o getValues devolve).
function criarPlanilha() {
  const ss = { abas: {}, getId: () => 'planilha-falsa',
    getSheetByName(n) { return this.abas[n] || null; },
    insertSheet(n) { return (this.abas[n] = criarAba(n, ss)); } };
  return ss;
}
function criarAba(nome, ss) {
  const L = [];
  return { nome, L, getLastRow: () => L.length, getParent: () => ss, setFrozenRows() {}, setColumnWidth() {},
    deleteRow: r => L.splice(r - 1, 1),
    getRange(r, c, nr, nc) {
      if (typeof r === 'string') return { setNumberFormat() { return this; } };
      nr = nr || 1; nc = nc || 1;
      return {
        getValues: () => L.slice(r - 1, r - 1 + nr).map(l => { const x = (l || []).slice(c - 1, c - 1 + nc); while (x.length < nc) x.push(''); return x; }),
        getValue: () => (L[r - 1] || [])[c - 1],
        setValues: v => { v.forEach((row, i) => { while (L.length < r + i) L.push([]); const l = L[r - 1 + i]; row.forEach((x, j) => { l[c - 1 + j] = String(x); }); }); return { setFontWeight() {} }; },
        setFontWeight() {},
      };
    } };
}

// Drive em memória: pastas com subpastas e arquivos de texto.
function criarDrive() {
  const raiz = [], arquivos = [];
  const it = a => { let i = 0; return { hasNext: () => i < a.length, next: () => a[i++] }; };
  const pasta = nome => {
    const f = { nome, filhas: [], arquivos: [], lixo: false, getName: () => nome, getId: () => 'pasta-' + nome, getUrl: () => 'https://drive/' + nome,
      setTrashed(v) { f.lixo = v; }, createFolder(x) { const p = pasta(x); f.filhas.push(p); return p; },
      getFolders: () => it(f.filhas.filter(p => !p.lixo)), getFoldersByName: n => it(f.filhas.filter(p => !p.lixo && p.nome === n)),
      createFile(a, txt) { const arq = typeof a === 'string' ? { nome: a, txt } : { nome: a.nome, blob: a };
        arq.getId = () => 'arq-' + arquivos.length; arq.setSharing = () => {}; arquivos.push(arq); f.arquivos.push(arq); return arq; } };
    return f;
  };
  return { raiz, arquivos, Access: { ANYONE_WITH_LINK: 'link' }, Permission: { VIEW: 'view' },
    getFoldersByName: n => it(raiz.filter(p => !p.lixo && p.nome === n)),
    createFolder: n => { const p = pasta(n); raiz.push(p); return p; } };
}

// Utilities.formatDate só com os padrões usados no Code.gs, no fuso de São Paulo (UTC−3).
function formatDate(d, tz, fmt) {
  const x = new Date(new Date(d).getTime() - 3 * 3600e3), p = n => String(n).padStart(2, '0');
  return fmt.replace(/'([^']*)'|yyyy|MM|dd|HH|mm/g, (m, lit) => lit !== undefined ? lit
    : m === 'yyyy' ? x.getUTCFullYear() : m === 'MM' ? p(x.getUTCMonth() + 1) : m === 'dd' ? p(x.getUTCDate())
    : m === 'HH' ? p(x.getUTCHours()) : p(x.getUTCMinutes()));
}

/**
 * opcoes.props: Propriedades do script iniciais
 * opcoes.agora: data inicial do relógio falso (ms)
 * opcoes.rede(url, params) → { code, body } (objeto vira JSON): responde ao UrlFetchApp
 */
function carregar(opcoes) {
  opcoes = opcoes || {};
  const props = Object.assign({}, opcoes.props), cache = {};
  let agora = opcoes.agora || Date.parse('2026-10-30T12:00:00Z');
  const RealDate = Date;
  class FakeDate extends RealDate { constructor(...a) { super(...(a.length ? a : [agora])); } static now() { return agora; } }
  const ss = criarPlanilha(), drive = criarDrive(), gatilhos = [], chamadas = [];
  const resposta = (url, params) => {
    chamadas.push({ url, params: params || {} });
    const r = opcoes.rede ? opcoes.rede(url, params || {}) : { code: 404, body: '' };
    const corpo = typeof r.body === 'string' ? r.body : JSON.stringify(r.body);
    return { getResponseCode: () => r.code || 200, getContentText: () => corpo };
  };
  const ctx = {
    console, Date: FakeDate,
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => (k in props ? props[k] : null), setProperty: (k, v) => { props[k] = String(v); },
      deleteProperty: k => { delete props[k]; }, getProperties: () => Object.assign({}, props), getKeys: () => Object.keys(props) }) },
    CacheService: { getScriptCache: () => ({ get: k => (k in cache ? cache[k] : null), put: (k, v) => { cache[k] = String(v); }, remove: k => { delete cache[k]; } }) },
    LockService: { getScriptLock: () => ({ waitLock() {}, tryLock: () => true, releaseLock() {} }) },
    Session: { getEffectiveUser: () => ({ getEmail: () => opcoes.dono || 'caio@x.com' }) },
    Utilities: { getUuid: () => crypto.randomUUID(), DigestAlgorithm: { SHA_256: 'sha256' },
      computeDigest: (a, s) => [...crypto.createHash('sha256').update(s).digest()].map(b => (b > 127 ? b - 256 : b)),
      base64EncodeWebSafe: b => Buffer.from(b.map(x => x & 255)).toString('base64url'), formatDate,
      base64Decode: s => [...Buffer.from(s, 'base64')], newBlob: (bytes, tipo, nome) => ({ nome, tipo, bytes }) },
    UrlFetchApp: { fetch: resposta, fetchAll: reqs => reqs.map(q => resposta(q.url, q)) },
    SpreadsheetApp: { getActiveSpreadsheet: () => ss, openById: () => ss, create: () => ss },
    DriveApp: drive,
    CalendarApp: { getDefaultCalendar: () => ({ getEvents: () => opcoes.eventos || [] }) },
    ScriptApp: { WeekDay: { MONDAY: 'MONDAY' }, getProjectTriggers: () => gatilhos.slice(),
      deleteTrigger: g => gatilhos.splice(gatilhos.indexOf(g), 1),
      newTrigger: fn => { const g = { fn, getHandlerFunction: () => fn }; const b = { timeBased: () => b, onWeekDay: () => b, atHour: () => b, everyWeeks: () => b, create: () => { gatilhos.push(g); return g; } }; return b; } },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: s => ({ setMimeType: () => JSON.parse(s) }) },
    HtmlService: { createHtmlOutput: h => ({ setTitle: () => h }) },
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(CODE_GS, 'utf8'), ctx, { filename: 'Code.gs' });
  return { gs: ctx, props, cache, planilha: ss, drive, gatilhos, chamadas,
    avancar: min => { agora += min * 60000; },
    post: corpo => ctx.doPost({ postData: { contents: JSON.stringify(corpo) } }) };
}

module.exports = { carregar };
