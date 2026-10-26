/* AlokVerse Admin Chat — service worker
   • app shell works offline-ish (opens instantly, even on a weak network)
   • Firestore / uploads / calls are NEVER cached — live data always comes from the network */
const CACHE = 'alokverse-admin-v1';
const SHELL = ['./', './index.html', './manifest.json'];
const LIVE = ['firestore.googleapis.com', 'firebasestorage.googleapis.com', 'identitytoolkit.googleapis.com',
              'securetoken.googleapis.com', 'api.cloudinary.com', 'api.imgbb.com', 'drive.google.com', 'lh3.googleusercontent.com'];
const STATIC_CDN = ['cdn.tailwindcss.com', 'cdnjs.cloudflare.com', 'fonts.googleapis.com', 'fonts.gstatic.com', 'www.gstatic.com'];

self.addEventListener('install', e => {
    e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL).catch(() => {})));
});
self.addEventListener('activate', e => {
    e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('message', e => { if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting(); });

self.addEventListener('fetch', e => {
    const req = e.request;
    if (req.method !== 'GET') return;                       // HEAD (server-clock check), POST, etc. go straight to the network
    const url = new URL(req.url);
    if (LIVE.some(h => url.hostname === h || url.hostname.endsWith('.' + h))) return;

    // page itself: network first, so a new version shows up at once; cached copy only if offline
    if (req.mode === 'navigate') {
        e.respondWith(fetch(req).then(res => {
            const copy = res.clone(); caches.open(CACHE).then(c => c.put('./index.html', copy)).catch(() => {});
            return res;
        }).catch(() => caches.match('./index.html').then(r => r || caches.match('./'))));
        return;
    }
    // libraries / fonts / own files: cached copy first, refreshed in the background
    if (url.origin === location.origin || STATIC_CDN.includes(url.hostname)) {
        e.respondWith(caches.open(CACHE).then(c => c.match(req).then(hit => {
            const net = fetch(req).then(res => { if (res && (res.ok || res.type === 'opaque')) c.put(req, res.clone()).catch(() => {}); return res; }).catch(() => hit);
            return hit || net;
        })));
    }
});
