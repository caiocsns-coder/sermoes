# Sermões · organizador de mensagens (GitHub Pages + Google Apps Script)

Contexto do projeto para retomar o trabalho (com o Claude ou sozinho) sem precisar reler o histórico.

## O que é

Web app pessoal para **escrever, organizar e pregar sermões**.
- **Desde 30/out/2026:** a interface é uma página estática publicada no **GitHub Pages**, que pode ser instalada no aparelho e funciona sem internet. O **Google Apps Script** virou só o servidor (API), com a planilha, a Agenda, o Drive e o YouVersion.
- **Antes:** a página era servida pelo HtmlService do Apps Script. A seção "Histórico: HtmlService" explica as regras que vieram dessa época.

A ideia inicial veio de um app de mercado (o "IDE APP"). Em out/2026 a interface foi redesenhada com identidade própria, a direção **"Linha do tempo"**, para não parecer cópia dele. Ver a seção "Identidade visual" mais abaixo.

- **Sermão** (no código, `Mensagem`): tema, pasta, tempo-alvo (20/30/40/50/60/90/120 min) e cultos da Google Agenda ligados a ele.
- **Partes** (no código, `topicos`): ordenáveis e recolhíveis, cada uma com título e tempo previsto. O editor mostra as partes numa linha do tempo.
- **Blocos dentro de cada parte:** Versículo, Parágrafo, Lista, Citação, Imagem e Nota para mim.
- **Modo Pregar:**
  - mostra uma parte por tela, com navegação por botões, deslize e setas;
  - tem ajuste do tamanho da letra;
  - no rodapé, uma barra com uma faixa por parte e um marcador do tempo corrido;
  - tem um cronômetro que compara o tempo corrido com o tempo-alvo (laranja a partir de 85%, fundo vermelho ao estourar; um toque pausa).

O uso principal é no **iPad**, instalado na Tela de Início, e no Chrome do desktop. O dono é um único usuário, e não existe multiusuário: só a conta Google dona do script entra.

O primeiro conteúdo carregado é o sermão **"Servindo em Sua Casa até que Ele Venha"** (174 anos da Escola Sabatina, out/2026), via `src/Seed.gs`. Outros sermões entram pelo botão **Importar** da lista, com um arquivo `.sermao.json` (ver "Arquivo .sermao.json"), que é o que a skill `exportar-sermao-app` gera.

## Estrutura

```
sermoes/                      (repositório do GitHub)
├─ CONTEXT.md                 ← este arquivo
├─ README.md                  ← passo a passo de publicação
├─ config.json                ← apiUrl (link /exec) e googleClientId; não são segredos
├─ package.json               ← npm run setup | build | test
├─ src/                       ← o que vai para o Apps Script (colar no editor)
│  ├─ Code.gs                 ← servidor: doPost (API), login, sessões, planilha, Agenda, Drive, YouVersion
│  ├─ Seed.gs                 ← importarSermao174(): carrega o sermão de exemplo
│  └─ appsscript.json         ← manifesto (fuso SP, V8, webapp "Qualquer pessoa")
├─ web/                       ← FONTE da página
│  ├─ index.src.html          ← interface (pode usar template literals; o build converte)
│  ├─ sw.js                   ← service worker: cópia das telas para abrir sem internet
│  ├─ manifest.webmanifest    ← app instalável
│  └─ icons/                  ← ícones (192, 512, 512 maskable, apple-touch 180)
├─ docs/                      ← GERADO pelo build; é a pasta que o GitHub Pages publica
└─ tools/
   ├─ build.js                ← gera docs/: Babel (sem template literals) + config + versão do sw.js
   ├─ mock-server.js          ← API simulada (mesmas regras do Code.gs)
   └─ test.js                 ← teste de ponta a ponta no Chromium (Playwright)
```

No editor do Apps Script ficam só **Código.gs** (ou Code.gs) e **Seed.gs**. O arquivo **Index** foi apagado na troca de 30/out/2026.

## Arquitetura (GitHub Pages + API no Apps Script)

