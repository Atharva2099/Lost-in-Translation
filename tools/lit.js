const fs = require("node:fs");
const { resolve, join } = require("node:path");
const { parseArgs } = require("node:util");
const { randomUUID } = require("node:crypto");
const { Workspace, PROJECT } = require("../src/harness/workspace");
const { GeminiSession, credentials } = require("../src/harness/gemini");
const { verifyScene, renderPreview } = require("../src/harness/render");
const { runAgent } = require("../src/harness/agent");
const { syncSkills, readSkill } = require("../src/harness/skills");
const demo = require("../src/harness/demo");
const risoDemo = require("../src/harness/riso-demo");

function validateBrief(brief) {
  if (!brief || typeof brief.topic !== "string" || !brief.topic.trim() || typeof brief.audience !== "string" ||
      typeof brief.takeaway !== "string" || !["line", "watercolor", "risograph"].includes(brief.style) ||
      !Number.isFinite(brief.duration) || brief.duration < 10 || brief.duration > 15 ||
      !Array.isArray(brief.facts) || !brief.facts.every((item) => typeof item === "string") ||
      !Array.isArray(brief.sources) || !brief.sources.every((item) => typeof item === "string") ||
      JSON.stringify(brief).length > 12000) throw new Error("Invalid brief: provide topic, audience, takeaway, duration 10–15, style line/watercolor/risograph, facts and sources.");
  return brief;
}

function applyResumeLimits(workspace, limits, approvedIncrease, approvedRequests = false) {
  const previous = workspace.state.limits;
  const normalized = previous && { ...previous, reviewerMaxOutputTokens: previous.reviewerMaxOutputTokens ?? Math.min(previous.maxOutputTokens, 8192) };
  if (JSON.stringify(normalized) === JSON.stringify(limits)) return;
  if (!normalized || limits.reviewerMaxOutputTokens !== normalized.reviewerMaxOutputTokens ||
      (limits.maxCalls !== normalized.maxCalls && !(approvedRequests && limits.maxCalls > normalized.maxCalls)) ||
      (limits.maxOutputTokens !== normalized.maxOutputTokens && !(approvedIncrease && limits.maxOutputTokens > normalized.maxOutputTokens))) {
    throw new Error("Resume requires explicit approval flags for any output or request limit increase.");
  }
  const change = { at: new Date().toISOString(), api_calls_already_used: workspace.state.api_calls, previous: normalized, approved: limits };
  workspace.state.limit_changes = [...(workspace.state.limit_changes || []), change];
  workspace.state.limits = limits;
  workspace.save();
  workspace.event({ type: "approved_limits_increased", ...change });
}

