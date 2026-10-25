import json
import math
import os
import subprocess
import wave
import numpy as np
from scipy import signal
from scipy.ndimage import uniform_filter1d

SR = 48000
BASE_DIR = "experiments/exp002_convolution"

with open(os.path.join(BASE_DIR, "src/data/narration.json")) as f:
    narration = json.load(f)

DURATION = float(narration["total_duration"])
N_SAMPLES = int(round(DURATION * SR))

def midi_to_hz(m):
    return 440.0 * (2.0 ** ((m - 69.0) / 12.0))

def make_stereo_reverb_ir(duration=2.3, decay=2.4, seed=202):
    rng = np.random.default_rng(seed)
    length = int(duration * SR)
    t = np.linspace(0, duration, length, endpoint=False)
    env = np.exp(-t * decay)
    ir_l = rng.normal(0, 1, length) * env
    ir_r = rng.normal(0, 1, length) * env
    b, a = signal.butter(2, 3200.0 / (SR / 2), btype="low")
    ir_l = signal.lfilter(b, a, ir_l)
    ir_r = signal.lfilter(b, a, ir_r)
    norm = np.sqrt(np.sum(ir_l ** 2) + 1e-9)
    return ir_l / norm * 0.28, ir_r / norm * 0.28

def add_stereo_note(buf_l, buf_r, start_s, dur_s, freq, amp=0.1, pan=0.0, timbre="pad", attack=0.04, release=0.35):
    i0 = max(0, int(round(start_s * SR)))
    length = int(round(dur_s * SR))
    if i0 >= N_SAMPLES or length <= 10:
        return
    i1 = min(N_SAMPLES, i0 + length)
    actual_len = i1 - i0
    t = np.arange(actual_len, dtype=np.float64) / SR

    env = np.ones(actual_len, dtype=np.float64)
    att_n = max(1, int(round(attack * SR)))
    rel_n = max(1, int(round(release * SR)))
    if att_n < actual_len:
        env[:att_n] = np.linspace(0.0, 1.0, att_n) ** 1.3
    else:
        env = np.linspace(0.0, 1.0, actual_len)

    if timbre in ("marimba", "rhodes", "bell", "pluck", "bass_groove"):
        decay_rate = 4.2 / max(0.10, dur_s) if timbre != "rhodes" else 2.2 / max(0.15, dur_s)
        env *= np.exp(-np.maximum(0.0, t - attack) * decay_rate)
        env[-min(rel_n, actual_len):] *= np.linspace(1.0, 0.0, min(rel_n, actual_len))
    else:
        if rel_n < actual_len:
            env[-rel_n:] *= np.linspace(1.0, 0.0, rel_n) ** 1.5

    phase = 2.0 * np.pi * freq * t
    if timbre == "pad":
        p1 = 2.0 * np.pi * (freq * 0.997) * t
        p2 = 2.0 * np.pi * (freq * 1.003) * t
        wave_sig = (
            0.52 * np.sin(phase)
            + 0.26 * np.sin(p1)
            + 0.26 * np.sin(p2)
            + 0.16 * np.sin(2.0 * phase + 0.3) * np.exp(-t * 0.35)
            + 0.07 * np.sin(3.0 * phase + 0.7) * np.exp(-t * 0.7)
        )
    elif timbre == "rhodes":
        # Warm electric piano tine + bell attack
        tine = np.sin(7.0 * phase) * np.exp(-t * 18.0) * 0.14
        mod = 0.65 * np.sin(2.0 * phase) * np.exp(-t * 3.2)
        wave_sig = 0.75 * np.sin(phase + mod) + 0.20 * np.sin(3.0 * phase) * np.exp(-t * 4.0) + tine
    elif timbre == "bass_groove":
        # Warm upright/synth bass pulse
        wave_sig = (
            0.80 * np.sin(phase)
            + 0.32 * np.sin(2.0 * phase) * np.exp(-t * 3.5)
            + 0.12 * np.sin(3.0 * phase) * np.exp(-t * 7.0)
        )
    elif timbre == "marimba":
        strike = np.sin(6.0 * phase) * np.exp(-t * 42.0) * 0.15
        wave_sig = (
            0.78 * np.sin(phase)
            + 0.24 * np.sin(2.0 * phase) * np.exp(-t * 5.5)
            + 0.12 * np.sin(4.0 * phase) * np.exp(-t * 12.0)
            + strike
        )
    elif timbre == "bell":
        mod = 1.2 * np.sin(2.0 * phase) * np.exp(-t * 4.5)
        wave_sig = (
            0.70 * np.sin(phase + mod)
            + 0.25 * np.sin(2.756 * phase) * np.exp(-t * 7.0)
            + 0.12 * np.sin(5.404 * phase) * np.exp(-t * 12.0)
        )
    elif timbre == "pluck":
        wave_sig = (
            0.65 * np.sin(phase)
            + 0.30 * np.sin(2.0 * phase) * np.exp(-t * 4.5)
            + 0.15 * np.sin(3.0 * phase) * np.exp(-t * 8.0)
        )
    else:
        wave_sig = np.sin(phase)

    sig = wave_sig * env * amp
    angle = (np.clip(pan, -1.0, 1.0) + 1.0) * (np.pi / 4.0)
    buf_l[i0:i1] += sig * math.cos(angle)
    buf_r[i0:i1] += sig * math.sin(angle)