- **Página:** `https://<usuário>.github.io/<repositório>/`, publicada da pasta `docs/` do branch `main` (Settings → Pages → Deploy from a branch → `main` / `/docs`). Funciona instalada (Compartilhar → Adicionar à Tela de Início).
- **API:** o link `/exec` da implantação do Apps Script. A página chama `fetch(apiUrl, { method: 'POST', body: JSON })` com `Content-Type: text/plain`, para evitar a checagem prévia de CORS que o Apps Script não responde. O Apps Script devolve JSON pelo `ContentService`.
- **Protocolo do `doPost`:** corpo `{ fn, args, sessao }`, resposta `{ ok: true, data }` ou `{ ok: false, erro, auth? }`. Funções de acesso tratadas antes da lista branca: `entrar` (`token`), `entrarComCodigo` (`codigo`), `gerarCodigo` (`sessao`) e `sair` (`sessao`). Só as funções da lista branca `API` (dentro do `doPost`) podem ser chamadas. As funções com `_` no fim do nome são internas e nunca são expostas.
- **Implantação:** App da Web, **Executar como: eu**, **Quem pode acessar: Qualquer pessoa**. Quem protege os dados é o login, não a implantação.
- **Login com Google (Google Identity Services):**
  1. A página mostra o botão "Fazer login com o Google" (`accounts.google.com/gsi/client`, com o `googleClientId` do `config.json`).
  2. O ID token vai para `doPost({ fn: 'entrar', token })`. O `verificarLogin_` confere o token em `oauth2.googleapis.com/tokeninfo`: `aud` = `GOOGLE_CLIENT_ID`, emissor do Google, não vencido, e e-mail verificado igual a `DONO_EMAIL` (ou à conta dona do script).
  3. O servidor abre uma **sessão de 30 dias** (`abrirSessao_`). Só o hash dela fica nas Propriedades do script (`sessao_…`); a página guarda a sessão no `localStorage` (`sermoes.sessao`).
  4. O ID token do Google vale só 1 hora; a sessão própria evita pedir login a cada hora no iPad.
  5. Sessão vencida ou removida: a API responde `auth: true`, a página mostra o login de novo e repete a chamada.
  6. **Código de pareamento (app instalado no iPad):** no app da Tela de Início o iOS isola o armazenamento, e a janela do Google não devolve o login (confirmado no iPad em 30/out/2026). Por isso:
     - num aparelho já conectado (Safari ou computador), "Conectar outro aparelho", no rodapé da lista, chama `gerarCodigo` (exige sessão). O servidor cria um código de 6 dígitos de uso único, válido por 10 minutos (`CacheService`);
     - no app instalado, a tela de entrada já mostra o campo do código (`instalado()` detecta `navigator.standalone` / `display-mode: standalone`); em outros aparelhos, o link "Entrar com código de outro aparelho" mostra o campo;
     - `entrarComCodigo` troca o código por uma sessão de 30 dias;
     - limite: 10 códigos errados a cada 10 minutos; depois disso, bloqueia por 10 minutos.
  7. `sair` apaga a sessão do aparelho. Para derrubar todas as sessões (por exemplo, se perder o iPad), rode `encerrarTodasAsSessoes()` no editor.
- **Propriedades do script:** `GOOGLE_CLIENT_ID` (obrigatória), `DONO_EMAIL` (opcional), `APP_URL` (opcional, link mostrado por quem abrir o `/exec`), `YOUVERSION_KEY`, `PLANILHA_ID` (criada sozinha) e `sessao_…` (criadas sozinhas).
- **Sem internet (no aparelho):**
  - o service worker guarda as telas, o manifesto, os ícones e as fontes;
  - a página guarda no `localStorage` a lista (`sermoes.lista`), cada sermão aberto (`sermoes.msg.<id>`) e as pendências (`sermoes.pend`);
  - toda edição é copiada no aparelho em 300 ms e enviada ao servidor 2,5 s depois. Sem conexão, fica pendente ("Salvo no aparelho · envia quando a internet voltar"), e `sincronizar()` envia tudo no evento `online`, ao voltar para o app e ao abrir;
  - sermão criado sem internet usa a chave `_local` (`local-<timestamp>`) até ganhar o id do servidor;
  - a proteção contra conflito vale também para o que estava pendente;
  - sem internet não funcionam: buscar versículo, ligar culto, enviar imagem, duplicar e excluir;
  - um sermão só abre sem internet se já tiver sido aberto naquele aparelho.

## Regras do código

