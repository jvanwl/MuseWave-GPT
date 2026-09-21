# MuseWave Autopilot

An unattended maintenance pipeline, not a self-training model. It reviews the
current game each day, selects one small improvement, generates exact code edits,
runs the existing tests and opens a pull request for passing changes.

## Activation

In GitHub repository Settings → Secrets and variables → Actions, configure:

- Secret `AI_API_KEY`: a provider key. Never put it in source code or chat.
- Variable `AI_API_URL`: the provider's complete HTTPS chat-completions endpoint.
- Variable `AI_MODEL`: a model supporting JSON mode and `max_tokens`.
- Variable `AUTOPILOT_ENABLED`: `true` to enable, `false` to pause.

Allow GitHub Actions to create pull requests in Settings → Actions → General.
Then use Actions → MuseWave Autopilot → Run workflow for the first real run.
Without this configuration generation is disabled; a skipped workflow is not a
successful AI run. The code alone does not activate a model or supply credentials.

Schedule: daily at 13:23 UTC, subject to GitHub scheduling delays and its scheduled
workflow inactivity rules. There is at most one provider call per eligible run,
3500 output tokens and a 90-second provider timeout. An existing open autopilot
pull request pauses new generation. There is no retry loop. API use and Actions
may incur charges; set provider budget limits before activation.

## Scope and verification

Only `src/history-ui.js` and `src/history-engine.mjs` accept model edits, with at
most four exact replacements and 10000 total replacement characters. The widget
is rebuilt by the unchanged build script. Tests, workflows, this agent, payment
code, historical catalogs, credentials and dependencies are outside edit scope.

Generated code is tested in a read-only Docker container without network access,
credentials, repository metadata or a writable source mount. The host only runs
the trusted patch validator and existing text-bundling script. The AI never
chooses shell commands. Test failures prevent publication. Failed runs remain
visible in Actions; no deployment has occurred in that case.

The model sees only the two editable source files, not user data or secrets.
Proposals are untrusted. Tests are a regression check, not a proof of safety.
Review the diff before merging: generated client code could still be harmful.
There is no visual preview, autonomous merging or deployment in this version.
Deployment of an approved merge continues through the existing release process.
The schedule operates outside ChatGPT; it does not depend on an open chat session.

Local checks: `node --test test/autopilot.test.mjs` and `npm test`.
The mocked provider tests do not demonstrate a real model connection.
