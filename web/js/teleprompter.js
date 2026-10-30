/* Rolagem automática do texto no modo Pregar. */
import { S } from './estado.js';
import { tele } from './modelo.js';

/* velocidade: a distância a rolar dividida pelos segundos previstos para a parte, vezes o fator (0,5× a 2×).
 * Para quando o cronômetro está pausado, quando a rolagem foi pausada e por 4 s depois de um toque ou rolagem manual. */
export function teleQuadro(ts) {
  if (S.view !== 'pregar') return;
  requestAnimationFrame(teleQuadro);
  const t = S.pr.tele, c = document.getElementById('pgc');
  const dt = t.ultimo ? Math.min(0.25, (ts - t.ultimo) / 1000) : 0;
  t.ultimo = ts;
  if (!c || !tele(S.msg) || !t.rodando || !S.pr.inicio || Date.now() < t.pausaAte) return;
  const dist = c.scrollHeight - c.clientHeight;
  if (dist <= 0 || c.scrollTop >= dist) return;
  const prev = S.pr.prev[S.pr.i] && S.pr.prev[S.pr.i].min > 0 ? S.pr.prev[S.pr.i].min * 60 : 300;
  t.acc += dist / prev * t.fator * dt;
  if (t.acc >= 1) { const n = Math.floor(t.acc); t.acc -= n; t.proprio = true; c.scrollTop += n; }
}

export function telePausarToque() { if (S.view === 'pregar' && S.pr.tele) S.pr.tele.pausaAte = Date.now() + 4000; }
