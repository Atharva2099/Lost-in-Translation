// experiments/exp002_convolution/src/scenes/act5.js
// Act V (143.80s – 169.79s) — Pedagogical Revision v2:
// Clean Visual Contrast of True Convolution (180° Flip) vs. Deep Learning Cross-Correlation (No Flip)
// Followed by a Bold 4-Step Visual Finale (1. FLIP -> 2. SLIDE -> 3. MULTIPLY -> 4. SUM) with Zero Paragraph Clutter

(function () {
  const {
    W, H, PAL, clamp, lerp, invLerp,
    easeOutCubic, easeInOutCubic, easeOutBack,
    windowEnv, sketchyRectPts, sketchyCirclePts,
    wetWash, penStroke, scribbleHatchRect,
    drawPaperStrip, drawArchivalCard, drawLensGuide,
    drawText
  } = window.ENG;

  function drawKernel3x3(ctx, x, y, cell, vals, seed, highlightColor) {
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        const kx = x + c * cell;
        const ky = y + r * cell;
        const v = vals[r][c];
        const isCorner = (r === 0 && c === 0) || (r === 2 && c === 2);
        const pts = sketchyRectPts(kx + 2, ky + 2, cell - 4, cell - 4, 1.0, `${seed}:${r}:${c}`);
        const fill = r === 0 && c === 0
          ? "#FCE09B"
          : r === 2 && c === 2
          ? "#C5EAE2"
          : "#F7EFE0";
        wetWash(ctx, pts, fill, { alpha: 0.94, pool: 0.2, bleed: 1.2, rim: isCorner, dx: 0, dy: 0 });
        penStroke(ctx, pts, {
          closed: true,
          width: isCorner ? 2.6 : 1.5,
          color: isCorner ? highlightColor : PAL.inkSoft,
          wobble: 0.8,
          retrace: isCorner,
          seed: `${seed}p:${r}:${c}`
        });
        drawText(ctx, v, kx + cell / 2, ky + cell / 2, {
          font: "800 22px 'JetBrains Mono', monospace",
          color: PAL.ink,
          align: "center",
          probe: false
        });
      }
    }
  }

  function renderAct5(ctx, t) {
    // =========================================================================
    // SHOT 5.1 (147.50s – 164.80s): CONVOLUTION (∗) vs. CROSS-CORRELATION (⋆)
    // =========================================================================
    const env51 = windowEnv(t, 147.4, 164.9, 0.5, 0.55);
    if (env51 > 0.001) {
      ctx.save();
      ctx.globalAlpha = env51;

      const origK = [
        ["w₁", "w₂", "w₃"],
        ["w₄", "w₅", "w₆"],
        ["w₇", "w₈", "w₉"]
      ];
      const flippedK = [
        ["w₉", "w₈", "w₇"],
        ["w₆", "w₅", "w₄"],
        ["w₃", "w₂", "w₁"]
      ];

      // Left Bay: True Mathematical Convolution (I * K)
      const lx = 84, ly = 96, lw = 852, lh = 560;
      drawArchivalCard(ctx, lx, ly, lw, lh, {
        header: "MATH · CONVOLUTION (I ∗ K)",
        accent: PAL.teal
      });

      drawText(ctx, "(I ∗ K)(i,j) = Σ Σ I(i − m, j − n)·K(m,n)", lx + lw / 2, ly + 96, {
        font: "800 24px 'JetBrains Mono', monospace",
        color: PAL.ink,
        align: "center"
      });

      const kSize = 78;
      drawText(ctx, "K", lx + 185, ly + 172, { font: "800 20px 'JetBrains Mono', monospace", color: PAL.inkSoft, align: "center" });
      drawKernel3x3(ctx, lx + 68, ly + 195, kSize, origK, "v2-conv-k1", PAL.teal);

      penStroke(ctx, [[lx + 330, ly + 312], [lx + 455, ly + 312]], {
        width: 3.8, color: PAL.crimson, wobble: 0.9, retrace: true, seed: "v2-rot-arr"
      });
      drawText(ctx, "180° FLIP", lx + 392, ly + 282, {
        font: "800 18px 'JetBrains Mono', monospace",
        color: PAL.crimson,
        align: "center"
      });

      drawText(ctx, "K(−m,−n)", lx + 605, ly + 172, { font: "800 20px 'JetBrains Mono', monospace", color: PAL.crimson, align: "center" });
      drawKernel3x3(ctx, lx + 488, ly + 195, kSize, flippedK, "v2-conv-k2", PAL.crimson);

      drawText(ctx, "I ∗ K  =  K ∗ I", lx + lw / 2, ly + 492, {
        font: "800 24px 'JetBrains Mono', monospace",
        color: PAL.teal,
        align: "center"
      });

      // Right Bay: Deep Learning Cross-Correlation (I ⋆ K)
      const rx = 964, ry = 96, rw = 872, rh = 560;
      drawArchivalCard(ctx, rx, ry, rw, rh, {
        header: "DEEP LEARNING (nn.Conv2d) · CROSS-CORRELATION (I ⋆ K)",
        accent: PAL.amber
      });

      drawText(ctx, "(I ⋆ K)(i,j) = Σ Σ I(i + m, j + n)·K(m,n)", rx + rw / 2, ry + 96, {
        font: "800 24px 'JetBrains Mono', monospace",
        color: PAL.crimson,
        align: "center"
      });

      drawText(ctx, "LEARNED K (NO FLIP)", rx + rw / 2, ry + 172, {
        font: "800 20px 'JetBrains Mono', monospace",
        color: PAL.amber,
        align: "center"
      });
      drawKernel3x3(ctx, rx + (rw - kSize * 3) / 2, ry + 195, kSize, origK, "v2-xcorr-k", PAL.amber);

      drawText(ctx, "LEARNED WEIGHTS:  K' = rot₁₈₀(K)", rx + rw / 2, ry + 492, {
        font: "800 24px 'JetBrains Mono', monospace",
        color: PAL.ink,
        align: "center"
      });

      // Bottom Equivalence Pill (appears at t >= 158.6s)
      if (t >= 158.6) {
        const bEnv = easeOutBack(invLerp(158.6, 159.5, t));
        ctx.save();
        ctx.globalAlpha = env51 * clamp(bEnv, 0, 1);
        const bx = 84, by = 682, bw = 1752, bh = 185;
        drawArchivalCard(ctx, bx, by, bw, bh, {
          header: "MATHEMATICAL EQUIVALENCE",
          accent: PAL.gold
        });

        drawText(ctx, "(I ∗ K)(i, j)   ≡   (I ⋆ rot₁₈₀(K))(i, j)", bx + bw / 2, by + 112, {
          font: "800 36px 'JetBrains Mono', monospace",
          color: PAL.ink,
          align: "center"
        });

        drawLensGuide(ctx, bx + bw - 95, by + 108, 0.95, t, "excited", "K' = flip");
        ctx.restore();
      }

      ctx.restore();
    }

    // =========================================================================
    // SHOT 5.2 (164.60s – 173.53s): GRAND FINALE — FLIP, SLIDE, MULTIPLY, SUM
    // =========================================================================
    const env52 = windowEnv(t, 164.6, 173.53, 0.5, 0.45);
    if (env52 > 0.001) {
      ctx.save();
      ctx.globalAlpha = env52;

      const fx = 84, fy = 96, fw = 1752, fh = 790;
      drawArchivalCard(ctx, fx, fy, fw, fh, {
        header: "LOST IN TRANSLATION · EXPERIMENT 002 · CONVOLUTION (f ∗ g)",
        accent: PAL.gold
      });

      // Central Master Equation
      const eqPts = sketchyRectPts(fx + 210, fy + 82, fw - 420, 130, 1.6, "v2-final-eq");
      wetWash(ctx, eqPts, "#FCE2A6", { alpha: 0.95, pool: 0.3, bleed: 2, rim: true, dx: 1, dy: 1 });
      penStroke(ctx, eqPts, { closed: true, width: 2.8, color: PAL.ink, wobble: 1.2, retrace: true, seed: "v2-final-eqp" });

      drawText(ctx, "(f ∗ g)[n]  =  Σₖ  f[k] · g[ n − k ]", fx + fw / 2, fy + 147, {
        font: "800 42px 'JetBrains Mono', monospace",
        color: PAL.ink,
        align: "center"
      });

      const steps = [
        { word: "1. FLIP", sub: "g[−k]", time: 167.3, col: PAL.crimson, wash: "#F7CBC7" },
        { word: "2. SLIDE", sub: "g[n − k]", time: 168.1, col: PAL.amber, wash: "#FCE09B" },
        { word: "3. MULTIPLY", sub: "f[k] · g[n − k]", time: 169.0, col: PAL.teal, wash: "#C5EAE2" },
        { word: "4. SUM", sub: "Σₖ", time: 170.0, col: PAL.cobalt, wash: "#CEDDF2" }
      ];

      const cardW = 370;
      const gap = 42;
      const startX = fx + (fw - (cardW * 4 + gap * 3)) / 2;
      const cardY = fy + 275;
      const cardH = 340;

      steps.forEach((st, idx) => {
        const cx = startX + idx * (cardW + gap);
        const isPopped = t >= st.time;
        const popScale = isPopped ? easeOutBack(invLerp(st.time, st.time + 0.45, t)) : 1.0;

        ctx.save();
        if (isPopped && t <= st.time + 0.5) {
          const centerC = [cx + cardW / 2, cardY + cardH / 2];
          ctx.translate(centerC[0], centerC[1]);
          ctx.scale(0.92 + 0.08 * popScale, 0.92 + 0.08 * popScale);
          ctx.translate(-centerC[0], -centerC[1]);
        }

        const cPts = sketchyRectPts(cx, cardY, cardW, cardH, 1.6, `v2-fin-card:${idx}`);
        wetWash(ctx, cPts, isPopped ? st.wash : "#F5EFE0", {
          alpha: isPopped ? 0.96 : 0.72, pool: 0.3, bleed: 2, rim: isPopped, dx: 1, dy: 1
        });
        penStroke(ctx, cPts, {
          closed: true, width: isPopped ? 3.4 : 2.0, color: isPopped ? st.col : PAL.inkSoft, wobble: 1.2, retrace: true, seed: `v2-fin-cp:${idx}`
        });

        drawText(ctx, st.word, cx + cardW / 2, cardY + 125, {
          font: "800 32px 'JetBrains Mono', monospace",
          color: isPopped ? st.col : PAL.inkSoft,
          align: "center"
        });

        drawText(ctx, st.sub, cx + cardW / 2, cardY + 225, {
          font: "800 28px 'JetBrains Mono', monospace",
          color: PAL.ink,
          align: "center"
        });

        ctx.restore();
      });

      drawLensGuide(ctx, fx + fw / 2, fy + 705, 1.1, t, "excited", "f ∗ g ♥");
      ctx.restore();
    }
  }

  window.ACT5 = { renderAct5 };
})();
