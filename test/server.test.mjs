import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { once } from "node:events";
import { createHttpServer } from "../server.mjs";

test("widget is a focused owner-controlled NEXUS workspace", () => {
  const html = readFileSync(new URL("../public/sovereign-ai.html", import.meta.url), "utf8");
  assert.match(html, /NEXUS Sovereign/);
  assert.match(html, /\/api\/ai\/ask/);
  assert.match(html, /APPROVAL QUEUE/);
  assert.match(html, /Owner-controlled autonomy/);
  assert.doesNotMatch(html, /Chrona Dominion/);
});

test("server exposes the MCP endpoint and UI resource", () => {
  const server = readFileSync(new URL("../server.mjs", import.meta.url), "utf8");
  assert.match(server, /ui:\/\/nexus\/sovereign\.html/);
  assert.match(server, /req\.url === "\/mcp"/);
  assert.match(server, /registerAppTool/);
  assert.match(server, /open_nexus/);
  assert.match(server, /ask_nexus/);
  assert.match(server, /NEXUS_MODEL_URL/);
});

test("HTTP API validates JSON, limits payloads, and sets security headers", async (t) => {
  const server = createHttpServer().listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => server.close());
  const { port } = server.address();
  const base = `http://127.0.0.1:${port}`;
  const health = await fetch(`${base}/health`);
  assert.equal(health.status, 200);
  assert.equal(health.headers.get("x-content-type-options"), "nosniff");
  assert.equal(health.headers.get("permissions-policy"), "camera=(), microphone=(), geolocation=()");

  const status = await fetch(`${base}/api/ai/status`);
  assert.equal(status.status, 200);
  assert.equal((await status.json()).approvalRequired, true);

  const answer = await fetch(`${base}/api/ai/ask`, { method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify({prompt:"Create a small paid software product",mode:"revenue"}) });
  assert.equal(answer.status, 200);
  const result=await answer.json();assert.match(result.response,/Plan:/);assert.ok(result.proposal);

  const wrongType = await fetch(`${base}/api/concepts`, { method: "POST", body: "{}" });
  assert.equal(wrongType.status, 415);
  assert.match((await wrongType.json()).error, /Content-Type/);

  const malformed = await fetch(`${base}/api/concepts`, { method: "POST", headers: { "content-type": "application/json" }, body: "{" });
  assert.equal(malformed.status, 400);
  assert.match((await malformed.json()).error, /valid JSON/);

  const invalid = await fetch(`${base}/api/concepts`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ prompt: "ok" }) });
  assert.equal(invalid.status, 422);
  assert.equal((await invalid.json()).error, "Request fields are invalid");

  const oversized = await fetch(`${base}/api/concepts`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ prompt: "x".repeat(70_000) }) });
  assert.equal(oversized.status, 413);
});

test("repository contains an owned engine and secure persistence schema", () => {
  const model = readFileSync(new URL("../engine/musewave_engine/model.py", import.meta.url), "utf8");
  const dataset = readFileSync(new URL("../engine/musewave_engine/dataset.py", import.meta.url), "utf8");
  const schema = readFileSync(new URL("../supabase/schema.sql", import.meta.url), "utf8");
  assert.match(model, /class MuseWaveGenerator/);
  assert.match(dataset, /performer_consent_id/);
  assert.match(schema, /enable row level security/);
  assert.match(schema, /storage\.buckets/);
});
