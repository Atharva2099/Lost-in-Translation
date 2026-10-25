const fs = require("node:fs");
const { join, resolve } = require("node:path");
const { spawnSync } = require("node:child_process");
const { noSymlinks, atomicWrite, PROJECT } = require("./workspace");
const {
  probeAudioDuration,
  alignWords,
  buildSubtitles,
  synthesizeSegmentTTS,
  synthesizeOfflineToneWav
} = require("./subtitles");

async function generateSceneAudio(workspace, sceneId, scriptBeats, { session = null, offline = false, voice = "Puck", style = "clear and engaging" } = {}) {
  // scriptBeats: array of { id, text, pause_before, pause_after }
  const sceneRoot = workspace.path ? workspace.root : workspace;
  const audioDir = join(sceneRoot, "audio");
  fs.mkdirSync(audioDir, { recursive: true });

  const segments = [];
  let timelineCursor = 0.0;
  const segmentFiles = [];

  for (let idx = 0; idx < scriptBeats.length; idx++) {
    const beat = scriptBeats[idx];
    const pauseBefore = Math.max(0, Number(beat.pause_before || 0.4));
    const pauseAfter = Math.max(0, Number(beat.pause_after || 0.4));
    timelineCursor += pauseBefore;

    const segWav = join(audioDir, `seg_${idx}_raw.wav`);
    if (offline || !session) {
      // Deterministic tone generator for offline / test mode
      const estimatedDur = Math.max(1.2, beat.text.split(/\s+/).length * 0.38);
      synthesizeOfflineToneWav(estimatedDur, segWav);
    } else {
      // Live low-latency TTS
      const wavBytes = await synthesizeSegmentTTS(session, beat.text, { voice, style });
      fs.writeFileSync(segWav, wavBytes);
    }

    // Clean silence and ensure 48kHz mono for clean concatenation
    const cleanWav = join(audioDir, `seg_${idx}_clean.wav`);
    const trimRes = spawnSync("ffmpeg", [
      "-y", "-loglevel", "error",
      "-i", segWav,
      "-af", "silenceremove=start_periods=1:start_silence=0.01:start_threshold=-48dB,areverse,silenceremove=start_periods=1:start_silence=0.03:start_threshold=-48dB,areverse",
      "-ar", "48000", "-ac", "1",
      cleanWav
    ], { timeout: 15000 });
    
    const activeFile = trimRes.status === 0 && fs.existsSync(cleanWav) ? cleanWav : segWav;
    const dur = probeAudioDuration(activeFile);
    const segStart = Number(timelineCursor.toFixed(3));
    const segEnd = Number((timelineCursor + dur).toFixed(3));
    
    const words = alignWords(beat.text, segStart, segEnd);
    segments.push({
      id: beat.id || `b_${idx}`,
      text: beat.text,
      start: segStart,
      end: segEnd,
      duration: dur,
      words
    });

    segmentFiles.push({ file: activeFile, start: segStart, dur });
    timelineCursor = segEnd + pauseAfter;
  }

  const totalDuration = Number(Math.max(timelineCursor, 2.0).toFixed(3));

  // Assemble concatenated voice track at exact timestamps
  const voiceTrackWav = join(audioDir, "voice_track.wav");
  const concatList = join(audioDir, "concat.txt");
  
  // Build ffmpeg filter_complex to place each segment at its exact start offset
  const filterInputs = [];
  const filterPads = [];
  for (let i = 0; i < segmentFiles.length; i++) {
    filterInputs.push("-i", segmentFiles[i].file);
    const delayMs = Math.round(segmentFiles[i].start * 1000);
    filterPads.push(`[${i}:a]adelay=${delayMs}|${delayMs}[a${i}]`);
  }
  const amixInputPads = segmentFiles.map((_, i) => `[a${i}]`).join("");
  const filterComplex = `${filterPads.join(";")};${amixInputPads}amix=inputs=${segmentFiles.length}:dropout_transition=0,apad,atrim=0:${totalDuration}[out]`;

  const mixRes = spawnSync("ffmpeg", [
    "-y", "-loglevel", "error",
    ...filterInputs,
    "-filter_complex", filterComplex,
    "-map", "[out]",
    "-ar", "48000", "-ac", "1",
    voiceTrackWav
  ], { timeout: 30000 });

  if (mixRes.error || mixRes.status !== 0) {
    throw new Error(`Failed to composite voice track: ${mixRes.stderr || mixRes.error?.message}`);
  }

  // Generate procedural ducked music bed via Python script
  const masterAudioWav = join(audioDir, "master_audio.wav");
  const pyBedScript = join(PROJECT, "src/harness/compose_bed.py");
  const bedRes = spawnSync("python3", [
    pyBedScript,
    voiceTrackWav,
    masterAudioWav,
    String(totalDuration)
  ], { timeout: 45000, encoding: "utf8" });

  if (bedRes.error || bedRes.status !== 0) {
    // If numpy/scipy bed generation fails, fall back to stereo voice directly
    spawnSync("ffmpeg", [
      "-y", "-loglevel", "error",
      "-i", voiceTrackWav,
      "-ar", "48000", "-ac", "2",
      masterAudioWav
    ]);
  }

  // Generate subtitle artifacts (.srt, .vtt, subtitles.json)
  const { cues, srt, vtt } = buildSubtitles(segments);
  const subsJsonPath = join(audioDir, "subtitles.json");
  const srtPath = join(audioDir, "subtitles.srt");
  const vttPath = join(audioDir, "subtitles.vtt");

  fs.writeFileSync(subsJsonPath, JSON.stringify(cues, null, 2));
  fs.writeFileSync(srtPath, srt);
  fs.writeFileSync(vttPath, vtt);

  const narrationManifest = {
    total_duration: totalDuration,
    segments,
    subtitles: cues,
    master_audio: "audio/master_audio.wav",
    subtitles_srt: "audio/subtitles.srt",
    subtitles_vtt: "audio/subtitles.vtt"
  };

  fs.writeFileSync(join(audioDir, "narration.json"), JSON.stringify(narrationManifest, null, 2));
  return narrationManifest;
}

module.exports = {
  generateSceneAudio
};
