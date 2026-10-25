import asyncio
import json
import os
import subprocess
import edge_tts

VOICE = "en-US-AndrewMultilingualNeural"
BASE_DIR = "experiments/exp002_convolution"
OUT_DIR = os.path.join(BASE_DIR, "build/audio/segments")
os.makedirs(OUT_DIR, exist_ok=True)

# Per-segment prosody tuning (`rate` and `pitch`) + rhetorical punctuation so cadence varies naturally:
# - Contemplative questions & setups: slightly slower (-3% to -5%), warm pitch
# - Brisk mechanical step-by-step actions: slightly livelier (+2% to +3%)
# - Climax reveals & final synthesis: deliberate, resonant (-5% to -6%)
SEGMENTS = [
    {
        "id": "v2_s01_clap",
        "act": 1,
        "pause_before": 1.4,
        "rate": "-4%",
        "pitch": "+1Hz",
        "text": "Clap your hands once... in a vast cathedral.",
    },
    {
        "id": "v2_s02_echo_bars",
        "act": 1,
        "pause_before": 1.9,
        "rate": "-2%",
        "pitch": "+0Hz",
        "text": "That single sharp clap comes back as a fading trail of echoes: one... point six... point three... point one.",
    },
    {
        "id": "v2_s03_melody",
        "act": 1,
        "pause_before": 1.3,
        "rate": "+2%",
        "pitch": "+2Hz",
        "text": "Now, play two notes in a row: a quiet two, then a louder three. Each note launches its own echo trail.",
    },
    {
        "id": "v2_s04_col_sum",
        "act": 1,
        "pause_before": 1.8,
        "rate": "-3%",
        "pitch": "+0Hz",
        "text": "At step one, what you actually hear is the vertical sum: yesterday's fading echo, one point two... plus today's fresh note, three... giving four point two.",
    },
    {
        "id": "v2_s05_conv_question",
        "act": 1,
        "pause_before": 1.3,
        "rate": "-4%",
        "pitch": "+2Hz",
        "text": "Blending an input with an echo is called convolution. But look at the textbook formula: why is the echo written backwards, as n minus k?",
    },
    {
        "id": "v2_s06_why_flip",
        "act": 2,
        "pause_before": 1.6,
        "rate": "-2%",
        "pitch": "+0Hz",
        "text": "Nature never flips the echo in time. It happens because newest inputs hit the fresh head of the echo, h zero... while older inputs hit the older tail, h one and h two.",
    },
    {
        "id": "v2_s07_flip_action",
        "act": 2,
        "pause_before": 1.5,
        "rate": "+1%",
        "pitch": "+2Hz",
        "text": "So, if we take our echo strip and flip it end for end... every matching pair lines up in the same vertical column.",
    },
    {
        "id": "v2_s08_slide_setup",
        "act": 2,
        "pause_before": 2.0,
        "rate": "+2%",
        "pitch": "+1Hz",
        "text": "Let's try it with real numbers: one, two, three, convolved with four, five, six. First... flip four, five, six into six, five, four.",
    },
    {
        "id": "v2_s09_slide_1_2",
        "act": 2,
        "pause_before": 1.6,
        "rate": "+2%",
        "pitch": "+0Hz",
        "text": "Now slide it across. First touch: one times four is four. Next step: five plus eight gives thirteen.",
    },
    {
        "id": "v2_s10_slide_peak",
        "act": 2,
        "pause_before": 1.7,
        "rate": "-3%",
        "pitch": "+2Hz",
        "text": "Full overlap in the center: six plus ten plus twelve peaks at twenty-eight! Then twenty-seven... and finally, eighteen.",
    },
    {
        "id": "v2_s11_smoothing",
        "act": 3,
        "pause_before": 1.7,
        "rate": "+0%",
        "pitch": "+1Hz",
        "text": "What if our strip holds weights that add up to one—like a quarter, a half, and a quarter? Sliding it across a noisy signal averages neighboring points into a smooth curve.",
    },
    {
        "id": "v2_s12_integral",
        "act": 3,
        "pause_before": 2.0,
        "rate": "-4%",
        "pitch": "-1Hz",
        "text": "Shrink those steps until they become infinitely thin... and the sum melts into a smooth shaded area: the continuous convolution integral.",
    },
    {
        "id": "v2_s13_image_blur",
        "act": 4,
        "pause_before": 1.8,
        "rate": "+1%",
        "pitch": "+1Hz",
        "text": "In two dimensions, our sliding strip becomes a three-by-three window scanning across an image. When all nine weights are one-ninth, sharp jumps blend into a soft blur.",
    },
    {
        "id": "v2_s14_image_edge",
        "act": 4,
        "pause_before": 1.9,
        "rate": "-1%",
        "pitch": "+2Hz",
        "text": "Now put negative weights on the left, and positive on the right. Flat patches cancel to zero... while the vertical boundary lights up bright.",
    },
    {
        "id": "v2_s15_cnn_twist",
        "act": 5,
        "pause_before": 1.7,
        "rate": "-2%",
        "pitch": "+1Hz",
        "text": "Here is the twist in modern AI. Deep learning libraries actually skip the one-hundred-eighty-degree flip, and compute cross-correlation instead.",
    },
    {
        "id": "v2_s16_outro",
        "act": 5,
        "pause_before": 1.6,
        "rate": "-5%",
        "pitch": "-1Hz",
        "text": "Because a neural network learns its filter weights from data, it simply learns them already flipped. One big idea connects them all: flip... slide... multiply... and sum.",
    },
]

