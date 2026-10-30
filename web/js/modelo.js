/* Constantes do modelo: tempos, versões, tipos de bloco e sermão novo. */

export const TEMPOS = [20, 30, 40, 50, 60, 90, 120];

export const VERSOES = ['NBV', 'NVI', 'NVI 2011', 'BLT', 'OL', 'ARA', 'NAA'];

/* sugestões; ARA e NAA são preenchidas à mão */
export const LIMITE = 49000;

/* igual a LIMITE_DADOS no Code.gs */
export const ESPERA_AUTO = 2500;

/* ms sem digitar antes do salvamento automático */
/* A ordem aqui é a ordem da paleta "Inserir". atalho = letra depois da barra (/v, /p…) */
export const TIPOS = {
  biblico: { nome: 'Versículo',     atalho: 'v', icon: 'book',  novo: () => ({ tipo: 'biblico', ref: '', versao: 'NBV', texto: '' }) },
  texto:   { nome: 'Parágrafo',     atalho: 'p', icon: 'type',  novo: () => ({ tipo: 'texto', texto: '' }) },
  lista:   { nome: 'Lista',         atalho: 'l', icon: 'list',  novo: () => ({ tipo: 'lista', itens: [''] }) },
  citacao: { nome: 'Citação',       atalho: 'c', icon: 'quote', novo: () => ({ tipo: 'citacao', texto: '', fonte: '' }) },
  egw:     { nome: 'Citação de Ellen White', atalho: 'e', icon: 'quote', novo: () => ({ tipo: 'citacao', texto: '', fonte: 'Ellen G. White, ' }) }, // só na paleta
  imagem:  { nome: 'Imagem',        atalho: 'i', icon: 'image', novo: () => ({ tipo: 'imagem', url: '', legenda: '' }) },
  obs:     { nome: 'Nota para mim', atalho: 'n', icon: 'note',  novo: () => ({ tipo: 'obs', texto: '' }) },
};

/* _local = chave no aparelho enquanto o sermão novo não tem id do servidor */
export const tele = m => !!(m && m.opcoes && m.opcoes.teleprompter);

export const novaMsg = () => ({ id: '', _local: 'local-' + Date.now(), tema: '', pasta: '', tempo: 30, eventos: [], topicos: [{ titulo: 'Parte 1', blocos: [], _open: true }] });
