import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import {
  registerAppResource,
  registerAppTool,
  RESOURCE_MIME_TYPE,
} from "@modelcontextprotocol/ext-apps/server";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";

const PORT = Number(process.env.PORT || 8787);
const widgetHtml = readFileSync(new URL("./public/music-studio.html", import.meta.url), "utf8");

const projectSchema = z.object({
  id: z.string(),
  title: z.string(),
  prompt: z.string(),
  genre: z.string(),
  mood: z.string(),
  energy: z.number(),
  duration: z.number(),
  mode: z.enum(["instrumental", "vocal"]),
  bpm: z.number(),
  key: z.string(),
  status: z.enum(["concept", "queued", "ready"]),
});

const outputSchema = { project: projectSchema };

function hash(text) {
  return [...text].reduce((acc, char) => ((acc << 5) - acc + char.charCodeAt(0)) | 0, 0);
}

function buildConcept(input) {
  const seed = Math.abs(hash(`${input.prompt}:${input.genre}:${input.mood}`));
  const bpmMin = input.genre === "Ambient" ? 66 : input.genre === "Hip-hop" ? 78 : 92;
  return {
    id: `track-${Date.now().toString(36)}`,
    title: input.title?.trim() || "Untitled session",
    prompt: input.prompt.trim(),
    genre: input.genre,
    mood: input.mood,
    energy: input.energy,
    duration: input.duration,
    mode: input.mode,
    bpm: bpmMin + (seed % 48),
    key: ["C minor", "D major", "E minor", "F major", "A minor"][seed % 5],
    status: "concept",
  };
}

function createMuseWaveServer() {
  const server = new McpServer({ name: "musewave-gpt", version: "0.1.0" });

  registerAppResource(
    server,
    "musewave-studio",
    "ui://musewave/studio.html",
    {},
    async () => ({
      contents: [{
        uri: "ui://musewave/studio.html",
        mimeType: RESOURCE_MIME_TYPE,
        text: widgetHtml,
      }],
    }),
  );

  registerAppTool(
    server,
    "open_music_studio",
    {
      title: "Open MuseWave Studio",
      description: "Opens an interactive studio for designing an original music concept.",
      inputSchema: {},
      _meta: { ui: { resourceUri: "ui://musewave/studio.html" } },
    },
    async () => ({
      content: [{ type: "text", text: "MuseWave Studio is ready." }],
      structuredContent: {},
    }),
  );

  registerAppTool(
    server,
    "create_music_concept",
    {
      title: "Create original music concept",
      description: "Creates an original music concept from genre, mood, energy, and duration. It does not imitate a named living artist or clone a voice.",
      inputSchema: {
        title: z.string().max(80).optional(),
        prompt: z.string().min(3).max(1000),
        genre: z.enum(["Pop", "Electronic", "Hip-hop", "R&B", "Rock", "Ambient"]),
        mood: z.enum(["Euphoric", "Dreamy", "Dark", "Romantic", "Focused", "Nostalgic"]),
        energy: z.number().int().min(1).max(5),
        duration: z.number().int().min(15).max(180),
        mode: z.enum(["instrumental", "vocal"]),
      },
      outputSchema,
      _meta: { ui: { resourceUri: "ui://musewave/studio.html" } },
    },
    async (input) => {
      const project = buildConcept(input);
      return {
        content: [{
          type: "text",
          text: `Created “${project.title}”: ${project.genre}, ${project.mood}, ${project.bpm} BPM in ${project.key}.`,
        }],
        structuredContent: { project },
      };
    },
  );

  return server;
}

const httpServer = createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true, name: "musewave-gpt" }));
    return;
  }

  if (req.url === "/mcp") {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    res.on("close", () => transport.close());
    const server = createMuseWaveServer();
    await server.connect(transport);
    await transport.handleRequest(req, res);
    return;
  }

  res.writeHead(404, { "content-type": "application/json" });
  res.end(JSON.stringify({ error: "Not found" }));
});

httpServer.listen(PORT, () => {
  console.log(`MuseWave GPT listening on http://localhost:${PORT}/mcp`);
});
