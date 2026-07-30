/* CAMCO PFMEA Builder service worker v3 (Rev 140).
   NETWORK-FIRST for the app HTML, cache as fallback only.
   v2 was cache-first ("serve stale, refresh for next time"), which made
   sense when the app was 8.4MB and a network wait cost minutes. The app
   is now ~0.7MB, and cache-first meant every open ran the STALE shell
   while the new build hot-swapped in behind it — 30s of limbo and a
   header stuck on the old rev. v3 fetches fresh on every open (a second
   or two), falls back to the cached copy only when the network is slow
   (>3.5s) or down, and keeps the cache current on every successful load.
   Cache name bumped to pf-app-v3 so activate evicts the stale v2 store. */
const CACHE = "pf-app-v3";
const NET_TIMEOUT_MS = 3500;

self.addEventListener("install", e => {
  e.waitUntil((async () => {
    try{
      const c = await caches.open(CACHE);
      try{ await c.add("./"); }catch(err){}
      try{ await c.add("index.html"); }catch(err){}
    }catch(err){}
    self.skipWaiting();
  })());
});

self.addEventListener("activate", e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  const isApp = req.mode === "navigate" || /\.html$/.test(url.pathname) || url.pathname.endsWith("/");
  if (!isApp) return;
  const key = url.origin + url.pathname;
  const altKey = url.pathname.endsWith("/") ? key + "index.html"
               : url.pathname.endsWith("/index.html") ? key.slice(0, -("index.html".length)) : null;

  e.respondWith((async () => {
    const cache = await caches.open(CACHE);

    /* network first, but never hang an open past NET_TIMEOUT_MS */
    const net = fetch(req).then(r => {
      if (r && r.ok) cache.put(key, r.clone());
      return r;
    }).catch(() => null);
    const timed = new Promise(res => setTimeout(() => res(null), NET_TIMEOUT_MS));

    const fresh = await Promise.race([net, timed]);
    if (fresh) return fresh;

    /* slow or offline — serve the cache, and let the fetch finish
       in the background so the cache is current for the next open */
    let cached = await cache.match(key);
    if (!cached && altKey) cached = await cache.match(altKey);
    if (cached) { e.waitUntil(net.then(() => {})); return cached; }

    const late = await net;
    return late || new Response(
      "Offline and the app is not cached on this machine yet. Connect once to cache it.",
      { status: 503, headers: { "Content-Type": "text/plain" } });
  })());
});
