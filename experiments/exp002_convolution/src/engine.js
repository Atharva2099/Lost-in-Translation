// experiments/exp002_convolution/src/engine.js
// Tactile Paper-Cutout, Watercolor Wash & Fountain-Pen Studio Engine for Experiment 002 (Convolution)
// Combines:
// - Torn-paper collage cutouts (`cutoutPiece`) with fibrous white rims, marker-stroke textures & drop shadows (from illodev/drawn-by-code)
// - Wet watercolor washes (`wetWash`) with bottom pigment pooling & crinkled drying rims (from @kickingkeys / anidoodle)
// - Tapered, pressure-modulated fountain pen & retraced pencil lines (`penStroke`)
// - Automated Geometry & Text Collision Probe (`window.__LIT_PROBES__`) to detect text overlaps or card overflows automatically

(function () {
  const W = 1920;
  const H = 1080;

  const PAL = {
    desk: "#EFE6D4",
    deskDark: "#DED1B8",
    paper: "#FBF7EC",
    paperCard: "#FFFDF8",
    paperEdge: "#FFFFFF",
    ink: "#231D28",
    inkSoft: "#544C5C",
    biroBlue: "#23408E",
    cobalt: "#2858A6",
    amber: "#E06D32",
    coral: "#EA5F46",
    gold: "#E8AD38",
    teal: "#227C74",
    mint: "#52B79A",
    crimson: "#C6362F",
    plum: "#5B3E7A",
    steel: "#7C7484",
    vellum: "#231D28",
    vellumDim: "#544C5C"
  };

  // --- Automated Geometry & Text Collision Probe ---
  let PROBE_ENABLED = false;
  let CURRENT_PROBES = [];

  function beginFrameProbes(enable = false) {
    PROBE_ENABLED = enable;
    CURRENT_PROBES = [];
  }

  function recordProbe(kind, label, x, y, w, h, ctx) {
    if (!PROBE_ENABLED || !ctx) return;
    if (ctx.globalAlpha < 0.15) return;
    const m = ctx.getTransform();
    const corners = [
      [x, y],
      [x + w, y],
      [x, y + h],
      [x + w, y + h]
    ].map(([px, py]) => [m.a * px + m.c * py + m.e, m.b * px + m.d * py + m.f]);
    const x0 = Math.min(...corners.map((c) => c[0]));
    const y0 = Math.min(...corners.map((c) => c[1]));
    const x1 = Math.max(...corners.map((c) => c[0]));
    const y1 = Math.max(...corners.map((c) => c[1]));
    CURRENT_PROBES.push({ kind, label: String(label), x0, y0, x1, y1 });
  }

  function analyzeFrameProbes() {
    const warnings = [];
    const texts = CURRENT_PROBES.filter((p) => p.kind === "text");
    const cards = CURRENT_PROBES.filter((p) => p.kind === "card");

    // 1. Check screen boundary clipping
    for (const t of texts) {
      if (t.x0 < 24 || t.x1 > W - 24 || t.y0 < 18 || t.y1 > H - 18) {
        warnings.push(`Screen-edge clip on text "${t.label}" [${Math.round(t.x0)},${Math.round(t.y0)}..${Math.round(t.x1)},${Math.round(t.y1)}]`);
      }
    }

    // 2. Check text-on-text collisions
    for (let i = 0; i < texts.length; i++) {
      for (let j = i + 1; j < texts.length; j++) {
        const a = texts[i];
        const b = texts[j];
        const ix0 = Math.max(a.x0, b.x0);
        const iy0 = Math.max(a.y0, b.y0);
        const ix1 = Math.min(a.x1, b.x1);
        const iy1 = Math.min(a.y1, b.y1);
        if (ix1 - ix0 > 4 && iy1 - iy0 > 4) {
          warnings.push(`Text overlap between "${a.label}" and "${b.label}" (${Math.round(ix1 - ix0)}x${Math.round(iy1 - iy0)}px)`);
        }
      }
    }

    // 3. Check if a text box slightly straddles a card edge (partial overflow)
    for (const t of texts) {
      for (const c of cards) {
        const cx = (t.x0 + t.x1) / 2;
        const cy = (t.y0 + t.y1) / 2;
        if (cx > c.x0 && cx < c.x1 && cy > c.y0 && cy < c.y1) {
          if (t.x0 < c.x0 - 4 || t.x1 > c.x1 + 4 || t.y0 < c.y0 - 4 || t.y1 > c.y1 + 4) {
            warnings.push(`Text "${t.label}" [${Math.round(t.x0)}..${Math.round(t.x1)}] overflows parent card "${c.label}" [${Math.round(c.x0)}..${Math.round(c.x1)}]`);
          }
        }
      }
    }

    return {
      count: CURRENT_PROBES.length,
      warnings,
      metrics: {
        text_blocks: texts.length,
        card_count: cards.length,
        non_subtitle_words: texts.reduce((acc, t) => acc + t.label.trim().split(/\s+/).length, 0),
        long_prose_strings: texts
          .filter((t) => t.label.trim().split(/\s+/).length >= 6 && !/[=∗⋆Σ∫]/.test(t.label))
          .map((t) => t.label)
      }
    };
  }

  // Helper to convert cold digital font families into warm hand-crafted / archival studio typefaces
  function resolveStudioFont(rawFont) {
    let f = String(rawFont || "700 18px 'Chalkboard SE', sans-serif");
    // Map cold digital 'JetBrains Mono' to warm hand-drafted 'Chalkboard SE' / 'American Typewriter'
    if (f.includes("JetBrains Mono") || f.includes("monospace")) {
      f = f.replace(/'JetBrains Mono'[^,]*(,\s*'Courier New')?(,\s*monospace)?/g, "'Chalkboard SE', 'Marker Felt', 'American Typewriter', sans-serif");
      f = f.replace(/monospace/g, "'Chalkboard SE', sans-serif");
    }
    if (f.includes("Georgia")) {
      f = f.replace(/'Georgia',\s*serif/g, "'Chalkboard SE', 'Cochin', serif");
    }
    return f;
  }

  // Hand-inked character-by-character lettering with seeded micro-jitter & dual-ink bleed (inspired by illodev/drawn-by-code PaperKit.hand)
  function drawText(ctx, text, x, y, opts = {}) {
    const {
      font = "700 18px 'Chalkboard SE', sans-serif",
      color = PAL.ink,
      align = "left",
      baseline = "middle",
      probe = true,
      handJitter = true
    } = opts;
    const str = String(text);
    const studioFont = resolveStudioFont(font);
    const fontSizeMatch = studioFont.match(/(\d+(?:\.\d+)?)px/);
    const fontSize = fontSizeMatch ? parseFloat(fontSizeMatch[1]) : 18;

    ctx.save();
    ctx.font = studioFont;
    ctx.fillStyle = color;
    ctx.textBaseline = baseline;

    // Measure character advances individually so per-glyph jitter never causes kerning collisions
    const chars = Array.from(str);
    const widths = chars.map((ch) => ctx.measureText(ch).width);
    const totalW = widths.reduce((a, b) => a + b, 0);

    let startX = x;
    if (align === "center") startX = x - totalW / 2;
    else if (align === "right") startX = x - totalW;

    if (handJitter && chars.length > 0) {
      const r = rngFor("handText:" + str + ":" + Math.round(x) + ":" + Math.round(y));
      let curX = startX;
      const baseAlpha = ctx.globalAlpha;
      for (let i = 0; i < chars.length; i++) {
        const ch = chars[i];
        const cw = widths[i];
        if (ch !== " ") {
          const dy = (r() - 0.5) * Math.min(2.2, fontSize * 0.055);
          const rot = (r() - 0.5) * 0.042;
          ctx.save();
          ctx.translate(curX + cw / 2, y + dy);
          ctx.rotate(rot);
          ctx.textAlign = "center";
          // Primary ink pass
          ctx.globalAlpha = baseAlpha * 0.95;
          ctx.fillText(ch, 0, 0);
          // Secondary fountain-nib ink-bleed pass (gives warm hand-lettered weight)
          ctx.globalAlpha = baseAlpha * 0.24;
          ctx.fillText(ch, fontSize * 0.02, fontSize * 0.015);
          ctx.restore();
        }
        curX += cw;
      }
    } else {
      ctx.textAlign = align;
      ctx.fillText(str, x, y);
    }

    if (probe && PROBE_ENABLED && str.trim().length > 0) {
      const h = fontSize * 0.86;
      let by = y;
      if (baseline === "middle") by = y - h / 2;
      else if (baseline === "alphabetic" || baseline === "bottom") by = y - h * 0.85;
      recordProbe("text", str, startX, by, totalW, h, ctx);
    }
    ctx.restore();
  }

  // --- Deterministic PRNG ---
  function hashStr(str) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function rngFor(key) {
    let a = typeof key === "number" ? (key >>> 0) : hashStr(String(key));
    if (a === 0) a = 0x9E3779B9;
    return function () {
      a |= 0;
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function noise2D(seed, x, y) {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const xf = x - xi;
    const yf = y - yi;
    const sx = xf * xf * (3 - 2 * xf);
    const sy = yf * yf * (3 - 2 * yf);
    const h = (ix, iy) => {
      let n = Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + Math.imul(seed, 1442695041);
      n = (n ^ (n >>> 13)) * 1274126177;
      return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
    };
    const a = h(xi, yi);
    const b = h(xi + 1, yi);
    const c = h(xi, yi + 1);
    const d = h(xi + 1, yi + 1);
    return a + sx * (b - a) + sy * (c - a + sx * (d - c - b + a));
  }

  function fractalNoise(seed, x, y, freq = 0.02, octaves = 2) {
    let sum = 0, amp = 1, norm = 0, f = freq;
    for (let o = 0; o < octaves; o++) {
      sum += (noise2D(seed + o * 97, x * f, y * f) - 0.5) * 2 * amp;
      norm += amp;
      amp *= 0.5;
      f *= 2.05;
    }
    return sum / norm;
  }

  // --- Math & Easing ---
  const clamp = (v, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const invLerp = (a, b, v) => clamp((v - a) / (b - a || 1e-9), 0, 1);

  const easeOutCubic = (x) => 1 - Math.pow(1 - clamp(x), 3);
  const easeInCubic = (x) => Math.pow(clamp(x), 3);
  const easeInOutCubic = (x) => {
    x = clamp(x);
    return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
  };
  const easeOutBack = (x, s = 1.45) => {
    x = clamp(x);
    const c3 = s + 1;
    return 1 + c3 * Math.pow(x - 1, 3) + s * Math.pow(x - 1, 2);
  };
  const smoothstep = (a, b, t) => {
    const x = invLerp(a, b, t);
    return x * x * (3 - 2 * x);
  };

  function windowEnv(t, start, end, fadeIn = 0.4, fadeOut = 0.4) {
    if (t <= start || t >= end) return 0;
    const uIn = fadeIn > 0 ? easeOutCubic(invLerp(start, start + fadeIn, t)) : 1;
    const uOut = fadeOut > 0 ? easeOutCubic(1 - invLerp(end - fadeOut, end, t)) : 1;
    return uIn * uOut;
  }

  function lerpColor(hexA, hexB, u) {
    u = clamp(u, 0, 1);
    const a = parseInt(hexA.slice(1), 16);
    const b = parseInt(hexB.slice(1), 16);
    const r = Math.round(lerp((a >> 16) & 255, (b >> 16) & 255, u));
    const g = Math.round(lerp((a >> 8) & 255, (b >> 8) & 255, u));
    const bl = Math.round(lerp(a & 255, b & 255, u));
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + bl).toString(16).slice(1);
  }

  // --- Geometry & Proportional Polyline Subdividers ---
  function smoothCurve(pts, closed = false, samplesPerSeg = 5) {
    if (pts.length < 3) return pts.slice();
    const n = pts.length;
    const at = (i) => (closed ? pts[((i % n) + n) % n] : pts[Math.max(0, Math.min(n - 1, i))]);
    const out = [];
    const segs = closed ? n : n - 1;
    for (let i = 0; i < segs; i++) {
      const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
      for (let k = 0; k < samplesPerSeg; k++) {
        const u = k / samplesPerSeg, u2 = u * u, u3 = u2 * u;
        const x = 0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * u + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * u2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * u3);
        const y = 0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * u + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * u2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * u3);
        out.push([x, y]);
      }
    }
    out.push(closed ? out[0] : pts[n - 1]);
    return out;
  }

  function sketchyRectPts(x, y, w, h, wobble = 1.6, seed = "rect") {
    const r = rngFor(seed);
    const j = () => (r() - 0.5) * 2 * wobble;
    const pts = [];
    const nx = Math.max(4, Math.min(18, Math.round(w / 70)));
    const ny = Math.max(2, Math.min(12, Math.round(h / 70)));
    for (let i = 0; i < nx; i++) pts.push([x + (w * i) / nx + j() * 0.4, y + j() * 0.5]);
    for (let i = 0; i < ny; i++) pts.push([x + w + j() * 0.5, y + (h * i) / ny + j() * 0.4]);
    for (let i = 0; i < nx; i++) pts.push([x + w - (w * i) / nx + j() * 0.4, y + h + j() * 0.5]);
    for (let i = 0; i < ny; i++) pts.push([x + j() * 0.5, y + h - (h * i) / ny + j() * 0.4]);
    return pts;
  }

  function sketchyCirclePts(cx, cy, rx, ry = rx, n = 20, wobble = 2.0, seed = "circle") {
    const r = rngFor(seed);
    const pts = [];
    const ph = r() * Math.PI * 2;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const dr = (r() - 0.5) * 2 * wobble + Math.sin(a * 3 + ph) * wobble * 0.45;
      pts.push([cx + Math.cos(a) * (rx + dr), cy + Math.sin(a) * (ry + dr)]);
    }
    return pts;
  }

  // --- Mark 1: `wetWash` (Watercolor Wash + Bottom Pigment Pooling) ---
  function wetWash(ctx, pts, color, opts = {}) {
    const {
      alpha = 0.65,
      seed = "wash",
      pool = 0.42,
      bleed = 3.0,
      rim = true,
      dx = 2,
      dy = 2
    } = opts;
    if (pts.length < 3 || alpha <= 0.01) return;

    const snum = hashStr(String(seed));
    const curve = smoothCurve(pts, true, 4);
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    const displaced = curve.map(([x, y], idx) => {
      const n1 = fractalNoise(snum, x + idx * 3, y, 0.025, 2) * bleed;
      const n2 = fractalNoise(snum + 71, x, y + idx * 3, 0.025, 2) * bleed;
      const px = x + dx + n1;
      const py = y + dy + n2;
      if (px < x0) x0 = px;
      if (py < y0) y0 = py;
      if (px > x1) x1 = px;
      if (py > y1) y1 = py;
      return [px, py];
    });

    ctx.save();
    ctx.beginPath();
    displaced.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
    ctx.closePath();

    ctx.fillStyle = color;
    ctx.globalAlpha *= alpha;
    ctx.fill();

    if (pool > 0.05 && y1 > y0 + 8) {
      ctx.save();
      ctx.clip();
      const grad = ctx.createLinearGradient(0, y0 + (y1 - y0) * 0.35, 0, y1 + 4);
      grad.addColorStop(0, "rgba(0,0,0,0)");
      grad.addColorStop(1, color);
      ctx.globalAlpha *= pool * 0.62;
      ctx.fillStyle = grad;
      ctx.fillRect(x0 - 10, y0 - 10, x1 - x0 + 20, y1 - y0 + 20);
      ctx.restore();
    }

    if (rim) {
      ctx.strokeStyle = lerpColor(color, PAL.ink, 0.28);
      ctx.lineWidth = 1.4;
      ctx.globalAlpha *= 0.55;
      ctx.stroke();
    }
    ctx.restore();
  }

  // --- Mark 2: `penStroke` (Tapered, Pressure-Modulated Fountain Pen + Searching Retrace) ---
  function penStroke(ctx, pts, opts = {}) {
    const {
      width = 2.4,
      color = PAL.ink,
      alpha = 0.92,
      closed = false,
      wobble = 1.25,
      taper = 0.72,
      pressure = 0.42,
      retrace = true,
      progress = 1.0,
      boilTime = null,
      seed = "pen"
    } = opts;

    if (pts.length < 2 || progress <= 0.005 || alpha <= 0.01) return;

    const boilTick = boilTime !== null ? Math.floor(boilTime * 10) : 0;
    const baseSeed = hashStr(`${seed}:${boilTick}`);
    const dense = smoothCurve(pts, closed, 4);
    const totalPts = progress < 1 ? Math.max(2, Math.ceil(dense.length * clamp(progress, 0, 1))) : dense.length;
    const slice = dense.slice(0, totalPts);

    function drawPass(passIdx, wScale, aScale, wobScale) {
      const r = rngFor(baseSeed + passIdx * 997);
      const ph = r() * Math.PI * 2;
      const L = [], R = [];
      const n = slice.length;

      for (let i = 0; i < n; i++) {
        const u = i / Math.max(1, n - 1);
        const p = slice[i];
        const prev = slice[Math.max(0, i - 1)];
        const next = slice[Math.min(n - 1, i + 1)];
        const dx = next[0] - prev[0];
        const dy = next[1] - prev[1];
        const len = Math.hypot(dx, dy) || 1;
        const nx = -dy / len;
        const ny = dx / len;

        const endEnv = closed ? 1.0 : Math.min(1, u / 0.12, (1 - u) / 0.14);
        const tp = 1 - taper + taper * Math.pow(Math.max(0.08, endEnv), 0.7);
        const pr = 1 + pressure * (0.32 * Math.sin(u * 6.5 + ph) + 0.16 * Math.cos(u * 15 - ph));
        const halfW = (width * wScale * tp * pr) * 0.5;

        const wobOffset = (Math.sin(u * 11 + ph * 1.7) * 0.65 + (r() - 0.5) * 0.75) * wobble * wobScale;
        const cx = p[0] + nx * wobOffset;
        const cy = p[1] + ny * wobOffset;

        L.push([cx + nx * halfW, cy + ny * halfW]);
        R.push([cx - nx * halfW, cy - ny * halfW]);
      }

      ctx.save();
      ctx.fillStyle = color;
      ctx.globalAlpha *= alpha * aScale;
      ctx.beginPath();
      L.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
      for (let i = R.length - 1; i >= 0; i--) ctx.lineTo(R[i][0], R[i][1]);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    drawPass(0, 1.0, 1.0, 1.0);
    if (retrace) drawPass(1, 0.55, 0.40, 1.5);
  }

  // --- Mark 3: `scribbleHatchRect` (Diagonal Pencil / Crayon Shading) ---
  function scribbleHatchRect(ctx, x, y, w, h, opts = {}) {
    const {
      color = PAL.amber,
      alpha = 0.24,
      gap = 8,
      angle = -0.62,
      width = 1.5,
      seed = "hatch",
      cross = false
    } = opts;

    const r = rngFor(seed);
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();

    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = "round";

    const diag = Math.hypot(w, h);
    const cx = x + w / 2;
    const cy = y + h / 2;

    function pass(ang, aMul) {
      const ca = Math.cos(ang), sa = Math.sin(ang);
      const nx = -sa, ny = ca;
      for (let d = -diag / 2; d <= diag / 2; d += gap) {
        const j = (r() - 0.5) * gap * 0.35;
        const px0 = cx + nx * (d + j) - ca * (diag / 2);
        const py0 = cy + ny * (d + j) - sa * (diag / 2);
        const px1 = cx + nx * (d + j) + ca * (diag / 2);
        const py1 = cy + ny * (d + j) + sa * (diag / 2);
        const midX = (px0 + px1) / 2 + (r() - 0.5) * 5;
        const midY = (py0 + py1) / 2 + (r() - 0.5) * 5;

        ctx.globalAlpha = alpha * aMul * (0.75 + r() * 0.4);
        ctx.beginPath();
        ctx.moveTo(px0, py0);
        ctx.quadraticCurveTo(midX, midY, px1, py1);
        ctx.stroke();
      }
    }

    pass(angle, 1.0);
    if (cross) pass(angle + Math.PI * 0.48, 0.65);
    ctx.restore();
  }

  // --- Mark 4: `drawPaperStrip` (Torn-Edge Paper Cutout Strip with Cells, inspired by illodev/drawn-by-code) ---
  // Draws a physical movable paper strip with a white torn paper rim, cast shadow, and individual colored cells!
  function drawPaperStrip(ctx, x, y, cellW, cellH, cells, opts = {}) {
    const {
      seed = "strip",
      title = null,
      titleColor = PAL.ink,
      borderWhite = 5,
      shadowOffset = 6,
      highlightIdx = -1
    } = opts;

    const totalW = cellW * cells.length;
    const stripPts = sketchyRectPts(x - borderWhite, y - borderWhite, totalW + borderWhite * 2, cellH + borderWhite * 2, 1.8, seed + ":outer");

    ctx.save();
    // 1. Cast shadow on craft desk
    ctx.save();
    ctx.translate(shadowOffset, shadowOffset);
    ctx.fillStyle = "rgba(35, 29, 40, 0.18)";
    ctx.beginPath();
    stripPts.forEach(([px, py], i) => (i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)));
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // 2. Torn white paper rim
    ctx.fillStyle = "#FFFDF9";
    ctx.beginPath();
    stripPts.forEach(([px, py], i) => (i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)));
    ctx.closePath();
    ctx.fill();

    // 3. Individual painted cells inside the strip
    for (let i = 0; i < cells.length; i++) {
      const c = cells[i];
      const cx = x + i * cellW;
      const isHi = i === highlightIdx || c.highlight;
      const cPts = sketchyRectPts(cx + 2, y + 2, cellW - 4, cellH - 4, 1.2, `${seed}:c:${i}`);

      wetWash(ctx, cPts, c.fill || "#F7EFE0", {
        alpha: 0.94,
        pool: 0.3,
        bleed: 1.5,
        rim: true,
        dx: 0,
        dy: 0,
        seed: `${seed}:cw:${i}`
      });

      if (isHi) {
        scribbleHatchRect(ctx, cx + 4, y + 4, cellW - 8, cellH - 8, {
          color: c.stroke || PAL.amber,
          alpha: 0.22,
          gap: 6,
          seed: `${seed}:ch:${i}`
        });
      }

      penStroke(ctx, cPts, {
        closed: true,
        width: isHi ? 2.8 : 1.8,
        color: isHi ? (c.stroke || PAL.crimson) : PAL.ink,
        wobble: 1.0,
        retrace: isHi,
        seed: `${seed}:cp:${i}`
      });

      // Top small index label (e.g., x[0] or h[2])
      if (c.sub) {
        drawText(ctx, c.sub, cx + cellW / 2, y + 18, {
          font: "700 13px 'JetBrains Mono', monospace",
          color: PAL.inkSoft,
          align: "center"
        });
      }

      // Main value in cell
      drawText(ctx, String(c.val), cx + cellW / 2, y + (c.sub ? cellH * 0.58 : cellH * 0.52), {
        font: c.font || "800 28px 'JetBrains Mono', monospace",
        color: c.textColor || PAL.ink,
        align: "center"
      });
    }

    // Outer fountain pen border around the white cutout rim
    penStroke(ctx, stripPts, {
      closed: true,
      width: 2.2,
      color: PAL.ink,
      alpha: 0.85,
      wobble: 1.2,
      retrace: true,
      seed: seed + ":rim-pen"
    });

    if (title) {
      drawText(ctx, title, x - 16, y + cellH / 2, {
        font: "800 18px 'JetBrains Mono', monospace",
        color: titleColor,
        align: "right"
      });
    }

    recordProbe("card", seed, x - borderWhite, y - borderWhite, totalW + borderWhite * 2, cellH + borderWhite * 2, ctx);
    ctx.restore();
  }

  // --- Pre-baked Tactile Studio Workbench & Sketchbook Backdrop ---
  let bgCanvas = null;
  function getStaticBackdrop() {
    if (bgCanvas) return bgCanvas;
    bgCanvas = document.createElement("canvas");
    bgCanvas.width = W;
    bgCanvas.height = H;
    const g = bgCanvas.getContext("2d");

    // 1. Warm tactile studio desk & cream drafting sheet
    const rad = g.createRadialGradient(W * 0.5, H * 0.48, 120, W * 0.5, H * 0.5, W * 0.72);
    rad.addColorStop(0, "#FCF8EE");
    rad.addColorStop(0.7, "#F5EDE0");
    rad.addColorStop(1, "#E6DAC2");
    g.fillStyle = rad;
    g.fillRect(0, 0, W, H);

    // 2. Watercolor paper mottling washes
    const rng = rngFor("convolution-studio-1943-2026");
    for (let i = 0; i < 130; i++) {
      const cx = rng() * W;
      const cy = rng() * H;
      const r = 65 + rng() * 175;
      const grad = g.createRadialGradient(cx, cy, r * 0.1, cx, cy, r);
      grad.addColorStop(0, rng() < 0.55 ? "rgba(214, 194, 160, 0.048)" : "rgba(255, 253, 246, 0.055)");
      grad.addColorStop(1, "rgba(245, 237, 224, 0)");
      g.fillStyle = grad;
      g.beginPath();
      g.arc(cx, cy, r, 0, Math.PI * 2);
      g.fill();
    }

    // 3. Isometric / Drafting Grid rulings
    g.lineWidth = 1;
    for (let x = 40; x < W - 40; x += 32) {
      g.strokeStyle = (x - 40) % 160 === 0 ? "rgba(40, 88, 166, 0.11)" : "rgba(40, 88, 166, 0.05)";
      g.beginPath();
      g.moveTo(x + 0.5, 36);
      g.lineTo(x + 0.5, H - 36);
      g.stroke();
    }
    for (let y = 40; y < H - 40; y += 32) {
      g.strokeStyle = (y - 40) % 160 === 0 ? "rgba(40, 88, 166, 0.11)" : "rgba(40, 88, 166, 0.05)";
      g.beginPath();
      g.moveTo(36, y + 0.5);
      g.lineTo(W - 36, y + 0.5);
      g.stroke();
    }

    // 4. Cold-press fibers & tooth
    for (let i = 0; i < 8000; i++) {
      const px = rng() * W;
      const py = rng() * H;
      const sz = rng() < 0.82 ? 1.3 : 2.3;
      const a = 0.025 + rng() * 0.042;
      g.fillStyle = rng() < 0.65 ? `rgba(85, 70, 52, ${a})` : `rgba(255, 255, 255, ${a * 1.3})`;
      g.fillRect(px, py, sz, sz);
    }

    // 5. Outer studio frame border
    const borderPts = sketchyRectPts(28, 26, W - 56, H - 52, 1.4, "conv-page-border");
    penStroke(g, borderPts, {
      closed: true,
      width: 2.0,
      color: PAL.inkSoft,
      alpha: 0.42,
      wobble: 1.2,
      retrace: true,
      seed: "conv-page-border-s"
    });

    return bgCanvas;
  }

  // --- Sketched Notebook / Cutout Card ---
  function drawArchivalCard(ctx, x, y, w, h, opts = {}) {
    const {
      fill = PAL.paperCard,
      stroke = PAL.ink,
      accent = PAL.amber,
      header = null,
      tape = true,
      seed = null
    } = opts;

    const cardSeed = seed || `card:${Math.round(x)}:${Math.round(y)}:${Math.round(w)}:${header || ""}`;
    const cardPts = sketchyRectPts(x, y, w, h, 1.5, cardSeed);

    ctx.save();
    scribbleHatchRect(ctx, x + 7, y + 7, w, h, {
      color: PAL.inkSoft,
      alpha: 0.17,
      gap: 7,
      angle: -0.7,
      width: 1.5,
      seed: cardSeed + ":sh"
    });

    wetWash(ctx, cardPts, fill, {
      alpha: 0.96,
      seed: cardSeed + ":wash",
      pool: 0.12,
      bleed: 2.0,
      rim: false,
      dx: 0,
      dy: 0
    });

    if (header) {
      const hdrPts = sketchyRectPts(x + 6, y + 6, w - 12, 38, 1.3, cardSeed + ":hdr");
      wetWash(ctx, hdrPts, accent, {
        alpha: 0.22,
        seed: cardSeed + ":hdrwash",
        pool: 0.35,
        bleed: 2.0,
        rim: true,
        dx: 1,
        dy: 1
      });

      penStroke(ctx, [[x + 10, y + 44], [x + w / 2, y + 43.5], [x + w - 10, y + 44.5]], {
        width: 1.5,
        color: PAL.inkSoft,
        alpha: 0.45,
        wobble: 1.0,
        retrace: false,
        seed: cardSeed + ":rule"
      });

      drawText(ctx, "✎ " + header, x + 18, y + 25, {
        font: "700 14px 'JetBrains Mono', monospace",
        color: PAL.ink,
        align: "left",
        probe: false
      });
    }

    penStroke(ctx, cardPts, {
      closed: true,
      width: stroke !== PAL.ink ? 2.8 : 2.1,
      color: stroke,
      alpha: 0.88,
      wobble: 1.4,
      retrace: true,
      seed: cardSeed + ":outline"
    });

    if (tape && w > 280) {
      const r = rngFor(cardSeed + ":tape");
      const tapeX = x + w * (0.42 + r() * 0.16);
      const tapePts = sketchyRectPts(tapeX - 38, y - 9, 76, 18, 1.0, cardSeed + ":tp");
      wetWash(ctx, tapePts, "#EBDAB4", {
        alpha: 0.68,
        seed: cardSeed + ":tpw",
        pool: 0.1,
        bleed: 1.2,
        rim: true,
        dx: 0,
        dy: 0
      });
    }

    recordProbe("card", header || cardSeed, x, y, w, h, ctx);
    ctx.restore();
  }

  // --- Expressive Companion Guide: "Connie the Sliding Lens" ---
  // A friendly hand-drawn magnifying loupe / stencil character who flips and slides!
  function drawLensGuide(ctx, x, y, scale, t, mood = "curious", label = null) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);

    const bob = Math.sin(t * 3.8) * 3.5;
    const tilt = Math.sin(t * 2.1) * 0.06;
    ctx.translate(0, bob);
    ctx.rotate(tilt);

    // Shadow
    const shPts = sketchyCirclePts(0, 44, 26, 7, 12, 1.0, "lens-sh");
    wetWash(ctx, shPts, PAL.inkSoft, { alpha: 0.22, pool: 0, bleed: 1.2, rim: false, dx: 0, dy: 0 });

    // Little stubby legs
    penStroke(ctx, [[-11, 20], [-11, 41]], { width: 4.0, color: PAL.ink, wobble: 0.8, retrace: true, boilTime: t, seed: "l-legL" });
    penStroke(ctx, [[11, 20], [11, 41]], { width: 4.0, color: PAL.ink, wobble: 0.8, retrace: true, boilTime: t, seed: "l-legR" });

    // Square 3x3 stencil-frame body with warm brass/amber border
    const framePts = sketchyRectPts(-28, -28, 56, 52, 1.5, "lens-body");
    const bodyCol = mood === "flip" ? "#FCE09B" : mood === "excited" ? "#C5EAE2" : "#F5DFB8";
    wetWash(ctx, framePts, bodyCol, { alpha: 0.94, pool: 0.35, bleed: 2.0, rim: true, dx: 1, dy: 1 });
    penStroke(ctx, framePts, { closed: true, width: 2.8, color: PAL.ink, wobble: 1.2, retrace: true, boilTime: t, seed: "l-body-out" });

    // Cute eyes inside the lens frame
    for (const s of [-1, 1]) {
      const eyePts = sketchyCirclePts(s * 11, -5, 7.5, 7.5, 10, 0.6, `l-eye:${s}`);
      wetWash(ctx, eyePts, "#FFFFFF", { alpha: 0.9, pool: 0, bleed: 0.5, rim: false, dx: 0, dy: 0 });
      penStroke(ctx, eyePts, { closed: true, width: 1.9, color: PAL.ink, wobble: 0.6, retrace: false, seed: `l-eyep:${s}` });
      ctx.fillStyle = PAL.ink;
      ctx.beginPath();
      ctx.arc(s * 11 + 1.2, -5, 2.8, 0, Math.PI * 2);
      ctx.fill();
    }

    // Smile
    if (mood === "excited") {
      penStroke(ctx, [[-8, 9], [0, 15], [8, 9]], { width: 2.2, color: PAL.crimson, wobble: 0.6, retrace: false, seed: "l-sm1" });
    } else {
      penStroke(ctx, [[-6, 10], [0, 13], [6, 10]], { width: 2.0, color: PAL.ink, wobble: 0.6, retrace: false, seed: "l-sm2" });
    }

    if (label) {
      drawText(ctx, label, 0, -42, {
        font: "800 15px 'JetBrains Mono', monospace",
        color: mood === "flip" ? PAL.crimson : PAL.biroBlue,
        align: "center",
        probe: false
      });
    }

    ctx.restore();
  }

  // --- Top Chapter HUD & Synchronized Subtitle Strip ---
  const ACT_TITLES = {
    1: "STUDIO PLATE I · ACOUSTIC ECHOES & THE MYSTERY OF (n − k)",
    2: "STUDIO PLATE II · WHY WE FLIP: THE SLIDING PAPER STRIP (f ∗ g)",
    3: "STUDIO PLATE III · MOVING AVERAGES & THE CONTINUOUS INTEGRAL",
    4: "STUDIO PLATE IV · 2D IMAGE STENCILS: BLURRING vs. EDGE DETECTION",
    5: "STUDIO PLATE V · THE DEEP LEARNING TWIST: CONVOLUTION vs. CROSS-CORRELATION"
  };

  function getActiveAct(t) {
    if (t < 46.8) return 1;
    if (t < 98.5) return 2;
    if (t < 123.5) return 3;
    if (t < 147.5) return 4;
    return 5;
  }

  function drawTopHUD(ctx, t, duration) {
    const act = getActiveAct(t);
    ctx.save();

    const topPts = sketchyRectPts(36, 26, W - 72, 46, 1.3, "conv-hud-bar");
    wetWash(ctx, topPts, "#EFE5CE", { alpha: 0.92, pool: 0.25, bleed: 1.8, rim: false, dx: 0, dy: 0 });
    penStroke(ctx, [[36, 72], [W / 2, 71.5], [W - 36, 72.5]], {
      width: 2.0,
      color: PAL.ink,
      alpha: 0.75,
      wobble: 1.2,
      retrace: true,
      seed: "conv-hud-line"
    });

    const tabPts = sketchyRectPts(52, 36, 16, 26, 1.0, "conv-tab");
    wetWash(ctx, tabPts, PAL.amber, { alpha: 0.9, pool: 0.3, bleed: 1, rim: true, dx: 0, dy: 0 });
    penStroke(ctx, tabPts, { closed: true, width: 1.8, color: PAL.ink, wobble: 0.8, retrace: false, seed: "conv-tab-p" });

    drawText(ctx, ACT_TITLES[act], 80, 49, {
      font: "800 15px 'JetBrains Mono', monospace",
      color: PAL.ink,
      align: "left",
      probe: false
    });

    const mins = Math.floor(t / 60);
    const secs = (t % 60).toFixed(1).padStart(4, "0");
    drawText(ctx, `EXP 002 · CONVOLUTION (f ∗ g)  ·  T+${mins}:${secs}s`, W - 54, 49, {
      font: "700 14px 'JetBrains Mono', monospace",
      color: PAL.biroBlue,
      align: "right",
      probe: false
    });

    const prog = clamp(t / duration, 0, 1);
    if (prog > 0.005) {
      penStroke(ctx, [[36, 72], [36 + (W - 72) * prog, 72]], {
        width: 3.6,
        color: PAL.amber,
        alpha: 0.9,
        wobble: 0.8,
        retrace: false,
        seed: "conv-hud-prog"
      });
    }

    ctx.restore();
  }

  function drawSubtitles(ctx, t, subtitles) {
    if (!subtitles) return;
    let activeCue = null;
    for (let i = 0; i < subtitles.length; i++) {
      const c = subtitles[i];
      if (t >= c.start - 0.05 && t <= c.end + 0.08) {
        activeCue = c;
        break;
      }
    }
    if (!activeCue) return;

    const env = windowEnv(t, activeCue.start - 0.05, activeCue.end + 0.08, 0.08, 0.10);
    if (env <= 0.01) return;

    ctx.save();
    ctx.globalAlpha = env;
    ctx.font = "700 24px 'Chalkboard SE', 'Cochin', serif";
    ctx.textBaseline = "middle";

    const words = activeCue.words || [];
    const spaceW = ctx.measureText(" ").width;
    const wordWidths = words.map((w) => ctx.measureText(w.display || w.word).width);
    const totalW = wordWidths.reduce((a, b) => a + b, 0) + Math.max(0, words.length - 1) * spaceW;

    const padX = 30;
    const boxW = Math.max(320, totalW + padX * 2);
    const boxH = 54;
    const boxX = (W - boxW) / 2;
    const boxY = H - 88;

    const subPts = sketchyRectPts(boxX, boxY, boxW, boxH, 1.4, `sub:${activeCue.start}`);
    wetWash(ctx, subPts, "#FFFDF7", { alpha: 0.96, pool: 0.15, bleed: 1.8, rim: false, dx: 2, dy: 2 });
    penStroke(ctx, subPts, {
      closed: true,
      width: 2.2,
      color: PAL.ink,
      alpha: 0.9,
      wobble: 1.1,
      retrace: true,
      seed: `sub-pen:${activeCue.start}`
    });

    let curX = (W - totalW) / 2;
    const centerY = boxY + boxH / 2 + 1;
    for (let i = 0; i < words.length; i++) {
      const w = words[i];
      const txt = w.display || w.word;
      const isSpoken = t >= w.start - 0.04 && t <= w.end + 0.08;
      const isPast = t > w.end + 0.08;

      if (isSpoken) {
        const hlPts = sketchyRectPts(curX - 4, centerY - 16, wordWidths[i] + 8, 32, 1.0, `hl:${i}`);
        wetWash(ctx, hlPts, PAL.gold, { alpha: 0.55, pool: 0.2, bleed: 1.5, rim: false, dx: 0, dy: 0 });
        ctx.fillStyle = PAL.crimson;
      } else if (isPast) {
        ctx.fillStyle = PAL.ink;
      } else {
        ctx.fillStyle = PAL.inkSoft;
      }
      ctx.textAlign = "left";
      ctx.fillText(txt, curX, centerY);
      curX += wordWidths[i] + spaceW;
    }

    ctx.restore();
  }

  function drawBrushWipe(ctx, progress) {
    if (progress <= 0 || progress >= 1) return;
    const cols = [PAL.teal, PAL.amber, PAL.paper, PAL.gold, PAL.cobalt];
    const nStrips = 5;
    const stripH = (H + 200) / nStrips;

    ctx.save();
    for (let i = 0; i < nStrips; i++) {
      const delay = [0, 0.12, 0.05, 0.16, 0.08][i];
      const p = progress < 0.5
        ? easeOutCubic(clamp((progress * 2 - delay) / (1 - delay), 0, 1))
        : easeInOutCubic(clamp(((progress - 0.5) * 2 - delay) / (1 - delay), 0, 1));
      const x0 = progress < 0.5 ? -150 : lerp(-150, W + 150, p);
      const x1 = progress < 0.5 ? lerp(-150, W + 150, p) : W + 150;
      if (x1 - x0 < 30) continue;

      const y0 = -60 + i * stripH;
      const pts = sketchyRectPts(x0, y0, x1 - x0, stripH + 25, 6.0, `cwipe:${i}`);
      wetWash(ctx, pts, cols[i % cols.length], {
        alpha: 0.88,
        pool: 0.4,
        bleed: 5,
        rim: true,
        dx: 0,
        dy: 0,
        seed: `cwipe-w:${i}`
      });
      penStroke(ctx, pts, {
        closed: true,
        width: 2.8,
        color: PAL.ink,
        alpha: 0.7,
        wobble: 2.4,
        retrace: true,
        seed: `cwipe-p:${i}`
      });
    }
    ctx.restore();
  }

  window.ENG = {
    W,
    H,
    PAL,
    beginFrameProbes,
    recordProbe,
    analyzeFrameProbes,
    drawText,
    hashStr,
    rngFor,
    noise2D,
    fractalNoise,
    clamp,
    lerp,
    invLerp,
    easeOutCubic,
    easeInCubic,
    easeInOutCubic,
    easeOutBack,
    smoothstep,
    windowEnv,
    lerpColor,
    smoothCurve,
    sketchyRectPts,
    sketchyCirclePts,
    wetWash,
    penStroke,
    scribbleHatchRect,
    drawPaperStrip,
    getStaticBackdrop,
    drawArchivalCard,
    drawLensGuide,
    drawTopHUD,
    drawSubtitles,
    drawBrushWipe
  };
})();
