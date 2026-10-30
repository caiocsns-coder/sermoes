/* ---------------- Bíblia (YouVersion Platform) ---------------- */
/*
 * A App Key fica em Propriedades do script → YOUVERSION_KEY (nunca no código).
 * Só funcionam as versões licenciadas para a chave no portal platform.youversion.com.
 */

const YV_BASE = 'https://api.youversion.com';
/* sigla digitada no bloco (sem espaços nem hífen, em maiúsculas) → id da versão no YouVersion */
const YV_VERSOES = { NBV: 1966, NBVP: 1966, NVI: 129, BLT: 3254, PTNVI: 4360, NVI2011: 4360, OL: 1967 };

/* código USFM → nomes e abreviações em português (sem acento, minúsculas) */
const LIVROS = {
  GEN: 'genesis gn', EXO: 'exodo ex', LEV: 'levitico lv', NUM: 'numeros nm', DEU: 'deuteronomio dt',
  JOS: 'josue js', JDG: 'juizes jz', RUT: 'rute rt', '1SA': '1samuel 1sm', '2SA': '2samuel 2sm',
  '1KI': '1reis 1rs', '2KI': '2reis 2rs', '1CH': '1cronicas 1cr', '2CH': '2cronicas 2cr',
  EZR: 'esdras ed', NEH: 'neemias ne', EST: 'ester et', JOB: 'job', PSA: 'salmos salmo sl',
  PRO: 'proverbios pv', ECC: 'eclesiastes ec', SNG: 'canticos cantares canticodoscanticos ct',
  ISA: 'isaias is', JER: 'jeremias jr', LAM: 'lamentacoes lm', EZK: 'ezequiel ez', DAN: 'daniel dn',
  HOS: 'oseias os', JOL: 'joel jl', AMO: 'amos am', OBA: 'obadias ob', JON: 'jonas jn',
  MIC: 'miqueias mq', NAM: 'naum na', HAB: 'habacuque hc', ZEP: 'sofonias sf', HAG: 'ageu ag',
  ZEC: 'zacarias zc', MAL: 'malaquias ml',
  MAT: 'mateus mt', MRK: 'marcos mc', LUK: 'lucas lc', JHN: 'joao jo', ACT: 'atos at',
  ROM: 'romanos rm', '1CO': '1corintios 1co', '2CO': '2corintios 2co', GAL: 'galatas gl',
  EPH: 'efesios ef', PHP: 'filipenses fp', COL: 'colossenses cl', '1TH': '1tessalonicenses 1ts',
  '2TH': '2tessalonicenses 2ts', '1TI': '1timoteo 1tm', '2TI': '2timoteo 2tm', TIT: 'tito tt',
  PHM: 'filemom filemon fm', HEB: 'hebreus hb', JAS: 'tiago tg', '1PE': '1pedro 1pe', '2PE': '2pedro 2pe',
  '1JN': '1joao 1jo', '2JN': '2joao 2jo', '3JN': '3joao 3jo', JUD: 'judas jd', REV: 'apocalipse ap',
};

