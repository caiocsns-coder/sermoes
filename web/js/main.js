/* Ponto de entrada: liga os eventos (a ordem importa) e inicia o app. */
import './acoes.js';
import './eventos.js';
import { CFG } from './config.js';
import { carregarLista, sincronizar } from './dados.js';
import { registrarSW } from './eventos.js';
import { mostrarConfig } from './servidor.js';

registrarSW();

if (!CFG.api || !CFG.client) mostrarConfig();
else carregarLista().then(sincronizar);
