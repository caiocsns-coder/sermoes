/* Tela do editor: partes, blocos, paleta Inserir, linha do tempo e salvamento local. */
import { chaveMsg, guardarMsg, marcarPendente, pendentes } from './armazenamento.js';
import { nConferir, vCitacaoExtras } from './citacoes.js';
import { agendarAuto } from './dados.js';
import { S, app } from './estado.js';
import { ic } from './icones.js';
import { LIMITE, TEMPOS, TIPOS, VERSOES, tele } from './modelo.js';
import { render } from './render.js';
import { palavras, ritmo, tamanho, temposPartes } from './tempo.js';
import { esc, fmtData, fmtHora, fmtMin, mmss, norm, pastas, plural } from './util.js';

export const estaPendente = () => !!(S.msg && pendentes().includes(chaveMsg(S.msg)));

export function txtStatus() {
  if (S.salvando) return 'Salvando…';
  if (S.dirty) return 'Salvando em instantes…';
  if (estaPendente()) return 'Salvo no aparelho · envia quando a internet voltar';
  return S.msg && S.msg.id ? 'Salvo às ' + fmtHora(S.msg.atualizado) : '';
}

export function vLinhaCap() {
  const m = S.msg, n = m.topicos.length, tps = temposPartes(m);
  const total = tps.reduce((s, x) => s + x.min, 0);
  const pct = Math.round(tamanho(m) / LIMITE * 100);
  const ppm = ritmo(), noRitmo = ppm ? m.topicos.reduce((x, t) => x + palavras(t), 0) / ppm : 0;
  const pr = m.pregacoes || [], ult = pr[pr.length - 1];
  return `${plural(n, 'parte', 'partes')}`
    + ` · <span class="${total > m.tempo + 0.5 ? 'warn' : ''}">previsto ${fmtMin(total)} de ${m.tempo} min</span>`
    + (noRitmo >= 1 ? ` · <span class="${noRitmo > m.tempo + 2 ? 'warn' : ''}" title="Palavras do sermão divididas pelo seu ritmo nas últimas pregações">no seu ritmo ≈ ${fmtMin(noRitmo)} min</span>` : '')
    + ` · <span class="${pct >= 80 ? 'warn' : ''}" title="Espaço usado na célula da planilha">${pct}% do espaço</span>`
    + (nConferir(m) ? ` · <span class="warn" title="Citações sem a marca &quot;Conferida na fonte&quot;">${plural(nConferir(m), 'citação a conferir', 'citações a conferir')}</span>` : '')
    + (ult ? ` · <button class="link inl" data-a="verPregacao" data-i="${pr.length - 1}">pregado ${pr.length}× · último ${fmtData(ult.data)}, ${mmss(ult.total)}</button>` : '');
}

