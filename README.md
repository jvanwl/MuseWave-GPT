# MuseWave GPT

MuseWave is an original-music studio interface for ChatGPT. This first version focuses on product experience: users describe a track, choose genre, mood, energy, duration, and instrumental/vocal mode, then receive a structured music concept and a small browser-synth sketch.

The project does **not** clone voices or imitate named artists. A licensed music-generation provider can be added later behind the `create_music_concept` tool.

## What is included

- ChatGPT-compatible MCP server at `/mcp`
- Responsive embedded studio UI using the MCP Apps bridge
- `open_music_studio` and `create_music_concept` tools
- Deterministic BPM/key concept generation
- Local Web Audio preview with no API key
- Health endpoint and lightweight tests

## Run locally

Requirements: Node.js 20 or newer.

```bash
npm install
npm test
npm start
```

The MCP endpoint will be available at `http://localhost:8787/mcp`, with a health check at `http://localhost:8787/health`.

To use it from ChatGPT, expose the local server over HTTPS during development, then add the public `/mcp` URL as a custom plugin/connector in developer mode. Follow the current [OpenAI plugin quickstart](https://developers.openai.com/plugins/build/app-quickstart).

## Provider integration point

Replace or extend the handler for `create_music_concept` in `server.mjs`. Keep provider credentials on the server, never inside `public/music-studio.html`. A production flow will typically:

1. Validate and moderate the request.
2. Reject unauthorized voice cloning or direct artist impersonation.
3. Submit an asynchronous generation job to a licensed provider.
4. Return job status through a separate read-only tool.
5. Serve the completed audio from controlled storage.

## License

Private prototype. Add a license before public distribution.
