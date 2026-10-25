// experiments/exp002_convolution/src/scenes/act1.js
// Act I (0.00s – 45.70s) — Pedagogical Revision v2:
// Spatial Integration, Progressive Disclosure & Unspoken Watch Beats (Zero Full-Sentence Banner Clutter)

(function () {
  const {
    W, H, PAL, clamp, lerp, invLerp,
    easeOutCubic, easeInOutCubic, easeOutBack,
    windowEnv, sketchyRectPts, sketchyCirclePts,
    wetWash, penStroke, scribbleHatchRect,
    drawPaperStrip, drawArchivalCard, drawLensGuide,
    drawText
  } = window.ENG;

  function renderAct1(ctx, t) {
    // =========================================================================
    // SHOT 1.1 (0.00s – 14.50s): CATHEDRAL CLAP -> IMPULSE RESPONSE h[n]
    // Watch Beat at 4.35s - 6.25s as waves propagate and bars rise; spoken values at 10.3s, 11.2s, 12.3s, 13.4s
    // =========================================================================
    const env11 = windowEnv(t, 0.0, 14.6, 0.45, 0.55);
    if (env11 > 0.001) {
      ctx.save();
      ctx.globalAlpha = env11;

      // Single spacious studio canvas (no top sentence banner!)
      const sx = 84, sy = 96, sw = 1752, sh = 790;
      drawArchivalCard(ctx, sx, sy, sw, sh, {
        header: "IMPULSE & ECHO · h[n]",
        accent: PAL.amber
      });

      // Clip interior for expanding cathedral waves
      const clipPts = sketchyRectPts(sx + 14, sy + 48, sw - 28, sh - 60, 0.5, "act1-clip");
      ctx.save();
      ctx.beginPath();
      clipPts.forEach(([px, py], i) => (i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)));
      ctx.closePath();
      ctx.clip();

      // Left side of stage: Hand-sketched Cathedral Vault (x = 420)
      const archX = sx + 370;
      const floorY = sy + 640;
      for (let a = 0; a < 3; a++) {
        const spanW = 155 + a * 92;
        const archH = 310 + a * 65;
        penStroke(ctx, [
          [archX - spanW, floorY],
          [archX - spanW * 0.85, floorY - archH * 0.6],
          [archX, floorY - archH],
          [archX + spanW * 0.85, floorY - archH * 0.6],
          [archX + spanW, floorY]
        ], {
          width: 2.8 - a * 0.4,
          color: PAL.inkSoft,
          alpha: 0.42 - a * 0.09,
          wobble: 1.5,
          retrace: true,
          seed: `v2-arch:${a}`
        });
      }

      // Continuous floor line linking Cathedral to Echo Bars
      penStroke(ctx, [[sx + 60, floorY], [sx + sw - 70, floorY]], {
        width: 2.8, color: PAL.ink, alpha: 0.8, wobble: 1.1, retrace: true, seed: "v2-floor"
      });

      // Clap Starburst at t = 1.50s ("Clap your hands once...") & Second Watch-Beat Pulse at t = 4.55s
      const clapX = archX - 20;
      const clapY = floorY - 160;
      if (t >= 1.45) {
        const age1 = t - 1.45;
        const age2 = t >= 4.55 ? t - 4.55 : 99;
        const pulse = Math.exp(-age1 * 2.2) + Math.exp(-age2 * 2.5) * 0.8;
        const bPts = sketchyCirclePts(clapX, clapY, 38 + pulse * 22, 38 + pulse * 22, 14, 3.5, "v2-clap");
        wetWash(ctx, bPts, PAL.gold, { alpha: 0.88, pool: 0.3, bleed: 3, rim: true, dx: 0, dy: 0 });
        penStroke(ctx, bPts, { closed: true, width: 2.6, color: PAL.crimson, wobble: 1.5, retrace: true, seed: "v2-clapp" });

        drawText(ctx, "δ[0] = 1", clapX, clapY - 58, {
          font: "800 20px 'JetBrains Mono', monospace",
          color: PAL.crimson,
          align: "center"
        });

        // Concentric acoustic wavefronts travelling rightward toward the Echo Bars
        for (let wIdx = 0; wIdx < 4; wIdx++) {
          const wStart = 1.55 + wIdx * 0.72;
          if (t >= wStart) {
            const prog = clamp((t - wStart) / 3.6, 0, 1);
            const rad = 50 + prog * 480;
            const arcPts = [];
            for (let k = -8; k <= 8; k++) {
              const ang = (k / 8) * 0.90;
              arcPts.push([clapX + Math.cos(ang) * rad, clapY + Math.sin(ang) * rad * 0.75]);
            }
            penStroke(ctx, arcPts, {
              width: 4.0 * (1 - wIdx * 0.18),
              color: wIdx === 0 ? PAL.amber : PAL.teal,
              alpha: (1 - prog * 0.62) * (0.9 - wIdx * 0.16),
              wobble: 1.4,
              retrace: true,
              boilTime: t,
              seed: `v2-wave:${wIdx}`
            });
          }
        }
      }

      // Right Side: Large, Clean Impulse Response Bars h[n] (x = 940..1680)
      // Bars rise during the unspoken Watch Beat (4.5s - 6.2s) and highlight as each number is spoken (10.3s, 11.2s, 12.3s, 13.4s)!
      const plotX0 = sx + 880;
      const stepX = 195;
      const hData = [
        { k: 0, val: 1.0, riseAt: 4.55, speakAt: 10.2, col: PAL.amber, wash: "#FCE09B" },
        { k: 1, val: 0.6, riseAt: 4.95, speakAt: 11.1, col: PAL.teal, wash: "#C7EAE3" },
        { k: 2, val: 0.3, riseAt: 5.35, speakAt: 12.2, col: PAL.cobalt, wash: "#CEDDF2" },
        { k: 3, val: 0.1, riseAt: 5.75, speakAt: 13.3, col: PAL.plum, wash: "#E2D5F0" }
      ];

      hData.forEach((hd) => {
        if (t >= hd.riseAt) {
          const riseU = easeOutBack(invLerp(hd.riseAt, hd.riseAt + 0.65, t));
          const isSpoken = t >= hd.speakAt && t <= hd.speakAt + 1.1;
          const bx = plotX0 + hd.k * stepX;
          const barW = 96;
          const barH = hd.val * 340 * riseU;

          const bPts = sketchyRectPts(bx - barW / 2, floorY - barH, barW, barH, 1.4, `v2-hbar:${hd.k}`);
          wetWash(ctx, bPts, isSpoken ? PAL.gold : hd.wash, {
            alpha: 0.94, pool: 0.35, bleed: 2, rim: true, dx: 1, dy: 1
          });
          scribbleHatchRect(ctx, bx - barW / 2 + 4, floorY - barH + 4, barW - 8, barH - 8, {
            color: hd.col, alpha: 0.25, gap: 7, seed: `v2-hh:${hd.k}`
          });
          penStroke(ctx, bPts, {
            closed: true,
            width: isSpoken ? 3.8 : 2.5,
            color: isSpoken ? PAL.crimson : PAL.ink,
            wobble: 1.1,
            retrace: true,
            seed: `v2-hp:${hd.k}`
          });

          // Just the clean number above the bar and h[k] below!
          drawText(ctx, hd.val.toFixed(1), bx, floorY - barH - 28, {
            font: isSpoken ? "800 30px 'JetBrains Mono', monospace" : "800 24px 'JetBrains Mono', monospace",
            color: isSpoken ? PAL.crimson : hd.col,
            align: "center"
          });
          drawText(ctx, `h[${hd.k}]`, bx, floorY + 34, {
            font: "800 20px 'JetBrains Mono', monospace",
            color: PAL.ink,
            align: "center"
          });
        }
      });

      ctx.restore(); // end clip

      drawLensGuide(ctx, sx + sw - 95, sy + 135, 1.0, t, t >= 4.5 && t <= 6.3 ? "excited" : "curious", "h[n]");
      ctx.restore();
    }

    // =========================================================================
    // SHOT 1.2 (14.40s – 46.80s): PROGRESSIVE ECHO SUPERPOSITION & THE (n - k) QUESTION
    // =========================================================================
    const env12 = windowEnv(t, 14.4, 46.9, 0.5, 0.55);
    if (env12 > 0.001) {
      ctx.save();
      ctx.globalAlpha = env12;

      const wx = 84, wy = 96, ww = 1752, wh = 790;
      drawArchivalCard(ctx, wx, wy, ww, wh, {
        header: "SUPERPOSITION · OVERLAPPING ECHO STRIPS",
        accent: PAL.teal
      });

      const colX0 = wx + 420;
      const cellW = 275;
      const rowH = 108;

      // Column headers: n = 0, n = 1, n = 2, n = 3
      for (let n = 0; n < 4; n++) {
        const cx = colX0 + n * cellW + cellW / 2;
        const isStep1Spotlight = t >= 22.8 && n === 1;
        if (isStep1Spotlight) {
          const spotEnv = easeOutCubic(invLerp(22.8, 23.6, t));
          ctx.save();
          ctx.globalAlpha = env12 * spotEnv;
          const colPts = sketchyRectPts(colX0 + n * cellW + 8, wy + 68, cellW - 16, 475, 1.5, "v2-col1-spot");
          wetWash(ctx, colPts, "#FCE8B2", { alpha: 0.45, pool: 0.2, bleed: 2, rim: true, dx: 0, dy: 0 });
          penStroke(ctx, colPts, { closed: true, width: 3.0, color: PAL.crimson, wobble: 1.2, retrace: true, seed: "v2-col1-p" });
          ctx.restore();
        }
        drawText(ctx, `n = ${n}`, cx, wy + 96, {
          font: "800 22px 'JetBrains Mono', monospace",
          color: isStep1Spotlight ? PAL.crimson : PAL.biroBlue,
          align: "center"
        });
      }

      // Row 1: x[0] = 2 launches [2.0, 1.2, 0.6, 0.2] (using all 4 echo taps [1.0, 0.6, 0.3, 0.1]!)
      if (t >= 17.1) {
        const r1Env = easeOutBack(invLerp(17.1, 18.0, t));
        ctx.save();
        ctx.globalAlpha = env12 * clamp(r1Env, 0, 1);
        ctx.translate((1 - r1Env) * -40, 0);
        drawPaperStrip(ctx, colX0, wy + 132, cellW, rowH, [
          { val: "2.0", fill: "#FCE09B" },
          { val: "1.2", fill: "#F7E7C4", highlight: t >= 22.8 },
          { val: "0.6", fill: "#F5EFE0" },
          { val: "0.2", fill: "#EFECE6" }
        ], {
          seed: "v2-row0",
          title: "x[0] = 2 →",
          titleColor: PAL.amber
        });
        ctx.restore();
      }

      // Row 2: x[1] = 3 launches [—, 3.0, 1.8, 0.9]
      if (t >= 18.7) {
        const r2Env = easeOutBack(invLerp(18.7, 19.6, t));
        ctx.save();
        ctx.globalAlpha = env12 * clamp(r2Env, 0, 1);
        ctx.translate((1 - r2Env) * -40, 0);
        drawPaperStrip(ctx, colX0, wy + 272, cellW, rowH, [
          { val: "—", fill: "#EFECE6", textColor: PAL.steel },
          { val: "3.0", fill: "#C5EAE2", highlight: t >= 22.8 },
          { val: "1.8", fill: "#D8EFEA" },
          { val: "0.9", fill: "#EBF5F2" }
        ], {
          seed: "v2-row1",
          title: "x[1] = 3 →",
          titleColor: PAL.teal
        });
        ctx.restore();
      }

      // Row 3: Sum Strip y[n] = [2.0, 4.2, 2.4, 1.1] (0.2 + 0.9 = 1.1 at n=3!)
      if (t >= 22.8) {
        const sumEnv = easeOutBack(invLerp(22.8, 23.8, t));
        ctx.save();
        ctx.globalAlpha = env12 * clamp(sumEnv, 0, 1);
        drawPaperStrip(ctx, colX0, wy + 422, cellW, rowH, [
          { val: "2.0", fill: "#F7EFE0" },
          { sub: "1.2 + 3.0", val: "4.2", fill: "#FAD37A", highlight: true, stroke: PAL.crimson },
          { val: t >= 34.0 ? "2.4" : "?", fill: "#F7EFE0" },
          { val: t >= 34.0 ? "1.1" : "?", fill: "#F7EFE0" }
        ], {
          seed: "v2-row-sum",
          title: "SUM y[n] =",
          titleColor: PAL.crimson
        });
        ctx.restore();
      }

      // Progressive Reveal 4: At t = 35.8s ("Blending an input with an echo is called convolution... why n minus k?")
      if (t >= 35.8) {
        const eqEnv = easeOutBack(invLerp(35.8, 36.8, t));
        ctx.save();
        ctx.globalAlpha = env12 * clamp(eqEnv, 0, 1);

        const eqBox = sketchyRectPts(wx + 260, wy + 578, ww - 520, 165, 1.6, "v2-conv-eq");
        wetWash(ctx, eqBox, "#FCE2A6", { alpha: 0.95, pool: 0.3, bleed: 2, rim: true, dx: 1, dy: 1 });
        penStroke(ctx, eqBox, { closed: true, width: 2.8, color: PAL.ink, wobble: 1.2, retrace: true, seed: "v2-conv-eqp" });

        drawText(ctx, "(x ∗ h)[n]   =   Σₖ  x[k] · h[ n − k ]", wx + ww / 2, wy + 648, {
          font: "800 38px 'JetBrains Mono', monospace",
          color: PAL.ink,
          align: "center"
        });

        // At t = 41.2s ("why is the echo written backwards as n minus k?"), circle [n - k] in crimson!
        if (t >= 41.2) {
          const cEnv = easeOutBack(invLerp(41.2, 42.0, t));
          ctx.save();
          ctx.globalAlpha = env12 * clamp(cEnv, 0, 1);
          const nkCirc = sketchyCirclePts(wx + ww / 2 + 285, wy + 648, 98, 42, 16, 2.0, "v2-nk-circ");
          penStroke(ctx, nkCirc, { closed: true, width: 3.8, color: PAL.crimson, wobble: 1.4, retrace: true, seed: "v2-nk-cp" });

          drawText(ctx, "WHY BACKWARDS (n − k)?", wx + ww / 2, wy + 716, {
            font: "800 20px 'JetBrains Mono', monospace",
            color: PAL.crimson,
            align: "center"
          });
          ctx.restore();
        }

        ctx.restore();
      }

      drawLensGuide(ctx, wx + ww - 95, wy + 135, 1.0, t, t >= 41.2 ? "flip" : "excited", t >= 41.2 ? "n − k?!" : "4.2!");
      ctx.restore();
    }
  }

  window.ACT1 = { renderAct1 };
})();
