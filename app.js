/* Fizzo: how the page behaves. The words are in config.js, the 3D cans in gl.js,
 * the labels, fruit and sounds in art.js. */
(() => {
  "use strict";

  const C = window.FIZZO, F = C.flavours, N = F.length, A = window.Art, GL = window.CanGL;
  const TAU = Math.PI * 2;
  const $ = (id) => document.getElementById(id);
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
  const back = (t) => { t = clamp(t, 0, 1) - 1; return 1 + 2.70158 * t * t * t + 1.70158 * t * t; };
  const wrap = (i) => ((i % N) + N) % N;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const money = (n) => C.currency + n;
  const two = (n) => String(n).padStart(2, "0");
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const hoverable = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  const params = new URLSearchParams(window.location.search);
  const PAPER = [0.95, 0.94, 0.92];
  const root = document.documentElement;

  const start = wrap(C.startFlavour || 0);
  // pos is where the row of cans is (it may run past the ends), target is where it is heading.
  const S = { cur: start, pos: start, target: start, vel: 0, box: [], leaving: [], packs: 0, auto: !reduced,
    t: 0, dt: 0.016, tint: [1, 1, 1], live: false, ready: false, uid: 1 };
  const vis = {};

  // Where the mouse is, from -1 to 1. The big cans lean towards it a little.
  const mouse = { tx: 0, ty: 0, x: 0, y: 0 };
  if (hoverable && !reduced) {
    window.addEventListener("pointermove", (e) => {
      if (e.pointerType !== "mouse") return;
      mouse.tx = (e.clientX / window.innerWidth) * 2 - 1;
      mouse.ty = (e.clientY / window.innerHeight) * 2 - 1;
    }, { passive: true });
  }

  /* ---------- Small helpers shared by the parts ---------- */
  function field(n, seed) {
    let s = seed * 7919 + 13;
    const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
    return Array.from({ length: n }, (_, k) => ({
      x: rnd(), y: rnd(), z: rnd(), ph: rnd() * TAU, sp: 0.4 + rnd() * 0.6, k, rot: rnd() * TAU, vr: rnd() - 0.5, bub: k % 3 === 2,
    }));
  }

  // Fruit pieces and bubbles drifting through a view. Near ones are drawn in front of the cans.
  function drawBits(v, list, fi, front, size, alpha) {
    const spr = A.sprites[fi], t = S.t;
    for (let n = 0; n < list.length; n++) {
      const p = list[n];
      if ((p.z > 0.72) !== front) continue;
      const yy = (((p.y + t * 0.012 * p.sp * (p.bub ? -4 : 1)) % 1) + 1) % 1;
      const x = (p.x + Math.sin(t * 0.3 * p.sp + p.ph) * 0.025) * v.w;
      const y = (yy * 1.3 - 0.15) * v.h;
      const s = size * (0.45 + p.z * 0.9), a = (0.4 + p.z * 0.6) * alpha;
      if (p.bub) A.bubble(v.ctx, x, y, s * 0.2, a * 0.8);
      else A.drawSprite(v.ctx, spr[p.k % spr.length], x, y, s, p.rot + t * p.vr * 0.6, a);
    }
  }

  function shadow(ctx, x, y, r, alpha) {
    if (alpha <= 0.01 || r < 2) return;
    ctx.save();
    ctx.translate(x, y); ctx.scale(1, 0.17);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
    g.addColorStop(0, `rgba(0,0,0,${alpha})`); g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
    ctx.restore();
  }

  let toastTimer = 0;
  function toast(msg) {
    const el = $("toast");
    el.textContent = msg;
    el.classList.add("is-on");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => el.classList.remove("is-on"), 2800);
  }

  function bump() {
    const b = $("basket");
    b.classList.remove("is-bump"); void b.offsetWidth; b.classList.add("is-bump");
  }

  /* ---------- Colour: the page follows the can in the middle ---------- */
  let lastPaint = "";
  function paint() {
    const a = Math.floor(S.pos), t = S.pos - a, fa = F[wrap(a)], fb = F[wrap(a + 1)];
    const rgb = A.mix(fa.rgb, fb.rgb, t), ink = A.mix(fa.inkRgb, fb.inkRgb, t), deep = A.mix(rgb, A.BLACK, 0.45);
    S.tint = [rgb[0] / 255, rgb[1] / 255, rgb[2] / 255];
    const list = (c) => `${Math.round(c[0])}, ${Math.round(c[1])}, ${Math.round(c[2])}`;
    const key = list(rgb) + list(ink);
    if (key === lastPaint) return;
    lastPaint = key;
    root.style.setProperty("--fl-rgb", list(rgb));
    root.style.setProperty("--ink-rgb", list(ink));
    root.style.setProperty("--deep-rgb", list(deep));
  }

  /* ---------- Top bar: its colours and the lit link follow what is under it ---------- */
  const zones = Array.from(document.querySelectorAll("main [data-tone], footer[data-tone]"));
  const navLinks = Array.from(document.querySelectorAll("#nav a"));
  const navTargets = navLinks.map((a) => $(a.getAttribute("href").slice(1)));
  let lastTone = "", lastNav = -1;
  function chrome() {
    let tone = "flavour";
    for (let i = 0; i < zones.length; i++) {
      const r = zones[i].getBoundingClientRect();
      if (r.top <= 34 && r.bottom > 34) tone = zones[i].dataset.tone;
    }
    if (tone !== lastTone) { lastTone = tone; $("top").dataset.tone = tone; }
    let cur = 0;
    for (let i = 0; i < navTargets.length; i++) if (navTargets[i].getBoundingClientRect().top <= window.innerHeight * 0.45) cur = i;
    if (cur !== lastNav) {
      lastNav = cur;
      navLinks.forEach((a, i) => { if (i === cur) a.setAttribute("aria-current", "true"); else a.removeAttribute("aria-current"); });
    }
  }

  /* ---------- 1. The row of cans ---------- */
  const hero = { v: GL.view($("heroView")), el: $("flavours"), bits: field(18, 3), boxes: [], drag: null, gap: 200, timer: 0, poke: 0 };

  const slotOf = (i) => {
    let s = (i - S.pos) % N;
    if (s < -N / 2) s += N;
    if (s >= N / 2) s -= N;
    return s;
  };

  function showFlavour() {
    const f = F[S.cur], name = $("flavName");
    name.innerHTML = f.lines.map((l) => `<span>${esc(l)}</span>`).join("");
    name.classList.remove("is-in"); void name.offsetWidth; name.classList.add("is-in");
    $("flavTag").textContent = f.tag;
    $("flavNo").textContent = two(S.cur + 1);
    const last = document.querySelector('.chapter[data-ch="3"]');
    if (last) {
      last.querySelector("h2").textContent = f.name;
      last.querySelector("p:last-child").textContent = f.note;
    }
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", f.color);
  }

  function select(i) {
    S.target = i;
    const c = wrap(Math.round(i));
    if (c !== S.cur) { S.cur = c; showFlavour(); }
  }
  function selectFlavour(fi) {
    const at = Math.round(S.target);
    let d = (fi - wrap(at)) % N;
    if (d > N / 2) d -= N;
    if (d < -N / 2) d += N;
    select(at + d);
  }
  function step(dir) { select(Math.round(S.target) + dir); hero.timer = -2; }

  function stepCarousel() {
    const dt = S.dt;
    if (!(hero.drag && hero.drag.moved)) {
      if (reduced) { S.pos = S.target; S.vel = 0; }
      else {
        S.vel += ((S.target - S.pos) * 30 - S.vel * 11) * dt;
        S.pos += S.vel * dt;
        if (Math.abs(S.target - S.pos) < 0.0004 && Math.abs(S.vel) < 0.002) { S.pos = S.target; S.vel = 0; }
      }
    }
    hero.poke *= Math.exp(-dt * 3);
    if (hero.poke < 0.002) hero.poke = 0;
    if (S.auto && S.ready && vis.flavours && !hero.drag && !document.hidden) {
      hero.timer += dt;
      if (hero.timer > 2.8) { hero.timer = 0; select(Math.round(S.target) + 1); }
    }
  }

  hero.el.addEventListener("pointerdown", (e) => {
    if (e.target.closest("button, a")) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    hero.drag = { id: e.pointerId, x: e.clientX, y: e.clientY, pos: S.pos, moved: false, last: e.clientX, lastT: performance.now(), v: 0 };
  });
  hero.el.addEventListener("pointermove", (e) => {
    const d = hero.drag;
    if (!d || e.pointerId !== d.id) return;
    const dx = e.clientX - d.x;
    if (!d.moved && Math.abs(dx) > 6 && Math.abs(dx) > Math.abs(e.clientY - d.y)) {
      d.moved = true;
      hero.el.classList.add("is-drag");
      try { hero.el.setPointerCapture(d.id); } catch (_) { /* fine without it */ }
    }
    if (!d.moved) return;
    const now = performance.now();
    d.v = ((e.clientX - d.last) / Math.max(1, now - d.lastT)) * 1000;
    d.last = e.clientX; d.lastT = now;
    S.pos = d.pos - dx / hero.gap; S.target = S.pos; S.vel = 0;
    const c = wrap(Math.round(S.pos));
    if (c !== S.cur) { S.cur = c; showFlavour(); }
  });
  const heroUp = (e) => {
    const d = hero.drag;
    if (!d || e.pointerId !== d.id) return;
    hero.drag = null;
    hero.el.classList.remove("is-drag");
    hero.timer = -3;
    if (d.moved) {
      S.vel = -d.v / hero.gap;
      select(Math.round(S.pos - clamp((d.v / hero.gap) * 0.16, -1.4, 1.4)));
    } else if (e.type === "pointerup") {
      const r = hero.el.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
      let hit = null;
      hero.boxes.forEach((b) => {
        if (Math.abs(x - b.x) < b.w / 2 && Math.abs(y - b.y) < b.h / 2 && (!hit || b.z > hit.z)) hit = b;
      });
      if (hit) {
        if (hit.i === S.cur) { hero.poke += TAU; A.Sound.pop(520); }
        else selectFlavour(hit.i);
      }
    }
  };
  hero.el.addEventListener("pointerup", heroUp);
  hero.el.addEventListener("pointercancel", heroUp);
  $("flavPrev").addEventListener("click", () => step(-1));
  $("flavNext").addEventListener("click", () => step(1));
  $("autoplay").addEventListener("click", () => {
    S.auto = !S.auto; hero.timer = 0;
    $("autoplay").setAttribute("aria-pressed", String(S.auto));
    $("flavName").setAttribute("aria-live", S.auto ? "off" : "polite");
  });

  function drawHero() {
    const v = hero.v;
    if (!v.begin()) return;
    const w = v.w, h = v.h, t = S.t, phone = w < 760;
    const canH = phone ? clamp(h * 0.34, 170, 300) : clamp(h * 0.4, 200, 400);
    const cy = h * (phone ? 0.39 : 0.41);
    const gap = canH * (phone ? 0.68 : 0.74), th = 0.3, R = gap / Math.sin(th);
    hero.gap = gap;
    hero.boxes.length = 0;

    drawBits(v, hero.bits, S.cur, false, canH * 0.2, 0.9);

    for (let i = 0; i < N; i++) {
      const s = slotOf(i), a = Math.abs(s);
      if (a > 4.2) continue;
      const k = clamp(4.2 - a, 0, 1), ang = s * th;
      const x = w / 2 + R * Math.sin(ang), z = R * (Math.cos(ang) - 1);
      const size = canH * (1 - 0.075 * a) * (0.4 + 0.6 * k);
      const near = 1 - Math.min(a, 1);
      const y = cy + a * a * canH * 0.012 + Math.sin(t * 1.3 + i * 1.9) * canH * 0.016;
      const p = v.project(x, y, z);
      shadow(v.ctx, p.x, v.project(x, cy + canH * 0.6, z).y, size * p.k * 0.36, 0.3 * k);
      v.can({
        x, y, z, h: size, label: i, alpha: k, tint: S.tint,
        ry: ang * 0.9 - S.pos * TAU + Math.sin(t * 0.9 + i) * (0.1 + 0.28 * near) + hero.poke * near + mouse.x * 0.4,
        rx: 0.07 - mouse.y * 0.14, rz: -s * 0.045,
      });
      hero.boxes.push({ i, x: p.x, y: p.y, w: size * p.k * GL.WIDTH, h: size * p.k, z });
    }
    v.flush();
    drawBits(v, hero.bits, S.cur, true, canH * 0.2, 0.95);
  }

  /* ---------- 2. Inside: one can turns through four chapters, then the fizz ---------- */
  const inside = { v: GL.view($("insideView")), el: $("inside"), pin: document.querySelector(".inside-pin"), bits: field(16, 9), storm: [], ch: -2, geo: "", spawn: 0 };
  const KEY_P = [0, 0.1, 0.3, 0.5, 0.7, 0.8];
  const KEY_RY = [-1.0, -0.38, Math.PI + 0.32, 4 * Math.PI - Math.PI / 2 + 0.3, 6 * Math.PI - 0.34, 6 * Math.PI];
  const KEY_RZ = [-0.2, -0.13, 0.11, -0.08, 0.09, 0];
  const keyed = (keys, p) => {
    for (let i = 0; i < KEY_P.length - 1; i++) {
      if (p <= KEY_P[i + 1]) return lerp(keys[i], keys[i + 1], smooth((p - KEY_P[i]) / (KEY_P[i + 1] - KEY_P[i])));
    }
    return keys[keys.length - 1];
  };

  function buildInside() {
    const chapters = $("chapters"), callouts = $("callouts"), steps = $("insideSteps");
    C.inside.chapters.forEach((c, k) => {
      const el = document.createElement("article");
      el.className = "chapter"; el.dataset.ch = String(k);
      el.innerHTML = `<p class="eyebrow">Chapter ${two(k + 1)} · ${esc(c.label)}</p><h2>${esc(c.title || "")}</h2><p>${esc(c.text || "")}</p>`;
      chapters.append(el);
      (c.notes || []).slice(0, 2).forEach((note, n) => {
        const s = document.createElement("span");
        s.className = "callout"; s.dataset.ch = String(k); s.dataset.n = String(n);
        s.innerHTML = `<i></i>${esc(note)}`;
        callouts.append(s);
      });
      const li = document.createElement("li");
      li.innerHTML = `<button type="button" aria-label="Chapter ${k + 1}: ${esc(c.label)}">${two(k + 1)}</button>`;
      li.firstChild.addEventListener("click", () => {
        const r = inside.el.getBoundingClientRect(), total = r.height - window.innerHeight;
        window.scrollTo({ top: window.scrollY + r.top + total * (k * 0.2 + 0.1), behavior: reduced ? "auto" : "smooth" });
      });
      steps.append(li);
    });
    $("rateLabel").textContent = C.inside.rate.label;
    $("rateUnit").textContent = C.inside.rate.unit;
  }

  function drawInside() {
    const r = inside.el.getBoundingClientRect(), total = r.height - window.innerHeight;
    const p = clamp(-r.top / total, 0, 1), e = smooth((p - 0.8) / 0.2);
    const ch = p >= 0.8 ? -1 : Math.min(3, Math.floor(p / 0.2));
    if (ch !== inside.ch) {
      inside.ch = ch;
      inside.pin.querySelectorAll(".chapter, .callout").forEach((el) => el.classList.toggle("is-on", Number(el.dataset.ch) === ch));
      inside.pin.querySelectorAll(".steps button").forEach((b, k) => { if (k === ch) b.setAttribute("aria-current", "true"); else b.removeAttribute("aria-current"); });
      if (ch >= 0) $("insideNo").textContent = two(ch + 1);
    }
    inside.pin.style.setProperty("--no", (1 - e).toFixed(3));
    inside.pin.style.setProperty("--rate", clamp(e * 3, 0, 1).toFixed(3));
    $("rateNo").textContent = (e * 61.8).toFixed(1);

    const v = inside.v;
    if (!v.begin()) return;
    const w = v.w, h = v.h, t = S.t, phone = w < 760;
    const bx = phone ? w * 0.44 : w * 0.62, by = phone ? h * 0.33 : h * 0.5;
    const H0 = phone ? Math.min(h * 0.42, w * 0.88) : Math.min(h * 0.68, w * 0.46);
    const geo = `${Math.round(bx)}|${Math.round(by)}|${Math.round(H0)}`;
    if (geo !== inside.geo) {
      inside.geo = geo;
      inside.pin.querySelectorAll(".callout").forEach((el) => {
        el.style.setProperty("--x", `${Math.round(bx + H0 * 0.285)}px`);
        el.style.setProperty("--y", `${Math.round(by + H0 * (el.dataset.n === "0" ? -0.3 : 0.22))}px`);
      });
    }
    const H = H0 * lerp(1, 0.55, e);
    const x = lerp(bx, w * 0.5, e), y = lerp(by, h * 0.45, e) + Math.sin(t * 1.1) * H * 0.012;
    const pp = Math.min(p, 0.8);

    drawBits(v, inside.bits, S.cur, false, H0 * 0.11, 0.9 * (1 - e * 0.6));

    // The fizz at the end: bubbles and fruit rush up the screen.
    inside.spawn += e * 150 * S.dt;
    while (inside.spawn >= 1 && inside.storm.length < 260) {
      inside.spawn -= 1;
      inside.storm.push({ x: Math.random() * w, y: h + 30, vy: 260 + Math.random() * 620, r: 3 + Math.random() * 12, k: Math.floor(Math.random() * 9), sway: Math.random() * TAU, front: Math.random() > 0.55 });
    }
    if (inside.spawn > 2) inside.spawn = 0;
    inside.storm = inside.storm.filter((b) => { b.y -= b.vy * S.dt; return b.y > -40; });
    const stormLayer = (front) => {
      const spr = A.sprites[S.cur];
      inside.storm.forEach((b) => {
        if (b.front !== front) return;
        const sx = b.x + Math.sin(t * 3 + b.sway) * 10;
        if (b.k === 0) A.drawSprite(v.ctx, spr[Math.floor(b.r) % spr.length], sx, b.y, b.r * 5, b.sway + t * 2, 0.95);
        else A.bubble(v.ctx, sx, b.y, b.r, 0.85);
      });
    };
    stormLayer(false);

    v.can({
      x, y, z: 0, h: H, label: S.cur, tint: S.tint,
      ry: keyed(KEY_RY, pp) + e * TAU * 2 + Math.sin(t * 0.7) * 0.06 + mouse.x * 0.35,
      rx: 0.1 + Math.sin(t * 0.9) * 0.03 - mouse.y * 0.16,
      rz: keyed(KEY_RZ, pp) + Math.sin(t * 38) * 0.03 * e * (1 - e) * 4,
    });
    v.flush();
    drawBits(v, inside.bits, S.cur, true, H0 * 0.11, 0.95 * (1 - e * 0.6));
    stormLayer(true);
  }

  /* ---------- The box: up to three cans, shared by the cards and the builder ---------- */
  const fly = { v: GL.view($("flyView")), list: [], dirty: false };

  function boxChanged() {
    const n = S.box.length, left = C.packSize - n;
    document.querySelectorAll("#basket .dots i").forEach((d, k) => d.classList.toggle("is-on", k < n));
    $("basketText").textContent = `Your box: ${n} of ${C.packSize} cans` + (S.packs ? `, ${S.packs} box in the basket` : "");
    const packs = $("packs");
    packs.hidden = S.packs === 0; packs.textContent = String(S.packs);
    const picks = $("picks");
    picks.classList.toggle("is-full", left === 0);
    picks.querySelectorAll("button").forEach((b, i) => {
      const count = S.box.filter((it) => it.i === i).length;
      b.classList.toggle("has", count > 0);
      b.querySelector(".ct").textContent = String(count);
      b.setAttribute("aria-label", `Add ${F[i].name}` + (count ? `, ${count} in the box` : ""));
    });
    const order = [1, 0, 2];        // first can in the middle, then left, then right
    document.querySelectorAll("#slots li").forEach((li, k) => li.classList.toggle("is-filled", order.indexOf(k) < n));
    $("tray").classList.toggle("has-cans", n > 0 || S.leaving.length > 0);
    const btn = $("checkout");
    const label = n === 0 ? `Pick ${C.packSize} cans` : left > 0 ? `Pick ${left} more` : C.build.button;
    btn.innerHTML = `${esc(label)} <s>${esc(money(C.price * C.packSize))}</s> <b>${esc(money(C.packPrice))}</b>`;
    btn.classList.toggle("is-ready", left === 0);
    build.glowTo = n ? F[S.box[n - 1].i].rgb : [255, 120, 40];
    if (n && F[S.box[n - 1].i].color === "#1b1922") build.glowTo = [120, 110, 160];
  }

  function addToBox(i, from) {
    if (S.box.length >= C.packSize) {
      toast("Box full. Go to Build a box to check out.");
      bump();
      return false;
    }
    S.box.push({ i, id: S.uid++, a: 0, x: null, y: 0, rz: 0 });
    A.Sound.pop(340 + S.box.length * 90);
    const left = C.packSize - S.box.length;
    toast(left ? `${F[i].name} is in your box · ${left} to go` : `${F[i].name} is in. Box full, check out below.`);
    if (from) fly.list.push({ i, x: from.x, y: from.y, h: from.h, t: 0 });
    else bump();
    boxChanged();
    return true;
  }

  function drawFly() {
    const v = fly.v;
    if (!fly.list.length) {
      if (fly.dirty) { v.begin(); fly.dirty = false; }
      return;
    }
    if (!v.begin()) return;
    fly.dirty = true;
    const b = $("basket").getBoundingClientRect(), bx = b.left + b.width / 2, by = b.top + b.height / 2;
    fly.list = fly.list.filter((f) => {
      f.t += S.dt / 0.75;
      const e = smooth(f.t), u = 1 - e;
      const mx = lerp(f.x, bx, 0.5), my = Math.min(f.y, by) - 140;
      v.can({
        x: u * u * f.x + 2 * u * e * mx + e * e * bx, y: u * u * f.y + 2 * u * e * my + e * e * by, z: 0,
        h: lerp(f.h, 30, e), ry: e * TAU * 2, rz: -e * 0.7, rx: 0.1, label: f.i, tint: PAPER,
        alpha: f.t > 0.85 ? clamp((1 - f.t) / 0.15, 0, 1) : 1,
      });
      if (f.t >= 1) { bump(); return false; }
      return true;
    });
    v.flush();
  }

  /* ---------- 3. The shop: nine cards ---------- */
  const shop = { v: GL.view($("shopView")), cards: [] };

  function buildShop() {
    const wrapEl = $("cards");
    F.forEach((f, i) => {
      const slot = document.createElement("article");
      slot.className = "card-slot";
      slot.innerHTML =
        `<div class="card" style="--c:${f.color};--ci:${A.css(f.inkRgb)}"><h3>${f.lines.map(esc).join("<br>")}</h3>` +
        `<div class="can-spot"></div><p class="card-tag">${esc(f.tag)}</p>` +
        `<button class="add" type="button" aria-label="Add ${esc(f.name)} to your box"><span>${esc(C.shop.add)}</span><i></i></button></div>`;
      wrapEl.append(slot);
      const card = slot.firstChild, add = card.querySelector(".add");
      const c = { card, spot: card.querySelector(".can-spot"), add, k: 0, hot: false, px: 0.5, py: 0.5, ry: 0, rx: 0.06, extra: 0, at: null };
      shop.cards.push(c);
      const heat = (on) => { c.hot = on; card.classList.toggle("is-hot", on); if (!on) { card.style.removeProperty("--rx"); card.style.removeProperty("--ry"); } };
      if (hoverable) {
        card.addEventListener("pointerenter", () => heat(true));
        card.addEventListener("pointerleave", () => heat(false));
        card.addEventListener("pointermove", (e) => {
          const r = card.getBoundingClientRect();
          c.px = clamp((e.clientX - r.left) / r.width, 0, 1); c.py = clamp((e.clientY - r.top) / r.height, 0, 1);
          if (!reduced) {
            card.style.setProperty("--ry", `${((c.px - 0.5) * 14).toFixed(2)}deg`);
            card.style.setProperty("--rx", `${((0.5 - c.py) * 10).toFixed(2)}deg`);
          }
        });
      }
      add.addEventListener("focus", () => heat(true));
      add.addEventListener("blur", () => { if (!card.matches(":hover")) heat(false); });
      card.addEventListener("click", (e) => {
        if (e.target.closest(".add")) {
          if (addToBox(i, c.at)) {
            add.classList.add("is-done");
            window.setTimeout(() => add.classList.remove("is-done"), 1100);
          }
        } else {
          c.extra += TAU;            // poke the can: it spins once
          A.Sound.pop(300 + i * 30);
        }
      });
    });
  }

  function drawShop() {
    const v = shop.v;
    if (!v.begin()) return;
    const vr = v.el.getBoundingClientRect(), t = S.t, dt = S.dt, front = [];
    shop.cards.forEach((c, i) => {
      const r = c.spot.getBoundingClientRect();
      if (r.bottom < -160 || r.top > window.innerHeight + 160) return;
      const cx = r.left - vr.left + r.width / 2, cy = r.top - vr.top + r.height / 2;
      const Hc = Math.min(r.height, r.width / 0.6);
      c.k += ((c.hot ? 1 : 0) - c.k) * Math.min(1, dt * 9);
      c.ry += ((c.hot ? (c.px - 0.5) * 1.5 : Math.sin(t * 0.6 + i * 1.3) * 0.3) - c.ry) * Math.min(1, dt * 7);
      c.rx += ((c.hot ? (0.5 - c.py) * 0.55 + 0.1 : 0.06) - c.rx) * Math.min(1, dt * 7);
      c.extra *= Math.exp(-dt * 3.2);
      if (c.extra < 0.002) c.extra = 0;
      const size = Hc * (1 + 0.1 * c.k), y = cy + c.k * Hc * 0.035 + Math.sin(t * 1.2 + i) * 2;
      c.at = { x: r.left + r.width / 2, y: r.top + r.height / 2, h: size };
      shadow(v.ctx, cx, cy + Hc * 0.57, Hc * 0.34 * (1 + 0.2 * c.k), 0.32 - 0.1 * c.k);
      if (c.k > 0.02) {
        const spr = A.sprites[i], grow = back(c.k);
        for (let j = 0; j < 4; j++) {
          const ang = -2.5 + j * 1.3 + Math.sin(t * 0.8 + j) * 0.12, d = Hc * (0.4 + 0.07 * (j % 2)) * grow;
          const bit = { s: spr[j % spr.length], x: cx + Math.cos(ang) * d, y: y + Math.sin(ang) * d * 0.85, size: Hc * 0.3 * c.k, rot: ang + t * 0.6 };
          if (j % 2) front.push(bit); else A.drawSprite(v.ctx, bit.s, bit.x, bit.y, bit.size, bit.rot, 1);
        }
      }
      v.can({ x: cx, y, z: 30 * c.k, h: size, ry: c.ry + c.extra, rx: c.rx, rz: -0.05 * c.k + Math.sin(t * 0.9 + i) * 0.02, label: i, tint: PAPER });
    });
    v.flush();
    front.forEach((b) => A.drawSprite(v.ctx, b.s, b.x, b.y, b.size, b.rot, 1));
  }

  /* ---------- The builder: three cans in a glowing circle ---------- */
  const build = { v: GL.view($("buildView")), tray: $("tray"), glow: [255, 120, 40], glowTo: [255, 120, 40], glowKey: "", removes: [], H: 200 };
  const POSE = [{ x: 0, y: 0, rz: 0, z: 40 }, { x: -0.5, y: 0.03, rz: 0.19, z: 0 }, { x: 0.5, y: 0.03, rz: -0.19, z: 0 }];

  function removeAt(k) {
    const it = S.box[k];
    if (!it) return;
    S.box.splice(k, 1);
    S.leaving.push({ i: it.i, x: it.x, y: it.y, rz: it.rz, t: 0 });
    A.Sound.pop(240);
    toast(`${F[it.i].name} is out of the box`);
    boxChanged();
  }

  function buildBuilder() {
    $("buildLabel").textContent = C.build.label;
    $("buildTitle").innerHTML = C.build.title.map((l) => `<span>${esc(l)}</span>`).join("");
    $("buildHint").textContent = C.build.hint;
    $("buildFine").textContent = C.build.fine;
    $("dropText").textContent = C.build.drop;
    const picks = $("picks");
    F.forEach((f, i) => {
      const li = document.createElement("li");
      li.innerHTML = `<button type="button"><span class="sw" style="--c:${f.color}"></span><span class="ct" aria-hidden="true">0</span><span class="nm">${esc(f.name)}</span></button>`;
      li.firstChild.addEventListener("click", () => addToBox(i, null));
      picks.append(li);
    });
    for (let k = 0; k < C.packSize; k++) {
      const b = document.createElement("button");
      b.type = "button"; b.hidden = true; b.textContent = "×";
      b.addEventListener("click", () => removeAt(k));
      $("removes").append(b);
      build.removes.push({ el: b, key: "" });
    }
    $("checkout").addEventListener("click", () => {
      const left = C.packSize - S.box.length;
      if (left > 0) { toast(S.box.length ? `Pick ${left} more to fill the box` : `Pick ${C.packSize} cans first`); return; }
      const r = build.tray.getBoundingClientRect();
      S.box.forEach((it) => fly.list.push({ i: it.i, x: r.left + it.x, y: r.top + it.y, h: build.H, t: 0 }));
      S.box = [];
      S.packs += 1;
      A.Sound.fizz();
      toast(`Box added · ${S.packs * C.packSize} cans in your basket. ${C.build.fine}`);
      boxChanged();
    });
  }

  function drawBuild() {
    const v = build.v;
    if (!v.begin()) return;
    const w = v.w, h = v.h, dt = S.dt, cx = w / 2, cy = h * 0.43;
    const Hc = Math.min(h * 0.46, w * 0.4);
    build.H = Hc;
    build.glow = A.mix(build.glow, build.glowTo, Math.min(1, dt * 5));
    const gk = build.glow.map(Math.round).join(", ");
    if (gk !== build.glowKey) { build.glowKey = gk; build.tray.style.setProperty("--glow", gk); }
    const tint = [build.glow[0] / 320, build.glow[1] / 320, build.glow[2] / 320];

    for (let k = 0; k < build.removes.length; k++) {
      const it = S.box[k], rm = build.removes[k];
      if (!it) { if (!rm.el.hidden) rm.el.hidden = true; continue; }
      const p = POSE[k], tx = cx + p.x * Hc, ty = cy + p.y * Hc;
      if (it.x == null) { it.x = tx; it.y = ty; it.rz = p.rz; }
      const f = Math.min(1, dt * 8);
      it.x += (tx - it.x) * f; it.y += (ty - it.y) * f; it.rz += (p.rz - it.rz) * f;
      it.a = Math.min(1, it.a + dt / 0.6);
      const y = it.y - (1 - back(it.a)) * h * 0.5;
      shadow(v.ctx, it.x, cy + Hc * 0.57, Hc * 0.34, 0.4 * it.a);
      v.can({ x: it.x, y, z: p.z, h: Hc, ry: Math.sin(S.t * 0.7 + it.id * 2) * 0.28 + (1 - smooth(it.a)) * TAU, rx: 0.08, rz: it.rz, label: it.i, alpha: Math.min(1, it.a * 3), tint });
      const top = v.project(it.x - Math.sin(it.rz) * Hc * 0.5, y - Math.cos(it.rz) * Hc * 0.5, p.z);
      const key = `${Math.round(top.x)},${Math.round(top.y - 4)}`;
      if (key !== rm.key) { rm.key = key; rm.el.style.transform = `translate(${Math.round(top.x)}px, ${Math.round(top.y - 4)}px)`; }
      const hide = it.a < 0.75;
      if (rm.el.hidden !== hide) rm.el.hidden = hide;
      const lab = `Take ${F[it.i].name} out of the box`;
      if (rm.el.getAttribute("aria-label") !== lab) rm.el.setAttribute("aria-label", lab);
    }
    if (S.leaving.length) {
      S.leaving = S.leaving.filter((it) => {
        it.t += dt / 0.5;
        const e = it.t * it.t;
        v.can({ x: it.x + e * w * 0.35, y: it.y - e * h * 0.9, z: 60, h: Hc, ry: e * 5, rx: 0.08, rz: it.rz - e * 1.4, label: it.i, alpha: clamp(1 - it.t, 0, 1), tint });
        return it.t < 1;
      });
      if (!S.leaving.length) $("tray").classList.toggle("has-cans", S.box.length > 0);
    }
    v.flush();
  }

  /* ---------- 4. The rail: nine cans hang from hooks and swing ---------- */
  const rail = { v: GL.view($("railView")), el: $("rail"), pos: 1, vel: 0, prevPos: 1, prevV: 0, lastV: 0, acc: 0, drag: null, gap: 200, gapKey: 0, on: -1, started: false, boxes: [],
    cans: F.map(() => ({ th: 0, v: 0, spin: 0, cur: 0 })) };

  function buildRail() {
    const track = $("rulerTrack");
    F.forEach((f) => {
      const s = document.createElement("span");
      s.textContent = f.name;
      track.append(s);
    });
    const el = rail.el;
    el.addEventListener("pointerdown", (e) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      rail.drag = { id: e.pointerId, x: e.clientX, y: e.clientY, pos: rail.pos, moved: false };
    });
    el.addEventListener("pointermove", (e) => {
      const d = rail.drag;
      if (d && e.pointerId === d.id) {
        const dx = e.clientX - d.x;
        if (!d.moved && Math.abs(dx) > 6 && Math.abs(dx) > Math.abs(e.clientY - d.y)) {
          d.moved = true; el.classList.add("is-drag");
          try { el.setPointerCapture(d.id); } catch (_) { /* fine without it */ }
        }
        if (d.moved) {
          let p = d.pos - dx / rail.gap;
          if (p < 0) p *= 0.35;
          if (p > N - 1) p = N - 1 + (p - (N - 1)) * 0.35;
          rail.pos = p; rail.vel = 0;
        }
        return;
      }
      // Not dragging: the cursor pushes the cans it passes through.
      const r = el.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
      rail.boxes.forEach((b) => {
        if (Math.abs(x - b.x) < b.w / 2 && Math.abs(y - b.y) < b.h / 2) rail.cans[b.i].v += clamp(e.movementX || 0, -30, 30) * 0.03;
      });
    });
    const up = (e) => {
      const d = rail.drag;
      if (!d || e.pointerId !== d.id) return;
      rail.drag = null; el.classList.remove("is-drag");
      if (d.moved) { rail.vel = clamp(rail.lastV, -12, 12); return; }
      if (e.type !== "pointerup") return;
      const r = el.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
      const hit = rail.boxes.find((b) => Math.abs(x - b.x) < b.w / 2 && Math.abs(y - b.y) < b.h / 2);
      if (hit) { rail.cans[hit.i].spin += TAU; rail.cans[hit.i].v += 1.2; A.Sound.pop(560); }
    };
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    el.addEventListener("wheel", (e) => {
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
      e.preventDefault();
      rail.pos = clamp(rail.pos + e.deltaX / rail.gap, -0.3, N - 0.7);
    }, { passive: false });
    el.addEventListener("keydown", (e) => {
      if (e.key === "ArrowRight") { rail.vel += 2.8; e.preventDefault(); }
      if (e.key === "ArrowLeft") { rail.vel -= 2.8; e.preventDefault(); }
    });
  }

  function drawRail() {
    const v = rail.v;
    if (!v.begin()) return;
    const w = v.w, h = v.h, dt = S.dt, t = S.t;
    const H = clamp(h * 0.56, 180, 340), gap = H * 0.84, y0 = h * 0.09, L = H * 0.64;
    rail.gap = gap;
    if (!rail.started) { rail.started = true; if (!reduced) rail.vel = 1.5; }

    if (!rail.drag || !rail.drag.moved) {
      rail.pos += rail.vel * dt;
      rail.vel *= Math.exp(-dt * 2.6);
      const over = rail.pos < 0 ? -rail.pos : rail.pos > N - 1 ? N - 1 - rail.pos : 0;
      if (over) { rail.vel += over * 60 * dt; rail.vel *= Math.exp(-dt * 8); }
    }
    const vNow = (rail.pos - rail.prevPos) / dt;
    rail.acc += (clamp((vNow - rail.prevV) / dt, -70, 70) - rail.acc) * 0.35;
    rail.prevPos = rail.pos; rail.prevV = vNow; rail.lastV = vNow;

    const ctx = v.ctx;
    ctx.fillStyle = "#151312";
    ctx.fillRect(0, y0 - 1.5, w, 3);
    rail.boxes.length = 0;
    for (let i = 0; i < N; i++) {
      const c = rail.cans[i];
      if (reduced) { c.th = 0; c.v = 0; c.cur = c.spin; }
      else {
        c.v += (-42 * c.th - 3.2 * c.v + rail.acc * gap * 0.0035) * dt;
        c.th = clamp(c.th + c.v * dt, -1, 1);
        c.cur += (c.spin - c.cur) * Math.min(1, dt * 4.5);
      }
      const px = w / 2 + (i - rail.pos) * gap;
      if (px < -gap || px > w + gap) continue;
      const sn = Math.sin(c.th), cs = Math.cos(c.th);
      const x = px + sn * L, y = y0 + cs * L;
      ctx.strokeStyle = "#151312"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(px, y0); ctx.lineTo(px + sn * (L - H * 0.5), y0 + cs * (L - H * 0.5)); ctx.stroke();
      ctx.beginPath(); ctx.arc(px, y0, 5, 0, TAU); ctx.fill();
      v.can({ x, y, z: 0, h: H, ry: c.cur + Math.sin(t * 0.5 + i) * 0.18, rx: 0.05, rz: c.th, label: i, tint: PAPER });
      rail.boxes.push({ i, x, y, w: H * GL.WIDTH, h: H });
    }
    v.flush();

    // The ruler under the rail moves with it.
    const ruler = $("ruler"), cam = rail.pos * gap;
    ruler.style.setProperty("--cam", `${(-cam).toFixed(1)}px`);
    $("rulerTrack").style.transform = `translateX(${(-cam).toFixed(1)}px)`;
    if (Math.round(gap) !== rail.gapKey) {
      rail.gapKey = Math.round(gap);
      Array.from($("rulerTrack").children).forEach((s, i) => { s.style.left = `${Math.round(i * gap)}px`; });
    }
    const on = clamp(Math.round(rail.pos), 0, N - 1);
    if (on !== rail.on) {
      rail.on = on;
      Array.from($("rulerTrack").children).forEach((s, i) => s.classList.toggle("is-on", i === on));
    }
  }

  /* ---------- 5. Questions ---------- */
  function buildFaq() {
    $("faqTitle").textContent = C.faq.title;
    $("faqText").textContent = C.faq.text;
    const qa = $("qa");
    C.faq.items.forEach((item, k) => {
      const el = document.createElement("div");
      el.className = "q";
      el.innerHTML =
        `<h3><button type="button" aria-expanded="false" aria-controls="a${k}" id="q${k}">${esc(item.q)}<i aria-hidden="true"></i></button></h3>` +
        `<div class="a" id="a${k}" role="region" aria-labelledby="q${k}"><div><p>${esc(item.a)}</p></div></div>`;
      const btn = el.querySelector("button");
      btn.addEventListener("click", () => {
        const open = !el.classList.contains("is-open");
        qa.querySelectorAll(".q").forEach((q) => { q.classList.remove("is-open"); q.querySelector("button").setAttribute("aria-expanded", "false"); });
        el.classList.toggle("is-open", open);
        btn.setAttribute("aria-expanded", String(open));
        if (open) A.Sound.pop(300);
      });
      qa.append(el);
    });
  }

  /* ---------- 6. Sign up: a can drops in as you arrive ---------- */
  const join = { v: GL.view($("joinView")), el: $("join"), bits: field(14, 21) };

  function drawJoin() {
    const v = join.v;
    if (!v.begin()) return;
    const w = v.w, h = v.h, t = S.t, phone = w < 760;
    const r = join.el.getBoundingClientRect();
    const q = clamp((window.innerHeight - r.top) / (window.innerHeight + r.height * 0.4), 0, 1);
    const H = phone ? Math.min(h * 0.4, w * 0.8) : Math.min(h * 0.72, w * 0.44);
    const x = phone ? w * 0.68 : w * 0.74;
    const y = lerp(-H * 0.7, phone ? h * 0.76 : h * 0.52, reduced ? 1 : back(q * 1.2)) + Math.sin(t) * 8;
    drawBits(v, join.bits, S.cur, false, H * 0.12, 0.9);
    v.can({ x, y, z: 0, h: H, ry: t * 0.5 + q * 5 + mouse.x * 0.4, rx: 0.12 - mouse.y * 0.16, rz: lerp(1.0, -0.22, smooth(q * 1.25)), label: S.cur, tint: S.tint });
    v.flush();
    drawBits(v, join.bits, S.cur, true, H * 0.12, 0.95);
  }

  function buildJoin() {
    $("joinTitle").textContent = C.join.title;
    $("joinText").textContent = C.join.text;
    $("joinLabel").textContent = C.join.field;
    $("joinEmail").placeholder = C.join.placeholder;
    $("joinButton").textContent = C.join.button;
    $("joinForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const input = $("joinEmail"), good = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(input.value.trim());
      input.setAttribute("aria-invalid", String(!good));
      $("joinMsg").textContent = good ? C.join.done : C.join.error;
      if (good) { input.value = ""; A.Sound.fizz(); toast("You are in. Stay fizzy."); }
      else input.focus();
    });
  }

  /* ---------- Words that are the same on every visit ---------- */
  function fillWords() {
    const initial = C.brand.charAt(0).toLowerCase();
    $("logoDisc").textContent = initial; $("footDisc").textContent = initial;
    $("logo").setAttribute("aria-label", `${C.brand}, back to the top`);
    $("brandName").textContent = C.brand; $("brandSub").textContent = C.sub;
    $("cta").textContent = C.join.cta;
    $("introWord").textContent = C.brand.toLowerCase();
    $("introSkip").textContent = `${C.intro.skip} →`;
    $("introNote").textContent = C.intro.note;
    $("autoplayText").textContent = C.hero.autoplay;
    $("flavHint").textContent = C.hero.hint;
    $("flavName").setAttribute("aria-live", S.auto ? "off" : "polite");
    $("autoplay").setAttribute("aria-pressed", String(S.auto));
    $("shopTitle").textContent = C.shop.title; $("shopHint").textContent = C.shop.hint;
    $("rangeTitle").textContent = C.range.title; $("rangeHint").textContent = C.range.hint;
    $("rangeDrag").textContent = `${C.range.drag} ↔`;
    $("shout").innerHTML = Array.from({ length: 8 }, () => `<span>${esc(C.footer.shout)} —</span>`).join("");
    $("footBrand").textContent = `${C.brand} ${C.sub} · ${C.city}`;
    $("footNote").textContent = C.footer.note;
    const mail = $("footMail");
    mail.textContent = C.email; mail.href = `mailto:${C.email}`;
    $("footFollow").innerHTML = C.footer.follow.map((s) => `<span>${esc(s)}</span>`).join("");
    $("sound").addEventListener("click", () => {
      const on = !A.Sound.on;
      A.Sound.set(on);
      $("sound").setAttribute("aria-pressed", String(on));
      $("soundText").textContent = on ? "on" : "off";
      if (on) A.Sound.pop(440);
    });
  }

  /* ---------- The opening ---------- */
  function runIntro(progress, prepare, skip) {
    return new Promise((done) => {
      const el = $("intro");
      const finish = () => { el.remove(); done(); };
      if (skip) { prepare.then(finish, finish); return; }

      const cv = $("introView"), ctx = cv.getContext("2d"), disc = $("introDisc"), word = $("introWord"), count = $("introCount");
      let prepared = false, wantSkip = false, phase = 0, pt = 0, shown = 0, last = performance.now();
      const t0 = last;
      prepare.then(() => { prepared = true; }, () => { prepared = true; });
      $("introSkip").addEventListener("click", () => { wantSkip = true; });
      let seed = 99;
      const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
      const P = Array.from({ length: 64 }, (_, k) => ({ a: rnd() * TAU, d0: rnd(), sp: 0.16 + rnd() * 0.3, z: 0.5 + rnd() * 0.8, fi: Math.floor(rnd() * N), k: Math.floor(rnd() * 3), rot: rnd() * TAU, vr: (rnd() - 0.5) * 3, bub: k % 4 === 3 }));

      const loop = (now) => {
        const t = (now - t0) / 1000, dt = Math.min(0.05, (now - last) / 1000);
        last = now; pt += dt;
        const w = el.clientWidth, h = el.clientHeight, dpr = Math.min(window.devicePixelRatio || 1, 1.5);
        if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, w, h);

        const pct = Math.min(progress() * 100, (t / 2.2) * 100, 100);
        shown += (pct - shown) * 0.2;
        count.textContent = String(Math.round(shown)).padStart(3, "0");

        if (phase === 0 && prepared && (t > 2.4 || wantSkip)) {
          phase = wantSkip ? 3 : 1; pt = 0;
          if (phase === 3) el.classList.add("is-opening");
        } else if (phase === 1 && pt > 0.6) { phase = 2; pt = 0; }
        else if (phase === 2 && pt > 0.55) { phase = 3; pt = 0; el.classList.add("is-opening"); }

        // Fruit and bubbles fly out from the middle, towards you. Then they are pulled back in.
        const g = phase === 0 ? 0 : phase === 1 ? smooth(pt / 0.6) : 1;
        const maxR = Math.hypot(w, h) * 0.62;
        if (g < 1) {
          P.forEach((p) => {
            const dist = (p.d0 + t * p.sp) % 1, rad = Math.pow(dist, 1.5) * maxR * (1 - g);
            const x = w / 2 + Math.cos(p.a) * rad, y = h / 2 + Math.sin(p.a) * rad * 0.8;
            const size = (18 + 170 * dist * dist) * p.z * (1 - g * 0.85), alpha = Math.min(1, dist * 6) * (1 - g * 0.3);
            if (p.bub) A.bubble(ctx, x, y, size * 0.22, alpha);
            else { const spr = A.sprites[p.fi]; A.drawSprite(ctx, spr[p.k % spr.length], x, y, size, p.rot + t * p.vr, alpha); }
          });
        }

        if (phase === 1) disc.style.transform = `scale(${back(pt / 0.6).toFixed(3)})`;
        else if (phase === 2) disc.style.transform = `scale(${(1 + Math.sin(pt * 6) * 0.02).toFixed(3)})`;
        else if (phase === 3) {
          const cover = (Math.hypot(w, h) / 190) * 1.1, e = smooth(pt / 0.7);
          disc.style.transform = `scale(${(1 + e * e * cover).toFixed(3)})`;
          word.style.opacity = String(clamp(1 - pt / 0.25, 0, 1));
          if (pt > 0.7) el.style.opacity = String(clamp(1 - (pt - 0.7) / 0.3, 0, 1));
          if (pt > 1.0) { finish(); return; }
        }
        window.requestAnimationFrame(loop);
      };
      window.requestAnimationFrame(loop);
    });
  }

  /* ---------- Every frame ---------- */
  function frame(now) {
    const t = now / 1000;
    S.dt = clamp(t - S.t, 0.001, 0.05);
    S.t = t;
    mouse.x += (mouse.tx - mouse.x) * Math.min(1, S.dt * 5);
    mouse.y += (mouse.ty - mouse.y) * Math.min(1, S.dt * 5);
    stepCarousel();
    paint();
    chrome();
    if (S.live) {
      if (vis.flavours) drawHero();
      if (vis.inside) drawInside();
      if (vis.cardsWrap) drawShop();
      if (vis.build) drawBuild();
      if (vis.rail) drawRail();
      if (vis.join) drawJoin();
      drawFly();
    }
    window.requestAnimationFrame(frame);
  }

  async function boot() {
    fillWords();
    buildInside();
    buildShop();
    buildBuilder();
    buildRail();
    buildFaq();
    buildJoin();
    showFlavour();
    boxChanged();
    paint();

    const io = new IntersectionObserver((list) => list.forEach((e) => { vis[e.target.id] = e.isIntersecting; }), { rootMargin: "140px 0px" });
    ["flavours", "inside", "cardsWrap", "build", "rail", "join"].forEach((id) => io.observe($(id)));

    let loaded = 0;
    const wait = (ms) => new Promise((r) => window.setTimeout(r, ms));
    const prepare = (async () => {
      const fonts = document.fonts
        ? Promise.all(['900 48px "Unbounded"', '400 48px "Anton"', '500 20px "DM Mono"'].map((f) => document.fonts.load(f))).catch(() => null)
        : Promise.resolve();
      await Promise.race([fonts, wait(2500)]);
      loaded++;
      await A.loadBits();
      loaded++;
      const small = window.innerWidth < 760 || (navigator.deviceMemory && navigator.deviceMemory <= 4);
      for (let i = 0; i < N; i++) {
        GL.setLabel(i, A.label(i, small ? 1024 : 2048));
        loaded++;
        await wait(0);
      }
      S.live = true;
    })();

    window.requestAnimationFrame(frame);
    await runIntro(() => loaded / (N + 2), prepare, reduced || params.has("nointro"));
    S.ready = true;
    document.body.classList.remove("is-loading");
  }

  window.__fizzo = { S, F, step, selectFlavour, addToBox, removeAt, rail, hero, inside, shop, build, fly };
  boot();
})();
