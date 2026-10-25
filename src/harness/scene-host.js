// Executed only inside an opaque-origin, sandboxed browser frame. Never in Node.
function installScene(source, width, style) {
  const W = 1080, H = 1920;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = Math.round(width * H / W);
  canvas.style.cssText = "width:100vw;height:100vh;display:block";
  document.body.append(canvas);
  const ctx = canvas.getContext("2d", { alpha: false });
  const engine = window.ENG;
  const press = style === "risograph" ? window.Riso.press({ px: [width, canvas.height], k: width / W }) : null;
  const tracked = new WeakSet();
  const PAL = Object.freeze({ paper: "#FAF5E8", ink: "#241E28", accent: "#2A857E", gold: "#E8A838", red: "#C83E37" });
  let texts = [], securityViolations = 0;
  document.addEventListener("securitypolicyviolation", () => securityViolations++);
  function trackText(context) {
    if (tracked.has(context)) return context;
    tracked.add(context);
    const nativeFillText = context.fillText.bind(context);
    context.fillText = function (text, x, y, maxWidth) {
    const m = context.measureText(String(text));
    const k = W / canvas.width;
    const matrix = context.getTransform();
    const corners = [[x - m.actualBoundingBoxLeft, y - m.actualBoundingBoxAscent],
      [x + m.actualBoundingBoxRight, y - m.actualBoundingBoxAscent],
      [x - m.actualBoundingBoxLeft, y + m.actualBoundingBoxDescent],
      [x + m.actualBoundingBoxRight, y + m.actualBoundingBoxDescent]]
      .map(([px, py]) => [k * (matrix.a * px + matrix.c * py + matrix.e), k * (matrix.b * px + matrix.d * py + matrix.f)]);
    if (context.globalAlpha > 0.05) texts.push({ text: String(text),
      box: [Math.min(...corners.map((p) => p[0])), Math.min(...corners.map((p) => p[1])),
        Math.max(...corners.map((p) => p[0])), Math.max(...corners.map((p) => p[1]))] });
    return maxWidth === undefined ? nativeFillText(text, x, y) : nativeFillText(text, x, y, maxWidth);
  };
    return context;
  }
  trackText(ctx);
  const ink = (color) => color === PAL.accent || color === "blue" ? "blue" : color === PAL.gold || color === "yellow" ? "yellow" : color === PAL.red || color === "pink" ? "pink" : "navy";
  const plate = (name = "navy", kind = "solid") => trackText(press.plate(name, kind));
  function prepared(points, closed) {
    if (!Array.isArray(points) || points.length < 2 || points.length > 2000 || points.some((p) => !Array.isArray(p) || p.length !== 2 || !p.every(Number.isFinite))) throw new Error("Invalid stroke geometry.");
    const clean = points.filter((p, i) => !i || Math.hypot(p[0] - points[i - 1][0], p[1] - points[i - 1][1]) > 0.001);
    if (clean.length < 2) return clean;
    if (closed && Math.hypot(clean[0][0] - clean.at(-1)[0], clean[0][1] - clean.at(-1)[1]) < 0.001) clean.pop();
    const path = closed ? [...clean, clean[0]] : clean;
    const dense = engine.densify(path, 60);
    return closed ? dense.slice(0, -1) : dense;
  }
  const kit = Object.freeze({
    W, H, PAL, clamp: engine.clamp, lerp: engine.lerp, ease: engine.easeInOutCubic, rng: engine.rngFor,
    riso: press ? Object.freeze({ plate, tone: window.Riso.tone, knockout: (fn) => press.knockout(fn), ramp: window.Riso.ramp, radial: window.Riso.radial }) : null,
    stroke(points, options = {}) { engine.penStroke(press ? plate(ink(options.color)) : ctx, prepared(points, options.closed), { width: 5, color: PAL.ink, seed: "stroke", ...options, ...(press ? { color: "#000" } : {}) }); },
    circle(x, y, r, options = {}) {
      const points = Array.from({ length: 49 }, (_, i) => [x + r * Math.cos(i * Math.PI / 24), y + r * Math.sin(i * Math.PI / 24)]);
      engine.penStroke(press ? plate(ink(options.color)) : ctx, points, { closed: true, width: 5, color: PAL.ink, seed: "circle", ...options, ...(press ? { color: "#000" } : {}) });
    },
    wash(points, color, options = {}) { engine.wetWash(press ? plate(ink(color), "screen") : ctx, prepared(points, true), press ? "#000000" : color, { alpha: 0.3, bleed: 2, dx: 0, dy: 0, seed: "wash", ...options }); },
    label(text, x, y, options = {}) {
      const target = press ? plate(ink(options.color)) : ctx;
      target.save();
      target.font = press ? `800 ${options.size || 48}px 'Trebuchet MS', sans-serif` : `${options.size || 48}px 'Chalkboard SE', 'Comic Sans MS', sans-serif`;
      target.fillStyle = press ? "#000" : options.color || PAL.ink;
      target.textAlign = options.align || "center";
      target.fillText(String(text), x, y);
      target.restore();
    }
  });
  Object.defineProperty(Math, "random", { value() { throw new Error("Use kit.rng with a stable seed, not Math.random."); }, writable: false });
  const scene = new Function('"use strict";\n' + source)();
  if (!scene || typeof scene.draw !== "function" || !Number.isFinite(scene.duration) || scene.duration < 10 || scene.duration > 15) {
    throw new Error("Scene must return {duration:10..15, draw(ctx,t,kit)}.");
  }
  function renderAt(t) {
    if (!Number.isFinite(t) || t < 0 || t > scene.duration) throw new Error("Invalid seek time.");
    canvas.width = width; // Reset transforms, clipping, and state before every seek.
    texts = [];
    if (press) {
      press.each((g) => { g.reset(); g.setTransform(width / W, 0, 0, width / W, 0, 0); });
      press.begin(Math.floor(t * 12) / 12);
    }
    ctx.scale(width / W, width / W);
    ctx.fillStyle = style === "line" ? "#FFFDF8" : PAL.paper;
    ctx.fillRect(0, 0, W, H);
    const result = scene.draw(ctx, press ? Math.floor(t * 12) / 12 : t, kit);
    if (result && typeof result.then === "function") throw new Error("draw must be synchronous.");
    if (press) press.print(ctx, { key: Math.floor(t * 12) / 12 });
    const warnings = [];
    for (const item of texts) {
      const [x0, y0, x1, y1] = item.box;
      if (![x0, y0, x1, y1].every(Number.isFinite)) warnings.push("Non-finite text geometry.");
      else if (x0 < 54 || x1 > 1026 || y0 < 150 || y1 > 1670) warnings.push(`Text crosses portrait safe region: ${item.text.slice(0, 80)}`);
    }
    for (let i = 0; i < texts.length; i++) for (let j = i + 1; j < texts.length; j++) {
      const a = texts[i].box, b = texts[j].box;
      if (Math.min(a[2], b[2]) - Math.max(a[0], b[0]) > 4 && Math.min(a[3], b[3]) - Math.max(a[1], b[1]) > 4) {
        warnings.push("Overlapping text bounds.");
      }
    }
    const proseCounts = texts.map((item) => /[=Σ∫×÷]/u.test(item.text) ? 0 : (item.text.match(/\p{L}+/gu) || []).length);
    const proseWords = proseCounts.reduce((sum, count) => sum + count, 0);
    const longProseBlocks = proseCounts.filter((count) => count >= 6).length;
    // Experimental production heuristic, not a universal learning-science limit.
    const densityWarnings = proseWords > 30 || longProseBlocks >= 3 ? ["Reduce redundant prose: use concise labels and let the mechanism explain."] : [];
    return { warnings: [...new Set(warnings)], density_warnings: densityWarnings, prose_words: proseWords, long_prose_blocks: longProseBlocks,
      words: texts.reduce((n, item) => n + (item.text.match(/[\p{L}\p{N}]+/gu) || []).length, 0),
      text_blocks: texts.length, security_violations: securityViolations };
  }
  window.__sceneHost = Object.freeze({ renderAt, duration: scene.duration });
  return { duration: scene.duration };
}

module.exports = { installScene };
