import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { registerAppResource, registerAppTool, RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps/server";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import { billingStatus, checkoutFor } from "./src/billing.mjs";
import { FREE_BETA, generationCost, PLANS } from "./src/plans.mjs";
import { buildPreferenceProfile } from "./src/learning.mjs";
import { canSpend, exportTrainingExamples, getAccount, getLearningStatus, listProjects, recordFeedback, saveProject, setLearningConsent } from "./src/store.mjs";
import { createNexusCore } from "./src/nexus-core.mjs";
import { NexusModel, NEXUS_LABELS } from "./src/nexus-model.mjs";
import { checkoutForNexus, evaluateRevenueExperiment, revenueStatus } from "./src/nexus-revenue.mjs";

const PORT = Number(process.env.PORT || 8787);
const ENGINE_URL = (process.env.MUSEWAVE_ENGINE_URL || "").replace(/\/$/, "");
const ENGINE_TOKEN = process.env.MUSEWAVE_ENGINE_TOKEN || "";
const UI_URI = "ui://nexus/sovereign.html";
const MAX_JSON_BYTES = 64 * 1024;
const widgetHtml = readFileSync(new URL("./public/sovereign-ai.html", import.meta.url), "utf8");
const NEXUS_MODEL_URL = (process.env.NEXUS_MODEL_URL || "").replace(/\/$/, "");
const NEXUS_MODEL_TOKEN = process.env.NEXUS_MODEL_TOKEN || "";
const nexusCore=createNexusCore({providerReady:()=>Boolean(NEXUS_MODEL_URL)});
const nexusModel=new NexusModel().seed();

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
const conceptInputSchema = z.object({
  title: z.string().max(80).optional(), prompt: z.string().min(3).max(1500),
  genre: z.enum(genres), mood: z.enum(moods), energy: z.number().int().min(1).max(5),
  duration: z.number().int().min(15).max(600), mode: z.enum(["instrumental", "vocal"]),
  quality: z.enum(["draft", "studio"]).default("draft"), language: z.string().max(40).default("English"),
  lyrics: z.string().max(4000).default(""), seed: z.string().max(80).optional(),
}).strict();
const consentSchema = z.object({ enabled: z.boolean() }).strict();
const feedbackSchema = z.object({ projectId: z.string().min(1).max(120), rating: z.number().int().min(1).max(5), tags: z.array(z.string().max(30)).max(8).default([]) }).strict();
const checkoutSchema = z.object({ planId: z.enum(["creator", "pro", "studio"]) }).strict();
const sovereignInputSchema = z.object({ prompt:z.string().min(2).max(6000), mode:z.enum(["auto","strategist","builder","repair","revenue","research"]).default("auto") }).strict();
const researchInputSchema=z.object({question:z.string().min(3).max(2000),objective:z.string().max(2000).default(""),sources:z.array(z.string().max(500)).max(12).default([])}).strict();
const memoryInputSchema=z.object({content:z.string().min(2).max(6000),source:z.string().max(80).default("owner"),outcome:z.boolean().nullable().default(null),tags:z.array(z.string().max(40)).max(10).default([])}).strict();
const learningInputSchema=z.object({prompt:z.string().min(2).max(6000),correctMode:z.enum(NEXUS_LABELS)}).strict();
const revenueExperimentSchema=z.object({visitors:z.number().min(0),signups:z.number().min(0),customers:z.number().min(0),revenue:z.number().min(0),cost:z.number().min(0)}).strict();
const nexusCheckoutSchema=z.object({planId:z.enum(["solo","builder","business"])}).strict();

class HttpError extends Error { constructor(status, message) { super(message); this.status = status; } }

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

export async function readJson(req) {
  const type = String(req.headers["content-type"] || "").split(";", 1)[0].trim().toLowerCase();
  if (type !== "application/json") throw new HttpError(415, "Content-Type must be application/json");
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_JSON_BYTES) throw new HttpError(413, "Request body is too large");
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch { throw new HttpError(400, "Request body must contain valid JSON"); }
}

