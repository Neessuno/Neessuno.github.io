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

  /* gallerie: avvolgo le foto in una "track" che scorre di lato con lo scroll */
  const rows = [...document.querySelectorAll(".shots")].map((row, i) => {
    const track = document.createElement("div");
    track.className = "shots-track";
    while (row.firstChild) track.appendChild(row.firstChild);
    row.appendChild(track);
    return { row, track, dir: i % 2 ? 1 : -1 };
  });

  const hero = document.querySelector(".hero");
  const headline = document.querySelector(".headline");
  const byline = document.querySelector(".byline");
  const stage = document.getElementById("stage");
  const titles = [...document.querySelectorAll(".section-title")];
  const marquees = [...document.querySelectorAll(".marquee-track")].map((el, i) => ({ el, x: 0, base: i === 0 ? 40 : 60 }));

  let lastY = window.scrollY, vel = 0, lastT = performance.now();

  function update(now) {
    const dt = Math.min(0.05, (now - lastT) / 1000);
    lastT = now;
    const sy = window.scrollY, vh = window.innerHeight;
    const v = lenis ? lenis.velocity : (sy - lastY) / Math.max(dt, 1e-3) / 60;
    lastY = sy;
    vel += (v - vel) * 0.12;

    /* hero: il titolo sale più lento e si rimpicciolisce, il cobot in parallasse */
    if (sy < vh * 1.3) {
      const p = clamp(sy / vh, 0, 1);
      headline.style.transform = `translate3d(0, ${p * vh * 0.28}px, 0) scale(${1 - p * 0.12})`;
      if (byline) byline.style.transform = `translate3d(0, ${p * vh * 0.22}px, 0)`;
      stage.style.transform = `translate3d(0, ${p * vh * 0.12}px, 0)`;
    }

    /* gallerie orizzontali */
    for (const r of rows) {
      const rect = r.row.getBoundingClientRect();
      if (rect.bottom < -100 || rect.top > vh + 100) continue;
      const p = clamp((vh - rect.top) / (vh + rect.height), 0, 1);
      const max = Math.max(0, r.track.scrollWidth - r.row.clientWidth);
      const x = r.dir < 0 ? -p * max : -(1 - p) * max;
      r.track.style.transform = `translate3d(${x}px, 0, 0)`;
    }

    /* titoli di sezione: leggero scorrimento laterale */
    for (const t of titles) {
      const rect = t.getBoundingClientRect();
      if (rect.bottom < 0 || rect.top > vh) continue;
      const p = clamp((vh - rect.top) / (vh + rect.height), 0, 1);
      t.style.transform = `translate3d(${(0.5 - p) * 80}px, 0, 0)`;
    }

    /* strisce scorrevoli: accelerano con la velocità di scroll */
    for (const m of marquees) {
      const half = m.el.scrollWidth / 2;
      if (!half) continue;
      m.x -= (m.base + Math.abs(vel) * 90) * dt;
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

/* ===== Illustrazioni tra parentesi che ruotano (come Kenji) ===== */
(() => {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const WIDTH = { cobot: .95, gripper: .95, pendant: 1.05, plc: 1.05, watch: .92, gear: .95, pallet: 1.05, bolt: .9 };
  const slots = [...document.querySelectorAll(".slot[data-set]")];
  slots.forEach((slot, i) => {
    const set = slot.dataset.set.split(" ");
    const use = slot.querySelector("use");
    let k = 0;
    setTimeout(() => setInterval(() => {
      if (document.hidden) return;
      k = (k + 1) % set.length;
      slot.classList.add("is-out");
      setTimeout(() => {
        use.setAttribute("href", "#g-" + set[k]);
        slot.style.width = (WIDTH[set[k]] || .95) + "em";
        slot.classList.remove("is-out");
      }, 200);
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
