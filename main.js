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

/* ===== Scroll fluido (Lenis) + movimenti legati allo scroll ===== */
(() => {
  const root = document.documentElement;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  if (reduced) {
    root.classList.add("no-drift", "no-js-marquee");
    return;
  }

  let lenis = null;
  if (window.Lenis) {
    lenis = new window.Lenis({ lerp: 0.09, smoothWheel: true, wheelMultiplier: 1 });
    document.querySelectorAll('a[href^="#"]').forEach(a => {
      a.addEventListener("click", e => {
        const id = a.getAttribute("href");
        const target = id === "#" ? null : document.querySelector(id);
        if (!target) return;
        e.preventDefault();
        lenis.scrollTo(target, { duration: 1.4 });
        if (id === "#main") target.focus?.({ preventScroll: true });
      });
    });
  }

  const hero = document.querySelector(".hero");
  const headline = document.querySelector(".headline");
  const byline = document.querySelector(".byline");
  const stage = document.getElementById("stage");
  const titles = [...document.querySelectorAll(".section-title")];
  const marquees = [...document.querySelectorAll(".marquee-track")].map((el, i) => ({ el, x: 0, base: i === 0 ? 26 : 32 }));

  let lastY = window.scrollY, vel = 0, lastT = performance.now();

  function update(now) {
    const dt = Math.min(0.05, (now - lastT) / 1000);
    lastT = now;
    const sy = window.scrollY, vh = window.innerHeight;
    const v = lenis ? lenis.velocity : (sy - lastY) / Math.max(dt, 1e-3) / 60;
    const dy = sy - lastY;
    lastY = sy;
    vel += (v - vel) * 0.12;

    /* menu agli angoli: via mentre scendi, torna appena risali o sei in cima */
    if (sy < vh * 0.5 || dy < -1.5) root.classList.remove("nav-away");
    else if (dy > 1.5) root.classList.add("nav-away");

    /* hero: il titolo sale più lento e si rimpicciolisce, il cobot in parallasse */
    if (sy < vh * 1.3) {
      const p = clamp(sy / vh, 0, 1);
      headline.style.transform = `translate3d(0, ${p * vh * 0.28}px, 0) scale(${1 - p * 0.12})`;
      if (byline) byline.style.transform = `translate3d(0, ${p * vh * 0.22}px, 0)`;
      stage.style.transform = `translate3d(0, ${p * vh * 0.12}px, 0)`;
    }

    /* titoli di sezione: leggero scorrimento laterale */
    for (const t of titles) {
      const rect = t.getBoundingClientRect();
      if (rect.bottom < 0 || rect.top > vh) continue;
      const p = clamp((vh - rect.top) / (vh + rect.height), 0, 1);
      t.style.transform = `translate3d(${(0.5 - p) * Math.min(80, window.innerWidth * 0.05)}px, 0, 0)`;
    }

    /* strisce scorrevoli: accelerano con la velocità di scroll */
    for (const m of marquees) {
      const half = m.el.scrollWidth / 2;
      if (!half) continue;
      m.x -= (m.base + Math.min(24, Math.abs(vel) * 12)) * dt;
      if (m.x <= -half) m.x += half;
      m.el.style.transform = `translate3d(${m.x}px, 0, 0)`;
    }
  }

  function raf(t) {
    if (lenis) lenis.raf(t);
    update(t);
    requestAnimationFrame(raf);
  }
  requestAnimationFrame(raf);
})();

/* ===== GIF tra parentesi che si alternano (come Kenji) ===== */
(() => {
  const slots = [...document.querySelectorAll(".slot[data-set]")];
  const names = [...new Set(slots.flatMap(s => s.dataset.set.split(" ")))];
  names.forEach(n => { const i = new Image(); i.src = `assets/gif/${n}.gif`; });   // precarico: niente vuoti al cambio
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  slots.forEach((slot, i) => {
    const set = slot.dataset.set.split(" ");
    const img = slot.querySelector("img");
    let k = 0;
    setTimeout(() => setInterval(() => {
      if (document.hidden) return;
      k = (k + 1) % set.length;
      slot.classList.add("is-out");
      setTimeout(() => { img.src = `assets/gif/${set[k]}.gif`; slot.classList.remove("is-out"); }, 200);
    }, 2400), 900 + (i % 2) * 1200);
  });
})();

