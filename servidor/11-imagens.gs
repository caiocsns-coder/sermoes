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
