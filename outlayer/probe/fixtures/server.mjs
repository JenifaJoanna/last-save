// Fixture for the probe's end-to-end run: one HTTP server playing both a game
// server (/<scenario>/attest) and the NEAR JSON-RPC (/<scenario>/rpc).
// Real NEP-413 logins and session receipts are signed with fixed PUBLIC test seeds
// (never real account keys). Run standalone: node server.mjs [port]
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { ed25519 } from '@noble/curves/ed25519';
import { sha256 } from '@noble/hashes/sha256';
import bs58 from 'bs58';

export const CONTRACT = 'lastsave-licence.testnet';
export const BUILD_HASH = '5f1d0c4b8a7e9d3c2b1a0f9e8d7c6b5a4f3e2d1c0b9a8f7e6d5c4b3a29181716';
export const SCENARIOS = ['valid', 'stub', 'forged', 'nonholder', 'nokey', 'replay', 'wrongbuild', 'wronghost', 'flaky', 'stall'];

const seed = (fill) => new Uint8Array(32).fill(fill);
const pkStr = (s) => 'ed25519:' + bs58.encode(ed25519.getPublicKey(s));
const b64 = (u8) => Buffer.from(u8).toString('base64');

// Public test players: account key seed 0x40+n, session key seed 0x60+n.
const PLAYERS = {};
['mira', 'kofi', 'yuna', 'dario'].forEach((name, i) => {
  PLAYERS[name] = { account: `lastsave-${name}.testnet`, acct: seed(0x41 + i), sess: seed(0x61 + i), n: i + 1 };
});

const u32le = (n) => { const b = Buffer.alloc(4); b.writeUInt32LE(n); return b; };
const borshStr = (s) => { const b = Buffer.from(s, 'utf8'); return Buffer.concat([u32le(b.length), b]); };

// sha256( borsh(u32 2147484061) || borsh({message, nonce:[u8;32], recipient, callback_url:None}) )
function payloadHash(message, nonce, recipient) {
  return sha256(Buffer.concat([u32le(2147484061), borshStr(message), Buffer.from(nonce), borshStr(recipient), Buffer.from([0])]));
}

function entry(player, { host, ts, exp, epoch = null, nonceHex, forge = null }) {
  const message = JSON.stringify({ app: 'ember-rift', host, session_pubkey: pkStr(player.sess), exp_ms: exp });
  const nonce = new Uint8Array(32).fill(7);
  const loginSig = ed25519.sign(payloadHash(message, nonce, CONTRACT), player.acct);
  if (forge === 'login') loginSig[0] ^= 0xff;
  const receiptMsg = `lastsave-receipt:v1|${host}|${epoch ?? '-'}|${nonceHex}|${ts}|${player.account}`;
  const receiptSig = ed25519.sign(Buffer.from(receiptMsg, 'utf8'), player.sess);
  if (forge === 'receipt') receiptSig[0] ^= 0xff;
  return {
    login: { account_id: player.account, public_key: pkStr(player.acct), signature: b64(loginSig), message, nonce: b64(nonce), recipient: CONTRACT },
    receipt: { host, epoch, nonce: nonceHex, ts_ms: ts, account_id: player.account, signature: b64(receiptSig) },
  };
}

