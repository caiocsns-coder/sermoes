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