def add_brush_groove_and_ambient_bed(music_l, music_r):
    # 1. Warm continuous acoustic studio room tone + gentle vinyl/paper warmth
    rng = np.random.default_rng(19432026)
    noise = rng.normal(0, 1, N_SAMPLES)
    b_low, a_low = signal.butter(2, [65.0 / (SR / 2), 380.0 / (SR / 2)], btype="band")
    warm_room = signal.lfilter(b_low, a_low, noise) * 0.012
    music_l += warm_room
    music_r += warm_room * 0.95

    # 2. Soft brushed percussion / shaker groove at 100 BPM (1 beat = 0.60s, eighth note = 0.30s)
    b_shk, a_shk = signal.butter(2, [3600.0 / (SR / 2), 9500.0 / (SR / 2)], btype="band")
    step_s = 0.30
    n_hits = int((DURATION - 1.5) / step_s)
    for k in range(n_hits):
        t_hit = 0.60 + k * step_s
        i0 = int(round(t_hit * SR))
        dur = 0.075 if (k % 2 == 0) else 0.055
        n = min(N_SAMPLES - i0, int(dur * SR))
        if n <= 0:
            continue
        t = np.arange(n) / SR
        env = np.sin(np.pi * (t / dur)) ** 1.8
        raw = rng.normal(0, 1, n)
        shk = signal.lfilter(b_shk, a_shk, raw) * env
        # Soft felt kick pulse on beat 0 and beat 2 of each 4-beat bar (every 4 eighth notes)
        if k % 4 == 0:
            f_kick = 58.0 + 75.0 * np.exp(-t * 38.0)
            ph_k = 2 * np.pi * np.cumsum(f_kick) / SR
            kick = np.sin(ph_k) * np.exp(-t * 24.0) * 0.055
            music_l[i0:i0 + n] += kick
            music_r[i0:i0 + n] += kick
        amp = 0.022 if (k % 2 == 1) else 0.013
        pan = 0.25 if (k % 2 == 0) else -0.25
        ang = (pan + 1.0) * (np.pi / 4.0)
        music_l[i0:i0 + n] += shk * amp * math.cos(ang)
        music_r[i0:i0 + n] += shk * amp * math.sin(ang)

