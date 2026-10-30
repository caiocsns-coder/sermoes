/* Importar e exportar .sermao.json (formato sermoes/1). */
import { marcar } from './editor.js';
import { S } from './estado.js';
import { LIMITE, TEMPOS, TIPOS, tele } from './modelo.js';
import { render } from './render.js';
import { tamanho } from './tempo.js';
import { falha, norm, plural, toast } from './util.js';

/* Arquivo: { formato: 'sermoes/1', exportado: ISO, sermao: { tema, pasta, tempo, topicos } }
 * Também aceita o objeto do sermão "solto" (sem o envelope). Ver CONTEXT.md, "Arquivo .sermao.json". */
export const FORMATO = 'sermoes/1';

export const str = v => typeof v === 'string' ? v : v == null ? '' : String(v);

export const slug = s => norm(s).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'sermao';

export function paraArquivo(m) {
  return { formato: FORMATO, exportado: new Date().toISOString(), sermao: {
    tema: m.tema || '', pasta: m.pasta || '', tempo: m.tempo || 30, opcoes: tele(m) ? { teleprompter: true } : {},
    topicos: m.topicos.map(t => {
      const p = { titulo: t.titulo || '' };
      if (t.tempo > 0) p.tempo = +t.tempo;
      p.blocos = JSON.parse(JSON.stringify(t.blocos || []));
      return p;
    }),
  } };
}

/* iPad: abre a folha de compartilhamento (Salvar em Arquivos, AirDrop, e-mail…); computador: baixa o arquivo */
export async function exportar() {
  const m = S.msg, nome = slug(m.tema) + '.sermao.json';
  const arq = new File([JSON.stringify(paraArquivo(m), null, 2)], nome, { type: 'application/json' });
  try {
    if (navigator.canShare && navigator.canShare({ files: [arq] })) { await navigator.share({ files: [arq], title: m.tema || 'Sermão' }); return; }
  } catch (e) { if (e && e.name === 'AbortError') return; }
  const url = URL.createObjectURL(arq), a = document.createElement('a');
  a.href = url; a.download = nome; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  toast('Arquivo ' + nome + ' baixado');
}

/* aceita só os campos conhecidos de cada tipo; tipo desconhecido com texto vira Parágrafo, sem texto é ignorado */
export function normalizarBloco(b) {
  if (!b || !TIPOS[b.tipo] || b.tipo === 'egw') return b && typeof b.texto === 'string' ? { tipo: 'texto', texto: b.texto } : null;
  switch (b.tipo) {
    case 'biblico': { const x = { tipo: 'biblico', ref: str(b.ref), versao: str(b.versao) || 'NBV', texto: str(b.texto) }; if (b.copyright) x.copyright = str(b.copyright); return x; }
    case 'lista': { const itens = Array.isArray(b.itens) ? b.itens.map(str) : []; return { tipo: 'lista', itens: itens.length ? itens : [''] }; }
    case 'citacao': { const x = { tipo: 'citacao', texto: str(b.texto), fonte: str(b.fonte) }; if (b.conferida === true) x.conferida = true; return x; }
    case 'imagem': return { tipo: 'imagem', url: str(b.url), legenda: str(b.legenda) };
    default: return { tipo: b.tipo, texto: str(b.texto) };
  }
}

/* lê e confere o arquivo; devolve { msg, avisos } ou lança um erro em português */
export function lerArquivoSermao(texto) {
  let d;
  try { d = JSON.parse(texto); } catch (e) { throw new Error('O arquivo não é um JSON válido.'); }
  if (d && d.formato) {
    const v = String(d.formato).match(/^sermoes\/(\d+)$/);
    if (!v) throw new Error('Formato de arquivo desconhecido: ' + d.formato + '.');
    if (+v[1] > 1) throw new Error('Este arquivo é de uma versão mais nova do app (' + d.formato + '). Atualize o app e tente de novo.');
  }
  const s = d && d.sermao ? d.sermao : d;
  if (!s || !Array.isArray(s.topicos) || !s.topicos.length) throw new Error('O arquivo não tem as partes do sermão ("topicos").');
  const avisos = [];
  let tempo = Math.round(+s.tempo) || 30;
  if (TEMPOS.indexOf(tempo) < 0) {
    const perto = TEMPOS.reduce((a, b) => Math.abs(b - tempo) < Math.abs(a - tempo) ? b : a);
    avisos.push('Tempo de ' + tempo + ' min ajustado para ' + perto + ' min.'); tempo = perto;
  }
  let ignorados = 0;
  const topicos = s.topicos.map((t, i) => {
    const p = { titulo: str(t && t.titulo) || 'Parte ' + (i + 1), blocos: [] };
    if (t && +t.tempo > 0) p.tempo = Math.round(+t.tempo);
    (t && Array.isArray(t.blocos) ? t.blocos : []).forEach(b => { const x = normalizarBloco(b); if (x) p.blocos.push(x); else ignorados++; });
    return p;
  });
  if (ignorados) avisos.push(plural(ignorados, 'bloco de tipo desconhecido foi ignorado.', 'blocos de tipo desconhecido foram ignorados.'));
  const msg = { id: '', _local: 'local-' + Date.now(), tema: str(s.tema).trim() || 'Sermão importado', pasta: str(s.pasta).trim(), tempo, eventos: [], topicos,
    opcoes: s.opcoes && s.opcoes.teleprompter ? { teleprompter: true } : {} };
  const tam = tamanho(msg);
  if (tam > LIMITE) throw new Error('Sermão grande demais para importar (' + tam + ' de ' + LIMITE + ' caracteres). Divida em dois arquivos.');
  return { msg, avisos };
}

/* abre o sermão importado no editor; o salvamento automático cuida do resto (também sem internet) */
export async function importar(arquivo) {
  let r;
  try { r = lerArquivoSermao(await arquivo.text()); } catch (e) { return falha(e); }
  const m = r.msg;
  if (S.lista.some(x => norm(x.tema) === norm(m.tema))) {
    if (!confirm('Já existe um sermão com o tema “' + m.tema + '”. Importar mesmo assim, como cópia?')) return;
    m.tema += ' (importado)';
  }
  m.topicos.forEach((t, i) => t._open = i === 0);
  S.msg = m; S.dirty = false; S.ins = null; S.sel = ''; S.view = 'editor'; render(); window.scrollTo(0, 0);
  marcar();
  const semTexto = m.topicos.reduce((n, t) => n + t.blocos.filter(b => b.tipo === 'biblico' && !b.texto.trim()).length, 0);
  toast(['Importado: ' + plural(m.topicos.length, 'parte', 'partes') + '.']
    .concat(semTexto ? [plural(semTexto, 'versículo está', 'versículos estão') + ' sem texto: toque em Buscar.'] : [])
    .concat(r.avisos).join(' '), false, null, 9000);
}
