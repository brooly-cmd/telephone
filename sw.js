// Le veilleur (service worker), mission 10 : il rend la page installable. Mission 12 : il reçoit les notifications.
// Mission 13 : il écrit le nom de l'appelant (« Noa t'appelle ») et fait rejoindre l'appel quand on touche la notification.
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

// Mission 13 : le nom de l'appelant, lu dans MON répertoire. Le veilleur ne peut pas ouvrir le localStorage,
// alors la page lui range une copie { nom, code } dans le tiroir IndexedDB « telephone » (casier « repertoire »).
// Rien trouvé (ou tiroir qui ne répond pas en 2 s) : "" et on affichera le numéro.
function nameFromBook(code){
  const look = new Promise(ok => {
    try {
      const open = indexedDB.open("telephone", 1);
      open.onupgradeneeded = () => open.result.createObjectStore("tiroir");
      open.onerror = () => ok("");
      open.onsuccess = () => {
        const db = open.result;
        try {
          const get = db.transaction("tiroir").objectStore("tiroir").get("repertoire");
          get.onsuccess = () => {
            const c = Array.isArray(get.result) && get.result.find(x => x && x.code === code);
            db.close(); ok(c && typeof c.nom === "string" ? c.nom : "");
          };
          get.onerror = () => { db.close(); ok(""); };
        } catch (err) { db.close(); ok(""); }
      };
    } catch (err) { ok(""); }
  });
  return Promise.race([look, new Promise(ok => setTimeout(() => ok(""), 2000))]);
}

self.addEventListener("push", e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) {}
  const ok = /^[1-9]\d{5}$/.test(d.de);
  const num = ok ? d.de.slice(0, 3) + " " + d.de.slice(3) : "";
  const test = d.type === "test";
  e.waitUntil((async () => {
    const nom = ok ? await nameFromBook(d.de) : "";
    const qui = nom || (num ? "Le " + num : "");                 // « Noa » ou « Le 482 917 »
    const title = test ? "Notification test" : (qui ? qui + " t'appelle" : "Appel entrant");
    const body = test ? (qui ? "Envoyée par " + (nom || "le " + num) + ". Les notifications marchent !" : "Les notifications marchent !")
                      : "Touche pour décrocher.";
    await self.registration.showNotification(title, {
      body,
      icon: "icon-192.png",
      tag: test ? "test" : "appel",   // une nouvelle notification du même genre remplace l'ancienne
      renotify: true,                 // … et fait quand même sonner / vibrer
      requireInteraction: !test,      // sur PC, l'appel reste à l'écran jusqu'à ce qu'on le touche ou le ferme
      vibrate: test ? undefined : [300, 150, 300, 150, 300],
      data: { type: d.type, de: d.de, heure: d.heure },
    });
  })());
});

// Mission 15 (correctif iPhone) : le « post-it » { de, at } rangé dans le tiroir IndexedDB, que la page lit à son réveil
// (le petit mot glissé à une appli endormie peut se perdre). 2 s maximum, pour ne jamais bloquer.
function rememberJoin(de){
  const write = new Promise(ok => {
    try {
      const open = indexedDB.open("telephone", 1);
      open.onupgradeneeded = () => open.result.createObjectStore("tiroir");
      open.onerror = () => ok();
      open.onsuccess = () => {
        const db = open.result;
        try {
          const tx = db.transaction("tiroir", "readwrite");
          tx.objectStore("tiroir").put({ de, at: Date.now() }, "rejoindre");
          tx.oncomplete = tx.onerror = tx.onabort = () => { db.close(); ok(); };
        } catch (err) { db.close(); ok(); }
      };
    } catch (err) { ok(); }
  });
  return Promise.race([write, new Promise(ok => setTimeout(ok, 2000))]);
}

// Toucher la notification : on remet la page devant si elle est ouverte, sinon on l'ouvre.
// Mission 13 : pour un appel, la page rejoint l'appel tout de suite (ou rappelle si c'est déjà fini).
self.addEventListener("notificationclick", e => {
  e.notification.close();
  const d = e.notification.data || {};
  const appel = d.type === "appel" && /^[1-9]\d{5}$/.test(d.de);
  e.waitUntil((async () => {
    if (appel) await rememberJoin(d.de);   // mission 15 : le post-it d'abord, avant de réveiller la page
    const pages = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const mine = pages.find(p => p.url.startsWith(self.registration.scope));
    if (mine){
      if (appel) mine.postMessage({ t: "rejoindre", de: d.de });   // le petit mot glissé à la page déjà ouverte
      try { if ("focus" in mine) await mine.focus(); } catch (err) {}
      return;
    }
    return self.clients.openWindow(self.registration.scope + (appel ? "?appel=" + d.de : ""));
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
