import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { registerAppResource, registerAppTool, RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps/server";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import { billingStatus, checkoutFor } from "./src/billing.mjs";
import { FREE_BETA, generationCost, PLANS } from "./src/plans.mjs";
import { canSpend, getAccount, listProjects, saveProject } from "./src/store.mjs";

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
function accountPayload() { return { ...billingStatus(getAccount()), projectsCount: listProjects().length }; }

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

function createMuseWaveServer() {
  const server = new McpServer({ name: "musewave-gpt", version: "0.2.0" });
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
    const cost = generationCost(input);
    if (!canSpend(cost, !FREE_BETA)) return { isError: true, content: [{ type: "text", text: "Not enough credits. Choose a plan or wait for the next credit refresh." }] };
    const project = buildConcept(input, cost);
    saveProject(project, cost, !FREE_BETA);
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
  return server;
}

const httpServer = createServer(async (req, res) => {
  res.setHeader("x-content-type-options", "nosniff");
  if (req.method === "GET" && req.url === "/health") { res.writeHead(200, { "content-type": "application/json" }); res.end(JSON.stringify({ ok: true, name: "musewave-gpt", version: "0.2.0", freeBeta: FREE_BETA })); return; }
  if (req.url === "/mcp") {
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    res.on("close", () => transport.close());
    const server = createMuseWaveServer(); await server.connect(transport); await transport.handleRequest(req, res); return;
  }
  res.writeHead(404, { "content-type": "application/json" }); res.end(JSON.stringify({ error: "Not found" }));
});

httpServer.listen(PORT, () => console.log(`MuseWave GPT v0.2 listening on http://localhost:${PORT}/mcp`));
