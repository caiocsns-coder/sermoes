/* ---------------- API chamada pela página ---------------- */

const LIMITE_DADOS = 49000; // caracteres do JSON de eventos + partes numa célula

/* texto extra para a busca da lista: títulos das partes e referências bíblicas */
function textoBusca_(dados) {
  return (dados.topicos || []).map(t => [t.titulo || '']
    .concat((t.blocos || []).filter(b => b && b.tipo === 'biblico').map(b => b.ref || ''))
    .join(' ')).join(' ').replace(/\s+/g, ' ').trim().slice(0, 2000);
}

function listarMensagens() {
  return linhas_()
    .filter(r => r[0])
    .map(r => {
      let nTopicos = 0, busca = '';
      try { const d = JSON.parse(r[4] || '{}'); nTopicos = (d.topicos || []).length; busca = textoBusca_(d); } catch (e) {}
      return { id: String(r[0]), tema: String(r[1]), pasta: String(r[2]), tempo: Number(r[3]) || 30, nTopicos, atualizado: String(r[5]), busca };
    })
    .sort((a, b) => (a.atualizado < b.atualizado ? 1 : -1));
}

function obterMensagem(id) {
  const linha = linhaDoId_(id);
  if (linha < 0) throw new Error('Sermão não encontrado. Ele pode ter sido excluído em outro aparelho.');
  const r = aba_().getRange(linha, 1, 1, COLUNAS.length).getValues()[0];
  let dados;
  try { dados = JSON.parse(r[4] || '{}'); }
  catch (e) { throw new Error('Os dados deste sermão estão corrompidos na planilha (linha ' + linha + ', coluna "dados"). Abra a planilha e confira o texto da célula.'); }
  return {
    id: String(r[0]), tema: String(r[1]), pasta: String(r[2]), tempo: Number(r[3]) || 30,
    eventos: dados.eventos || [], topicos: dados.topicos || [], pregacoes: dados.pregacoes || [], opcoes: dados.opcoes || {}, atualizado: String(r[5]),
  };
}

/**
 * Salva (cria se msg.id vier vazio).
 * Proteção entre aparelhos: msg.atualizado deve ser o valor recebido ao abrir/salvar.
 * Se a planilha tiver outro valor, alguém salvou antes → erro que começa com "CONFLITO:".
 * msg._sobrescrever = true ignora a checagem (o usuário escolheu manter a versão dele).
 */
function salvarMensagem(msg) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const id = msg.id || Utilities.getUuid();
    const sh = aba_();
    const linha = msg.id ? linhaDoId_(id) : -1;
    const anterior = linha > 0 ? sh.getRange(linha, 1, 1, COLUNAS.length).getValues()[0] : null;
    if (anterior) {
      const atual = String(anterior[5]);
      const diferente = atual && msg.atualizado && atual !== String(msg.atualizado);
      if (diferente && !msg._sobrescrever) {
        const hora = Utilities.formatDate(new Date(atual), 'America/Sao_Paulo', "dd/MM 'às' HH:mm");
        throw new Error('CONFLITO: este sermão foi alterado em outro aparelho em ' + hora + '.');
      }
      /* histórico: a versão do outro aparelho, quando substituída, e o estado anterior a cada nova sessão de edição */
      if (diferente) guardarVersao_(anterior, 'substituída por outro aparelho');
      else if (Date.now() - Date.parse(atual) > INTERVALO_VERSAO) guardarVersao_(anterior, 'edição');
    }
    const atualizado = new Date().toISOString();
    const topicos = (msg.topicos || []).map(t => {
      const p = { titulo: t.titulo || '', blocos: t.blocos || [] };
      if (Number(t.tempo) > 0) p.tempo = Number(t.tempo);
      return p;
    });
    const opcoes = msg.opcoes && msg.opcoes.teleprompter ? { teleprompter: true } : {}; // preferências do sermão
    const dados = JSON.stringify({ eventos: msg.eventos || [], topicos, pregacoes: (msg.pregacoes || []).slice(-MAX_PREGACOES), opcoes });
    if (dados.length > LIMITE_DADOS) {
      throw new Error('Sermão grande demais para uma célula da planilha (' + dados.length + ' de ' + LIMITE_DADOS + ' caracteres). Divida em dois sermões ou remova imagens e textos longos.');
    }
    const valores = [[id, msg.tema || '', msg.pasta || '', String(msg.tempo || 30), dados, atualizado]];
    if (linha > 0) sh.getRange(linha, 1, 1, COLUNAS.length).setValues(valores);
    else sh.getRange(sh.getLastRow() + 1, 1, 1, COLUNAS.length).setValues(valores);
    return { id, atualizado };
  } finally {
    lock.releaseLock();
  }
}

function excluirMensagem(id) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const linha = linhaDoId_(id);
    if (linha > 0) {
      const sh = aba_();
      guardarVersao_(sh.getRange(linha, 1, 1, COLUNAS.length).getValues()[0], 'excluído'); // vai para a lixeira
      sh.deleteRow(linha);
    }
    return true;
  } finally {
    lock.releaseLock();
  }
}

function duplicarMensagem(id) {
  const m = obterMensagem(id);
  m.id = '';
  m.tema = (m.tema || 'Sem tema') + ' (cópia)';
  m.pregacoes = []; // a cópia começa sem histórico de pregações
  return salvarMensagem(m);
}
