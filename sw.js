// Le veilleur (service worker), mission 10 : il rend la page installable. Mission 12 : il reçoit les notifications.
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

// ---------- Mission 12 : recevoir les notifications, même page fermée ----------
// Le relais envoie un petit message scellé { type: "test" | "appel", de: "482917", heure }.
// Règle de l'iPhone : chaque message reçu DOIT afficher une notification (sinon il coupe l'abonnement).
const VAPID = "BExhiDchXV3mRcJOz3Vu4Q07e0VBBP-Ed7BUFaq7YSnydN7wjwjx-EOTC9pBTfI2dC9qXfach1e-8hWFhv8iJ1U";

self.addEventListener("push", e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) {}
  const de = /^[1-9]\d{5}$/.test(d.de) ? d.de.slice(0, 3) + " " + d.de.slice(3) : "";
  const test = d.type === "test";
  // (Mission 13 : le nom tiré du répertoire et « toucher pour décrocher ». Pour l'instant, le numéro.)
  const title = test ? "Notification test" : (de ? "Le " + de + " t'appelle" : "Appel entrant");
  const body = test ? (de ? "Envoyée par le " + de + ". Les notifications marchent !" : "Les notifications marchent !")
                    : "Touche pour ouvrir le téléphone.";
  e.waitUntil(self.registration.showNotification(title, {
    body,
    icon: "icon-192.png",
    tag: test ? "test" : "appel",   // une nouvelle notification du même genre remplace l'ancienne
    renotify: true,                 // … et fait quand même sonner / vibrer
    data: { type: d.type, de: d.de },
  }));
});

// Toucher la notification : on remet la page devant si elle est ouverte, sinon on l'ouvre
self.addEventListener("notificationclick", e => {
  e.notification.close();
  e.waitUntil((async () => {
    const pages = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const mine = pages.find(p => p.url.startsWith(self.registration.scope));
    if (mine && "focus" in mine) return mine.focus();
    return self.clients.openWindow(self.registration.scope);
  })());
});

// Rare : le service de notification change l'adresse tout seul. On en redemande une ;
// la page la redonnera au relais à sa prochaine ouverture.
self.addEventListener("pushsubscriptionchange", e => {
  e.waitUntil(self.registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: Uint8Array.from(atob(VAPID.replace(/-/g, "+").replace(/_/g, "/") + "="), c => c.charCodeAt(0)),
  }).catch(() => {}));
});
