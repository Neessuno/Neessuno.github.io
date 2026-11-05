/* =====================================================================
   Cobot 3D — cella pick & place (three.js)
   - 6 assi con cinematica inversa analitica (polso sempre verticale)
   - MoveL per avvicinamento/presa, MoveJ per i trasferimenti
   - Segue il mouse in modo morbido, poi riprende il ciclo da dove era
   ===================================================================== */
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

const stage = document.getElementById("stage");
const canvas = document.getElementById("cobot");
const hero = document.querySelector(".hero");
if (stage && canvas) init();

function init() {
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const { clamp, lerp } = THREE.MathUtils;
  const V3 = THREE.Vector3;

  /* ---------- Renderer / scena ---------- */
  const low = (navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 4 || matchMedia("(max-width: 640px)").matches;
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: !low, alpha: true, powerPreference: "high-performance" });
  } catch (e) {
    stage.classList.add("no-webgl");
    return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, low ? 1.5 : 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.5;

  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 60);
  const LOOK = new V3(0.5, 0.58, 0.38);
  const CAM_DIR = new V3(1.0, 0.6, 1.3).normalize();
  const CAM_AZ = Math.atan2(-CAM_DIR.z, CAM_DIR.x);
  let camDist = 6.4;

  scene.add(new THREE.HemisphereLight(0xfff4dc, 0x0b0b0c, 0.6));
  const key = new THREE.DirectionalLight(0xffffff, 2.6);
  key.position.set(2.2, 6, 3.4);
  key.castShadow = true;
  key.shadow.mapSize.set(low ? 1024 : 2048, low ? 1024 : 2048);
  Object.assign(key.shadow.camera, { left: -3, right: 3, top: 3, bottom: -3, near: 1, far: 16 });
  key.shadow.camera.updateProjectionMatrix();
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.02;
  scene.add(key);
  const rimBlue = new THREE.DirectionalLight(0x4c8dff, 2.4);
  rimBlue.position.set(-4, 2.6, -3);
  scene.add(rimBlue);
  const rimRed = new THREE.DirectionalLight(0xf0563a, 1.1);
  rimRed.position.set(-3, 1.2, 4);
  scene.add(rimRed);

  /* ---------- Materiali ---------- */
  const mat = {
    white: new THREE.MeshPhysicalMaterial({ color: 0xeceae4, roughness: 0.36, metalness: 0, clearcoat: 0.5, clearcoatRoughness: 0.28 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x24242a, roughness: 0.55, metalness: 0.25 }),
    blue: new THREE.MeshStandardMaterial({ color: 0x4c8dff, roughness: 0.32, metalness: 0.1, emissive: 0x1a3c8c, emissiveIntensity: 0.35 }),
    alu: new THREE.MeshStandardMaterial({ color: 0xbfc2c8, roughness: 0.26, metalness: 0.9 }),
    red: new THREE.MeshStandardMaterial({ color: 0xf0563a, roughness: 0.5 }),
    kraft: new THREE.MeshStandardMaterial({ color: 0xc8955c, roughness: 0.85 }),
    tape: new THREE.MeshStandardMaterial({ color: 0xa8743f, roughness: 0.55 }),
    pallet: new THREE.MeshStandardMaterial({ color: 0x2f5fc4, roughness: 0.6, metalness: 0.05 }),
    rail: new THREE.MeshStandardMaterial({ color: 0xd8d6cf, roughness: 0.4, metalness: 0.2 }),
  };

  function mesh(geo, m, cast = true) {
    const o = new THREE.Mesh(geo, m);
    o.castShadow = cast;
    o.receiveShadow = true;
    return o;
  }
  function at(o, x, y, z) { o.position.set(x, y, z); return o; }
  const cyl = (rt, rb, h, seg = 48) => new THREE.CylinderGeometry(rt, rb, h, seg);

  /* ---------- Pavimento ---------- */
  function radialTexture() {
    const c = document.createElement("canvas");
    c.width = c.height = 256;
    const x = c.getContext("2d");
    const gr = x.createRadialGradient(128, 128, 0, 128, 128, 128);
    gr.addColorStop(0, "rgba(34,34,38,1)");
    gr.addColorStop(0.6, "rgba(22,22,25,.7)");
    gr.addColorStop(1, "rgba(11,11,12,0)");
    x.fillStyle = gr;
    x.fillRect(0, 0, 256, 256);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }
  const floor = new THREE.Mesh(new THREE.CircleGeometry(3.4, 72), new THREE.MeshBasicMaterial({ map: radialTexture(), transparent: true, depthWrite: false }));
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);
  const catcher = new THREE.Mesh(new THREE.CircleGeometry(3.4, 72), new THREE.ShadowMaterial({ opacity: 0.55 }));
  catcher.rotation.x = -Math.PI / 2;
  catcher.position.y = 0.001;
  catcher.receiveShadow = true;
  scene.add(catcher);
  const ring = new THREE.Mesh(new THREE.RingGeometry(1.98, 2.0, 160), new THREE.MeshBasicMaterial({ color: 0xf0563a, transparent: true, opacity: 0.4 }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.002;
  scene.add(ring);

  /* ---------- Cobot: colonna e braccio grigi, avambraccio e polso bianchi, LED verde ---------- */
  mat.grey = new THREE.MeshPhysicalMaterial({ color: 0x7f8287, roughness: 0.45, metalness: 0.05, clearcoat: 0.3, clearcoatRoughness: 0.35 });
  mat.led = new THREE.MeshStandardMaterial({ color: 0x3ddc84, emissive: 0x3ddc84, emissiveIntensity: 2.2 });

  /* Carter di un giunto: cilindro con tappo leggermente rientrato e anello scuro */
  function housing(r, len, m, axis = "z") {
    const g = new THREE.Group();
    g.add(mesh(cyl(r, r, len, 64), m));
    for (const s of [1, -1]) {
      g.add(at(mesh(cyl(r * 0.86, r * 0.86, 0.01, 64), m), 0, s * (len / 2 + 0.004), 0));
      g.add(at(mesh(cyl(r * 0.3, r * 0.3, 0.012, 32), mat.dark), 0, s * (len / 2 + 0.008), 0));
    }
    g.add(at(mesh(cyl(r * 1.006, r * 1.006, 0.012, 64), mat.dark), 0, len * 0.18, 0));
    if (axis === "z") g.rotation.x = Math.PI / 2;
    else g.rotation.z = -Math.PI / 2;
    return g;
  }

  /* Misure reali del CRB 15000 12/1.27 (parametri DH, mm) scalate alla scena */
  const S = 1.27 / 1000;
  const D1 = 338 * S;          // base → asse spalla
  const L1 = 707 * S;          // braccio
  const EA = 110 * S;          // offset del gomito
  const L2 = 534 * S;          // avambraccio
  const WO = 80 * S;           // offset del polso
  const FL = 101 * S;          // polso → flangia
  const GL = 0.26;             // flangia → TCP (centro presa)
  const TOOL = FL + GL;
  const LE = Math.hypot(L2, EA), DELTA = Math.atan2(L2, EA);
  const SIDE = 0.17;           // braccio spostato di lato rispetto alla colonna

  const robot = new THREE.Group();
  scene.add(robot);
  // base: piastra con bulloni, colonna, anello
  robot.add(at(mesh(new RoundedBoxGeometry(0.36, 0.035, 0.36, 2, 0.012), mat.grey), 0, 0.0175, 0));
  for (const x of [-0.14, 0.14]) for (const z of [-0.14, 0.14]) robot.add(at(mesh(cyl(0.013, 0.013, 0.012, 16), mat.dark), x, 0.04, z));
  robot.add(at(mesh(cyl(0.112, 0.13, 0.2, 64), mat.grey), 0, 0.135, 0));
  robot.add(at(mesh(cyl(0.116, 0.116, 0.01, 64), mat.dark), 0, 0.24, 0));

  const j1 = new THREE.Group(); j1.position.y = 0.245; robot.add(j1);
  j1.add(at(mesh(cyl(0.112, 0.112, D1 - 0.245, 64), mat.grey), 0, (D1 - 0.245) / 2, 0));

  // spalla: carter orizzontale che sporge verso il braccio
  const j2 = new THREE.Group(); j2.position.y = D1 - 0.245; j1.add(j2);
  j2.add(at(housing(0.125, 0.36, mat.grey), 0, 0, SIDE * 0.55));
  j2.add(at(mesh(cyl(0.09, 0.105, 0.12, 48), mat.grey), 0, 0.09, SIDE));                 // raccordo
  j2.add(at(mesh(new RoundedBoxGeometry(0.15, L1 - 0.12, 0.12, 4, 0.05), mat.grey), 0, L1 / 2, SIDE));
  j2.add(at(mesh(cyl(0.105, 0.085, 0.12, 48), mat.grey), 0, L1 - 0.09, SIDE));           // raccordo

  // gomito: carter grigio, poi il blocco bianco che sale dell'offset e l'avambraccio in avanti
  const j3 = new THREE.Group(); j3.position.y = L1; j2.add(j3);
  j3.add(at(housing(0.108, 0.34, mat.grey), 0, 0, SIDE * 0.5));
  j3.add(at(mesh(new RoundedBoxGeometry(0.17, EA + 0.12, 0.13, 4, 0.06), mat.white), 0.02, EA / 2, 0));
  const fore = new THREE.Group(); fore.position.set(0, EA, 0); j3.add(fore);
  fore.add(at(mesh(new RoundedBoxGeometry(L2 - 0.06, 0.115, 0.115, 4, 0.05), mat.white), (L2 - 0.06) / 2 + 0.03, 0, 0));
  const seam = mesh(cyl(0.062, 0.062, 0.012, 48), mat.dark); seam.rotation.z = Math.PI / 2; fore.add(at(seam, 0.16, 0, 0));        // giunto di rollio J4
  const btn = mesh(cyl(0.02, 0.02, 0.006, 24), mat.dark); btn.rotation.x = Math.PI / 2; fore.add(at(btn, L2 * 0.62, 0, 0.06));     // pulsante sul fianco

  // polso: carter J5 bianco, cilindro J6 spostato in avanti con anello LED, flangia
  const j4 = new THREE.Group(); j4.position.set(L2, EA, 0); j3.add(j4);
  j4.add(housing(0.085, 0.19, mat.white));
  const j5 = new THREE.Group(); j5.position.set(-WO, 0, 0); j4.add(j5);
  j5.add(at(mesh(cyl(0.074, 0.074, FL + 0.04, 64), mat.white), 0, (FL - 0.04) / 2, 0));
  j5.add(at(mesh(cyl(0.0755, 0.0755, 0.018, 64), mat.led, false), 0, 0.012, 0));
  j5.add(at(mesh(cyl(0.0755, 0.0755, 0.008, 64), mat.dark), 0, FL - 0.006, 0));

  const j6 = new THREE.Group(); j6.position.y = FL; j5.add(j6);
  j6.add(at(mesh(cyl(0.06, 0.064, 0.026, 48), mat.alu), 0, 0.013, 0));
  j6.add(at(mesh(cyl(0.05, 0.05, 0.012, 48), mat.dark), 0, 0.032, 0));
  /* Utensile 1: pinza a due dita */
  const gripperTool = new THREE.Group(); j6.add(gripperTool);
  gripperTool.add(at(mesh(new RoundedBoxGeometry(0.21, 0.09, 0.1, 3, 0.02), mat.dark), 0, 0.087, 0));
  gripperTool.add(at(mesh(new THREE.BoxGeometry(0.24, 0.016, 0.03), mat.alu), 0, 0.135, 0));
  function finger(side) {
    const f = new THREE.Group();
    f.add(at(mesh(new RoundedBoxGeometry(0.025, 0.15, 0.06, 2, 0.006), mat.alu), 0, 0.2, 0));
    f.add(at(mesh(new THREE.BoxGeometry(0.008, 0.07, 0.052), mat.red), -side * 0.016, 0.235, 0));
    gripperTool.add(f);
    return f;
  }
  const fingerL = finger(-1), fingerR = finger(1);

  /* Utensile 2: mano robotica (4 dita da un lato, pollice opposto, 3 falangi ciascuno) */
  const handTool = new THREE.Group(); handTool.visible = false; j6.add(handTool);
  handTool.add(at(mesh(cyl(0.05, 0.058, 0.05, 40), mat.white), 0, 0.055, 0));                   // polsino
  handTool.add(at(mesh(cyl(0.059, 0.059, 0.012, 40), mat.led, false), 0, 0.072, 0));            // anello LED
  handTool.add(at(mesh(new RoundedBoxGeometry(0.22, 0.05, 0.15, 3, 0.022), mat.white), 0, 0.104, 0)); // dorso
  handTool.add(at(mesh(new RoundedBoxGeometry(0.205, 0.012, 0.138, 2, 0.005), mat.dark), 0, 0.132, 0)); // palmo in gomma
  const handFingers = [];
  function handFinger(x, z, side, lens, thick) {
    const base = new THREE.Group(); base.position.set(x, 0.124, z); handTool.add(base);
    base.add(mesh(new THREE.SphereGeometry(thick * 0.62, 18, 12), mat.dark));
    const segs = [];
    let parent = base;
    lens.forEach((L, i) => {
      const seg = new THREE.Group();
      if (i > 0) { seg.position.y = lens[i - 1]; seg.add(mesh(new THREE.SphereGeometry(thick * 0.56, 14, 10), mat.dark)); }
      seg.add(at(mesh(new RoundedBoxGeometry(thick, L * 0.94, thick, 2, thick * 0.32), mat.white), 0, L / 2, 0));
      parent.add(seg); segs.push(seg); parent = seg;
    });
    const tip = lens[lens.length - 1];
    segs[segs.length - 1].add(at(mesh(new THREE.BoxGeometry(0.006, tip * 0.7, thick * 0.82), mat.red), -side * thick * 0.5, tip * 0.55, 0)); // polpastrello
    handFingers.push({ segs, side });
  }
  for (const z of [-0.054, -0.018, 0.018, 0.054]) handFinger(0.125, z, 1, [0.06, 0.045, 0.036], 0.024);
  handFinger(-0.127, 0, -1, [0.052, 0.046, 0.04], 0.03);                                         // pollice

  const OPEN = 0.155, CLOSED = 0.1225;
  let grip = OPEN;
  let tool = "gripper";
  function setTool(t) { tool = t; gripperTool.visible = t === "gripper"; handTool.visible = t === "hand"; }

  // q = [J1, angolo assoluto braccio, gomito (relativo), polso (relativo), rollio, J6]
  function applyJoints(q) {
    j1.rotation.y = q[0];
    j2.rotation.z = -q[1];
    j3.rotation.z = -q[2];
    j4.rotation.z = -q[3];
    j5.rotation.x = q[4];
    j6.rotation.y = q[5];
    fingerL.position.x = -grip;
    fingerR.position.x = grip;
    if (handTool.visible) {
      const c = clamp((OPEN - grip) / (OPEN - CLOSED), 0, 1);          // 0 aperta → 1 chiusa
      for (const f of handFingers) {
        f.segs[0].rotation.z = f.side * lerp(-0.55, -0.02, c);
        f.segs[1].rotation.z = f.side * lerp(0.05, 0.06, c);
        f.segs[2].rotation.z = f.side * lerp(0.05, 0.1, c);
      }
    }
  }

  /* ---------- Cinematica inversa ---------- */
  const Q = Math.PI / 2;
  const wrapQuarter = a => a - Q * Math.round(a / Q);
  function ik(p, pitch = 0, roll = 0, out = new Array(6)) {
    const r = Math.hypot(p.x, p.z);
    const q1 = Math.atan2(-p.z, p.x);
    // centro polso: il cilindro J6 è avanti di WO rispetto al polso, la flangia sotto
    const dx = r - WO * Math.cos(pitch), dy = p.y + TOOL - D1 - WO * Math.sin(pitch);
    const D = Math.max(1e-6, Math.hypot(dx, dy));
    const Dc = clamp(D, Math.abs(L1 - LE) + 0.05, L1 + LE - 0.005);
    const k = Dc / D;
    const wx = dx * k, wy = dy * k;
    const phi = Math.atan2(wx, wy);
    const beta = Math.acos(clamp((L1 * L1 + Dc * Dc - LE * LE) / (2 * L1 * Dc), -1, 1));
    const t2 = phi - beta;                              // gomito alto
    const ex = L1 * Math.sin(t2), ey = L1 * Math.cos(t2);
    const t3 = Math.atan2(wx - ex, wy - ey);            // direzione gomito → polso
    const f3 = t3 - DELTA;                              // orientamento del telaio del gomito
    out[0] = q1;
    out[1] = t2;
    out[2] = f3 - t2;
    out[3] = Math.PI - pitch - f3;                      // flangia verso il basso
    out[4] = roll;
    out[5] = wrapQuarter(q1 + Math.PI);                 // pinza allineata alle scatole
    return out;
  }

  /* ---------- Nastro trasportatore ---------- */
  const CONV = { z: 1.1, x0: -1.8, x1: 0.55, h: 0.42, w: 0.42 };
  const convLen = CONV.x1 - CONV.x0, convCx = (CONV.x0 + CONV.x1) / 2;
  function beltTexture() {
    const c = document.createElement("canvas");
    c.width = 64; c.height = 16;
    const x = c.getContext("2d");
    x.fillStyle = "#1c1c20"; x.fillRect(0, 0, 64, 16);
    x.fillStyle = "#2d2d33"; x.fillRect(0, 0, 6, 16);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(convLen * 9, 1);
    return t;
  }
  const beltTex = beltTexture();
  const conv = new THREE.Group(); scene.add(conv);
  conv.add(at(mesh(new RoundedBoxGeometry(convLen + 0.08, 0.12, CONV.w + 0.06, 2, 0.02), mat.dark), convCx, CONV.h - 0.072, CONV.z));
  conv.add(at(mesh(new THREE.BoxGeometry(convLen, 0.012, CONV.w - 0.02), new THREE.MeshStandardMaterial({ map: beltTex, roughness: 0.9 })), convCx, CONV.h - 0.006, CONV.z));
  for (const s of [-1, 1]) conv.add(at(mesh(new THREE.BoxGeometry(convLen + 0.08, 0.04, 0.02), mat.rail), convCx, CONV.h + 0.012, CONV.z + s * (CONV.w / 2 + 0.03)));
  for (const x of [CONV.x0 + 0.1, CONV.x1 - 0.1]) for (const s of [-1, 1])
    conv.add(at(mesh(cyl(0.022, 0.022, CONV.h - 0.13, 16), mat.dark), x, (CONV.h - 0.13) / 2, CONV.z + s * (CONV.w / 2 - 0.02)));
  // fotocellula a fine nastro
  conv.add(at(mesh(new RoundedBoxGeometry(0.05, 0.08, 0.04, 2, 0.01), mat.red), 0.47, CONV.h + 0.07, CONV.z - CONV.w / 2 - 0.04));

  /* ---------- Pallet ---------- */
  const PAL = new V3(1.12, 0, -0.08);
  const pallet = new THREE.Group(); pallet.position.copy(PAL); scene.add(pallet);
  pallet.add(at(mesh(new RoundedBoxGeometry(0.62, 0.04, 0.62, 2, 0.012), mat.pallet), 0, 0.12, 0));
  for (const x of [-0.25, 0, 0.25]) for (const z of [-0.25, 0, 0.25])
    pallet.add(at(mesh(new RoundedBoxGeometry(0.1, 0.1, 0.1, 2, 0.015), mat.pallet), x, 0.05, z));
  const PAL_TOP = 0.14;

  /* ---------- Scatole ---------- */
  const BOX = { s: 0.22, h: 0.18 };
  const boxGeo = new RoundedBoxGeometry(BOX.s, BOX.h, BOX.s, 3, 0.012);
  const tapeGeo = new THREE.BoxGeometry(BOX.s + 0.004, 0.004, 0.05);
  function makeBox() {
    const g = new THREE.Group();
    g.add(mesh(boxGeo, mat.kraft));
    g.add(at(mesh(tapeGeo, mat.tape, false), 0, BOX.h / 2, 0));
    scene.add(g);
    return g;
  }
  const P = new V3(0.25, CONV.h + BOX.h / 2, CONV.z);       // punto di presa
  const SLOTS = [];
  for (let layer = 0; layer < 2; layer++)
    for (const [sx, sz] of [[-0.12, -0.12], [0.12, -0.12], [-0.12, 0.12], [0.12, 0.12]])
      SLOTS.push(new V3(PAL.x + sx, PAL_TOP + BOX.h / 2 + layer * BOX.h, PAL.z + sz));

  /* ---------- Ciclo pick & place ---------- */
  const UP = 0.3;
  const easeIO = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const easeSine = t => -(Math.cos(Math.PI * t) - 1) / 2;
  const easeOut = t => 1 - Math.pow(1 - t, 3);

  let beltBox = makeBox(); beltBox.position.copy(P);
  let incoming = null;          // scatola in arrivo sul nastro
  let carried = null;
  let placed = [];
  let shipping = null;
  let slotIdx = 0, count = 0;
  const countEl = document.getElementById("hud-count");

  function spawnNext() {
    const b = makeBox();
    const from = CONV.x0 + 0.18;
    b.position.set(from, P.y, P.z);
    incoming = { box: b, t: 0, dur: 2.0, from };
  }
  function attach() { j6.attach(beltBox); carried = beltBox; beltBox = null; }
  function release(slot) {
    scene.attach(carried);
    carried.position.copy(slot);
    carried.rotation.set(0, 0, 0);
    placed.push(carried);
    carried = null;
    count++;
    if (countEl) countEl.textContent = count;
  }
  function afterPlace() {
    slotIdx++;
    if (slotIdx >= SLOTS.length) { shipping = { boxes: placed, t: 0 }; placed = []; slotIdx = 0; }
  }

  const aP = P.clone().add(new V3(0, UP, 0));
  function cycleSteps(slot) {
    const aS = slot.clone();
    aS.y = Math.max(slot.y + UP, PAL_TOP + 2 * BOX.h + 0.28);
    return [
      { type: "waitBox" },
      { type: "L", a: aP, b: P, dur: 0.6 },
      { type: "grip", to: CLOSED, dur: 0.25, end: attach },
      { type: "L", a: P, b: aP, dur: 0.5, start: spawnNext },
      { type: "J", qa: ik(aP), qb: ik(aS), dur: 1.35 },
      { type: "L", a: aS, b: slot, dur: 0.6 },
      { type: "grip", to: OPEN, dur: 0.22, start: () => release(slot) },
      { type: "L", a: slot, b: aS, dur: 0.45 },
      { type: "J", qa: ik(aS), qb: ik(aP), dur: 1.2, end: afterPlace },
    ];
  }
  let steps = cycleSteps(SLOTS[slotIdx]), si = 0, st = 0, started = false;
  const qC = ik(aP);
  const tmp = new V3();

  function nextStep() {
    si++; st = 0; started = false;
    if (si >= steps.length) { steps = cycleSteps(SLOTS[slotIdx]); si = 0; }
  }
  function runCycle(dt) {
    const s = steps[si];
    if (!started) { s.start && s.start(); started = true; if (s.type === "grip") s.from = grip; }
    if (s.type === "waitBox") { if (beltBox && !incoming) nextStep(); return; }
    st += dt;
    const t = Math.min(1, st / s.dur);
    if (s.type === "L") { tmp.lerpVectors(s.a, s.b, easeSine(t)); ik(tmp, 0, 0, qC); }
    else if (s.type === "J") { const e = easeIO(t); for (let i = 0; i < 6; i++) qC[i] = lerp(s.qa[i], s.qb[i], e); }
    else if (s.type === "grip") grip = lerp(s.from, s.to, easeSine(t));
    if (t >= 1) { s.end && s.end(); nextStep(); }
  }

  function updateWorld(dt) {
    if (incoming) {
      incoming.t += dt;
      const t = Math.min(1, incoming.t / incoming.dur);
      const x = lerp(incoming.from, P.x, easeOut(t));
      beltTex.offset.x -= (x - incoming.box.position.x) * 9;   // 9 = righe per metro
      incoming.box.position.x = x;
      if (t >= 1) { beltBox = incoming.box; incoming = null; }
    }
    if (shipping) {
      shipping.t += dt;
      const t = Math.min(1, shipping.t / 0.7);
      for (const b of shipping.boxes) { b.scale.setScalar(Math.max(0.001, 1 - easeIO(t))); b.position.y += dt * 0.3; }
      if (t >= 1) { shipping.boxes.forEach(b => scene.remove(b)); shipping = null; }
    }
  }

  /* ---------- Controllo: mouse, teach pendant, saluto e sguardo legati allo scroll ---------- */
  const deg = r => (r * 180) / Math.PI;
  let mode = "auto", estop = false;
  // torni in cima → il cobot saluta; scorri nella hero → guarda verso i contenuti
  let armed = false, waveT0 = -1e9, lastScroll = -1e9;
  window.addEventListener("scroll", () => {
    const y = window.scrollY, vh = window.innerHeight;
    if (y > vh * 0.7) armed = true;
    if (armed && y < 30) { armed = false; waveT0 = performance.now(); }
    if (y > vh * 0.04 && y < vh * 1.1) lastScroll = performance.now();
  }, { passive: true });

  const qF = qC.slice(), qFT = new Array(6), q = qC.slice(), qM = qC.slice();
  let w = 0, camAz = 0, gripTarget = null, gripRestore = null;
  function lookTarget(px, py) {
    const az = CAM_AZ + 0.12 + px * 0.85;
    const r = 1.05;
    tmp.set(r * Math.cos(az), 0.95 - py * 0.4, -r * Math.sin(az));
    ik(tmp, 0.7 - py * 0.25, -px * 0.25, qFT);
    qFT[5] = px * 0.5;
  }

  /* Teach pendant: selettore a chiave, jog ± tenendo premuto, override velocità, utensile */
  const tp = document.getElementById("tp"), tpToggle = document.getElementById("tp-toggle");
  const tpState = document.getElementById("tp-state"), tpEstop = document.getElementById("tp-estop");
  const tpKey = document.getElementById("tp-key");
  const jogBtns = tp ? [...tp.querySelectorAll("[data-jog]")] : [];
  const outs = tp ? [...tp.querySelectorAll("[data-out]")] : [];
  const speedBtns = tp ? [...tp.querySelectorAll("[data-speed]")] : [];
  const toolBtns = tp ? [...tp.querySelectorAll("[data-tool]")] : [];
  const gripBtn = document.getElementById("tp-grip"), homeBtn = document.getElementById("tp-home");
  const toolLabel = document.getElementById("tp-tool"), speedLabel = document.getElementById("tp-speed");
  const toHud = (qq, i) => [deg(qq[0]), deg(qq[1]) - 90, deg(qq[2]), deg(qq[3]) - 180, deg(qq[4]), deg(qq[5])][i];
  const jog = [0, 0, 0, 0, 0, 0];
  let speed = 0.5;
  const JOG_MAX = (60 * Math.PI) / 180;                                  // 60°/s al 100%

  function refreshControls() {
    const man = mode === "manual" && !estop;
    jogBtns.forEach(b => (b.disabled = !man));
    if (homeBtn) homeBtn.disabled = !man;
    if (gripBtn) gripBtn.disabled = !man || !!carried;
    if (tpKey) { tpKey.setAttribute("aria-checked", String(mode === "manual")); tpKey.disabled = estop; }
  }
  function setMode(m) {
    if (estop || m === mode) return;
    mode = m;
    if (m === "manual") { for (let i = 0; i < 6; i++) qM[i] = q[i]; gripRestore = grip; gripTarget = grip; }
    else { gripTarget = null; jog.fill(0); }
    refreshControls();
  }
  function jogStep(dt) {
    if (mode !== "manual") return;
    for (let i = 0; i < 6; i++) if (jog[i]) qM[i] += jog[i] * JOG_MAX * speed * dt;
  }
  if (tp && tpToggle) {
    tpToggle.addEventListener("click", () => {
      const open = tp.hidden;
      tp.hidden = !open;
      tpToggle.setAttribute("aria-expanded", String(open));
      if (!open) setMode("auto");
    });
    tpKey && tpKey.addEventListener("click", () => setMode(mode === "manual" ? "auto" : "manual"));
    jogBtns.forEach(b => {
      const i = +b.dataset.jog, dir = +b.dataset.dir;
      const stop = () => { jog[i] = 0; b.classList.remove("is-held"); };
      b.addEventListener("pointerdown", e => { if (b.disabled) return; jog[i] = dir; b.classList.add("is-held"); b.setPointerCapture(e.pointerId); });
      b.addEventListener("pointerup", stop);
      b.addEventListener("pointercancel", stop);
      b.addEventListener("lostpointercapture", stop);
      b.addEventListener("click", e => { if (e.detail === 0 && mode === "manual") qM[i] += dir * (2 * Math.PI) / 180; }); // tastiera: passo di 2°
    });
    speedBtns.forEach(b => b.addEventListener("click", () => {
      speed = +b.dataset.speed;
      speedBtns.forEach(x => x.setAttribute("aria-pressed", String(x === b)));
      if (speedLabel) speedLabel.textContent = Math.round(speed * 100) + "%";
    }));
    toolBtns.forEach(b => b.addEventListener("click", () => {
      setTool(b.dataset.tool);
      toolBtns.forEach(x => x.setAttribute("aria-pressed", String(x === b)));
      if (toolLabel) toolLabel.innerHTML = b.innerHTML;
    }));
    homeBtn && homeBtn.addEventListener("click", () => ik(aP, 0, 0, qM));
    gripBtn && gripBtn.addEventListener("click", () => {
      gripTarget = (gripTarget ?? grip) > (OPEN + CLOSED) / 2 ? CLOSED : OPEN;
    });
    tpEstop && tpEstop.addEventListener("click", () => {
      estop = !estop;
      tpEstop.setAttribute("aria-pressed", String(estop));
      jog.fill(0);
      refreshControls();
      updateHud(1, performance.now());
    });
    refreshControls();
  }

  /* ---------- Stato e valori dei giunti sul display del pendant ---------- */
  let hudT = 0, state = "AUTO";
  function updateHud(dt, now) {
    hudT += dt;
    if (hudT < 0.08) return;
    hudT = 0;
    const src = mode === "manual" ? qM : q;
    outs.forEach((el, i) => { el.textContent = toHud(src, i).toFixed(1) + "°"; });
    if (estop) state = "E-STOP";
    else if (mode === "manual") state = "MAN";
    else if (now - waveT0 < 2200) state = "HELLO";
    else state = "AUTO";
    if (tpState) {
      tpState.textContent = state;
      tpState.classList.toggle("is-man", mode === "manual" && !estop);
      tpState.classList.toggle("is-stop", estop);
    }
    if (gripBtn && mode === "manual") gripBtn.disabled = !!carried || estop;
  }

  /* ---------- Camera / resize ---------- */
  function placeCamera() {
    const a = camAz;
    const d = new V3(
      CAM_DIR.x * Math.cos(a) + CAM_DIR.z * Math.sin(a),
      CAM_DIR.y,
      -CAM_DIR.x * Math.sin(a) + CAM_DIR.z * Math.cos(a)
    );
    camera.position.copy(LOOK).addScaledVector(d, camDist);
    camera.lookAt(LOOK);
  }
  function resize() {
    const wpx = stage.clientWidth, hpx = stage.clientHeight;
    if (!wpx || !hpx) return;
    renderer.setSize(wpx, hpx, false);
    camera.aspect = wpx / hpx;
    camDist = 4.4 * Math.pow(Math.max(1, 1.75 / camera.aspect), 0.75);
    camera.updateProjectionMatrix();
    placeCamera();
    if (reduced) renderer.render(scene, camera);
  }
  new ResizeObserver(resize).observe(stage);

  let visible = true;
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(stage);

  /* ---------- Loop ---------- */
  applyJoints(q);
  resize();
  renderer.render(scene, camera);
  stage.classList.add("ready");
  if (reduced) { updateHud(1, 0); return; }

  let last = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!visible || document.hidden) return;
    if (estop) { updateHud(dt, now); return; }           // arresto: tutto fermo
    jogStep(dt);

    const waving = mode === "auto" && now - waveT0 < 2200;
    const looking = mode === "auto" && !waving && now - lastScroll < 900;
    const engaged = mode === "manual" || waving || looking;
    w += ((engaged ? 1 : 0) - w) * (1 - Math.exp(-dt * (engaged ? 3.2 : 2.2)));
    if (w < 0.02) runCycle(dt);
    updateWorld(dt);

    if (w < 0.001) for (let i = 0; i < 6; i++) qF[i] = qC[i];
    else {
      let k = 4;
      if (mode === "manual") { for (let i = 0; i < 6; i++) qFT[i] = qM[i]; k = 7; }
      else if (waving) {
        const t = (now - waveT0) / 1000, env = Math.sin(Math.PI * Math.min(1, t / 2.2));
        lookTarget(0, -0.7);
        qFT[4] += Math.sin(t * 9) * 0.6 * env;          // rollio del polso: ciao!
        qFT[3] -= 0.3 * env;
        k = 6;
      } else lookTarget(0, 0.9);
      const kk = 1 - Math.exp(-dt * k);
      for (let i = 0; i < 6; i++) qF[i] += (qFT[i] - qF[i]) * kk;
    }

    if (mode === "manual" && gripTarget !== null) grip += (gripTarget - grip) * (1 - Math.exp(-dt * 10));
    else if (mode === "auto" && gripRestore !== null) {
      grip += (gripRestore - grip) * (1 - Math.exp(-dt * 10));
      if (Math.abs(grip - gripRestore) < 1e-4) { grip = gripRestore; gripRestore = null; }
    }

    const ws = w * w * (3 - 2 * w);
    for (let i = 0; i < 6; i++) q[i] = lerp(qC[i], qF[i], ws);
    applyJoints(q);

    placeCamera();
    updateHud(dt, now);
    renderer.render(scene, camera);
  }
  requestAnimationFrame(frame);
}
