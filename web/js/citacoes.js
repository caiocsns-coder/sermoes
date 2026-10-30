/* Citações (Ellen White e outras): colagem do EGW Writings e marca "conferida". */
import { ic } from './icones.js';

/* abreviações do EGW Writings em português mais usadas; outras ficam com o código como veio */
export const LIVROS_EGW = {
  DTN: 'O Desejado de Todas as Nações', CC: 'Caminho a Cristo', GC: 'O Grande Conflito', PP: 'Patriarcas e Profetas',
  PR: 'Profetas e Reis', AA: 'Atos dos Apóstolos', PJ: 'Parábolas de Jesus', CBV: 'A Ciência do Bom Viver',
  Ed: 'Educação', LA: 'O Lar Adventista', Ev: 'Evangelismo', ME: 'Mensagens Escolhidas', T: 'Testemunhos para a Igreja',
  OE: 'Obreiros Evangélicos', MDC: 'O Maior Discurso de Cristo', CSES: 'Conselhos sobre a Escola Sabatina',
};

export const ehEGW = b => /white|egw/i.test(b.fonte || '');

export const aConferir = b => b.tipo === 'citacao' && !!String(b.texto || '').trim() && !b.conferida;

export const nConferir = m => m.topicos.reduce((n, t) => n + t.blocos.filter(aConferir).length, 0);

export const semPagina = b => ehEGW(b) && /\S/.test(String(b.fonte).replace(/ellen g\.? white,?/i, '')) && !/\bp\.?\s*\d|\b[A-Za-z]{1,6}\s+\d+\.\d+/.test(b.fonte);

export function vCitacaoExtras(b) {
  return `<div class="citx">
    ${ehEGW(b) || !b.fonte ? `<button class="link" data-a="egwConferir">${ic('search', 14)} Conferir no EGW Writings</button>` : ''}
    <label class="chk"><input type="checkbox" data-f="conferida" ${b.conferida ? 'checked' : ''}> Conferida na fonte (texto literal e página)</label>
    ${semPagina(b) ? '<span class="warn">Falta a página na fonte.</span>' : ''}
  </div>`;
}

/* texto copiado do EGW Writings termina (ou é intercalado) com códigos como {DTN 558.2} */
export function lerColagemEGW(txt) {
  const refs = [], re = /\{\s*([A-Za-zÀ-ú0-9]{1,8})\s+(\d+)\.(\d+)\s*\}/g;
  let r;
  while ((r = re.exec(txt))) refs.push({ abrev: r[1], pag: +r[2], par: +r[3] });
  if (!refs.length) return null;
  const texto = txt.replace(re, ' ').replace(/[ \t]+\n/g, '\n').replace(/[ \t]{2,}/g, ' ').trim().replace(/^[“"]|[”"]$/g, '').trim();
  const a = refs[0], z = refs[refs.length - 1];
  const livro = LIVROS_EGW[a.abrev];
  const pags = a.pag === z.pag || a.abrev !== z.abrev ? 'p. ' + a.pag : 'p. ' + a.pag + '-' + z.pag;
  const codigo = a.abrev + ' ' + a.pag + '.' + a.par + (refs.length > 1 ? '–' + (z.abrev !== a.abrev ? z.abrev + ' ' : '') + z.pag + '.' + z.par : '');
  return { texto, fonte: 'Ellen G. White, ' + (livro ? livro + ', ' + pags + ' (' + codigo + ')' : codigo), codigo };
}
