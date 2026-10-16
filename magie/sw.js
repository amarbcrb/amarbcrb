// Hors ligne : on sert le cache tout de suite, et on le rafraîchit en arrière-plan.
const CACHE = 'arcane-v1';
const FILES = ['./', 'style.css', 'app.js', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  const key = req.mode === 'navigate' ? './' : req;
  const fresh = caches.open(CACHE).then(cache => fetch(req).then(res => {
    if (res.ok && !res.redirected) cache.put(key, res.clone());
    return res;
  }));
  e.waitUntil(fresh.then(() => {}, () => {}));
  e.respondWith(caches.match(key).then(hit => hit || fresh));
});
