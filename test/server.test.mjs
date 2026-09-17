import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("widget contains the MCP Apps bridge and studio controls", () => {
  const html = readFileSync(new URL("../public/music-studio.html", import.meta.url), "utf8");
  assert.match(html, /ui\/initialize/);
  assert.match(html, /tools\/call/);
  assert.match(html, /create_music_concept/);
  assert.match(html, /Original music studio/);
});

test("server exposes the MCP endpoint and UI resource", () => {
  const server = readFileSync(new URL("../server.mjs", import.meta.url), "utf8");
  assert.match(server, /ui:\/\/musewave\/studio\.html/);
  assert.match(server, /req\.url === "\/mcp"/);
  assert.match(server, /registerAppTool/);
});
