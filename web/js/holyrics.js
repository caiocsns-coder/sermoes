/* Integração com o Holyrics: projetar e telão de retorno. */
import { local } from './armazenamento.js';
import { S } from './estado.js';
import { run } from './servidor.js';
import { falha, toast } from './util.js';

/* ligado por aparelho (quem opera o Holyrics varia): localStorage sermoes.holyrics = { ativo, telao } */
export const CHAVE_HOL = 'sermoes.holyrics';

export const hol = () => local.ler(CHAVE_HOL) || { ativo: false, telao: false };

/* sem esperar: a projeção não pode travar a pregação; erro vira aviso */
export function enviarHolyrics(acao, dados, aviso) {
  run('projetarHolyrics', acao, dados || {}).then(() => { if (aviso) toast(aviso); }).catch(falha);
}

export const textoTelao = () => {
  const m = S.msg, i = S.pr.i, t = m.topicos[i], prox = m.topicos[i + 1];
  return 'Parte ' + (i + 1) + ' de ' + m.topicos.length + ' · ' + (t.titulo || 'Parte ' + (i + 1)) + (prox ? '\nPróxima: ' + (prox.titulo || 'Parte ' + (i + 2)) : '\nÚltima parte');
};

export function telaoInicio() {
  if (!hol().ativo || !hol().telao) return;
  const seg = (S.msg.tempo || 30) * 60;
  enviarHolyrics('StartCountdownCP', { minutes: S.msg.tempo || 30, seconds: 0, yellow_starts_at: Math.round(seg * 0.15), stop_at_zero: false });
  enviarHolyrics('SetTextCP', { text: textoTelao(), show: true });
}

export function telaoParte() { if (hol().ativo && hol().telao) enviarHolyrics('SetTextCP', { text: textoTelao(), show: true }); }

export function telaoFim() {
  if (!hol().ativo || !hol().telao) return;
  enviarHolyrics('StopCountdownCP', {});
  enviarHolyrics('SetTextCP', { text: '', show: false });
}
