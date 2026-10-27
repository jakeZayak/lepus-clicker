// Offline support: precache the whole game, then serve from cache and refresh in the background.
// Bump VERSION when files are added or removed.
const VERSION = "lepus-v1";
const FILES = [
  "./",
  "index.html",
  "style.css",
  "manifest.webmanifest",
  "src/audio.js",
  "src/game.js",
  "src/main.js",
  "src/render.js",
  "src/save.js",
  "src/sprites.js",
  "src/yard.js",
  "assets/icons/icon-192.png",
  "assets/icons/icon-512.png",
  "assets/icons/icon-maskable-512.png",
  "assets/music/lepus.mp3",
  "assets/sfx/buy.wav",
  "assets/sfx/click.wav",
  "assets/sfx/coin.wav",
  "assets/sfx/denied.wav",
  "assets/sfx/grab.wav",
  "assets/sfx/hop.wav",
  "assets/sfx/merge.wav",
  "assets/sfx/tick.wav",
  "assets/sfx/unlock.wav",
  "assets/sprites/big_egg.png",
  "assets/sprites/bunny.png",
  "assets/sprites/choc_egg.png",
  "assets/sprites/lepus.png",
  "assets/sprites/lepus_bag.png",
  "assets/sprites/lepus_epic.png",
  "assets/sprites/music_box.png",
  "assets/sprites/small_egg.png",
  "assets/sprites/small_lepus.png",
  "assets/sprites/solar_lepus.png",
  "assets/sprites/suspicious_egg.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

// The music element asks for byte ranges; answer them from the cached file so it plays and loops offline.
async function rangeResponse(req, res) {
  const buf = await res.arrayBuffer();
  const m = /bytes=(\d*)-(\d*)/.exec(req.headers.get("range"));
  const start = m[1] ? Number(m[1]) : buf.byteLength - Number(m[2]);
  const end = m[1] && m[2] ? Math.min(Number(m[2]), buf.byteLength - 1) : buf.byteLength - 1;
  return new Response(buf.slice(start, end + 1), {
    status: 206,
    headers: { "Content-Type": res.headers.get("Content-Type") || "audio/mpeg", "Content-Range": `bytes ${start}-${end}/${buf.byteLength}`, "Content-Length": String(end - start + 1) },
  });
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  const isFont = url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com";
  if (url.origin !== location.origin && !isFont) return;

  if (req.headers.has("range")) {
    e.respondWith(caches.match(req.url, { ignoreSearch: true }).then((hit) => (hit ? rangeResponse(req, hit) : fetch(req))));
    return;
  }
  // Stale-while-revalidate: instant from cache, quietly updated for next launch.
  e.respondWith(
    caches.open(VERSION).then(async (cache) => {
      const hit = await cache.match(req, { ignoreSearch: true });
      const fresh = fetch(req)
        .then((res) => {
          if (res.ok || res.type === "opaque") cache.put(req, res.clone());
          return res;
        })
        .catch(() => hit);
      return hit || fresh;
    })
  );
});
