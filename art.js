/* Fizzo: everything that is drawn or played without a picture file.
 * Colours, the fruit pieces, the label that is wrapped round each can, and the sounds. */
(() => {
  "use strict";

  const C = window.FIZZO, F = C.flavours;
  const TAU = Math.PI * 2;

  const hex = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const css = (c, a) => (a == null ? `rgb(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])})` : `rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${a})`);
  const WHITE = [255, 255, 255], BLACK = [0, 0, 0];
  const INK = { light: WHITE, dark: [26, 18, 8] };

  F.forEach((f) => {
    f.rgb = hex(f.color);
    f.inkRgb = INK[f.ink] || WHITE;
    const lum = (0.3 * f.rgb[0] + 0.59 * f.rgb[1] + 0.11 * f.rgb[2]) / 255;
    // The can is a shade away from the page, so it stands out on its own colour.
    f.canRgb = lum < 0.18 ? mix(f.rgb, WHITE, 0.09) : mix(f.rgb, BLACK, 0.1);
    f.lines = f.name.split(" ").length > 1 ? [f.name.split(" ")[0], f.name.split(" ").slice(1).join(" ")] : [f.name];
  });

  const canvas = (w, h) => { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; };

  /* ---------- Fruit pieces drawn by hand, used until real pictures are in assets/bits ---------- */
  function shape(kind, a, b) {
    const c = canvas(200, 200), x = c.getContext("2d");
    const A = hex(a), B = b ? hex(b) : mix(A, WHITE, 0.5);
    x.translate(100, 100);
    if (kind === "wheel") {
      x.fillStyle = css(A); x.beginPath(); x.arc(0, 0, 94, 0, TAU); x.fill();
      x.fillStyle = css(mix(B, WHITE, 0.55)); x.beginPath(); x.arc(0, 0, 84, 0, TAU); x.fill();
      x.fillStyle = css(B);
      for (let i = 0; i < 9; i++) {
        const a0 = (i / 9) * TAU + 0.07, a1 = ((i + 1) / 9) * TAU - 0.07;
        x.beginPath(); x.moveTo(Math.cos((a0 + a1) / 2) * 10, Math.sin((a0 + a1) / 2) * 10);
        x.arc(0, 0, 76, a0, a1); x.closePath(); x.fill();
      }
      x.strokeStyle = "rgba(255,255,255,0.5)"; x.lineWidth = 5; x.lineCap = "round";
      x.beginPath(); x.arc(0, 0, 66, 3.5, 4.6); x.stroke();
    } else if (kind === "berry") {
      const g = x.createRadialGradient(-28, -34, 6, 0, 0, 92);
      g.addColorStop(0, css(mix(A, WHITE, 0.55))); g.addColorStop(0.45, css(A)); g.addColorStop(1, css(mix(A, BLACK, 0.4)));
      x.fillStyle = g; x.beginPath(); x.arc(0, 4, 86, 0, TAU); x.fill();
      x.fillStyle = "rgba(255,255,255,0.6)"; x.beginPath(); x.ellipse(-30, -36, 18, 10, -0.6, 0, TAU); x.fill();
      x.strokeStyle = "#3d2a12"; x.lineWidth = 7; x.lineCap = "round";
      x.beginPath(); x.moveTo(0, -80); x.quadraticCurveTo(6, -92, 16, -96); x.stroke();
    } else if (kind === "leaf") {
      const g = x.createLinearGradient(-80, 30, 80, -30);
      g.addColorStop(0, css(mix(A, BLACK, 0.25))); g.addColorStop(1, css(mix(A, WHITE, 0.25)));
      x.fillStyle = g; x.beginPath(); x.moveTo(-92, 34);
      x.bezierCurveTo(-46, -62, 40, -74, 92, -34); x.bezierCurveTo(52, 44, -30, 72, -92, 34); x.fill();
      x.strokeStyle = "rgba(255,255,255,0.45)"; x.lineWidth = 4; x.lineCap = "round";
      x.beginPath(); x.moveTo(-84, 30); x.quadraticCurveTo(0, -6, 84, -32); x.stroke();
    } else if (kind === "chilli") {
      const g = x.createLinearGradient(0, -60, 0, 60);
      g.addColorStop(0, css(mix(A, WHITE, 0.28))); g.addColorStop(1, css(mix(A, BLACK, 0.25)));
      x.fillStyle = g; x.beginPath(); x.moveTo(-74, -40);
      x.bezierCurveTo(-30, -62, 50, -30, 92, 46); x.bezierCurveTo(30, 20, -30, 8, -80, -6);
      x.bezierCurveTo(-92, -14, -88, -34, -74, -40); x.fill();
      x.strokeStyle = "#2f8f3a"; x.lineWidth = 11; x.lineCap = "round";
      x.beginPath(); x.moveTo(-78, -24); x.quadraticCurveTo(-92, -40, -84, -62); x.stroke();
      x.strokeStyle = "rgba(255,255,255,0.4)"; x.lineWidth = 5;
      x.beginPath(); x.moveTo(-50, -36); x.quadraticCurveTo(10, -30, 52, 8); x.stroke();
    } else {
      // cube: a piece of ice
      x.rotate(0.22);
      const g = x.createLinearGradient(-70, -70, 70, 70);
      g.addColorStop(0, "rgba(255,255,255,0.95)"); g.addColorStop(0.5, css(A, 0.72)); g.addColorStop(1, "rgba(255,255,255,0.85)");
      x.fillStyle = g; x.strokeStyle = "rgba(255,255,255,0.95)"; x.lineWidth = 6;
      const r = 26, s = 70;
      x.beginPath(); x.moveTo(-s + r, -s); x.lineTo(s - r, -s); x.quadraticCurveTo(s, -s, s, -s + r);
      x.lineTo(s, s - r); x.quadraticCurveTo(s, s, s - r, s); x.lineTo(-s + r, s);
      x.quadraticCurveTo(-s, s, -s, s - r); x.lineTo(-s, -s + r); x.quadraticCurveTo(-s, -s, -s + r, -s); x.fill(); x.stroke();
      x.strokeStyle = "rgba(255,255,255,0.8)"; x.lineWidth = 7; x.lineCap = "round";
      x.beginPath(); x.moveTo(-44, -30); x.lineTo(-44, -48); x.lineTo(-22, -48); x.stroke();
    }
    return c;
  }

  // sprites[flavour index] is a list of things that can be drawn: real cut-outs or hand-drawn shapes.
  const sprites = F.map((f) => f.shapes.map((s) => shape(s[0], s[1], s[2])));

  // Real fruit cut-outs: assets/bits/manifest.json says how many each flavour has,
  // for example { "mango": 4 } means mango-1.webp ... mango-4.webp.
  async function loadBits() {
    let list = null;
    try {
      const r = await fetch("assets/bits/manifest.json", { cache: "no-store" });
      if (r.ok) list = await r.json();
    } catch (_) { list = null; }
    if (!list) return;
    await Promise.all(F.map((f, i) => {
      const n = list[f.file] || 0;
      if (!n) return null;
      return Promise.all(Array.from({ length: n }, (_, k) => new Promise((done) => {
        const img = new Image();
        img.onload = () => done(img);
        img.onerror = () => done(null);
        img.src = `assets/bits/${f.file}-${k + 1}.webp`;
      }))).then((imgs) => {
        const good = imgs.filter(Boolean);
        if (good.length) sprites[i] = good;
      });
    }));
  }

  function drawSprite(ctx, spr, x, y, size, rot, alpha) {
    if (!spr || size < 1) return;
    const k = size / Math.max(spr.width, spr.height);
    ctx.save();
    if (alpha != null) ctx.globalAlpha = alpha;
    ctx.translate(x, y);
    if (rot) ctx.rotate(rot);
    ctx.drawImage(spr, (-spr.width * k) / 2, (-spr.height * k) / 2, spr.width * k, spr.height * k);
    ctx.restore();
  }

  function bubble(ctx, x, y, r, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = "rgba(255,255,255,0.85)"; ctx.lineWidth = Math.max(1, r * 0.14);
    ctx.fillStyle = "rgba(255,255,255,0.1)";
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.beginPath(); ctx.arc(x - r * 0.35, y - r * 0.35, r * 0.2, 0, TAU); ctx.fill();
    ctx.restore();
  }

  /* ---------- The label wrapped round a can ---------- */
  function fitText(x, text, maxW) {
    const w = x.measureText(text).width;
    return w > maxW ? maxW / w : 1;
  }

  function label(i, W) {
    const f = F[i], H = W / 2, c = canvas(W, H), x = c.getContext("2d");
    const LW = H * 2.125;                 // drawn a little wide, so shapes stay round on the can
    const u = H / 1024, cx = LW / 2;
    const ink = css(f.inkRgb), spr = sprites[i];
    x.scale(W / LW, 1);

    x.fillStyle = css(f.canRgb); x.fillRect(0, 0, LW, H);
    const shade = x.createLinearGradient(0, 0, 0, H);
    shade.addColorStop(0, "rgba(255,255,255,0.1)"); shade.addColorStop(0.5, "rgba(255,255,255,0)"); shade.addColorStop(1, "rgba(0,0,0,0.2)");
    x.fillStyle = shade; x.fillRect(0, 0, LW, H);

    // Rings, like the rings behind the cans on the page.
    for (let k = 7; k >= 1; k--) {
      x.fillStyle = k % 2 ? "rgba(255,255,255,0.075)" : "rgba(0,0,0,0.085)";
      x.beginPath(); x.arc(cx, 560 * u, k * 128 * u, 0, TAU); x.fill();
    }

    // Brand.
    x.fillStyle = ink; x.textAlign = "center"; x.textBaseline = "alphabetic";
    x.font = `900 ${150 * u}px Unbounded, "Arial Black", sans-serif`;
    const word = C.brand.toLowerCase();
    let k = fitText(x, word, 560 * u);
    x.save(); x.translate(cx, 222 * u); x.scale(k, k); x.fillText(word, 0, 0); x.restore();
    x.font = `500 ${25 * u}px "DM Mono", monospace`;
    if ("letterSpacing" in x) x.letterSpacing = `${5 * u}px`;
    x.fillText(`${C.sub} · ${C.city}`.toUpperCase(), cx, 268 * u);
    if ("letterSpacing" in x) x.letterSpacing = "0px";

    // Fruit.
    x.save();
    x.shadowColor = "rgba(0,0,0,0.3)"; x.shadowBlur = 26 * u; x.shadowOffsetY = 14 * u;
    drawSprite(x, spr[1 % spr.length], cx - 196 * u, 640 * u, 210 * u, 0.5);
    drawSprite(x, spr[2 % spr.length], cx + 204 * u, 470 * u, 190 * u, -0.6);
    drawSprite(x, spr[0], cx, 560 * u, 340 * u, -0.18);
    drawSprite(x, spr[spr.length > 3 ? 3 : 0], cx + 168 * u, 690 * u, 130 * u, 0.9);
    x.restore();

    // Flavour name.
    x.fillStyle = ink;
    x.font = `400 ${92 * u}px Anton, Impact, sans-serif`;
    const lines = f.lines.map((s) => s.toUpperCase());
    lines.forEach((line, n) => {
      const y = (lines.length > 1 ? 868 : 915) * u + n * 88 * u;
      k = fitText(x, line, 540 * u);
      x.save(); x.translate(cx, y); x.scale(k, 1); x.fillText(line, 0, 0); x.restore();
    });

    // The two sides: the name again, standing on end.
    [cx - LW * 0.25, cx + LW * 0.25].forEach((sx, n) => {
      x.save(); x.translate(sx, H / 2); x.rotate(n ? Math.PI / 2 : -Math.PI / 2);
      x.font = `900 ${104 * u}px Unbounded, "Arial Black", sans-serif`;
      x.lineWidth = 3 * u; x.strokeStyle = css(f.inkRgb, 0.6);
      const name = f.name.toUpperCase();
      k = fitText(x, name, 860 * u);
      x.save(); x.scale(k, k); x.strokeText(name, 0, 20 * u); x.restore();
      x.font = `500 ${24 * u}px "DM Mono", monospace`; x.fillStyle = css(f.inkRgb, 0.8);
      x.fillText("REAL FRUIT  ·  FINE FIZZ  ·  330 ML", 0, 96 * u);
      x.restore();
    });

    // The back: what is in it. Drawn at both ends, because the back is where the label joins.
    [0, LW].forEach((bx) => {
      const w = 430 * u, h = 640 * u, x0 = bx - w / 2, y0 = 190 * u, r = 26 * u;
      x.fillStyle = "#fffdf7";
      x.beginPath(); x.moveTo(x0 + r, y0); x.lineTo(x0 + w - r, y0); x.quadraticCurveTo(x0 + w, y0, x0 + w, y0 + r);
      x.lineTo(x0 + w, y0 + h - r); x.quadraticCurveTo(x0 + w, y0 + h, x0 + w - r, y0 + h); x.lineTo(x0 + r, y0 + h);
      x.quadraticCurveTo(x0, y0 + h, x0, y0 + h - r); x.lineTo(x0, y0 + r); x.quadraticCurveTo(x0, y0, x0 + r, y0); x.fill();
      x.fillStyle = "#16130f"; x.textAlign = "left";
      x.font = `400 ${58 * u}px Anton, Impact, sans-serif`;
      x.fillText("WHAT'S INSIDE", x0 + 30 * u, y0 + 82 * u);
      x.fillRect(x0 + 30 * u, y0 + 100 * u, w - 60 * u, 7 * u);
      x.font = `500 ${25 * u}px "DM Mono", monospace`;
      [["Per 100 ml", ""], ["Energy", "28 kcal"], ["Sugar", "6.8 g"], ["Real fruit", "12 %"], ["Salt", "0.05 g"], ["Colours added", "none"]].forEach((row, n) => {
        const y = y0 + 152 * u + n * 48 * u;
        x.textAlign = "left"; x.fillText(row[0], x0 + 30 * u, y);
        x.textAlign = "right"; x.fillText(row[1], x0 + w - 30 * u, y);
        x.fillRect(x0 + 30 * u, y + 14 * u, w - 60 * u, 1.5 * u);
      });
      // A barcode that reads nothing.
      let px = x0 + 30 * u, seed = 7 + i;
      while (px < x0 + w - 40 * u) {
        seed = (seed * 16807) % 2147483647;
        const bw = (2 + (seed % 4) * 2) * u;
        x.fillRect(px, y0 + h - 190 * u, bw, 110 * u);
        px += bw + (3 + (seed % 3) * 2) * u;
      }
      x.textAlign = "left"; x.font = `500 ${19 * u}px "DM Mono", monospace`;
      x.fillText(`${C.brand} ${C.sub}, ${C.city}. Demo can.`, x0 + 30 * u, y0 + h - 44 * u);
      x.textAlign = "center";
    });
    return c;
  }

  /* ---------- Sounds, made on the spot. Off until the visitor turns them on. ---------- */
  const Sound = {
    on: false,
    ctx: null,
    set(on) {
      this.on = on;
      if (on && !this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (AC) this.ctx = new AC();
      }
      if (on && this.ctx && this.ctx.state === "suspended") this.ctx.resume();
    },
    pop(base) {
      if (!this.on || !this.ctx) return;
      const a = this.ctx, t = a.currentTime, o = a.createOscillator(), g = a.createGain();
      o.type = "sine";
      o.frequency.setValueAtTime(base || 380, t);
      o.frequency.exponentialRampToValueAtTime((base || 380) * 2.2, t + 0.08);
      g.gain.setValueAtTime(0.16, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
      o.connect(g).connect(a.destination); o.start(t); o.stop(t + 0.18);
    },
    fizz() {
      if (!this.on || !this.ctx) return;
      const a = this.ctx, t = a.currentTime, len = Math.floor(a.sampleRate * 0.6);
      const buf = a.createBuffer(1, len, a.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const s = a.createBufferSource(), hp = a.createBiquadFilter(), g = a.createGain();
      s.buffer = buf; hp.type = "highpass"; hp.frequency.value = 3800;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.12, t + 0.04);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
      s.connect(hp).connect(g).connect(a.destination); s.start(t);
    },
  };

  window.Art = { hex, mix, css, sprites, loadBits, drawSprite, bubble, label, Sound, WHITE, BLACK };
})();