function semAcento_(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/* "1 Coríntios", "I Co", "1º Jo", "Sl", "Jó" → código USFM */
function livroUsfm_(nome) {
  const bruto = String(nome).trim().toLowerCase().replace(/\./g, '');
  if (bruto === 'jó') return 'JOB'; // "Jo" (sem acento) é João
  let s = semAcento_(bruto)
    .replace(/^(iii|3º|3o|3a|terceira)\s*/, '3').replace(/^(ii|2º|2o|2a|segunda)\s*/, '2')
    .replace(/^(i|1º|1o|1a|primeira)\s+/, '1').replace(/\s+/g, '');
  for (const cod in LIVROS) if (LIVROS[cod].split(' ').indexOf(s) >= 0) return cod;
  return '';
}

/*
 * "Mateus 24:45-47" → ['MAT.24.45-47'];  "Sl 23" → ['PSA.23'];  "Jo 3:16,18" → ['JHN.3.16', 'JHN.3.18']
 * Aceita ":" "." ou "," entre capítulo e versículo.
 * Trecho entre capítulos ("Gn 1:26-2:3") vira um objeto { livro, c1, v1, c2, v2 }, que buscarVersiculo divide,
 * porque a API só aceita intervalos dentro de um capítulo.
 */
function referenciaUsfm_(ref) {
  const limpo = String(ref || '').replace(/[–—]/g, '-').replace(/\(.*?\)/g, '').trim();
  const m = limpo.match(/^(.+?)\s*(\d+)(?:\s*[:.,]\s*(.+))?$/);
  if (!m) throw new Error('Não entendi a referência "' + ref + '". Use, por exemplo, Mateus 24:45-47.');
  const livro = livroUsfm_(m[1]);
  if (!livro) throw new Error('Não reconheci o livro "' + m[1].trim() + '".');
  const cap = Number(m[2]);
  if (!m[3]) return [livro + '.' + cap];
  return m[3].split(/[,;]/).map(p => p.replace(/\s+/g, '')).filter(Boolean).map(p => {
    const x = p.match(/^(\d+)-(\d+)[:.](\d+)$/);
    if (x) {
      const c2 = Number(x[2]);
      if (c2 <= cap) throw new Error('O capítulo final ("' + p + '") precisa ser depois do capítulo ' + cap + '.');
      return { livro, c1: cap, v1: Number(x[1]), c2, v2: Number(x[3]) };
    }
    if (!/^\d+(-\d+)?$/.test(p)) throw new Error('Não entendi os versículos "' + p + '".');
    return livro + '.' + cap + '.' + p;
  });
}

function versaoYV_(versao) {
  const sigla = String(versao || 'NBV').toUpperCase().replace(/[\s-]/g, '');
  if (/^\d+$/.test(sigla)) return Number(sigla);
  const id = YV_VERSOES[sigla];
  if (!id) throw new Error('A versão ' + String(versao || '').toUpperCase() + ' não está disponível na busca. Disponíveis: NBV, NVI, NVI 2011, BLT e OL (O Livro, de Portugal). Para ARA, NAA e outras, preencha o texto à mão.');
  return id;
}

function chamarYouVersion_(caminho) {
  const chave = PropertiesService.getScriptProperties().getProperty('YOUVERSION_KEY');
  if (!chave) throw new Error('Falta a chave do YouVersion. Cadastre YOUVERSION_KEY em Configurações do projeto → Propriedades do script.');
  const resp = UrlFetchApp.fetch(YV_BASE + caminho, {
    headers: { 'X-YVP-App-Key': chave, 'Accept': 'application/json' },
    muteHttpExceptions: true,
  });
  return { codigo: resp.getResponseCode(), corpo: resp.getContentText() };
}

/*
 * O copyright costuma vir em dois parágrafos (português e inglês). Fica só o primeiro,
 * inteiro; se for longo demais, corta no fim de uma palavra.
 */
function resumirCopyright_(c) {
  const paragrafos = String(c || '').split(/\n\s*\n|\r\n\s*\r\n|\n/).map(p => p.replace(/\s+/g, ' ').trim()).filter(Boolean);
  let txt = paragrafos[0] || '';
  /* se veio tudo numa linha só, separa na versão em inglês ("Copyright © … by") */
  const ingles = txt.search(/\s(Holy Bible|[A-Z][^.]{0,80}Copyright ©)/);
  if (ingles > 40) txt = txt.slice(0, ingles).trim();
  if (txt.length > 400) txt = txt.slice(0, 400).replace(/\s+\S*$/, '') + '…';
  return txt;
}

/* copyright da versão (para a atribuição exigida pela licença); guardado 6 h no cache */
function copyrightYV_(id) {
  const cache = CacheService.getScriptCache(), chave = 'yv_copy2_' + id;
  const salvo = cache.get(chave);
  if (salvo !== null) return salvo;
  let txt = '';
  try {
    const r = chamarYouVersion_('/v1/bibles/' + id);
    if (r.codigo === 200) {
      const b = JSON.parse(r.corpo);
      txt = resumirCopyright_(b.copyright);
    }
  } catch (e) {}
  cache.put(chave, txt, 21600);
  return txt;
}

/**
 * Busca o texto de uma referência numa versão licenciada.
 * @return {{texto: string, referencia: string, versao: string, copyright: string}}
 */
/* um trecho dentro de um capítulo; lança erros em português conforme o código HTTP */
function trechoYV_(id, versao, usfm) {
  const r = chamarYouVersion_('/v1/bibles/' + id + '/passages/' + usfm + '?format=text');
  if (r.codigo === 401 || r.codigo === 403) {
    throw new Error('A versão ' + versao + ' ainda não está liberada para a sua chave. Peça a licença em platform.youversion.com → Licensing.');
  }
  if (r.codigo === 404) {
    throw new Error('Não encontrei ' + usfm.replace(/\./g, ' ') + ' na versão ' + versao + '. Confira a referência, ou se a versão já está licenciada.');
  }
  if (r.codigo !== 200) throw new Error('O YouVersion respondeu ' + r.codigo + '. Tente de novo em instantes.');
  const j = JSON.parse(r.corpo);
  return { texto: String(j.content || '').replace(/\s+/g, ' ').trim(), ref: j.reference || '' };
}

/*
 * Do versículo v até o fim do capítulo. Primeiro tenta um intervalo até 176 (o maior capítulo, Salmo 119).
 * Se a API recusar, busca versículo por versículo em paralelo (fetchAll) até o primeiro que não existir.
 */
function ateFimDoCapitulo_(id, versao, livro, cap, v) {
  const base = livro + '.' + cap + '.';
  const r = chamarYouVersion_('/v1/bibles/' + id + '/passages/' + base + v + '-176?format=text');
  if (r.codigo === 200) {
    const j = JSON.parse(r.corpo);
    const t = String(j.content || '').replace(/\s+/g, ' ').trim();
    if (t) return t;
  }
  const chave = PropertiesService.getScriptProperties().getProperty('YOUVERSION_KEY');
  const pedidos = [];
  for (let k = v; k < v + 80 && k <= 176; k++) {
    pedidos.push({ url: YV_BASE + '/v1/bibles/' + id + '/passages/' + base + k + '?format=text',
      headers: { 'X-YVP-App-Key': chave, 'Accept': 'application/json' }, muteHttpExceptions: true });
  }
  const textos = [];
  const resps = UrlFetchApp.fetchAll(pedidos);
  for (let i = 0; i < resps.length; i++) {
    if (resps[i].getResponseCode() !== 200) break;
    textos.push(String(JSON.parse(resps[i].getContentText()).content || '').replace(/\s+/g, ' ').trim());
  }
  if (!textos.length) return trechoYV_(id, versao, base + v).texto; // gera a mensagem de erro adequada
  return textos.join(' ');
}

function buscarVersiculo(ref, versao) {
  versao = String(versao || 'NBV').trim().toUpperCase();
  const id = versaoYV_(versao);
  const partes = referenciaUsfm_(ref);
  const textos = [], refs = [];
  let atravessa = false;
  partes.forEach(p => {
    if (typeof p === 'string') {
      const t = trechoYV_(id, versao, p);
      textos.push(t.texto); if (t.ref) refs.push(t.ref);
      return;
    }
    atravessa = true;
    if (p.c2 - p.c1 > 5) throw new Error('Trecho longo demais (mais de 5 capítulos). Divida em blocos menores.');
    textos.push(ateFimDoCapitulo_(id, versao, p.livro, p.c1, p.v1));
    for (let c = p.c1 + 1; c < p.c2; c++) textos.push(trechoYV_(id, versao, p.livro + '.' + c).texto);
    textos.push(trechoYV_(id, versao, p.livro + '.' + p.c2 + '.1-' + p.v2).texto);
  });
  /* entre capítulos, a referência digitada é mais legível que a soma das partes */
  const referencia = atravessa ? String(ref).trim() : refs.join('; ');
  return { texto: textos.join(' '), referencia, versao, copyright: copyrightYV_(id) };
}
