// Servidor simulado (Node): mesmas regras do Code.gs, sem planilha nem rede.
// Usado pelo tools/test.js para responder às chamadas da página à API.
const vm = require('vm');

function criarServidor(seedCode) {
  const DB = {};
  const HIST = []; // { ...sermão, guardado, motivo }
  const guardar = (m, motivo) => HIST.push(Object.assign(JSON.parse(JSON.stringify(m)), { guardado: new Date(Date.now() + HIST.length).toISOString(), motivo }));
  const estado = { sessoes: new Set(), codigos: new Set(), apiForaDoAr: false, chamadas: [] };

  function salvarMensagem(msg) {
    const atual = msg.id && DB[msg.id];
    const diferente = atual && msg.atualizado && atual.atualizado !== msg.atualizado;
    if (diferente && !msg._sobrescrever)
      throw new Error('CONFLITO: este sermão foi alterado em outro aparelho em ' + atual.atualizado.slice(11, 16) + '.');
    if (diferente) guardar(atual, 'substituída por outro aparelho');
    const id = msg.id || ('id' + Math.random().toString(36).slice(2, 8));
    const at = new Date(Date.now() + Object.keys(DB).length).toISOString();
    DB[id] = { id, tema: msg.tema, pasta: msg.pasta, tempo: msg.tempo, eventos: msg.eventos || [],
      topicos: (msg.topicos || []).map(t => { const p = { titulo: t.titulo, blocos: t.blocos }; if (Number(t.tempo) > 0) p.tempo = Number(t.tempo); return p; }),
      pregacoes: (msg.pregacoes || []).slice(-20), opcoes: msg.opcoes && msg.opcoes.teleprompter ? { teleprompter: true } : {}, atualizado: at };
    return { id, atualizado: at };
  }
  const API = {
    listarMensagens: () => Object.values(DB).map(m => ({ id: m.id, tema: m.tema, pasta: m.pasta, tempo: m.tempo, nTopicos: m.topicos.length, atualizado: m.atualizado,
      busca: m.topicos.map(t => [t.titulo].concat(t.blocos.filter(b => b.tipo === 'biblico').map(b => b.ref)).join(' ')).join(' ') }))
      .sort((a, b) => (a.atualizado < b.atualizado ? 1 : -1)),
    obterMensagem: id => { if (!DB[id]) throw new Error('Sermão não encontrado.'); return JSON.parse(JSON.stringify(DB[id])); },
    salvarMensagem,
    excluirMensagem: id => { if (DB[id]) guardar(DB[id], 'excluído'); delete DB[id]; return true; },
    duplicarMensagem: id => { const m = JSON.parse(JSON.stringify(DB[id])); m.id = ''; m.tema += ' (cópia)'; m.pregacoes = []; return salvarMensagem(m); },
    listarVersoes: id => HIST.filter(h => h.id === id && h.motivo !== 'excluído').map(h => ({ id: h.id, tema: h.tema, atualizado: h.atualizado, guardado: h.guardado, motivo: h.motivo, nTopicos: h.topicos.length })).reverse(),
    restaurarVersao: (id, guardado) => {
      const v = HIST.find(h => h.id === id && h.guardado === guardado); if (!v) throw new Error('Versão não encontrada.');
      if (DB[id]) guardar(DB[id], 'antes de restaurar');
      const at = new Date().toISOString(); DB[id] = Object.assign(JSON.parse(JSON.stringify(v)), { atualizado: at }); delete DB[id].guardado; delete DB[id].motivo;
      return { id, atualizado: at };
    },
    listarExcluidos: () => { const vistos = {}; HIST.filter(h => h.motivo === 'excluído' && !DB[h.id]).forEach(h => { vistos[h.id] = { id: h.id, tema: h.tema, guardado: h.guardado, nTopicos: h.topicos.length }; }); return Object.values(vistos).reverse(); },
    restaurarExcluido: id => {
      if (DB[id]) throw new Error('Este sermão já está na lista.');
      const v = HIST.filter(h => h.motivo === 'excluído' && h.id === id).pop(); if (!v) throw new Error('Sermão não encontrado na lixeira.');
      const at = new Date().toISOString(); DB[id] = Object.assign(JSON.parse(JSON.stringify(v)), { atualizado: at }); delete DB[id].guardado; delete DB[id].motivo;
      return { id, atualizado: at };
    },
    fazerBackup: () => ({ pasta: 'Sermões · backups / teste', sermoes: Object.keys(DB).length, url: '' }),
    listarEventos: () => [{ id: 'e1', titulo: 'Culto Divino · 174 anos ES', data: '2026-10-24T12:00:00Z' }, { id: 'e2', titulo: 'Reunião de professores', data: '2026-10-27T22:00:00Z' }],
    enviarImagem: () => 'https://example.com/x.jpg',
    buscarVersiculo: (ref, versao) => {
      if (/^ARA$/i.test(versao)) throw new Error('A versão ARA não está disponível na busca.');
      return { texto: 'Texto de teste de ' + ref, referencia: ref, versao, copyright: 'Copyright de teste' };
    },
  };

  // carrega o sermão de exemplo do Seed.gs
  const ctx = { salvarMensagem, Logger: { log() {} } };
  vm.createContext(ctx); vm.runInContext(seedCode + '\nimportarSermao174();', ctx);

  // mesmo protocolo do doPost
  function responder(req) {
    estado.chamadas.push(req.fn);
    try {
      if (req.fn === 'entrar') {
        if (req.token !== 'id-token-teste') return { ok: false, erro: 'Login inválido.', auth: true };
        const sessao = 's' + Math.random().toString(36).slice(2);
        estado.sessoes.add(sessao);
        return { ok: true, data: { sessao, exp: Date.now() + 30 * 864e5, email: 'dono@teste' } };
      }
      if (req.fn === 'gerarCodigo') {
        if (!estado.sessoes.has(req.sessao)) return { ok: false, erro: 'Sua sessão terminou. Entre de novo com o Google.', auth: true };
        const codigo = String(100000 + Math.floor(Math.random() * 900000));
        estado.codigos.add(codigo);
        return { ok: true, data: { codigo, validade: 600 } };
      }
      if (req.fn === 'entrarComCodigo') {
        if (!estado.codigos.has(String(req.codigo))) return { ok: false, erro: 'Código inválido ou vencido. Gere um novo no aparelho já conectado.', auth: true };
        estado.codigos.delete(String(req.codigo));
        const sessao = 's' + Math.random().toString(36).slice(2);
        estado.sessoes.add(sessao);
        return { ok: true, data: { sessao, exp: Date.now() + 30 * 864e5, email: 'dono@teste' } };
      }
      if (req.fn === 'sair') { estado.sessoes.delete(req.sessao); return { ok: true, data: true }; }
      if (!estado.sessoes.has(req.sessao)) return { ok: false, erro: 'Sua sessão terminou. Entre de novo com o Google.', auth: true };
      if (!API[req.fn]) throw new Error('Função desconhecida: ' + req.fn);
      return { ok: true, data: API[req.fn].apply(null, req.args || []) };
    } catch (e) { return { ok: false, erro: e.message }; }
  }
  return { DB, HIST, estado, responder };
}
module.exports = { criarServidor };
