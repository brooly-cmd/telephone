// Le téléphone : écrans (mission 2), micro (mission 4), numéro perso (mission 5), appels (mission 6), voix (mission 7),
// chrono et sourdine (mission 8), répertoire (mission 9), page installable (mission 10), notifications (mission 12).
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
  // C'est une liste de fiches { nom, code, mail } ; le mail est facultatif (il servira à la mission 11).
  let book = [];
  try { book = JSON.parse(localStorage.getItem("repertoire") || "[]"); } catch(e){ book = []; }
  if (!Array.isArray(book)) book = [];
  book = book.filter(c => c && typeof c.nom === "string" && /^[1-9]\d{5}$/.test(c.code));
  function saveBook(){
    try { localStorage.setItem("repertoire", JSON.stringify(book)); return true; } catch(e){ return false; }
  }
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

  // Passer d'un écran à l'autre (1 Accueil, 2 Ça sonne, 3 Entrant, 4 En cours, 5 Répertoire, 6 Fiche contact)
  function go(n){
    for (let i=1;i<=6;i++) $("s"+i).hidden = i !== n;
    // Mission 9 : le nom de l'ami s'il est dans le répertoire, sinon son numéro
    const name = nameOf(friend);
    ["outCode","inCode","liveCode"].forEach(id => { $(id).textContent = name || fmt(friend); $(id).classList.toggle("name", !!name); });
    ["outAvatar","inAvatar","liveAvatar"].forEach(id => paintAvatar($(id), friend));
    if (n !== 4) stopChrono();
    else if (!startAt){ $("timer").textContent = "00:00"; $("timer").classList.add("wait"); }
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
  go(1);

  // ---------- Mission 9 : l'écran Répertoire et la fiche d'un contact ----------
  let editing = null;   // le contact qu'on modifie (null = on en ajoute un nouveau)
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
      if (c.mail){ const ml = document.createElement("span"); ml.className = "mail"; ml.textContent = c.mail; info.appendChild(ml); }
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
  // Ouvre la fiche : vide pour un nouveau contact, remplie pour en modifier un
  function openForm(c){
    editing = c || null;
    $("formTitle").textContent = c ? "Modifier le contact" : "Nouveau contact";
    $("fName").value = c ? c.nom : "";
    $("fCode").value = c ? fmt(c.code) : "";
    $("fMail").value = c ? (c.mail || "") : "";
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
  $("formBack").addEventListener("click", openBook);
  // Enregistrer : on vérifie chaque case, et on explique ce qui ne va pas
  $("contactForm").addEventListener("submit", e => {
    e.preventDefault();
    const nom = $("fName").value.trim().replace(/\s+/g, " ");
    const code = $("fCode").value.replace(/\D/g, "");   // « 482 917 » devient 482917
    const mail = $("fMail").value.trim();
    if (!nom) return formMessage("Écris un nom pour ce contact.");
    if (code.length !== 6) return formMessage("Le code doit avoir 6 chiffres (j'en ai trouvé " + code.length + ").");
    if (code[0] === "0") return formMessage("Un code ne commence jamais par 0. Vérifie le numéro de ton ami.");
    if (code === MY) return formMessage("C'est ton propre numéro ! Mets le code d'un ami.");
    const twin = book.find(c => c.code === code && c !== editing);
    if (twin) return formMessage("Ce code est déjà enregistré pour " + twin.nom + ".");
    if (mail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) return formMessage("Ce mail n'a pas l'air complet (exemple : noa@mail.fr). Tu peux aussi laisser la case vide.");
    const before = book;
    book = book.filter(c => c !== editing).concat({ nom, code, mail });
    if (!saveBook()){
      book = before;
      return formMessage("Ce navigateur ne peut pas garder ton répertoire (navigation privée ?). Le contact n'est pas enregistré.");
    }
    openBook();
    bookMessage((editing ? "Contact modifié : " : "Contact ajouté : ") + nom + ".");
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

  function callMessage(text, info){
    $("callMsg").textContent = text;
    $("callMsg").hidden = !text;
    $("callMsg").classList.toggle("info", !!info);
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
      callMessage("Le standardiste n'a pas pu être chargé. Vérifie ta connexion internet, puis recharge la page.");
      return;
    }
    if (peer) peer.destroy();
    setNet("wait");
    const p = peer = new Peer(PREFIX + MY);
    p.on("open", () => {
      if (p !== peer) return;
      setNet("on");
      if (state === "idle") callMessage("");
    });
    p.on("connection", c => { if (p === peer) incoming(c); });
    p.on("call", mc => { if (p === peer) incomingMedia(mc); else mc.close(); });
    p.on("disconnected", () => { if (p === peer && !p.destroyed){ setNet("wait"); retryLater(); } });
    p.on("error", e => onPeerError(p, e));
    // Si le standardiste ne répond rien du tout au bout de 10 secondes, on le dit
    setTimeout(() => {
      if (p === peer && !p.open && !p.destroyed && state === "idle"){
        setNet("off");
        callMessage("Le standardiste ne répond pas. Vérifie ta connexion internet ; la page réessaie toute seule.");
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
    if (e.type === "peer-unavailable"){   // l'ami n'a pas la page ouverte
      if (state === "calling") endCall(Who(friend) + " n'est pas connecté pour le moment (sa page est fermée).");
      return;
    }
    setNet("off");
    if (e.type === "unavailable-id"){
      callMessage("Ton numéro est déjà utilisé : la page est sans doute ouverte dans un autre onglet ou une autre fenêtre. Ferme-la ; celle-ci réessaie toute seule.");
      retryLater();
    } else if (e.type === "browser-incompatible"){
      callMessage("Ce navigateur ne sait pas passer d'appels. Essaie avec Chrome, Edge, Firefox ou Safari à jour.");
    } else {   // network, server-error, socket-error… : la ligne avec le standardiste est coupée
      if (state === "idle") callMessage("Le standardiste ne répond pas. Vérifie ta connexion internet ; la page réessaie toute seule.");
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
  window.addEventListener("pagehide", () => {
    if (state === "calling") send({ t: "annule" });
    else if (state === "ringing") send({ t: "refuse" });
    else if (state === "live") send({ t: "raccroche" });
    stopVoice();
    if (peer) peer.destroy();
  });

  // Envoyer un petit message à l'ami (attend que le fil soit prêt si besoin)
  function send(msg){
    if (!conn) return;
    if (conn.open) conn.send(msg);
    else { const c = conn; c.on("open", () => c.send(msg)); }
  }
  // Brancher les « oreilles » sur le fil avec l'ami
  function wire(c){
    c.on("data", d => { if (c === conn) onData(d); });
    c.on("close", () => { if (c === conn) lineCut(); });
    c.on("error", () => { if (c === conn) lineCut(); });
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
    mc.on("close", () => { if (mc === media && state === "live") endCall("L'appel a été coupé."); });
    mc.on("error", () => { if (mc === media && state === "live") endCall("Le son n'a pas pu passer. Réessaie."); });
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

  // J'appelle un code
  async function startCall(code){
    if (state !== "idle" || !/^\d{6}$/.test(code)) return;
    if (code === MY){ callMessage("C'est ton propre numéro ! Tape le code d'un ami."); return; }
    if (!peer || !peer.open){ callMessage("Pas encore connecté au standardiste. Attends que « En ligne » s'affiche en haut, puis réessaie."); return; }
    callMessage("");
    friend = code; typed = ""; renderDisplay();
    stopMic();             // si le test du micro tournait, on l'arrête
    state = "calling";
    go(2);
    // Mission 7 : j'allume mon micro avant de faire sonner l'ami, pour que la voix passe dès qu'il décroche
    const attempt = callId;
    $("outStatus").textContent = "Micro…";
    $("outHint").textContent = "Autorise le micro pour que ton ami t'entende.";
    let s;
    try { s = await openCallMic(); }
    catch(e){ if (attempt === callId) endCall(micError(e)); return; }
    if (attempt !== callId){ s.getTracks().forEach(t => t.stop()); return; }   // appel annulé pendant la question du micro
    callStream = s;
    $("outStatus").textContent = "Ça sonne…"; $("outHint").textContent = "";
    if (!peer || !peer.open){ endCall("La ligne avec le standardiste vient de se couper. Attends « En ligne », puis réessaie."); return; }
    conn = peer.connect(PREFIX + code, { reliable: true });
    wire(conn);
    send({ t: "appel" });
    // Personne ne décroche en 1 minute : on arrête
    ringTimer = setTimeout(() => { send({ t: "annule" }); endCall("Pas de réponse au bout d'1 minute."); }, 60000);
  }

  // Quelqu'un m'appelle
  function incoming(c){
    const from = c.peer.startsWith(PREFIX) ? c.peer.slice(PREFIX.length) : "";
    if (!/^\d{6}$/.test(from)){ c.close(); return; }       // pas un numéro de notre appli : on ignore
    if (state !== "idle"){                                    // déjà en ligne : on répond « occupé »
      c.on("open", () => { c.send({ t: "occupe" }); setTimeout(() => c.close(), 1000); });
      return;
    }
    conn = c; wire(c);
    friend = from;
    state = "ringing";
    callMessage("");
    go(3);
    // Sécurité : si l'appelant disparaît sans prévenir, on arrête de sonner
    ringTimer = setTimeout(() => endCall("Appel manqué " + ofWho(from) + "."), 65000);
  }

  // Les petits messages échangés entre les deux pages
  function onData(d){
    if (!d || typeof d.t !== "string") return;
    if (state === "calling" && d.t === "decroche"){ clearTimeout(ringTimer); state = "live"; go(4); }
    else if (state === "calling" && d.t === "refuse") endCall("Appel refusé par " + who(friend) + ".");
    else if (state === "calling" && d.t === "nomicro") endCall(Who(friend) + " a voulu décrocher, mais son micro ne marche pas.");
    else if (state === "calling" && d.t === "occupe") endCall(Who(friend) + " est déjà en ligne avec quelqu'un. Réessaie plus tard.");
    else if (state === "ringing" && d.t === "annule") endCall("Appel manqué " + ofWho(friend) + ".");
    else if (state === "live" && d.t === "raccroche") endCall("Appel terminé.", true);
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
    else if (state === "live") endCall("L'appel a été coupé.");
  }
  // Fin de l'appel, quelle qu'en soit la raison : retour à l'accueil avec un message
  function endCall(text, info){
    clearTimeout(ringTimer);
    callId++;
    // Mission 8 : si on a parlé, on ajoute la durée : « Appel terminé (02:15). »
    if (startAt && text) text = text.replace(/\.$/, "") + " (" + clock() + ").";
    stopVoice();   // mission 7 : le micro s'éteint dès que l'appel se termine, quelle qu'en soit la raison
    const c = conn; conn = null;
    state = "idle";
    if (c) setTimeout(() => c.close(), 500);   // petit délai pour que le dernier message parte bien
    go(1);
    callMessage(text || "", info);
  }

  // Les boutons des écrans d'appel
  $("cancelBtn").addEventListener("click", () => { send({ t: "annule" }); endCall(""); });
  $("refuseBtn").addEventListener("click", () => { send({ t: "refuse" }); endCall(""); });
  // Décrocher : j'allume mon micro (l'appui sur le bouton sert de « clé » sur iPhone), puis je tends le tuyau de son
  $("answerBtn").addEventListener("click", async () => {
    if (state !== "ringing" || $("answerBtn").disabled) return;
    const attempt = callId;
    $("answerBtn").disabled = true;
    stopMic();
    let s;
    try { s = await openCallMic(); }
    catch(e){
      $("answerBtn").disabled = false;
      if (attempt === callId){ send({ t: "nomicro" }); endCall(micError(e)); }
      return;
    }
    $("answerBtn").disabled = false;
    if (attempt !== callId){ s.getTracks().forEach(t => t.stop()); return; }   // l'appelant a abandonné pendant la question du micro
    if (!peer || !peer.open){ s.getTracks().forEach(t => t.stop()); send({ t: "nomicro" }); endCall("La ligne avec le standardiste est coupée. Réessaie dans un instant."); return; }
    clearTimeout(ringTimer);
    callStream = s;
    send({ t: "decroche" }); state = "live"; go(4);
    plugMedia(peer.call(PREFIX + friend, s));
  });
  $("hangBtn").addEventListener("click", () => { send({ t: "raccroche" }); endCall("Appel terminé.", true); });

  startPeer();

  // Mission 10 : sur iPhone / iPad, tant que la page n'est pas installée, une aide courte pour l'ajouter à l'écran d'accueil.
  // (Les iPad récents se présentent comme un Mac : on les reconnaît à l'écran tactile.)
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const installed = navigator.standalone === true || matchMedia("(display-mode: standalone)").matches;
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

  // Mission 10 : le « veilleur » (sw.js). « updateViaCache: none » = le navigateur vérifie toujours s'il y a un nouveau veilleur.
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js", { updateViaCache: "none" }).catch(() => {});

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
    if (/Firefox/.test(navigator.userAgent)) return "Pour les autoriser : clique sur l'icône à gauche de l'adresse, enlève le blocage des <b>Notifications</b>, puis recharge la page.";
    return "Pour les autoriser : clique sur le <b>cadenas</b> à gauche de l'adresse (dans l'appli installée : menu <b>…</b> → Infos de l'appli), mets <b>Notifications</b> sur Autoriser, puis recharge la page.";
  }
  const braveHelp = "Brave bloque les notifications au départ. Ouvre <b>brave://settings/privacy</b>, allume <b>« Utiliser les services Google pour la messagerie push »</b>, redémarre Brave, puis réessaie. (Ou utilise Edge.)";

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
  function showRelayError(r){
    notifState("off", "pas activées");
    notifMessage(r.erreur === "jeton_different"
      ? "Ce numéro est déjà inscrit aux notifications depuis un autre appareil ou navigateur."
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
      else showRelayError(r);   // (pas d'internet : la page réessaie toute seule au prochain retour)
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
      else showRelayError(r);
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
})();
