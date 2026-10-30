/* Configuração vinda das <meta> preenchidas pelo build (config.json). */

/* preenchidas pelo build (config.json); vazias = configuração pendente */
export const meta = n => { const m = document.querySelector('meta[name="' + n + '"]'); const v = m ? m.content.trim() : ''; return /^\{\{/.test(v) ? '' : v; };

export const CFG = { api: meta('sermoes:api'), client: meta('sermoes:client') };