def add_sfx(buf_l, buf_r, start_s, kind, amp=0.15, pan=0.0):
    i0 = max(0, int(round(start_s * SR)))
    if i0 >= N_SAMPLES:
        return
    rng = np.random.default_rng(int(round(start_s * 1000)) + 53)

    if kind == "cathedral_clap":
        taps = [(0.0, 1.0, 0.0), (0.38, 0.62, -0.38), (0.76, 0.38, 0.38), (1.14, 0.22, -0.22), (1.52, 0.11, 0.22)]
        for delay, gain, tap_pan in taps:
            idx = max(0, int(round((start_s + delay) * SR)))
            dur = 0.11
            n = min(N_SAMPLES - idx, int(dur * SR))
            if n <= 0:
                continue
            t = np.arange(n) / SR
            burst = rng.normal(0, 1, n) * np.exp(-t * 55.0)
            b, a = signal.butter(2, [320.0 / (SR / 2), 3400.0 / (SR / 2)], btype="band")
            clap = signal.lfilter(b, a, burst) + np.sin(2 * np.pi * 640 * t) * np.exp(-t * 40.0) * 0.45
            sig = clap * amp * gain
            ang = (np.clip(tap_pan, -1.0, 1.0) + 1.0) * (np.pi / 4.0)
            buf_l[idx:idx + n] += sig * math.cos(ang)
            buf_r[idx:idx + n] += sig * math.sin(ang)
        return
    elif kind == "paper_slide":
        dur = 0.28
        n = min(N_SAMPLES - i0, int(dur * SR))
        t = np.arange(n) / SR
        noise = rng.normal(0, 1, n)
        b, a = signal.butter(2, [500.0 / (SR / 2), 2600.0 / (SR / 2)], btype="band")
        slide = signal.lfilter(b, a, noise) * (np.sin(np.pi * (t / dur)) ** 1.4)
        wood_tap = (np.sin(2 * np.pi * 480 * t) + 0.4 * np.sin(2 * np.pi * 960 * t)) * np.exp(-t * 50.0) * 0.38
        sig = (slide * 0.72 + wood_tap) * amp
    elif kind == "paper_flip":
        dur = 0.36
        n = min(N_SAMPLES - i0, int(dur * SR))
        t = np.arange(n) / SR
        f_sweep = 240.0 + 580.0 * np.sin(np.pi * t / dur)
        phase = 2 * np.pi * np.cumsum(f_sweep) / SR
        whoosh = np.sin(phase) * np.sin(np.pi * t / dur) * 0.48
        snap = rng.normal(0, 1, n) * np.exp(-np.abs(t - 0.18) * 85.0) * 0.58
        sig = (whoosh + snap) * amp
    elif kind == "sum_chime":
        dur = 0.50
        n = min(N_SAMPLES - i0, int(dur * SR))
        t = np.arange(n) / SR
        sig = (
            np.sin(2 * np.pi * 587.33 * t) * 0.62
            + np.sin(2 * np.pi * 880.0 * t) * 0.36
            + np.sin(2 * np.pi * 1174.66 * t) * 0.22
        ) * np.exp(-t * 7.5) * np.minimum(1.0, t / 0.005) * amp
    elif kind == "peak_bell":
        dur = 0.85
        n = min(N_SAMPLES - i0, int(dur * SR))
        t = np.arange(n) / SR
        sig = (
            np.sin(2 * np.pi * 523.25 * t) * 0.48
            + np.sin(2 * np.pi * 659.25 * t) * 0.42
            + np.sin(2 * np.pi * 783.99 * t) * 0.36
            + np.sin(2 * np.pi * 1046.50 * t) * 0.28
        ) * np.exp(-t * 4.5) * np.minimum(1.0, t / 0.005) * amp
    elif kind == "whoosh":
        dur = 0.80
        n = min(N_SAMPLES - i0, int(dur * SR))
        t = np.arange(n) / SR
        noise = rng.normal(0, 1, n)
        b, a = signal.butter(2, [240.0 / (SR / 2), 1500.0 / (SR / 2)], btype="band")
        filt = signal.lfilter(b, a, noise)
        sig = filt * (np.sin(np.pi * (t / dur)) ** 2.0) * amp
    else:
        return

    angle = (np.clip(pan, -1.0, 1.0) + 1.0) * (np.pi / 4.0)
    buf_l[i0:i0 + len(sig)] += sig * math.cos(angle)
    buf_r[i0:i0 + len(sig)] += sig * math.sin(angle)

