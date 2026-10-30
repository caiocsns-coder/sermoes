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