export function vEditor() {
  const m = S.msg, n = m.topicos.length, tps = temposPartes(m);
  return `
  <header class="bar">
    <button class="ic fill" data-a="voltar" title="Voltar" aria-label="Voltar para os sermões">${ic('back', 20)}</button><div class="sp"></div>
    <span class="status ${S.dirty ? 'dirty' : estaPendente() ? 'pend' : ''}" id="status">${txtStatus()}</span>
    <button class="ic fill" data-a="exportar" title="Exportar sermão (.json)" aria-label="Exportar sermão">${ic('download', 18)}</button>
    <button class="btn" data-a="salvar">Salvar</button>
    <button class="btn pri" data-a="pregar">${ic('play', 14)} Pregar</button>
  </header>
  <main class="ed">
    <textarea class="tema" data-f="tema" rows="1" placeholder="Tema do sermão" aria-label="Tema">${esc(m.tema)}</textarea>
    <div class="pills">
      <label class="pill">${ic('folder', 15)}<input data-f="pasta" placeholder="Sem pasta" list="pastas" aria-label="Pasta" value="${esc(m.pasta)}" size="${Math.max(12, (m.pasta || '').length + 2)}"></label>
      <datalist id="pastas">${pastas().map(p => `<option value="${esc(p)}">`).join('')}</datalist>
      <datalist id="versoes">${VERSOES.map(v => `<option value="${v}">`).join('')}</datalist>
      <label class="pill">${ic('clock', 15)}<span>Alvo de</span><select data-f="tempo" aria-label="Duração">${TEMPOS.map(t => `<option value="${t}" ${m.tempo == t ? 'selected' : ''}>${t} min</option>`).join('')}</select>${ic('chevDown', 14)}</label>
      ${(m.eventos || []).map((e, i) => `<span class="pill ev">${ic('cal', 15)}${esc(e.titulo)} · ${fmtData(e.data)}<button class="ic sm" data-a="desvEvento" data-i="${i}" title="Desligar" aria-label="Desligar este culto">${ic('x', 14)}</button></span>`).join('')}
      <button class="pill add" data-a="vincular">${ic('plus', 15)} Ligar a um culto</button>
      <button class="pill" data-a="versoes">${ic('history', 15)} Versões</button>
      <button class="pill ${tele(m) ? 'on' : ''}" data-a="teleprompter" aria-pressed="${tele(m)}" title="Rolagem automática do texto no modo Pregar">${ic('scroll', 15)} Teleprompter: ${tele(m) ? 'ligado' : 'desligado'}</button>
    </div>

    ${n > 1 ? `<div class="tl" id="tl">${m.topicos.map((t, ti) => `<button class="${t._open ? 'on' : ''}" style="flex:${Math.max(0.5, tps[ti].min)}" data-a="irParte" data-t="${ti}" title="${esc(t.titulo || 'Parte ' + (ti + 1))} · ${fmtMin(tps[ti].min)} min">${ti + 1}</button>`).join('')}</div>` : ''}
    <div class="tlcap" id="tlcap">${vLinhaCap()}</div>

    <div class="partes">
      ${m.topicos.map((t, ti) => vParte(t, ti, tps[ti])).join('')}
      <div class="no add"><b>${ic('plus', 14)}</b></div>
      <div class="pt"><button class="tt" data-a="addTopico" style="color:var(--ac)">Nova parte</button></div>
    </div>
  </main>`;
}

export function vParte(t, ti, tp) {
  const ult = ti === S.msg.topicos.length - 1;
  const titulo = t.titulo || 'Parte ' + (ti + 1);
  const no = `<div class="no ${t._open ? 'on' : ''}"><b>${ti + 1}</b><i></i></div>`;
  if (!t._open) {
    return no + `<div class="pt" id="top-${ti}"><button class="tt" data-a="toggle" data-t="${ti}"><span>${esc(titulo)}</span><small>${plural(t.blocos.length, 'bloco', 'blocos')} · ${tp.est ? '≈ ' : ''}${fmtMin(tp.min)} min</small></button></div>`;
  }
  return no + `
  <section class="po" id="top-${ti}">
    <div class="ph">
      <input data-f="titulo" data-t="${ti}" value="${esc(t.titulo)}" placeholder="Parte ${ti + 1}" aria-label="Título da parte">
      <button class="ic sm" data-a="topUp" data-t="${ti}" ${ti === 0 ? 'disabled' : ''} title="Subir parte" aria-label="Subir parte">${ic('up', 16)}</button>
      <button class="ic sm" data-a="topDown" data-t="${ti}" ${ult ? 'disabled' : ''} title="Descer parte" aria-label="Descer parte">${ic('down', 16)}</button>
      <button class="ic sm" data-a="toggle" data-t="${ti}" title="Recolher" aria-label="Recolher parte">${ic('chevUp', 18)}</button>
    </div>
    <div class="pmeta">
      <label class="pill sm" title="Tempo previsto para esta parte">${ic('clock', 14)}<input type="number" inputmode="numeric" min="1" max="180" data-f="ttempo" data-t="${ti}" value="${t.tempo > 0 ? t.tempo : ''}" placeholder="${fmtMin(tp.min)}" aria-label="Minutos previstos para esta parte"><span>min</span></label>
      <small class="muted" id="est-${ti}">${t.tempo > 0 ? 'definido por você' : 'estimado pelo texto'}</small>
    </div>
    ${t.blocos.map((b, bi) => vBloco(b, ti, bi, t.blocos.length)).join('')}
    <div>
      <div class="ins">
        <input data-f="ins" data-t="${ti}" placeholder="Escreva aqui ou digite / para inserir" aria-label="Novo bloco">
        <button class="ic fill" data-a="inserir" data-t="${ti}" title="Inserir bloco" aria-label="Inserir bloco">${ic('plus', 18)}</button>
      </div>
      <div id="pal-${ti}">${vPaleta(ti)}</div>
    </div>
    <div class="pfoot"><button class="link danger" data-a="delTopico" data-t="${ti}">${ic('trash', 15)} Excluir parte</button></div>
  </section>`;
}

