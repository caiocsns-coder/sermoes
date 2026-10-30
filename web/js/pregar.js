/* Modo Pregar: tela, leitura dos blocos, cronômetro, registro da pregação e tela acesa. */
import { aConferir } from './citacoes.js';
import { marcar } from './editor.js';
import { S } from './estado.js';
import { hol, telaoFim, telaoInicio, telaoParte } from './holyrics.js';
import { ic } from './icones.js';
import { tele } from './modelo.js';
import { render } from './render.js';
import { teleQuadro } from './teleprompter.js';
import { aprenderRitmo, palavras, temposPartes } from './tempo.js';
import { esc, fmtMin, mmss, toast } from './util.js';

export function vPregar() {
  const m = S.msg, n = m.topicos.length, i = S.pr.i, t = m.topicos[i] || { titulo: '', blocos: [] };
  const prox = m.topicos[i + 1], prev = S.pr.prev;
  return `
  <div class="pg" style="--fs:${S.pr.fs}">
    <header class="pgbar">
      <button class="ic fill" data-a="sairPregar" title="Sair" aria-label="Sair do modo Pregar">${ic('x', 20)}</button>
      <div class="pgtema">${esc(m.tema)}</div>
      ${tele(m) ? `<div class="telec">
        <button class="ic fill" data-a="teleRolar" id="telebtn" title="Pausar ou continuar a rolagem" aria-label="Pausar ou continuar a rolagem">${ic(S.pr.tele.rodando ? 'pause' : 'play', 16)}</button>
        <button class="ic fill fs" data-a="teleVel" data-v="-1" title="Rolagem mais lenta" aria-label="Rolagem mais lenta">−</button>
        <span class="televel" id="televel">${S.pr.tele.fator.toFixed(1).replace('.', ',')}×</span>
        <button class="ic fill fs" data-a="teleVel" data-v="1" title="Rolagem mais rápida" aria-label="Rolagem mais rápida">+</button>
      </div>` : ''}
      ${hol().ativo ? `<button class="hlimpar" data-a="hLimpar" title="Tirar a projeção do Holyrics">${ic('cast', 15)} Limpar tela</button>` : ''}
      <button class="ic fill fs" data-a="fonte" data-v="-1" title="Diminuir letra" aria-label="Diminuir letra">A−</button>
      <button class="ic fill fs" data-a="fonte" data-v="1" title="Aumentar letra" aria-label="Aumentar letra">A+</button>
    </header>
    <main class="pgc ${tele(m) ? 'tele' : ''}" id="pgc">
      <div class="pgk">Parte ${i + 1} de ${n}</div>
      <h1 class="pgt">${esc(t.titulo || 'Parte ' + (i + 1))}</h1>
      ${t.blocos.map((b, k) => vLeitura(b, k)).join('')}
    </main>
    <footer class="pgf">
      <div class="seg">
        ${m.topicos.map((tp, k) => `<button class="${k < i ? 'feito' : k === i ? 'on' : ''}" style="flex:${Math.max(0.5, prev[k] ? prev[k].min : 1)}" data-a="pgIr" data-v="${k}" title="${esc(tp.titulo || 'Parte ' + (k + 1))}">${k === i ? (k + 1) + ' · ' + esc(tp.titulo || 'Parte ' + (k + 1)) : k + 1}</button>`).join('')}
        <span id="playhead"></span>
      </div>
      <div class="pgnav">
        <button class="timer" id="timer" data-a="timer" title="Pausar / continuar" aria-label="Pausar ou continuar o cronômetro"></button>
        <span class="tparte" id="tparte"></span>
        <div class="sp"></div>
        <button class="pv" data-a="pgIr" data-v="${i - 1}" ${i === 0 ? 'disabled' : ''} aria-label="Parte anterior">${ic('chevL', 22)}</button>
        <button class="nx" data-a="pgIr" data-v="${i + 1}" ${prox ? '' : 'disabled'}><span>${prox ? esc(prox.titulo || 'Parte ' + (i + 2)) : 'Última parte'}</span>${ic('chevR', 20)}</button>
      </div>
    </footer>
  </div>`;
}

/* botão discreto "Projetar" (só com o Holyrics ligado neste aparelho; tocar no texto não projeta) */
export const vProjetar = k => hol().ativo && S.view === 'pregar' ? `<button class="hproj" data-a="hProjetar" data-k="${k}" title="Projetar no Holyrics">${ic('cast', 14)} Projetar</button>` : '';

export function vLeitura(b, k) {
  switch (b.tipo) {
    case 'biblico': return `<div class="r-bib"><div class="r-ref">${esc(b.ref)}${b.versao ? `<span>${esc(b.versao)}</span>` : ''}${b.ref ? vProjetar(k) : ''}</div><p>${esc(b.texto)}</p>${b.copyright ? `<small class="r-copy">${esc(b.copyright)}</small>` : ''}</div>`;
    case 'lista': return `<ul class="r-list">${(b.itens || []).filter(x => x.trim()).map(x => `<li>${esc(x)}</li>`).join('')}</ul>`;
    case 'citacao': return `<blockquote class="r-cit">${b.texto ? vProjetar(k) : ''}<p>“${esc(b.texto)}”</p>${b.fonte || aConferir(b) ? `<cite>${esc(b.fonte)}${aConferir(b) ? '<span class="r-conf">conferir</span>' : ''}</cite>` : ''}</blockquote>`;
    case 'imagem': return b.url ? `<figure class="r-img"><img src="${esc(b.url)}" alt="">${b.legenda ? `<figcaption>${esc(b.legenda)}</figcaption>` : ''}</figure>` : '';
    case 'obs': return b.texto ? `<div class="r-obs"><b>Nota ·</b>${esc(b.texto)}</div>` : '';
    default: return b.texto ? `<p class="r-txt">${esc(b.texto)}</p>` : '';
  }
}

