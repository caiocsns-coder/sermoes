/* Cliques em [data-a] (todas as ações da interface). */
import { CACHE_MSG, CHAVE_SESSAO, local, marcarPendente } from './armazenamento.js';
import { exportar } from './arquivo.js';
import { buscarVers } from './biblia.js';
import { abrir, autoT, carregarLista, salvar } from './dados.js';
import { atualizarPaleta, focar, marcar, novoBloco } from './editor.js';
import { S } from './estado.js';
import { enviarHolyrics } from './holyrics.js';
import { ic } from './icones.js';
import { TIPOS, novaMsg, tele } from './modelo.js';
import { entrarPregar, fecharParte, irTopico, sairPregar, tick } from './pregar.js';
import { render } from './render.js';
import { chamar, desistirLogin, entrarComCodigo, esconderLogin, lerSessao, run, vEntrarCodigo } from './servidor.js';
import { desfazer, falha, fmtDataHoraAno, plural, textoErro, toast } from './util.js';

document.addEventListener('click', async e => {
  const el = e.target.closest('[data-a]');
  if (!el || el.disabled) return;
  if (el.classList.contains('ov') && e.target !== el) return; // clique dentro do modal
  const a = el.dataset.a, m = S.msg;
  const bl = el.closest('.bl');
  const ti = el.dataset.t != null ? +el.dataset.t : bl ? +bl.dataset.t : -1;
  const bi = bl ? +bl.dataset.b : -1;
  const T = ti >= 0 && m ? m.topicos[ti] : null;
  const B = T && bi >= 0 ? T.blocos[bi] : null;
  const swap = (arr, i, j) => { [arr[i], arr[j]] = [arr[j], arr[i]]; };

  switch (a) {
    case 'holyrics': S.modal = { tipo: 'holyrics' }; render(); break;
    case 'hTestar': {
      const r = document.getElementById('hres'); if (r) { r.className = 'muted'; r.textContent = 'Testando…'; }
      try { await run('testarHolyrics'); if (r) { r.className = 'ok'; r.textContent = 'Conectado, com todas as permissões.'; } }
      catch (err) { if (r) { r.className = 'err'; r.textContent = textoErro(err); } }
      break;
    }
    case 'hProjetar': {
      const b = m.topicos[S.pr.i].blocos[+el.dataset.k];
      if (b.tipo === 'biblico') enviarHolyrics('ShowVerse', { references: b.ref, version: b.versao || undefined, quick_presentation: true }, 'Projetando ' + b.ref);
      else enviarHolyrics('ShowQuickPresentation', { text: b.texto + (b.fonte ? '\n\n— ' + b.fonte.replace(/\s*\([^)]*\)\s*$/, '') : '') }, 'Projetando a citação');
      break;
    }
    case 'hLimpar': enviarHolyrics('CloseCurrentPresentation', {}, 'Projeção encerrada'); break;
    case 'lixeira':
      S.modal = { tipo: 'lixeira', itens: null }; render();
      try { S.modal.itens = await run('listarExcluidos'); } catch (err) { S.modal = null; falha(err); }
      render(); break;
    case 'restaurarExcluido': {
      const v = S.modal.itens[+el.dataset.i];
      try { await run('restaurarExcluido', v.id); S.modal = null; toast('“' + (v.tema || 'Sem tema') + '” voltou para a lista'); carregarLista(); }
      catch (err) { falha(err); }
      break;
    }
    case 'backup':
      toast('Fazendo backup no Drive…');
      try {
        const r = await run('fazerBackup');
        toast('Backup feito: ' + plural(r.sermoes, 'sermão', 'sermões') + ' em ' + r.pasta, false, r.url ? { rotulo: 'Abrir', fn: () => window.open(r.url, '_blank') } : null, 9000);
      } catch (err) { falha(err); }
      break;
    case 'versoes':
      if (!m.id) return toast('Este sermão ainda não foi salvo no servidor.', true);
      S.modal = { tipo: 'versoes', itens: null }; render();
      try { S.modal.itens = await run('listarVersoes', m.id); } catch (err) { S.modal = null; falha(err); }
      render(); break;
    case 'restaurarVersao': {
      const v = S.modal.itens[+el.dataset.i];
      if (!confirm('Voltar para a versão de ' + fmtDataHoraAno(v.atualizado) + '? A versão atual fica guardada no histórico.')) return;
      if (S.dirty && (await salvar(true)) !== true) return toast('Salve as alterações (com internet) antes de restaurar.', true);
      try {
        await run('restaurarVersao', m.id, v.guardado);
        S.modal = null; marcarPendente(m.id, false); local.apagar(CACHE_MSG + m.id);
        await abrir(m.id); toast('Versão restaurada');
      } catch (err) { falha(err); }
      break;
    }
    case 'teleprompter':
      m.opcoes = Object.assign({}, m.opcoes, { teleprompter: !tele(m) });
      if (!m.opcoes.teleprompter) delete m.opcoes.teleprompter;
      marcar(); render(); toast(tele(m) ? 'Teleprompter ligado: o texto vai rolar sozinho no modo Pregar.' : 'Teleprompter desligado.'); break;
    case 'teleRolar': {
      const t = S.pr.tele; t.rodando = !t.rodando; t.pausaAte = 0;
      const b = document.getElementById('telebtn'); if (b) b.innerHTML = ic(t.rodando ? 'pause' : 'play', 16);
      break;
    }
    case 'teleVel': {
      const t = S.pr.tele; t.fator = Math.max(0.5, Math.min(2, Math.round((t.fator + 0.1 * +el.dataset.v) * 10) / 10));
      const v = document.getElementById('televel'); if (v) v.textContent = t.fator.toFixed(1).replace('.', ',') + '×';
      break;
    }
    case 'verPregacao': S.modal = { tipo: 'pregacao', i: +el.dataset.i }; render(); break;
    case 'descartarPregacao':
      m.pregacoes.splice(S.modal.i, 1); S.modal = null; marcar(); render(); toast('Registro descartado'); break;
    case 'parear':
      try { const r = await run('gerarCodigo'); S.modal = { tipo: 'codigo', codigo: String(r.codigo) }; render(); }
      catch (err) { falha(err); }
      break;
    case 'mostrarCodigo': {
      const box = document.getElementById('lcodbox');
      if (box) { box.innerHTML = vEntrarCodigo(); const i = document.getElementById('lcodigo'); if (i) i.focus(); }
      break;
    }
    case 'entrarCodigo': entrarComCodigo(); break;
    case 'semInternet':
      esconderLogin();
      desistirLogin();
      break;
    case 'sair':
      if (!confirm('Sair da conta neste aparelho? Os sermões ainda não enviados continuam guardados aqui.')) return;
      try { const s = lerSessao(); if (s) await chamar('sair', [], { sessao: s.sessao }); } catch (err) {}
      local.apagar(CHAVE_SESSAO);
      try { if (window.google && google.accounts) google.accounts.id.disableAutoSelect(); } catch (err) {}
      S.lista = []; carregarLista(); break;
    case 'desfazer': desfazer(); break;
    /* lista */
    case 'nova': S.msg = novaMsg(); S.dirty = false; S.offline = navigator.onLine === false; S.ins = null; S.sel = ''; S.view = 'editor'; render(); window.scrollTo(0, 0); focar('[data-f="tema"]'); break;
    case 'abrir': abrir(el.dataset.id); break;
    case 'excluir': {
      e.stopPropagation();
      const id = el.dataset.id;
      try {
        await run('excluirMensagem', id);
        marcarPendente(id, false); local.apagar(CACHE_MSG + id);
        toast('Sermão movido para a Lixeira', false, { rotulo: 'Desfazer', fn: async () => {
          try { await run('restaurarExcluido', id); carregarLista(); } catch (err) { falha(err); }
        } });
        carregarLista();
      } catch (err) { falha(err); }
      break;
    }
    case 'duplicar':
      e.stopPropagation();
      try { await run('duplicarMensagem', el.dataset.id); toast('Cópia criada'); carregarLista(); } catch (err) { falha(err); }
      break;

    /* editor */
    case 'voltar':
      if (S.dirty && !(await salvar(true)) && !confirm('Não foi possível salvar. Sair mesmo assim e perder as alterações?')) return;
      clearTimeout(autoT); S.dirty = false; carregarLista(); break;
    case 'salvar': salvar(); break;
    case 'exportar': exportar(); break;
    case 'pregar':
      if (!m.topicos.length) return toast('Adicione ao menos uma parte.', true);
      if (S.dirty && !(await salvar(true)) && !confirm('Não foi possível salvar. Pregar mesmo assim?')) return;
      entrarPregar(); break;
    case 'vincular':
      S.modal = { itens: null }; render();
      try { S.modal.itens = await run('listarEventos'); } catch (err) { S.modal = null; falha(err); }
      render(); break;
    case 'pickEvento': {
      const ev = S.modal.itens[+el.dataset.i];
      m.eventos = m.eventos || [];
      if (!m.eventos.some(x => x.id === ev.id)) m.eventos.push(ev);
      S.modal = null; marcar(); render(); break;
    }
    case 'fecharModal': S.modal = null; render(); break;
    case 'desvEvento': m.eventos.splice(+el.dataset.i, 1); marcar(); render(); break;

    case 'irParte':
      T._open = true; render();
      { const sec = document.getElementById('top-' + ti); if (sec) sec.scrollIntoView({ block: 'start', behavior: 'smooth' }); }
      break;
    case 'addTopico':
      m.topicos.forEach(t => t._open = false);
      m.topicos.push({ titulo: 'Parte ' + (m.topicos.length + 1), blocos: [], _open: true });
      S.ins = null; S.sel = ''; marcar(); render(); focar(`[data-f="titulo"][data-t="${m.topicos.length - 1}"]`); break;
    case 'toggle': T._open = !T._open; if (S.ins && S.ins.ti === ti) S.ins = null; render(); break;
    case 'topUp': swap(m.topicos, ti, ti - 1); S.ins = null; S.sel = ''; marcar(); render(); break;
    case 'topDown': swap(m.topicos, ti, ti + 1); S.ins = null; S.sel = ''; marcar(); render(); break;
    case 'delTopico': {
      const alvo = S.msg, parte = m.topicos.splice(ti, 1)[0];
      S.ins = null; S.sel = ''; marcar(); render();
      toast(`Parte “${parte.titulo || 'Parte ' + (ti + 1)}” excluída`, false, { rotulo: 'Desfazer', fn: () => {
        if (S.msg !== alvo || S.view !== 'editor') return toast('Não dá mais para desfazer.', true);
        parte._open = true; alvo.topicos.splice(Math.min(ti, alvo.topicos.length), 0, parte); marcar(); render();
      } });
      break;
    }

    case 'inserir':
      S.ins = S.ins && S.ins.ti === ti ? null : { ti, q: '' };
      atualizarPaleta(ti); break;
    case 'addBloco': novoBloco(ti, el.dataset.v); break;
    case 'buscarVers': buscarVers(B, el); break;
    case 'egwConferir': {
      const termos = String(B.texto || '').replace(/\s+/g, ' ').trim().split(' ').slice(0, 12).join(' ') || String(B.fonte || '').replace(/ellen g\.? white,?/i, '').trim();
      if (!termos) return toast('Escreva ou cole o começo da citação para pesquisar.', true);
      window.open('https://egwwritings.org/search?query=' + encodeURIComponent(termos), '_blank');
      break;
    }
    case 'blUp': swap(T.blocos, bi, bi - 1); S.sel = ti + ':' + (bi - 1); marcar(); render(); break;
    case 'blDown': swap(T.blocos, bi, bi + 1); S.sel = ti + ':' + (bi + 1); marcar(); render(); break;
    case 'blDel': {
      const alvo = S.msg, removido = T.blocos.splice(bi, 1)[0];
      S.sel = ''; marcar(); render();
      toast(`${(TIPOS[removido.tipo] || TIPOS.texto).nome} removido`, false, { rotulo: 'Desfazer', fn: () => {
        if (S.msg !== alvo || S.view !== 'editor' || alvo.topicos.indexOf(T) < 0) return toast('Não dá mais para desfazer.', true);
        T.blocos.splice(Math.min(bi, T.blocos.length), 0, removido); T._open = true; S.sel = ti + ':' + bi; marcar(); render();
      } });
      break;
    }
    case 'addItem':
      B.itens.push(''); marcar(); render();
      focar(`.bl[data-t="${ti}"][data-b="${bi}"] [data-li="${B.itens.length - 1}"]`); break;
    case 'delItem': B.itens.splice(+el.dataset.li, 1); marcar(); render(); break;

    /* pregar */
    case 'sairPregar': sairPregar(); break;
    case 'pgIr': irTopico(+el.dataset.v); break;
    case 'fonte': S.pr.fs = Math.max(0.7, Math.min(2.2, +(S.pr.fs + 0.15 * +el.dataset.v).toFixed(2))); document.querySelector('.pg').style.setProperty('--fs', S.pr.fs); break;
    case 'timer':
      if (S.pr.inicio) { fecharParte(); S.pr.acum += Date.now() - S.pr.inicio; S.pr.inicio = 0; }
      else { S.pr.inicio = Date.now(); S.pr.marca = S.pr.inicio; }
      tick(); break;
  }
});
