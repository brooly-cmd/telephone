// Le téléphone : écrans (mission 2), micro (mission 4), numéro perso (mission 5), appels (mission 6), voix (mission 7),
// chrono et sourdine (mission 8), répertoire (mission 9), page installable (mission 10), notifications (mission 12),
// prévenir l'ami par notification et rejoindre l'appel en la touchant (mission 13), sonneries (mission 14),
// relais de voix et écran Diagnostic (mission 15), historique des appels (mission 17),
// appel quand on quitte l'appli : écran allumé, notification « En appel », appel coupé expliqué des deux côtés (mission 18).
(function(){
  let typed = "";                  // ce qu'on tape sur le clavier
  let friend = "";                 // le code de l'ami en ligne avec nous (appelé ou appelant)
  let tick = null, startAt = 0;    // pour le chrono (startAt = l'heure où le son s'est connecté, 0 = pas encore)
  const $ = id => document.getElementById(id);
  const fmt = c => c.slice(0,3) + " " + c.slice(3);   // "731205" -> "731 205"

  // Mission 5 : mon numéro perso. Tiré au hasard la 1re fois, puis rangé dans le navigateur (localStorage)
  // pour rester le même à chaque visite. 6 chiffres, jamais de 0 au début.
  function newCode(){
    const r = crypto.getRandomValues(new Uint32Array(1))[0];
    return String(100000 + r % 900000);
  }
  let saved = true;
  function loadMyCode(){
    try {
      let c = localStorage.getItem("monCode");
      if (!/^[1-9]\d{5}$/.test(c || "")){ c = newCode(); localStorage.setItem("monCode", c); }
      return c;
    } catch(e){ saved = false; return newCode(); }   // tiroir fermé (navigation privée…) : numéro valable pour cette visite seulement
  }
  const MY = loadMyCode();
  $("myCode").textContent = fmt(MY);
  if (!saved){
    $("codeMsg").textContent = "Ce navigateur ne peut pas garder ton numéro (navigation privée ?). Il changera à ta prochaine visite.";
    $("codeMsg").hidden = false;
  }

  // Mission 9 : le répertoire, rangé dans le navigateur (localStorage) sous le nom « repertoire ».
  // C'est une liste de fiches { nom, code }. (Mission 13 : le mail des anciennes fiches ne sert plus, on l'oublie.)
  let book = [];
  try { book = JSON.parse(localStorage.getItem("repertoire") || "[]"); } catch(e){ book = []; }
  if (!Array.isArray(book)) book = [];
  book = book.filter(c => c && typeof c.nom === "string" && /^[1-9]\d{5}$/.test(c.code)).map(c => ({ nom: c.nom, code: c.code }));
  function saveBook(){
    try { localStorage.setItem("repertoire", JSON.stringify(book)); } catch(e){ return false; }
    copyBookForSW();
    return true;
  }
  // Mission 13 : le veilleur (sw.js) ne peut pas lire le localStorage. On range une copie des noms et codes
  // dans un tiroir qu'il sait ouvrir (IndexedDB), pour qu'il écrive « Noa t'appelle » même page fermée.
  function copyBookForSW(){
    try {
      const open = indexedDB.open("telephone", 1);
      open.onupgradeneeded = () => open.result.createObjectStore("tiroir");
      open.onsuccess = () => {
        const db = open.result, tx = db.transaction("tiroir", "readwrite");
        tx.objectStore("tiroir").put(book.map(c => ({ nom: c.nom, code: c.code })), "repertoire");
        tx.oncomplete = tx.onerror = () => db.close();
      };
    } catch(e){}
  }
  copyBookForSW();   // à chaque ouverture aussi (pour les répertoires créés avant la mission 13)
  const contactOf = code => book.find(c => c.code === code);
  const nameOf = code => { const c = contactOf(code); return c ? c.nom : ""; };
  // Pour les phrases : « Noa » si on le connaît, sinon « le 482 917 »
  const Who = code => nameOf(code) || "Le " + fmt(code);
  const who = code => nameOf(code) || "le " + fmt(code);
  const ofWho = code => { const n = nameOf(code); return n ? (/^[aeiouyàâéèêîôh]/i.test(n) ? "d'" : "de ") + n : "du " + fmt(code); };

  // Un rond coloré + une lettre, calculés à partir du code (toujours les mêmes pour un même ami).
  // Mission 9 : si l'ami est dans le répertoire, la lettre est l'initiale de son nom.
  function paintAvatar(el, code){
    let n = 0; for (const ch of code) n = (n*31 + +ch) % 99991;
    el.style.background = "hsl(" + (n % 360) + " 65% 68%)";
    const first = nameOf(code).trim().charAt(0).toUpperCase();
    el.textContent = first || String.fromCharCode(65 + n % 26);
  }

  // Clavier : 1 à 9, une case vide, 0, et la touche effacer
  const keys = ["1","2","3","4","5","6","7","8","9","","0","del"];
  keys.forEach(k => {
    const b = document.createElement("button");
    b.className = "key" + (k==="del" ? " del" : "") + (k==="" ? " blank" : "");
    if (k==="del"){
      b.setAttribute("aria-label","Effacer");
      b.innerHTML = '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 5H9l-6 7 6 7h12z"/><path d="m13 9 5 6m0-6-5 6"/></svg>';
    } else b.textContent = k;
    b.addEventListener("click", () => k==="del" ? eraseDigit() : addDigit(k));
    $("pad").appendChild(b);
  });

  // Affiche les chiffres tapés (des points pour les cases vides) et active « Appeler » à 6 chiffres
  function renderDisplay(){
    const shown = (typed + "______").slice(0,6).split("").map(c => c==="_" ? '<span class="ph">•</span>' : c);
    shown.splice(3,0," ");
    $("display").innerHTML = shown.join("");
    $("callBtn").disabled = typed.length !== 6;
  }
  renderDisplay();

  function addDigit(d){ if (d && typed.length < 6){ typed += d; callMessage(""); renderDisplay(); } }
  function eraseDigit(){ typed = typed.slice(0,-1); renderDisplay(); }

  // Mission 6 : taper au clavier du PC (chiffres, Retour arrière / Suppr pour effacer, Entrée pour appeler)
  document.addEventListener("keydown", e => {
    if ($("s1").hidden || e.ctrlKey || e.metaKey || e.altKey) return;
    if (/^[0-9]$/.test(e.key)) addDigit(e.key);
    else if (e.key === "Backspace" || e.key === "Delete") eraseDigit();
    else if (e.key === "Enter" && typed.length === 6) startCall(typed);
    else return;
    e.preventDefault();
  });

  // Mission 6 : coller un code copié (Ctrl+V, ou appui long « Coller » sur téléphone). « 482 917 » devient 482917.
  function pasteCode(text){
    const digits = String(text).replace(/\D/g, "");
    if (digits.length === 6){ typed = digits; callMessage(""); renderDisplay(); }
    else callMessage("Le code collé doit avoir 6 chiffres (j'en ai trouvé " + digits.length + ").");
  }
  document.addEventListener("paste", e => {
    if ($("s1").hidden) return;
    e.preventDefault();
    pasteCode((e.clipboardData || window.clipboardData).getData("text"));
  });
  // Filet de sécurité : si un téléphone colle sans prévenir, on récupère quand même ce qui est arrivé dans la case
  $("pasteBox").addEventListener("input", () => {
    const v = $("pasteBox").value; $("pasteBox").value = "";
    if (v) pasteCode(v);
  });

  $("callBtn").addEventListener("click", () => startCall(typed));

  // Copier mon numéro
  $("copyBtn").addEventListener("click", async () => {
    const btn = $("copyBtn"), txt = btn.querySelector("span");
    try { await navigator.clipboard.writeText(fmt(MY)); txt.textContent = "Copié ✓"; btn.classList.add("ok"); }
    catch(e){ const r = document.createRange(); r.selectNodeContents($("myCode")); const s = getSelection(); s.removeAllRanges(); s.addRange(r); txt.textContent = "Sélectionné"; }
    setTimeout(() => { txt.textContent = "Copier"; btn.classList.remove("ok"); }, 1600);
  });

  // Mission 4 : tester le micro. Un appui demande la permission et fait bouger la barre ; un second appui arrête.
  let micStream = null, audioCtx = null, micLoop = null;
  function micMessage(text){ $("micMsg").textContent = text; $("micMsg").hidden = !text; }
  function setMicUI(on){
    $("micBtn").setAttribute("aria-pressed", on);
    $("micBtn").querySelector("span").textContent = on ? "Arrêter le test" : "Tester le micro";
    $("meter").hidden = !on;
    $("ringBtn").hidden = on;   // mission 14 : on laisse la place à la barre pendant le test
    $("meterFill").style.width = "0";
  }
  // Pourquoi le micro ne s'ouvre pas, en mots simples (servira aussi pour les appels, mission 7)
  function micError(e){
    const why = {
      NoMicHere:        "Ce navigateur ne peut pas utiliser le micro ici. Ouvre la page avec son adresse en https.",
      NotAllowedError:  "Micro refusé. Pour l'autoriser : clique sur le cadenas à gauche de l'adresse, mets « Micro » sur Autoriser, puis recharge la page.",
      SecurityError:    "Micro refusé. Pour l'autoriser : clique sur le cadenas à gauche de l'adresse, mets « Micro » sur Autoriser, puis recharge la page.",
      NotFoundError:    "Aucun micro trouvé. Branche un micro ou un casque, puis réessaie.",
      NotReadableError: "Le micro est déjà utilisé par une autre application (Zoom, Discord…). Ferme-la, puis réessaie."
    };
    return why[e && e.name] || "Impossible d'ouvrir le micro (" + (e && e.name) + "). Réessaie.";
  }
  function stopMic(){
    cancelAnimationFrame(micLoop);
    if (micStream) micStream.getTracks().forEach(t => t.stop());   // éteint le micro (le voyant du navigateur disparaît)
    if (audioCtx) audioCtx.close();
    micStream = audioCtx = null;
    setMicUI(false);
  }
  async function startMic(){
    micMessage("");
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia){
      micMessage("Ce navigateur ne peut pas utiliser le micro ici. Ouvre la page avec son adresse en https.");
      return;
    }
    // L'« ampli » est créé tout de suite, pendant l'appui : sur iPhone, le son ne s'allume que suite à un geste.
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    try {
      micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch(e){
      audioCtx.close(); audioCtx = null;
      micMessage(micError(e));
      return;
    }
    await audioCtx.resume();
    const analyser = audioCtx.createAnalyser();     // le « vumètre » : il mesure le son qui arrive
    analyser.fftSize = 1024;
    audioCtx.createMediaStreamSource(micStream).connect(analyser);
    const data = new Uint8Array(analyser.fftSize);
    setMicUI(true);
    (function draw(){
      analyser.getByteTimeDomainData(data);
      let sum = 0; for (const v of data){ const x = (v - 128) / 128; sum += x*x; }
      const level = Math.min(1, Math.sqrt(sum / data.length) * 5);   // volume moyen, amplifié pour que la voix remplisse la barre
      $("meterFill").style.width = Math.round(level * 100) + "%";
      micLoop = requestAnimationFrame(draw);
    })();
  }
  $("micBtn").addEventListener("click", () => micStream ? stopMic() : startMic());

  // Passer d'un écran à l'autre (1 Accueil, 2 Ça sonne, 3 Entrant, 4 En cours, 5 Répertoire, 6 Fiche contact, 7 Historique)
  function go(n){
    for (let i=1;i<=7;i++) $("s"+i).hidden = i !== n;
    // Mission 9 : le nom de l'ami s'il est dans le répertoire, sinon son numéro
    const name = nameOf(friend);
    ["outCode","inCode","liveCode"].forEach(id => { $(id).textContent = name || fmt(friend); $(id).classList.toggle("name", !!name); });
    ["outAvatar","inAvatar","liveAvatar"].forEach(id => paintAvatar($(id), friend));
    if (n !== 4) stopChrono();
    else if (!startAt){ $("timer").textContent = "00:00"; $("timer").classList.add("wait"); }
    sounds();   // mission 14 : chaque écran a son son (ou son silence)
    diagShow(n);   // mission 15
    keepAwake(n >= 2 && n <= 4);   // mission 18 : écran allumé pendant que ça sonne et pendant l'appel
  }

  // Mission 8 : le chrono. Il démarre quand le son est connecté (pas avant), et on lit l'horloge
  // au lieu de compter +1 : un téléphone qui met la page en veille ne lui fait pas perdre de secondes.
  function clock(){
    const sec = Math.floor((Date.now() - startAt) / 1000);
    return String(Math.floor(sec/60)).padStart(2,"0") + ":" + String(sec%60).padStart(2,"0");
  }
  function startChrono(){
    if (startAt) return;   // déjà parti
    startAt = Date.now();
    $("timer").classList.remove("wait");
    $("timer").textContent = clock();
    tick = setInterval(() => { $("timer").textContent = clock(); }, 250);
  }
  function stopChrono(){ clearInterval(tick); tick = null; startAt = 0; }

  // ---------- Mission 9 : l'écran Répertoire et la fiche d'un contact ----------
  let editing = null;   // le contact qu'on modifie (null = on en ajoute un nouveau)
  let formFromHist = false;   // mission 17 : fiche ouverte depuis l'historique (« Ajouter aux contacts ») : on y revient après
  function bookMessage(text){ $("bookMsg").textContent = text; $("bookMsg").hidden = !text; }
  function formMessage(text){ $("formMsg").textContent = text; $("formMsg").hidden = !text; }
  // Un petit bouton rond avec un dessin dedans
  function iconBtn(cls, label, svg, onClick){
    const b = document.createElement("button");
    b.className = "sq" + (cls ? " " + cls : "");
    b.setAttribute("aria-label", label);
    b.innerHTML = svg;
    b.addEventListener("click", onClick);
    return b;
  }
  // Dessine la liste (par ordre alphabétique). textContent (et pas innerHTML) : un nom bizarre reste du simple texte.
  function renderBook(){
    const ul = $("book");
    ul.innerHTML = "";
    if (!book.length){
      const li = document.createElement("li");
      li.className = "empty";
      li.textContent = "Aucun contact pour l'instant. Appuie sur « + Ajouter » pour enregistrer le code d'un ami.";
      ul.appendChild(li);
      return;
    }
    [...book].sort((a,b) => a.nom.localeCompare(b.nom, "fr", { sensitivity: "base" })).forEach(c => {
      const li = document.createElement("li");
      li.className = "card";
      const av = document.createElement("div"); av.className = "avatar"; paintAvatar(av, c.code);
      const info = document.createElement("div"); info.className = "who";
      const nm = document.createElement("b"); nm.textContent = c.nom;
      const cd = document.createElement("span"); cd.className = "num"; cd.textContent = fmt(c.code);
      info.append(nm, cd);
      const edit = iconBtn("", "Modifier " + c.nom,
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13 7 4 4"/></svg>',
        () => openForm(c));
      const call = iconBtn("go", "Appeler " + c.nom, '<svg viewBox="0 0 24 24" fill="currentColor"><use href="#ph"/></svg>',
        () => { go(1); startCall(c.code); });   // même chemin qu'en tapant le code : les messages s'affichent sur l'accueil
      li.append(av, info, edit, call);
      ul.appendChild(li);
    });
  }
  function openBook(){ bookMessage(""); renderBook(); go(5); }
  // Ouvre la fiche : vide pour un nouveau contact, remplie pour en modifier un.
  // Mission 17 : depuis l'historique, la fiche d'un nouveau contact arrive avec le numéro déjà rempli.
  function openForm(c, code, fromHist){
    editing = c || null;
    formFromHist = !!fromHist;
    $("formTitle").textContent = c ? "Modifier le contact" : "Nouveau contact";
    $("fName").value = c ? c.nom : "";
    $("fCode").value = c ? fmt(c.code) : code ? fmt(code) : "";
    $("delBtn").hidden = !c;
    $("testBtn").hidden = !c;   // mission 12 : le test, seulement pour un contact déjà enregistré
    testMessage("");
    $("confirmBox").hidden = true;
    formMessage("");
    go(6);
    $("fName").focus();
  }
  $("contactsBtn").addEventListener("click", openBook);
  $("backBtn").addEventListener("click", () => go(1));
  $("addBtn").addEventListener("click", () => openForm(null));
  $("formBack").addEventListener("click", () => formFromHist ? openHist() : openBook());
  // Enregistrer : on vérifie chaque case, et on explique ce qui ne va pas
  $("contactForm").addEventListener("submit", e => {
    e.preventDefault();
    const nom = $("fName").value.trim().replace(/\s+/g, " ");
    const code = $("fCode").value.replace(/\D/g, "");   // « 482 917 » devient 482917
    if (!nom) return formMessage("Écris un nom pour ce contact.");
    if (code.length !== 6) return formMessage("Le code doit avoir 6 chiffres (j'en ai trouvé " + code.length + ").");
    if (code[0] === "0") return formMessage("Un code ne commence jamais par 0. Vérifie le numéro de ton ami.");
    if (code === MY) return formMessage("C'est ton propre numéro ! Mets le code d'un ami.");
    const twin = book.find(c => c.code === code && c !== editing);
    if (twin) return formMessage("Ce code est déjà enregistré pour " + twin.nom + ".");
    const before = book;
    book = book.filter(c => c !== editing).concat({ nom, code });
    if (!saveBook()){
      book = before;
      return formMessage("Ce navigateur ne peut pas garder ton répertoire (navigation privée ?). Le contact n'est pas enregistré.");
    }
    const said = (editing ? "Contact modifié : " : "Contact ajouté : ") + nom + ".";
    if (formFromHist){ openHist(); histMessage(said); }   // mission 17 : retour à l'historique, où le nom remplace le numéro
    else { openBook(); bookMessage(said); }
  });
  // Supprimer : on demande d'abord « Supprimer Noa ? »
  $("delBtn").addEventListener("click", () => {
    $("confirmText").textContent = "Supprimer " + editing.nom + " ?";
    $("delBtn").hidden = true;
    $("confirmBox").hidden = false;
  });
  $("noDel").addEventListener("click", () => { $("confirmBox").hidden = true; $("delBtn").hidden = false; });
  $("yesDel").addEventListener("click", () => {
    const gone = editing;
    book = book.filter(c => c !== gone);
    saveBook();
    openBook();
    bookMessage("Contact supprimé : " + gone.nom + ".");
  });

  // ---------- Mission 6 : appeler un code grâce au standardiste PeerJS ----------
  // Le standardiste public est partagé avec le monde entier : on s'inscrit sous « brooly-tel-482917 »
  // (un indicatif propre à notre appli) pour ne jamais tomber sur le numéro d'un inconnu.
  const PREFIX = "brooly-tel-";
  let peer = null;       // notre ligne chez le standardiste
  let conn = null;       // le fil direct avec l'ami pendant un appel
  let state = "idle";    // idle (libre), calling (ça sonne chez lui), ringing (ça sonne chez moi), live (en appel)
  let ringTimer = null, retryTimer = null;
  const PAGE_VERSION = "18";   // mission 15 : écrit dans le diagnostic, pour savoir si l'ami a bien la dernière page
  // Mission 15 : le badge du relais de voix (TURN), demandé à mon relais Cloudflare
  const turn = { servers: null, until: 0, pending: null, why: "pas encore demandé" };
  let joinedAt = 0;   // mission 15 (correctif) : l'heure où on a touché une notification d'appel

  // net = true : message sur la ligne du standardiste, effacé tout seul quand la ligne revient (mission 18)
  function callMessage(text, info, net){
    // Mission 18 : « L'appel s'est coupé… » + Rappeler reste affiché ; la ligne du standardiste se lit sur le voyant en haut
    if (net && !$("recallBtn").hidden) return;
    $("callMsg").textContent = text;
    $("callMsg").hidden = !text;
    $("callMsg").classList.toggle("info", !!info);
    if (net) $("callMsg").dataset.net = "1"; else delete $("callMsg").dataset.net;
    $("recallBtn").hidden = true;   // mission 18 : le bouton « Rappeler » ne va qu'avec son message
  }
  function setNet(kind){
    const labels = { wait: "Connexion…", on: "En ligne", off: "Hors ligne" };
    $("net").textContent = labels[kind];
    $("net").className = "net" + (kind === "wait" ? "" : " " + kind);
  }

  // S'inscrire chez le standardiste (et se réinscrire si la ligne tombe)
  function startPeer(){
    if (typeof Peer === "undefined"){
      setNet("off");
      callMessage("Le standardiste n'a pas pu être chargé. Vérifie ta connexion internet, puis recharge la page.", false, true);
      return;
    }
    if (peer) peer.destroy();
    setNet("wait");
    const p = peer = new Peer(PREFIX + MY, turn.servers ? { config: iceConfig() } : {});   // mission 15 : avec le relais de voix
    p.on("open", () => {
      if (p !== peer) return;
      setNet("on");
      // Mission 18 : on n'efface que les messages du standardiste (« L'appel s'est coupé… » doit rester visible au retour)
      if (state === "idle" && $("callMsg").dataset.net) callMessage("");
    });
    p.on("connection", c => { if (p === peer) incoming(c); });
    p.on("call", mc => { if (p === peer) incomingMedia(mc); else mc.close(); });
    p.on("disconnected", () => { if (p === peer && !p.destroyed){ setNet("wait"); retryLater(); } });
    p.on("error", e => onPeerError(p, e));
    // Si le standardiste ne répond rien du tout au bout de 10 secondes, on le dit
    setTimeout(() => {
      if (p === peer && !p.open && !p.destroyed && state === "idle"){
        setNet("off");
        callMessage("Le standardiste ne répond pas. Vérifie ta connexion internet ; la page réessaie toute seule.", false, true);
      }
    }, 10000);
  }
  function retryLater(){
    clearTimeout(retryTimer);
    retryTimer = setTimeout(() => {
      if (!peer || peer.destroyed) startPeer();
      else if (peer.disconnected) peer.reconnect();
    }, 5000);
  }
  function onPeerError(p, e){
    if (p !== peer) return;
    diagLog("Standardiste : " + e.type);   // mission 15
    if (e.type === "peer-unavailable"){   // l'ami n'a pas la page ouverte
      if (state !== "calling") return;
      // Mission 13 : en rejoignant depuis une notification, l'appelant n'est plus là : appel manqué.
      // Sinon, ça continue de sonner : c'est la notification qui va le prévenir.
      if (joining) endCall("Appel manqué " + ofWho(friend) + ". " + Who(friend) + " n'est plus en ligne.");
      else if (reach){ reach.online = false; showRing(); }
      return;
    }
    setNet("off");
    if (e.type === "unavailable-id"){
      callMessage("Ton numéro est encore pris : la page vient sans doute d'être rouverte (le standardiste se souvient quelques instants de l'ancienne), ou elle est ouverte ailleurs. Elle réessaie toute seule.", false, true);
      retryLater();
    } else if (e.type === "browser-incompatible"){
      callMessage("Ce navigateur ne sait pas passer d'appels. Essaie avec Chrome, Edge, Firefox ou Safari à jour.");
    } else {   // network, server-error, socket-error… : la ligne avec le standardiste est coupée
      if (state === "idle") callMessage("Le standardiste ne répond pas. Vérifie ta connexion internet ; la page réessaie toute seule.", false, true);
      retryLater();
    }
  }
  // Sur téléphone, la ligne se coupe quand la page passe en arrière-plan : on la rétablit au retour
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && (!peer || peer.destroyed || peer.disconnected)){
      clearTimeout(retryTimer);
      if (!peer || peer.destroyed) startPeer(); else peer.reconnect();
    }
  });
  // En fermant la page : on prévient l'ami et on rend le numéro au standardiste
  window.addEventListener("pagehide", e => {
    // Mission 18 : page mise de côté mais gardée en mémoire (iPhone qui passe à une autre appli) : on ne raccroche pas,
    // l'appel attend le retour (jusqu'à 5 min). Seule une vraie fermeture raccroche.
    if (e.persisted && state === "live") return;
    const wasLive = state === "live";
    if (state === "calling") send({ t: "annule" });
    else if (state === "ringing") send({ t: "refuse" });
    else if (wasLive) send({ t: "raccroche", parti: true });   // mission 18 : l'ami lira « Noa a quitté l'app, l'appel est coupé »
    logCall(state === "calling" ? "annule" : state === "ringing" ? "refuse" : "");   // mission 17 : noter l'appel avant de fermer
    closeLiveNotif(); mediaInfo(false);   // mission 18
    playSound("");
    stopVoice();
    if (peer) peer.destroy();
    if (wasLive) keepCutNote(false);   // mission 18 : en dernier (couper la ligne termine l'appel, ce qui jette le post-it)
  });

  // Envoyer un petit message à l'ami (attend que le fil soit prêt si besoin)
  function send(msg){
    if (!conn) return;
    if (conn.open) conn.send(msg);
    else { const c = conn; c.on("open", () => c.send(msg)); }
  }
  // Brancher les « oreilles » sur le fil avec l'ami
  function wire(c){
    c.on("data", d => { if (c === conn){ lastPing = Date.now(); onData(d); } });   // mission 18 : tout message = « il est là »
    c.on("close", () => { if (c === conn) lineCut(); });
    c.on("error", e => { if (c === conn){ diagLog("Erreur des messages : " + (e && e.type || e)); lineCut(); } });
    diagWatch(c.peerConnection, "Chemin des messages");   // mission 15
  }

  // ---------- Mission 7 : la voix dans les deux sens ----------
  // Celui qui décroche « tend un tuyau de son » (WebRTC) à l'appelant, qui répond avec le sien.
  let callStream = null;   // mon micro pendant un appel
  let media = null;        // le tuyau de son avec l'ami
  let callId = 0;          // change à chaque fin d'appel : sert à ignorer une réponse du micro arrivée trop tard
  // Le navigateur nettoie la voix : il enlève l'écho du haut-parleur, le souffle, et règle le volume tout seul
  const VOICE = { audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } };
  function openCallMic(){
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return Promise.reject({ name: "NoMicHere" });
    return navigator.mediaDevices.getUserMedia(VOICE);
  }
  let soundUp = false;     // mission 8 : le tuyau de son est vraiment branché (la voix circule)
  let heard = false;       // le haut-parleur caché a bien démarré
  function soundState(text){ $("soundState").textContent = text; }
  function showSound(){ if ($("soundBtn").hidden) soundState(soundUp && heard ? "Son connecté" : "Connexion du son…"); }
  // Mission 8 : le son passe. Je lance mon chrono et je crie « top ! » à l'ami pour qu'il lance le sien au même moment.
  function onSoundUp(){
    if (soundUp) return;
    soundUp = true;
    showSound();
    startChrono();
    send({ t: "chrono" });
  }
  // Brancher le tuyau de son : quand la voix de l'ami arrive, on la joue dans le haut-parleur caché
  function plugMedia(mc){
    media = mc;
    soundState("Connexion du son…");
    diagLog("Branchement du son");                     // mission 15
    diagWatch(mc.peerConnection, "Chemin du son");
    mc.on("stream", remote => {
      if (mc !== media) return;
      if ($("voice").srcObject !== remote) $("voice").srcObject = remote;
      playVoice();
      // Le son est « connecté » quand le chemin entre les deux appareils est trouvé (état « connected » de WebRTC)
      const pc = mc.peerConnection;
      const check = () => { if (mc === media && pc && ["connected","completed"].includes(pc.iceConnectionState)) onSoundUp(); };
      if (pc) pc.addEventListener("iceconnectionstatechange", check);
      check();
    });
    mc.on("close", () => { if (mc === media) liveCut("L'appel a été coupé."); });   // mission 18 : en expliquant pourquoi
    mc.on("error", e => {
      if (mc === media) diagLog("Erreur du son : " + (e && e.type || e));   // mission 15
      if (mc === media) liveCut("Le son n'a pas pu passer. Réessaie.");
    });
  }
  // Certains téléphones bloquent le son tant qu'on n'a pas touché l'écran : on affiche alors un bouton
  function playVoice(){
    $("voice").play().then(() => {
      if (!media) return;
      heard = true; $("soundBtn").hidden = true; showSound();
    }).catch(() => {
      if (!media) return;
      soundState("Le téléphone bloque le son :"); $("soundBtn").hidden = false;
    });
  }
  $("soundBtn").addEventListener("click", playVoice);
  // Fin du son : on ÉTEINT le micro tout de suite (le voyant du navigateur disparaît) et on coupe le haut-parleur
  function stopVoice(){
    if (callStream){ callStream.getTracks().forEach(t => t.stop()); callStream = null; }
    const m = media; media = null;
    if (m) setTimeout(() => m.close(), 500);   // petit délai : laisse d'abord partir le message « raccroche »
    $("voice").pause(); $("voice").srcObject = null;
    $("soundBtn").hidden = true;
    soundUp = heard = false;
    soundState("Connexion du son…");
    setMuted(false);                 // mission 8 : au prochain appel, le micro repart allumé
    $("peerMute").hidden = true;
  }

  // Mission 8 : couper mon micro. On ne l'éteint pas vraiment : on « pose la main dessus »
  // (le son envoyé devient du silence), et l'ami est prévenu par un petit message.
  let muted = false;
  function setMuted(on){
    muted = on;
    if (callStream) callStream.getAudioTracks().forEach(t => t.enabled = !on);
    $("muteBtn").setAttribute("aria-pressed", on);
    $("muteBtn").setAttribute("aria-label", on ? "Rallumer le micro" : "Couper le micro");
    $("muteCap").textContent = on ? "Micro coupé" : "Couper le micro";
    $("muteCap").classList.toggle("off", on);
  }
  $("muteBtn").addEventListener("click", () => {
    if (state !== "live") return;
    setMuted(!muted);
    send({ t: "micro", coupe: muted });
  });
  // L'ami vient de décrocher et me tend son tuyau de son : je réponds avec mon micro
  function incomingMedia(mc){
    const ok = mc.peer === PREFIX + friend && callStream && !media && (state === "calling" || state === "live");
    if (!ok){ mc.close(); return; }
    mc.answer(callStream);
    plugMedia(mc);
  }

  // ---------- Mission 13 : prévenir l'ami par notification ----------
  // Pendant que ça sonne, on suit deux nouvelles : « sa page a répondu ? » (online) et « la notification est partie ? » (notif).
  let reach = null;      // { online: true / false / null (on ne sait pas encore), notif: réponse du relais }
  let joining = false;   // true = je rejoins l'appel d'un ami, après avoir touché sa notification
  function ringHint(text){ $("outStatus").textContent = "Ça sonne…"; $("outHint").textContent = text; }
  function showRing(){
    if (state !== "calling" || joining || !reach || !callStream) return;
    if (reach.online === true) return ringHint("");   // sa page est ouverte : ça sonne chez lui, comme avant
    if (reach.online !== false) return;               // on attend encore la réponse du standardiste
    const n = reach.notif;
    if (!n) return ringHint("Sa page est fermée : envoi de la notification…");
    const minutes = s => Math.max(1, Math.ceil(s / 60));
    if (n.ok) ringHint("Notification envoyée (sa page était fermée).");
    else if (n.erreur === "rafale") ringHint("Notification déjà envoyée, patiente un peu (" + n.attendre + " s).");
    else if (n.erreur === "trop_par_heure") ringHint("Trop de notifications vers " + who(friend) + " cette heure-ci (réessaie dans " + minutes(n.attendre) + " min). Celles déjà envoyées marchent encore.");
    else if (n.erreur === "pas_abonne") endCall(Who(friend) + " n'est pas connecté (sa page est fermée) et n'a pas activé les notifications.");
    else if (n.erreur === "abonnement_mort") endCall(Who(friend) + " n'est pas connecté (sa page est fermée) et ne reçoit plus les notifications. Il doit les réactiver.");
    else endCall(Who(friend) + " n'est pas connecté (sa page est fermée), et la notification n'a pas pu partir. " + (n.message || ""));
  }
  // Attendre que la ligne avec le standardiste soit prête (la page vient peut-être juste de s'ouvrir)
  function peerReady(ms){
    const t0 = Date.now();
    return new Promise(ok => (function check(){
      if (peer && peer.open) ok(true);
      else if (Date.now() - t0 > ms) ok(false);
      else setTimeout(check, 200);
    })());
  }
  // Fermer la notification « … t'appelle » quand on s'en occupe dans la page (décroché, refusé, rejoint)
  function closeCallNotif(){
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.getRegistration()
      .then(reg => reg ? reg.getNotifications({ tag: "appel" }) : [])
      .then(list => list.forEach(n => n.close())).catch(() => {});
  }
  // L'ami a touché la notification « Noa t'appelle » (page ouverte par le veilleur, ou remise devant)
  function joinFromNotif(code){
    if (!/^[1-9]\d{5}$/.test(code) || code === MY) return;
    closeCallNotif();
    if (state === "ringing" && friend === code) return answer();   // ça sonnait déjà dans la page : on décroche
    if (state === "idle"){ go(1); startCall(code, true); }
  }
  // Le micro est bloqué sans toucher l'écran (ça peut arriver sur iPhone) : un bouton pour réessayer avec un toucher
  function askMicByTouch(){
    return new Promise(ok => {
      $("outStatus").textContent = "Micro…";
      $("outHint").textContent = "Touche le bouton pour autoriser le micro et rejoindre l'appel.";
      $("joinBtn").hidden = false;
      $("joinBtn").onclick = () => { $("joinBtn").hidden = true; ok(openCallMic()); };
    });
  }

  // ---------- Mission 14 : les sonneries, fabriquées par le navigateur (Web Audio), sans fichier son ----------
  // Web Audio = un petit synthétiseur caché dans le navigateur : on lui dit « joue un la pendant 1,5 s » et il le fabrique.
  // Règle des navigateurs (surtout l'iPhone) : la page doit avoir été touchée une fois avant de pouvoir faire du bruit.
  let snd = null;        // le synthétiseur (il reste allumé tant que la page est ouverte)
  let sndKind = "";      // ce qu'il joue : "ring" (carillon, appel entrant), "back" (« tuuut », ça sonne chez l'ami), "test", ""
  let sndNotes = [];     // les notes déjà prévues, pour pouvoir toutes les faire taire d'un coup
  let sndOut = null;     // le « bouton de volume » de ce qui joue en ce moment
  let recall = false;    // mission 13 : je rejoignais un appel fini, c'est devenu un nouvel appel qui sonne chez l'ami
  let tipTimer = null;
  function synth(){
    if (!snd){
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      try { snd = new AC(); } catch(e){ return null; }
      snd.onstatechange = showRingHelp;   // bloqué / débloqué : on met le bandeau à jour
    }
    return snd;
  }
  // Une note. bell = true : note de carillon (frappée puis qui s'éteint doucement) ; sinon une tonalité qui tient.
  function note(out, t, freq, dur, vol, bell){
    const o = snd.createOscillator(), g = snd.createGain();
    o.frequency.value = freq;
    o.connect(g); g.connect(out);
    g.gain.setValueAtTime(0, t);
    if (bell){
      g.gain.linearRampToValueAtTime(vol, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    } else {                                           // montée et descente de 30 ms : pas de « clic » dans le haut-parleur
      g.gain.linearRampToValueAtTime(vol, t + 0.03);
      g.gain.setValueAtTime(vol, t + dur - 0.03);
      g.gain.linearRampToValueAtTime(0, t + dur);
    }
    o.start(t); o.stop(t + dur + 0.05);
    sndNotes.push(o);
  }
  // Le carillon : do-mi-sol, comme un petit xylophone (+ une note fantôme une octave plus haut pour le côté « cloche »)
  function chime(out, t){
    [523.25, 659.25, 783.99].forEach((f, i) => {
      note(out, t + i * 0.16, f, 1.1, 0.35, true);
      note(out, t + i * 0.16, f * 2, 0.5, 0.08, true);
    });
  }
  // Jouer un son (ou "" pour le silence). Toutes les notes de la minute sont prévues d'avance :
  // ainsi ça sonne régulièrement même si la page est dans un onglet caché (où les minuteurs ralentissent).
  function playSound(kind){
    if (kind === sndKind) return;
    sndNotes.forEach(o => { try { o.stop(); } catch(e){} });   // silence immédiat
    sndNotes = [];
    if (sndOut){ const old = sndOut; setTimeout(() => old.disconnect(), 100); sndOut = null; }
    sndKind = kind;
    if (!kind || !synth()) return;
    if (snd.state !== "running") snd.resume().catch(() => {});   // (s'il est encore bloqué, il partira au 1er toucher)
    sndOut = snd.createGain();
    sndOut.gain.value = 0.5;
    sndOut.connect(snd.destination);
    const t0 = snd.currentTime + 0.05;
    if (kind === "ring") for (let k = 0; k < 33; k++) chime(sndOut, t0 + k * 2);              // toutes les 2 s, 66 s maximum
    if (kind === "back") for (let k = 0; k < 13; k++) note(sndOut, t0 + k * 5, 440, 1.5, 0.22); // France : 1,5 s de « la », 3,5 s de silence
    if (kind === "test"){
      chime(sndOut, t0); chime(sndOut, t0 + 2);
      setTimeout(() => { if (sndKind === "test") playSound(""); }, 3500);
    }
  }
  // Le chef d'orchestre : regarde où en est l'appel et choisit le son
  function sounds(){
    if (state === "ringing" && !$("answerBtn").disabled) playSound("ring");                  // appel entrant (pas encore décroché)
    else if (state === "calling" && callStream && (!joining || recall)) playSound("back");    // ça sonne chez l'ami
    else if (state !== "idle" || sndKind !== "test") playSound("");                          // tout le reste : silence
  }
  // Le bandeau « Touche l'écran pour activer la sonnerie » : visible tant que le navigateur bloque le son
  function showRingHelp(){
    if (tipTimer) return;   // un conseil après le test est affiché : on le laisse
    const locked = !snd || snd.state !== "running";
    const touch = navigator.maxTouchPoints > 0;
    $("ringMsg").textContent = touch ? "Touche l'écran pour activer la sonnerie." : "Clique n'importe où dans la page pour activer la sonnerie.";
    $("ringMsg").hidden = !locked || !synth();
  }
  // Le déblocage : au 1er toucher (ou clic, ou touche du clavier), on allume le synthétiseur
  // et on lui fait jouer un tout petit silence : c'est ce que l'iPhone attend pour autoriser le son.
  function unlockSound(){
    if (!synth() || snd.state === "running") return;
    snd.resume().then(showRingHelp, () => {});
    try { const b = snd.createBufferSource(); b.buffer = snd.createBuffer(1, 1, 22050); b.connect(snd.destination); b.start(0); } catch(e){}
  }
  ["touchend", "pointerup", "click", "keydown"].forEach(ev => document.addEventListener(ev, unlockSound, true));
  // Retour sur la page : le téléphone a pu remettre le synthétiseur en pause
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && snd && snd.state !== "running") snd.resume().then(showRingHelp, showRingHelp);
  });
  synth(); showRingHelp();   // à l'ouverture : on essaie (certains PC l'autorisent tout de suite), sinon le bandeau s'affiche
  // « Tester la sonnerie » : 2 carillons, puis un conseil si on n'entend rien
  $("ringBtn").addEventListener("click", () => {
    if (state !== "idle") return;
    unlockSound();
    playSound(""); playSound("test");
    clearTimeout(tipTimer);
    $("ringMsg").textContent = ios
      ? "Tu n'entends rien ? Vérifie le bouton silencieux sur le côté de l'iPhone (ou le mode Silence) et monte le volume."
      : "Tu n'entends rien ? Monte le volume de l'appareil (et vérifie que le son de cet onglet n'est pas coupé).";
    $("ringMsg").hidden = false;
    tipTimer = setTimeout(() => { tipTimer = null; showRingHelp(); }, 8000);
  });

  // J'appelle un code. join = true : je rejoins l'appel d'un ami qui m'a prévenu par notification (mission 13).
  async function startCall(code, join){
    if (state !== "idle" || !/^\d{6}$/.test(code)) return;
    if (code === MY){ callMessage("C'est ton propre numéro ! Tape le code d'un ami."); return; }
    if (!join && (!peer || !peer.open)){ callMessage("Pas encore connecté au standardiste. Attends que « En ligne » s'affiche en haut, puis réessaie."); return; }
    callMessage("");
    friend = code; typed = ""; renderDisplay();
    stopMic();             // si le test du micro tournait, on l'arrête
    state = "calling"; joining = !!join;
    // Mission 17 : la ligne de l'historique. Rejoindre l'appel d'un ami = un appel entrant (sauf s'il faut le rappeler).
    current = { code, sens: join ? "in" : "out", at: Date.now(), fin: "" };
    diagStart(join ? "je rejoins l'appel de" : "j'appelle");   // mission 15
    go(2);
    // Mission 7 : j'allume mon micro avant de faire sonner l'ami, pour que la voix passe dès qu'il décroche
    const attempt = callId;
    $("outStatus").textContent = "Micro…";
    $("outHint").textContent = !join ? "Autorise le micro pour que ton ami t'entende."
      : ios ? "Autorise le micro pour rejoindre l'appel. L'iPhone peut te redemander la permission à chaque appel : c'est normal."
      : "Autorise le micro pour rejoindre l'appel.";
    let s;
    try { s = await openCallMic(); }
    catch(e){
      // Mission 13 : page ouverte par la notification, sans toucher l'écran : l'iPhone peut exiger un toucher
      if (join && attempt === callId && e && e.name === "NotAllowedError"){
        try { s = await askMicByTouch(); } catch(e2){ e = e2; }
      }
      if (!s){ if (attempt === callId) endCall(micError(e)); return; }
    }
    if (attempt !== callId){ s.getTracks().forEach(t => t.stop()); return; }   // appel annulé pendant la question du micro
    callStream = s;
    diagLog("Micro autorisé");   // mission 15
    sounds();   // mission 14 : micro accepté, ça sonne chez l'ami : « tuuut… » chez moi
    if (join){
      $("outStatus").textContent = "Connexion…";
      $("outHint").textContent = "Tu rejoins l'appel " + ofWho(code) + ".";
      await peerReady(20000);   // la page vient de s'ouvrir : le standardiste met parfois quelques secondes
      if (attempt !== callId) return;
    } else ringHint("");
    await turnReady(4000);   // mission 15 : le badge du relais de voix (déjà là en général, demandé à l'ouverture)
    if (attempt !== callId) return;
    if (!peer || !peer.open){ endCall("La ligne avec le standardiste vient de se couper. Attends « En ligne », puis réessaie."); return; }
    const c = conn = peer.connect(PREFIX + code, { reliable: true });
    wire(c);
    send({ t: "appel" });
    if (!join){
      // Mission 13 : en même temps, on demande au relais de prévenir l'ami (utile si sa page est fermée)
      const r = reach = { online: null, notif: null };
      c.on("open", () => { if (reach === r){ r.online = true; showRing(); } });
      relay("/notifier", { de: MY, vers: code, type: "appel" }).then(n => { if (reach === r){ r.notif = n; showRing(); } });
    }
    // Personne ne décroche en 1 minute : on arrête
    ringTimer = setTimeout(() => { send({ t: "annule" }); outcome("pas_rep"); endCall("Pas de réponse au bout d'1 minute."); }, 60000);
  }

  // Quelqu'un m'appelle
  function incoming(c){
    const from = c.peer.startsWith(PREFIX) ? c.peer.slice(PREFIX.length) : "";
    if (!/^\d{6}$/.test(from)){ c.close(); return; }       // pas un numéro de notre appli : on ignore
    // Mission 13 : c'est l'ami que j'appelle, qui a touché ma notification (sa page était fermée).
    // Il « décroche » en venant me chercher : je passe tout seul en appel et je lui tends le tuyau de son.
    if (state === "calling" && from === friend && callStream && !media && !(conn && conn.open)){
      const old = conn; conn = c; wire(c);
      if (old) old.close();
      clearTimeout(ringTimer);
      reach = null;
      diagLog("L'ami a rejoint par la notification");   // mission 15
      state = "live"; go(4); onLive();
      send({ t: "decroche" });
      plugMedia(peer.call(PREFIX + friend, callStream));
      return;
    }
    if (state !== "idle"){                                    // déjà en ligne : on répond « occupé »
      c.on("open", () => { c.send({ t: "occupe" }); setTimeout(() => c.close(), 1000); });
      return;
    }
    friend = from;
    current = { code: from, sens: "in", at: Date.now(), fin: "" };   // mission 17
    diagStart("appel reçu de");   // mission 15
    conn = c; wire(c);
    state = "ringing";
    callMessage("");
    send({ t: "sonne" });   // mission 13 : dit à un ami qui rejoint trop tard que c'est un nouvel appel qui sonne
    go(3);
    // Sécurité : si l'appelant disparaît sans prévenir, on arrête de sonner
    ringTimer = setTimeout(() => endCall("Appel manqué " + ofWho(from) + "."), 65000);
  }

  // Les petits messages échangés entre les deux pages
  function onData(d){
    if (!d || typeof d.t !== "string") return;
    if (state === "calling" && d.t === "decroche"){ clearTimeout(ringTimer); diagLog("L'ami a décroché"); state = "live"; go(4); onLive(); }
    else if (state === "calling" && d.t === "sonne" && joining){   // mission 13
      ringHint("L'appel était fini : tu rappelles " + who(friend) + ".");
      recall = true; sounds();   // mission 14 : c'est un vrai appel qui sonne chez lui : « tuuut… »
      if (current) current.sens = "out";   // mission 17 : c'est moi qui rappelle
    }
    else if (state === "calling" && d.t === "refuse"){ outcome("refuse_ami"); endCall("Appel refusé par " + who(friend) + "."); }
    else if (state === "calling" && d.t === "nomicro") endCall(Who(friend) + " a voulu décrocher, mais son micro ne marche pas.");
    else if (state === "calling" && d.t === "occupe"){ outcome("occupe"); endCall(Who(friend) + " est déjà en ligne avec quelqu'un. Réessaie plus tard."); }
    else if (state === "ringing" && d.t === "annule") endCall("Appel manqué " + ofWho(friend) + ".");
    else if (state === "live" && d.t === "raccroche"){
      // Mission 18 : l'ami a fermé son appli (parti), ou sa page a vu l'appel mort pendant que j'étais parti (coupe)
      if (d.parti) endCall(Who(friend) + " a quitté l'app, l'appel est coupé.");
      else if (d.coupe && away) endAway();
      else endCall("Appel terminé.", true);
    }
    else if (state === "live" && (d.t === "absent" || d.t === "present")){   // mission 18 : l'ami quitte l'appli / revient
      if (friendAway === (d.t === "absent")) return;   // déjà su : on ne le note qu'une fois
      friendAway = d.t === "absent"; holdLeft = 0;
      diagLog(friendAway ? "L'ami a quitté l'appli" : "L'ami est revenu dans l'appli");
      peerAwayMsg();
    }
    else if (state === "live" && (d.t === "coupure" || d.t === "reprise")){   // mission 18 : appel téléphonique, Siri… chez l'ami
      friendCut = d.t === "coupure";
      diagLog(friendCut ? "Le micro de l'ami est interrompu par son téléphone" : "Le micro de l'ami repart");
      peerAwayMsg();
    }
    else if (state === "live" && d.t === "chrono") startChrono();   // mission 8 : le « top ! » de l'ami
    else if (state === "live" && d.t === "micro"){                   // mission 8 : l'ami a coupé / rallumé son micro
      $("peerMute").textContent = Who(friend) + " a coupé son micro.";
      $("peerMute").hidden = !d.coupe;
    }
  }
  // Le fil avec l'ami s'est coupé sans message
  function lineCut(){
    if (state === "calling") endCall("La communication a été coupée.");
    else if (state === "ringing") endCall("Appel manqué " + ofWho(friend) + ".");
    else liveCut("L'appel a été coupé.");   // mission 18 : en expliquant pourquoi
  }
  // Fin de l'appel, quelle qu'en soit la raison : retour à l'accueil avec un message
  function endCall(text, info){
    clearTimeout(ringTimer);
    callId++;
    logCall();   // mission 17 : une ligne dans l'historique (avant que le chrono s'arrête, pour la durée)
    diagEnd(text);   // mission 15 : on garde le diagnostic de cet appel, copiable depuis l'accueil
    // Mission 8 : si on a parlé, on ajoute la durée : « Appel terminé (02:15). »
    if (startAt && text) text = text.replace(/\.$/, "") + " (" + clock() + ").";
    stopVoice();   // mission 7 : le micro s'éteint dès que l'appel se termine, quelle qu'en soit la raison
    const c = conn; conn = null;
    state = "idle";
    reach = null; joining = false; recall = false; $("joinBtn").hidden = true;   // mission 13 (+ 14)
    endLive();   // mission 18 : battement de cœur, notification « En appel », écran d'Android, post-it
    if (c) setTimeout(() => c.close(), 500);   // petit délai pour que le dernier message parte bien
    go(1);
    callMessage(text || "", info);
  }

  // Les boutons des écrans d'appel
  $("cancelBtn").addEventListener("click", () => { send({ t: "annule" }); outcome("annule"); endCall(""); });
  $("refuseBtn").addEventListener("click", () => { closeCallNotif(); send({ t: "refuse" }); outcome("refuse"); endCall(""); });
  // Décrocher : j'allume mon micro (l'appui sur le bouton sert de « clé » sur iPhone), puis je tends le tuyau de son.
  // Mission 13 : aussi appelé tout seul quand on touche la notification pendant que ça sonne dans la page.
  $("answerBtn").addEventListener("click", () => answer());
  async function answer(){
    if (state !== "ringing" || $("answerBtn").disabled) return;
    const attempt = callId;
    closeCallNotif();
    $("answerBtn").disabled = true;
    sounds();   // mission 14 : la sonnerie se tait dès le toucher, même pendant la question du micro
    stopMic();
    let s;
    try { s = await openCallMic(); }
    catch(e){
      $("answerBtn").disabled = false;
      if (attempt === callId){ send({ t: "nomicro" }); endCall(micError(e)); }
      return;
    }
    diagLog("Micro autorisé, je décroche");   // mission 15
    await turnReady(3000);                      // mission 15 : le badge du relais de voix (déjà là en général)
    $("answerBtn").disabled = false;
    if (attempt !== callId){ s.getTracks().forEach(t => t.stop()); return; }   // l'appelant a abandonné pendant la question du micro
    if (!peer || !peer.open){ s.getTracks().forEach(t => t.stop()); send({ t: "nomicro" }); endCall("La ligne avec le standardiste est coupée. Réessaie dans un instant."); return; }
    clearTimeout(ringTimer);
    callStream = s;
    send({ t: "decroche" }); state = "live"; go(4); onLive();
    plugMedia(peer.call(PREFIX + friend, s));
  }
  $("hangBtn").addEventListener("click", () => { send({ t: "raccroche" }); endCall("Appel terminé.", true); });

  // ---------- Mission 18 : l'appel quand on quitte l'appli ou que l'écran se verrouille ----------
  // 1. Le verrou d'éveil (Wake Lock) : une cale sous la porte pour que l'écran ne s'éteigne pas tout seul.
  //    Le téléphone retire la cale quand on quitte la page : on la remet à chaque retour.
  let wake = null, wantWake = false, wakeAsking = false;
  function keepAwake(on){
    wantWake = on;
    if (!on){ const w = wake; wake = null; if (w) w.release().catch(() => {}); return; }
    if (wake || wakeAsking || !("wakeLock" in navigator) || document.visibilityState !== "visible") return;
    wakeAsking = true;
    navigator.wakeLock.request("screen").then(w => {
      wakeAsking = false;
      if (!wantWake){ w.release().catch(() => {}); return; }
      wake = w; diagLog("Écran gardé allumé");
      w.addEventListener("release", () => { if (wake === w) wake = null; });
    }, e => { wakeAsking = false; diagLog("Écran gardé allumé : impossible (" + (e && e.name || e) + ")"); });
  }

  // 2. La notification « En appel avec Noa » (silencieuse) : la toucher ramène sur l'appel. Elle part quand on raccroche.
  function showLiveNotif(){
    if (!("serviceWorker" in navigator) || !("Notification" in window) || Notification.permission !== "granted") return;
    const name = nameOf(friend) || fmt(friend);
    navigator.serviceWorker.getRegistration().then(reg => reg && reg.showNotification("En appel avec " + name, {
      body: ios ? "Touche pour revenir à l'appel : tant que tu n'es pas dans l'app, vous ne vous entendez plus." : "Touche pour revenir à l'appel.",
      icon: "icon-192.png", tag: "encours", silent: true, data: { type: "encours" },
    })).catch(() => {});
  }
  function closeLiveNotif(){
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.getRegistration()
      .then(reg => reg ? reg.getNotifications({ tag: "encours" }) : [])
      .then(list => list.forEach(n => n.close())).catch(() => {});
  }

  // 3. Android : l'appel sur l'écran verrouillé, comme un lecteur de musique (Media Session = la télécommande du téléphone).
  //    Le bouton ⏸ de cette télécommande raccroche. Pas sur iPhone ni PC, où ⏸ couperait juste le son sans raccrocher.
  function mediaInfo(on){
    if (!("mediaSession" in navigator) || !/Android/i.test(navigator.userAgent)) return;
    const ms = navigator.mediaSession, acts = ["hangup", "pause", "stop"];
    try {
      if (!on){
        ms.metadata = null; ms.playbackState = "none";
        acts.forEach(a => { try { ms.setActionHandler(a, null); } catch(e){} });
        return;
      }
      ms.metadata = new MediaMetadata({
        title: "En appel avec " + (nameOf(friend) || fmt(friend)), artist: "Téléphone · ⏸ = raccrocher",
        artwork: [{ src: "icon-192.png", sizes: "192x192", type: "image/png" }, { src: "icon-512.png", sizes: "512x512", type: "image/png" }],
      });
      ms.playbackState = "playing";
      acts.forEach(a => { try { ms.setActionHandler(a, () => { if (state === "live") $("hangBtn").click(); }); } catch(e){} });
    } catch(e){}
  }

  // 4. Ne jamais laisser un appel muet. Les deux pages s'envoient « coucou » toutes les 2 s (un battement de cœur).
  //    Plus de coucou ET plus de son pendant 10 s = l'appel est mort : on raccroche en expliquant pourquoi.
  //    Sauf si l'ami a quitté l'appli : l'appel l'attend jusqu'à 5 min (« en attente »), et reprend s'il revient à temps.
  //    On regarde les deux : sur Android, la voix peut continuer même si la page dort (et alors, pas de coucou).
  const DEAD_MS = 10000, HOLD_MS = 5 * 60000;
  let holdLeft = 0;
  let friendSilent = false;   // plus aucun son ne m'arrive de l'ami depuis 3 s (son iPhone coupe son micro quand il quitte l'app)   // l'ami est parti et on ne l'entend plus : secondes avant de couper (0 = pas en attente)
  let beat = null, lastPing = 0, lastTick = 0, graceUntil = 0, voiceSeen = { n: -1, at: 0 };
  let away = false, awayTimer = null;   // j'ai quitté l'appli pendant l'appel (téléphone seulement)
  let friendAway = false, friendCut = false, myCut = false;   // l'ami a quitté l'appli / son micro ou le mien interrompu
  let recallCode = "";
  const onPhone = () => ios || /Android/i.test(navigator.userAgent);
  const say = msg => { if (conn && conn.open) try { conn.send(msg); } catch(e){} };   // sans attendre : maintenant ou jamais
  function onLive(){
    lastPing = lastTick = Date.now(); graceUntil = 0; voiceSeen = { n: -1, at: Date.now() };
    clearInterval(beat); beat = setInterval(beatTick, 2000);
    $("stayMsg").hidden = !ios;
    showLiveNotif(); mediaInfo(true); watchMic();
  }
  function endLive(){
    clearInterval(beat); beat = null;
    closeLiveNotif(); mediaInfo(false);
    friendAway = friendCut = myCut = false; holdLeft = 0; peerAwayMsg();
    away = false; clearTimeout(awayTimer); forgetCutNote();
  }
  async function beatTick(){
    if (state !== "live") return;
    const id = callId, now = Date.now();
    if (now - lastTick > 6000) graceUntil = now + 4000;   // la page dormait (minuteurs arrêtés) : on laisse 4 s aux nouvelles
    lastTick = now;
    say({ t: "coucou" });
    const pc = media && media.peerConnection;
    if (pc){
      let st = null; try { st = await pc.getStats(); } catch(e){}
      if (id !== callId) return;
      if (st) st.forEach(r => {
        if (r.type === "inbound-rtp" && (r.kind || r.mediaType) === "audio" && r.packetsReceived > voiceSeen.n) voiceSeen = { n: r.packetsReceived, at: Date.now() };
      });
    }
    if (state !== "live" || Date.now() < graceUntil) return;
    const quiet = Date.now() - Math.max(lastPing, voiceSeen.at);
    const left = friendAway && quiet > 4000 ? Math.max(0, Math.ceil((HOLD_MS - quiet) / 1000)) : 0;
    const silent = Date.now() - voiceSeen.at > 3000;
    if (left !== holdLeft || silent !== friendSilent){ holdLeft = left; friendSilent = silent; peerAwayMsg(); }
    if (quiet < (friendAway ? HOLD_MS : DEAD_MS)) return;
    diagLog("Plus de nouvelles de l'ami depuis " + Math.round(quiet / 1000) + " s : appel coupé");
    say({ t: "raccroche", coupe: true });
    liveCut("L'appel a été coupé : plus de nouvelles " + ofWho(friend) + " (connexion perdue).");
  }
  // L'appel en cours s'arrête sans « raccroche » : on dit pourquoi
  function liveCut(text){
    if (state !== "live") return;
    if (away) endAway();
    else if (friendAway) endCall(Who(friend) + " a quitté l'app, l'appel est coupé.");
    else endCall(text);
  }
  function endAway(){
    const code = friend;
    endCall("L'appel s'est coupé quand tu as quitté l'app.");
    showRecall(code);
  }
  function showRecall(code){
    recallCode = code;
    $("recallBtn").querySelector("span").textContent = "Rappeler " + (nameOf(code) || fmt(code));
    $("recallBtn").hidden = false;
  }
  $("recallBtn").addEventListener("click", async () => {
    const code = recallCode;
    callMessage("");
    if (!peer || !peer.open){ callMessage("Connexion au standardiste…", true, true); await peerReady(15000); }
    if (state === "idle"){ callMessage(""); startCall(code); }
  });
  // Les petites lignes de l'écran d'appel : l'ami a quitté l'appli, ou un appel téléphonique coupe un micro
  function peerAwayMsg(){
    const lines = [];
    const mmss = s => Math.floor(s / 60) + " min " + String(s % 60).padStart(2, "0") + " s";
    if (friendAway && holdLeft) lines.push(Who(friend) + " a quitté l'app : vous ne vous entendez plus. L'appel reprend dès son retour (coupé dans " + mmss(holdLeft) + ").");
    else if (friendAway && (friendCut || friendSilent)) lines.push(Who(friend) + " a quitté l'app : tu ne l'entends plus jusqu'à son retour (son téléphone coupe son micro).");
    else if (friendAway) lines.push(Who(friend) + " a quitté l'app.");
    else if (friendCut) lines.push("Le micro " + ofWho(friend) + " est interrompu par son téléphone (appel en cours ?).");
    if (myCut) lines.push("Ton micro est interrompu par ton téléphone (appel en cours ?).");
    $("peerAway").textContent = lines.join(" ");
    $("peerAway").hidden = !lines.length;
  }
  // Un appel téléphonique normal (ou Siri…) prend le micro : le navigateur le signale (« mute ») et le rend après
  function watchMic(){
    const t = callStream && callStream.getAudioTracks()[0];
    if (!t) return;
    t.onmute = () => { if (state !== "live") return; myCut = true; say({ t: "coupure" }); diagLog("Mon micro est interrompu par le téléphone"); peerAwayMsg(); };
    t.onunmute = () => { if (state !== "live") return; myCut = false; say({ t: "reprise" }); diagLog("Mon micro repart"); peerAwayMsg(); playVoice(); };
  }
  // Le post-it « appel coupé » rangé dans le navigateur quand je quitte l'appli en plein appel :
  // si l'iPhone relance complètement l'appli, la page le retrouve au retour (et note l'appel dans l'historique).
  function keepCutNote(withHist){
    const c = current;
    const h = withHist && c ? { code: c.code, sens: c.sens, at: c.at, fin: "ok", duree: startAt ? Math.floor((Date.now() - startAt) / 1000) : 0 } : null;
    try { localStorage.setItem("appelCoupe", JSON.stringify({ code: friend, at: Date.now(), h })); } catch(e){}
  }
  function forgetCutNote(){ try { localStorage.removeItem("appelCoupe"); } catch(e){} }
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden"){
      if (state === "live" && onPhone()){
        away = true; clearTimeout(awayTimer);
        say({ t: "absent" }); keepCutNote(true);
        showLiveNotif();   // l'iPhone cache les notifications quand l'appli est ouverte : on la remet en partant
        diagLog("J'ai quitté l'appli pendant l'appel");
      }
      return;
    }
    if (wantWake) keepAwake(true);   // le téléphone a retiré la cale : on la remet
    if (state !== "live") return;
    graceUntil = Date.now() + 4000;  // on laisse 4 s aux nouvelles de l'ami avant de juger
    playVoice();                     // l'iPhone a pu mettre le haut-parleur en pause
    if (away){
      say({ t: "present" });
      diagLog("Je suis revenu dans l'appli");
      clearTimeout(awayTimer);
      // Toujours en appel 8 s après le retour : l'appel a tenu, on oublie le post-it
      awayTimer = setTimeout(() => { if (state === "live" && document.visibilityState === "visible"){ away = false; forgetCutNote(); } }, 8000);
    }
  });
  // À l'ouverture (ou page remise telle quelle depuis la mémoire du navigateur) : un post-it laissé par un appel coupé.
  // L'appli a été fermée ou relancée entre-temps. 15 min maximum.
  function checkCutNote(){
    let note = null; try { note = JSON.parse(localStorage.getItem("appelCoupe") || "null"); } catch(e){}
    forgetCutNote();
    if (!note || !/^[1-9]\d{5}$/.test(note.code) || !(Date.now() - note.at < 15 * 60000) || state !== "idle") return;
    if (note.h && typeof note.h.at === "number" && !hist.some(h => h.at === note.h.at && h.code === note.h.code)){ hist.unshift(note.h); saveHist(); }
    callMessage("L'appel s'est coupé quand tu as quitté l'app.");
    showRecall(note.code);
  }
  setTimeout(checkCutNote, 0);   // quand toute la page est prête (l'historique compris)
  window.addEventListener("pageshow", e => { if (e.persisted) checkCutNote(); });

  // ---------- Mission 17 : l'historique des appels ----------
  // Un carnet rangé dans le navigateur (localStorage « historique »), le plus récent en premier, 50 lignes maximum.
  // Une ligne : { code, sens: "in" | "out", fin, at (heure du début), duree (secondes), vu (pour les manqués) }.
  // fin : "ok" (on a parlé), "manque", "refuse" (j'ai refusé), et pour mes appels pas aboutis :
  // "refuse_ami", "pas_rep", "occupe", "annule", "echec".
  const HIST_MAX = 50;
  let hist = [];
  try { hist = JSON.parse(localStorage.getItem("historique") || "[]"); } catch(e){ hist = []; }
  if (!Array.isArray(hist)) hist = [];
  hist = hist.filter(h => h && /^[1-9]\d{5}$/.test(h.code) && typeof h.at === "number");
  let current = null;   // l'appel en cours, qui deviendra une ligne à sa fin
  function saveHist(){
    hist.sort((a, b) => b.at - a.at);
    hist = hist.slice(0, HIST_MAX);   // les plus vieux partent tout seuls
    try { localStorage.setItem("historique", JSON.stringify(hist)); } catch(e){}
    renderBadge();
    if (!$("s7").hidden){ seeAll(); renderHist(); }
  }
  // Pourquoi l'appel n'a pas abouti (noté juste avant endCall)
  function outcome(fin){ if (current) current.fin = fin; }
  // Fin d'un appel : on écrit sa ligne. why = la raison quand on ferme la page en plein appel.
  function logCall(why){
    const c = current; current = null;
    if (!c) return;
    const h = { code: c.code, sens: c.sens, at: c.at, duree: 0, fin: "" };
    if (state === "live"){ h.fin = "ok"; h.duree = startAt ? Math.floor((Date.now() - startAt) / 1000) : 0; }
    else if (c.sens === "in") h.fin = (why || c.fin) === "refuse" ? "refuse" : "manque";
    else h.fin = why || c.fin || "echec";
    if (h.fin === "manque") h.vu = !$("s7").hidden;
    hist.unshift(h);
    saveHist();
  }
  // Le petit chiffre rouge sur « Historique » : les appels manqués pas encore vus
  function renderBadge(){
    const n = hist.filter(h => h.fin === "manque" && !h.vu).length;
    $("missedBadge").textContent = n > 9 ? "9+" : n;
    $("missedBadge").hidden = !n;
    $("histBtn").setAttribute("aria-label", "Historique" + (n ? " (" + n + " appel" + (n > 1 ? "s" : "") + " manqué" + (n > 1 ? "s" : "") + ")" : ""));
  }
  function seeAll(){
    if (!hist.some(h => h.fin === "manque" && !h.vu)) return;
    hist.forEach(h => { if (h.fin === "manque") h.vu = true; });
    try { localStorage.setItem("historique", JSON.stringify(hist)); } catch(e){}
    renderBadge();
  }
  function histMessage(text){ $("histMsg").textContent = text; $("histMsg").hidden = !text; }
  // « Aujourd'hui à 14:32 », « Hier à 09:10 », « lun. 6 oct. à 18:00 »
  function when(t){
    const d = new Date(t), now = new Date();
    const day = x => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
    const days = Math.round((day(now) - day(d)) / 86400000);
    const hm = String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
    if (days === 0) return "Aujourd'hui à " + hm;
    if (days === 1) return "Hier à " + hm;
    return d.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" }) + " à " + hm;
  }
  const mmss = s => String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0");
  // Les petites flèches : ↙ reçu, ↗ émis, et un rond barré pour « refusé »
  const ARROW_IN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M18 6 6 18M6 9v9h9"/></svg>';
  const ARROW_OUT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M6 18 18 6M9 6h9v9"/></svg>';
  const BLOCKED = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="8"/><path d="m6.5 6.5 11 11"/></svg>';
  const NOTES = { refuse_ami: "refusé", pas_rep: "pas de réponse", occupe: "occupé", annule: "annulé", echec: "pas abouti" };
  function kindOf(h){
    if (h.fin === "manque") return { svg: ARROW_IN, text: "Manqué", missed: true };
    if (h.fin === "refuse") return { svg: BLOCKED, text: "Refusé" };
    if (h.sens === "in") return { svg: ARROW_IN, text: "Entrant · " + mmss(h.duree || 0) };
    if (h.fin === "ok") return { svg: ARROW_OUT, text: "Sortant · " + mmss(h.duree || 0) };
    return { svg: ARROW_OUT, text: "Sortant · " + (NOTES[h.fin] || NOTES.echec) };
  }
  function renderHist(){
    const ul = $("hist");
    ul.innerHTML = "";
    $("clearBtn").hidden = !hist.length;
    if (!hist.length){
      const li = document.createElement("li");
      li.className = "empty";
      li.textContent = "Aucun appel pour l'instant. Tes appels (passés, reçus, manqués) s'afficheront ici.";
      ul.appendChild(li);
      return;
    }
    hist.forEach(h => {
      const k = kindOf(h), name = nameOf(h.code);
      const li = document.createElement("li");
      li.className = "card" + (k.missed ? " missed" : "");
      // Toute la ligne (rond + nom + détails) est un bouton : la toucher rappelle
      const main = document.createElement("button");
      main.className = "hist-main";
      main.setAttribute("aria-label", "Rappeler " + (name || fmt(h.code)) + " (" + k.text.replace(" · ", ", ") + ", " + when(h.at) + ")");
      const av = document.createElement("div"); av.className = "avatar"; paintAvatar(av, h.code);
      const info = document.createElement("div"); info.className = "who";
      const nm = document.createElement("b"); nm.textContent = name || fmt(h.code);
      if (!name) nm.className = "num";
      const kind = document.createElement("span"); kind.className = "kind" + (k.missed ? " missed" : "");
      kind.innerHTML = k.svg; kind.append(k.text);
      const at = document.createElement("span"); at.className = "when"; at.textContent = when(h.at);
      info.append(nm, kind, at);
      main.append(av, info);
      main.addEventListener("click", () => { go(1); startCall(h.code); });   // même chemin que le bouton Appeler
      li.append(main);
      if (!name) li.append(iconBtn("small", "Ajouter " + fmt(h.code) + " aux contacts",
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="10" cy="8" r="4"/><path d="M2 21a8 8 0 0 1 13-6.2M19 14v6M16 17h6"/></svg>',
        () => openForm(null, h.code, true)));
      li.append(iconBtn("small", "Effacer cet appel",
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>',
        () => { hist = hist.filter(x => x !== h); saveHist(); histMessage(""); }));
      ul.appendChild(li);
    });
  }
  function openHist(){
    histMessage(""); $("clearBox").hidden = true;
    go(7); seeAll(); renderHist();
    importMissed();   // au cas où le veilleur a noté un appel pendant que la page dormait
  }
  $("histBtn").addEventListener("click", openHist);
  $("histBack").addEventListener("click", () => go(1));
  $("clearBtn").addEventListener("click", () => { $("clearBox").hidden = false; $("clearBtn").hidden = true; });
  $("noClear").addEventListener("click", () => { $("clearBox").hidden = true; $("clearBtn").hidden = !hist.length; });
  $("yesClear").addEventListener("click", () => { hist = []; saveHist(); $("clearBox").hidden = true; histMessage("Historique effacé."); });

  // Page fermée : le veilleur (sw.js) ne peut pas écrire dans le localStorage. À chaque notification d'appel,
  // il range { de, at } dans le tiroir IndexedDB « telephone » (casier « recus »), comme un mot laissé sur la table.
  // La page les range dans l'historique comme « manqués », sauf si l'appel est déjà noté (page ouverte qui a sonné,
  // ou appel rejoint en touchant la notification : la page a écrit sa propre ligne).
  // On attend 70 s après la notification : l'appel peut encore sonner ou être rejoint.
  let importTimer = null;
  function importMissed(){
    clearTimeout(importTimer);
    try {
      const open = indexedDB.open("telephone", 1);
      open.onupgradeneeded = () => open.result.createObjectStore("tiroir");
      open.onsuccess = () => {
        const db = open.result;
        try {
          const store = db.transaction("tiroir", "readwrite").objectStore("tiroir");
          const get = store.get("recus");
          get.onsuccess = () => {
            const list = Array.isArray(get.result) ? get.result.filter(r => r && /^[1-9]\d{5}$/.test(r.de) && typeof r.at === "number") : [];
            const now = Date.now();
            const young = list.filter(r => now - r.at < 70000);
            if (young.length) store.put(young, "recus"); else if (get.result) store.delete("recus");
            db.close();
            let added = false;
            list.filter(r => now - r.at >= 70000).forEach(r => {
              const known = hist.some(h => h.code === r.de && h.at > r.at - 90000 && h.at < r.at + 120000);
              if (!known){ hist.push({ code: r.de, sens: "in", fin: "manque", at: r.at, duree: 0, vu: false }); added = true; }
            });
            if (added) saveHist();
            if (young.length) importTimer = setTimeout(importMissed, 72000 - (now - Math.min(...young.map(r => r.at))));
          };
          get.onerror = () => db.close();
        } catch(e){ db.close(); }
      };
    } catch(e){}
  }
  renderBadge();
  importMissed();
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") importMissed(); });

  // ---------- Mission 15 : le relais de voix (TURN) ----------
  // Deux téléphones sur deux réseaux fermés (4G, box strictes) ne peuvent pas se parler directement :
  // la voix passe alors par le relais de voix de Cloudflare, comme par un bureau de poste.
  // Pour y entrer, il faut un badge (identifiants valables 6 h) : c'est mon relais qui le fabrique,
  // avec la clé rangée dans son coffre. La page ne contient aucune clé.
  function iceConfig(){
    return { iceServers: [{ urls: "stun:stun.l.google.com:19302" }].concat(turn.servers), sdpSemantics: "unified-plan" };
  }
  function loadTurn(){
    if (turn.servers && Date.now() < turn.until - 30*60*1000) return Promise.resolve();   // badge encore bon au moins 30 min
    if (!turn.pending) turn.pending = relay("/turn", {}).then(r => {
      turn.pending = null;
      if (r.ok && Array.isArray(r.iceServers) && r.iceServers.length){
        turn.servers = r.iceServers; turn.until = Date.now() + (r.duree || 3600) * 1000; turn.why = "";
        if (peer) peer.options.config = iceConfig();   // PeerJS relit cette liste à chaque nouvel appel
      } else turn.why = r.message || r.erreur || "pas de réponse";
    });
    return turn.pending;
  }
  // Avant un appel : on attend le badge quelques secondes au plus (sinon on appelle quand même, sans relais de voix)
  const turnReady = ms => Promise.race([loadTurn(), new Promise(ok => setTimeout(ok, ms))]);

  // ---------- Mission 15 : l'écran Diagnostic ----------
  // Pendant un appel, la page note chaque seconde ce que dit le « tableau de bord » de WebRTC (getStats) :
  // par où passe la voix, si mon micro envoie du son, si celui de l'ami arrive. Aucune adresse IP n'est notée.
  let diag = null;        // le carnet de l'appel en cours
  let lastReport = "";    // le diagnostic du dernier appel, copiable depuis l'accueil
  let diagOpen = false;
  try { diagOpen = localStorage.getItem("diagOuvert") === "1"; } catch(e){}
  const ICE_FR = { "new": "pas commencée", checking: "recherche du chemin…", connected: "connectée", completed: "connectée",
    disconnected: "coupure (elle essaie de revenir…)", failed: "échec : aucun chemin trouvé", closed: "fermée" };
  const since = t => { const s = Math.max(0, Math.round((Date.now() - t) / 1000)); return String(Math.floor(s/60)).padStart(2,"0") + ":" + String(s%60).padStart(2,"0"); };
  function diagLog(text){
    if (!diag) return;
    diag.log.push(since(diag.t0) + " " + text);
    if (diag.log.length > 60) diag.log.splice(1, 1);   // on garde la 1re ligne et les plus récentes
  }
  function diagStart(role){
    clearInterval(diag && diag.timer);
    diag = { t0: Date.now(), role, log: [], seen: {}, now: {}, before: {}, timer: null };
    diagLog("Début : " + role + " " + fmt(friend));
    diagLog("Relais de voix : " + (turn.servers ? "prêt" : "pas disponible (" + turn.why + ")"));
    $("lastDiagBtn").hidden = $("lastDiagText").hidden = $("diagText").hidden = true;
    diag.timer = setInterval(diagSample, 1000);
    diagPaint();
  }
  // Écouter les changements d'état d'un « chemin » WebRTC (celui du son, ou celui des petits messages)
  function diagWatch(pc, what){
    if (!pc) return;
    pc.addEventListener("iceconnectionstatechange", () => diagLog(what + " : " + (ICE_FR[pc.iceConnectionState] || pc.iceConnectionState)));
  }
  // Le niveau sonore d'une seconde (0 = silence, 1 = très fort), à partir de l'énergie du son
  function level(now, before){
    if (!now) return null;
    if (before && now.totalAudioEnergy != null && before.totalAudioEnergy != null && now.totalSamplesDuration > before.totalSamplesDuration)
      return Math.sqrt(Math.max(0, now.totalAudioEnergy - before.totalAudioEnergy) / (now.totalSamplesDuration - before.totalSamplesDuration));
    return typeof now.audioLevel === "number" ? now.audioLevel : null;
  }
  const perSecond = (now, before, key, dt) => now && before && now[key] != null && before[key] != null && dt > 0 ? (now[key] - before[key]) / dt : null;
  async function diagSample(){
    const d = diag; if (!d) return;
    const pc = media && media.peerConnection, pcMsg = conn && conn.peerConnection;
    const n = { at: Date.now(), sound: !!pc, ice: pc ? pc.iceConnectionState : "", msgIce: pcMsg ? pcMsg.iceConnectionState : "" };
    const target = pc || pcMsg;
    if (target){
      let stats = null; try { stats = await target.getStats(); } catch(e){}
      if (d !== diag) return;
      try { n.turnUsed = target.getConfiguration().iceServers.some(s => [].concat(s.urls).some(u => /^turns?:turn\.cloudflare\.com/.test(u))); } catch(e){}
      if (stats){
        const byId = new Map(); stats.forEach(r => byId.set(r.id, r));
        let pair = null;
        stats.forEach(r => { if (r.type === "transport" && r.selectedCandidatePairId) pair = byId.get(r.selectedCandidatePairId); });
        if (!pair) stats.forEach(r => { if (r.type === "candidate-pair" && (r.selected || (r.nominated && r.state === "succeeded"))) pair = r; });
        const lc = pair && byId.get(pair.localCandidateId), rc = pair && byId.get(pair.remoteCandidateId);
        if (lc && rc){ n.mine = lc.candidateType; n.theirs = rc.candidateType; n.proto = lc.relayProtocol || lc.protocol || ""; }
        n.found = {};
        stats.forEach(r => {
          if (r.type === "local-candidate") n.found[r.candidateType] = (n.found[r.candidateType] || 0) + 1;
          const kind = r.kind || r.mediaType;
          if (kind !== "audio") return;
          if (r.type === "outbound-rtp") n.out = r;
          if (r.type === "inbound-rtp") n.in = r;
          if (r.type === "media-source") n.src = r;
        });
      }
    }
    const b = d.now, dt = b.at ? (n.at - b.at) / 1000 : 0;
    n.sentRate = perSecond(n.out, b.out, "packetsSent", dt);
    n.recvRate = perSecond(n.in, b.in, "packetsReceived", dt);
    n.micLevel = level(n.src, b.src);
    n.recvLevel = level(n.in, b.in);
    d.before = b; d.now = n;
    diagPaint();
  }
  // Traduire les mesures en phrases simples
  function diagWords(){
    const n = (diag && diag.now) || {};
    const w = {};
    const kind = { host: "réseau local", srflx: "internet", prflx: "internet", relay: "relais" };
    if (n.mine && n.theirs){
      if (n.mine === "relay" || n.theirs === "relay")
        w.path = "Par le relais de voix (" + (n.mine === "relay" && n.theirs === "relay" ? "des deux côtés" : n.mine === "relay" ? "de mon côté" : "du côté de l'ami") + ", " + n.proto + ")";
      else w.path = n.mine === "host" && n.theirs === "host" ? "Directe (même réseau)" : "Directe (par internet, " + n.proto + ")";
      w.pathCode = n.mine + "/" + n.theirs + " (" + (kind[n.mine] || n.mine) + " / " + (kind[n.theirs] || n.theirs) + ")";
    } else w.path = n.sound || n.msgIce ? "Pas encore trouvée" : "Pas encore commencée";
    w.state = n.sound ? "Son : " + (ICE_FR[n.ice] || n.ice || "—") : n.msgIce ? "Messages : " + (ICE_FR[n.msgIce] || n.msgIce) + " (le son n'est pas encore branché)" : "En attente de l'ami";
    const track = callStream && callStream.getAudioTracks()[0];
    const pathOk = n.ice === "connected" || n.ice === "completed" || n.ice === "disconnected";
    if (!track) w.mic = "Non : micro pas encore ouvert";
    else if (track.readyState === "ended") w.mic = "Non : le micro s'est arrêté";
    else if (!track.enabled) w.mic = "Non : micro coupé (bouton « Couper le micro »)";
    else if (track.muted) w.mic = "Non : le téléphone bloque le micro (autre appli ? appel téléphonique en cours ?)";
    else if (!n.sound) w.mic = "Pas encore : le son n'est pas branché";
    else if (n.ice === "failed") w.mic = "Non : aucun chemin vers l'ami";
    else if (!pathOk) w.mic = "Pas encore : chemin pas encore trouvé";
    else if (n.sentRate == null) w.mic = "Mesure en cours…";
    else if (n.sentRate > 0) w.mic = "Oui";
    else w.mic = "Non : rien ne part";
    w.micOk = w.mic === "Oui";
    const rt = $("voice").srcObject && $("voice").srcObject.getAudioTracks()[0];
    if (!n.sound) w.recv = "Pas encore : le son n'est pas branché";
    else if (n.ice === "failed") w.recv = "Non : aucun chemin depuis l'ami";
    else if (!pathOk) w.recv = "Pas encore : chemin pas encore trouvé";
    else if (n.recvRate == null) w.recv = "Mesure en cours…";
    else if (n.recvRate > 0) w.recv = $("voice").paused ? "Arrive, mais le lecteur est bloqué (bouton « Toucher pour entendre »)" : "Oui";
    else w.recv = "Non : rien n'arrive";
    w.recvOk = w.recv === "Oui";
    if (rt && rt.muted && n.recvRate > 0) w.recv += " (piste muette)";
    const f = n.found || {};
    w.turn = turn.servers ? "Prêt (Cloudflare)" : "Pas disponible : " + turn.why;
    if (n.sound || n.msgIce){
      if (n.turnUsed === false) w.turn += turn.servers ? " · pas utilisé pour cet appel (badge arrivé trop tard)" : "";
      else if (n.turnUsed && n.found) w.turn += f.relay ? " · joignable (" + f.relay + " chemin" + (f.relay > 1 ? "s" : "") + ")" : " · pas joignable d'ici pour l'instant";
    }
    return w;
  }
  function diagPaint(){
    if (!diag) return;
    const w = diagWords(), n = diag.now;
    // On note dans le journal chaque changement important (panneau ouvert ou non)
    const seen = diag.seen;
    [["path", "Connexion"], ["mic", "Mon micro envoyé"], ["recv", "Son reçu"]].forEach(([k, label]) => {
      if (seen[k] !== w[k]){ seen[k] = w[k]; diagLog(label + " : " + w[k]); }
    });
    if ($("diag").hidden) return;
    $("dgPath").textContent = w.path;
    $("dgState").textContent = w.state;
    $("dgMic").textContent = w.mic; $("dgMic").className = w.micOk ? "ok" : "";
    $("dgRecv").textContent = w.recv; $("dgRecv").className = w.recvOk ? "ok" : "";
    $("dgTurn").textContent = w.turn;
    const bar = v => Math.round(Math.min(1, (v || 0) * 4) * 100) + "%";   // amplifié pour qu'une voix normale remplisse la barre
    $("dgMicLvl").style.width = bar(n.micLevel);
    $("dgRecvLvl").style.width = bar(n.recvLevel);
  }
  // Le texte à copier et à envoyer
  function deviceName(){
    const u = navigator.userAgent, v = re => (u.match(re) || [])[1];
    const os = ios ? "iPhone/iPad iOS " + (v(/OS (\d+_\d+)/) || "?").replace("_", ".")
      : /Android/.test(u) ? "Android " + (v(/Android ([\d.]+)/) || "") + (v(/; ([^;)]+) Build/) ? " (" + v(/; ([^;)]+) Build/) + ")" : "")
      : /Windows/.test(u) ? "PC Windows" : /Mac/.test(u) ? "Mac" : "autre";
    const browsers = [[/SamsungBrowser\/(\d+)/, "Samsung Internet"], [/EdgA?\/(\d+)/, "Edge"], [/OPR\/(\d+)/, "Opera"],
      [/(?:Firefox|FxiOS)\/(\d+)/, "Firefox"], [/(?:CriOS|Chrome)\/(\d+)/, "Chrome"], [/Version\/(\d+).*Safari/, "Safari"]];
    const br = browsers.find(([re]) => re.test(u));
    const name = br && navigator.brave && br[1] === "Chrome" ? "Brave" : br && br[1];   // mission 16 : Brave se fait passer pour Chrome
    return os + " · " + (br ? name + " " + v(br[0]) : "navigateur inconnu") + " · " + (installed ? "appli installée" : "dans le navigateur");
  }
  function diagText(){
    if (!diag) return lastReport;
    const w = diagWords(), n = diag.now, pct = v => v == null ? "?" : Math.round(v * 100) + " %";
    const f = n.found || {};
    return [
      "Diagnostic Lumexa Telephone (page version " + PAGE_VERSION + ")",
      new Date().toLocaleString("fr-FR"),
      "Appareil : " + deviceName(),
      "Rôle : " + diag.role,
      "Connexion : " + w.path + (w.pathCode ? " [" + w.pathCode + "]" : ""),
      "État : " + w.state + (n.sound && n.msgIce ? " · messages : " + (ICE_FR[n.msgIce] || n.msgIce) : ""),
      "Mon micro envoyé : " + w.mic + " · " + (n.sentRate == null ? "?" : Math.round(n.sentRate)) + " paquets/s · niveau " + pct(n.micLevel),
      "Son reçu : " + w.recv + " · " + (n.recvRate == null ? "?" : Math.round(n.recvRate)) + " paquets/s · niveau " + pct(n.recvLevel),
      "Relais de voix : " + w.turn,
      "Chemins essayés de mon côté : direct " + ((f.host || 0) + (f.srflx || 0) + (f.prflx || 0)) + " (local " + (f.host || 0) + ", internet " + ((f.srflx || 0) + (f.prflx || 0)) + "), relais " + (f.relay || 0),
      "Journal :",
    ].concat(diag.log.map(l => "  " + l)).join("\n");
  }
  function diagEnd(text){
    if (!diag) return;
    diagLog("Fin : " + (text || "appel arrêté"));
    lastReport = diagText();
    clearInterval(diag.timer);
    diag = null;
    $("lastDiagBtn").hidden = false;
  }
  // Le bouton « Diagnostic » et le panneau, seulement sur les écrans « Ça sonne » (2) et « En appel » (4)
  function diagShow(n){
    const onCall = n === 2 || n === 4;
    $("diagBtn").hidden = !onCall || diagOpen;
    $("diag").hidden = !onCall || !diagOpen;
    diagPaint();
  }
  function setDiagOpen(on){
    diagOpen = on;
    try { localStorage.setItem("diagOuvert", on ? "1" : "0"); } catch(e){}
    diagShow($("s2").hidden ? ($("s4").hidden ? 0 : 4) : 2);
  }
  $("diagBtn").addEventListener("click", () => setDiagOpen(true));
  $("diagClose").addEventListener("click", () => setDiagOpen(false));
  // Copier : le presse-papiers moderne, sinon l'ancienne méthode, sinon on affiche le texte à copier à la main
  async function copyReport(btn, text, area){
    const label = btn.querySelector("span"), was = label.textContent;
    let ok = false;
    try { await navigator.clipboard.writeText(text); ok = true; }
    catch(e){
      const t = document.createElement("textarea");
      t.value = text; t.readOnly = true; t.style.position = "fixed"; t.style.opacity = "0";
      document.body.appendChild(t); t.select(); t.setSelectionRange(0, text.length);
      try { ok = document.execCommand("copy"); } catch(e2){}
      t.remove();
    }
    if (!ok){ $(area).value = text; $(area).hidden = false; $(area).select(); }
    label.textContent = ok ? "Copié ✓ (colle-le dans un message)" : "Copie impossible : sélectionne le texte ci-dessous";
    btn.classList.toggle("ok", ok);
    setTimeout(() => { label.textContent = was; btn.classList.remove("ok"); }, 2500);
  }
  $("diagCopy").addEventListener("click", () => copyReport($("diagCopy"), diagText(), "diagText"));
  $("lastDiagBtn").addEventListener("click", () => copyReport($("lastDiagBtn"), lastReport, "lastDiagText"));

  go(1);
  startPeer();

  // Mission 10 : sur iPhone / iPad, tant que la page n'est pas installée, une aide courte pour l'ajouter à l'écran d'accueil.
  // (Les iPad récents se présentent comme un Mac : on les reconnaît à l'écran tactile.)
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const installed = navigator.standalone === true
    || matchMedia("(display-mode: standalone), (display-mode: fullscreen), (display-mode: minimal-ui)").matches;
  let helpSeen = false;
  try { helpSeen = localStorage.getItem("aideIphoneVue") === "1"; } catch(e){}
  if (ios && !installed && !helpSeen){
    const notSafari = /CriOS|FxiOS|EdgiOS|OPiOS/.test(navigator.userAgent);   // Chrome, Firefox, Edge, Opera sur iPhone
    $("iosText").innerHTML = notSafari
      ? "Pour installer le téléphone, ouvre cette page dans <b>Safari</b>, puis <b>Partager → Sur l'écran d'accueil</b>."
      : "Pour installer le téléphone : <b>Safari → Partager → Sur l'écran d'accueil</b>. Ensuite, ouvre toujours l'icône (elle aura son propre numéro).";
    $("iosHelp").hidden = false;
  }
  $("iosOk").addEventListener("click", () => {
    $("iosHelp").hidden = true;
    try { localStorage.setItem("aideIphoneVue", "1"); } catch(e){}
  });

  // ---------- Mission 16 : installer l'appli sur Android, dans tous les navigateurs ----------
  // Sur Android, l'appli installée garde le tiroir (localStorage) du navigateur qui l'a installée : même numéro.
  // Mais chaque navigateur a son propre tiroir : changer de navigateur = un autre numéro.
  const android = /Android/.test(navigator.userAgent);
  function androidBrowser(){
    const u = navigator.userAgent;
    if (/; wv\)/.test(u)) return "webview";             // page ouverte à l'intérieur d'une autre appli (Facebook, Gmail…)
    if (navigator.brave) return "brave";                 // Brave porte l'étiquette de Chrome, mais a ce signe en plus
    if (/SamsungBrowser\//.test(u)) return "samsung";
    if (/EdgA\//.test(u)) return "edge";
    if (/OPR\//.test(u)) return "opera";
    if (/Firefox\//.test(u)) return "firefox";
    if (/Chrome\//.test(u) && !/(Vivaldi|DuckDuckGo|YaBrowser|MiuiBrowser|HeyTapBrowser|UCBrowser)\//.test(u)) return "chrome";
    return "autre";
  }
  // Le bon menu et les bons mots, navigateur par navigateur (les menus bougent selon les versions :
  // on donne les deux noms qu'on rencontre, puis une phrase de secours qui marche partout)
  const INSTALL_HELP = {
    chrome:  "Pour installer : menu <b>⋮</b> en haut à droite → <b>« Ajouter à l'écran d'accueil »</b> (ou « Installer l'appli ») → <b>« Installer »</b>.",
    samsung: "Pour installer : menu <b>≡</b> en bas à droite → <b>« Ajouter la page à »</b> → <b>« Écran d'accueil »</b> (ou l'icône <b>⬇</b> dans la barre d'adresse).",
    edge:    "Pour installer : menu <b>≡</b> (ou <b>…</b>) en bas de l'écran → <b>« Ajouter au téléphone »</b> (ou « Ajouter à l'écran d'accueil », parfois en glissant le menu).",
    firefox: "Pour installer : menu <b>⋮</b> (en haut ou en bas à droite) → <b>« Ajouter à l'écran d'accueil »</b> (parfois rangé dans <b>« Plus »</b>) → <b>« Ajouter »</b>.",
    opera:   "Pour installer : menu <b>⋮</b> en bas à droite → <b>« Ajouter à »</b> → <b>« Écran d'accueil »</b> → <b>« Ajouter »</b>.",
    brave:   "Pour installer : menu <b>⋮</b> (en bas ou en haut à droite) → <b>« Installer l'appli »</b> (ou « Ajouter à l'écran d'accueil ») → <b>« Installer »</b>.",
    webview: "Cette page est ouverte dans une autre appli. Touche le menu <b>⋮</b> → <b>« Ouvrir dans le navigateur »</b> (ou « Ouvrir dans Chrome »), puis installe depuis là.",
    autre:   "Pour installer : ouvre le menu du navigateur (souvent <b>⋮</b> ou <b>≡</b>) → <b>« Installer »</b> ou <b>« Ajouter à l'écran d'accueil »</b>."
  };
  const INSTALL_ANY = " Sinon, cherche « Installer » ou « écran d'accueil » dans le menu.";
  let installPrompt = null;      // la fenêtre d'installation que le navigateur nous prête (Chrome, Edge, Samsung, Opera, Brave)
  let justInstalled = false;     // installée à l'instant depuis cette page
  let installedElsewhere = false; // déjà installée sur ce téléphone, mais on est dans le navigateur
  function renderInstall(){
    $("installHelp").hidden = !android || installed;   // rien sur iPhone, PC, ni dans l'appli installée
    if (!android || installed) return;
    const br = androidBrowser();
    let text;
    if (justInstalled) text = "C'est installé ! Ferme cette page et ouvre l'icône <b>Lumexa Telephone</b> sur ton écran d'accueil (tu gardes ton numéro).";
    else if (installedElsewhere) text = "L'appli est déjà installée sur ce téléphone : ouvre plutôt l'icône <b>Lumexa Telephone</b> sur ton écran d'accueil.";
    else if (installPrompt) text = "Installe le téléphone : il s'ouvrira comme une vraie appli, plus simple pour décrocher.";
    else text = INSTALL_HELP[br] + (br === "webview" ? "" : INSTALL_ANY);
    $("installText").innerHTML = text;   // nos propres phrases seulement
    $("installBtn").hidden = !installPrompt || justInstalled || installedElsewhere;
  }
  // Le navigateur dit « je sais installer cette page » : on garde sa fenêtre pour notre bouton
  window.addEventListener("beforeinstallprompt", e => {
    e.preventDefault();          // pas le petit bandeau du navigateur : notre bouton à la place
    installPrompt = e;
    renderInstall();
  });
  window.addEventListener("appinstalled", () => { justInstalled = true; installPrompt = null; renderInstall(); });
  $("installBtn").addEventListener("click", async () => {
    const p = installPrompt;
    if (!p) return;
    installPrompt = null;        // une fenêtre ne sert qu'une fois
    try {
      p.prompt();
      const choice = await p.userChoice;
      if (choice && choice.outcome === "accepted") justInstalled = true;
    } catch(e){}
    renderInstall();             // refusé : on montre l'aide par le menu
  });
  // Chrome sait dire si l'appli est déjà installée sur ce téléphone (grâce à « related_applications » dans la carte d'identité)
  if (android && !installed && navigator.getInstalledRelatedApps){
    navigator.getInstalledRelatedApps().then(apps => {
      if (apps && apps.length){ installedElsewhere = true; renderInstall(); }
    }).catch(() => {});
  }
  renderInstall();

  // Mission 10 : le « veilleur » (sw.js). « updateViaCache: none » = le navigateur vérifie toujours s'il y a un nouveau veilleur.
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js", { updateViaCache: "none" }).catch(() => {});

  // Mission 13 (correctif) : une page restée en mémoire (surtout sur iPhone, quand on quitte l'appli sans la fermer)
  // garde son ancienne version. À chaque retour sur la page, on regarde l'« étiquette » des fichiers chez GitHub
  // (sans les télécharger) ; si elle a changé, la page se recharge toute seule, seulement quand elle est libre.
  // On attend 3 s après le retour : si on revient en touchant une notification d'appel, l'appel passe d'abord.
  async function versionTag(){
    const tags = await Promise.all(["index.html", "app.js", "style.css"].map(f =>
      fetch(f, { method: "HEAD", cache: "no-store" }).then(r => r.ok ? (r.headers.get("etag") || r.headers.get("last-modified") || "") : "")));
    return tags.join("|");
  }
  let myVersion = "";
  versionTag().then(v => { myVersion = v; }).catch(() => {});
  const isFree = () => state === "idle" && !$("s1").hidden && document.visibilityState === "visible"
    && Date.now() - joinedAt > 20000;   // mission 15 (correctif) : jamais juste après avoir touché une notification d'appel
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible" || !myVersion) return;
    setTimeout(async () => {
      if (!isFree()) return;
      let v = ""; try { v = await versionTag(); } catch(e){ return; }
      if (v && v !== myVersion && isFree()) location.reload();
    }, 3000);
  });

  // ---------- Mission 12 : les notifications ----------
  // Le navigateur fabrique une « adresse de notification » (abonnement) chez Google, Apple, Mozilla ou Microsoft.
  // On la confie au relais avec mon numéro et un jeton secret (la clé de ma boîte aux lettres, tirée une seule fois).
  const RELAIS = "https://telephone-relais.cr2dh48njb.workers.dev";
  const VAPID = "BExhiDchXV3mRcJOz3Vu4Q07e0VBBP-Ed7BUFaq7YSnydN7wjwjx-EOTC9pBTfI2dC9qXfach1e-8hWFhv8iJ1U";   // clé publique, faite pour être visible
  const b64urlToBytes = s => Uint8Array.from(atob(s.replace(/-/g,"+").replace(/_/g,"/") + "===".slice((s.length+3)%4)), ch => ch.charCodeAt(0));
  const bytesToB64url = a => btoa(String.fromCharCode(...new Uint8Array(a))).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");

  function notifState(kind, text){
    $("notifState").textContent = "Notifications : " + text;
    $("notifState").className = "net " + kind;              // on (vert), off (rouge), no (gris), "" (en cours)
    // Pas de bouton quand c'est déjà fait, impossible, ou refusé (il faut d'abord débloquer dans les réglages)
    $("notifBtn").hidden = kind === "on" || kind === "no" || text === "refusées";
  }
  function notifMessage(text, info){
    $("notifMsg").innerHTML = text;   // nos propres phrases seulement (jamais un texte venu d'ailleurs)
    $("notifMsg").hidden = !text;
    $("notifMsg").classList.toggle("info", !!info);
  }
  // Pourquoi les notifications sont impossibles ici (rien = c'est possible)
  function whyNoNotif(){
    if (!window.isSecureContext) return "il faut ouvrir la page avec son adresse en https.";
    if (!saved) return "ce navigateur ne peut pas garder ton inscription (navigation privée ?).";
    const v = navigator.userAgent.match(/OS (\d+)_(\d+)/);
    const iosOld = ios && v && (+v[1] < 16 || (+v[1] === 16 && +v[2] < 4));
    if (iosOld) return "il faut iOS 16.4 ou plus récent (Réglages → Général → Mise à jour logicielle).";
    if (ios && !installed) return "sur iPhone, installe d'abord la page sur l'écran d'accueil, puis ouvre l'icône.";
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window))
      return "ce navigateur ne sait pas les recevoir (trop ancien ?). Essaie Edge, Chrome, Firefox ou Safari à jour.";
    return "";
  }
  // Comment réautoriser, selon l'appareil
  function howToAllow(){
    if (ios) return "Pour les autoriser : <b>Réglages de l'iPhone → Notifications → Lumexa Telephone → Autoriser les notifications</b>.";
    // Mission 16 : sur Android, le bon chemin selon l'appli installée ou le navigateur
    if (android){
      const where = installed ? "Paramètres du téléphone → <b>Applications</b> → <b>Lumexa Telephone</b> → <b>Notifications</b> → activer"
        : androidBrowser() === "samsung" ? "menu <b>≡</b> → <b>Paramètres</b> → <b>Sites et téléchargements</b> → <b>Notifications</b> → autorise cette page"
        : "touche l'icône à gauche de l'adresse (cadenas ou réglages) → <b>Autorisations</b> → <b>Notifications</b> → Autoriser";
      return "Pour les autoriser : " + where + ", puis recharge la page. Toujours bloqué ? Paramètres du téléphone → <b>Applications</b> → "
        + (installed ? "ton navigateur" : "ce navigateur") + " → <b>Notifications</b> → activer.";
    }
    if (/Firefox/.test(navigator.userAgent)) return "Pour les autoriser : clique sur l'icône à gauche de l'adresse, enlève le blocage des <b>Notifications</b>, puis recharge la page.";
    return "Pour les autoriser : clique sur le <b>cadenas</b> à gauche de l'adresse (dans l'appli installée : menu <b>…</b> → Infos de l'appli), mets <b>Notifications</b> sur Autoriser, puis recharge la page.";
  }
  const braveHelp = android   // mission 16 : sur Android, le chemin passe par le menu de Brave
    ? "Brave bloque les notifications au départ. Menu <b>⋮</b> → <b>Paramètres</b> → <b>Confidentialité et sécurité</b> → allume <b>« Utiliser les services Google pour la messagerie push »</b>, ferme complètement Brave, rouvre-le, puis réessaie."
    : "Brave bloque les notifications au départ. Ouvre <b>brave://settings/privacy</b>, allume <b>« Utiliser les services Google pour la messagerie push »</b>, redémarre Brave, puis réessaie. (Ou utilise Edge.)";

  // Mon jeton secret : tiré une seule fois, puis gardé dans le navigateur (comme mon numéro)
  function myToken(){
    let t = localStorage.getItem("jetonNotif");
    if (!/^[\w-]{32}$/.test(t || "")){ t = bytesToB64url(crypto.getRandomValues(new Uint8Array(24))); localStorage.setItem("jetonNotif", t); }
    return t;
  }
  // Parler au relais (réponse { ok, erreur, message }). Sans réponse au bout de 10 s, on abandonne.
  async function relay(door, body){
    const ctrl = new AbortController(), stop = setTimeout(() => ctrl.abort(), 10000);
    try {
      const r = await fetch(RELAIS + door, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: ctrl.signal });
      return await r.json();
    } catch(e){
      return { ok: false, erreur: "injoignable", message: "Le relais ne répond pas. Vérifie ta connexion internet." };
    } finally { clearTimeout(stop); }
  }
  // Le veilleur prêt (10 s maximum)
  function swReady(){
    return Promise.race([navigator.serviceWorker.ready, new Promise((_, no) => setTimeout(() => no(new Error("veilleur")), 10000))]);
  }
  // Mon abonnement : celui qui existe déjà, ou un nouveau (avec la bonne clé publique)
  async function mySubscription(create){
    const reg = await swReady();
    let sub = await reg.pushManager.getSubscription();
    const key = sub && sub.options && sub.options.applicationServerKey;
    if (sub && key && bytesToB64url(key) !== VAPID){ await sub.unsubscribe(); sub = null; }   // vieil abonnement avec une autre clé
    if (!sub && create) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64urlToBytes(VAPID) });
    return sub;
  }
  // Donner l'abonnement au relais (seulement s'il a changé depuis la dernière fois)
  async function sendSubscription(sub, force){
    let last = ""; try { last = localStorage.getItem("notifEnvoyee") || ""; } catch(e){}
    if (!force && last === sub.endpoint) return { ok: true };
    const r = await relay("/abonner", { code: MY, jeton: myToken(), abonnement: sub.toJSON() });
    if (r.ok) try { localStorage.setItem("notifEnvoyee", sub.endpoint); } catch(e){}
    return r;
  }
  function showRelayError(r, sub){
    notifState("off", "pas activées");
    let host = ""; try { host = new URL(sub.endpoint).hostname; } catch(e){}
    notifMessage(r.erreur === "jeton_different"
      ? "Ce numéro est déjà inscrit aux notifications depuis un autre appareil ou navigateur."
      : r.erreur === "abonnement"   // mission 16 : un navigateur qui passe par un service de notification inconnu du relais
      ? "Ce navigateur passe par un service de notification que le relais ne connaît pas" + (host ? " (" + host + ")" : "") + ". Essaie avec Chrome ou Samsung Internet."
      : (r.message || "Le relais a refusé l'inscription.") + " Réessaie avec le bouton.");
  }

  // Regarder où on en est (à l'ouverture, et à chaque retour sur la page)
  let notifBusy = false;
  async function refreshNotif(){
    if (notifBusy) return;
    const why = whyNoNotif();
    if (why){ notifState("no", "pas possibles ici"); notifMessage("Notifications pas possibles ici : " + why, true); return; }
    if (Notification.permission === "denied"){ notifState("off", "refusées"); notifMessage("Notifications refusées. " + howToAllow()); return; }
    if (Notification.permission !== "granted"){ notifState("", "pas encore activées"); notifMessage(""); return; }
    // Permission déjà donnée : on vérifie en silence que le relais a la bonne adresse
    notifBusy = true;
    try {
      const sub = await mySubscription(true);
      const r = await sendSubscription(sub, false);
      if (r.ok){ notifState("on", "activées"); notifMessage(""); }
      else showRelayError(r, sub);   // (pas d'internet : la page réessaie toute seule au prochain retour)
    } catch(e){
      notifState("", "pas encore activées");
      notifMessage(navigator.brave ? braveHelp : "");
    } finally { notifBusy = false; }
  }

  // Le bouton « Activer les notifications ». La question est posée TOUT DE SUITE, pendant le toucher :
  // l'iPhone refuse de la poser si on attend quoi que ce soit avant.
  $("notifBtn").addEventListener("click", async () => {
    if (notifBusy || whyNoNotif()) return;
    notifBusy = true;
    const asked = Notification.requestPermission();
    notifState("", "activation…"); notifMessage("");
    try {
      const perm = await asked;
      if (perm === "denied"){ notifState("off", "refusées"); notifMessage("Tu as refusé. " + howToAllow()); return; }
      if (perm !== "granted"){
        notifState("", "pas encore activées");
        notifMessage("Tu n'as pas répondu à la question. Si tu ne l'as pas vue, regarde la petite <b>cloche</b> dans la barre d'adresse, puis réessaie.", true);
        return;
      }
      let sub;
      try { sub = await mySubscription(true); }
      catch(e){
        notifState("off", "pas activées");
        notifMessage(navigator.brave ? braveHelp : "Le navigateur n'a pas pu créer ton adresse de notification (" + (e.name || e.message) + "). Vérifie internet et réessaie.");
        return;
      }
      const r = await sendSubscription(sub, true);
      if (r.ok){ notifState("on", "activées"); notifMessage("C'est prêt : tes amis pourront te prévenir, même page fermée.", true); }
      else showRelayError(r, sub);
    } finally { notifBusy = false; }
  });

  refreshNotif();
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") refreshNotif(); });

  // Dans la fiche d'un contact : « Envoyer une notification test »
  function testMessage(text, info){
    $("testMsg").textContent = text;
    $("testMsg").hidden = !text;
    $("testMsg").classList.toggle("info", !!info);
  }
  $("testBtn").addEventListener("click", async () => {
    if (!editing || $("testBtn").disabled) return;
    const c = editing, label = $("testBtn").querySelector("span");
    $("testBtn").disabled = true; label.textContent = "Envoi…"; testMessage("");
    const r = await relay("/notifier", { de: MY, vers: c.code, type: "test" });
    $("testBtn").disabled = false; label.textContent = "Envoyer une notification test";
    if (c !== editing) return;   // on a quitté la fiche pendant l'envoi
    const minutes = s => Math.max(1, Math.ceil(s / 60));
    const texts = {
      pas_abonne:      c.nom + " n'a pas activé les notifications sur ce numéro.",
      rafale:          "Notification déjà envoyée, patiente un peu (" + r.attendre + " s).",
      trop_par_heure:  "Trop de notifications vers " + c.nom + " cette heure-ci. Réessaie dans " + minutes(r.attendre) + " min.",
      abonnement_mort: c.nom + " ne reçoit plus les notifications (page désinstallée ?). Il doit les réactiver.",
    };
    if (r.ok) testMessage("Notification test envoyée à " + c.nom + ".", true);
    else testMessage(texts[r.erreur] || r.message || "L'envoi n'a pas marché.");
  });

  // ---------- Mission 13 : on a touché la notification « Noa t'appelle » ----------
  // Page déjà ouverte : le veilleur la remet devant et lui glisse un petit mot { t: "rejoindre", de }.
  if ("serviceWorker" in navigator){
    navigator.serviceWorker.addEventListener("message", e => {
      const d = e.data || {};
      if (d.t === "rejoindre"){ joinedAt = Date.now(); takePendingJoin(); joinFromNotif(String(d.de)); }
    });
    navigator.serviceWorker.startMessages();
  }
  // Page fermée : le veilleur l'ouvre à l'adresse « …/telephone/?appel=482917 ».
  // On efface « ?appel=… » de l'adresse tout de suite, pour qu'un rechargement ne relance pas l'appel.
  const askedJoin = new URLSearchParams(location.search).get("appel");
  if (askedJoin !== null){
    history.replaceState(null, "", location.pathname);
    joinedAt = Date.now(); takePendingJoin();
    joinFromNotif(askedJoin);
  }

  // Mission 15 (correctif iPhone) : l'appli endormie en arrière-plan peut perdre le petit mot du veilleur
  // (l'iPhone la réveille ou la recharge au même moment). Le veilleur écrit donc aussi « rejoindre 482917 »
  // dans le tiroir IndexedDB, comme un post-it dans la boîte aux lettres : la page le lit (et le jette)
  // à chaque ouverture et à chaque retour. Un post-it de plus de 70 s est trop vieux : on l'ignore.
  function takePendingJoin(){
    return new Promise(ok => {
      try {
        const open = indexedDB.open("telephone", 1);
        open.onupgradeneeded = () => open.result.createObjectStore("tiroir");
        open.onerror = () => ok(null);
        open.onsuccess = () => {
          const db = open.result;
          try {
            const store = db.transaction("tiroir", "readwrite").objectStore("tiroir");
            const get = store.get("rejoindre");
            get.onsuccess = () => {
              const r = get.result;
              if (r) store.delete("rejoindre");
              db.close();
              ok(r && Date.now() - r.at < 70000 ? String(r.de) : null);
            };
            get.onerror = () => { db.close(); ok(null); };
          } catch(e){ db.close(); ok(null); }
        };
      } catch(e){ ok(null); }
    });
  }
  async function checkPendingJoin(){
    const code = await takePendingJoin();
    if (code){ joinedAt = Date.now(); joinFromNotif(code); }
  }
  if (askedJoin === null) checkPendingJoin();
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible") return;
    checkPendingJoin();
    setTimeout(checkPendingJoin, 1500);   // au cas où le veilleur écrit son post-it juste après le réveil
  });

  // Mission 15 : demander le badge du relais de voix dès l'ouverture, et le renouveler au retour sur la page s'il est vieux
  loadTurn();
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") loadTurn(); });
})();