export async function manterTela() {
  try {
    if ('wakeLock' in navigator && !S.wake) {
      S.wake = await navigator.wakeLock.request('screen');
      S.wake.addEventListener('release', () => { S.wake = null; });
    }
    return !!S.wake;
  } catch (e) { return false; }
}

export function soltarTela() { try { if (S.wake) S.wake.release(); } catch (e) {} S.wake = null; }

export function tempoDecorrido() { return S.pr.acum + (S.pr.inicio ? Date.now() - S.pr.inicio : 0); }

/* soma ao tempo da parte atual o que passou desde a última marca */
export function fecharParte() {
  if (!S.pr.inicio) return;
  const agora = Date.now();
  S.pr.tp[S.pr.i] = (S.pr.tp[S.pr.i] || 0) + agora - S.pr.marca;
  S.pr.marca = agora;
}

export function tick() {
  const el = document.getElementById('timer');
  if (!el) return;
  const s = Math.floor(tempoDecorrido() / 1000), alvo = (S.msg.tempo || 30) * 60;
  el.innerHTML = `<b>${mmss(s)}</b><small>de ${mmss(alvo)}</small>`;
  el.className = 'timer' + (s > alvo ? ' over' : s > alvo * 0.85 ? ' warn' : '') + (S.pr.inicio ? '' : ' paused');
  const ph = document.getElementById('playhead');
  if (ph) { ph.style.left = Math.min(100, s / alvo * 100) + '%'; ph.className = s > alvo ? 'over' : ''; }
  const tp = document.getElementById('tparte');
  if (tp) {
    const i = S.pr.i, prev = S.pr.prev[i] ? S.pr.prev[i].min : 0;
    const sp = Math.floor(((S.pr.tp[i] || 0) + (S.pr.inicio ? Date.now() - S.pr.marca : 0)) / 1000);
    tp.innerHTML = `Nesta parte <b>${mmss(sp)}</b>${prev ? ` de ${fmtMin(prev)} min` : ''}`;
    tp.className = 'tparte' + (prev && sp > prev * 60 ? ' warn' : '');
  }
}

export function entrarPregar() {
  const agora = Date.now();
  S.pr = { i: 0, acum: 0, inicio: agora, marca: agora, fs: S.pr.fs || 1, tp: [], prev: temposPartes(S.msg),
    tele: { rodando: true, fator: (S.pr.tele && S.pr.tele.fator) || 1, pausaAte: 0, acc: 0, ultimo: 0 } };
  S.ins = null; S.view = 'pregar'; render();
  clearInterval(S.timerId); S.timerId = setInterval(tick, 500);
  if (tele(S.msg)) { S.pr.tele.pausaAte = Date.now() + 3000; requestAnimationFrame(teleQuadro); } // 3 s para começar
  telaoInicio();
  manterTela().then(ok => {
    if (!ok && !S.avisouTela) {
      S.avisouTela = true;
      toast('Este navegador não deixou manter a tela acesa. No iPad: Ajustes → Tela e Brilho → Bloqueio Automático → Nunca.', false, null, 8000);
    }
  });
}

/* ao sair do Pregar (depois de 1 minuto ou mais), guarda o tempo real de cada parte no sermão */
export function registrarPregacao() {
  fecharParte();
  const total = Math.floor(tempoDecorrido() / 1000);
  if (total < 60) return null;
  const m = S.msg, prev = S.pr.prev, hoje = new Date().toDateString();
  const reg = { data: new Date().toISOString(), alvo: m.tempo, total,
    partes: m.topicos.map((t, k) => ({ titulo: t.titulo || 'Parte ' + (k + 1), seg: Math.round((S.pr.tp[k] || 0) / 1000),
      prev: prev[k] ? Math.round(prev[k].min * 10) / 10 : 0, palavras: palavras(t) })) };
  const culto = (m.eventos || []).find(e => e.data && new Date(e.data).toDateString() === hoje);
  if (culto) reg.culto = culto.titulo;
  m.pregacoes = (m.pregacoes || []).concat([reg]).slice(-20);
  aprenderRitmo(reg);
  return reg;
}

export function sairPregar() {
  telaoFim();
  clearInterval(S.timerId); soltarTela();
  S.view = 'editor';
  const reg = registrarPregacao();
  if (reg) { S.modal = { tipo: 'pregacao', i: S.msg.pregacoes.length - 1, novo: true }; marcar(); }
  render();
}

export function irTopico(k) {
  const n = S.msg.topicos.length;
  if (k < 0 || k >= n) return;
  fecharParte();
  S.pr.i = k; render();
  const c = document.getElementById('pgc'); if (c) c.scrollTop = 0;
  if (S.pr.tele) { S.pr.tele.acc = 0; S.pr.tele.pausaAte = Date.now() + 2000; } // respiro no começo da parte
  telaoParte();
}