/* tipos que combinam com o que foi digitado depois da barra */
export function tiposFiltrados(q) {
  q = norm(q);
  return Object.keys(TIPOS).filter(k => !q || TIPOS[k].atalho === q || norm(TIPOS[k].nome).startsWith(q));
}

export function vPaleta(ti) {
  if (!S.ins || S.ins.ti !== ti) return '';
  const ks = tiposFiltrados(S.ins.q);
  return `<div class="pal" role="menu">${ks.length ? ks.map((k, i) => `<button class="${i === 0 ? 'on' : ''}" role="menuitem" data-a="addBloco" data-t="${ti}" data-v="${k}">${ic(TIPOS[k].icon, 18)}<span>${TIPOS[k].nome}</span><small>/${TIPOS[k].atalho}</small></button>`).join('') : '<p>Nenhum tipo com esse nome.</p>'}</div>`;
}

export function vBloco(b, ti, bi, n) {
  const T = TIPOS[b.tipo] || TIPOS.texto;
  let corpo = '';
  switch (b.tipo) {
    case 'biblico':
      corpo = `<div class="ref"><input data-f="ref" placeholder="Referência (ex.: Mateus 24:45-47)" aria-label="Referência" value="${esc(b.ref)}"><input class="ver" data-f="versao" list="versoes" placeholder="NBV" aria-label="Versão" value="${esc(b.versao)}"><button class="buscar" data-a="buscarVers" title="Buscar o texto no YouVersion">${ic('search', 14)} Buscar</button></div>
        <textarea class="ta" data-f="texto" rows="1" placeholder="Texto do versículo (ou toque em Buscar)">${esc(b.texto)}</textarea>
        ${b.copyright ? `<div class="copy">${esc(b.copyright)}</div>` : ''}`; break;
    case 'lista':
      corpo = (b.itens || []).map((it, li) => `<div class="li"><input class="ta" data-f="item" data-li="${li}" value="${esc(it)}" placeholder="Item"><button class="ic sm" data-a="delItem" data-li="${li}" aria-label="Apagar item">${ic('x', 14)}</button></div>`).join('')
        + `<button class="link" data-a="addItem">${ic('plus', 15)} Adicionar item</button>`; break;
    case 'citacao':
      corpo = `<textarea class="ta" data-f="texto" rows="1" placeholder="Texto da citação (colado do EGW Writings, a referência {DTN 558.2} vira a fonte)">${esc(b.texto)}</textarea>
        <input class="fonte" data-f="fonte" placeholder="Autor e fonte (ex.: Ellen G. White, Conselhos sobre a Escola Sabatina, p. 10)" aria-label="Fonte" value="${esc(b.fonte)}">
        ${vCitacaoExtras(b)}`; break;
    case 'imagem':
      corpo = `${b.url ? `<img class="prev" src="${esc(b.url)}" alt="">` : ''}
        <label class="up">${ic('upload', 16)} Enviar imagem do aparelho<input type="file" accept="image/*" data-f="arquivo"></label>
        <input class="inp2" data-f="url" placeholder="…ou cole o link de uma imagem" aria-label="Link da imagem" value="${esc(b.url)}">
        <input class="inp2" data-f="legenda" placeholder="Legenda (opcional)" aria-label="Legenda" value="${esc(b.legenda)}">`; break;
    case 'obs':
      corpo = `<textarea class="ta" data-f="texto" rows="1" placeholder="Lembrete só para você (aparece discreto no modo Pregar)">${esc(b.texto)}</textarea>`; break;
    default:
      corpo = `<textarea class="ta" data-f="texto" rows="1" placeholder="Escreva aqui">${esc(b.texto)}</textarea>`;
  }
  const sel = S.sel === ti + ':' + bi ? ' sel' : '';
  return `
  <div class="bl t-${b.tipo}${sel}" data-t="${ti}" data-b="${bi}">
    <div class="bh"><span>${T.nome}</span>
      <button class="ic sm" data-a="blUp" ${bi === 0 ? 'disabled' : ''} title="Subir" aria-label="Subir bloco">${ic('up', 15)}</button>
      <button class="ic sm" data-a="blDown" ${bi === n - 1 ? 'disabled' : ''} title="Descer" aria-label="Descer bloco">${ic('down', 15)}</button>
      <button class="ic sm" data-a="blDel" title="Remover" aria-label="Remover bloco">${ic('trash', 15)}</button>
    </div>
    <div class="bc">${corpo}</div>
  </div>`;
}

