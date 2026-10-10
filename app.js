// Le téléphone : écrans (mission 2), micro (mission 4), numéro perso (mission 5), appels (mission 6), voix (mission 7).
(function(){
  let typed = "";                  // ce qu'on tape sur le clavier
  let friend = "";                 // le code de l'ami en ligne avec nous (appelé ou appelant)
  let tick = null, seconds = 0;    // pour le chrono
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

  // Un rond coloré + une lettre, calculés à partir du code (toujours les mêmes pour un même ami)
  function paintAvatar(el, code){
    let n = 0; for (const ch of code) n = (n*31 + +ch) % 99991;
    el.style.background = "hsl(" + (n % 360) + " 65% 68%)";
    el.textContent = String.fromCharCode(65 + n % 26);
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

  // Passer d'un écran à l'autre (1 Accueil, 2 Ça sonne, 3 Entrant, 4 En cours)
  function go(n){
    for (let i=1;i<=4;i++) $("s"+i).hidden = i !== n;
    ["outCode","inCode","liveCode"].forEach(id => $(id).textContent = fmt(friend));
    ["outAvatar","inAvatar","liveAvatar"].forEach(id => paintAvatar($(id), friend));
    clearInterval(tick);
    if (n === 4){
      seconds = 0; $("timer").textContent = "00:00";
      tick = setInterval(() => {
        seconds++;
        const m = String(Math.floor(seconds/60)).padStart(2,"0"), s = String(seconds%60).padStart(2,"0");
        $("timer").textContent = m + ":" + s;
      }, 1000);
    }
  }
  go(1);

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
      if (state === "calling") endCall("Le " + fmt(friend) + " n'est pas connecté pour le moment (sa page est fermée).");
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
  function soundState(text){ $("soundState").textContent = text; }
  // Brancher le tuyau de son : quand la voix de l'ami arrive, on la joue dans le haut-parleur caché
  function plugMedia(mc){
    media = mc;
    soundState("Connexion du son…");
    mc.on("stream", remote => {
      if (mc !== media) return;
      if ($("voice").srcObject !== remote) $("voice").srcObject = remote;
      playVoice();
    });
    mc.on("close", () => { if (mc === media && state === "live") endCall("L'appel a été coupé."); });
    mc.on("error", () => { if (mc === media && state === "live") endCall("Le son n'a pas pu passer. Réessaie."); });
  }
  // Certains téléphones bloquent le son tant qu'on n'a pas touché l'écran : on affiche alors un bouton
  function playVoice(){
    $("voice").play().then(() => {
      if (!media) return;
      soundState("Son connecté"); $("soundBtn").hidden = true;
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
    soundState("Connexion du son…");
  }
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
    ringTimer = setTimeout(() => endCall("Appel manqué du " + fmt(from) + "."), 65000);
  }

  // Les petits messages échangés entre les deux pages
  function onData(d){
    if (!d || typeof d.t !== "string") return;
    if (state === "calling" && d.t === "decroche"){ clearTimeout(ringTimer); state = "live"; go(4); }
    else if (state === "calling" && d.t === "refuse") endCall("Appel refusé par le " + fmt(friend) + ".");
    else if (state === "calling" && d.t === "nomicro") endCall("Le " + fmt(friend) + " a voulu décrocher, mais son micro ne marche pas.");
    else if (state === "calling" && d.t === "occupe") endCall("Le " + fmt(friend) + " est déjà en ligne avec quelqu'un. Réessaie plus tard.");
    else if (state === "ringing" && d.t === "annule") endCall("Appel manqué du " + fmt(friend) + ".");
    else if (state === "live" && d.t === "raccroche") endCall("Appel terminé.", true);
  }
  // Le fil avec l'ami s'est coupé sans message
  function lineCut(){
    if (state === "calling") endCall("La communication a été coupée.");
    else if (state === "ringing") endCall("Appel manqué du " + fmt(friend) + ".");
    else if (state === "live") endCall("L'appel a été coupé.");
  }
  // Fin de l'appel, quelle qu'en soit la raison : retour à l'accueil avec un message
  function endCall(text, info){
    clearTimeout(ringTimer);
    callId++;
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
})();
