import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { registerAppResource, registerAppTool, RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps/server";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import { billingStatus, checkoutFor } from "./src/billing.mjs";
import { FREE_BETA, generationCost, PLANS } from "./src/plans.mjs";
import { buildPreferenceProfile } from "./src/learning.mjs";
import { canSpend, exportTrainingExamples, getAccount, getLearningStatus, listProjects, recordFeedback, saveProject, setLearningConsent } from "./src/store.mjs";

const PORT = Number(process.env.PORT || 8787);
const UI_URI = "ui://musewave/studio.html";
const widgetHtml = readFileSync(new URL("./public/music-studio.html", import.meta.url), "utf8");

const projectSchema = z.object({
  id: z.string(), title: z.string(), prompt: z.string(), genre: z.string(), mood: z.string(),
  energy: z.number(), duration: z.number(), mode: z.enum(["instrumental", "vocal"]),
  quality: z.enum(["draft", "studio"]), language: z.string(), lyrics: z.string(),
  bpm: z.number(), key: z.string(), cost: z.number(), status: z.enum(["concept", "queued", "ready"]),
  createdAt: z.string(), commercialUse: z.boolean(),
});

const projectOutput = { project: projectSchema, account: z.any() };
const genres = ["Pop", "Electronic", "Hip-hop", "R&B", "Rock", "Ambient", "Latin", "Afrobeats", "Cinematic"];
const moods = ["Euphoric", "Dreamy", "Dark", "Romantic", "Focused", "Nostalgic", "Confident", "Peaceful"];

function hash(text) { return [...text].reduce((a, c) => ((a << 5) - a + c.charCodeAt(0)) | 0, 0); }
function accountPayload() { return { ...billingStatus(getAccount()), projectsCount: listProjects().length, learning: getLearningStatus() }; }

function buildConcept(input, cost) {
  const seed = Math.abs(hash(`${input.prompt}:${input.genre}:${input.mood}:${input.seed ?? ""}`));
  const bpmMin = input.genre === "Ambient" ? 64 : input.genre === "Hip-hop" ? 76 : input.genre === "Afrobeats" ? 96 : 88;
  const account = getAccount();
  return {
    id: `mw_${Date.now().toString(36)}_${seed.toString(36).slice(0, 4)}`,
    title: input.title?.trim() || "Untitled wave",
    prompt: input.prompt.trim(), genre: input.genre, mood: input.mood,
    energy: input.energy, duration: input.duration, mode: input.mode, quality: input.quality,
    language: input.language, lyrics: input.lyrics?.trim() || "",
    bpm: bpmMin + (seed % 48), key: ["C minor", "D major", "E minor", "F major", "A minor", "G major"][seed % 6],
    cost, status: "concept", createdAt: new Date().toISOString(),
    commercialUse: PLANS[account.planId].commercialLicense,
  };
}

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function json(res, status, payload) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  res.end(JSON.stringify(payload));
}

function createConcept(input) {
  const cost = generationCost(input);
  if (!canSpend(cost, !FREE_BETA)) throw new Error("Not enough credits");
  const project = buildConcept(input, cost);
  saveProject(project, cost, !FREE_BETA);
  return { project, account: accountPayload() };
}

