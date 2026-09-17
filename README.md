# MuseWave GPT — monetization-ready beta

MuseWave is an original-music studio for ChatGPT. The repository now includes the first MuseWave-owned trainable audio engine, a consent-based learning system, project library, advanced controls, usage metering, plans, credits, entitlements, and checkout boundary.

The project does **not** clone voices or imitate named artists. Neural audio generation remains unavailable until MuseWave trains and mounts its own checkpoint from licensed music and consented vocal recordings.

## Included

- ChatGPT-compatible MCP server at `/mcp`
- Responsive embedded UI using the MCP Apps bridge
- Creation, project-library, account, pricing, and checkout tools
- Genre, mood, energy, duration, lyrics, language, seed, and quality controls
- Deterministic browser preview retained only as an explicitly labeled fallback
- MuseWave Engine Python/PyTorch service with prompt, lyrics, language, style, and seed conditioning
- Licensed-dataset validator that rejects vocal data without a performer consent ID
- GPU training script, checkpoint gate, WAV inference endpoint, and container image
- Supabase schema for private projects, generation jobs, audio storage, and performer consent
- Free, Creator, Pro, and Studio plan catalog
- Credit-cost calculation and usage ledger
- Free-beta feature flag with checkout disabled by default
- External hosted-checkout adapter for later billing activation
- Safety acknowledgement and original-music positioning
- Explicit opt-in and per-user feedback collection
- Preference profiling and neural-network-ready feature extraction
- Optional 32→16-neuron PyTorch ranking model with controlled offline training
- Model-readiness, version, confidence, and feedback status UI
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

## MuseWave Engine

See [`engine/README.md`](engine/README.md). The API returns `ready: false` until a trained checkpoint is mounted, preventing an untrained model or browser oscillator from being represented as generated singing. Deploy it on a CUDA GPU and set `MUSEWAVE_ENGINE_URL` only after evaluation.

The Supabase schema is staged in [`supabase/schema.sql`](supabase/schema.sql). It was not applied automatically because the connected Supabase account currently exposes no projects. Create or connect the intended project first, then review and apply the schema and run the Supabase security/performance advisors.

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

## Learning architecture

MuseWave does not claim consciousness or unrestricted self-improvement. It learns from explicit 1–5 ratings only after a user opts in. The application creates a fixed music-feature vector; the optional PyTorch service trains a small ranking network that predicts personal preference. Training is offline, artifacts are versioned, and promotion requires evaluation and owner approval.

This boundary prevents uncontrolled web ingestion, self-modifying code, cross-user data mixing, and automatic deployment. Before production, add authenticated per-user storage, deletion/export controls, encryption, holdout evaluation, drift monitoring, a model registry, and rollback.

## License

Private prototype. Add a license before public distribution.
