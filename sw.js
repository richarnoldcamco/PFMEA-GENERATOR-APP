/* CAMCO PFMEA Builder service worker (Rev 93).
   Cache-first for the app HTML: loads are served from this machine's
   cache in under a second, while the network copy is fetched in the
   background and stored for the next load. The in-app rev banner
   remains the immediate-update path. */
const CACHE = "pf-app-v1";

self.addEventListener("install", e => { self.skipWaiting(); });
self.addEventListener("activate", e => { e.waitUntil(self.clients.claim()); });

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  const isApp = req.mode === "navigate" || /\.html$/.test(url.pathname) || url.pathname.endsWith("/");
  if (!isApp) return;
  const key = url.origin + url.pathname;           /* ?v= cache-busters collapse to one entry */

  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(key);
    const refresh = fetch(req).then(r => {
      if (r && r.ok) cache.put(key, r.clone());
      return r;
    }).catch(() => null);
    if (cached) {
      e.waitUntil(refresh);                        /* background update for next load */
      return cached;
    }
    const net = await refresh;
    return net || new Response(
      "Offline and the app is not cached on this machine yet. Connect once to cache it.",
      { status: 503, headers: { "Content-Type": "text/plain" } });
  })());
});
