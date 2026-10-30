/* Utilidades: escape de HTML, datas, números, avisos (toast). */
import { S } from './estado.js';

export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const fmtData = iso => iso ? new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }) : '';

export const fmtHora = iso => iso ? new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '';

export const fmtDataHora = iso => iso ? new Date(iso).toLocaleString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';

export const fmtDataHoraAno = iso => iso ? new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';

export const mmss = s => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

export const fmtMin = x => x > 0 && x < 1 ? '<1' : String(Math.round(x));

export const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export const plural = (n, um, varios) => n + ' ' + (n === 1 ? um : varios);

export const textoErro = e => String((e && e.message) || e).replace(/^(Exception|Error|Erro|ScriptError):\s*/i, '');

export function autosize(el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 2 + 'px'; }

let toastT, desfazerFn = null;

/* acao = { rotulo, fn } mostra um botão (ex.: "Desfazer") */
export function toast(txt, erro, acao, ms) {
  const t = document.getElementById('toast');
  t.innerHTML = esc(txt) + (acao ? `<button class="undo" data-a="desfazer">${esc(acao.rotulo)}</button>` : '');
  desfazerFn = acao ? acao.fn : null;
  t.className = 'on' + (erro ? ' err' : '') + (acao ? ' acao' : '');
  clearTimeout(toastT);
  toastT = setTimeout(() => { t.className = ''; desfazerFn = null; }, ms || (acao ? 6000 : erro ? 5000 : 2200));
}

export const falha = e => toast(textoErro(e), true);

export const pastas = () => [...new Set(S.lista.map(m => m.pasta).filter(Boolean))].sort();

// Botão "Desfazer" do aviso.
export function desfazer() {
  const fn = desfazerFn; desfazerFn = null;
  document.getElementById('toast').className = '';
  if (fn) fn();
}
