/* Desenha a tela atual. */
import { vEditor } from './editor.js';
import { S, app } from './estado.js';
import { vLista } from './lista.js';
import { vModal } from './modais.js';
import { tick, vPregar } from './pregar.js';
import { autosize } from './util.js';

export function render() {
  app.innerHTML = S.view === 'lista' ? vLista() : S.view === 'editor' ? vEditor() : vPregar();
  document.getElementById('modal').innerHTML = vModal();
  app.querySelectorAll('textarea').forEach(autosize);
  if (S.view === 'pregar') tick();
}
