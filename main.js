/* ===== Lingua (IT / EN) ===== */
(() => {
  const root = document.documentElement;
  const buttons = document.querySelectorAll(".lang-toggle button");
  const store = {
    get() { try { return localStorage.getItem("lang"); } catch { return null; } },
    set(v) { try { localStorage.setItem("lang", v); } catch {} },
  };

  function setLang(lang) {
    root.classList.toggle("lang-it", lang === "it");
    root.classList.toggle("lang-en", lang === "en");
    root.lang = lang;
    buttons.forEach(b => b.setAttribute("aria-pressed", String(b.dataset.lang === lang)));
  }

  const saved = store.get();
  const browserIt = (navigator.language || "it").toLowerCase().startsWith("it");
  setLang(saved === "it" || saved === "en" ? saved : (browserIt ? "it" : "en"));
  buttons.forEach(b => b.addEventListener("click", () => { setLang(b.dataset.lang); store.set(b.dataset.lang); }));

  const y = document.getElementById("year");
  if (y) y.textContent = new Date().getFullYear();
})();

/* ===== Reveal on scroll ===== */
(() => {
  const els = document.querySelectorAll(".intro, .section-head, .project, .timeline > li, .module, .cta");
  if (!("IntersectionObserver" in window)) return;
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); } });
  }, { rootMargin: "0px 0px -8% 0px" });
  els.forEach(el => { el.classList.add("reveal"); io.observe(el); });
})();

/* ===== Braccio robot 2 assi con cinematica inversa ===== */
(() => {
  const svg = document.getElementById("arm");
  if (!svg) return;

  const $ = id => document.getElementById(id);
  const link1 = $("link1"), link2 = $("link2"), joint1 = $("joint1"), joint2 = $("joint2"), target = $("target");
  const hud = { j1: $("j1"), j2: $("j2"), tx: $("tx"), ty: $("ty") };

  const BASE = { x: 200, y: 268 };
  const L1 = 130, L2 = 122;            // lunghezze link (fino al TCP)
  const MAX = L1 + L2 - 2, MIN = Math.abs(L1 - L2) + 20;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

  let goal = { x: 270, y: 150 };        // target desiderato
  let tcp = { ...goal };                // posizione corrente (smussata)
  let lastPointer = 0;

  function toSvg(evt) {
    const pt = svg.createSVGPoint();
    pt.x = evt.clientX; pt.y = evt.clientY;
    return pt.matrixTransform(svg.getScreenCTM().inverse());
  }

  function clampReach(p) {
    let dx = p.x - BASE.x, dy = p.y - BASE.y;
    if (dy > 10) dy = 10;               // niente sotto il pavimento
    let d = Math.hypot(dx, dy) || 1;
    const k = Math.min(Math.max(d, MIN), MAX) / d;
    return { x: BASE.x + dx * k, y: BASE.y + dy * k };
  }

  function solve(p) {
    const dx = p.x - BASE.x, dy = p.y - BASE.y;
    const d2 = dx * dx + dy * dy;
    const c2 = Math.min(1, Math.max(-1, (d2 - L1 * L1 - L2 * L2) / (2 * L1 * L2)));
    const q2 = -Math.acos(c2);          // gomito alto
    const q1 = Math.atan2(dy, dx) - Math.atan2(L2 * Math.sin(q2), L1 + L2 * Math.cos(q2));
    return { q1, q2 };
  }

  const deg = r => r * 180 / Math.PI;

  function render() {
    const { q1, q2 } = solve(tcp);
    const ex = BASE.x + L1 * Math.cos(q1), ey = BASE.y + L1 * Math.sin(q1);
    link1.setAttribute("transform", `translate(${BASE.x} ${BASE.y}) rotate(${deg(q1)})`);
    link2.setAttribute("transform", `translate(${ex} ${ey}) rotate(${deg(q1 + q2)})`);
    joint1.setAttribute("cx", BASE.x); joint1.setAttribute("cy", BASE.y);
    joint2.setAttribute("cx", ex); joint2.setAttribute("cy", ey);
    target.setAttribute("transform", `translate(${goal.x} ${goal.y})`);
    hud.j1.textContent = (-deg(q1)).toFixed(1);
    hud.j2.textContent = (-deg(q2)).toFixed(1);
    hud.tx.textContent = Math.round((tcp.x - BASE.x) * 4);   // "mm" fittizi
    hud.ty.textContent = Math.round((BASE.y - tcp.y) * 4);
  }

  // percorso automatico pick & place quando non c'è interazione
  const path = [{ x: 90, y: 230 }, { x: 90, y: 140 }, { x: 230, y: 90 }, { x: 315, y: 150 }, { x: 315, y: 222 }, { x: 315, y: 150 }, { x: 160, y: 110 }, { x: 90, y: 140 }];
  let wp = 0, wpT = 0;

  function onMove(e) { goal = clampReach(toSvg(e)); lastPointer = performance.now(); }
  window.addEventListener("pointermove", onMove, { passive: true });

  function tick(now) {
    if (now - lastPointer > 2500) {     // modalità AUTO
      if (now - wpT > 1100) { wp = (wp + 1) % path.length; wpT = now; }
      goal = path[wp];
    }
    tcp.x += (goal.x - tcp.x) * 0.09;
    tcp.y += (goal.y - tcp.y) * 0.09;
    render();
    requestAnimationFrame(tick);
  }

  if (reduced) {
    // segue comunque il cursore, ma senza animazione automatica né smussatura
    window.addEventListener("pointermove", () => { tcp = { ...goal }; render(); }, { passive: true });
    tcp = clampReach(goal); render();
  } else {
    requestAnimationFrame(tick);
  }
})();
