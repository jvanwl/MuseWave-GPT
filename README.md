# MuseWave GPT — monetization-ready beta

MuseWave is an original-music studio for ChatGPT. Version 0.2 includes a redesigned creation workspace, project library, lyrics and advanced controls, usage metering, plans, credits, commercial-license entitlements, and a checkout boundary. It remains free by default while demand is validated.

The project does **not** clone voices or imitate named artists. A licensed music-generation provider can be added later behind the generation tool.

## Included

- ChatGPT-compatible MCP server at `/mcp`
- Responsive embedded UI using the MCP Apps bridge
- Creation, project-library, account, pricing, and checkout tools
- Genre, mood, energy, duration, lyrics, language, seed, and quality controls
- Deterministic browser-synth preview with no API key
- Free, Creator, Pro, and Studio plan catalog
- Credit-cost calculation and usage ledger
- Free-beta feature flag with checkout disabled by default
- External hosted-checkout adapter for later billing activation
- Safety acknowledgement and original-music positioning
- Health endpoint and automated tests

## Run locally

Requirements: Node.js 20 or newer.

```bash
npm install
cp .env.example .env
npm test
npm run dev
```

The MCP endpoint is `http://localhost:8787/mcp`; the health endpoint is `http://localhost:8787/health`.

To use it from ChatGPT, expose the local server over HTTPS during development and add the public `/mcp` URL as a custom plugin in developer mode. Follow the current [OpenAI plugin quickstart](https://developers.openai.com/plugins/build/app-quickstart).

## Music-provider integration

Replace or extend the `create_music_concept` handler in `server.mjs`. Provider credentials must remain on the server, never inside the HTML component. A production workflow should validate and moderate the request, submit an asynchronous generation job, expose status through a read-only tool, and serve completed audio from controlled storage.

## Turn on monetization later

The product ships with `FREE_BETA=true`, so generations record simulated usage but never deduct credits or collect payment.

Before changing it to `false`:

1. Add OAuth so usage and projects belong to an authenticated user.
2. Replace the in-memory store with a transactional database.
3. Create hosted checkout pages for `creator`, `pro`, and `studio`.
4. Configure `BILLING_CHECKOUT_BASE_URL`.
5. Verify signed billing webhooks and update entitlements idempotently.
6. Add refund, cancellation, tax, privacy, and terms flows.
7. Connect a licensed music provider and confirm commercial-output rights.

The plans and prices in this prototype are product assumptions, not finalized offers. OpenAI currently recommends that plugin developers choose their own external monetization approach; the checkout boundary in this repository follows that model.

## License

Private prototype. Add a license before public distribution.
