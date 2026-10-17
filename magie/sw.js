// Hors ligne : on sert le cache tout de suite, et on le rafraîchit en arrière-plan.
const CACHE = 'arcane-v3';
const FILES = [
  './',
  'style.css',
  'app.js',
  'manifest.webmanifest',
  'icon-192.png',
  'icon-512.png',
  'apple-touch-icon.png',
  'fonts/cinzel.woff2',
  'fonts/cormorant.woff2',
  'fonts/cormorant-italic.woff2',
  'cards/10C.webp',
  'cards/10D.webp',
  'cards/10H.webp',
  'cards/10S.webp',
  'cards/2C.webp',
  'cards/2D.webp',
  'cards/2H.webp',
  'cards/2S.webp',
  'cards/3C.webp',
  'cards/3D.webp',
  'cards/3H.webp',
  'cards/3S.webp',
  'cards/4C.webp',
  'cards/4D.webp',
  'cards/4H.webp',
  'cards/4S.webp',
  'cards/5C.webp',
  'cards/5D.webp',
  'cards/5H.webp',
  'cards/5S.webp',
  'cards/6C.webp',
  'cards/6D.webp',
  'cards/6H.webp',
  'cards/6S.webp',
  'cards/7C.webp',
  'cards/7D.webp',
  'cards/7H.webp',
  'cards/7S.webp',
  'cards/8C.webp',
  'cards/8D.webp',
  'cards/8H.webp',
  'cards/8S.webp',
  'cards/9C.webp',
  'cards/9D.webp',
  'cards/9H.webp',
  'cards/9S.webp',
  'cards/AC.webp',
  'cards/AD.webp',
  'cards/AH.webp',
  'cards/AS.webp',
  'cards/JC.webp',
  'cards/JD.webp',
  'cards/JH.webp',
  'cards/JS.webp',
  'cards/KC.webp',
  'cards/KD.webp',
  'cards/KH.webp',
  'cards/KS.webp',
  'cards/QC.webp',
  'cards/QD.webp',
  'cards/QH.webp',
  'cards/QS.webp',
  'cards/back-bleu.webp',
  'cards/back-noir.webp',
  'cards/back-or.webp',
  'cards/back-rouge.webp',
  'cards/back-violet.webp'
];

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
