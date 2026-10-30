/* Estado único da página (S) e o elemento raiz (#app). */

export const S = {
  view: 'lista', lista: [], carregando: true, filtro: '',
  msg: null, dirty: false, salvando: false, rev: 0, sobrescrever: false, conflito: false,
  modal: null,
  ins: null, /* paleta "Inserir" aberta: { ti, q } */
  sel: '',   /* bloco selecionado "ti:bi" (mostra os botões de mover/remover) */
  pr: { i: 0, acum: 0, inicio: 0, marca: 0, fs: 1, tp: [], prev: [] }, timerId: null,
  wake: null, avisouTela: false,
  offline: false, sincronizando: false, /* sem conexão com o servidor; enviando pendências */
};

export const app = document.getElementById('app');
