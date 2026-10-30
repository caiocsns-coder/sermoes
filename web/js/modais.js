/* Janelas (agenda, versões, lixeira, pregação, código, Holyrics). */
import { S } from './estado.js';
import { hol } from './holyrics.js';
import { ic } from './icones.js';
import { ritmo } from './tempo.js';
import { esc, fmtData, fmtDataHora, fmtDataHoraAno, fmtMin, mmss, plural } from './util.js';

export const MOTIVOS = { 'edição': 'Antes de uma nova edição', 'substituída por outro aparelho': 'Versão do outro aparelho (substituída)', 'antes de restaurar': 'Antes de restaurar outra versão' };

export const vCaixa = (titulo, corpo) => `
  <div class="ov" data-a="fecharModal">
    <div class="md">
      <div class="mh"><b>${titulo}</b><button class="ic" data-a="fecharModal" aria-label="Fechar">${ic('x')}</button></div>
      <div class="ml">${corpo}</div>
    </div>
  </div>`;

export function vModalExtra() {
  const md = S.modal;
  if (md.tipo === 'holyrics') {
    const h = hol();
    return vCaixa('Holyrics', `<div class="hcfg">
      <p>Projeta versículos e citações a partir do modo Pregar e mostra o tempo no telão de retorno. Vale só para <b>este aparelho</b>: ligue no culto em que você for usar.</p>
      <label class="chk"><input type="checkbox" data-hol="ativo" ${h.ativo ? 'checked' : ''}><span>Projetar pelo app neste aparelho (botão <b>Projetar</b> em cada versículo e citação)</span></label>
      <label class="chk"><input type="checkbox" data-hol="telao" ${h.telao ? 'checked' : ''} ${h.ativo ? '' : 'disabled'}><span>Telão de retorno: contagem do sermão e parte atual no painel de comunicação</span></label>
      <div class="hbtn"><button class="btn" data-a="hTestar">Testar conexão</button><span id="hres" class="muted"></span></div>
      <p class="muted">Precisa do Holyrics aberto e com internet no computador da igreja, e das propriedades HOLYRICS_API_KEY e HOLYRICS_TOKEN no Apps Script (veja o README). Combine com quem opera a mídia: um toque em Projetar muda a tela do culto.</p>
    </div>`);
  }
  if (md.tipo === 'versoes') return vCaixa('Versões anteriores', md.itens === null ? '<p class="muted">Carregando…</p>'
    : md.itens.length ? md.itens.map((v, i) => `<div class="vr"><div><b>${fmtDataHoraAno(v.atualizado)}</b><small>${esc(MOTIVOS[v.motivo] || v.motivo)} · ${esc(v.tema || 'Sem tema')} · ${plural(v.nTopicos, 'parte', 'partes')}</small></div><button class="btn" data-a="restaurarVersao" data-i="${i}">Restaurar</button></div>`).join('')
      + '<p class="muted">O app guarda o estado anterior a cada nova sessão de edição, até 15 versões.</p>'
    : '<p class="muted">Ainda não há versões anteriores. Elas aparecem depois que você voltar a editar este sermão em outro momento (30 min depois do último salvamento).</p>');
  if (md.tipo === 'lixeira') return vCaixa('Lixeira', md.itens === null ? '<p class="muted">Carregando…</p>'
    : md.itens.length ? md.itens.map((v, i) => `<div class="vr"><div><b>${esc(v.tema || 'Sem tema')}</b><small>excluído em ${fmtDataHoraAno(v.guardado)} · ${plural(v.nTopicos, 'parte', 'partes')}</small></div><button class="btn" data-a="restaurarExcluido" data-i="${i}">Restaurar</button></div>`).join('')
      + '<p class="muted">Sermões excluídos ficam aqui por 60 dias.</p>'
    : '<p class="muted">A lixeira está vazia.</p>');
  if (md.tipo === 'pregacao') {
    const pr = S.msg.pregacoes || [], r = pr[md.i];
    if (!r) return '';
    const linhas = r.partes.map(p => {
      const dif = p.prev ? p.seg / 60 - p.prev : 0;
      const real = p.seg ? `<td class="${dif > 1 ? 'mais' : dif < -1 ? 'menos' : ''}">${mmss(p.seg)}</td>` : '<td class="muted" title="Não pregada">—</td>';
      return `<tr><td>${esc(p.titulo)}</td><td>${p.prev ? fmtMin(p.prev) + ' min' : '–'}</td>${real}</tr>`;
    }).join('');
    const outras = pr.length > 1 ? '<div class="outras">' + pr.map((x, k) => `<button class="chip2 ${k === md.i ? 'on' : ''}" data-a="verPregacao" data-i="${k}">${fmtData(x.data)}</button>`).join('') + '</div>' : '';
    return vCaixa(md.novo ? 'Pregação registrada' : 'Pregação', `
      <div class="pres"><b class="${r.total > r.alvo * 60 ? 'mais' : ''}">${mmss(r.total)}</b><span>de ${r.alvo} min · ${fmtDataHora(r.data)}${r.culto ? ' · ' + esc(r.culto) : ''}</span></div>
      <table class="ptab"><thead><tr><th>Parte</th><th>Previsto</th><th>Real</th></tr></thead><tbody>${linhas}</tbody></table>
      ${outras}
      <p class="muted">${ritmo() ? 'Seu ritmo nas últimas pregações: ' + Math.round(ritmo()) + ' palavras por minuto. O editor usa isso para mostrar "no seu ritmo".' : 'Com mais pregações registradas, o editor passa a mostrar quanto tempo o sermão leva no seu ritmo.'}</p>
      ${md.novo ? '<div class="pfoot"><button class="link danger" data-a="descartarPregacao">Descartar este registro</button></div>' : ''}`);
  }
  return null;
}

export function vModal() {
  if (!S.modal) return '';
  const extra = vModalExtra();
  if (extra !== null) return extra;
  if (S.modal.tipo === 'codigo') return `
  <div class="ov" data-a="fecharModal">
    <div class="md">
      <div class="mh"><b>Conectar outro aparelho</b><button class="ic" data-a="fecharModal" aria-label="Fechar">${ic('x')}</button></div>
      <div class="cod">
        <p>No app instalado no iPad (ou em outro aparelho), toque em <b>Entrar com código</b> e digite:</p>
        <div class="codigo" aria-label="Código">${esc(S.modal.codigo.slice(0, 3) + ' ' + S.modal.codigo.slice(3))}</div>
        <p class="muted">Vale por 10 minutos e só pode ser usado uma vez.</p>
      </div>
    </div>
  </div>`;
  const it = S.modal.itens;
  return `
  <div class="ov" data-a="fecharModal">
    <div class="md">
      <div class="mh"><b>Ligar a um culto da agenda</b><button class="ic" data-a="fecharModal" aria-label="Fechar">${ic('x')}</button></div>
      <div class="ml">${it === null ? '<p class="muted">Carregando agenda…</p>'
        : it.length ? it.map((e, i) => `<button class="mi" data-a="pickEvento" data-i="${i}"><span>${esc(e.titulo || '(sem título)')}</span><small>${fmtDataHora(e.data)}</small></button>`).join('')
        : '<p class="muted">Nenhum evento entre a semana passada e os próximos 90 dias.</p>'}</div>
    </div>
  </div>`;
}
