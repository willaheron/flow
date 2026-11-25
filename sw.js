/* Flow service worker — network-first with a short timeout.
   On signal you get the newest file; offline you get the last cached copy.
   Never touches localStorage, so app data is unaffected by any update. */

const CACHE = "flow-v1";
const TIMEOUT = 2500;

const ASSETS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icon-180.png",
  "./icon-192.png",
  "./icon-512.png"
];

self.addEventListener("install", e => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.allSettled(ASSETS.map(u => c.add(u))))
      .catch(() => {})
  );
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
      .catch(() => {})
  );
});

function fromNetwork(req){
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), TIMEOUT);
    fetch(req).then(res => {
      clearTimeout(timer);
      if (res && res.ok && (res.type === "basic" || res.type === "default")){
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
      }
      resolve(res);
    }).catch(err => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  if (new URL(req.url).origin !== self.location.origin) return;

  e.respondWith(
    fromNetwork(req)
      .catch(() => caches.match(req).then(hit => hit || caches.match("./index.html")))
      .then(res => res || new Response("Offline", { status: 503, statusText: "Offline" }))
  );
});