def get_duration(path):
    res = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", path],
        capture_output=True, text=True, check=True
    )
    return float(res.stdout.strip())

async def synth_all():
    for f in os.listdir(OUT_DIR):
        if f.endswith((".mp3", ".wav")):
            os.remove(os.path.join(OUT_DIR, f))

    timeline = []
    cursor = 0.0
    total_speech_dur = 0.0
    for seg in SEGMENTS:
        cursor += seg["pause_before"]
        mp3_path = os.path.join(OUT_DIR, f"{seg['id']}.mp3")
        wav_path = os.path.join(OUT_DIR, f"{seg['id']}.wav")
        for attempt in range(4):
            try:
                comm = edge_tts.Communicate(
                    seg["text"],
                    VOICE,
                    rate=seg.get("rate", "+0%"),
                    pitch=seg.get("pitch", "+0Hz"),
                    boundary="WordBoundary"
                )
                words = []
                with open(mp3_path, "wb") as f:
                    async for chunk in comm.stream():
                        if chunk["type"] == "audio":
                            f.write(chunk["data"])
                        elif chunk["type"] == "WordBoundary":
                            w_start = chunk["offset"] / 10_000_000.0
                            w_dur = chunk["duration"] / 10_000_000.0
                            words.append({
                                "word": chunk["text"],
                                "rel_start": round(w_start, 3),
                                "rel_end": round(w_start + w_dur, 3),
                                "start": round(cursor + w_start, 3),
                                "end": round(cursor + w_start + w_dur, 3),
                            })
                break
            except Exception as e:
                if attempt == 3:
                    raise
                print(f"  Retry {attempt+1} for {seg['id']} after {e}...")
                await asyncio.sleep(0.8 * (attempt + 1))
        subprocess.run([
            "ffmpeg", "-y", "-loglevel", "error", "-i", mp3_path,
            "-af", "silenceremove=start_periods=1:start_silence=0.02:start_threshold=-50dB,areverse,silenceremove=start_periods=1:start_silence=0.05:start_threshold=-50dB,areverse",
            "-ar", "48000", "-ac", "2", wav_path
        ], check=True)
        dur = get_duration(wav_path)
        total_speech_dur += dur
        seg_info = {
            "id": seg["id"],
            "act": seg["act"],
            "pause_before": seg["pause_before"],
            "rate": seg.get("rate", "+0%"),
            "pitch": seg.get("pitch", "+0Hz"),
            "text": seg["text"],
            "start": round(cursor, 3),
            "end": round(cursor + dur, 3),
            "duration": round(dur, 3),
            "wav": wav_path,
            "words": words,
        }
        timeline.append(seg_info)
        print(f"{seg['id']} ({seg['rate']}, {seg['pitch']}): {seg_info['start']:.2f}s -> {seg_info['end']:.2f}s ({dur:.2f}s)")
        cursor += dur

    total_duration = round(cursor + 3.0, 2)
    duty_cycle = round((total_speech_dur / total_duration) * 100, 1)
    out_data = {
        "voice": VOICE,
        "total_duration": total_duration,
        "total_speech_seconds": round(total_speech_dur, 2),
        "speech_duty_cycle_pct": duty_cycle,
        "segments": timeline,
    }
    data_dir = os.path.join(BASE_DIR, "src/data")
    os.makedirs(data_dir, exist_ok=True)
    with open(os.path.join(data_dir, "narration.json"), "w") as f:
        json.dump(out_data, f, indent=2)
    print(f"\nTotal Exp 002 v3 duration: {total_duration}s | Speech: {total_speech_dur:.2f}s ({duty_cycle}% duty cycle)")

if __name__ == "__main__":
    asyncio.run(synth_all())