// What each scenario serves and what its chain says.
function scenarioData(name, q) {
  // 'wronghost' signs for a different host than the one the probe asks about.
  const host = name === 'wronghost' ? 'lastsave-other.testnet' : q.get('host');
  const to = Number(q.get('to'));
  const ep = q.get('epoch') === null ? null : Number(q.get('epoch'));
  const mk = (p, extra = {}) => entry(PLAYERS[p], { host, ts: to - 1000, exp: to + 3_600_000, epoch: ep, nonceHex: String(p.length).padStart(2, '0').repeat(16), ...extra });
  const all = ['mira', 'kofi'];
  const world = { keys: new Set(), licensed: new Set() };
  const hold = (...names) => names.forEach((n) => { world.keys.add(PLAYERS[n].account + '|' + pkStr(PLAYERS[n].acct)); world.licensed.add(PLAYERS[n].account); });
  let sessions = [];
  let build = BUILD_HASH;
  switch (name) {
    case 'valid': case 'flaky': case 'stall': case 'wronghost':
      sessions = all.map((p, i) => mk(p, { nonceHex: String(i + 1).repeat(32) })); hold(...all); break;
    case 'stub': break;
    case 'forged':
      sessions = [mk('mira', { forge: 'login', nonceHex: '1'.repeat(32) }), mk('kofi', { forge: 'receipt', nonceHex: '2'.repeat(32) })]; hold(...all); break;
    case 'nonholder': sessions = [mk('yuna')]; world.keys.add(PLAYERS.yuna.account + '|' + pkStr(PLAYERS.yuna.acct)); break;
    case 'nokey': sessions = [mk('dario')]; world.licensed.add(PLAYERS.dario.account); break;
    case 'replay': { const e = mk('mira'); sessions = [e, e]; hold('mira'); break; }
    case 'wrongbuild': sessions = [mk('mira')]; hold('mira'); build = '0'.repeat(64); break;
    default: return null;
  }
  return { sessions, build, world };
}

function rpcAnswer(world, body) {
  const p = body.params;
  if (p.request_type === 'view_access_key') {
    if (world.keys.has(`${p.account_id}|${p.public_key}`)) return { result: { nonce: 1, permission: 'FullAccess', block_height: 1, block_hash: 'fixture' } };
    return { result: { error: `access key ${p.public_key} does not exist while viewing`, logs: [], block_height: 1, block_hash: 'fixture' } };
  }
  if (p.request_type === 'call_function' && p.method_name === 'licence_of' && p.account_id === CONTRACT) {
    const { account_id } = JSON.parse(Buffer.from(p.args_base64, 'base64').toString());
    const out = world.licensed.has(account_id)
      ? { token_id: '1', owner_id: account_id, pot_share: '100', choice: null, minted_at_ms: 1, post_death: false }
      : null;
    return { result: { result: [...Buffer.from(JSON.stringify(out))], logs: [], block_height: 1, block_hash: 'fixture' } };
  }
  return { error: { name: 'HANDLER_ERROR', cause: { name: 'UNKNOWN', info: {} } } };
}

export function startServer(port = 0) {
  const flakyLeft = { n: 2 };
  const log = [];
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://fixture');
    const [, name, route] = url.pathname.split('/');
    const data = SCENARIOS.includes(name) ? scenarioData(name, url.searchParams) : null;
    const send = (status, obj) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(obj)); };
    if (name === 'stall' && route === 'attest') { log.push('stall'); return; } // accept, never answer
    if (route === 'attest' && req.method === 'GET') {
      log.push(`attest ${name} ${url.search}`);
      if (!data) return send(404, { error: 'no such scenario' });
      return send(200, { host_id: url.searchParams.get('host'), build_hash: data.build, nonce: url.searchParams.get('nonce'), now_ms: Number(url.searchParams.get('to')), sessions: data.sessions });
    }
    if (route === 'rpc' && req.method === 'POST') {
      let raw = '';
      req.on('data', (c) => (raw += c));
      req.on('end', () => {
        const q = new URLSearchParams({ host: 'x', to: '0' });
        const world = scenarioData(name === 'stall' ? 'valid' : name, q)?.world ?? { keys: new Set(), licensed: new Set() };
        const body = JSON.parse(raw);
        if (body.params?.finality !== 'final') return send(400, { error: 'finality must be final' });
        if (name === 'flaky' && flakyLeft.n > 0) { flakyLeft.n--; log.push('429'); return send(429, { error: 'rate limited' }); }
        log.push(`rpc ${name} ${body.params.request_type}`);
        send(200, { jsonrpc: '2.0', id: body.id, ...rpcAnswer(world, body) });
      });
      return;
    }
    send(404, { error: 'not found' });
  });
  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve({ server, port: server.address().port, log })));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { port } = await startServer(Number(process.argv[2] || 0));
  process.stderr.write(`fixture listening on http://127.0.0.1:${port}\n`);
}
