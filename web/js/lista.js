/* Tela da lista de sermões. */
import { pendentes } from './armazenamento.js';
import { S } from './estado.js';
import { hol } from './holyrics.js';
import { ic } from './icones.js';
import { lerSessao } from './servidor.js';
import { esc, fmtData, norm, plural } from './util.js';

export function vLista() {
  return `
  <header class="lhead">
    <h1 class="logo">Sermões</h1>
    <label class="busca">${ic('search', 16)}<input data-f="filtro" placeholder="Procurar tema, pasta, parte ou versículo" aria-label="Procurar sermão" value="${esc(S.filtro)}"></label>
    <label class="btn imp" title="Importar sermão de um arquivo .json">${ic('upload', 16)}<span class="lg">Importar</span><input type="file" accept=".json,application/json" data-f="importar" aria-label="Importar sermão"></label>
    <button class="btn pri" data-a="nova">${ic('plus', 16)}<span>Novo<span class="lg"> sermão</span></span></button>
  </header>
  ${S.offline ? '<div class="aviso">Sem internet: mostrando os sermões salvos neste aparelho. As alterações são enviadas quando a conexão voltar.</div>' : ''}
  <main class="wrap"><div id="res">${vResultados()}</div>${vConta()}</main>`;
}

export const chaveItem = m => m.id || m._local;

export function vConta() {
  const s = lerSessao();
  return `<footer class="conta">
    <span>${s && s.email ? 'Conectado como ' + esc(s.email) : 'Conta'}</span>
    <button class="link" data-a="lixeira">${ic('archive', 15)} Lixeira</button>
    <button class="link" data-a="backup">${ic('cloud', 15)} Backup no Drive agora</button>
    <button class="link" data-a="holyrics">${ic('cast', 15)} Holyrics${hol().ativo ? ' (ligado)' : ''}</button>
    <button class="link" data-a="parear">${ic('phone', 15)} Conectar outro aparelho</button>
    <button class="link" data-a="sair">${ic('logout', 15)} Sair deste aparelho</button>
  </footer>`;
}

export function acoesCard(m) {
  if (!m.id) return '';
  return `<div class="acts">
    <button class="ic sm" data-a="duplicar" data-id="${esc(m.id)}" title="Duplicar" aria-label="Duplicar sermão">${ic('copy', 16)}</button>
    <button class="ic sm" data-a="excluir" data-id="${esc(m.id)}" title="Excluir" aria-label="Excluir sermão">${ic('trash', 16)}</button>
  </div>`;
}

export function vDestaque(m) {
  const n = Math.max(1, m.nTopicos || 0);
  return `
  <div class="sec">Mais recente</div>
  <div class="card feat" data-a="abrir" data-id="${esc(chaveItem(m))}" role="button" tabindex="0">
    <div class="fmeta">${m.pasta ? `<span class="tag">${esc(m.pasta)}</span>` : ''}<span>editado em ${fmtData(m.atualizado)}</span>${pendentes().includes(chaveItem(m)) ? '<span class="pendtag">não enviado</span>' : ''}</div>
    <div class="ft">${esc(m.tema || 'Sem tema')}</div>
    <div class="mini" aria-hidden="true">${'<span></span>'.repeat(n)}</div>
    <div class="meta"><span><b>${m.tempo}</b> min</span><span><b>${m.nTopicos}</b> ${m.nTopicos === 1 ? 'parte' : 'partes'}</span></div>
    ${acoesCard(m)}
  </div>`;
}

export function vResultados() {
  if (S.carregando) return '<p class="muted">Carregando…</p>';
  const q = norm(S.filtro.trim());
  let itens = S.lista.filter(m => !q || norm(m.tema + ' ' + m.pasta + ' ' + (m.busca || '')).includes(q));
  if (!itens.length) return `<div class="vazio" style="margin-top:20px">${S.lista.length ? 'Nada encontrado.' : 'Nenhum sermão ainda.<br><small>Toque em “Novo sermão” para começar.</small>'}</div>`;
  let html = '';
  if (!q) { html += vDestaque(itens[0]); itens = itens.slice(1); }
  const grupos = {};
  itens.forEach(m => (grupos[m.pasta || 'Sem pasta'] ||= []).push(m));
  html += Object.keys(grupos).sort((a, b) => a === 'Sem pasta' ? 1 : b === 'Sem pasta' ? -1 : a.localeCompare(b)).map(p => `
    <div class="sec">${ic('folder', 15)} ${esc(p)}</div>
    <div class="rows">${grupos[p].map(m => `
      <div class="card row" data-a="abrir" data-id="${esc(chaveItem(m))}" role="button" tabindex="0">
        <div class="ct">${esc(m.tema || 'Sem tema')}</div>
        <div class="cm">${m.tempo} min · ${plural(m.nTopicos, 'parte', 'partes')} · editado em ${fmtData(m.atualizado)}${pendentes().includes(chaveItem(m)) ? ' · <span class="pendtag">não enviado</span>' : ''}</div>
        ${acoesCard(m)}
      </div>`).join('')}
    </div>`).join('');
  return html;
}