async function main() {
  const { values, positionals } = parseArgs({ allowPositionals: true, options: {
    id: { type: "string" }, brief: { type: "string" }, live: { type: "boolean", default: false },
    "max-calls": { type: "string" }, "max-output-tokens": { type: "string" }, width: { type: "string" },
    thinking: { type: "string", default: "medium" }, "review-output-tokens": { type: "string" },
    "approve-output-increase": { type: "boolean", default: false },
    "approve-request-increase": { type: "boolean", default: false }, style: { type: "string" }
  } });
  const command = positionals[0] || "help";
  if (command === "help") {
    console.log("Commands: demo (offline), sync-skills, status --id, generate/resume --live --max-calls=N --max-output-tokens=N [--id] [--brief=approved.json].");
    console.log("Generated JS runs only in Chromium, never Node. Demo is hand-authored, silent, and makes no API calls.");
    return;
  }
  if (command === "sync-skills") { console.log(JSON.stringify(await syncSkills())); return; }
  if (command === "status") {
    if (!values.id) throw new Error("status requires --id.");
    const workspace = new Workspace(values.id);
    console.log(JSON.stringify({ id: workspace.id, state: workspace.state, gate: workspace.gate() }, null, 2));
    return;
  }
  if (!["demo", "generate", "resume"].includes(command)) throw new Error("Unknown command.");
  const live = command !== "demo";
  let limits;
  if (live) {
    if (!values.live || !values["max-calls"] || !values["max-output-tokens"]) {
      throw new Error("Generation requires explicit --live, --max-calls and --max-output-tokens; no API call made.");
    }
    limits = { maxCalls: Number(values["max-calls"]), maxOutputTokens: Number(values["max-output-tokens"]),
      reviewerMaxOutputTokens: Number(values["review-output-tokens"] || Math.min(Number(values["max-output-tokens"]), 8192)) };
    // Validate limits without creating a workspace or touching credentials.
    new GeminiSession({ client: null, ...limits, thinkingLevel: values.thinking });
    readSkill("engine");
    readSkill("style-line");
  }
  let brief = demo.brief;
  if (values.brief) {
    const path = resolve(values.brief);
    if (!path.endsWith(".json") || fs.statSync(path).size > 12000) throw new Error("Brief must be a JSON file at most 12 KB.");
    brief = JSON.parse(fs.readFileSync(path, "utf8"));
  }
  validateBrief(brief);
  if (values.style) brief = validateBrief({ ...brief, style: values.style });
  if (command === "resume" && values.style) throw new Error("Choose a style on a new run; resume preserves its approved brief.");
  if (command === "resume" && !values.id) throw new Error("resume requires --id.");
  const id = values.id || `${live ? "scene" : "demo"}-${randomUUID().slice(0, 8)}`;
  const workspace = new Workspace(id, { create: command !== "resume", brief, limits: limits || null });
  console.log(JSON.stringify({ run: id, command, style: JSON.parse(workspace.read("brief.json")).style }));
  const release = workspace.acquire();
  const controller = new AbortController();
  const cancel = () => controller.abort();
  process.once("SIGINT", cancel);
  const timer = setTimeout(cancel, 900000);
  timer.unref();
  try {
    if (command === "resume") applyResumeLimits(workspace, limits, values["approve-output-increase"], values["approve-request-increase"]);
    if (!live) {
      workspace.writeScene(brief.style === "risograph" ? risoDemo.source : demo.source);
      const verification = await verifyScene(workspace, { signal: controller.signal });
      if (!verification.passed) throw new Error("Offline demo verification failed; inspect the saved verification artifact.");
      await renderPreview(workspace, { signal: controller.signal, width: Number(values.width || 540) });
      workspace.state.status = "local_preview_only";
      workspace.save();
      console.log(JSON.stringify({ id, origin: "hand-authored plumbing fixture", api_calls: 0,
        verification_passed: true, preview: join(workspace.artifactDir(), "preview.mp4"), flash_reviewed: false }));
      return;
    }
    const key = credentials(process.env, join(PROJECT, ".env"));
    if (!key) throw new Error("Gemini credentials are not configured locally.");
    const { GoogleGenAI } = require("@google/genai");
    const session = new GeminiSession({ client: new GoogleGenAI({ apiKey: key }), ...limits,
      initialCalls: workspace.state.api_calls, signal: controller.signal, thinkingLevel: values.thinking, reserveReviewer: true,
      timeoutMs: limits.maxOutputTokens > 16384 ? 900000 : 120000,
      onEvent(event) {
        if (event.type === "request_started") { workspace.state.api_calls = event.call; workspace.save(); }
        workspace.event(event);
        console.log(JSON.stringify(event));
      } });
    const gate = await runAgent(workspace, session, { signal: controller.signal, autoPipeline: true });
    console.log(JSON.stringify({ id, ...gate, preview: join(workspace.artifactDir(), "preview.mp4") }));
  } finally {
    clearTimeout(timer);
    process.removeListener("SIGINT", cancel);
    release();
  }
}

if (require.main === module) main().catch((error) => {
  let message = error.message || "Harness operation failed.";
  try { const key = credentials(process.env, join(PROJECT, ".env")); if (key) message = message.split(key).join("[REDACTED]"); } catch { /* Never print credential parser details. */ }
  console.error(message.replace(/AIza[\w-]+/g, "[REDACTED]"));
  process.exitCode = 1;
});

module.exports = { main, validateBrief, applyResumeLimits };
