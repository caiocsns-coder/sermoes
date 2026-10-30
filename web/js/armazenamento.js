/* Cópia dos sermões no aparelho (localStorage): lista, sermões, pendências e poda. */
import { toast } from './util.js';

/* localStorage pode falhar (navegação privada, espaço cheio): tudo protegido */
export const local = {
  ler(k) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch (e) { return null; } },
  gravar(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } },
  apagar(k) { try { localStorage.removeItem(k); } catch (e) {} },
};

export const CHAVE_SESSAO = 'sermoes.sessao', CACHE_LISTA = 'sermoes.lista', CACHE_MSG = 'sermoes.msg.', CACHE_PEND = 'sermoes.pend';

export const chaveMsg = m => m.id || m._local;

export const pendentes = () => local.ler(CACHE_PEND) || [];

export function marcarPendente(chave, sim) {
  if (!chave) return;
  const p = new Set(pendentes());
  if (sim) p.add(chave); else p.delete(chave);
  local.gravar(CACHE_PEND, [...p]);
}

/* o aparelho guarda no máximo MAX_CACHE sermões (os usados mais recentemente); pendentes nunca são apagados */
export const CACHE_USO = 'sermoes.uso', MAX_CACHE = 40;

export function liberarEspaco(qtd) {
  const uso = local.ler(CACHE_USO) || {}, pend = new Set(pendentes());
  const livres = Object.keys(uso).filter(k => !pend.has(k)).sort((a, b) => uso[a] - uso[b]);
  const sobra = Math.max(qtd || 0, Object.keys(uso).length - MAX_CACHE);
  livres.slice(0, sobra).forEach(k => { delete uso[k]; local.apagar(CACHE_MSG + k); });
  local.gravar(CACHE_USO, uso);
}

export function guardarMsg(m) {
  const c = JSON.parse(JSON.stringify(m)), chave = chaveMsg(m);
  c.topicos.forEach(t => delete t._open);
  let ok = local.gravar(CACHE_MSG + chave, c);
  if (!ok) { liberarEspaco(10); ok = local.gravar(CACHE_MSG + chave, c); } // espaço cheio: apaga os menos usados e tenta de novo
  if (!ok) return toast('Não consegui guardar uma cópia no aparelho (espaço cheio).', true);
  const uso = local.ler(CACHE_USO) || {};
  uso[chave] = Date.now(); local.gravar(CACHE_USO, uso);
  if (Object.keys(uso).length > MAX_CACHE) liberarEspaco(0);
}