async function validatedJson(req, schema) {
  const result = schema.safeParse(await readJson(req));
  if (!result.success) throw new HttpError(422, "Request fields are invalid");
  return result.data;
}

function json(res, status, payload) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  res.end(JSON.stringify(payload));
}

function setSecurityHeaders(res) {
  res.setHeader("x-content-type-options", "nosniff");
  res.setHeader("referrer-policy", "no-referrer");
  res.setHeader("permissions-policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader("cross-origin-resource-policy", "same-origin");
}

function engineHeaders(jsonBody = false) {
  return { ...(jsonBody ? { "content-type": "application/json" } : {}), ...(ENGINE_TOKEN ? { authorization: `Bearer ${ENGINE_TOKEN}` } : {}) };
}

async function engineFetch(path, options = {}) {
  if (!ENGINE_URL) throw new Error("MuseWave Engine is not configured");
  const response = await fetch(`${ENGINE_URL}${path}`, { ...options, headers: { ...engineHeaders(Boolean(options.body)), ...options.headers }, signal: AbortSignal.timeout(120_000) });
  if (!response.ok) {
    let message = `MuseWave Engine returned ${response.status}`;
    try { message = (await response.json()).detail || message; } catch {}
    throw new Error(message);
  }
  return response;
}

function createConcept(input) {
  const cost = generationCost(input);
  if (!canSpend(cost, !FREE_BETA)) throw new Error("Not enough credits");
  const project = buildConcept(input, cost);
  saveProject(project, cost, !FREE_BETA);
  return { project, account: accountPayload() };
}

function localSovereign(input) {
  const focus={strategist:"Turn the objective into a measurable strategy",builder:"Design a buildable system with a small first release",repair:"Diagnose the failure before changing code",revenue:"Find an ethical path to validated customer revenue",research:"Separate known facts, assumptions and evidence needed"}[input.mode];
  const plans={strategist:["Define the result and deadline","List constraints and available assets","Run the smallest reversible experiment","Measure the outcome and decide the next iteration"],builder:["Specify the user and core workflow","Choose the minimum architecture","Build and test one vertical slice","Review security, cost and deployment before release"],repair:["Reproduce the problem","Collect logs and isolate the failing boundary","Prepare the smallest patch with regression tests","Deploy only after review and rollback planning"],revenue:["Name the paying customer and urgent problem","Validate demand before building","Offer one clear paid outcome","Track acquisition cost, conversion and retention"],research:["State the decision the research must support","Gather primary evidence","Compare competing explanations","Document uncertainty and recommend a reversible next step"]}[input.mode];
  return `${focus}.\n\nObjective understood: ${input.prompt}\n\nPlan:\n${plans.map((x,i)=>`${i+1}. ${x}`).join("\n")}\n\nI will not claim guaranteed profit or execute external changes without your approval. The next useful step is to complete item 1 with concrete evidence.`;
}

async function askSovereign(input) {
  const prediction=nexusModel.predict(input.prompt),effectiveMode=input.mode==="auto"?prediction.label:input.mode;
  let response=localSovereign({...input,mode:effectiveMode}),providerConfigured=Boolean(NEXUS_MODEL_URL);
  if(providerConfigured){
    const request=await fetch(`${NEXUS_MODEL_URL}/v1/chat/completions`,{method:"POST",headers:{"content-type":"application/json",...(NEXUS_MODEL_TOKEN?{authorization:`Bearer ${NEXUS_MODEL_TOKEN}`}:{})},body:JSON.stringify({model:process.env.NEXUS_MODEL||"default",temperature:.3,max_tokens:1200,messages:[{role:"system",content:"You are NEXUS, an owner-controlled AI copilot. Help create, repair, research and design ethical revenue strategies. Never claim guaranteed income. Never imply an external action happened unless a tool confirms it. Code changes, deployments, purchases, credentials and financial actions require explicit owner approval."},{role:"user",content:`Mode: ${effectiveMode}\nObjective: ${input.prompt}`}]}) ,signal:AbortSignal.timeout(60_000)});
    if(!request.ok)throw new Error(`Model provider returned ${request.status}`);
    const data=await request.json();response=String(data.choices?.[0]?.message?.content||"").slice(0,12000)||response;
  }
  const needsApproval=["builder","repair","revenue"].includes(effectiveMode);
  return {response,mode:effectiveMode,providerConfigured,ownModel:{...prediction,active:true},proposal:needsApproval?{id:`nx_${Date.now().toString(36)}`,title:effectiveMode==="repair"?"Review proposed repair":effectiveMode==="builder"?"Review proposed build":"Review revenue experiment",detail:"Approval records intent only. External execution requires a connected, authorized provider."}:null};
}

function createSovereignServer(){
  const server=new McpServer({name:"nexus-sovereign",version:"1.0.0"});
  registerAppResource(server,"nexus-sovereign",UI_URI,{},async()=>({contents:[{uri:UI_URI,mimeType:RESOURCE_MIME_TYPE,text:widgetHtml}]}));
  registerAppTool(server,"open_nexus",{title:"Open NEXUS Sovereign",description:"Open the owner-controlled AI command center.",inputSchema:{},_meta:{ui:{resourceUri:UI_URI}}},async()=>({content:[{type:"text",text:"NEXUS Sovereign is ready."}],structuredContent:{providerConfigured:Boolean(NEXUS_MODEL_URL)}}));
  registerAppTool(server,"ask_nexus",{title:"Ask NEXUS",description:"Analyze an objective and return a controlled plan. External actions always require owner approval.",inputSchema:sovereignInputSchema.shape,_meta:{ui:{resourceUri:UI_URI}}},async input=>{try{const result=await askSovereign(input);return{content:[{type:"text",text:result.response}],structuredContent:result}}catch(error){return{isError:true,content:[{type:"text",text:error.message}]}}});
  return server;
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
    inputSchema: conceptInputSchema.shape, outputSchema: projectOutput, _meta: { ui: { resourceUri: UI_URI } },
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

export function createHttpServer() { return createServer(async (req, res) => {
  setSecurityHeaders(res);
  if (req.method === "GET" && req.url === "/") {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-cache" });
    res.end(widgetHtml);
    return;
  }
  if (req.method === "GET" && req.url === "/favicon.ico") { res.writeHead(204); res.end(); return; }
  if (req.method === "GET" && req.url === "/health") { res.writeHead(200, { "content-type": "application/json" }); res.end(JSON.stringify({ ok: true, name: "nexus-sovereign", version: "1.0.0", providerConfigured:Boolean(NEXUS_MODEL_URL) })); return; }
  try {
    if(req.method==="GET"&&req.url==="/api/ai/status")return json(res,200,{ready:true,providerConfigured:Boolean(NEXUS_MODEL_URL),ownModel:{active:true,version:nexusModel.version,examples:nexusModel.examples},approvalRequired:true,core:nexusCore.snapshot()});
    if(req.method==="POST"&&req.url==="/api/ai/ask")return json(res,200,await askSovereign(await validatedJson(req,sovereignInputSchema)));
    if(req.method==="POST"&&req.url==="/api/ai/research")return json(res,202,{job:nexusCore.research(await validatedJson(req,researchInputSchema)),core:nexusCore.snapshot()});
    if(req.method==="POST"&&req.url==="/api/ai/memory")return json(res,201,{memory:nexusCore.remember(await validatedJson(req,memoryInputSchema)),core:nexusCore.snapshot()});
    if(req.method==="POST"&&req.url==="/api/ai/learn"){const body=await validatedJson(req,learningInputSchema);const prediction=nexusModel.learn(body.prompt,body.correctMode);nexusCore.remember({content:body.prompt,source:"owner_feedback",outcome:true,tags:[body.correctMode]});return json(res,200,{learned:true,prediction,model:{version:nexusModel.version,examples:nexusModel.examples}})}
    if(req.method==="GET"&&req.url==="/api/revenue/status")return json(res,200,revenueStatus());
    if(req.method==="POST"&&req.url==="/api/revenue/experiment")return json(res,200,evaluateRevenueExperiment(await validatedJson(req,revenueExperimentSchema)));
    if(req.method==="POST"&&req.url==="/api/revenue/checkout")return json(res,200,checkoutForNexus((await validatedJson(req,nexusCheckoutSchema)).planId));
    if (req.method === "GET" && req.url === "/api/bootstrap") return json(res, 200, { structuredContent: { account: accountPayload(), projects: listProjects(), plans: Object.values(PLANS) } });
    if (req.method === "GET" && req.url === "/api/projects") return json(res, 200, { structuredContent: { projects: listProjects(), account: accountPayload() } });
    if (req.method === "GET" && req.url === "/api/learning") return json(res, 200, { structuredContent: { learning: getLearningStatus(), profile: buildPreferenceProfile(exportTrainingExamples()), account: accountPayload() } });
    if (req.method === "GET" && req.url === "/api/engine/status") {
      if (!ENGINE_URL) return json(res, 200, { configured: false, ready: false });
      return json(res, 200, { configured: true, ...(await (await engineFetch("/health")).json()) });
    }
    if (req.method === "POST" && req.url === "/api/engine/generate") {
      const input = conceptInputSchema.pick({ prompt:true, genre:true, mood:true, energy:true, mode:true, language:true, lyrics:true }).extend({ bpm:z.number().int().min(50).max(220), seed:z.number().int().optional() }).strict();
      const response = await engineFetch("/v1/generate", { method: "POST", body: JSON.stringify(await validatedJson(req, input)) });
      res.writeHead(200, { "content-type": "audio/wav", "cache-control": "private, no-store", "x-musewave-seed": response.headers.get("x-musewave-seed") || "" });
      res.end(Buffer.from(await response.arrayBuffer())); return;
    }
    if (req.method === "POST" && req.url === "/api/concepts") return json(res, 201, { structuredContent: createConcept(await validatedJson(req, conceptInputSchema)) });
    if (req.method === "POST" && req.url === "/api/learning/consent") { const body = await validatedJson(req, consentSchema); const learning = setLearningConsent(body.enabled); return json(res, 200, { structuredContent: { learning, account: accountPayload() } }); }
    if (req.method === "POST" && req.url === "/api/feedback") { const body = await validatedJson(req, feedbackSchema); const learning = recordFeedback(body); return json(res, 200, { structuredContent: { learning, profile: buildPreferenceProfile(exportTrainingExamples()), account: accountPayload() } }); }
    if (req.method === "POST" && req.url === "/api/checkout") { const body = await validatedJson(req, checkoutSchema); return json(res, 200, { structuredContent: { checkout: checkoutFor(body.planId) } }); }
  } catch (error) {
    const clientErrors = new Set(["Not enough credits", "Personalization consent is required", "Project not found", "Unknown paid plan", "Billing is not configured"]);
    const status = error instanceof HttpError ? error.status : clientErrors.has(error.message) ? 400 : 500;
    if (status >= 500) console.error("Request failed", { method: req.method, path: req.url, error: error?.message });
    return json(res, status, { error: status >= 500 ? "Service unavailable" : error.message });
  }
  if (req.url === "/mcp") {
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    res.on("close", () => transport.close());
    const server = createSovereignServer(); await server.connect(transport); await transport.handleRequest(req, res); return;
  }
  res.writeHead(404, { "content-type": "application/json" }); res.end(JSON.stringify({ error: "Not found" }));
}); }

export function startServer(port = PORT) {
  const httpServer = createHttpServer();
  httpServer.listen(port, () => console.log(`NEXUS Sovereign v1.0 listening on http://localhost:${port}/mcp`));
  const close = () => httpServer.close(() => process.exit(0));
  process.once("SIGTERM", close); process.once("SIGINT", close);
  return httpServer;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) startServer();