function createMuseWaveServer() {
  const server = new McpServer({ name: "musewave-gpt", version: "0.3.0" });
  registerAppResource(server, "musewave-studio", UI_URI, {}, async () => ({
    contents: [{ uri: UI_URI, mimeType: RESOURCE_MIME_TYPE, text: widgetHtml }],
  }));

  registerAppTool(server, "open_music_studio", {
    title: "Open MuseWave Studio",
    description: "Open an original AI music workspace with creation, library, usage, and pricing controls.",
    inputSchema: {}, _meta: { ui: { resourceUri: UI_URI } },
  }, async () => ({ content: [{ type: "text", text: "MuseWave Studio is ready." }], structuredContent: { account: accountPayload(), projects: listProjects(), plans: Object.values(PLANS) } }));

  registerAppTool(server, "create_music_concept", {
    title: "Create an original music concept",
    description: "Create and save an original track concept. Named-artist imitation and unauthorized voice cloning are not supported.",
    inputSchema: {
      title: z.string().max(80).optional(), prompt: z.string().min(3).max(1500),
      genre: z.enum(genres), mood: z.enum(moods), energy: z.number().int().min(1).max(5),
      duration: z.number().int().min(15).max(600), mode: z.enum(["instrumental", "vocal"]),
      quality: z.enum(["draft", "studio"]).default("draft"), language: z.string().max(40).default("English"),
      lyrics: z.string().max(4000).default(""), seed: z.string().max(80).optional(),
    }, outputSchema: projectOutput, _meta: { ui: { resourceUri: UI_URI } },
  }, async (input) => {
    let result;
    try { result = createConcept(input); }
    catch (error) { return { isError: true, content: [{ type: "text", text: error.message }] }; }
    const { project } = result;
    return { content: [{ type: "text", text: `Created “${project.title}” — ${project.genre}, ${project.bpm} BPM, ${project.key}.` }], structuredContent: { project, account: accountPayload() } };
  });

  registerAppTool(server, "list_music_projects", {
    title: "List my MuseWave projects", description: "Return recent music projects for the current MuseWave account.",
    inputSchema: {}, outputSchema: { projects: z.array(projectSchema), account: z.any() }, _meta: { ui: { resourceUri: UI_URI } },
  }, async () => ({ content: [{ type: "text", text: `Found ${listProjects().length} projects.` }], structuredContent: { projects: listProjects(), account: accountPayload() } }));

  registerAppTool(server, "get_musewave_account", {
    title: "Check MuseWave usage", description: "Show the plan, beta status, credits, and current usage.",
    inputSchema: {}, outputSchema: { account: z.any(), plans: z.array(z.any()) }, _meta: { ui: { resourceUri: UI_URI } },
  }, async () => ({ content: [{ type: "text", text: FREE_BETA ? "MuseWave is currently in free beta." : "MuseWave account status loaded." }], structuredContent: { account: accountPayload(), plans: Object.values(PLANS) } }));

  registerAppTool(server, "start_plan_checkout", {
    title: "Start MuseWave plan checkout", description: "Prepare an external checkout for a paid MuseWave plan. Disabled during free beta.",
    inputSchema: { planId: z.enum(["creator", "pro", "studio"]) }, outputSchema: { checkout: z.any() }, _meta: { ui: { resourceUri: UI_URI } },
  }, async ({ planId }) => { const checkout = checkoutFor(planId); return { content: [{ type: "text", text: checkout.message }], structuredContent: { checkout } }; });

  registerAppTool(server, "set_personalization_consent", {
    title: "Set MuseWave learning consent",
    description: "Turn per-user preference learning on or off. MuseWave records ratings only after explicit opt-in.",
    inputSchema: { enabled: z.boolean() }, outputSchema: { learning: z.any() }, _meta: { ui: { resourceUri: UI_URI } },
  }, async ({ enabled }) => {
    const learning = setLearningConsent(enabled);
    return { content: [{ type: "text", text: enabled ? "Personalized learning enabled." : "Personalized learning disabled." }], structuredContent: { learning, account: accountPayload() } };
  });

  registerAppTool(server, "rate_music_project", {
    title: "Rate a MuseWave project",
    description: "Record a 1–5 rating and optional preference tags for a saved project after personalization consent.",
    inputSchema: { projectId: z.string().min(1), rating: z.number().int().min(1).max(5), tags: z.array(z.string().max(30)).max(8).default([]) },
    outputSchema: { learning: z.any(), profile: z.any() }, _meta: { ui: { resourceUri: UI_URI } },
  }, async (event) => {
    try {
      const learning = recordFeedback(event);
      const profile = buildPreferenceProfile(exportTrainingExamples());
      return { content: [{ type: "text", text: `Rating saved. MuseWave has ${learning.feedbackCount} learning examples.` }], structuredContent: { learning, profile, account: accountPayload() } };
    } catch (error) {
      return { isError: true, content: [{ type: "text", text: error.message }] };
    }
  });

  registerAppTool(server, "get_learning_status", {
    title: "Check MuseWave learning status",
    description: "Show personalization consent, training readiness, feedback count, and the current preference profile.",
    inputSchema: {}, outputSchema: { learning: z.any(), profile: z.any() }, _meta: { ui: { resourceUri: UI_URI } },
  }, async () => ({ content: [{ type: "text", text: "MuseWave learning status loaded." }], structuredContent: { learning: getLearningStatus(), profile: buildPreferenceProfile(exportTrainingExamples()), account: accountPayload() } }));
  return server;
}

const httpServer = createServer(async (req, res) => {
  res.setHeader("x-content-type-options", "nosniff");
  if (req.method === "GET" && req.url === "/") {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-cache" });
    res.end(widgetHtml);
    return;
  }
  if (req.method === "GET" && req.url === "/favicon.ico") { res.writeHead(204); res.end(); return; }
  if (req.method === "GET" && req.url === "/health") { res.writeHead(200, { "content-type": "application/json" }); res.end(JSON.stringify({ ok: true, name: "musewave-gpt", version: "0.3.0", freeBeta: FREE_BETA })); return; }
  try {
    if (req.method === "GET" && req.url === "/api/bootstrap") return json(res, 200, { structuredContent: { account: accountPayload(), projects: listProjects(), plans: Object.values(PLANS) } });
    if (req.method === "GET" && req.url === "/api/projects") return json(res, 200, { structuredContent: { projects: listProjects(), account: accountPayload() } });
    if (req.method === "GET" && req.url === "/api/learning") return json(res, 200, { structuredContent: { learning: getLearningStatus(), profile: buildPreferenceProfile(exportTrainingExamples()), account: accountPayload() } });
    if (req.method === "POST" && req.url === "/api/concepts") return json(res, 201, { structuredContent: createConcept(await readJson(req)) });
    if (req.method === "POST" && req.url === "/api/learning/consent") { const body = await readJson(req); const learning = setLearningConsent(body.enabled); return json(res, 200, { structuredContent: { learning, account: accountPayload() } }); }
    if (req.method === "POST" && req.url === "/api/feedback") { const body = await readJson(req); const learning = recordFeedback(body); return json(res, 200, { structuredContent: { learning, profile: buildPreferenceProfile(exportTrainingExamples()), account: accountPayload() } }); }
    if (req.method === "POST" && req.url === "/api/checkout") { const body = await readJson(req); return json(res, 200, { structuredContent: { checkout: checkoutFor(body.planId) } }); }
  } catch (error) {
    return json(res, 400, { error: error.message });
  }
  if (req.url === "/mcp") {
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    res.on("close", () => transport.close());
    const server = createMuseWaveServer(); await server.connect(transport); await transport.handleRequest(req, res); return;
  }
  res.writeHead(404, { "content-type": "application/json" }); res.end(JSON.stringify({ error: "Not found" }));
});

httpServer.listen(PORT, () => console.log(`MuseWave GPT v0.3 listening on http://localhost:${PORT}/mcp`));