def build_music_and_sfx():
    music_l = np.zeros(N_SAMPLES, dtype=np.float64)
    music_r = np.zeros(N_SAMPLES, dtype=np.float64)
    sfx_l = np.zeros(N_SAMPLES, dtype=np.float64)
    sfx_r = np.zeros(N_SAMPLES, dtype=np.float64)

    # Add continuous brush/shaker groove, soft felt kick pulse, and studio room warmth
    add_brush_groove_and_ambient_bed(music_l, music_r)

    # Rich harmonic progression across 169.79s
    chords = [
        # Act 1 (0 - 45.7s)
        (0.0,  7.5,  [41, 48, 53, 57, 60, 64], [60, 64, 67, 71, 72]),
        (7.5,  14.8, [36, 48, 52, 55, 59, 64], [60, 64, 67, 71, 74]),
        (14.8, 24.0, [38, 45, 50, 53, 57, 60], [62, 65, 69, 72, 76]),
        (24.0, 35.5, [33, 45, 52, 55, 57, 60], [57, 60, 64, 69, 72]),
        (35.5, 45.7, [31, 43, 50, 55, 59, 62], [59, 62, 67, 71, 74]),

        # Act 2 (45.7 - 96.1s)
        (45.7, 54.0, [41, 48, 53, 57, 60, 64], [60, 65, 69, 72, 76]),
        (54.0, 59.8, [36, 48, 52, 55, 60, 64], [60, 64, 67, 72, 76]),
        (59.8, 68.1, [38, 45, 50, 57, 60, 65], [62, 65, 69, 74, 77]),
        (68.1, 78.5, [33, 45, 52, 57, 60, 64], [60, 64, 69, 72, 76]),
        (78.5, 87.5, [41, 48, 53, 57, 62, 65], [62, 65, 69, 74, 77]),
        (87.5, 96.1, [31, 43, 50, 55, 59, 64], [59, 62, 67, 74, 79]),

        # Act 3 (96.1 - 120.4s)
        (96.1, 104.0,[41, 48, 53, 57, 60, 64], [60, 64, 69, 72, 76]),
        (104.0,110.0,[36, 48, 52, 55, 59, 64], [60, 64, 67, 71, 76]),
        (110.0,120.4,[38, 45, 50, 57, 60, 64], [62, 65, 69, 72, 77]),

        # Act 4 (120.4 - 143.8s)
        (120.4,128.0,[33, 45, 52, 55, 60, 64], [60, 64, 67, 72, 76]),
        (128.0,134.4,[41, 48, 53, 57, 60, 65], [60, 65, 69, 72, 77]),
        (134.4,143.8,[38, 45, 50, 56, 59, 64], [59, 62, 68, 71, 76]),

        # Act 5 (143.8 - 169.79s)
        (143.8,151.0,[33, 45, 52, 57, 60, 64], [60, 64, 69, 72, 76]),
        (151.0,159.0,[41, 48, 53, 57, 60, 64], [60, 65, 69, 74, 77]),
        (159.0,169.79,[36,48, 52, 55, 60, 64, 67],[60, 64, 67, 72, 76, 79]),
    ]

    for c_start, c_end, pad_notes, arp_notes in chords:
        dur = c_end - c_start
        # Sustained deep bass + rhythmic walking bass pulse every 1.2s (half bar at 100 BPM)
        add_stereo_note(music_l, music_r, c_start, dur + 0.3, midi_to_hz(pad_notes[0]),
                        amp=0.14, pan=0.0, timbre="bass_groove", attack=0.04, release=0.5)
        n_bass_steps = int(dur / 1.2)
        for b_idx in range(1, n_bass_steps):
            b_note = pad_notes[0] if (b_idx % 2 == 0) else pad_notes[1] - 12
            add_stereo_note(music_l, music_r, c_start + b_idx * 1.2, 0.95, midi_to_hz(b_note),
                            amp=0.11, pan=0.0, timbre="bass_groove", attack=0.02, release=0.3)

        # Warm Rhodes + Pad voicings
        for idx, m_note in enumerate(pad_notes[1:]):
            pan = (idx - 2.0) * 0.25
            add_stereo_note(music_l, music_r, c_start, dur + 0.5, midi_to_hz(m_note),
                            amp=0.048, pan=pan, timbre="pad", attack=0.35, release=0.9)
            if idx < 3:
                add_stereo_note(music_l, music_r, c_start + idx * 0.06, min(2.8, dur), midi_to_hz(m_note + 12),
                                amp=0.036, pan=-pan, timbre="rhodes", attack=0.015, release=0.6)

        # Syncopated marimba & pluck melodic weave (every 0.30s eighth-note grid)
        step = 0.30
        n_steps = int(dur / step)
        for s_idx in range(n_steps):
            t_note = c_start + s_idx * step
            if t_note > DURATION - 1.0:
                break
            # Play on beats and syncopated offbeats (skip every 4th to breathe)
            if s_idx % 4 == 3:
                continue
            m_arp = arp_notes[s_idx % len(arp_notes)]
            vel = 0.052 if (s_idx % 4 == 0) else (0.038 if (s_idx % 2 == 0) else 0.028)
            timbre = "pluck" if (s_idx % 3 == 1) else "marimba"
            pan = math.sin(s_idx * 1.3) * 0.38
            add_stereo_note(music_l, music_r, t_note, 0.42, midi_to_hz(m_arp),
                            amp=vel, pan=pan, timbre=timbre, attack=0.006, release=0.20)

    # Final resolution bell chord at 166.8s
    for idx, m_bell in enumerate([60, 64, 67, 71, 76, 79]):
        add_stereo_note(music_l, music_r, 166.8 + idx * 0.09, 2.8, midi_to_hz(m_bell),
                        amp=0.050, pan=(idx - 2.5) * 0.20, timbre="bell", attack=0.01, release=2.0)

    ir_l, ir_r = make_stereo_reverb_ir(duration=2.1, decay=2.4)
    wet_l = signal.fftconvolve(music_l, ir_l, mode="full")[:N_SAMPLES]
    wet_r = signal.fftconvolve(music_r, ir_r, mode="full")[:N_SAMPLES]
    music_l = music_l * 0.80 + wet_l * 0.44
    music_r = music_r * 0.80 + wet_r * 0.44

    # --- Synchronized Sound Design & Observation-Beat Foley (v2 Timestamps) ---
    sync_marks = [
        # Act 1: Cathedral Clap & Echo Superposition
        (1.50,  "cathedral_clap", 0.22, 0.0,  "Clap your hands once in a vast cathedral"),
        (4.55,  "cathedral_clap", 0.19, 0.1,  "Unspoken watch beat: echo bars rise"),
        (10.30, "sum_chime",      0.14, -0.3, "h[0] = 1.0"),
        (11.20, "sum_chime",      0.13, -0.1, "h[1] = 0.6"),
        (12.30, "sum_chime",      0.12, 0.1,  "h[2] = 0.3"),
        (13.40, "sum_chime",      0.11, 0.3,  "h[3] = 0.1"),
        (17.80, "paper_slide",    0.18, -0.3, "quiet 2 launches echo row 1"),
        (19.10, "paper_slide",    0.18, 0.2,  "louder 3 launches echo row 2"),
        (22.90, "paper_slide",    0.20, 0.0,  "Watch beat: vertical column 1 aligns"),
        (34.00, "peak_bell",      0.20, 0.0,  "giving 4.2"),
        (44.00, "paper_flip",     0.19, 0.2,  "written backwards as n minus k"),

        # Act 2: Why We Flip & Sliding Strip [1,2,3] * [4,5,6]
        (45.70, "whoosh",         0.16, 0.0,  "Transition to Act 2"),
        (53.30, "sum_chime",      0.15, -0.2, "fresh head h[0]"),
        (57.00, "sum_chime",      0.15, 0.2,  "older tail h[1], h[2]"),
        (61.60, "paper_flip",     0.24, 0.0,  "flip it end for end"),
        (66.50, "peak_bell",      0.20, 0.0,  "Watch beat: vertical pairs lock in"),
        (74.50, "paper_flip",     0.24, -0.2, "flip 4,5,6 into 6,5,4"),
        (77.60, "paper_slide",    0.20, -0.4, "Watch beat: strip slides to start position"),
        (81.70, "paper_slide",    0.19, -0.3, "Step 0: 1*4 = 4"),
        (82.60, "sum_chime",      0.16, -0.3, "output 4"),
        (83.50, "paper_slide",    0.19, -0.15,"Step 1: slide to 13"),
        (85.50, "sum_chime",      0.17, -0.15,"output 13"),
        (86.40, "paper_slide",    0.22, 0.0,  "Watch beat: slide to center full overlap"),
        (92.00, "peak_bell",      0.24, 0.0,  "peaks at 28!"),
        (93.10, "paper_slide",    0.19, 0.2,  "Step 3: 27"),
        (94.80, "paper_slide",    0.19, 0.4,  "Step 4: 18"),

        # Act 3: Smoothing & Continuous Integral
        (96.10, "whoosh",         0.16, 0.0,  "Transition to Act 3"),
        (99.90, "paper_slide",    0.16, -0.2, "quarter, half, quarter"),
        (102.20,"paper_slide",    0.18, 0.0,  "Sliding across noisy signal"),
        (107.70,"peak_bell",      0.18, 0.2,  "into a smooth curve"),
        (108.50,"paper_slide",    0.18, 0.0,  "Watch beat: window finishes smoothing"),
        (112.50,"paper_slide",    0.16, 0.0,  "infinitely thin steps"),
        (119.10,"peak_bell",      0.20, 0.0,  "continuous convolution integral"),

        # Act 4: 2D Image Stencil (Blur vs Edge)
        (120.40,"whoosh",         0.16, 0.0,  "Transition to Act 4"),
        (124.30,"paper_flip",     0.19, -0.2, "3x3 window"),
        (125.70,"paper_slide",    0.17, 0.0,  "scanning across image"),
        (132.20,"sum_chime",      0.18, -0.2, "soft blur"),
        (133.00,"paper_flip",     0.22, 0.0,  "Watch beat: stencil flips to [-1, 0, +1] edge kernel"),
        (140.00,"paper_slide",    0.17, -0.1, "cancel to zero"),
        (142.60,"peak_bell",      0.24, 0.25, "vertical boundary lights up bright (+320)"),

        # Act 5: CNN Cross-Correlation Twist & Finale
        (143.80,"whoosh",         0.16, 0.0,  "Transition to Act 5"),
        (150.90,"paper_flip",     0.21, -0.2, "skip 180-degree flip"),
        (152.30,"sum_chime",      0.18, 0.2,  "cross-correlation instead"),
        (160.60,"peak_bell",      0.19, 0.0,  "learns them already flipped"),
        (163.90,"paper_flip",     0.20, -0.3, "flip"),
        (164.50,"paper_slide",    0.20, -0.1, "slide"),
        (165.30,"sum_chime",      0.20, 0.1,  "multiply"),
        (166.40,"peak_bell",      0.25, 0.3,  "and sum"),
    ]

    for t_mark, kind, amp, pan, _label in sync_marks:
        add_sfx(sfx_l, sfx_r, t_mark, kind, amp=amp, pan=pan)

    with open(os.path.join(BASE_DIR, "src/data/audio_marks.json"), "w") as f:
        json.dump([{"time": m[0], "kind": m[1], "label": m[4]} for m in sync_marks], f, indent=2)

    return music_l, music_r, sfx_l, sfx_r

