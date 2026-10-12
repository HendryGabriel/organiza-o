// Service worker: deixa o app abrir sem internet (academia, metrô).
// ponytail: rede primeiro, cache só quando a rede falha. Sempre atualizado online, sem versão para lembrar de trocar.
const CACHE = 'hendry-v1';
const SHELL = [
  './', 'styles.css', 'manifest.webmanifest', 'icons/icon.svg',
  'js/app.js', 'js/core.js', 'js/logic.js', 'js/analise.js', 'js/mescla.js', 'js/sinc.js', 'js/metricas.js', 'js/graficos.js', 'js/seed.js', 'js/ui.js', 'js/icons.js', 'js/gemini.js', 'js/audio.js', 'js/extrato.js', 'js/widgets.js',
  'js/views/hoje.js', 'js/views/assistente.js', 'js/views/negocio.js', 'js/views/conteudo.js', 'js/views/corpo.js', 'js/views/lancer.js', 'js/views/extrato.js', 'js/views/mais.js', 'js/views/metricas.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (e) => {
  const { request } = e;
  // Só arquivos do próprio app. Chamadas ao Gemini passam direto.
  if (request.method !== 'GET' || new URL(request.url).origin !== location.origin) return;
  e.respondWith(
    fetch(request)
      .then((res) => {
        const copia = res.clone();
        if (res.ok) caches.open(CACHE).then((c) => c.put(request, copia));
        return res;
      })
      .catch(() => caches.match(request, { ignoreSearch: true }).then((r) => r || caches.match('./'))),
  );
});