1. **Template literals:** o build converte crases e `${}` em concatenação (`docs/index.html` sai sem nenhuma). Isso deixou de ser obrigatório fora do HtmlService, mas foi mantido como regra do projeto. Edite sempre `web/index.src.html` e rode `npm run build`; o teste falha se sobrar crase.
2. **Nada de globais soltas.** Todo o JavaScript da página fica dentro de uma IIFE com `'use strict'`. A configuração entra por `<meta name="sermoes:api">` e `<meta name="sermoes:client">`, não por variáveis globais.
3. **Mostrar erros na tela.** O primeiro `<script>` captura `error` e `unhandledrejection` e mostra uma faixa vermelha com a mensagem. Esse bloco nunca deve ser removido; o teste verifica que ele existe.
4. **Implantações do Apps Script são congeladas.** Depois de mudar o `Code.gs`, use **Gerenciar implantações → lápis → Nova versão**, mantendo "Qualquer pessoa". O link `/exec` continua o mesmo, então o `config.json` não muda.
5. **Datas trafegam como string ISO** entre servidor e página.
6. **`localStorage` sempre em `try/catch`** (objeto `local`), porque pode falhar em navegação privada ou com o espaço cheio.

## Histórico: HtmlService (até 29/out/2026)

A página era servida por `doGet` com `HtmlService.createHtmlOutputFromFile('Index')`, dentro de uma moldura (iframe) do Google. Problemas daquela época, todos resolvidos com a mudança para o GitHub Pages:
- template literals aninhados quebravam no `document.write` do Google;
- nomes globais coincidentes com os scripts do Google derrubavam a página;
- com várias contas Google logadas, a página ficava em branco;
- aparecia o aviso "O Google não verificou este app";
- a moldura bloqueava a Wake Lock API (tela acesa);
- não dava para instalar o app nem usar sem internet.

## Modelo de dados

```js
Mensagem = {
  id: string,            // UUID (Utilities.getUuid)
  tema: string,
  pasta: string,         // texto livre; a lista agrupa por pasta
  tempo: number,         // minutos
  eventos: [{ id, titulo, data /* ISO */ }],
  topicos: [{
    titulo: string,
    blocos: Bloco[],
    tempo?: number,      // minutos previstos para a parte, definidos pelo usuário (opcional, out/2026)
    _open?: boolean      // só na interface; o servidor descarta
  }],
  atualizado: string     // ISO, definido pelo servidor ao salvar; também serve de "versão" contra conflitos
}

// Só no envio para salvarMensagem (não é gravado):
//   _sobrescrever?: true  → ignora a checagem de conflito (o usuário escolheu manter a versão dele)

Bloco =
  | { tipo: 'biblico', ref, versao, texto, copyright? }
      // versão padrão: 'NBV'; copyright vem preenchido pela busca no YouVersion (atribuição exigida pela licença)
  | { tipo: 'lista',   itens: string[] }
  | { tipo: 'texto',   texto }
  | { tipo: 'citacao', texto, fonte }
  | { tipo: 'imagem',  url, legenda }         // url do Drive (thumbnail) ou externa
  | { tipo: 'obs',     texto }                // nota do pregador; discreta no modo Pregar
```

Na interface, `Mensagem` aparece como **Sermão** e `topicos` como **Partes**. Os nomes no código e na planilha não mudaram.

Para criar um tipo de bloco novo, é preciso mexer em três lugares do `web/index.src.html`:
- a entrada no objeto `TIPOS` (nome, `atalho` de uma letra para a paleta, ícone e `novo()`). A ordem das chaves define a ordem da paleta "Inserir";
- um `case` em `vBloco()`, para a edição;
- um `case` em `vLeitura()`, para o modo Pregar.

## Armazenamento atual

Os dados ficam numa **planilha do Google**, na aba `Mensagens`, com uma linha por sermão:

| id | tema | pasta | tempo | dados (JSON de `eventos` + `topicos`) | atualizado |
|----|------|-------|-------|----------------------------------------|------------|

