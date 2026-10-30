/* ---------------- Holyrics (projeção e telão de retorno) ----------------
 * Chamadas pela internet ao servidor do Holyrics (api.holyrics.com.br), que repassa ao programa aberto
 * no computador da igreja. Propriedades do script: HOLYRICS_API_KEY (em Arquivo > Configurações > API Server)
 * e HOLYRICS_TOKEN (token criado em "gerenciar permissões", só com as ações abaixo).
 * Só estas ações podem ser pedidas pela página:
 */
const HOLYRICS_ACOES = ['ShowVerse', 'ShowQuickPresentation', 'CloseCurrentPresentation',
  'SetTextCP', 'StartCountdownCP', 'StopCountdownCP'];
const HOLYRICS_ERROS = {
  device_disconnected: 'O Holyrics não está aberto ou sem internet no computador da igreja.',
  invalid_api_key: 'API_KEY do Holyrics inválida. Confira HOLYRICS_API_KEY nas Propriedades do script.',
};

function chamarHolyrics_(modo, acao, dados) {
  const props = PropertiesService.getScriptProperties();
  const chave = props.getProperty('HOLYRICS_API_KEY'), token = props.getProperty('HOLYRICS_TOKEN');
  if (!chave || !token) throw new Error('Falta configurar o Holyrics: cadastre HOLYRICS_API_KEY e HOLYRICS_TOKEN nas Propriedades do script.');
  const resp = UrlFetchApp.fetch('https://api.holyrics.com.br/' + modo + '/' + acao, {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    headers: { api_key: chave, token: token }, payload: JSON.stringify(dados || {}),
  });
  let r;
  try { r = JSON.parse(resp.getContentText()); }
  catch (e) { throw new Error('O Holyrics respondeu ' + resp.getResponseCode() + ' sem JSON. Tente de novo.'); }
  if (r.status !== 'ok') {
    const e = r.error || {};
    throw new Error(HOLYRICS_ERROS[e.key] || 'Holyrics: ' + (e.message || e.key || JSON.stringify(e)));
  }
  if (modo === 'request') {
    if (r.response_status === 'timeout') throw new Error('O Holyrics não respondeu a tempo. Ele está aberto no computador da igreja?');
    const resposta = r.response || {};
    if (resposta.status !== 'ok') {
      const e = resposta.error;
      if (e === 'invalid token') throw new Error('Token do Holyrics inválido. Confira HOLYRICS_TOKEN nas Propriedades do script.');
      if (e && e.unauthorized_actions) throw new Error('O token do Holyrics não tem permissão para: ' + e.unauthorized_actions + '. Libere em Configurações > API Server > gerenciar permissões.');
      throw new Error('Holyrics: ' + (typeof e === 'string' ? e : JSON.stringify(e)));
    }
    return resposta.data;
  }
  return true;
}

/* envia sem esperar a resposta do programa (mais rápido durante a pregação) */
function projetarHolyrics(acao, dados) {
  if (HOLYRICS_ACOES.indexOf(acao) < 0) throw new Error('Ação do Holyrics não permitida: ' + acao);
  return chamarHolyrics_('send', acao, dados);
}

/* confere conexão e permissões do token (usado pelo botão "Testar conexão") */
function testarHolyrics() {
  chamarHolyrics_('request', 'CheckPermissions', { actions: HOLYRICS_ACOES.join(',') });
  return { ok: true, acoes: HOLYRICS_ACOES };
}