export function atualizarStatus() {
  const el = document.getElementById('status');
  if (!el) return;
  el.className = 'status' + (S.dirty ? ' dirty' : !S.salvando && estaPendente() ? ' pend' : '');
  el.textContent = txtStatus();
}

/* atualiza a linha do tempo, a legenda e as estimativas sem re-renderizar (não perde o foco) */
export function atualizarLinha() {
  if (S.view !== 'editor' || !S.msg) return;
  const tps = temposPartes(S.msg);
  const cap = document.getElementById('tlcap');
  if (cap) cap.innerHTML = vLinhaCap();
  app.querySelectorAll('#tl button').forEach((b, ti) => {
    if (!tps[ti]) return;
    b.style.flex = Math.max(0.5, tps[ti].min);
    b.title = (S.msg.topicos[ti].titulo || 'Parte ' + (ti + 1)) + ' · ' + fmtMin(tps[ti].min) + ' min';
  });
  app.querySelectorAll('[data-f="ttempo"]').forEach(inp => {
    const ti = +inp.dataset.t; if (!tps[ti]) return;
    inp.placeholder = fmtMin(tps[ti].min);
    const est = document.getElementById('est-' + ti);
    if (est) est.textContent = S.msg.topicos[ti].tempo > 0 ? 'definido por você' : 'estimado pelo texto';
  });
}

/* cada edição: cópia no aparelho quase na hora (protege contra fechar o app) e envio ao servidor depois */
export let localT = null;

export function guardarLocal() {
  clearTimeout(localT);
  localT = setTimeout(() => { if (S.msg && S.view !== 'lista') { guardarMsg(S.msg); marcarPendente(chaveMsg(S.msg), true); } }, 300);
}

export function marcar() {
  S.dirty = true; S.rev++;
  guardarLocal(); atualizarStatus(); atualizarLinha(); agendarAuto();
}

export function focar(sel) {
  const el = app.querySelector(sel);
  if (el) { el.focus(); el.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
}

export function atualizarPaleta(ti) {
  const c = document.getElementById('pal-' + ti);
  if (c) c.innerHTML = vPaleta(ti);
}

/* bloco selecionado: mostra só nele os botões de subir/descer/remover */
export function selecionar(bl) {
  const chave = bl.dataset.t + ':' + bl.dataset.b;
  if (S.sel === chave && bl.classList.contains('sel')) return;
  app.querySelectorAll('.bl.sel').forEach(x => x.classList.remove('sel'));
  bl.classList.add('sel'); S.sel = chave;
}

export function novoBloco(ti, tipo, texto) {
  const T = S.msg.topicos[ti];
  const b = TIPOS[tipo].novo();
  if (texto) b.texto = texto;
  T.blocos.push(b);
  S.ins = null; S.sel = ti + ':' + (T.blocos.length - 1); marcar(); render();
  const sel = `.bl[data-t="${ti}"][data-b="${T.blocos.length - 1}"]`;
  if (texto) focar(`[data-f="ins"][data-t="${ti}"]`);
  else focar(sel + ' input, ' + sel + ' textarea');
}