- Se o script foi criado a partir de uma planilha, ele usa essa planilha.
- Se é avulso, cria "Sermões · banco de dados" no primeiro uso e guarda o ID em `ScriptProperties.PLANILHA_ID`.
- Todas as colunas usam formato de texto (`@`), para o Sheets não converter valores.
- **Limite:** cerca de 50 mil caracteres por célula. `salvarMensagem` recusa acima de 49 mil (`LIMITE_DADOS`), com uma mensagem clara. O editor mostra quanto do limite já foi usado ("x% do espaço", em laranja a partir de 80%).
- `salvarMensagem` e `excluirMensagem` usam `LockService.getScriptLock()`.
- **Conflito entre aparelhos:** `salvarMensagem` compara o `atualizado` enviado com o da planilha. Se forem diferentes, alguém salvou antes em outro aparelho, e ele lança um erro que começa com `CONFLITO:`. A página pergunta se quer manter a versão local (reenvia com `_sobrescrever: true`) ou descartar as alterações locais e abrir a versão salva.
- `obterMensagem` devolve uma mensagem clara, com linha e coluna, se o JSON da célula estiver corrompido.

### Decisão em aberto: migrar para JSON no Drive

A opção recomendada é guardar **um arquivo `.json` por sermão** numa pasta "Sermões" do Drive.
- **Vantagens:** acaba o limite de 50 mil caracteres, cada sermão vira um arquivo que dá para copiar ou compartilhar, e o backup vem com o Drive.
- **Custo:** a listagem fica mais lenta com muitos arquivos. A solução é manter um índice leve num arquivo `_index.json` ou no `CacheService`.
- **Impacto:** a troca é **só no `Code.gs`**. Basta manter as mesmas assinaturas da API abaixo, e o `Index` não muda.
- **Alternativas descartadas:**
  - PropertiesService: o limite de cerca de 9 KB por valor é pequeno demais para um sermão.
  - Google Docs como banco: o formato é frágil.
  - Banco externo (Firebase/Supabase): só faz sentido se um dia houver multiusuário.

## Arquivo .sermao.json (importar e exportar)

Formato de troca de sermões entre o app, backups e o Claude (skill `exportar-sermao-app`). Não passa pelo servidor: a página lê e grava o arquivo, e o salvamento normal (`salvarMensagem`) cuida do resto.

```json
{
  "formato": "sermoes/1",
  "exportado": "2026-10-30T14:00:00.000Z",
  "sermao": {
    "tema": "…", "pasta": "…", "tempo": 40,
    "topicos": [ { "titulo": "…", "tempo": 5, "blocos": [ { "tipo": "texto", "texto": "…" } ] } ]
  }
}
```

- **`formato`:** `sermoes/<versão>`. A página aceita a versão 1 e recusa versões maiores com o aviso "atualize o app". Se o modelo de dados mudar de forma incompatível, suba para `sermoes/2` e mantenha a leitura da 1.
- **`sermao`:** o modelo `Mensagem` sem `id`, `atualizado` e `eventos` (cultos são da agenda de cada um e não viajam no arquivo). O arquivo também é aceito sem o envelope (só o objeto do sermão).
- **Exportar** (ícone de download no editor): no iPad abre a folha de compartilhamento (Salvar em Arquivos, AirDrop, e-mail); no computador baixa `<tema-em-slug>.sermao.json`. Os blocos vão inteiros, inclusive o `copyright` dos versículos.
- **Importar** (botão "Importar" na lista, `lerArquivoSermao()` e `normalizarBloco()`):
  - só os campos conhecidos de cada tipo entram;
  - tipo desconhecido com `texto` vira Parágrafo, e sem texto é ignorado (com aviso);
  - tempo fora de 20/30/40/50/60/90/120 vai para o mais próximo (com aviso);
  - passa pelo mesmo limite de 49 mil caracteres;
  - tema repetido pergunta se quer importar como cópia (" (importado)");
  - o sermão abre no editor como novo (`_local`) e é salvo pelo salvamento automático, inclusive sem internet;
  - o aviso final conta os versículos sem texto, para tocar em **Buscar**.

## API do servidor (`Code.gs`)

Chamadas pela página via `doPost` (ver "Arquitetura"); também podem ser rodadas direto no editor do Apps Script.

