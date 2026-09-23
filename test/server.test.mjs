import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { once } from "node:events";
import { createHttpServer } from "../server.mjs";

test("widget contains the MCP Apps bridge and Chrona Dominion game", () => {
  const html = readFileSync(new URL("../public/music-studio.html", import.meta.url), "utf8");
  assert.match(html, /ui\/initialize/);
  assert.match(html, /tools\/call/);
  assert.match(html, /create_music_concept/);
  assert.match(html, /Monetization-ready beta/);
  assert.match(html, /start_plan_checkout/);
  assert.match(html, /Chrona Dominion/);
  assert.match(html, /HISTORY_CATALOG/);
  assert.match(html, /createHistoryEngine/);
  assert.match(html, /Negotiate armistice/);
});

test("server exposes the MCP endpoint and UI resource", () => {
  const server = readFileSync(new URL("../server.mjs", import.meta.url), "utf8");
  assert.match(server, /ui:\/\/musewave\/studio\.html/);
  assert.match(server, /req\.url === "\/mcp"/);
  assert.match(server, /registerAppTool/);
  assert.match(server, /get_musewave_account/);
  assert.match(server, /list_music_projects/);
  assert.match(server, /rate_music_project/);
  assert.match(server, /set_personalization_consent/);
  assert.match(server, /MUSEWAVE_ENGINE_URL/);
  assert.match(server, /\/api\/engine\/generate/);
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
