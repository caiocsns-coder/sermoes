/* Demais eventos: digitação, teclado, toque, colar, ciclo de vida e service worker. */
import { chaveMsg, guardarMsg, local, marcarPendente } from './armazenamento.js';
import { importar } from './arquivo.js';
import { buscarVers } from './biblia.js';
import { lerColagemEGW, vCitacaoExtras } from './citacoes.js';
import { abrir, carregarLista, salvar, sincronizar } from './dados.js';
import { atualizarPaleta, focar, marcar, novoBloco, selecionar, tiposFiltrados } from './editor.js';
import { S, app } from './estado.js';
import { CHAVE_HOL, hol } from './holyrics.js';
import { reduzirImagem } from './imagens.js';
import { vResultados } from './lista.js';
import { irTopico, manterTela, sairPregar } from './pregar.js';
import { render } from './render.js';
import { entrarComCodigo, run } from './servidor.js';
import { telePausarToque } from './teleprompter.js';
import { autosize, falha, toast } from './util.js';

/* tocar num bloco o seleciona (no iPad os botões ficam escondidos até isso) */
app.addEventListener('click', e => { const bl = e.target.closest && e.target.closest('.bl'); if (bl) selecionar(bl); });

app.addEventListener('focusin', e => { const bl = e.target.closest && e.target.closest('.bl'); if (bl) selecionar(bl); });

app.addEventListener('input', e => {
  const el = e.target, f = el.dataset.f;
  if (!f || f === 'arquivo' || f === 'importar') return;
  if (f === 'filtro') { S.filtro = el.value; document.getElementById('res').innerHTML = vResultados(); return; }
  if (f === 'ins') {
    const ti = +el.dataset.t;
    if (el.value.startsWith('/')) S.ins = { ti, q: el.value.slice(1).trim() };
    else if (S.ins && S.ins.ti === ti && S.ins.q) S.ins = null; // apagou a barra: fecha a paleta aberta pelo "/"
    atualizarPaleta(ti);
    return;
  }
  const m = S.msg;
  if (f === 'tema' || f === 'pasta') m[f] = el.value;
  else if (f === 'tempo') m.tempo = +el.value;
  else if (f === 'titulo') m.topicos[+el.dataset.t].titulo = el.value;
  else if (f === 'ttempo') {
    const t = m.topicos[+el.dataset.t], v = Math.round(+el.value);
    if (v > 0) t.tempo = v; else delete t.tempo;
  } else {
    const bl = el.closest('.bl'); if (!bl) return;
    const b = m.topicos[+bl.dataset.t].blocos[+bl.dataset.b];
    if (f === 'conferida') {
      if (el.checked) b.conferida = true; else delete b.conferida;
      marcar(); return;
    }
    if (f === 'item') b.itens[+el.dataset.li] = el.value; else b[f] = el.value;
    if (b.tipo === 'citacao' && (f === 'texto' || f === 'fonte')) {
      if (b.conferida) { delete b.conferida; const c = bl.querySelector('[data-f="conferida"]'); if (c) c.checked = false; }
      if (f === 'fonte') { const x = bl.querySelector('.citx'); if (x) x.outerHTML = vCitacaoExtras(b); }
    }
  }
  if (el.tagName === 'TEXTAREA') autosize(el);
  marcar();
});

app.addEventListener('paste', e => {
  const el = e.target, bl = el.closest && el.closest('.bl.t-citacao');
  if (!bl || el.dataset.f !== 'texto' || !e.clipboardData) return;
  const lido = lerColagemEGW(e.clipboardData.getData('text/plain') || '');
  if (!lido) return;
  const b = S.msg.topicos[+bl.dataset.t].blocos[+bl.dataset.b];
  e.preventDefault();
  const ini = el.selectionStart, fim = el.selectionEnd;
  b.texto = (b.texto || '').slice(0, ini) + lido.texto + (b.texto || '').slice(fim);
  if (!String(b.fonte || '').replace(/ellen g\.? white,?\s*/i, '').trim()) b.fonte = lido.fonte;
  delete b.conferida;
  marcar(); render();
  toast('Referência reconhecida: ' + lido.codigo + '. Confira o texto e marque "Conferida na fonte".', false, null, 6000);
});