| Função | Retorno | Observação |
|---|---|---|
| `doGet()` | HtmlOutput | só um aviso de que a interface está no GitHub Pages, com o link de `APP_URL` |
| `doPost(e)` | JSON | porta de entrada da API: `entrar`, `sair` e as funções da lista branca |
| `listarMensagens()` | `[{id, tema, pasta, tempo, nTopicos, atualizado, busca}]` | ordenado por `atualizado` decrescente; `busca` (out/2026) traz os títulos das partes e as referências bíblicas, até 2 mil caracteres, para a busca da lista |
| `obterMensagem(id)` | `Mensagem` | lança um erro se não existir |
| `salvarMensagem(msg)` | `{id, atualizado}` | cria um registro se `msg.id` vier vazio; lança `CONFLITO: …` se `msg.atualizado` não bater com a planilha (exceto com `msg._sobrescrever`); guarda o `tempo` das partes |
| `excluirMensagem(id)` | `true` | com lock |
| `duplicarMensagem(id)` | `{id, atualizado}` | acrescenta " (cópia)" ao tema |
| `listarEventos()` | `[{id, titulo, data}]` | agenda padrão, de 7 dias atrás até 90 dias à frente, no máximo 80 eventos |
| `enviarImagem(dataUrl, nome)` | URL | salva em "Sermões · imagens" no Drive, compartilhada por link, e devolve `drive.google.com/thumbnail?id=…&sz=w1600` |
| `buscarVersiculo(ref, versao)` | `{texto, referencia, versao, copyright}` | **nova (out/2026)**; busca o texto no YouVersion Platform. Lança um erro em português quando a referência não é entendida, a versão não está no catálogo ou ainda não tem licença |

**Escopos pedidos na primeira execução:** Planilhas, Drive, Agenda e "conectar a serviço externo" (`UrlFetchApp`, para o YouVersion e para conferir o login no Google). Não há `oauthScopes` no manifesto: o Apps Script detecta os escopos sozinho. A imagem é reduzida no navegador para no máximo 1600 px, em JPEG com qualidade 0.85, antes do envio.

## Busca de versículos (YouVersion Platform)

- **Conta:** individual, "Non Profit", no portal platform.youversion.com. A App Key fica em **Propriedades do script → `YOUVERSION_KEY`**, nunca no código, no zip ou neste arquivo. A documentação do YouVersion diz que a chave não é segredo, mas ela fica fora do código mesmo assim.
- **Chamada:** feita sempre pelo servidor (`UrlFetchApp`), com o cabeçalho `X-YVP-App-Key`. O endpoint é `GET /v1/bibles/{id}/passages/{USFM}?format=text`, e a resposta vem como `{ id, content, reference }`. O copyright vem de `GET /v1/bibles/{id}`, guardado 6 h no `CacheService`.
- **Versões (`YV_VERSOES` no `Code.gs`):**

  | Sigla no bloco | id | Situação em 21/out/2026 |
  |---|---|---|
  | NBV (ou NBV-P) | 1966 | liberada pela Biblica Fast-track Bible License v1 (aceita em 21/out/2026) |
  | NVI | 129 | mesma licença (testada: funciona) |
  | NVI 2011 (ptNVI, português do Brasil) | 4360 | mesma licença |
  | OL, O Livro (português de Portugal) | 1967 | mesma licença |
  | BLT, Bíblia Livre Para Todos | 3254 | liberada |
  | ARA, NAA | – | **fora do catálogo** (Sociedade Bíblica do Brasil): preencher à mão |

  Quando o portal liberar uma licença, a versão passa a funcionar sem mudar o código. O bloco também aceita o id numérico direto no campo Versão.
- **Referências:** `referenciaUsfm_` entende os 66 livros por nome ou abreviação em português (com ou sem acento, "1 Co", "I Co", "1Co"), com ":", "." ou "," entre capítulo e versículo, intervalos e listas ("Jo 3:16,18"). "Jo" é João, e "Jó" ou "Job" é Jó. Um trecho que passa de um capítulo para outro ("Gn 1:26-2:3", até 5 capítulos) é dividido pelo servidor, porque a API só aceita intervalos dentro de um capítulo:
  - do versículo inicial até o fim do capítulo: tenta `…v-176`; se a API recusar, busca versículo por versículo em paralelo (`UrlFetchApp.fetchAll`) até o primeiro que não existir;
  - os capítulos do meio, inteiros;
  - o último capítulo, do versículo 1 até o final.

  Nesse caso a referência que volta é a digitada.
