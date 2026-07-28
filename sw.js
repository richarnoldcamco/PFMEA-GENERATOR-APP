/* CAMCO PFMEA Builder service worker v2 (Rev 102).
   Cache-first for the app HTML with PRE-CACHING at install: the worker
   downloads the app into the local cache in the background the moment
   it installs, so even the first post-install load is served locally.
   Background refresh keeps the cache current; the in-app rev banner
   remains the immediate-update path. */
const CACHE = "pf-app-v2";

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
    let cached = await cache.match(key);
    if (!cached && altKey) cached = await cache.match(altKey);
    const refresh = fetch(req).then(r => {
      if (r && r.ok) cache.put(key, r.clone());
      return r;
    }).catch(() => null);
    if (cached) {
      e.waitUntil(refresh.then(() => {}));
      return cached;
    }
    const net = await refresh;
    return net || new Response(
      "Offline and the app is not cached on this machine yet. Connect once to cache it.",
      { status: 503, headers: { "Content-Type": "text/plain" } });
  })());
});
