// Mission 2 : les boutons font seulement passer d'un écran à l'autre (pas encore de vrai appel).
(function(){
  const MY = "482917";             // numéro d'exemple : le vrai code arrivera à la mission 5
  let typed = "";                  // ce qu'on tape sur le clavier
  let friend = "731205";           // code d'exemple pour les écrans d'appel
  let tick = null, seconds = 0;    // pour le chrono
  const $ = id => document.getElementById(id);
  const fmt = c => c.slice(0,3) + " " + c.slice(3);   // "731205" -> "731 205"

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
    b.addEventListener("click", () => {
      if (k==="del") typed = typed.slice(0,-1);
      else if (k && typed.length < 6) typed += k;
      renderDisplay();
    });
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

  // « Appeler » : on retient le code tapé et on passe à l'écran « Ça sonne »
  $("callBtn").addEventListener("click", () => { friend = typed; typed = ""; renderDisplay(); go(2); });

  // Copier mon numéro
  $("copyBtn").addEventListener("click", async () => {
    const btn = $("copyBtn"), txt = btn.querySelector("span");
    try { await navigator.clipboard.writeText(MY); txt.textContent = "Copié ✓"; btn.classList.add("ok"); }
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
      const why = {
        NotAllowedError:  "Micro refusé. Pour l'autoriser : clique sur le cadenas à gauche de l'adresse, mets « Micro » sur Autoriser, puis recharge la page.",
        SecurityError:    "Micro refusé. Pour l'autoriser : clique sur le cadenas à gauche de l'adresse, mets « Micro » sur Autoriser, puis recharge la page.",
        NotFoundError:    "Aucun micro trouvé. Branche un micro ou un casque, puis réessaie.",
        NotReadableError: "Le micro est déjà utilisé par une autre application (Zoom, Discord…). Ferme-la, puis réessaie."
      };
      micMessage(why[e.name] || "Impossible d'ouvrir le micro (" + e.name + "). Réessaie.");
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
    document.querySelectorAll(".tab").forEach(t => t.setAttribute("aria-selected", t.dataset.go == n));
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
  // Chaque bouton qui porte data-go="N" envoie vers l'écran N
  document.querySelectorAll("[data-go]").forEach(b => b.addEventListener("click", () => go(+b.dataset.go)));
  go(1);
})();
