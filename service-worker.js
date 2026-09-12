const CACHE_NAME = "skpo-motogp-v20260912-001";

const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.json",

  "./css/style.css",
  "./css/index.css",

  "./js/api-config.js",
  "./js/supabase-client.js",
  "./js/index.js",
  "./js/walkie-petugas.js",
  "./js/pwa-install.js",

  "./images/logo-utama.png",
  "./images/logo-gabungan.png",
  "./images/peta.png",

  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      for (const url of APP_SHELL) {
        try {
          await cache.add(url);
        } catch (error) {
          console.warn("Tidak dapat cache:", url, error);
        }
      }
    })
  );

  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );

  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;

  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);

  /*
   * Supabase mesti sentiasa mengambil data terkini.
   * Jangan gunakan cache untuk login, attendance,
   * pelaporan atau Edge Functions.
   */
  if (
    /supabase/i.test(url.hostname) ||
    url.pathname.includes("/rest/v1/") ||
    url.pathname.includes("/auth/v1/") ||
    url.pathname.includes("/functions/v1/")
  ) {
    event.respondWith(
      fetch(request)
    );

    return;
  }

  /*
   * Navigasi halaman:
   * cuba internet dahulu,
   * jika tiada internet gunakan index.html dalam cache.
   */
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => response)
        .catch(() => caches.match("./index.html"))
    );

    return;
  }

  /*
   * Fail statik:
   * cache dahulu, jika tiada baru internet.
   */
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(request).then((response) => {
        if (
          !response ||
          response.status !== 200 ||
          response.type !== "basic"
        ) {
          return response;
        }

        const clone = response.clone();

        caches.open(CACHE_NAME).then((cache) => {
          cache.put(request, clone);
        });

        return response;
      });
    })
  );
});
