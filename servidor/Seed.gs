/**
 * Importa o sermão "Servindo em Sua Casa até que Ele Venha" (174 anos da Escola Sabatina).
 * Rode uma vez pelo editor: selecione importarSermao174 e clique em Executar.
 */
function importarSermao174() {
  const bib = (ref, versao, texto) => ({ tipo: 'biblico', ref, versao, texto });
  const txt = (...linhas) => ({ tipo: 'texto', texto: linhas.join('\n') });
  const lst = (...itens) => ({ tipo: 'lista', itens });
  const cit = (texto, fonte) => ({ tipo: 'citacao', texto, fonte });
  const obs = (...linhas) => ({ tipo: 'obs', texto: linhas.join('\n') });
  const CSE = 'Ellen G. White, Conselhos sobre a Escola Sabatina';

  const msg = {
    tema: 'Servindo em Sua Casa até que Ele Venha',
    pasta: '174 anos Escola Sabatina',
    tempo: 40,
    eventos: [],
    topicos: [
      {
        titulo: 'Uma casa e um servo',
        blocos: [
          obs('História pessoal de abertura (1 a 2 min): uma classe, um professor ou uma Unidade de Ação que fez diferença na sua vida. Ela volta no último tópico.',
              'Slide 01: arte oficial.'),
          txt('Mateus 24: o sermão mais solene sobre o fim. Crises, enganos, perseguição, a volta de Jesus.',
              'No meio disso, Jesus diminui o zoom: sai das nações e entra numa casa. Fala de um servo.'),
          bib('Mateus 24:45-47', 'NBV', 'Você é um servo do Senhor sábio e fiel? Então eu lhe entregarei a tarefa de cuidar da minha casa e dar de comer aos seus conservos dia a dia! Feliz o servo que seu senhor encontrar fazendo fielmente o seu trabalho. Eu vou pôr servos fiéis assim para cuidar de tudo o que possuo!'),
          txt('Não é uma imagem espetacular. É doméstica. E por isso mesmo é reveladora.',
              'O dono saiu e vai voltar. A pergunta não é SE Ele volta, mas O QUE vai encontrar quando chegar.'),
        ],
      },
      {
        titulo: 'A pergunta de 174 anos',
        blocos: [
          txt('“Você é um servo do Senhor sábio e fiel?” A pergunta chega até nós, hoje.',
              'Ele não pergunta quem começou com entusiasmo, mas quem persevera.',
              'Não pergunta quem celebrou aniversários, mas quem continua fazendo a vontade do Senhor.'),
          obs('Pausa. Deixar a pergunta no ar.'),
          txt('Desde 1852, um pilar da formação espiritual e missionária da igreja.',
              '174 anos podem gerar GRATIDÃO ou ACOMODAÇÃO.'),
          cit('A Escola Sabatina deve ser um dos maiores instrumentos, e o mais eficaz, em levar almas a Cristo.', CSE + ', p. 10'),
          txt('Não um programa educativo: um instrumento de salvação, no centro da missão.'),
          lst('O servo SERVE', 'O servo CUIDA da casa', 'O servo dá de comer, DIA A DIA'),
        ],
      },
      {
        titulo: 'I. Uma Escola Sabatina que serve',
        blocos: [
          txt('A identidade precede a ação: antes de falar de alimento, Jesus fala de serviço.',
              'A igreja não existe para o próprio conforto. Existe para a missão de Cristo.'),
          bib('Lucas 19:10', 'NBV', 'Pois o Filho do Homem veio buscar e salvar o que se havia perdido.'),
          txt('Missão não é um departamento. É a razão de existir.',
              'A Escola Sabatina forma discípulos que fazem discípulos, prepara crentes que testemunham e envia membros em busca dos perdidos.'),
          cit('O objetivo da Escola Sabatina deve ser a conquista de almas. Pode ser impecável a organização do trabalho e as facilidades nada deixarem a desejar; mas se as crianças e jovens não forem levados a Cristo, a escola será um fracasso.', CSE + ', p. 61'),
          lst('Ora por pessoas específicas, pelo nome', 'Planeja ações missionárias', 'Dá estudos bíblicos', 'Integra quem chega', 'Acompanha os recém-batizados'),
          obs('Aplicação: temos um propósito missionário ou só uma lista de presença?',
              'Existe alguém, com nome e sobrenome, por quem sua classe ora toda semana?',
              'FRASE-ÂNCORA: “Uma Escola Sabatina que serve não se conforma com a frequência regular. Ela sai para buscar, convidar, servir e acompanhar.”'),
        ],
      },
      {
        titulo: 'II. Uma Escola Sabatina que cuida',
        blocos: [
          txt('O servo recebeu “a tarefa de cuidar da minha casa”. A cena sai do campo e volta para dentro.',
              'O servo fiel sabe quem está fraco, quem está desanimado, quem precisa de ânimo.'),
          bib('Hebreus 10:24-25', 'NBV', 'Em reconhecimento por tudo quanto ele fez por nós, vamos procurar animar uns aos outros a sermos amorosos e praticarmos o bem. Não descuidemos dos nossos deveres na igreja, nem das suas reuniões, como algumas pessoas fazem, mas animemo-nos e nos admoestemos uns aos outros, especialmente agora que o dia da sua volta está se aproximando.'),
          txt('Ninguém cuida daquilo que não conhece.'),
          cit('A Escola Sabatina, quando bem dirigida, possui maravilhoso poder e se destina a realizar uma grande obra, mas presentemente não é o que deveria ser.', CSE + ', p. 9'),
          cit('Se assim sois, cuidareis de vossos alunos, fazendo esforços especiais para sua salvação. A eles vos unireis em amorável simpatia, visitando-os em seu lar e, ao conversar com eles a respeito de sua experiência nas coisas de Deus, haveis de conhecer-lhes a verdadeira condição e, nos braços da fé, os levareis ao trono do Pai.', CSE + ', p. 52-53'),
          lst('Estamos visitando os desanimados?', 'Estamos ligando para quem parou de vir?', 'Estamos firmando os jovens na doutrina?', 'Estamos acompanhando os recém-batizados?', 'Estamos encorajando os mais fracos?'),
          obs('FRASE-ÂNCORA: “Ninguém deveria sumir da Escola Sabatina sem que alguém perceba.”'),
        ],
      },
      {
        titulo: 'III. Uma Escola Sabatina que alimenta',
        blocos: [
          txt('“Dar de comer aos seus conservos dia a dia”: não uma refeição de vez em quando.',
              'Não improvisamos doutrina. Seguimos um plano organizado de estudo.'),
          bib('Salmo 119:105', 'ARA', 'Lâmpada para os meus pés é a tua palavra, e luz para o meu caminho.'),
          bib('João 8:32', 'NBV', 'E conhecerão a verdade, e a verdade os libertará.'),
          cit('A Escola Sabatina é um importante ramo do trabalho missionário, não só porque proporciona a jovens e velhos o conhecimento da Palavra de Deus, mas por despertar neles o amor por suas sagradas verdades e o desejo de estudá-las por si mesmos; ensina-os, sobretudo, a regular sua vida por seus santos ensinos.', CSE + ', p. 10-11'),
          lst('Você estuda a lição todos os dias ou abre a revista no sábado de manhã?', 'Os professores se preparam de joelhos?', 'Os jovens estão sendo firmados na verdade?'),
          obs('FRASE-ÂNCORA: “Uma igreja bem alimentada se mantém firme até o fim.”'),
        ],
      },
      {
        titulo: 'Antiguidade não é fidelidade',
        blocos: [
          txt('Não basta ter história. Não basta ter estrutura.',
              'Tradição, departamento, trimestre e revista podem existir sem fidelidade.'),
          cit('Com a vigilante espera, combinam ativo serviço. Como sabem que o Senhor está às portas, seu zelo é avivado para cooperar com as forças divinas para salvação de almas. Estes são os sábios e fiéis servos que dão ‘o sustento a seu tempo’ à casa do Senhor.', 'Ellen G. White, O Desejado de Todas as Nações, p. 558'),
          obs('FRASE CENTRAL. Falar devagar e repetir mais baixo:',
              '“O Senhor não vai avaliar a nossa antiguidade. Ele vai avaliar a nossa fidelidade presente.”'),
          bib('Mateus 24:46', 'NBV', 'Feliz o servo que seu senhor encontrar fazendo fielmente o seu trabalho.'),
          txt('ENCONTRAR: no momento da chegada. FAZENDO: no presente.',
              'Não “que fez um dia”. Mas que está fazendo quando a porta se abre.'),
        ],
      },
      {
        titulo: 'Chamado',
        blocos: [
          obs('Retomar a história pessoal da abertura: “Alguém fez isso por mim. Hoje é a nossa vez.”'),
          lst('SERVIR na missão externa, buscando os perdidos', 'CUIDAR da missão interna, fortalecendo a casa', 'ALIMENTAR fielmente, pelo estudo sistemático da Palavra'),
          obs('Apelo: convidar a ficar de pé quem quer renovar o compromisso, como membro, professor ou líder de Unidade de Ação.',
              'Oração: 1. coração de servo · 2. olhos atentos aos de dentro de casa · 3. fome da Palavra.'),
          txt('Quando o Senhor voltar, que Ele encontre esta igreja fazendo fielmente o seu trabalho.',
              'Que a Escola Sabatina continue pulsando pela missão até o dia da Sua vinda. Amém.'),
        ],
      },
    ],
  };

  const r = salvarMensagem(msg);
  Logger.log('Sermão importado. id = ' + r.id);
}
