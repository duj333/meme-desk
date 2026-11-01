/* Meme Desk service worker (GitHub Pages). BUILD is set by build.sh to a hash of the app-shell files,
   so any change to the app makes a new SW, which installs, skips waiting and takes over on the next open. */
const BUILD = "2020c78c3f95";
const CACHE = "desk-shell-" + BUILD;
const SHELL = ["./", "./app.css", "./app.js", "./config.js", "./manifest.webmanifest", "./icons/icon-192.png", "./icons/icon-512.png",
               "./icons/maskable-192.png", "./icons/maskable-512.png", "./icons/favicon-32.png"].map((u) => new URL(u, self.registration.scope).pathname);

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL.map((u) => new Request(u, {cache: "reload"})))).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith("desk-shell-") && k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener("message", (e) => { if (e.data === "skipWaiting") self.skipWaiting(); });

const timeout = (ms) => new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), ms));
// Tunnels answer 502/530 when the desk computer is paused: treat any 5xx as "server not reachable".
const okOrThrow = (r) => { if (r.status >= 500) throw new Error("upstream " + r.status); return r; };

self.addEventListener("fetch", (e) => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== location.origin) return;
  // Live data comes from ntfy.sh (cross-origin) and is never touched or cached by this worker.
  // Page loads: network first (fresh app version), cached shell if offline.
  if (req.mode === "navigate") {
    e.respondWith(Promise.race([fetch(req).then(okOrThrow), timeout(4000)]).then((r) => r).catch(async () =>
      (await caches.match(SHELL[0], {cacheName: CACHE})) || new Response("Desk offline", {status: 503, headers: {"Content-Type": "text/plain"}})));
    return;
  }
  // Shell assets: cache first for a fast open; network fallback.
  if (SHELL.includes(url.pathname)) {
    e.respondWith(caches.match(req, {cacheName: CACHE, ignoreSearch: true}).then((hit) => hit || fetch(req)));
  }
});
