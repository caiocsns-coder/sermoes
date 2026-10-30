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
    projetarHolyrics, testarHolyrics,
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
