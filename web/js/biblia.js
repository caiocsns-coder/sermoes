/* Busca de versículos no YouVersion (pelo servidor). */
import { marcar } from './editor.js';
import { render } from './render.js';
import { run } from './servidor.js';
import { falha, toast } from './util.js';

/* Busca o texto do bloco Versículo no YouVersion (pelo servidor) */
export async function buscarVers(B, btn) {
  if (!B || B.tipo !== 'biblico') return;
  if (!String(B.ref || '').trim()) { toast('Escreva a referência primeiro (ex.: Mateus 24:45-47).', true); return; }
  if (String(B.texto || '').trim() && !confirm('Substituir o texto atual pelo texto do YouVersion?')) return;
  if (!String(B.versao || '').trim()) B.versao = 'NBV';
  if (btn) { btn.disabled = true; btn.lastChild.textContent = ' Buscando…'; }
  try {
    const r = await run('buscarVersiculo', B.ref, B.versao);
    B.texto = r.texto; B.copyright = r.copyright || '';
    if (r.referencia) B.ref = r.referencia; // forma oficial, ex.: "Hebreus 10:24-25"
    marcar(); render(); toast('Texto preenchido' + (r.referencia ? ': ' + r.referencia : ''));
  } catch (e) {
    falha(e);
    if (btn && btn.isConnected) { btn.disabled = false; btn.lastChild.textContent = ' Buscar'; }
  }
}