def load_wav_stereo(path):
    with wave.open(path, "rb") as wf:
        n_ch = wf.getnchannels()
        n_frames = wf.getnframes()
        raw = wf.readframes(n_frames)
        arr = np.frombuffer(raw, dtype=np.int16).astype(np.float64) / 32768.0
        if n_ch == 2:
            arr = arr.reshape(-1, 2)
            return arr[:, 0], arr[:, 1]
        else:
            return arr, arr.copy()

def assemble_master():
    audio_dir = os.path.join(BASE_DIR, "build/audio")
    os.makedirs(audio_dir, exist_ok=True)
    music_l, music_r, sfx_l, sfx_r = build_music_and_sfx()

    narr_l = np.zeros(N_SAMPLES, dtype=np.float64)
    narr_r = np.zeros(N_SAMPLES, dtype=np.float64)

    for seg in narration["segments"]:
        i0 = int(round(seg["start"] * SR))
        wl, wr = load_wav_stereo(seg["wav"])
        n = min(len(wl), N_SAMPLES - i0)
        if n > 0:
            narr_l[i0:i0 + n] += wl[:n]
            narr_r[i0:i0 + n] += wr[:n]

    narr_peak = max(np.max(np.abs(narr_l)), np.max(np.abs(narr_r)), 1e-6)
    narr_l = (narr_l / narr_peak) * 0.80
    narr_r = (narr_r / narr_peak) * 0.80

    # Frequency-Selective (Mid-Band EQ) Ducking!
    # Split music into Vocal-Mid Band (650 Hz - 3400 Hz) and Warm Low/High Band (<650 Hz and >3400 Hz).
    # During speech, duck the Vocal-Mid Band strongly (to 28%) so voice is crystal clear,
    # while keeping the Warm Bass & High Brush Groove at 72% so the soundtrack stays rich and alive!
    b_mid, a_mid = signal.butter(2, [650.0 / (SR / 2), 3400.0 / (SR / 2)], btype="band")
    music_mid_l = signal.lfilter(b_mid, a_mid, music_l)
    music_mid_r = signal.lfilter(b_mid, a_mid, music_r)
    music_outer_l = music_l - music_mid_l
    music_outer_r = music_r - music_mid_r

    voice_energy = np.abs(narr_l) + np.abs(narr_r)
    smooth_env = uniform_filter1d(voice_energy, size=int(0.16 * SR))
    speaking_mask = np.clip(smooth_env / 0.055, 0.0, 1.0)
    duck_curve = uniform_filter1d(speaking_mask, size=int(0.24 * SR))

    mid_gain = 1.0 - 0.72 * duck_curve     # ducks to 28% in vocal range
    outer_gain = 1.0 - 0.28 * duck_curve   # keeps bass & high shaker at 72% during speech, swells to 100% in watch beats!

    ducked_music_l = (music_mid_l * mid_gain + music_outer_l * outer_gain) * 1.05
    ducked_music_r = (music_mid_r * mid_gain + music_outer_r * outer_gain) * 1.05

    fade_n = int(0.8 * SR)
    fade_env = np.ones(N_SAMPLES)
    fade_env[-fade_n:] = np.linspace(1.0, 0.0, fade_n)

    mix_l = (narr_l + ducked_music_l + sfx_l * 0.82) * fade_env * 1.24
    mix_r = (narr_r + ducked_music_r + sfx_r * 0.82) * fade_env * 1.24

    mix_l = np.tanh(mix_l * 1.12) * 0.90
    mix_r = np.tanh(mix_r * 1.12) * 0.90

    out_wav = os.path.join(audio_dir, "master_audio.wav")
    stereo_int16 = np.empty((N_SAMPLES, 2), dtype=np.int16)
    stereo_int16[:, 0] = np.clip(mix_l * 32767.0, -32768, 32767).astype(np.int16)
    stereo_int16[:, 1] = np.clip(mix_r * 32767.0, -32768, 32767).astype(np.int16)

    with wave.open(out_wav, "wb") as wf:
        wf.setnchannels(2)
        wf.setsampwidth(2)
        wf.setframerate(SR)
        wf.writeframes(stereo_int16.tobytes())

    print(f"Wrote {out_wav} ({DURATION:.2f}s, {N_SAMPLES} samples)")
    res = subprocess.run(
        ["ffmpeg", "-nostats", "-i", out_wav, "-filter_complex", "ebur128=peak=true", "-f", "null", "-"],
        capture_output=True, text=True
    )
    for line in res.stderr.splitlines()[-15:]:
        if any(k in line for k in ("I:", "LRA:", "Peak:")):
            print("  ", line.strip())

    with open(os.path.join(BASE_DIR, "src/data/subtitles.json")) as f:
        subs = json.load(f)
    with open(os.path.join(BASE_DIR, "src/data/audio_marks.json")) as f:
        marks = json.load(f)

    js_content = f"""// Auto-generated timeline data for Experiment 002 v2 (Pedagogical Revision)
window.TIMELINE_DATA = {{
  duration: {DURATION},
  fps: 30,
  speech_duty_cycle_pct: {narration["speech_duty_cycle_pct"]},
  subtitles: {json.dumps(subs, indent=2)},
  segments: {json.dumps(narration["segments"], indent=2)},
  marks: {json.dumps(marks, indent=2)}
}};
"""
    with open(os.path.join(BASE_DIR, "src/timeline_data.js"), "w") as f:
        f.write(js_content)
    print("Wrote experiments/exp002_convolution/src/timeline_data.js")

if __name__ == "__main__":
    assemble_master()
