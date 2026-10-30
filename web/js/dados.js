/* Carregar, abrir, salvar (automático), conflito e sincronização sem internet. */
import { CACHE_LISTA, CACHE_MSG, chaveMsg, guardarMsg, local, marcarPendente, pendentes } from './armazenamento.js';
import { atualizarStatus, localT } from './editor.js';
import { S } from './estado.js';
import { ESPERA_AUTO } from './modelo.js';
import { render } from './render.js';
import { lerSessao, run } from './servidor.js';
import { falha, textoErro, toast } from './util.js';

export async function carregarLista() {
  S.carregando = true; S.view = 'lista'; render();
  try {
    S.lista = await run('listarMensagens');
    local.gravar(CACHE_LISTA, S.lista); S.offline = false;
  } catch (e) {
    if (e.rede) { S.lista = local.ler(CACHE_LISTA) || []; S.offline = true; }
    else falha(e);
  }
  /* sermões criados neste aparelho e ainda não enviados */
  pendentes().filter(k => k.indexOf('local-') === 0).forEach(k => {
    const m = local.ler(CACHE_MSG + k);
    if (m && !S.lista.some(x => x._local === k)) {
      S.lista.unshift({ id: '', _local: k, tema: m.tema, pasta: m.pasta, tempo: m.tempo, nTopicos: m.topicos.length, atualizado: new Date(+k.slice(6)).toISOString(), busca: '' });
    }
  });
  S.carregando = false; render();
}

/* chave = id do servidor ou "local-…" (criado sem internet) */
export async function abrir(chave) {
  const pend = pendentes().includes(chave), copia = local.ler(CACHE_MSG + chave);
  let m = null;
  if ((pend || chave.indexOf('local-') === 0) && copia) m = copia; // alterações deste aparelho têm prioridade
  else {
    try { toast('Abrindo…'); m = await run('obterMensagem', chave); guardarMsg(m); S.offline = false; }
    catch (e) {
      if (!e.rede) return falha(e);
      m = copia; S.offline = true;
      if (!m) return toast('Este sermão ainda não foi aberto neste aparelho. Abra-o uma vez com internet.', true);
      toast('Sem internet: abrindo a cópia salva no aparelho.');
    }
  }
  if (!m) return toast('Sermão não encontrado no aparelho.', true);
  m.topicos.forEach((t, i) => t._open = i === 0);
  S.msg = m; S.dirty = false; S.ins = null; S.sel = ''; S.view = 'editor'; render(); window.scrollTo(0, 0);
  m.topicos.forEach(t => t.blocos.forEach(b => { if (b.tipo === 'imagem' && b.url) { const im = new Image(); im.src = b.url; } }));
  if (pend) { S.dirty = true; atualizarStatus(); agendarAuto(); } // tenta enviar o que ficou pendente
}

/* envia ao servidor os sermões alterados sem internet */
export async function sincronizar() {
  if (S.sincronizando || navigator.onLine === false || !lerSessao()) return;
  const lista = pendentes();
  if (!lista.length) return;
  S.sincronizando = true;
  let enviados = 0;
  for (const k of lista) {
    if (S.msg && chaveMsg(S.msg) === k && S.view !== 'lista') { if ((await salvar(true)) === true) enviados++; continue; }
    const m = local.ler(CACHE_MSG + k);
    if (!m) { marcarPendente(k, false); continue; }
    const c = JSON.parse(JSON.stringify(m)); delete c._local;
    try {
      const r = await run('salvarMensagem', c);
      m.id = r.id; m.atualizado = r.atualizado; delete m._local;
      if (k.indexOf('local-') === 0) local.apagar(CACHE_MSG + k);
      guardarMsg(m); marcarPendente(k, false); enviados++;
    } catch (e) {
      if (e.rede) break;
      toast('Não foi possível enviar “' + (m.tema || 'Sem tema') + '”: ' + textoErro(e).replace(/^CONFLITO:\s*/i, '') + (/^CONFLITO/i.test(textoErro(e)) ? ' Abra o sermão para escolher a versão.' : ''), true, null, 9000);
    }
  }
  S.sincronizando = false;
  if (enviados) {
    S.offline = false;
    toast(enviados === 1 ? '1 sermão enviado ao servidor' : enviados + ' sermões enviados ao servidor');
    if (S.view === 'lista') carregarLista();
  }
}

/* ---------- salvamento (manual e automático) ---------- */
export let autoT = null;

export function agendarAuto() {
  clearTimeout(autoT);
  if (S.view !== 'editor') return;
  autoT = setTimeout(() => { if (S.dirty && S.view === 'editor' && !S.conflito) salvar(true); }, ESPERA_AUTO);
}

/* silencioso = salvamento automático (sem aviso "Sermão salvo") */
export async function salvar(silencioso) {
  if (S.salvando) { agendarAuto(); return false; }
  clearTimeout(autoT); clearTimeout(localT);
  const m = S.msg;
  guardarMsg(m); marcarPendente(chaveMsg(m), true); // primeiro, a cópia no aparelho
  S.salvando = true; atualizarStatus();
  const rev = S.rev, copia = JSON.parse(JSON.stringify(m));
  delete copia._local;
  if (S.sobrescrever) copia._sobrescrever = true;
  let r = null, erro = null;
  try { r = await run('salvarMensagem', copia); } catch (e) { erro = e; }
  S.salvando = false; S.sobrescrever = false;
  if (r) {
    m.id = r.id; m.atualizado = r.atualizado;
    if (m._local) { local.apagar(CACHE_MSG + m._local); marcarPendente(m._local, false); delete m._local; }
    S.dirty = S.rev !== rev; // editou durante o salvamento: continua pendente
    guardarMsg(m);
    if (!S.dirty) marcarPendente(m.id, false);
    S.offline = false; atualizarStatus();
    if (S.dirty) agendarAuto(); else if (!silencioso) toast('Sermão salvo');
    return true;
  }
  if (erro && erro.rede) { // sem internet: fica no aparelho e vai depois
    S.dirty = false; S.offline = true; atualizarStatus();
    if (!silencioso) toast('Sem internet: salvo no aparelho. Envio quando a conexão voltar.');
    return 'local';
  }
  atualizarStatus();
  if (/^CONFLITO/i.test(textoErro(erro))) return resolverConflito(erro);
  falha(erro);
  if (silencioso) { clearTimeout(autoT); autoT = setTimeout(() => S.dirty && salvar(true), 15000); } // tenta de novo
  return false;
}

/* outro aparelho salvou este sermão depois que ele foi aberto aqui */
export async function resolverConflito(erro) {
  S.conflito = true;
  const motivo = textoErro(erro).replace(/^CONFLITO:\s*/i, '');
  const manter = confirm(motivo.charAt(0).toUpperCase() + motivo.slice(1)
    + '\n\nOK: manter a versão deste aparelho (a outra fica guardada em Versões).'
    + '\nCancelar: descartar as alterações daqui e abrir a versão salva.');
  S.conflito = false;
  if (manter) { S.sobrescrever = true; return salvar(); }
  S.dirty = false;
  marcarPendente(S.msg.id, false); local.apagar(CACHE_MSG + S.msg.id); // descarta a cópia deste aparelho
  await abrir(S.msg.id);
  return false;
}
