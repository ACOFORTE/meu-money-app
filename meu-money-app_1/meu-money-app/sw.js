/* Meu Money — service worker (PWA)
   Estratégia pensada para um app que muda com frequência:
   - HTML (index.html / navegação): REDE PRIMEIRO — o usuário sempre pega a versão
     mais nova quando está online; se estiver offline, usa a cópia salva.
   - Demais arquivos do próprio site (ícones, manifest): responde do cache na hora,
     mas atualiza a cópia em segundo plano (stale-while-revalidate).
   - Firebase/Firestore e qualquer coisa de fora: vão sempre direto à rede.
   Assim, toda atualização publicada chega sozinha, sem precisar mexer aqui de novo. */
const CACHE = 'meu-money-v3-7';
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './icon-512-maskable.png',
  './apple-touch-icon.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* Permite que a página peça para a versão nova assumir imediatamente. */
self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});

function ehHTML(req) {
  return req.mode === 'navigate' ||
    (req.headers.get('accept') || '').includes('text/html');
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // Firebase/gstatic/googleapis vão à rede

  // HTML / navegação: rede primeiro, cache como reserva (offline)
  if (ehHTML(req)) {
    e.respondWith(
      fetch(req).then(resp => {
        const copy = resp.clone();
        caches.open(CACHE).then(c => c.put('./index.html', copy)).catch(() => {});
        return resp;
      }).catch(() => caches.match(req).then(hit => hit || caches.match('./index.html')))
    );
    return;
  }

  // Outros arquivos do site: responde do cache e atualiza em segundo plano
  e.respondWith(
    caches.match(req).then(hit => {
      const rede = fetch(req).then(resp => {
        const copy = resp.clone();
        caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
        return resp;
      }).catch(() => hit);
      return hit || rede;
    })
  );
});
