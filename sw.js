// Le veilleur (service worker), mission 10 : il rend la page installable.
// Règle d'or : toujours la version fraîche d'internet. La copie rangée sert SEULEMENT quand il n'y a pas d'internet,
// pour afficher la page (avec « Vérifie ta connexion internet ») au lieu d'un écran d'erreur.
const RANGEMENT = "telephone-secours";

// Un nouveau veilleur prend la place de l'ancien tout de suite, sans attendre qu'on ferme toutes les pages
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k !== RANGEMENT) await caches.delete(k);   // jeter les vieux rangements
  await self.clients.claim();
})()));

self.addEventListener("fetch", e => {
  const req = e.request, url = new URL(req.url);
  // PeerJS, polices, standardiste… : le veilleur ne s'en mêle pas
  if (req.method !== "GET" || url.origin !== location.origin) return;
  const key = url.origin + url.pathname;   // « ?appel=… » ne compte pas pour la copie de secours
  e.respondWith((async () => {
    try {
      // « no-cache » : le navigateur redemande toujours à GitHub si le fichier a changé (pas de vieille copie de 10 minutes)
      const fresh = await fetch(req, { cache: "no-cache" });
      if (fresh.ok){
        const copy = fresh.clone();
        e.waitUntil(caches.open(RANGEMENT).then(c => c.put(key, copy)).catch(() => {}));
      }
      return fresh;
    } catch (err) {
      // Pas d'internet : on ressort la dernière copie rangée
      const old = await caches.match(key);
      if (old) return old;
      throw err;
    }
  })());
});
