// App-shell service worker. Only the UI (HTML/CSS/JS/icons) is cached for
// offline use — todo data always goes straight to the network, so there is
// no local write-queue / sync-conflict logic to worry about.

const CACHE_NAME = 'todolist-shell-v9';

const SHELL_FILES = [
    '/',
    'index.html',
    'style.css?v=3',
    'theme.css?v=2',
    'app.js?v=102',
    'theme.js?v=2',
    'i18n.js?v=4',
    'manifest.json',
    'datenschutz.html',
    'doc',
    'admin',
    'admin.js?v=2',
    'admin.css?v=2',
    'icons/icon-192.png',
    'icons/icon-512.png',
    'icons/icon-maskable-512.png',
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) =>
            Promise.all(
                SHELL_FILES.map((url) =>
                    fetch(url, { cache: 'reload' })
                        .then((res) => (res.ok ? cache.put(url, res) : null))
                        .catch(() => null)
                )
            )
        ).then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((names) => Promise.all(
                names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n))
            ))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    if (event.request.method !== 'GET' || url.origin !== self.location.origin) {
        return; // let the browser handle it normally
    }

    // Todo data (and everything else under /api/) is always network-only —
    // offline editing/sync is explicitly out of scope.
    if (url.pathname.startsWith('/api/')) {
        return;
    }

    event.respondWith(
        caches.match(event.request).then((cached) => {
            const network = fetch(event.request)
                .then((res) => {
                    if (res.ok) {
                        const copy = res.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
                    }
                    return res;
                })
                .catch(() => cached);
            return cached || network;
        })
    );
});
