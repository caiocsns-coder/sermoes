/* Chamadas à API do Apps Script (run), login com Google e código de pareamento. */
import { CACHE_LISTA, CHAVE_SESSAO, local } from './armazenamento.js';
import { CFG } from './config.js';
import { S } from './estado.js';
import { render } from './render.js';
import { esc, textoErro } from './util.js';

/* sem internet ou servidor inacessível (implantação antiga, acesso diferente de "Qualquer pessoa") */
export const erroRede = () => Object.assign(new Error(navigator.onLine === false
  ? 'Sem internet.'
  : 'Não consegui falar com o servidor. Se a internet está funcionando, confira no Apps Script se a implantação está na versão nova, com acesso "Qualquer pessoa".'), { rede: true });

export async function chamar(fn, args, cred) {
  if (!CFG.api) throw new Error('Configuração pendente: falta o endereço da API em config.json.');
  let resp;
  try {
    resp = await fetch(CFG.api, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(Object.assign({ fn, args }, cred)) });
  } catch (e) { throw erroRede(); }
  if (!resp.ok) throw new Error('O servidor respondeu ' + resp.status + '. Tente de novo.');
  try { return await resp.json(); }
  catch (e) { throw new Error('Resposta inesperada do servidor. Confira se a implantação está com acesso "Qualquer pessoa".'); }
}

export function lerSessao() { const s = local.ler(CHAVE_SESSAO); return s && s.exp > Date.now() + 60000 ? s : null; }

/* chama uma função do Code.gs; pede login quando não há sessão ou ela venceu */
export async function run(fn, ...args) {
  if (navigator.onLine === false) throw erroRede();
  const s = lerSessao();
  let sessao = s ? s.sessao : await pedirLogin();
  let r = await chamar(fn, args, { sessao });
  if (!r.ok && r.auth) {
    local.apagar(CHAVE_SESSAO);
    sessao = await pedirLogin(r.erro);
    r = await chamar(fn, args, { sessao });
  }
  if (!r.ok) throw Object.assign(new Error(r.erro), r.auth ? { auth: true } : {});
  return r.data;
}

let esperaLogin = null;

/* { promessa, ok, falhar } enquanto a tela de entrada está aberta */
export function pedirLogin(motivo) {
  if (!esperaLogin) {
    let ok, falhar;
    const promessa = new Promise((a, b) => { ok = a; falhar = b; });
    esperaLogin = { promessa, ok, falhar };
  }
  mostrarLogin(motivo);
  return esperaLogin.promessa;
}

/* resposta do "Fazer login com o Google": troca o ID token por uma sessão de 30 dias */
export async function aoEntrar(resp) {
  const caixa = document.getElementById('lmsg');
  if (caixa) { caixa.className = ''; caixa.textContent = 'Entrando…'; }
  try {
    const r = await chamar('entrar', [], { token: resp && resp.credential });
    if (!r.ok) throw new Error(r.erro);
    concluirLogin(r.data);
  } catch (e) {
    if (caixa) { caixa.className = 'err'; caixa.textContent = textoErro(e); }
  }
}

export function concluirLogin(dados) {
  local.gravar(CHAVE_SESSAO, dados);
  esconderLogin();
  if (esperaLogin) { const e = esperaLogin; esperaLogin = null; e.ok(dados.sessao); }
  else if (S.view === 'lista') render();
}

/* app instalado na Tela de Início (lá o login do Google costuma não completar) */
export const instalado = () => navigator.standalone === true || !!(window.matchMedia && matchMedia('(display-mode: standalone)').matches);

export const vEntrarCodigo = () => `<div class="lcod">
  <input id="lcodigo" inputmode="numeric" autocomplete="one-time-code" maxlength="7" placeholder="000000" aria-label="Código de 6 dígitos">
  <button class="btn pri" data-a="entrarCodigo">Entrar</button>
</div>`;

/* troca o código de 6 dígitos, gerado num aparelho já conectado, por uma sessão */
export async function entrarComCodigo() {
  const inp = document.getElementById('lcodigo'), caixa = document.getElementById('lmsg');
  const c = String(inp ? inp.value : '').replace(/\D/g, '');
  const msg = (t, erro) => { if (caixa) { caixa.className = erro ? 'err' : ''; caixa.textContent = t; } };
  if (c.length !== 6) return msg('Digite os 6 números do código.', true);
  msg('Entrando…');
  try {
    const r = await chamar('entrarComCodigo', [], { codigo: c });
    if (!r.ok) throw new Error(r.erro);
    concluirLogin(r.data);
  } catch (e) { msg(textoErro(e), true); }
}

export let gisPronto = false;

export function iniciarGoogle() {
  if (gisPronto) return true;
  if (!(window.google && google.accounts && google.accounts.id)) return false;
  google.accounts.id.initialize({ client_id: CFG.client, callback: aoEntrar, auto_select: true, cancel_on_tap_outside: false, itp_support: true, use_fedcm_for_prompt: true });
  gisPronto = true;
  return true;
}

export function mostrarLogin(motivo) {
  const el = document.getElementById('login');
  if (el.classList.contains('on') && document.getElementById('gbtn')) {
    const caixa = document.getElementById('lmsg'); if (caixa && motivo) caixa.textContent = motivo;
    return;
  }
  el.className = 'on' + (S.view === 'lista' && !S.lista.length ? '' : ' sobre');
  el.innerHTML = `<div class="lbox">
    <h1 class="logo">Sermões</h1>
    <p id="lmsg">${esc(motivo || 'Entre com a sua conta Google para abrir os seus sermões.')}</p>
    ${instalado() ? '<p>No app instalado, o login do Google pode não funcionar. Abra o app no Safari ou no computador, toque em <b>Conectar outro aparelho</b> no fim da lista e digite aqui o código.</p>' : ''}
    <div id="gbtn"></div>
    <div id="lcodbox">${instalado() ? vEntrarCodigo() : '<button class="link" data-a="mostrarCodigo">Entrar com código de outro aparelho</button>'}</div>
    <div class="off" id="loff"></div>
  </div>`;
  const tentar = n => {
    if (!document.getElementById('gbtn')) return;
    if (iniciarGoogle()) {
      google.accounts.id.renderButton(document.getElementById('gbtn'), { theme: 'filled_black', size: 'large', shape: 'pill', text: 'signin_with', locale: 'pt-BR' });
      google.accounts.id.prompt();
    } else if (n < 20) setTimeout(() => tentar(n + 1), 300);
    else {
      const off = document.getElementById('loff');
      if (off) off.innerHTML = '<p>Não foi possível carregar o login do Google. Confira a internet.</p>'
        + (local.ler(CACHE_LISTA) ? '<button class="btn" data-a="semInternet">Usar o que está salvo no aparelho</button>' : '');
    }
  };
  tentar(0);
}

export function esconderLogin() { const el = document.getElementById('login'); el.className = ''; el.innerHTML = ''; }

export function mostrarConfig() {
  const el = document.getElementById('login');
  el.className = 'on';
  el.innerHTML = '<div class="lbox"><h1 class="logo">Sermões</h1><p class="err">Configuração pendente: preencha <b>apiUrl</b> e <b>googleClientId</b> no config.json e rode <b>npm run build</b>.</p></div>';
}

// Usuário desistiu do login (botão "Continuar sem internet"): quem esperava recebe o erro de rede.
export function desistirLogin() {
  if (esperaLogin) { const w = esperaLogin; esperaLogin = null; w.falhar(erroRede()); }
}