app.addEventListener('keydown', e => {
  const el = e.target, f = el.dataset && el.dataset.f;
  /* o tema é uma linha só, mesmo sendo textarea */
  if (f === 'tema' && e.key === 'Enter') { e.preventDefault(); el.blur(); return; }
  /* Enter na referência ou na versão de um Versículo busca o texto */
  if ((f === 'ref' || f === 'versao') && e.key === 'Enter') {
    e.preventDefault();
    const bl = el.closest('.bl');
    buscarVers(S.msg.topicos[+bl.dataset.t].blocos[+bl.dataset.b], bl.querySelector('[data-a="buscarVers"]'));
    return;
  }
  /* campo "Escreva aqui ou digite /": Enter cria o bloco */
  if (f === 'ins') {
    const ti = +el.dataset.t, v = el.value;
    if (e.key === 'Enter') {
      e.preventDefault();
      if (v.startsWith('/')) { const k = tiposFiltrados(v.slice(1).trim())[0]; if (k) novoBloco(ti, k); }
      else if (v.trim()) novoBloco(ti, 'texto', v.trim());
      else if (S.ins && S.ins.ti === ti) { const k = tiposFiltrados(S.ins.q)[0]; if (k) novoBloco(ti, k); }
    } else if (e.key === 'Escape' && S.ins) {
      e.stopPropagation(); S.ins = null; el.value = ''; atualizarPaleta(ti);
    }
    return;
  }
  /* Enter numa lista cria o próximo item; Backspace num item vazio apaga */
  if (f === 'item') {
    const bl = el.closest('.bl'), ti = +bl.dataset.t, bi = +bl.dataset.b, li = +el.dataset.li;
    const b = S.msg.topicos[ti].blocos[bi];
    if (e.key === 'Enter') {
      e.preventDefault(); b.itens.splice(li + 1, 0, ''); marcar(); render();
      focar(`.bl[data-t="${ti}"][data-b="${bi}"] [data-li="${li + 1}"]`);
    } else if (e.key === 'Backspace' && el.value === '' && b.itens.length > 1) {
      e.preventDefault(); b.itens.splice(li, 1); marcar(); render();
      focar(`.bl[data-t="${ti}"][data-b="${bi}"] [data-li="${Math.max(0, li - 1)}"]`);
    }
  }
});

app.addEventListener('change', async e => {
  const el = e.target;
  if (el.dataset.f === 'importar') { const f = el.files[0]; el.value = ''; if (f) importar(f); return; }
  if (el.dataset.f !== 'arquivo' || !el.files[0]) return;
  const bl = el.closest('.bl'), b = S.msg.topicos[+bl.dataset.t].blocos[+bl.dataset.b];
  try {
    toast('Enviando imagem…');
    const dataUrl = await reduzirImagem(el.files[0]);
    b.url = await run('enviarImagem', dataUrl, el.files[0].name.replace(/\.\w+$/, '') + '.jpg');
    marcar(); render(); toast('Imagem enviada');
  } catch (err) { falha(err); }
});

document.addEventListener('change', e => {
  const k = e.target && e.target.dataset && e.target.dataset.hol;
  if (!k) return;
  const h = hol(); h[k] = e.target.checked; if (!h.ativo) h.telao = false;
  local.gravar(CHAVE_HOL, h); render();
});

/* atalhos de teclado */
document.addEventListener('keydown', e => {
  if (e.target && e.target.id === 'lcodigo' && e.key === 'Enter') { e.preventDefault(); entrarComCodigo(); return; }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's' && S.view === 'editor') { e.preventDefault(); salvar(); }
  if (e.key === 'Enter' && e.target.classList && e.target.classList.contains('card') && e.target.dataset.a === 'abrir') abrir(e.target.dataset.id);
  if (S.view === 'pregar') {
    if (e.key === 'ArrowRight' || e.key === 'PageDown') irTopico(S.pr.i + 1);
    if (e.key === 'ArrowLeft' || e.key === 'PageUp') irTopico(S.pr.i - 1);
    if (e.key === 'Escape') { sairPregar(); return; } // não deixa o mesmo Esc fechar o resumo da pregação
  }
  if (e.key === 'Escape' && S.modal) { S.modal = null; render(); }
  else if (e.key === 'Escape' && S.ins) { const ti = S.ins.ti; S.ins = null; atualizarPaleta(ti); }
});

/* deslizar para trocar de parte no modo Pregar */
export let toqueX = null, toqueY = null;

app.addEventListener('touchstart', e => { if (S.view === 'pregar') { toqueX = e.touches[0].clientX; toqueY = e.touches[0].clientY; telePausarToque(); } }, { passive: true });

app.addEventListener('wheel', telePausarToque, { passive: true });

app.addEventListener('scroll', e => {
  if (S.view !== 'pregar' || !S.pr.tele || e.target.id !== 'pgc') return;
  if (S.pr.tele.proprio) S.pr.tele.proprio = false; else telePausarToque();
}, { passive: true, capture: true });

app.addEventListener('touchend', e => {
  if (S.view !== 'pregar' || toqueX === null) return;
  const dx = e.changedTouches[0].clientX - toqueX, dy = e.changedTouches[0].clientY - toqueY;
  if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.5) irTopico(S.pr.i + (dx < 0 ? 1 : -1));
  toqueX = null;
});

/* ao sair do app (trocar de aba, bloquear o iPad): salva já; ao voltar ao Pregar: pede a tela acesa de novo */
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden' && S.msg && S.view !== 'lista' && S.dirty) { guardarMsg(S.msg); marcarPendente(chaveMsg(S.msg), true); salvar(true); }
  if (document.visibilityState === 'visible') { if (S.view === 'pregar') manterTela(); sincronizar(); }
});

/* ao fechar: a cópia no aparelho já basta (é enviada na próxima abertura); sem aviso de "sair da página" */
window.addEventListener('pagehide', () => { if (S.msg && S.view !== 'lista' && S.dirty) { guardarMsg(S.msg); marcarPendente(chaveMsg(S.msg), true); } });

window.addEventListener('online', () => { S.offline = false; sincronizar(); if (S.view === 'lista') carregarLista(); });

window.addEventListener('offline', () => { S.offline = true; if (S.view === 'lista') render(); });

/* app instalável e com cópia das telas no aparelho (só em https: no GitHub Pages) */
export function registrarSW() {
  try { if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {}); } catch (e) {}
}
