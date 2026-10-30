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
