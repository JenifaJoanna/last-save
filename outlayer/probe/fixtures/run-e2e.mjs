// Runs the built probe wasm under wasmtime against every fixture scenario and asserts the output.
// Usage: node run-e2e.mjs <path-to-lastsave-probe.wasm>
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import { startServer, CONTRACT, BUILD_HASH } from './server.mjs';

const wasm = process.argv[2];
if (!wasm) throw new Error('usage: node run-e2e.mjs <lastsave-probe.wasm>');

const { server, port, log } = await startServer(0);
const base = `http://127.0.0.1:${port}`;
const TO = 1_800_000_000_000;
const zero = { sig: 0, key: 0, licence: 0, window: 0, host: 0, replay: 0 };
const MIRA = 'lastsave-mira.testnet', KOFI = 'lastsave-kofi.testnet';

const mkInput = (scenario, extra = {}) => ({
  mode: 'official', contract: CONTRACT, endpoint: `${base}/${scenario}`, host_id: 'official',
  build_hash: BUILD_HASH, nonce: 'e2e' + scenario, from_ms: TO - 86_400_000, to_ms: TO, epoch: null,
  rpc_urls: [`${base}/${scenario}/rpc`], ...extra,
});
const res = (o) => ({ ok: true, mode: 'official', reachable: true, build_ok: true, verified: 0, rejected: 0, reasons: zero, sample: [], ...o });

const cases = [
  ['valid', mkInput('valid'), res({ verified: 2, sample: [MIRA, KOFI] })],
  ['valid-host', mkInput('valid', { mode: 'host', host_id: 'lastsave-fanhost.testnet', epoch: 3 }), res({ mode: 'host', verified: 2, sample: [MIRA, KOFI] })],
  ['stub', mkInput('stub'), res({})],
  ['forged', mkInput('forged'), res({ rejected: 2, reasons: { ...zero, sig: 2 } })],
  ['nonholder', mkInput('nonholder'), res({ rejected: 1, reasons: { ...zero, licence: 1 } })],
  ['nokey', mkInput('nokey'), res({ rejected: 1, reasons: { ...zero, key: 1 } })],
  ['replay', mkInput('replay'), res({ verified: 1, rejected: 1, reasons: { ...zero, replay: 1 }, sample: [MIRA] })],
  ['wrongbuild', mkInput('wrongbuild'), res({ build_ok: false })],
  ['flaky-rpc', mkInput('flaky'), res({ verified: 2, sample: [MIRA, KOFI] })],
  ['wrong-host', mkInput('wronghost'), res({ rejected: 2, reasons: { ...zero, host: 2 } })],
  ['unreachable', mkInput('valid', { endpoint: 'http://127.0.0.1:1' }), res({ reachable: false, build_ok: false })],
  ['stall', mkInput('stall'), res({ reachable: false, build_ok: false }), 25_000],
  ['malformed-input', { mode: 'official' }, (o) => { assert.equal(o.ok, false); assert.match(o.error, /^input: missing field `contract`/); assert.deepEqual(Object.keys(o).sort(), ['error', 'ok']); }],
];

// The fixture server shares this event loop, so wasmtime must run asynchronously.
function runWasm(input) {
  return new Promise((resolve) => {
    const child = spawn('wasmtime', ['run', '-S', 'http', wasm], { stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '', stderr = '';
    const timer = setTimeout(() => child.kill('SIGKILL'), 60_000);
    child.stdout.on('data', (c) => (stdout += c));
    child.stderr.on('data', (c) => (stderr += c));
    child.on('close', (status) => { clearTimeout(timer); resolve({ status, stdout, stderr }); });
    child.stdin.end(JSON.stringify(input));
  });
}

let failed = 0;
for (const [name, input, expected, maxMs = 20_000] of cases) {
  const t0 = Date.now();
  const r = await runWasm(input);
  const ms = Date.now() - t0;
  try {
    assert.equal(r.status, 0, `exit ${r.status}: ${r.stderr}`);
    assert.ok(!r.stdout.includes('\n'), 'stdout must be one line without newline');
    assert.ok(r.stdout.length < 900, `output ${r.stdout.length} bytes`);
    if (typeof expected === 'function') expected(JSON.parse(r.stdout));
    else assert.deepEqual(JSON.parse(r.stdout), expected);
    assert.ok(ms < maxMs, `took ${ms} ms`);
    console.log(`PASS ${name.padEnd(16)} ${String(ms).padStart(5)} ms  ${r.stdout}`);
  } catch (e) {
    failed++;
    console.log(`FAIL ${name.padEnd(16)} ${r.stdout || '(no stdout)'}\n     ${String(e.message).split('\n').join('\n     ')}\n     stderr: ${r.stderr.slice(0, 300)}`);
  }
}

// Sanity: flaky scenario really exercised 429 retries, and the stall scenario hung the client.
const flaky = log.filter((l) => l === '429').length;
if (flaky !== 2) { failed++; console.log(`FAIL flaky-rpc did not see 2 rate limits (saw ${flaky})`); }

server.closeAllConnections?.();
server.close();
console.log(`\n${cases.length - failed}/${cases.length} scenarios passed`);
process.exit(failed ? 1 : 0);