/* ===== Cursore personalizzato ===== */
(() => {
  const dot = document.querySelector(".cursor");
  if (!dot || !matchMedia("(hover: hover) and (pointer: fine)").matches) return;
  document.documentElement.classList.add("has-cursor");
  // il pallino segue il mouse senza ritardo: posizione aggiornata a ogni evento
  window.addEventListener("pointermove", e => {
    dot.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0)`;
    dot.classList.add("is-on");
    dot.classList.toggle("is-link", !!e.target.closest("a, button"));
  }, { passive: true });
  document.addEventListener("pointerleave", () => dot.classList.remove("is-on"));
})();

/* ===== Ingresso del titolo parola per parola (solo al caricamento) ===== */
(() => {
  const h = document.querySelector(".headline");
  if (!h) return;
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) { h.classList.add("is-split"); return; }
  for (const block of h.querySelectorAll(":scope > .l-it, :scope > .l-en")) {
    let i = 0;
    for (const ln of block.querySelectorAll(".ln")) {
      for (const node of [...ln.childNodes]) {
        if (node.nodeType === 3) {
          const parts = node.textContent.split(/(\s+)/);
          const frag = document.createDocumentFragment();
          for (const part of parts) {
            if (!part) continue;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); continue; }
            const w = document.createElement("span");
            w.className = "hw"; w.textContent = part;
            w.style.animationDelay = `${i++ * 65}ms`;
            frag.appendChild(w);
          }
          ln.replaceChild(frag, node);
        } else if (node.nodeType === 1) {
          node.classList.add("hw");
          node.style.animationDelay = `${i++ * 65}ms`;
        }
      }
    }
  }
  h.classList.add("is-split");
})();

/* ===== Badge da fiera appeso, trascinabile (fisica a corda, Verlet) ===== */
(() => {
  const stage = document.getElementById("badge-stage");
  const card = document.getElementById("badge");
  const svg = document.getElementById("lanyard");
  if (!stage || !card || !svg) return;
  const strap = svg.querySelector(".lanyard-strap"), stitch = svg.querySelector(".lanyard-stitch");
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

  const SEG = 17, N = 10;                 // corda: N segmenti
  const CW = card.offsetWidth, CH = card.offsetHeight;
  let W = stage.clientWidth;
  const pts = [];
  const anchor = () => ({ x: W / 2, y: -6 });
  function reset() {
    W = stage.clientWidth;
    const a = anchor();
    pts.length = 0;
    for (let i = 0; i <= N; i++) pts.push({ x: a.x, y: a.y + i * SEG, px: a.x, py: a.y + i * SEG });
    const top = pts[N];
    pts.push({ x: top.x, y: top.y + CH, px: top.x, py: top.y + CH });   // fondo del badge
  }
  reset();

  let drag = null;
  card.addEventListener("pointerdown", e => {
    const r = stage.getBoundingClientRect();
    drag = { id: e.pointerId, x: e.clientX - r.left, y: e.clientY - r.top };
    card.setPointerCapture(e.pointerId);
    running = true;
  });
  card.addEventListener("pointermove", e => {
    if (!drag || e.pointerId !== drag.id) return;
    const r = stage.getBoundingClientRect();
    drag.x = e.clientX - r.left; drag.y = e.clientY - r.top;
  });
  const end = e => { if (drag && e.pointerId === drag.id) drag = null; };
  card.addEventListener("pointerup", end);
  card.addEventListener("pointercancel", end);

  function step(dt) {
    const g = 2200 * dt * dt;
    for (let i = 1; i < pts.length; i++) {
      const p = pts[i];
      const vx = (p.x - p.px) * 0.985, vy = (p.y - p.py) * 0.985;
      p.px = p.x; p.py = p.y;
      p.x += vx; p.y += vy + g;
    }
    const a = anchor();
    for (let k = 0; k < 24; k++) {
      pts[0].x = a.x; pts[0].y = a.y;
      for (let i = 0; i < pts.length - 1; i++) {
        const p = pts[i], q = pts[i + 1];
        const len = i === pts.length - 2 ? CH : SEG;
        const dx = q.x - p.x, dy = q.y - p.y, d = Math.hypot(dx, dy) || 1e-6;
        const diff = (d - len) / d;
        if (i === 0) { q.x -= dx * diff; q.y -= dy * diff; }
        else { p.x += dx * diff * 0.5; p.y += dy * diff * 0.5; q.x -= dx * diff * 0.5; q.y -= dy * diff * 0.5; }
      }
      if (drag) {                                   // il centro del badge segue il dito/mouse
        const t = pts[N], b = pts[N + 1];
        const mx = (t.x + b.x) / 2, my = (t.y + b.y) / 2;
        const ox = drag.x - mx, oy = drag.y - my;
        t.x += ox; t.y += oy; b.x += ox; b.y += oy;
      }
    }
  }

  function draw() {
    const t = pts[N], b = pts[N + 1];
    let d = `M${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
    for (let i = 1; i <= N; i++) d += ` L${pts[i].x.toFixed(1)} ${pts[i].y.toFixed(1)}`;
    strap.setAttribute("d", d);
    stitch.setAttribute("d", d);
    const ang = Math.atan2(b.x - t.x, b.y - t.y);
    const cx = (t.x + b.x) / 2, cy = (t.y + b.y) / 2;
    card.style.transform = `translate3d(${cx - CW / 2}px, ${cy - CH / 2}px, 0) rotate(${-ang}rad)`;
  }

  let running = false, last = 0, visible = false;
  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    if (visible && !reduced) {                       // piccola spinta quando entra in vista
      const b = pts[N + 1]; b.px -= 9; running = true;
    }
  }).observe(stage);
  new ResizeObserver(() => { if (Math.abs(stage.clientWidth - W) > 2) { reset(); draw(); } }).observe(stage);

  draw();
  if (reduced) return;
  function loop(now) {
    requestAnimationFrame(loop);
    const dt = Math.min(1 / 30, (now - last) / 1000 || 1 / 60);
    last = now;
    if (!visible || !running) return;
    step(dt);
    draw();
    // a riposo, ferma la simulazione
    const b = pts[N + 1];
    if (!drag && Math.abs(b.x - b.px) + Math.abs(b.y - b.py) < 0.02) running = false;
  }
  requestAnimationFrame(loop);
})();