- **Interface:** no bloco Versículo, o botão "Buscar" (ou Enter na referência ou na versão) preenche o texto, que continua editável. O campo Versão sugere NBV, NVI, NVI 2011, BLT, OL, ARA e NAA (`<datalist id="versoes">`); se ficar vazio, usa NBV. Antes de substituir um texto já escrito, o app pede confirmação. O copyright aparece embaixo do versículo no editor e no modo Pregar.
- **Licença:** respeitar os termos do YouVersion e de cada editora, sempre com atribuição. O texto buscado fica salvo dentro do sermão, na planilha.

## Interface (`web/index.src.html`)

- **Base:** JavaScript puro, sem framework. Tem um estado único `S` com:
  - `view` (`lista`, `editor` ou `pregar`);
  - `lista`, `carregando` e `filtro` (busca da lista);
  - `msg`, `dirty`, `salvando`, `rev` (conta as edições, para saber se houve mudança durante um salvamento), `sobrescrever` e `conflito`;
  - `modal` (agenda), `ins` (paleta "Inserir" aberta: `{ ti, q }`) e `sel` (bloco selecionado, `"ti:bi"`);
  - `pr` (modo Pregar: `i`, `acum`, `inicio`, `marca`, `fs`, `tp` = milissegundos passados em cada parte, `prev` = minutos previstos), `timerId`, `wake` e `avisouTela`;
  - `offline` (sem conexão com o servidor) e `sincronizando`.
- **Servidor:** `run(fn, ...args)` chama a API por `fetch` (`chamar()`), pede login quando não há sessão (`pedirLogin()`, tela `#login`) e lança erro com `rede: true` quando não há conexão. Funções de login: `aoEntrar`, `iniciarGoogle`, `mostrarLogin`, `esconderLogin`, `mostrarConfig` (config.json não preenchido).
- **Aparelho:** objeto `local` (`localStorage` protegido), `guardarMsg`, `marcarPendente`, `pendentes`, `guardarLocal` (cópia 300 ms após cada edição) e `sincronizar()`.
- **Renderização:** as funções `vLista`, `vResultados`, `vDestaque`, `vEditor`, `vParte`, `vPaleta`, `vBloco`, `vPregar`, `vLeitura` e `vModal` devolvem strings HTML, e `render()` troca o `innerHTML`. Todo texto do usuário passa por `esc()`.
- **Telas:**
  - **Lista:** título "Sermões", busca por tema, pasta, título de parte ou referência bíblica (campo `busca` do servidor) e botão "Novo sermão". O sermão editado por último aparece em destaque, com uma barra de partes; os demais aparecem agrupados por pasta. Com a busca ativa, não há destaque.
  - **Editor:**
    - o tema é um título grande editável;
    - pasta, duração (`<select>`) e cultos ligados aparecem em "pílulas";
    - a linha do tempo tem uma faixa por parte, com largura proporcional aos minutos previstos (`temposPartes()`); tocar numa faixa abre a parte; com uma parte só, a barra não aparece;
    - embaixo dela, a legenda mostra "N partes · previsto X de Y min · Z% do espaço" (`vLinhaCap()`), em laranja quando o previsto passa do alvo ou o espaço passa de 80%. `atualizarLinha()` atualiza a barra, a legenda e as estimativas a cada edição, sem re-renderizar;
    - **tempo por parte:** cada parte aberta tem um campo "min". Vazio, o app estima: o que sobra do alvo depois das partes com tempo definido é dividido pelo número de palavras faladas (notas para mim não contam; mínimo de 15 palavras por parte);
    - as partes ficam numa linha vertical numerada, e só as abertas mostram os blocos;
    - no fim de cada parte aberta há o campo "Escreva aqui ou digite / para inserir" e um botão "+";
    - **blocos:** os botões subir/descer/remover só aparecem no bloco selecionado (tocar no bloco ou focar um campo dele: `selecionar()`, classe `.sel`), ou com `:focus-within`.
  - **Pregar:**
    - texto grande; no rodapé, a barra de partes (largura pelos minutos previstos), o marcador `#playhead` do tempo total, o cronômetro, "Nesta parte mm:ss de X min" (`#tparte`, laranja ao passar do previsto) e o botão com o título da próxima parte;
    - **tela acesa:** pede a Wake Lock API ao entrar e de novo ao voltar para o app (fora do iframe, o iPad com iOS 16.4 ou mais novo aceita). Se o navegador recusar, mostra uma vez a dica de desligar o Bloqueio Automático do iPad.
  - **Importar e exportar:** botão "Importar" na lista e ícone de download no editor (ver "Arquivo .sermao.json").
  - **Rodapé da lista (`vConta()`):** "Conectado como …", "Conectar outro aparelho" (mostra o código num modal, `S.modal.tipo = 'codigo'`) e "Sair deste aparelho".
  - **Entrada:** tela "Sermões" com o botão do Google e a entrada por código (`entrarComCodigo()`, `concluirLogin()`); sem internet e com cópia no aparelho, oferece "Usar o que está salvo no aparelho". Na lista, o ícone de sair encerra a sessão do aparelho.
