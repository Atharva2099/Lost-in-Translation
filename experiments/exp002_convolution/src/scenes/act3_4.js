// experiments/exp002_convolution/src/scenes/act3_4.js
// Act III (96.10s – 120.40s) & Act IV (120.40s – 143.80s) — Pedagogical Revision v2:
// Spatial Contiguity, Zero Prose Sentences on Canvas, & Unspoken Observation Windows

(function () {
  const {
    W, H, PAL, clamp, lerp, invLerp,
    easeOutCubic, easeInOutCubic, easeOutBack,
    windowEnv, sketchyRectPts, sketchyCirclePts,
    wetWash, penStroke, scribbleHatchRect,
    drawPaperStrip, drawArchivalCard, drawLensGuide,
    drawText, lerpColor
  } = window.ENG;

  const RAW_SIGNAL = [
    0.18, 0.22, 0.65, 0.25, 0.30, 0.85, 0.78, 0.32,
    0.92, 0.28, 0.35, 0.42, 0.88, 0.45, 0.20, 0.62,
    0.24, 0.18, 0.55, 0.22
  ];
  const SMOOTH_SIGNAL = RAW_SIGNAL.map((v, i) => {
    const prev = RAW_SIGNAL[Math.max(0, i - 1)];
    const next = RAW_SIGNAL[Math.min(RAW_SIGNAL.length - 1, i + 1)];
    return 0.25 * prev + 0.50 * v + 0.25 * next;
  });

  function renderAct3_4(ctx, t) {
    // =========================================================================
    // SHOT 3.1 (98.50s – 112.50s): MOVING AVERAGE SMOOTHING ([1/4, 1/2, 1/4])
    // =========================================================================
    const env31 = windowEnv(t, 98.4, 112.6, 0.5, 0.55);
    if (env31 > 0.001) {
      ctx.save();
      ctx.globalAlpha = env31;

      const px = 84, py = 96, pw = 1752, ph = 790;
      drawArchivalCard(ctx, px, py, pw, ph, {
        header: "MOVING AVERAGE · SMOOTHING KERNEL [ ¼, ½, ¼ ]",
        accent: PAL.teal
      });

      // Top Centered Paper Strip for [1/4, 1/2, 1/4]
      drawPaperStrip(ctx, px + 460, py + 72, 220, 102, [
        { sub: "h[−1]", val: "1/4", fill: "#C5EAE2", font: "800 30px 'JetBrains Mono', monospace" },
        { sub: "h[0]", val: "1/2", fill: "#FCE09B", font: "800 32px 'JetBrains Mono', monospace", highlight: true },
        { sub: "h[+1]", val: "1/4", fill: "#C5EAE2", font: "800 30px 'JetBrains Mono', monospace" }
      ], {
        seed: "v2-smooth-strip",
        title: "Σ h = 1 :"
      });

      // Waveform Plot Area (y = py + 230 .. py + 710)
      const plotLeft = px + 115;
      const plotRight = px + pw - 95;
      const plotW = plotRight - plotLeft;
      const baseY = py + 695;
      const maxH = 420;

      penStroke(ctx, [[plotLeft - 20, baseY], [plotRight + 20, baseY]], {
        width: 2.4, color: PAL.ink, wobble: 1.0, retrace: true, seed: "v2-act3-axis"
      });

      // Sliding window scans across from t = 104.5s to t = 111.8s
      const scanProgress = clamp((t - 104.5) / 7.2, 0, 1);
      const scanIdxFloat = scanProgress * (RAW_SIGNAL.length - 1);
      const scanIdx = Math.round(scanIdxFloat);

      const rawPts = RAW_SIGNAL.map((v, i) => [
        plotLeft + (i / (RAW_SIGNAL.length - 1)) * plotW,
        baseY - v * maxH
      ]);

      penStroke(ctx, rawPts, {
        width: 2.2, color: PAL.steel, alpha: 0.55, wobble: 0.9, retrace: false, seed: "v2-raw-poly"
      });

      rawPts.forEach(([sx, sy], i) => {
        const inWin = Math.abs(i - scanIdx) <= 1 && t >= 101.8;
        const cPts = sketchyCirclePts(sx, sy, inWin ? 10 : 6, inWin ? 10 : 6, 10, 0.8, `v2-rpt:${i}`);
        wetWash(ctx, cPts, inWin ? PAL.gold : "#D8D2C5", { alpha: 0.9, pool: 0, bleed: 1, rim: true, dx: 0, dy: 0 });
        penStroke(ctx, cPts, { closed: true, width: inWin ? 2.4 : 1.4, color: PAL.ink, wobble: 0.6, retrace: false, seed: `v2-rptp:${i}` });
      });

      // Sliding Averaging Loupe Window
      if (t >= 101.8) {
        const winCenterX = plotLeft + (scanIdxFloat / (RAW_SIGNAL.length - 1)) * plotW;
        const stepDx = plotW / (RAW_SIGNAL.length - 1);
        const boxPts = sketchyRectPts(winCenterX - stepDx * 1.35, py + 225, stepDx * 2.7, 485, 1.8, "v2-scan-win");
        wetWash(ctx, boxPts, "#FCE6B2", { alpha: 0.28, pool: 0.15, bleed: 2, rim: true, dx: 0, dy: 0 });
        penStroke(ctx, boxPts, { closed: true, width: 3.0, color: PAL.amber, wobble: 1.2, retrace: true, seed: "v2-scan-winp" });

        drawText(ctx, "[ ¼, ½, ¼ ]", winCenterX, py + 252, {
          font: "800 18px 'JetBrains Mono', monospace",
          color: PAL.crimson,
          align: "center",
          probe: false
        });
      }

      // Smoothed Output Curve
      const smoothPts = SMOOTH_SIGNAL.map((v, i) => [
        plotLeft + (i / (SMOOTH_SIGNAL.length - 1)) * plotW,
        baseY - v * maxH
      ]);

      if (scanProgress > 0.02) {
        const revealedCount = Math.max(2, Math.ceil(smoothPts.length * scanProgress));
        const areaPts = [
          [plotLeft, baseY],
          ...smoothPts.slice(0, revealedCount),
          [smoothPts[revealedCount - 1][0], baseY]
        ];
        wetWash(ctx, areaPts, "#B8E4DA", { alpha: 0.50, pool: 0.35, bleed: 2, rim: false, dx: 0, dy: 0 });

        penStroke(ctx, smoothPts, {
          width: 4.8,
          color: PAL.teal,
          alpha: 0.96,
          wobble: 1.1,
          retrace: true,
          progress: scanProgress,
          seed: "v2-smooth-curve"
        });
      }

      drawText(ctx, "x[n] (Noisy)", plotLeft + 20, py + 742, {
        font: "800 18px 'JetBrains Mono', monospace",
        color: PAL.inkSoft
      });
      drawText(ctx, "(x ∗ h)[n] (Smoothed)", plotLeft + 260, py + 742, {
        font: "800 18px 'JetBrains Mono', monospace",
        color: PAL.teal
      });

      drawLensGuide(ctx, px + pw - 95, py + 125, 1.0, t, "excited", "SMOOTH!");
      ctx.restore();
    }

    // =========================================================================
    // SHOT 3.2 (112.30s – 123.50s): CONTINUOUS CONVOLUTION INTEGRAL
    // =========================================================================
    const env32 = windowEnv(t, 112.3, 123.6, 0.5, 0.55);
    if (env32 > 0.001) {
      ctx.save();
      ctx.globalAlpha = env32;

      const rx = 84, ry = 96, rw = 1752, rh = 790;
      drawArchivalCard(ctx, rx, ry, rw, rh, {
        header: "CONTINUOUS LIMIT · Δτ → 0",
        accent: PAL.cobalt
      });

      // Top Clean Equation Transition: Discrete Sum -> Continuous Integral
      const eqPts = sketchyRectPts(rx + 180, ry + 68, rw - 360, 112, 1.5, "v2-int-eq");
      wetWash(ctx, eqPts, "#FCE2A6", { alpha: 0.94, pool: 0.25, bleed: 2, rim: true, dx: 1, dy: 1 });
      penStroke(ctx, eqPts, { closed: true, width: 2.6, color: PAL.ink, wobble: 1.1, retrace: true, seed: "v2-int-eqp" });

      drawText(
        ctx,
        "Σₖ f[k]·g[n − k]    →    (f ∗ g)(t)  =  ∫ f(τ) · g(t − τ) dτ",
        rx + rw / 2,
        ry + 124,
        { font: "800 30px 'JetBrains Mono', monospace", color: PAL.ink, align: "center" }
      );

      // Center Stage: Live Continuous Sliding Overlap Integral (x = rx + 140 .. rx + rw - 140)
      const slideT = clamp((t - 112.8) / 9.4, 0, 1);
      const gx0 = rx + 140, gx1 = rx + rw - 140, gw = gx1 - gx0;

      // Exact Mathematical Functions on u ∈ [0, 1]:
      // f(u): fixed Gaussian centered at μ_f = 0.48, σ_f = 0.145, amplitude A_f = 0.90
      // g(t - u): flipped sliding Gaussian centered at t = centerShift ∈ [0.16, 0.80], σ_g = 0.130, amplitude A_g = 0.88
      const evalF = (u) => 0.90 * Math.exp(-Math.pow((u - 0.48) / 0.145, 2));
      const evalG = (u, shift) => 0.88 * Math.exp(-Math.pow((u - shift) / 0.130, 2));

      // Top Subplot: f(τ), g(t - τ), Geometric Overlap Envelope min(f, g), and Exact Integrand Product f(τ)·g(t - τ)
      const yTopBase = ry + 435;
      const topScaleH = 215;

      const fCurve = [];
      const gCurve = [];
      const prodCurve = [];
      const prodPolygon = [[gx0, yTopBase]];
      const centerShift = 0.16 + slideT * 0.64;
      const N_SAMPLES_CURVE = 100;

      for (let i = 0; i <= N_SAMPLES_CURVE; i++) {
        const u = i / N_SAMPLES_CURVE;
        const xPx = gx0 + u * gw;
        const fv = evalF(u);
        const gv = evalG(u, centerShift);
        const pv = fv * gv;            // Exact pointwise product f(τ)·g(t-τ) (always <= min(f,g) since f,g < 1!)

        fCurve.push([xPx, yTopBase - fv * topScaleH]);
        gCurve.push([xPx, yTopBase - gv * topScaleH]);
        prodCurve.push([xPx, yTopBase - pv * topScaleH]);
        prodPolygon.push([xPx, yTopBase - pv * topScaleH]);
      }
      prodPolygon.push([gx1, yTopBase]);

      // Strictly Clipped Rich Gold Fill under the Exact Pointwise Product Curve f(τ)·g(t - τ)
      ctx.save();
      ctx.beginPath();
      prodPolygon.forEach(([px, py], i) => (i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)));
      ctx.closePath();
      ctx.clip();

      const prodGrad = ctx.createLinearGradient(0, yTopBase - topScaleH * 0.8, 0, yTopBase);
      prodGrad.addColorStop(0, "rgba(232, 173, 56, 0.82)");
      prodGrad.addColorStop(1, "rgba(224, 109, 50, 0.90)");
      ctx.fillStyle = prodGrad;
      ctx.fillRect(gx0, yTopBase - topScaleH, gw, topScaleH);
      scribbleHatchRect(ctx, gx0, yTopBase - topScaleH, gw, topScaleH, {
        color: PAL.amber,
        alpha: 0.22,
        gap: 8,
        angle: -0.55,
        width: 1.4,
        seed: "v3-prod-hatch"
      });
      ctx.restore();

      // Stroke the explicit Product Curve f(τ)·g(t-τ), the two parent curves f(τ) and g(t-τ), and the crisp axis line on top
      penStroke(ctx, prodCurve, { width: 2.6, color: PAL.amber, wobble: 0.6, retrace: false, seed: "v3-prod-c" });
      penStroke(ctx, fCurve, { width: 3.6, color: PAL.teal, wobble: 0.8, retrace: true, seed: "v2-f-tau" });
      penStroke(ctx, gCurve, { width: 3.6, color: PAL.crimson, wobble: 0.8, retrace: true, seed: "v2-g-t-tau" });
      penStroke(ctx, [[gx0, yTopBase], [gx1, yTopBase]], { width: 2.4, color: PAL.ink, wobble: 0.7, retrace: true, seed: "v2-c-ax1" });

      const fSideU = centerShift <= 0.48 ? 0.66 : 0.30;
      const fLabelX = gx0 + gw * fSideU;
      const fLabelY = yTopBase - evalF(fSideU) * topScaleH - 36;
      const gSideU = centerShift <= 0.48 ? centerShift - 0.16 : centerShift + 0.16;
      const gLabelX = gx0 + gw * gSideU;
      const gLabelY = yTopBase - evalG(gSideU, centerShift) * topScaleH - 36;

      drawText(ctx, "f(τ)", fLabelX, fLabelY, { font: "800 22px 'Chalkboard SE', sans-serif", color: PAL.teal, align: "center" });
      drawText(ctx, "g(t − τ)", gLabelX, gLabelY, { font: "800 22px 'Chalkboard SE', sans-serif", color: PAL.crimson, align: "center" });
      drawText(ctx, "∫ f(τ)·g(t−τ) dτ", gx0 + gw * ((0.48 + centerShift) * 0.5), yTopBase + 30, {
        font: "800 18px 'Chalkboard SE', sans-serif",
        color: PAL.amber,
        align: "center"
      });
      drawText(ctx, "τ →", gx1 + 26, yTopBase, { font: "800 18px 'Chalkboard SE', sans-serif", color: PAL.inkSoft, align: "left", probe: false });

      // Bottom Curve: Resulting (f * g)(t) Computed by True Trapezoidal Quadrature up to Current Shift t = centerShift!
      const yBotBase = ry + 725;
      const botScaleH = 210;

      const rawTrapIntegral = (shift) => {
        let sum = 0;
        const du = 1.0 / N_SAMPLES_CURVE;
        for (let k = 0; k <= N_SAMPLES_CURVE; k++) {
          const u = k * du;
          const w = (k === 0 || k === N_SAMPLES_CURVE) ? 0.5 : 1.0;
          sum += w * evalF(u) * evalG(u, shift) * du;
        }
        return sum;
      };
      const peakIntegral = rawTrapIntegral(0.48);
      const evalConvIntegral = (shift) => (rawTrapIntegral(shift) / peakIntegral) * 0.90;

      // Faint dotted guide showing full trajectory, plus solid blue curve drawn strictly up to centerShift!
      const fullConvCurve = [];
      const activeConvCurve = [];
      for (let i = 0; i <= N_SAMPLES_CURVE; i++) {
        const shiftU = 0.16 + (i / N_SAMPLES_CURVE) * 0.64;
        const xPx = gx0 + shiftU * gw;
        const cVal = evalConvIntegral(shiftU);
        const pt = [xPx, yBotBase - cVal * botScaleH];
        fullConvCurve.push(pt);
        if (shiftU <= centerShift + 1e-4) {
          activeConvCurve.push(pt);
        }
      }

      penStroke(ctx, fullConvCurve, { width: 1.6, color: PAL.steel, alpha: 0.28, wobble: 0.5, retrace: false, seed: "v3-conv-guide" });
      if (activeConvCurve.length >= 2) {
        // Soft watercolor area under the traced integral curve up to centerShift
        const botArea = [
          [activeConvCurve[0][0], yBotBase],
          ...activeConvCurve,
          [activeConvCurve[activeConvCurve.length - 1][0], yBotBase]
        ];
        ctx.save();
        ctx.beginPath();
        botArea.forEach(([px, py], i) => (i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)));
        ctx.closePath();
        ctx.clip();
        ctx.fillStyle = "rgba(40, 88, 166, 0.16)";
        ctx.fillRect(gx0, yBotBase - botScaleH, gw, botScaleH);
        ctx.restore();

        penStroke(ctx, activeConvCurve, {
          width: 4.6, color: PAL.cobalt, wobble: 0.9, retrace: true, seed: "v3-conv-out-c"
        });
      }
      penStroke(ctx, [[gx0, yBotBase], [gx1, yBotBase]], { width: 2.4, color: PAL.ink, wobble: 0.7, retrace: true, seed: "v2-c-ax2" });

      // Tracing dot sits at the EXACT live tip of activeConvCurve (x = gx0 + centerShift * gw)!
      const tipX = gx0 + centerShift * gw;
      const tipY = yBotBase - evalConvIntegral(centerShift) * botScaleH;

      // Vertical dashed plumb-line linking the sliding kernel center `t` on top directly to the tracing dot `(f*g)(t)` below!
      penStroke(ctx, [[tipX, yTopBase - evalG(centerShift, centerShift) * topScaleH], [tipX, tipY]], {
        width: 1.8, color: PAL.crimson, alpha: 0.45, wobble: 0.6, retrace: false, seed: "v3-plumb"
      });

      const dotPts = sketchyCirclePts(tipX, tipY, 11, 11, 10, 1.0, "v2-conv-dot");
      wetWash(ctx, dotPts, PAL.gold, { alpha: 0.95, pool: 0, bleed: 1, rim: true, dx: 0, dy: 0 });
      penStroke(ctx, dotPts, { closed: true, width: 2.6, color: PAL.crimson, wobble: 0.8, retrace: false, seed: "v2-conv-dotp" });

      drawText(ctx, "(f ∗ g)(t)", gx0 + 60, ry + 525, {
        font: "800 22px 'Chalkboard SE', sans-serif",
        color: PAL.cobalt
      });
      drawText(ctx, "t →", gx1 + 26, yBotBase, { font: "800 18px 'Chalkboard SE', sans-serif", color: PAL.inkSoft, align: "left", probe: false });

      drawLensGuide(ctx, rx + rw - 95, ry + 125, 1.0, t, "excited", "∫ dτ");
      ctx.restore();
    }

    // =========================================================================
    // SHOT 4.1 & 4.2 (123.50s – 147.50s): 2D IMAGE STENCIL (BLUR vs. EDGE)
    // =========================================================================
    const env4 = windowEnv(t, 123.4, 147.6, 0.5, 0.55);
    if (env4 > 0.001) {
      ctx.save();
      ctx.globalAlpha = env4;

      const isEdgeMode = t >= 136.8;

      const wx = 76, wy = 96, ww = 1768, wh = 790;
      drawArchivalCard(ctx, wx, wy, ww, wh, {
        header: isEdgeMode ? "2D KERNEL · VERTICAL EDGE DETECTOR (Σ K = 0)" : "2D KERNEL · 3×3 BOX BLUR (Σ K = 1)",
        accent: isEdgeMode ? PAL.crimson : PAL.teal
      });

      // 1. Left: 6x6 Input Pixel Grid I(x,y)
      const gridX0 = wx + 75;
      const gridY0 = wy + 135;
      const pCell = 82;

      drawText(ctx, "INPUT IMAGE I(x,y)", gridX0 + pCell * 3, wy + 96, {
        font: "800 20px 'JetBrains Mono', monospace",
        color: PAL.cobalt,
        align: "center"
      });

      const scanPos = Math.floor(((t - 124.0) * 1.5) % 16 + 16) % 16;
      const sc = isEdgeMode && t >= 141.5 ? 1 : scanPos % 4;
      const sr = isEdgeMode && t >= 141.5 ? 1 : Math.floor(scanPos / 4);

      for (let r = 0; r < 6; r++) {
        for (let c = 0; c < 6; c++) {
          const val = c < 3 ? 10 : 90;
          const px = gridX0 + c * pCell;
          const py = gridY0 + r * pCell;
          const inPatch = r >= sr && r < sr + 3 && c >= sc && c < sc + 3;
          const cPts = sketchyRectPts(px + 2, py + 2, pCell - 4, pCell - 4, 0.9, `v2-pix:${r}:${c}`);
          wetWash(ctx, cPts, c < 3 ? "#8A9BB0" : "#FCE6B2", { alpha: inPatch ? 0.94 : 0.42, pool: 0.15, bleed: 1, rim: false, dx: 0, dy: 0 });
          penStroke(ctx, cPts, { closed: true, width: inPatch ? 2.0 : 1.1, color: PAL.inkSoft, alpha: inPatch ? 0.9 : 0.38, wobble: 0.7, retrace: false, seed: `v2-pixp:${r}:${c}` });

          // Signaling Principle: Show crisp numbers only inside the active 3x3 stencil window so the eye isn't flooded with 36 numbers!
          if (inPatch) {
            drawText(ctx, String(val), px + pCell / 2, py + pCell / 2, {
              font: "800 22px 'JetBrains Mono', monospace",
              color: PAL.ink,
              align: "center",
              probe: false
            });
          }
        }
      }

      // Marching 3x3 Stencil Window Overlay
      const stX = gridX0 + sc * pCell;
      const stY = gridY0 + sr * pCell;
      const stPts = sketchyRectPts(stX - 4, stY - 4, pCell * 3 + 8, pCell * 3 + 8, 1.8, "v2-stencil-ov");
      penStroke(ctx, stPts, {
        closed: true,
        width: 4.8,
        color: isEdgeMode ? PAL.crimson : PAL.amber,
        wobble: 1.3,
        retrace: true,
        boilTime: t,
        seed: "v2-stencil-ovp"
      });

      // 2. Center: 3x3 Kernel Stencil K
      const kGridX = wx + 695;
      const kGridY = wy + 175;
      const kCell = 112;

      drawText(ctx, isEdgeMode ? "EDGE KERNEL K" : "BLUR KERNEL K", kGridX + kCell * 1.5, wy + 132, {
        font: "800 20px 'JetBrains Mono', monospace",
        color: isEdgeMode ? PAL.crimson : PAL.amber,
        align: "center"
      });

      const blurKernel = [
        ["1/9", "1/9", "1/9"],
        ["1/9", "1/9", "1/9"],
        ["1/9", "1/9", "1/9"]
      ];
      const edgeKernel = [
        ["−1", "0", "+1"],
        ["−2", "0", "+2"],
        ["−1", "0", "+1"]
      ];
      const activeK = isEdgeMode ? edgeKernel : blurKernel;

      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
          const kxCell = kGridX + c * kCell;
          const kyCell = kGridY + r * kCell;
          const kTxt = activeK[r][c];
          const kPts = sketchyRectPts(kxCell + 3, kyCell + 3, kCell - 6, kCell - 6, 1.2, `v2-kc:${r}:${c}`);
          const kWash = isEdgeMode
            ? c === 0
              ? "#F7CBC7"
              : c === 2
              ? "#FCE09B"
              : "#EFECE6"
            : "#C5EAE2";
          wetWash(ctx, kPts, kWash, { alpha: 0.94, pool: 0.25, bleed: 1.5, rim: true, dx: 1, dy: 1 });
          penStroke(ctx, kPts, { closed: true, width: 2.2, color: PAL.ink, wobble: 1.0, retrace: true, seed: `v2-kcp:${r}:${c}` });

          drawText(ctx, kTxt, kxCell + kCell / 2, kyCell + kCell / 2, {
            font: "800 26px 'JetBrains Mono', monospace",
            color: kTxt.startsWith("−") ? PAL.crimson : kTxt.startsWith("+") ? PAL.amber : PAL.ink,
            align: "center",
            probe: false
          });
        }
      }

      // Compute exact numerical output for current (sr, sc) patch
      let patchOut = 0;
      for (let dr = 0; dr < 3; dr++) {
        for (let dc = 0; dc < 3; dc++) {
          const pixVal = sc + dc < 3 ? 10 : 90;
          if (isEdgeMode) {
            const w = dc === 0 ? (dr === 1 ? -2 : -1) : dc === 2 ? (dr === 1 ? 2 : 1) : 0;
            patchOut += pixVal * w;
          } else {
            patchOut += pixVal / 9.0;
          }
        }
      }
      const patchStr = isEdgeMode ? (patchOut > 0 ? `+${Math.round(patchOut)}` : String(Math.round(patchOut))) : patchOut.toFixed(0);

      const eqBoxPts = sketchyRectPts(kGridX - 10, wy + 555, kCell * 3 + 20, 96, 1.5, "v2-k-out-box");
      wetWash(ctx, eqBoxPts, isEdgeMode ? "#FAD37A" : "#D6EDE8", { alpha: 0.94, pool: 0.25, bleed: 2, rim: true, dx: 1, dy: 1 });
      penStroke(ctx, eqBoxPts, { closed: true, width: 2.5, color: PAL.ink, wobble: 1.1, retrace: true, seed: "v2-k-outp" });

      drawText(ctx, `SUM = ${patchStr}`, kGridX + kCell * 1.5, wy + 603, {
        font: "800 32px 'JetBrains Mono', monospace",
        color: isEdgeMode && patchOut > 0 ? PAL.crimson : PAL.ink,
        align: "center"
      });

      // 3. Right: 4x4 Output Feature Map S(i,j)
      const outX0 = wx + 1185;
      const outY0 = wy + 155;
      const outCell = 112;

      drawText(ctx, isEdgeMode ? "EDGE MAP S(i,j)" : "BLUR MAP S(i,j)", outX0 + outCell * 2, wy + 96, {
        font: "800 20px 'JetBrains Mono', monospace",
        color: isEdgeMode ? PAL.crimson : PAL.teal,
        align: "center"
      });

      for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 4; c++) {
          let val = 0;
          for (let dr = 0; dr < 3; dr++) {
            for (let dc = 0; dc < 3; dc++) {
              const pv = c + dc < 3 ? 10 : 90;
              if (isEdgeMode) {
                const w = dc === 0 ? (dr === 1 ? -2 : -1) : dc === 2 ? (dr === 1 ? 2 : 1) : 0;
                val += pv * w;
              } else {
                val += pv / 9.0;
              }
            }
          }
          const ox = outX0 + c * outCell;
          const oy = outY0 + r * outCell;
          const isCurOut = r === sr && c === sc;
          const oPts = sketchyRectPts(ox + 3, oy + 3, outCell - 6, outCell - 6, 1.1, `v2-outc:${r}:${c}`);

          let fillCol;
          if (isEdgeMode) {
            fillCol = val > 100 ? PAL.gold : "#DCD6C8";
          } else {
            const u = (val - 10) / 80.0;
            fillCol = lerpColor("#8A9BB0", "#FCE6B2", u);
          }

          wetWash(ctx, oPts, fillCol, { alpha: 0.94, pool: 0.2, bleed: 1.5, rim: isCurOut, dx: 0, dy: 0 });
          penStroke(ctx, oPts, {
            closed: true,
            width: isCurOut ? 3.8 : 1.6,
            color: isCurOut ? PAL.crimson : PAL.inkSoft,
            wobble: 0.9,
            retrace: isCurOut,
            seed: `v2-outcp:${r}:${c}`
          });

          const vStr = isEdgeMode ? (val > 0 ? `+${Math.round(val)}` : "0") : val.toFixed(0);
          drawText(ctx, vStr, ox + outCell / 2, oy + outCell / 2, {
            font: "800 22px 'JetBrains Mono', monospace",
            color: isEdgeMode && val > 0 ? PAL.crimson : PAL.ink,
            align: "center",
            probe: false
          });
        }
      }

      drawLensGuide(ctx, wx + ww - 88, wy + 685, 0.95, t, isEdgeMode ? "excited" : "curious", isEdgeMode ? "EDGE!" : "BLUR!");
      ctx.restore();
    }
  }

  window.ACT3_4 = { renderAct3_4 };
})();
