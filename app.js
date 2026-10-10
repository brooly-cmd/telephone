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