- **Inserir blocos:**
  - "+" abre e fecha a paleta;
  - digitar "/" abre a paleta e as letras seguintes filtram (`/v` Versículo, `/p` Parágrafo, `/l` Lista, `/c` Citação, `/i` Imagem, `/n` Nota para mim);
  - Enter escolhe o primeiro tipo da paleta;
  - texto livre + Enter cria um Parágrafo com esse texto;
  - Esc fecha a paleta.
- **Eventos:** por delegação.
  - `click` usa `[data-a="ação"]`, com `data-t` (parte), `data-b` (bloco), `data-v` e `data-i`.
  - `input` usa `[data-f="campo"]` e só atualiza o estado, sem re-renderizar, para não perder o foco. O campo `ins` só atualiza a paleta (`atualizarPaleta`).
  - Ações estruturais (adicionar, mover, excluir) re-renderizam.
  - **Desfazer:** excluir uma parte ou um bloco acontece na hora, sem janela de confirmação, e o aviso embaixo oferece "Desfazer" por 6 segundos (`toast(txt, erro, { rotulo, fn })`). Excluir um sermão continua pedindo confirmação, porque apaga no servidor.
- **Atalhos:**
  - Ctrl/Cmd+S salva.
  - Num bloco Lista, Enter cria o próximo item e Backspace num item vazio o apaga.
  - Enter no tema não quebra linha.
  - No modo Pregar, as setas e PageUp/PageDown trocam de parte e Esc sai.
- **Salvamento:**
  - **automático:** 2,5 s depois da última edição (`ESPERA_AUTO`, `agendarAuto()`), e na hora quando o app vai para segundo plano (`visibilitychange` ou `pagehide`). Se falhar, tenta de novo em 15 s;
  - também manual, pelo botão ou pelo Ctrl+S;
  - o indicador mostra "Salvando em instantes…", "Salvando…", "Salvo às HH:MM" ou, sem internet, "Salvo no aparelho · envia quando a internet voltar" (em laranja); na lista, os sermões pendentes aparecem como "não enviado";
  - "Voltar" e "Pregar" salvam antes, se houver alterações; se falhar, perguntam se quer continuar mesmo assim;
  - em caso de conflito, `resolverConflito()` pergunta qual versão manter (ver "Armazenamento");
  - não há mais aviso ao fechar a página: a cópia no aparelho é enviada na próxima abertura.
- **Identidade visual ("Linha do tempo"):**
  - escuro grafite-violeta com acento azul-céu. Variáveis CSS:
    - fundos: `--bg #131218`, `--bg2 #0f0e13` (modo Pregar);
    - superfícies: `--s1 #1c1b23`, `--s2 #25232e`, `--s3 #3b3848`;
    - borda: `--bd #2f2c3a`;
    - texto: `--tx #efecf5`, `--mu #a19bb0`;
    - acento: `--ac #82b8ff`, `--ac2 #5d8fd6`, `--acd #17223a` (fundo azul escuro), `--acx #0b1830` (texto sobre o acento), `--feito #3b4f73` (partes já pregadas);
    - alertas: `--warn #ffb86b`, `--dan #ff6b5b`;
  - fontes do Google Fonts: Bricolage Grotesque (`--fd`, títulos) e Atkinson Hyperlegible (`--fb`, texto, pensada para leitura fácil), com fallback para a fonte do sistema;
  - botões arredondados em "pílula", com alvos de toque de no mínimo 36 a 44 px;
  - ícones em SVG inline, no traço do Lucide;
  - **evitar** voltar a elementos do app de referência: preto puro com amarelo, tópicos em sanfona âmbar, grade de quadrados de "ferramentas" e chips de tempo.
