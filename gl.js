/* Fizzo: a small 3D engine that draws drink cans. Plain WebGL, no library.
 *
 * One hidden WebGL canvas does all the 3D drawing. Each part of the page has its own
 * ordinary 2D canvas (a "view"). Every frame a view queues the cans it wants, the engine
 * draws them in 3D and copies the result into the view. So the page can also draw flat
 * things (shadows, fruit, bubbles) behind and in front of the cans.
 *
 * Positions are in CSS pixels inside the view: x to the right, y down, z towards you.
 * A can at z = 0 with h = 300 is 300 pixels tall on screen.
 */
(() => {
  "use strict";

  const TAU = Math.PI * 2;
  const FOV = (28 * Math.PI) / 180;
  const CAM = 0.5 / Math.tan(FOV / 2);      // camera distance, as a multiple of the view height
  const Y0 = -0.428, Y1 = 0.4;              // the printed part of the can (the can is 1 unit tall)
  const WIDTH = 0.56;                       // can width as a share of its height
  const SEG = 72;
  const MAX_PIXELS = 2.4e6;

  // The outline of half a can, bottom to top: [radius, height].
  const PROFILE = [
    [0.0, -0.452], [0.12, -0.458], [0.18, -0.476], [0.205, -0.5], [0.226, -0.497],
    [0.262, -0.462], [0.28, Y0], [0.28, Y0 + 0.008],
    [0.28, Y1 - 0.008], [0.28, Y1],
    [0.272, 0.428], [0.25, 0.462], [0.238, 0.476], [0.236, 0.486],
    [0.243, 0.493], [0.243, 0.498], [0.236, 0.5], [0.229, 0.497], [0.226, 0.486],
  ];

  const VERT = `
    attribute vec3 aPos; attribute vec3 aNor; attribute vec2 aUv; attribute float aKind;
    uniform mat4 uP; uniform mat4 uMV; uniform mat3 uR;
    varying vec3 vN; varying vec3 vV; varying vec3 vT; varying vec2 vUv; varying float vY; varying float vKind;
    void main() {
      vec4 p = uMV * vec4(aPos, 1.0);
      vV = p.xyz;
      vN = uR * aNor;
      vec3 t = vec3(aNor.z, 0.0, -aNor.x);
      vT = uR * (t / max(length(t), 0.0001));
      vUv = aUv; vY = aPos.y; vKind = aKind;
      gl_Position = uP * p;
    }`;

  const FRAG = `
    #ifdef GL_FRAGMENT_PRECISION_HIGH
    precision highp float;
    #else
    precision mediump float;
    #endif
    uniform sampler2D uLabel; uniform sampler2D uLid; uniform sampler2D uDrops;
    uniform float uAlpha; uniform float uWet; uniform vec3 uTint; uniform vec3 uUp;
    varying vec3 vN; varying vec3 vV; varying vec3 vT; varying vec2 vUv; varying float vY; varying float vKind;
    const float Y0 = ${Y0.toFixed(3)}; const float Y1 = ${Y1.toFixed(3)};

    // A photo studio made of maths: a wide soft light on the left, a thin strip on the
    // right, two lights behind, a pale ceiling and a floor in the drink's colour.
    vec3 env(vec3 d) {
      float az = atan(d.x, d.z + 0.00001);
      float band = 1.0 - smoothstep(0.35, 0.95, abs(d.y));
      float key = 1.0 - smoothstep(0.0, 0.62, abs(az + 0.95));
      float rim = 1.0 - smoothstep(0.0, 0.17, abs(az - 1.3));
      float back = 1.0 - smoothstep(0.0, 0.5, abs(abs(az) - 2.75));
      float sky = smoothstep(0.15, 1.0, d.y);
      float flo = 1.0 - smoothstep(-0.9, -0.05, d.y);
      vec3 c = vec3(0.05);
      c += vec3(1.0, 0.97, 0.93) * key * key * band * 1.1;
      c += vec3(0.93, 0.97, 1.0) * rim * band * 1.5;
      c += vec3(1.0) * back * band * 0.55;
      c += vec3(1.0) * sky * 0.5;
      c += uTint * flo * 0.5;
      return c;
    }

    void main() {
      vec3 n = normalize(vN);
      vec3 v = normalize(vV);
      vec3 col;
      if (vKind > 0.5) {
        vec3 t = texture2D(uLid, vUv).rgb;
        col = t * (0.25 + env(reflect(v, n)) * 0.95);
      } else {
        float lab = smoothstep(Y0 - 0.004, Y0 + 0.004, vY) * (1.0 - smoothstep(Y1 - 0.004, Y1 + 0.004, vY));
        vec2 uv = vec2(vUv.x, clamp((vY - Y0) / (Y1 - Y0), 0.0, 1.0));
        vec3 alb = texture2D(uLabel, uv).rgb;
        vec4 d = texture2D(uDrops, vec2(vUv.x * 2.0, uv.y * 0.95));
        float wet = d.a * uWet * lab;
        vec2 g = d.xy * 2.0 - 1.0;
        vec3 e = env(reflect(v, n));
        float ndv = clamp(dot(n, -v), 0.0, 1.0);
        float fres = pow(1.0 - ndv, 3.0);
        vec3 L = normalize(vec3(-0.45, 0.6, 0.66));
        float diff = clamp(dot(n, L), 0.0, 1.0);
        vec3 printed = alb * (0.62 + 0.5 * diff) + alb * e * 0.5 + e * (0.03 + 0.45 * fres);
        vec3 alu = vec3(0.8, 0.82, 0.86) * (e * 1.05 + 0.1);
        col = mix(alu, printed, lab);
        // Water drops are clear: they brighten the print like a lens, carry a sharp glint
        // and have a thin dark edge.
        vec3 nd = normalize(n + (vT * g.x + uUp * g.y) * 1.3 * wet);
        vec3 h = normalize(L - v);
        float glint = pow(clamp(dot(nd, h), 0.0, 1.0), 60.0);
        col = mix(col, col * 1.1 + env(reflect(v, nd)) * 0.16, wet);
        col *= 1.0 - wet * smoothstep(0.5, 1.0, length(g)) * 0.3;
        col += wet * glint * 1.1;
        col *= mix(0.66, 1.0, smoothstep(0.0, 0.45, ndv));
      }
      gl_FragColor = vec4(col, 1.0) * uAlpha;
    }`;

  let gl = null, glCanvas = null, loc = null, indexCount = 0, lidTex = null, dropTex = null, aniso = null;
  let ok = false;
  const labels = [];                          // one per flavour: { canvas, tex }

  function buildMesh() {
    const data = [], idx = [];
    const P = PROFILE.length;
    const segN = [];
    for (let i = 0; i < P - 1; i++) {
      const dr = PROFILE[i + 1][0] - PROFILE[i][0], dy = PROFILE[i + 1][1] - PROFILE[i][1];
      const l = Math.hypot(dr, dy) || 1;
      segN.push([dy / l, -dr / l]);
    }
    for (let i = 0; i < P; i++) {
      const a = segN[Math.max(0, i - 1)], b = segN[Math.min(P - 2, i)];
      let nr = a[0] + b[0], ny = a[1] + b[1];
      const l = Math.hypot(nr, ny) || 1;
      nr /= l; ny /= l;
      const r = PROFILE[i][0], y = PROFILE[i][1];
      for (let j = 0; j <= SEG; j++) {
        const ang = (j / SEG - 0.5) * TAU, s = Math.sin(ang), c = Math.cos(ang);
        data.push(r * s, y, r * c, nr * s, ny, nr * c, j / SEG, 0, 0);
      }
    }
    for (let i = 0; i < P - 1; i++) {
      for (let j = 0; j < SEG; j++) {
        const a = i * (SEG + 1) + j, b = a + 1, c = a + SEG + 1, d = c + 1;
        idx.push(a, c, b, b, c, d);
      }
    }
    // The lid: a flat disc with its own picture.
    const base = data.length / 9;
    const lr = PROFILE[P - 1][0], ly = PROFILE[P - 1][1];
    data.push(0, ly, 0, 0, 1, 0, 0.5, 0.5, 1);
    for (let j = 0; j <= SEG; j++) {
      const ang = (j / SEG - 0.5) * TAU, s = Math.sin(ang), c = Math.cos(ang);
      data.push(lr * s, ly, lr * c, 0, 1, 0, 0.5 + s * 0.5, 0.5 - c * 0.5, 1);
    }
    for (let j = 0; j < SEG; j++) idx.push(base, base + 1 + j, base + 2 + j);
    return { data: new Float32Array(data), idx: new Uint16Array(idx) };
  }

  function lidCanvas() {
    const S = 256, c = document.createElement("canvas");
    c.width = c.height = S;
    const x = c.getContext("2d");
    const g = x.createRadialGradient(S * 0.4, S * 0.35, 10, S / 2, S / 2, S * 0.56);
    g.addColorStop(0, "#f4f6f9"); g.addColorStop(0.6, "#c4c9d1"); g.addColorStop(1, "#8d939d");
    x.fillStyle = g; x.fillRect(0, 0, S, S);
    x.strokeStyle = "rgba(60,66,76,0.55)"; x.lineWidth = 5;
    x.beginPath(); x.arc(S / 2, S / 2, S * 0.4, 0, TAU); x.stroke();
    x.strokeStyle = "rgba(255,255,255,0.7)"; x.lineWidth = 2;
    x.beginPath(); x.arc(S / 2, S / 2, S * 0.415, 0, TAU); x.stroke();
    // The opening and the pull tab.
    x.fillStyle = "rgba(70,76,88,0.5)";
    x.beginPath(); x.ellipse(S / 2, S * 0.66, S * 0.12, S * 0.16, 0, 0, TAU); x.fill();
    x.fillStyle = "#dfe3e9"; x.strokeStyle = "rgba(60,66,76,0.7)"; x.lineWidth = 3;
    x.beginPath(); x.ellipse(S / 2, S * 0.42, S * 0.1, S * 0.2, 0, 0, TAU); x.fill(); x.stroke();
    x.fillStyle = "rgba(70,76,88,0.65)";
    x.beginPath(); x.ellipse(S / 2, S * 0.33, S * 0.05, S * 0.07, 0, 0, TAU); x.fill();
    x.beginPath(); x.arc(S / 2, S * 0.52, S * 0.025, 0, TAU); x.fill();
    return c;
  }

  // Water drops: each texel stores which way a drop's surface leans, and how much drop there is.
  function dropsData() {
    const S = 512, data = new Uint8Array(S * S * 4);
    for (let i = 0; i < S * S; i++) { data[i * 4] = 128; data[i * 4 + 1] = 128; }
    let seed = 11;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let k = 0; k < 420; k++) {
      const cx = rnd() * S, cy = rnd() * S;
      const r = rnd() > 0.93 ? 12 + rnd() * 8 : 3 + rnd() * rnd() * 9;
      const tall = 1 + rnd() * 0.4;
      const ry = Math.ceil(r * tall), rx = Math.ceil(r);
      for (let dy = -ry; dy <= ry; dy++) {
        for (let dx = -rx; dx <= rx; dx++) {
          const nx = dx / r, ny = dy / (r * tall), q = nx * nx + ny * ny;
          if (q > 1) continue;
          const px = (((Math.round(cx) + dx) % S) + S) % S, py = (((Math.round(cy) + dy) % S) + S) % S;
          const o = (py * S + px) * 4;
          const edge = q < 0.6 ? 1 : 1 - (q - 0.6) / 0.4;
          data[o] = 128 + nx * 120; data[o + 1] = 128 + ny * 120; data[o + 3] = 255 * edge;
        }
      }
    }
    return { S, data };
  }

  function texture(source, opts) {
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, opts.flip ? 1 : 0);
    if (source.data) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, source.S, source.S, 0, gl.RGBA, gl.UNSIGNED_BYTE, source.data);
    else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, opts.repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, opts.repeatY ? gl.REPEAT : gl.CLAMP_TO_EDGE);
    if (aniso) gl.texParameterf(gl.TEXTURE_2D, aniso.TEXTURE_MAX_ANISOTROPY_EXT, 8);
    return t;
  }

  function shader(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  }

  function init() {
    try {
      glCanvas = document.createElement("canvas");
      glCanvas.width = glCanvas.height = 16;
      gl = glCanvas.getContext("webgl", { alpha: true, premultipliedAlpha: true, antialias: true });
      if (!gl) return;
      const prog = gl.createProgram();
      gl.attachShader(prog, shader(gl.VERTEX_SHADER, VERT));
      gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, FRAG));
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
      gl.useProgram(prog);
      loc = {};
      ["uP", "uMV", "uR", "uLabel", "uLid", "uDrops", "uAlpha", "uWet", "uTint", "uUp"].forEach((n) => { loc[n] = gl.getUniformLocation(prog, n); });

      const mesh = buildMesh();
      gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
      gl.bufferData(gl.ARRAY_BUFFER, mesh.data, gl.STATIC_DRAW);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer());
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.idx, gl.STATIC_DRAW);
      indexCount = mesh.idx.length;
      const attr = (name, size, offset) => {
        const a = gl.getAttribLocation(prog, name);
        if (a < 0) return;
        gl.enableVertexAttribArray(a);
        gl.vertexAttribPointer(a, size, gl.FLOAT, false, 36, offset);
      };
      attr("aPos", 3, 0); attr("aNor", 3, 12); attr("aUv", 2, 24); attr("aKind", 1, 32);

      aniso = gl.getExtension("EXT_texture_filter_anisotropic");
      lidTex = texture(lidCanvas(), { flip: true });
      dropTex = texture(dropsData(), { repeat: true, repeatY: true });
      gl.uniform1i(loc.uLabel, 0); gl.uniform1i(loc.uLid, 1); gl.uniform1i(loc.uDrops, 2);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, lidTex);
      gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, dropTex);
      gl.activeTexture(gl.TEXTURE0);

      gl.enable(gl.DEPTH_TEST);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.enable(gl.SCISSOR_TEST);
      gl.clearColor(0, 0, 0, 0);
      glCanvas.addEventListener("webglcontextlost", (e) => { e.preventDefault(); ok = false; });
      ok = true;
    } catch (err) {
      ok = false;
      if (window.console) console.warn("3D is off, using flat cans:", err && err.message);
    }
  }

  function setLabel(i, canvas) {
    const old = labels[i];
    if (old && old.tex && ok) gl.deleteTexture(old.tex);
    labels[i] = { canvas, tex: ok ? texture(canvas, { flip: true, repeat: true }) : null };
  }

  // Rotation: first round the can's own axis (ry), then tipped towards you (rx), then leaned (rz).
  function rotation(rx, ry, rz) {
    const cx = Math.cos(rx), sx = Math.sin(rx), cy = Math.cos(ry), sy = Math.sin(ry), cz = Math.cos(rz), sz = Math.sin(rz);
    return [
      cz * cy - sz * sx * sy, -sz * cx, cz * sy + sz * sx * cy,
      sz * cy + cz * sx * sy, cz * cx, sz * sy - cz * sx * cy,
      -cx * sy, sx, cx * cy,
    ];
  }

  const mv = new Float32Array(16), r3 = new Float32Array(9), proj = new Float32Array(16);

  function drawCan(v, o) {
    const m = rotation(o.rx || 0, o.ry || 0, o.rz || 0);
    const s = o.h, d = CAM * v.h;
    mv[0] = s * m[0]; mv[1] = s * m[3]; mv[2] = s * m[6]; mv[3] = 0;
    mv[4] = s * m[1]; mv[5] = s * m[4]; mv[6] = s * m[7]; mv[7] = 0;
    mv[8] = s * m[2]; mv[9] = s * m[5]; mv[10] = s * m[8]; mv[11] = 0;
    mv[12] = o.x - v.w / 2; mv[13] = v.h / 2 - o.y; mv[14] = (o.z || 0) - d; mv[15] = 1;
    r3[0] = m[0]; r3[1] = m[3]; r3[2] = m[6];
    r3[3] = m[1]; r3[4] = m[4]; r3[5] = m[7];
    r3[6] = m[2]; r3[7] = m[5]; r3[8] = m[8];
    gl.uniformMatrix4fv(loc.uMV, false, mv);
    gl.uniformMatrix3fv(loc.uR, false, r3);
    gl.uniform3f(loc.uUp, m[1], m[4], m[7]);
    gl.uniform1f(loc.uAlpha, o.alpha == null ? 1 : o.alpha);
    gl.uniform1f(loc.uWet, o.wet == null ? 1 : o.wet);
    const t = o.tint || [1, 1, 1];
    gl.uniform3f(loc.uTint, t[0], t[1], t[2]);
    const label = labels[o.label];
    gl.bindTexture(gl.TEXTURE_2D, label && label.tex ? label.tex : lidTex);
    gl.drawElements(gl.TRIANGLES, indexCount, gl.UNSIGNED_SHORT, 0);
  }

  // The flat stand-in for browsers without WebGL: the label is still wrapped round a cylinder.
  function flatCan(v, o) {
    const label = labels[o.label], ctx = v.ctx;
    const p = v.project(o.x, o.y, o.z || 0);
    const hh = o.h * p.k, ww = hh * WIDTH;
    ctx.save();
    ctx.globalAlpha = o.alpha == null ? 1 : o.alpha;
    ctx.translate(p.x, p.y);
    ctx.rotate(-(o.rz || 0));
    const rad = ww * 0.14;
    ctx.beginPath();
    ctx.moveTo(-ww / 2 + rad, -hh / 2); ctx.lineTo(ww / 2 - rad, -hh / 2);
    ctx.quadraticCurveTo(ww / 2, -hh / 2, ww / 2, -hh / 2 + rad); ctx.lineTo(ww / 2, hh / 2 - rad);
    ctx.quadraticCurveTo(ww / 2, hh / 2, ww / 2 - rad, hh / 2); ctx.lineTo(-ww / 2 + rad, hh / 2);
    ctx.quadraticCurveTo(-ww / 2, hh / 2, -ww / 2, hh / 2 - rad); ctx.lineTo(-ww / 2, -hh / 2 + rad);
    ctx.quadraticCurveTo(-ww / 2, -hh / 2, -ww / 2 + rad, -hh / 2);
    ctx.clip();
    ctx.fillStyle = "#c6cad1"; ctx.fillRect(-ww / 2, -hh / 2, ww, hh);
    if (label && label.canvas) {
      const src = label.canvas, N = 30;
      for (let i = 0; i < N; i++) {
        const x0 = -1 + (2 * i) / N, x1 = -1 + (2 * (i + 1)) / N;
        const a0 = Math.asin(x0), a1 = Math.asin(x1);
        let u = 0.5 + ((a0 + a1) / 2 - (o.ry || 0)) / TAU;
        u -= Math.floor(u);
        const sw = ((a1 - a0) / TAU) * src.width;
        const sx = Math.min(src.width - sw, Math.max(0, u * src.width - sw / 2));
        ctx.drawImage(src, sx, 0, sw, src.height, (x0 * ww) / 2, hh * -Y1, ((x1 - x0) * ww) / 2 + 0.6, hh * (Y1 - Y0));
      }
    }
    const g = ctx.createLinearGradient(-ww / 2, 0, ww / 2, 0);
    g.addColorStop(0, "rgba(0,0,0,0.42)"); g.addColorStop(0.24, "rgba(255,255,255,0.3)");
    g.addColorStop(0.42, "rgba(255,255,255,0)"); g.addColorStop(0.8, "rgba(255,255,255,0.14)");
    g.addColorStop(1, "rgba(0,0,0,0.45)");
    ctx.fillStyle = g; ctx.fillRect(-ww / 2, -hh / 2, ww, hh);
    ctx.restore();
  }

  function view(el) {
    const v = { el, ctx: el.getContext("2d"), w: 0, h: 0, dpr: 1, pw: 0, ph: 0, cans: [] };

    // Size the canvas and wipe it. False when the view has no size (hidden).
    v.begin = () => {
      const w = el.clientWidth, h = el.clientHeight;
      if (!w || !h) return false;
      let dpr = Math.min(window.devicePixelRatio || 1, 2);
      dpr = Math.max(0.5, Math.min(dpr, Math.sqrt(MAX_PIXELS / (w * h))));
      const pw = Math.round(w * dpr), ph = Math.round(h * dpr);
      if (el.width !== pw || el.height !== ph) { el.width = pw; el.height = ph; }
      v.w = w; v.h = h; v.dpr = dpr; v.pw = pw; v.ph = ph;
      v.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      v.ctx.clearRect(0, 0, w, h);
      v.cans.length = 0;
      return true;
    };

    // Queue a can: { x, y, z, h, rx, ry, rz, label, alpha, wet, tint }.
    v.can = (o) => { if (o.h > 1 && (o.alpha == null || o.alpha > 0.01)) v.cans.push(o); };

    // Where a point in the view lands on screen, and how much it is scaled.
    v.project = (x, y, z) => {
      const d = CAM * v.h, k = d / (d - (z || 0));
      return { x: v.w / 2 + (x - v.w / 2) * k, y: v.h / 2 + (y - v.h / 2) * k, k };
    };

    // Draw the queued cans in 3D and copy them into the view.
    v.flush = () => {
      if (!v.cans.length) return;
      v.cans.sort((a, b) => (a.z || 0) - (b.z || 0));
      if (!ok) { v.cans.forEach((o) => flatCan(v, o)); return; }
      if (glCanvas.width < v.pw || glCanvas.height < v.ph) {
        glCanvas.width = Math.max(glCanvas.width, v.pw);
        glCanvas.height = Math.max(glCanvas.height, v.ph);
      }
      gl.viewport(0, 0, v.pw, v.ph);
      gl.scissor(0, 0, v.pw, v.ph);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      const d = CAM * v.h, f = 1 / Math.tan(FOV / 2), near = d * 0.1, far = d * 4;
      proj.fill(0);
      proj[0] = f / (v.w / v.h); proj[5] = f;
      proj[10] = (far + near) / (near - far); proj[11] = -1;
      proj[14] = (2 * far * near) / (near - far);
      gl.uniformMatrix4fv(loc.uP, false, proj);
      for (let i = 0; i < v.cans.length; i++) drawCan(v, v.cans[i]);
      v.ctx.save();
      v.ctx.setTransform(1, 0, 0, 1, 0, 0);
      v.ctx.drawImage(glCanvas, 0, glCanvas.height - v.ph, v.pw, v.ph, 0, 0, v.pw, v.ph);
      v.ctx.restore();
    };
    return v;
  }

  init();
  window.CanGL = { view, setLabel, WIDTH, get ok() { return ok; } };
})();
