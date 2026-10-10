const CACHE_NAME = "customer-credit-manager-v3";
const BASE = "/isp-online-system/";
const APP_SHELL = [
  BASE, BASE + "index.html", BASE + "customer.html", BASE + "style.css",
  BASE + "app.js", BASE + "firebase-config.js", BASE + "manifest.webmanifest",
  BASE + "icon-192.png", BASE + "icon-512.png"
];
self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    // Cache essential app files individually so one missing optional file won't
    // prevent the service worker from installing.
    for (const url of APP_SHELL) {
      try { const response = await fetch(url, { cache: "reload" }); if (response.ok) await cache.put(url, response); }
      catch (e) { /* Keep installation possible; network can still serve this file. */ }
    }
    await self.skipWaiting();
  })());
});
self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith("customer-credit-manager-") && key !== CACHE_NAME).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});
self.addEventListener("fetch", event => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== self.location.origin || !url.pathname.startsWith(BASE)) return;
  if (event.request.mode === "navigate") {
    event.respondWith((async () => {
      try {
        const response = await fetch(event.request);
        if (response && response.ok) { const cache = await caches.open(CACHE_NAME); await cache.put(event.request, response.clone()); }
        return response;
      } catch (e) { return (await caches.match(event.request)) || (await caches.match(BASE + "index.html")); }
    })());
    return;
  }
  event.respondWith((async () => {
    const cached = await caches.match(event.request);
    if (cached) return cached;
    const response = await fetch(event.request);
    if (response && response.ok) { const cache = await caches.open(CACHE_NAME); await cache.put(event.request, response.clone()); }
    return response;
  })());
});
