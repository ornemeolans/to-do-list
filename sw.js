// Service worker — hace que la app cargue y funcione sin conexión.
//
// Estrategias:
//  - Archivos propios (HTML/CSS/JS): "red primero, caché de respaldo".
//    Con conexión siempre se ve la última versión; sin conexión, la guardada.
//  - Fuentes de Google y SDK de Firebase: "caché primero" (son versionados,
//    no cambian), actualizándose en segundo plano.
//  - Todo lo demás (APIs de Firestore/Auth) pasa directo: de su modo offline
//    se encarga el propio SDK con su caché en IndexedDB.
const VERSION = 'lavanda-v2';
const SHELL = [
    './',
    './index.html',
    './css/style.css',
    './manifest.webmanifest',
    './icons/icon.svg',
    './js/main.js',
    './js/StateManager.js',
    './js/StorageService.js',
    './js/TaskService.js',
    './js/SyncService.js',
    './js/syncMerge.js',
    './js/firebase-config.js',
    './js/utils.js',
    './js/icons.js',
    './js/debounce.js'
];
const CACHE_FIRST_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];
const CACHE_FIRST_PREFIXES = ['https://www.gstatic.com/firebasejs/'];

self.addEventListener('install', (event) => {
    event.waitUntil(caches.open(VERSION).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
    event.waitUntil((async () => {
        const keys = await caches.keys();
        await Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)));
        await self.clients.claim();
    })());
});

self.addEventListener('fetch', (event) => {
    const { request } = event;
    if (request.method !== 'GET') return;
    const url = new URL(request.url);

    if (url.origin === self.location.origin) {
        event.respondWith(networkFirst(request));
    } else if (CACHE_FIRST_HOSTS.includes(url.hostname) || CACHE_FIRST_PREFIXES.some(p => request.url.startsWith(p))) {
        event.respondWith(staleWhileRevalidate(request));
    }
});

async function networkFirst(request) {
    const cache = await caches.open(VERSION);
    try {
        const response = await fetch(request);
        if (response.ok) cache.put(request, response.clone());
        return response;
    } catch {
        const cached = await cache.match(request, { ignoreSearch: true });
        if (cached) return cached;
        // Navegación a una ruta no cacheada → la app (es una SPA de una sola página).
        if (request.mode === 'navigate') return cache.match('./index.html');
        return Response.error();
    }
}

async function staleWhileRevalidate(request) {
    const cache = await caches.open(VERSION);
    const cached = await cache.match(request);
    const network = fetch(request)
        .then(response => {
            if (response.ok || response.type === 'opaque') cache.put(request, response.clone());
            return response;
        })
        .catch(() => cached);
    return cached || network;
}
