import { describe, expect, it } from "vitest";
import { levelFor, skinFor, xpForLevel } from "../../../shared/sim";
import type { MatchResult } from "../../../shared/protocol";
import { Store } from "../../src/store";
import { memorySql } from "../helpers/sqlAdapter";

const result = (account: string, xp: number, extra: Partial<MatchResult> = {}): MatchResult =>
  ({ account_id: account, place: 1, shards: 10, kos: 2, score: 14, xp_gained: xp, level_before: 1, level_after: 1, unlocked: null, ...extra });
const newStore = () => { const m = memorySql(); return new Store(m.sql, m.tx); };

describe("progression math", () => {
  it("level and skin follow the sim curve", () => {
    expect([0, 99, 100, 399, 400, 900].map(levelFor)).toEqual([1, 1, 2, 2, 3, 4]);
    expect(xpForLevel(3)).toBe(400);
    expect(skinFor(2)).toBe("standard");
    expect(skinFor(3)).toBe("emberwing");
  });

  it("a new pilot starts at level 1 with the standard skin", () => {
    const p = newStore().profile("lastsave-dario.testnet");
    expect(p).toEqual({ account_id: "lastsave-dario.testnet", level: 1, xp: 0, next_level_xp: 100, skin: "standard", matches: 0 });
  });

  it("applies a match and accumulates across matches", () => {
    const s = newStore();
    const [r1] = s.applyResults([result("lastsave-mira.testnet", 250)]);
    expect(r1).toMatchObject({ level_before: 1, level_after: 2, unlocked: null });
    const [r2] = s.applyResults([result("lastsave-mira.testnet", 200)]);
    expect(r2).toMatchObject({ level_before: 2, level_after: 3, unlocked: "emberwing" });
    const p = s.getPlayer("lastsave-mira.testnet")!;
    expect(p).toMatchObject({ xp: 450, matches: 2, kos: 4, shards: 20, level: 3, skin: "emberwing" });
    expect(s.profile("lastsave-mira.testnet")).toMatchObject({ level: 3, next_level_xp: 900, matches: 2 });
  });

  it("does not unlock again once the skin is held", () => {
    const s = newStore();
    s.applyResults([result("lastsave-kofi.testnet", 500)]);
    const [r] = s.applyResults([result("lastsave-kofi.testnet", 800)]);
    expect(r).toMatchObject({ level_before: 3, level_after: 4, unlocked: null });
  });

  it("restores a snapshot into an empty store and continues the seq", () => {
    const s = newStore();
    expect(s.isEmpty()).toBe(true);
    s.importSnapshot({ at_ms: 1, game: "ember-rift", seq: 9, players: { "lastsave-yuna.testnet": { kos: 1, level: 2, matches: 3, shards: 4, skin: "standard", xp: 120 } } }, "ab".repeat(32));
    expect(s.isEmpty()).toBe(false);
    expect(s.profile("lastsave-yuna.testnet")).toMatchObject({ level: 2, xp: 120, matches: 3 });
    expect(s.nextSnapshotSeq()).toBe(10);
  });
});

describe("sessions for /attest", () => {
  const login = (a: string, n: string) => ({ account_id: a, public_key: "ed25519:x", signature: "s" + n, message: "m", nonce: n, recipient: "r" });
  const receipt = (a: string, n: string, ts: number, epoch: number | null = null) => ({ host: "official", epoch, nonce: n.padStart(32, "0"), ts_ms: ts, account_id: a, signature: "sig" });

  it("returns newest first, at most 2 per account, filtered by window or epoch", () => {
    const s = newStore();
    const l = s.saveLogin(login("a.testnet", "1"), "ed25519:p", 9e12);
    const l2 = s.saveLogin(login("b.testnet", "2"), "ed25519:p", 9e12);
    expect(s.saveLogin(login("a.testnet", "1"), "ed25519:p", 9e12)).toBe(l);
    for (const [i, ts] of [100, 200, 300].entries()) s.saveReceipt(receipt("a.testnet", String(i), ts, 1), l);
    s.saveReceipt(receipt("b.testnet", "9", 150, 2), l2);
    expect(s.saveReceipt(receipt("b.testnet", "9", 150, 2), l2)).toBe(false);
    expect(s.sessions({ fromMs: 0, toMs: 1000 }).map((x) => x.receipt.ts_ms)).toEqual([300, 200, 150]);
    expect(s.sessions({ fromMs: 120, toMs: 250 }).map((x) => x.receipt.ts_ms)).toEqual([200, 150]);
    expect(s.sessions({ epoch: 2 })).toHaveLength(1);
    expect(s.sessions({ epoch: 1, fromMs: 150, toMs: 250 }).map((x) => x.receipt.ts_ms)).toEqual([200]);
    expect(s.sessions({ epoch: 2, fromMs: 160 })).toHaveLength(0);
    expect(s.sessions({ epoch: 1 })[0].login.account_id).toBe("a.testnet");
  });
});