- **App instalado:** `manifest.webmanifest`, ícones, `theme-color` e as margens seguras do iPad (`env(safe-area-inset-*)`) na barra do topo e no rodapé do Pregar.
- **Responsivo:** abaixo de 760 px:
  - a busca vai para uma linha própria e a linha vertical das partes fica mais estreita;
  - no modo Pregar, as faixas perdem o texto e o botão "próxima" mostra só a seta.
- **Idioma:** toda a interface e as mensagens estão em português do Brasil.

## Fluxo de trabalho

```bash
npm run setup               # uma vez: Babel + Playwright 1.56.1 (versão fixa) + o Chromium dele
# editar web/index.src.html e/ou src/Code.gs
npm run build               # gera docs/ (página sem template literals, config preenchida, nova versão do sw.js)
npm test                    # build + teste de ponta a ponta no Chromium, com API e login simulados;
                            # cobre: login, código de pareamento, inserir blocos (3 jeitos), busca de versículo, seleção, desfazer,
                            # tempo por parte, salvamento automático, conflito, sessão vencida,
                            # busca na lista, importar/exportar .sermao.json,
                            # modo sem internet (editar, criar e sincronizar) e Pregar
git add -A && git commit -m "…" && git push   # o GitHub Pages publica docs/ em cerca de 1 minuto
```

- **Mudou a página:** build, teste e push. No iPad, a versão nova aparece ao abrir o app com internet (o service worker busca a página na rede primeiro).
- **Mudou o `Code.gs`:** cole no editor do Apps Script e crie uma **Nova versão** da implantação. O link `/exec` não muda.

**Opcional:** usar o [`clasp`](https://github.com/google/clasp) para sincronizar `src/` com o projeto Apps Script pela linha de comando (`clasp push`), com `rootDir: "src"`.

## Instalação do zero

O passo a passo completo, com prints do que procurar, está no `README.md`. Resumo:
1. **Apps Script:** crie uma planilha, abra **Extensões → Apps Script**, cole `Code.gs`, `Seed.gs` e o manifesto `appsscript.json`, e execute `importarSermao174` uma vez para autorizar.
2. **Google Cloud:** crie um ID do cliente OAuth do tipo **Aplicativo da Web**, com a origem JavaScript `https://<usuário>.github.io`.
3. **Propriedades do script:** `GOOGLE_CLIENT_ID`, `YOUVERSION_KEY` e, se quiser, `DONO_EMAIL` e `APP_URL`.
4. **Implantação:** App da Web, "Executar como: eu" e "Quem pode acessar: Qualquer pessoa". Copie o link `/exec`.
5. **config.json:** preencha `apiUrl` (o link `/exec`) e `googleClientId`, rode `npm run build` e faça o push.
6. **GitHub Pages:** Settings → Pages → `main` / `/docs`.
7. **iPad:** abra o link do Pages no Safari, entre com o Google e use **Compartilhar → Adicionar à Tela de Início**.

## Ideias para depois (não implementadas)

- Migrar o armazenamento para JSON no Drive (ver a decisão em aberto acima).
- Exportar a mensagem para Google Docs ou PDF, no formato de roteiro com marcações de slide.
- Marcadores de slide em cada bloco (por exemplo, `slide: 12`), para integrar com o PowerPoint do sermão.
- Modo claro, opcional.
- Se a Wake Lock API ainda falhar no iPad instalado, testar a alternativa de um vídeo mudo em loop (técnica do NoSleep.js).
- Guardar sem internet também as imagens dos sermões (hoje elas vêm do Drive e precisam de conexão).
- Arrastar para reordenar partes e blocos, no lugar das setas.

## Convenções de conteúdo (herdadas do projeto da igreja)

- **Ellen G. White:** só citação **literal**, com livro e página, nunca paráfrase. Fontes em inglês levam o original ao lado da tradução.
- **Versão bíblica padrão: NBV** (Nova Bíblia Viva). Quando outra versão for usada, ela é indicada no campo `versao`.
- **Frases-âncora** ficam em blocos de Observação ou Texto, marcadas como "FRASE-ÂNCORA".
