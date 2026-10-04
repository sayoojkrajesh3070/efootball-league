// Minimal service worker: lets the site be installed as an app.
// It always loads fresh data from the network (nothing is cached),
// so standings and scores are never out of date.
self.addEventListener("install", function () { self.skipWaiting(); });
self.addEventListener("activate", function (e) { e.waitUntil(self.clients.claim()); });
self.addEventListener("fetch", function (e) {
  e.respondWith(
    fetch(e.request).catch(function () {
      return new Response("You are offline. Reconnect to see the latest league tables.",
        { status: 503, headers: { "Content-Type": "text/plain" } });
    })
  );
});
