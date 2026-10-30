/* Sermões · service worker: guarda as telas do app no aparelho para abrir sem internet.
 * Os dados (sermões) NÃO passam por aqui: ficam no localStorage da página e no servidor.
 * VERSAO é trocada pelo build a cada publicação, o que descarta as cópias antigas.
 */
var VERSAO = '800a4bb90f';
var CACHE_APP = 'sermoes-app-' + VERSAO;
var CACHE_FONTES = 'sermoes-fontes';
var ARQUIVOS = ['./', 'index.html', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE_APP).then(function (c) { return c.addAll(ARQUIVOS); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (nomes) {
    return Promise.all(nomes.filter(function (n) { return n.indexOf('sermoes-app-') === 0 && n !== CACHE_APP; })
      .map(function (n) { return caches.delete(n); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return; // a API (POST) e o login do Google vão direto para a rede
  var url = new URL(req.url);

  /* páginas: tenta a rede (versão nova) e cai na cópia quando não há internet */
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then(function (r) {
      var copia = r.clone();
      caches.open(CACHE_APP).then(function (c) { c.put('index.html', copia); });
      return r;
    }).catch(function () {
      return caches.match('index.html').then(function (r) { return r || caches.match('./'); });
    }));
    return;
  }

  /* fontes do Google: usa a cópia e atualiza por trás */
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(caches.open(CACHE_FONTES).then(function (c) {
      return c.match(req).then(function (salva) {
        var rede = fetch(req).then(function (r) { if (r.ok || r.type === 'opaque') c.put(req, r.clone()); return r; }).catch(function () { return salva; });
        return salva || rede;
      });
    }));
    return;
  }

  /* arquivos do próprio app (ícones, manifesto): cópia primeiro */
  if (url.origin === self.location.origin) {
    e.respondWith(caches.match(req).then(function (r) { return r || fetch(req); }));
  }
});
