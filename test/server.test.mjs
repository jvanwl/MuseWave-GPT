import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("widget contains the MCP Apps bridge and studio controls", () => {
  const html = readFileSync(new URL("../public/music-studio.html", import.meta.url), "utf8");
  assert.match(html, /ui\/initialize/);
  assert.match(html, /tools\/call/);
  assert.match(html, /create_music_concept/);
  assert.match(html, /FREE BETA/);
  assert.match(html, /start_plan_checkout/);
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

test("repository contains an owned engine and secure persistence schema", () => {
  const model = readFileSync(new URL("../engine/musewave_engine/model.py", import.meta.url), "utf8");
  const dataset = readFileSync(new URL("../engine/musewave_engine/dataset.py", import.meta.url), "utf8");
  const schema = readFileSync(new URL("../supabase/schema.sql", import.meta.url), "utf8");
  assert.match(model, /class MuseWaveGenerator/);
  assert.match(dataset, /performer_consent_id/);
  assert.match(schema, /enable row level security/);
  assert.match(schema, /storage\.buckets/);
});