/* ===== Strisce di immagini e video: loop continuo, pausa al passaggio, trascinabili ===== */
(() => {
  const strips = [...document.querySelectorAll(".shots")];
  if (!strips.length) return;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const fine = matchMedia("(hover: hover) and (pointer: fine)").matches;
  const SPEED = 16;                                         // px al secondo, lento
  const states = strips.map(strip => {
    const track = document.createElement("div");
    track.className = "shots-track";
    while (strip.firstChild) track.appendChild(strip.firstChild);
    strip.appendChild(track);
    const loop = !strip.querySelector("video");             // i video non si clonano: troppi lettori bloccano i telefoni
    return { strip, track, loop, items: [...track.children], x: 0, copyW: 0, maxX: 0, visible: false, hover: false, drag: null, moved: 0 };
  });
  if (reduced) { strips.forEach(s => s.classList.add("is-static")); return; }

  function setup(st) {
    st.track.querySelectorAll("[data-clone]").forEach(c => c.remove());
    if (!st.loop) { st.maxX = Math.max(0, st.track.scrollWidth - st.strip.clientWidth); st.copyW = 1; return; }
    const first = st.items[0];
    if (!first) return;
    const gap = parseFloat(getComputedStyle(st.track).columnGap) || 12;
    const copyW = st.items.reduce((w, it) => w + it.getBoundingClientRect().width + gap, 0);
    if (!copyW) return;
    const copies = Math.max(1, Math.ceil((st.strip.clientWidth + copyW) / copyW));
    for (let c = 0; c < copies; c++) st.items.forEach(it => {
      const k = it.cloneNode(true);
      k.setAttribute("data-clone", ""); k.setAttribute("aria-hidden", "true");
      k.querySelectorAll("a").forEach(a => (a.tabIndex = -1));
      st.track.appendChild(k);
    });
    st.copyW = copyW;
  }
  const setupAll = () => states.forEach(setup);
  setupAll();
  window.addEventListener("load", setupAll);
  let rt; window.addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(setupAll, 200); });

  const io = new IntersectionObserver(es => es.forEach(e => {
    const st = states.find(s => s.strip === e.target); if (st) st.visible = e.isIntersecting;
  }), { rootMargin: "100px 0px" });
  states.forEach(st => {
    io.observe(st.strip);
    const s = st.strip;
    if (fine) { s.addEventListener("pointerenter", () => (st.hover = true)); s.addEventListener("pointerleave", () => (st.hover = false)); }
    s.addEventListener("pointerdown", e => {
      st.drag = { id: e.pointerId, sx: e.clientX, x0: st.x }; st.moved = 0;
      try { s.setPointerCapture(e.pointerId); } catch (_) {} s.classList.add("is-dragging");
    });
    s.addEventListener("pointermove", e => {
      if (!st.drag || e.pointerId !== st.drag.id) return;
      const dx = e.clientX - st.drag.sx; st.moved = Math.max(st.moved, Math.abs(dx));
      st.x = st.drag.x0 + dx;
    });
    const end = () => { st.drag = null; s.classList.remove("is-dragging"); };
    s.addEventListener("pointerup", end); s.addEventListener("pointercancel", end);
    s.addEventListener("click", e => { if (st.moved > 6) { e.preventDefault(); e.stopPropagation(); } }, true);  // trascinare non apre le foto
  });

  let last = performance.now();
  (function loop(now) {
    requestAnimationFrame(loop);
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    for (const st of states) {
      if (!st.visible || !st.copyW) continue;
      if (!st.loop) {                                       // striscia ferma: solo trascinamento, entro i bordi
        st.x = Math.min(0, Math.max(-st.maxX, st.x));
        st.track.style.transform = `translate3d(${st.x.toFixed(1)}px, 0, 0)`;
        continue;
      }
      if (!st.drag && !st.hover) st.x -= SPEED * dt;
      while (st.x <= -st.copyW) { st.x += st.copyW; if (st.drag) st.drag.x0 += st.copyW; }
      while (st.x > 0) { st.x -= st.copyW; if (st.drag) st.drag.x0 -= st.copyW; }
      st.track.style.transform = `translate3d(${st.x.toFixed(1)}px, 0, 0)`;
    }
  })(last);
})();

/* ===== Video: si caricano e partono solo quando sono visibili ===== */
(() => {
  const vids = [...document.querySelectorAll("video[data-src]")];
  if (!vids.length) return;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const small = matchMedia("(max-width: 760px)").matches || (navigator.connection && navigator.connection.saveData);
  const load = v => {
    if (v.src) return;
    v.muted = true; v.playsInline = true; v.setAttribute("muted", ""); v.setAttribute("playsinline", "");
    v.src = small ? v.dataset.src.replace(/\.mp4$/, "-sm.mp4") : v.dataset.src;
  };
  if (reduced) { vids.forEach(v => { v.controls = true; load(v); }); return; }   // preload="none": scarica solo se premi play
  if (!("IntersectionObserver" in window)) { vids.forEach(v => { load(v); v.play().catch(() => {}); }); return; }
  const io = new IntersectionObserver(entries => {
    for (const e of entries) {
      const v = e.target;
      if (e.isIntersecting) { load(v); v.play().catch(() => {}); }
      else if (!v.paused) v.pause();
    }
  }, { rootMargin: "200px 0px" });
  vids.forEach(v => io.observe(v));
})();
