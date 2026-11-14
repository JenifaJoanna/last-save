// NEP-413 login binding and replay refusal: recipient (licence contract), host, 32-byte nonce, expiry, single use.
import { describe, expect, it } from "vitest";
import { buildLoginMessage, signHello, signLogin } from "../../../shared/auth";
import { Chain } from "../../src/chain";
import { MemoryNonceBook, verifyJoin, type NonceBook } from "../../src/login";
import { Store } from "../../src/store";
import { FakeRpc } from "../helpers/fakeRpc";
import { makeHello, newPilot } from "../helpers/keys";
import { memorySql } from "../helpers/sqlAdapter";

const CONTRACT = "lastsave-licence.testnet";
const mira = newPilot("lastsave-mira.testnet");
const kofi = newPilot("lastsave-kofi.testnet");
const books: [string, () => NonceBook][] = [
  ["memory", () => new MemoryNonceBook()],
  ["sqlite store", () => { const m = memorySql(); return new Store(m.sql, m.tx); }],
];

async function setup(nonces: NonceBook) {
  const rpc = await new FakeRpc().start();
  rpc.allow(mira.account, mira.public);
  rpc.allow(kofi.account, kofi.public);
  const chain = new Chain({ urls: [rpc.url], cacheMs: 60_000, backoffMs: 1 });
  const join = (h: { login: ReturnType<typeof makeHello>["login"]; proof: ReturnType<typeof makeHello>["proof"] }, nowMs = Date.now()) =>
    verifyJoin({ login: h.login, proof: h.proof, hostId: "official", licenceContract: CONTRACT, chain, nonces, nowMs });
  return { rpc, join };
}

describe.each(books)("NEP-413 login replay refusal (%s)", (_name, book) => {
  it("binds the nonce: a login whose nonce was swapped no longer verifies", async () => {
    const { rpc, join } = await setup(book());
    const h = makeHello(mira);
    const other = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64");
    expect(await join({ ...h, login: { ...h.login, nonce: other } })).toMatchObject({ ok: false, code: "bad_signature" });
    expect(await join({ ...h, login: { ...h.login, nonce: Buffer.alloc(16).toString("base64") } })).toMatchObject({ ok: false, code: "bad_signature" });
    await rpc.stop();
  });

  it("binds the recipient: the same signature presented for another contract fails", async () => {
    const { rpc, join } = await setup(book());
    const h = makeHello(mira);
    expect(await join({ ...h, login: { ...h.login, recipient: "other.testnet" } })).toMatchObject({ ok: false, code: "bad_signature" });
    await rpc.stop();
  });

  it("refuses a used nonce under a different login", async () => {
    const { rpc, join } = await setup(book());
    const nonce = crypto.getRandomValues(new Uint8Array(32));
    const first = makeHello(mira);
    const a = { ...first, login: signLogin({ accountId: mira.account, secretKey: mira.secret, message: first.login.message, recipient: CONTRACT, nonce }) };
    expect(await join(a)).toMatchObject({ ok: true });
    const second = makeHello(kofi);
    const b = { ...second, login: signLogin({ accountId: kofi.account, secretKey: kofi.secret, message: second.login.message, recipient: CONTRACT, nonce }) };
    expect(await join(b)).toMatchObject({ ok: false, code: "replay" });
    await rpc.stop();
  });

  it("refuses a replayed hello proof; a reconnect with a newer proof is fine", async () => {
    const { rpc, join } = await setup(book());
    const h = makeHello(mira);
    expect(await join(h)).toMatchObject({ ok: true });
    expect(await join(h)).toMatchObject({ ok: false, code: "replay" });
    const older = { ...h, proof: signHello({ host: "official", accountId: mira.account, sessionSecret: h.session.secret, tsMs: h.proof.ts_ms - 1 }) };
    expect(await join(older)).toMatchObject({ ok: false, code: "replay" });
    const newer = { ...h, proof: signHello({ host: "official", accountId: mira.account, sessionSecret: h.session.secret, tsMs: h.proof.ts_ms + 5 }) };
    expect(await join(newer)).toMatchObject({ ok: true });
    await rpc.stop();
  });

  it("refuses an expired message even if its nonce was never seen", async () => {
    const { rpc, join } = await setup(book());
    const h = makeHello(mira, { expMs: Date.now() + 60_000 });
    expect(await join(h, Date.now() + 61_000)).toMatchObject({ ok: false, code: "expired" });
    await rpc.stop();
  });

  it("refuses a bad signature without burning the nonce", async () => {
    const { rpc, join } = await setup(book());
    const h = makeHello(mira);
    const message = buildLoginMessage({ host: "official", sessionPubkey: h.session.public, expMs: Date.now() + 1000 });
    expect(await join({ ...h, login: { ...h.login, message } })).toMatchObject({ ok: false, code: "bad_signature" });
    expect(await join(h)).toMatchObject({ ok: true });
    await rpc.stop();
  });
});
