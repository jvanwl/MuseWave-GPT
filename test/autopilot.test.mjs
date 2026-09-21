import test from 'node:test';
import assert from 'node:assert/strict';
import { validateProposal, propose } from '../scripts/autopilot.mjs';
const files = { 'src/history-ui.js': 'const value = 1;', 'src/history-engine.mjs': 'const turns = 2;' };
const proposal = { summary: 'Improve value', edits: [{ path: 'src/history-ui.js', before: 'value = 1', after: 'value = 2' }] };
test('autopilot validates exact scoped replacements without modifying input', () => {
  assert.equal(validateProposal(proposal, files)['src/history-ui.js'], 'const value = 2;');
  assert.equal(files['src/history-ui.js'], 'const value = 1;');
  for (const path of ['../server.mjs', 'server.mjs', '.github/workflows/musewave-autopilot.yml', 'test/strategy.test.mjs']) assert.throws(() => validateProposal({ ...proposal, edits: [{ ...proposal.edits[0], path }] }, files));
  assert.throws(() => validateProposal({ ...proposal, edits: [{ ...proposal.edits[0], before: 'missing' }] }, files));
  assert.throws(() => validateProposal({ ...proposal, edits: [{ ...proposal.edits[0], after: 'x'.repeat(11000) }] }, files));
  assert.deepEqual(validateProposal({ summary: 'Nothing justified', edits: [] }, files), files);
});
test('autopilot fails closed without configuration or on truncated output', async () => {
  await assert.rejects(propose({ files }), /requires/);
  await assert.rejects(propose({ files, token: 'test', endpoint: 'http://example.test', model: 'test' }), /HTTPS/);
  const config = { files, token: 'test', endpoint: 'https://example.test/chat/completions', model: 'test' };
  await assert.rejects(propose({ ...config, fetchImpl: async () => ({ ok: false, status: 429 }) }), /HTTP 429/);
  await assert.rejects(propose({ ...config, fetchImpl: async () => ({ ok: true, text: async () => JSON.stringify({ choices: [{ finish_reason: 'length', message: { content: '{}' } }] }) }) }), /Incomplete/);
  const result = await propose({ ...config, fetchImpl: async (url, options) => {
    assert.equal(options.redirect, 'error');
    assert.equal(JSON.parse(options.body).max_tokens, 3500);
    return { ok: true, text: async () => JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(proposal) } }] }) };
  } });
  assert.deepEqual(result, proposal);
});
