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
