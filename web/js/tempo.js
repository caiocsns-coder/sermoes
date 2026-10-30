/* Tempo por parte, ritmo pessoal e tamanho do sermão. */
import { local } from './armazenamento.js';

/* palavras faladas da parte (notas para mim não contam) */
export function palavras(t) {
  return (t.blocos || []).reduce((n, b) => {
    if (b.tipo === 'obs') return n;
    const s = [b.texto, b.fonte, b.legenda].concat(b.itens || []).filter(Boolean).join(' ').trim();
    return n + (s ? s.split(/\s+/).length : 0);
  }, 0);
}

/* minutos de cada parte: o definido pelo usuário, ou a sobra do alvo dividida pelo volume de texto */
export function temposPartes(m) {
  const ts = m.topicos;
  const fixo = ts.reduce((s, t) => s + (t.tempo > 0 ? +t.tempo : 0), 0);
  const peso = t => Math.max(15, palavras(t));
  const pesoLivre = ts.filter(t => !(t.tempo > 0)).reduce((s, t) => s + peso(t), 0);
  const resto = Math.max(0, (m.tempo || 30) - fixo);
  return ts.map(t => t.tempo > 0 ? { min: +t.tempo, est: false } : { min: pesoLivre ? resto * peso(t) / pesoLivre : 0, est: true });
}

/* ritmo pessoal (palavras por minuto), aprendido nas pregações registradas neste aparelho */
export const CACHE_RITMO = 'sermoes.ritmo';

/* só depois de 10 minutos de pregação registrada, para não projetar o sermão inteiro com poucos dados */
export function ritmo() { const r = local.ler(CACHE_RITMO); return r && r.seg >= 600 ? r.pal / (r.seg / 60) : 0; }

export function aprenderRitmo(reg) {
  let pal = 0, seg = 0;
  reg.partes.forEach(p => { if (p.seg >= 30 && p.palavras >= 20) { pal += p.palavras; seg += p.seg; } });
  if (seg < 60) return;
  const r = local.ler(CACHE_RITMO) || { pal: 0, seg: 0 };
  local.gravar(CACHE_RITMO, { pal: r.pal * 0.6 + pal, seg: r.seg * 0.6 + seg }); // pregações recentes pesam mais
}

/* tamanho do JSON que o servidor grava (mesma forma do salvarMensagem) */
export function tamanho(m) {
  return JSON.stringify({ eventos: m.eventos || [], topicos: m.topicos.map(t => {
    const p = { titulo: t.titulo || '', blocos: t.blocos || [] };
    if (t.tempo > 0) p.tempo = +t.tempo;
    return p;
  }) }).length;
}
