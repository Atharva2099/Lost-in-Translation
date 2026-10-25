// experiments/exp002_convolution/src/scenes/act2.js
// Act II (45.70s – 96.10s) — Pedagogical Revision v2:
// Spatial Contiguity & Physical Integration (No Split-Attention Prose Boxes!)
// Shot 2.1 (45.7s - 68.1s): One Giant Center Stage where Input x[0..2] and Echo h[0..2] Physically Flip into Vertical Alignment
// Shot 2.2 (68.1s - 96.1s): Tactile Slide Rule [1, 2, 3] * [4, 5, 6] = [4, 13, 28, 27, 18] with Direct Vertical Multiplication Beams

(function () {
  const {
    W, H, PAL, clamp, lerp, invLerp,
    easeOutCubic, easeInOutCubic, easeOutBack,
    windowEnv, sketchyRectPts, sketchyCirclePts,
    wetWash, penStroke, scribbleHatchRect,
    drawPaperStrip, drawArchivalCard, drawLensGuide,
    drawText
  } = window.ENG;

  function renderAct2(ctx, t) {
    // =========================================================================
    // SHOT 2.1 (46.80s – 69.00s): SPATIALLY INTEGRATED FLIP MECHANISM
    // =========================================================================
    const env21 = windowEnv(t, 46.7, 69.1, 0.5, 0.55);
    if (env21 > 0.001) {
      ctx.save();
      ctx.globalAlpha = env21;

      const sx = 84, sy = 96, sw = 1752, sh = 790;
      drawArchivalCard(ctx, sx, sy, sw, sh, {
        header: "WHY WE FLIP · ALIGNING PAIRS AT STEP n = 2",
        accent: PAL.amber
      });

      const cellW = 285;
      const cellH = 128;
      const stripX = sx + (sw - cellW * 3) / 2;
      const topY = sy + 135;
      const botY = sy + 445;

      // Top Fixed Input Strip: x[0], x[1], x[2]
      // At t = 50.1s ("newest inputs hit the fresh head h[0]"), highlight x[2]!
      // At t = 54.4s ("older inputs hit the older tail h[1] and h[2]"), highlight x[1] and x[0]!
      const hiNewest = t >= 50.0 && t < 60.8;
      const hiOlder = t >= 54.3 && t < 60.8;
      const isFlipped = t >= 63.0;
      const flipAnim = easeInOutCubic(invLerp(62.2, 63.8, t));

      drawPaperStrip(ctx, stripX, topY, cellW, cellH, [
        { sub: "OLDEST (k=0)", val: "x[0]", fill: hiOlder || isFlipped ? "#CEDDF2" : "#F7EFE0", font: "800 34px 'JetBrains Mono', monospace", highlight: hiOlder || isFlipped },
        { sub: "1 STEP AGO (k=1)", val: "x[1]", fill: hiOlder || isFlipped ? "#C7EAE3" : "#F7EFE0", font: "800 34px 'JetBrains Mono', monospace", highlight: hiOlder || isFlipped },
        { sub: "NEWEST (k=2)", val: "x[2]", fill: hiNewest || isFlipped ? "#FCE09B" : "#F7EFE0", font: "800 34px 'JetBrains Mono', monospace", highlight: hiNewest || isFlipped }
      ], {
        seed: "v2-s21-x",
        title: "INPUT x[k]:"
      });

      // Connecting Multiplication Beams Between x[k] and h!
      // Before flip (49.5s - 61.4s): diagonal crossing lines showing x[2] reaching across to h[0], and x[0] reaching across to h[2]!
      // After flip (t >= 62.2s): straight vertical beams showing how flipping untangles the cross into clean vertical columns!
      if (t >= 50.0) {
        const beamAlpha = easeOutCubic(invLerp(50.0, 51.0, t));
        ctx.save();
        ctx.globalAlpha = env21 * beamAlpha;

        const c0 = stripX + cellW * 0.5;
        const c1 = stripX + cellW * 1.5;
        const c2 = stripX + cellW * 2.5;
        const yTopEdge = topY + cellH + 10;
        const yBotEdge = botY - 10;

        // Interpolate bottom connection points from unflipped (crossed) to flipped (vertical)
        const botX_for_x2 = lerp(c0, c2, flipAnim); // x[2] connects to h[0] (which moves from c0 to c2!)
        const botX_for_x1 = c1;                     // x[1] connects to h[1] (always at c1!)
        const botX_for_x0 = lerp(c2, c0, flipAnim); // x[0] connects to h[2] (which moves from c2 to c0!)

        // Draw beam for x[2] * h[0]
        penStroke(ctx, [[c2, yTopEdge], [botX_for_x2, yBotEdge]], {
          width: 4.2, color: PAL.amber, wobble: 1.0, retrace: true, seed: "beam-x2"
        });
        // Draw beams for x[1]*h[1] and x[0]*h[2] once "older inputs" is spoken at 54.3s
        if (t >= 54.3) {
          penStroke(ctx, [[c1, yTopEdge], [botX_for_x1, yBotEdge]], {
            width: 4.2, color: PAL.teal, wobble: 1.0, retrace: true, seed: "beam-x1"
          });
          penStroke(ctx, [[c0, yTopEdge], [botX_for_x0, yBotEdge]], {
            width: 4.2, color: PAL.cobalt, wobble: 1.0, retrace: true, seed: "beam-x0"
          });
        }

        // Badge in the middle of the beams showing the untangling!
        const badgePts = sketchyRectPts(stripX + cellW - 20, topY + cellH + 58, cellW + 40, 56, 1.3, "beam-badge");
        wetWash(ctx, badgePts, isFlipped ? "#FAD37A" : "#F7CBC7", { alpha: 0.94, pool: 0.2, bleed: 1.5, rim: true, dx: 0, dy: 0 });
        penStroke(ctx, badgePts, { closed: true, width: 2.2, color: PAL.ink, wobble: 0.9, retrace: false, seed: "beam-bp" });
        drawText(
          ctx,
          isFlipped ? "VERTICAL ALIGNMENT! ✓" : "CROSSED PAIRS (UNFLIPPED)",
          stripX + cellW * 1.5,
          topY + cellH + 86,
          { font: "800 18px 'JetBrains Mono', monospace", color: isFlipped ? PAL.crimson : PAL.ink, align: "center" }
        );
        ctx.restore();
      }

      // Bottom Echo Strip: Flips horizontally in 2D at t = 61.4s..63.0s
      ctx.save();
      const centerX = stripX + (cellW * 3) / 2;
      const centerY = botY + cellH / 2;
      const scaleX = Math.cos(flipAnim * Math.PI);
      ctx.translate(centerX, centerY);
      ctx.scale(Math.max(0.08, Math.abs(scaleX)), 1);
      ctx.translate(-centerX, -centerY);

      const hCells = isFlipped
        ? [
            { sub: "2−0 = 2", val: "h[2]", fill: "#CEDDF2", font: "800 34px 'JetBrains Mono', monospace", highlight: true },
            { sub: "2−1 = 1", val: "h[1]", fill: "#C7EAE3", font: "800 34px 'JetBrains Mono', monospace", highlight: true },
            { sub: "2−2 = 0", val: "h[0]", fill: "#FCE09B", font: "800 34px 'JetBrains Mono', monospace", highlight: true }
          ]
        : [
            { sub: "FRESH HEAD", val: "h[0]", fill: "#FCE09B", font: "800 34px 'JetBrains Mono', monospace", highlight: hiNewest },
            { sub: "1-STEP TAIL", val: "h[1]", fill: "#C7EAE3", font: "800 34px 'JetBrains Mono', monospace", highlight: hiOlder },
            { sub: "2-STEP TAIL", val: "h[2]", fill: "#CEDDF2", font: "800 34px 'JetBrains Mono', monospace", highlight: hiOlder }
          ];

      drawPaperStrip(ctx, stripX, botY, cellW, cellH, hCells, {
        seed: isFlipped ? "v2-s21-h-flip" : "v2-s21-h-orig",
        title: isFlipped ? "FLIPPED h[2−k]:" : "ECHO h[m]:",
        titleColor: isFlipped ? PAL.crimson : PAL.teal
      });
      ctx.restore();

      // Bottom Single Clean Formula Anchor (appears after flip during the 2.0s Watch Beat at 63.5s)
      if (t >= 63.2) {
        const fEnv = easeOutBack(invLerp(63.2, 64.1, t));
        ctx.save();
        ctx.globalAlpha = env21 * clamp(fEnv, 0, 1);
        const eqPts = sketchyRectPts(stripX - 30, botY + cellH + 48, cellW * 3 + 60, 96, 1.5, "v2-s21-eq");
        wetWash(ctx, eqPts, "#FCE4B4", { alpha: 0.94, pool: 0.25, bleed: 2, rim: true, dx: 1, dy: 1 });
        penStroke(ctx, eqPts, { closed: true, width: 2.6, color: PAL.crimson, wobble: 1.1, retrace: true, seed: "v2-s21-eqp" });

        drawText(ctx, "y[2]  =  x[0]·h[2]   +   x[1]·h[1]   +   x[2]·h[0]", centerX, botY + cellH + 96, {
          font: "800 28px 'JetBrains Mono', monospace",
          color: PAL.ink,
          align: "center"
        });
        ctx.restore();
      }

      drawLensGuide(ctx, sx + sw - 95, sy + 135, 1.0, t, isFlipped ? "excited" : "flip", isFlipped ? "ALIGNED!" : "FLIP!");
      ctx.restore();
    }

    // =========================================================================
    // SHOT 2.2 (68.90s – 98.50s): TACTILE SLIDE RULE [1, 2, 3] * [4, 5, 6]
    // =========================================================================
    const env22 = windowEnv(t, 68.9, 98.6, 0.45, 0.55);
    if (env22 > 0.001) {
      ctx.save();
      ctx.globalAlpha = env22;

      const sx = 84, sy = 96, sw = 1752, sh = 790;
      drawArchivalCard(ctx, sx, sy, sw, sh, {
        header: "SLIDING STRIP · [ 1, 2, 3 ] ∗ [ 4, 5, 6 ]",
        accent: PAL.crimson
      });

      let stepFloat = 0;
      if (t < 85.2) {
        stepFloat = 0;
      } else if (t < 88.0) {
        stepFloat = easeInOutCubic(invLerp(85.2, 85.8, t)) * 1;
      } else if (t < 94.8) {
        stepFloat = 1 + easeInOutCubic(invLerp(88.0, 88.8, t)) * 1;
      } else if (t < 96.4) {
        stepFloat = 2 + easeInOutCubic(invLerp(94.8, 95.2, t)) * 1;
      } else {
        stepFloat = 3 + easeInOutCubic(invLerp(96.4, 96.8, t)) * 1;
      }
      const activeStep = Math.round(stepFloat);

      const cellW = 182;
      const cellH = 104;
      const gridOriginX = sx + 235;
      const xStripX = gridOriginX + 2 * cellW;
      const xStripY = sy + 92;

      // 1. Fixed Top Input Strip: [1, 2, 3]
      drawPaperStrip(ctx, xStripX, xStripY, cellW, cellH, [
        { sub: "x[0]", val: "1", fill: "#FCE09B", font: "800 34px 'JetBrains Mono', monospace", highlight: activeStep >= 0 && activeStep <= 2 && t >= 79.4 },
        { sub: "x[1]", val: "2", fill: "#FCE09B", font: "800 34px 'JetBrains Mono', monospace", highlight: activeStep >= 1 && activeStep <= 3 && t >= 79.4 },
        { sub: "x[2]", val: "3", fill: "#FCE09B", font: "800 34px 'JetBrains Mono', monospace", highlight: activeStep >= 2 && activeStep <= 4 && t >= 79.4 }
      ], {
        seed: "v2-walk-x",
        title: "x:"
      });

      // 2. Sliding Bottom Kernel Strip: Flips from [4, 5, 6] to [6, 5, 4] at t = 76.2s..77.8s, then slides at t >= 79.4s
      const isFlippedWalk = t >= 77.0;
      const flipAnim = easeInOutCubic(invLerp(76.2, 77.8, t));
      const slideIntoStart = easeInOutCubic(invLerp(79.2, 80.4, t));
      const hStripX = isFlippedWalk
        ? lerp(xStripX, gridOriginX + stepFloat * cellW, slideIntoStart)
        : xStripX;
      const hStripY = sy + 285;

      ctx.save();
      if (t >= 76.1 && t <= 77.9) {
        const cxFlip = hStripX + (cellW * 3) / 2;
        const cyFlip = hStripY + cellH / 2;
        ctx.translate(cxFlip, cyFlip);
        ctx.scale(Math.max(0.08, Math.abs(Math.cos(flipAnim * Math.PI))), 1);
        ctx.translate(-cxFlip, -cyFlip);
      }

      const walkHCells = isFlippedWalk
        ? [
            { sub: "h[2]", val: "6", fill: "#C5EAE2", font: "800 34px 'JetBrains Mono', monospace", highlight: activeStep >= 2 && t >= 80.4 },
            { sub: "h[1]", val: "5", fill: "#C5EAE2", font: "800 34px 'JetBrains Mono', monospace", highlight: activeStep >= 1 && activeStep <= 3 && t >= 80.4 },
            { sub: "h[0]", val: "4", fill: "#C5EAE2", font: "800 34px 'JetBrains Mono', monospace", highlight: activeStep <= 2 && t >= 80.4 }
          ]
        : [
            { sub: "h[0]", val: "4", fill: "#CEDDF2", font: "800 34px 'JetBrains Mono', monospace" },
            { sub: "h[1]", val: "5", fill: "#CEDDF2", font: "800 34px 'JetBrains Mono', monospace" },
            { sub: "h[2]", val: "6", fill: "#CEDDF2", font: "800 34px 'JetBrains Mono', monospace" }
          ];

      drawPaperStrip(ctx, hStripX, hStripY, cellW, cellH, walkHCells, {
        seed: isFlippedWalk ? "v2-walk-h-flip" : "v2-walk-h-orig",
        title: isFlippedWalk ? "h[n−k]:" : "h[k]:",
        titleColor: isFlippedWalk ? PAL.teal : PAL.cobalt
      });
      ctx.restore();

      // 3. Spatially Integrated Vertical Multiplication Beams between Overlapping Cells!
      if (t >= 80.4) {
        const xVals = [1, 2, 3];
        const hFlippedVals = [6, 5, 4];
        for (let xi = 0; xi < 3; xi++) {
          const gridCol = 2 + xi;
          const hi = gridCol - activeStep;
          if (hi >= 0 && hi < 3) {
            const beamX = gridOriginX + (gridCol + 0.5) * cellW;
            const prod = xVals[xi] * hFlippedVals[hi];

            penStroke(ctx, [[beamX, xStripY + cellH + 6], [beamX, hStripY - 6]], {
              width: 3.8, color: PAL.crimson, wobble: 0.8, retrace: true, seed: `v2-pbeam:${xi}`
            });

            const pPill = sketchyRectPts(beamX - 48, xStripY + cellH + 22, 96, 44, 1.1, `v2-ppill:${xi}`);
            wetWash(ctx, pPill, "#FAD37A", { alpha: 0.96, pool: 0.2, bleed: 1.2, rim: true, dx: 0, dy: 0 });
            penStroke(ctx, pPill, { closed: true, width: 2.0, color: PAL.ink, wobble: 0.8, retrace: false, seed: `v2-ppillp:${xi}` });

            drawText(ctx, `=${prod}`, beamX, xStripY + cellH + 44, {
              font: "800 22px 'JetBrains Mono', monospace",
              color: PAL.crimson,
              align: "center"
            });
          }
        }
      }

      // 4. Clean Arithmetic Readout Pill (Numbers only, no prose sentence!)
      const stepMath = [
        "1 × 4  =  4",
        "5 + 8  =  13",
        "6 + 10 + 12  =  28",
        "12 + 15  =  27",
        "3 × 6  =  18"
      ];
      const mathBox = sketchyRectPts(sx + 420, sy + 432, sw - 840, 88, 1.5, `v2-math:${activeStep}`);
      wetWash(ctx, mathBox, activeStep === 2 && t >= 88.2 ? "#FAD37A" : "#F7EFE0", {
        alpha: 0.94, pool: 0.25, bleed: 2, rim: true, dx: 1, dy: 1
      });
      penStroke(ctx, mathBox, {
        closed: true, width: 2.5, color: activeStep === 2 && t >= 88.2 ? PAL.crimson : PAL.ink, wobble: 1.1, retrace: true, seed: `v2-mathp:${activeStep}`
      });

      drawText(
        ctx,
        t < 80.4 ? "[ 4, 5, 6 ]  →  FLIP  →  [ 6, 5, 4 ]" : stepMath[activeStep],
        sx + sw / 2,
        sy + 476,
        {
          font: "800 30px 'JetBrains Mono', monospace",
          color: activeStep === 2 && t >= 88.2 ? PAL.crimson : PAL.ink,
          align: "center"
        }
      );

      // 5. Bottom Output Sequence Strip y = [ 4, 13, 28, 27, 18 ]
      const outValues = [4, 13, 28, 27, 18];
      const outUnlockTimes = [82.6, 85.4, 91.5, 94.9, 96.5];
      const outCells = outValues.map((v, idx) => {
        const unlocked = t >= outUnlockTimes[idx];
        const isCurrent = t >= 80.4 && activeStep === idx && unlocked;
        return {
          sub: `y[${idx}]`,
          val: unlocked ? String(v) : "·",
          fill: isCurrent ? "#FAD37A" : unlocked ? "#FCE8C2" : "#EFECE6",
          font: "800 32px 'JetBrains Mono', monospace",
          textColor: unlocked ? (idx === 2 ? PAL.crimson : PAL.ink) : PAL.steel,
          highlight: isCurrent,
          stroke: idx === 2 ? PAL.crimson : PAL.amber
        };
      });

      drawPaperStrip(ctx, gridOriginX + cellW, sy + 565, cellW, 114, outCells, {
        seed: "v2-walk-out",
        title: "y[n]:",
        titleColor: PAL.crimson
      });

      drawLensGuide(ctx, sx + sw - 95, sy + 135, 1.0, t, activeStep === 2 && t >= 88.2 ? "excited" : "curious", activeStep === 2 && t >= 88.2 ? "28!" : `n=${activeStep}`);
      ctx.restore();
    }
  }

  window.ACT2 = { renderAct2 };
})();
