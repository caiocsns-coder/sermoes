# Sermões

App pessoal para escrever, organizar e pregar sermões.
- **Interface:** página no GitHub Pages, instalável no iPad e funcionando sem internet.
- **Servidor:** Google Apps Script, com a planilha, a Agenda, o Drive e o YouVersion.

Detalhes de arquitetura, dados e decisões: [`CONTEXT.md`](CONTEXT.md).

## Publicar (primeira vez)

Troque `USUARIO` pelo seu usuário do GitHub e `sermoes` pelo nome do repositório, se for outro.

### 1. Google Cloud: ID do cliente para o login com Google
1. Abra <https://console.cloud.google.com/>, clique no seletor de projeto (no topo) e crie o projeto **Sermões**.
2. No menu, abra **APIs e serviços → Tela de consentimento OAuth** (em algumas contas aparece como **Google Auth Platform**). Clique em **Começar** e preencha:
   - nome do app: `Sermões`, com o seu e-mail de suporte;
   - público: **Externo**;
   - informações de contato: o seu e-mail.
3. Em **Público** (ou "Usuários de teste"), adicione o seu e-mail. Enquanto o app estiver "Em teste", só os e-mails dessa lista conseguem entrar, que é o que queremos.
4. Em **Clientes** (ou **Credenciais → Criar credenciais → ID do cliente OAuth**), crie um cliente:
   - tipo: **Aplicativo da Web**;
   - nome: `Sermões web`;
   - **Origens JavaScript autorizadas:** `https://USUARIO.github.io` (sem barra e sem o nome do repositório no fim);
   - URIs de redirecionamento: deixe em branco.
5. Copie o **ID do cliente**, que termina em `.apps.googleusercontent.com`. Não é preciso a chave secreta.

### 2. Apps Script: virar API
1. No editor do Apps Script, substitua o **Código.gs** pelo `src/Code.gs` e **apague o arquivo Index**.
2. Em **Configurações do projeto**, marque "Mostrar o arquivo de manifesto appsscript.json", abra o `appsscript.json` e cole o `src/appsscript.json`.
3. Ainda em **Configurações do projeto → Propriedades do script**, adicione:
   - `GOOGLE_CLIENT_ID`: o ID copiado no passo 1;
   - `APP_URL`: `https://USUARIO.github.io/sermoes/`;
   - `DONO_EMAIL` (opcional): o e-mail que pode entrar. Sem ela, vale a conta dona do script;
   - `YOUVERSION_KEY` já deve estar lá.
4. Abra **Implantar → Gerenciar implantações → lápis** e configure:
   - Versão: **Nova versão**;
   - Executar como: **Eu**;
   - Quem pode acessar: **Qualquer pessoa**.

   Depois, clique em **Implantar** e autorize, se o Google pedir.
5. Copie o **URL do app da Web**, que termina em `/exec`. É o mesmo link de antes.

> "Qualquer pessoa" significa que qualquer um consegue *chamar* o endereço, mas o servidor só responde a quem entrou com a sua conta Google.

### 3. Repositório e GitHub Pages
1. Preencha o `config.json` com o `apiUrl` (o link `/exec`) e o `googleClientId`.
2. Rode `npm run setup` (só na primeira vez) e depois `npm test`.
3. Faça `git add -A`, `git commit` e `git push` no branch `main`.
4. No GitHub, abra **Settings → Pages → Build and deployment**, escolha **Deploy from a branch** e selecione `main` com a pasta `/docs`. Salve.
5. Em cerca de 1 minuto o app estará em `https://USUARIO.github.io/sermoes/`.

### 4. iPad
1. Apague o atalho antigo da Tela de Início (o do link `/exec`).
2. Abra `https://USUARIO.github.io/sermoes/` no Safari e entre com o Google.
3. Toque em **Compartilhar → Adicionar à Tela de Início**.
4. Ainda no Safari, role a lista até o fim e toque em **Conectar outro aparelho**. Anote o código de 6 dígitos.
5. Abra pelo ícone novo e digite o código. (No app instalado, o login do Google não completa; o código resolve.)
6. Abra uma vez cada sermão que quiser ter disponível sem internet.

## Dia a dia
- **Mudou a página** (`web/`): `npm test` e depois `git push`. A versão nova chega ao iPad na próxima vez que o app abrir com internet.
- **Mudou o servidor** (`src/Code.gs`): cole no Apps Script e crie uma **Nova versão** da implantação.
- **Importar um sermão escrito com o Claude:** baixe o `.sermao.json` gerado pela skill `exportar-sermao-app` e toque em **Importar** na lista do app.
- **Backup ou compartilhar um sermão:** no editor, toque no ícone de download. No iPad abre a folha de compartilhamento (Salvar em Arquivos, AirDrop…).
- **Backup automático:** execute `instalarBackupSemanal` uma vez no editor do Apps Script. Toda segunda às 4h, cada sermão vira um `.sermao.json` em "Sermões · backups" no Drive (ficam as 8 últimas semanas). Para restaurar um, importe o arquivo pelo app.
- **Voltar uma versão ou recuperar um sermão excluído:** no editor, use a pílula **Versões**; na lista, use **Lixeira** no rodapé.
- **Perdeu um aparelho:** execute `encerrarTodasAsSessoes` no editor do Apps Script. Todos os aparelhos vão pedir login de novo.
