/**
 * Sermões · servidor (Google Apps Script), usado como API pela página no GitHub Pages.
 *
 * Os dados ficam numa planilha: aba "Mensagens", uma linha por sermão.
 * - Script criado a partir de uma planilha (Extensões > Apps Script): usa essa planilha.
 * - Script avulso (script.google.com): cria a planilha "Sermões · banco de dados" no primeiro uso.
 *
 * Implantação: App da Web, "Executar como: eu", "Quem pode acessar: Qualquer pessoa".
 * Quem protege os dados é o login com Google (verificarLogin_), não a implantação.
 * Propriedades do script usadas: GOOGLE_CLIENT_ID, DONO_EMAIL (opcional), APP_URL (opcional),
 * YOUVERSION_KEY, PLANILHA_ID (criada sozinha).
 */

const ABA = 'Mensagens';
const COLUNAS = ['id', 'tema', 'pasta', 'tempo', 'dados', 'atualizado'];
const PASTA_IMAGENS = 'Sermões · imagens';
