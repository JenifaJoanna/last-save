// SQLite persistence for the Arena Durable Object: progression, logins, receipts, snapshots.
import type { Login, MatchResult, Profile, Receipt } from "../../shared/protocol";
import { levelFor, skinFor, xpForLevel } from "../../shared/sim";
import { sha256Hex, type PlayerRow, type Snapshot } from "./snapshot";

export interface PlayerRec extends PlayerRow { account: string }
const RETAIN_MS = 14 * 24 * 3600 * 1000;

export const profileOf = (p: { account: string; xp: number; matches: number }): Profile => {
  const level = levelFor(p.xp);
  return { account_id: p.account, level, xp: p.xp, next_level_xp: xpForLevel(level + 1), skin: skinFor(level), matches: p.matches };
};

export class Store {
  constructor(private sql: SqlStorage, private tx: <T>(fn: () => T) => T) {
    sql.exec(`CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT NOT NULL)`);
    sql.exec(`CREATE TABLE IF NOT EXISTS players (account TEXT PRIMARY KEY, xp INTEGER NOT NULL DEFAULT 0, matches INTEGER NOT NULL DEFAULT 0,
      kos INTEGER NOT NULL DEFAULT 0, shards INTEGER NOT NULL DEFAULT 0, updated_ms INTEGER NOT NULL)`);
    sql.exec(`CREATE TABLE IF NOT EXISTS logins (id INTEGER PRIMARY KEY AUTOINCREMENT, fp TEXT UNIQUE NOT NULL, account TEXT NOT NULL,
      session_pubkey TEXT NOT NULL, exp_ms INTEGER NOT NULL, login_json TEXT NOT NULL, first_ms INTEGER NOT NULL)`);
    sql.exec(`CREATE TABLE IF NOT EXISTS receipts (id INTEGER PRIMARY KEY AUTOINCREMENT, account TEXT NOT NULL, nonce TEXT NOT NULL,
      host TEXT NOT NULL, epoch INTEGER, ts_ms INTEGER NOT NULL, login_id INTEGER NOT NULL, receipt_json TEXT NOT NULL, UNIQUE(account, nonce))`);
    sql.exec(`CREATE INDEX IF NOT EXISTS receipts_ts ON receipts (ts_ms)`);
    sql.exec(`CREATE TABLE IF NOT EXISTS snapshots (seq INTEGER PRIMARY KEY, hash TEXT NOT NULL, json TEXT NOT NULL, at_ms INTEGER NOT NULL,
      status TEXT NOT NULL, tx TEXT, error TEXT)`);
    sql.exec(`CREATE TABLE IF NOT EXISTS walrus_blobs (seq INTEGER PRIMARY KEY, blob_id TEXT, error TEXT, at_ms INTEGER NOT NULL)`);
  }

  getMeta(k: string): string | null {
    const r = this.sql.exec(`SELECT v FROM meta WHERE k = ?`, k).toArray();
    return r.length ? String(r[0].v) : null;
  }
  setMeta(k: string, v: string): void { this.sql.exec(`INSERT INTO meta (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v`, k, v); }

  isEmpty(): boolean { return Number(this.sql.exec(`SELECT COUNT(*) AS n FROM players`).one().n) === 0 && this.getMeta("matches") === null; }

  getPlayer(account: string): PlayerRec | null {
    const r = this.sql.exec(`SELECT account, xp, matches, kos, shards FROM players WHERE account = ?`, account).toArray();
    if (!r.length) return null;
    const x = r[0];
    const xp = Number(x.xp);
    return { account, xp, matches: Number(x.matches), kos: Number(x.kos), shards: Number(x.shards), level: levelFor(xp), skin: skinFor(levelFor(xp)) };
  }
  profile(account: string): Profile { return profileOf(this.getPlayer(account) ?? { account, xp: 0, matches: 0 }); }

  /** Records a login the first time it is seen; returns its row id (same login re-presented reuses the row). */
  saveLogin(login: Login, sessionPubkey: string, expMs: number): number {
    const fp = sha256Hex(`${login.account_id}|${login.nonce}|${login.signature}`);
    const hit = this.sql.exec(`SELECT id FROM logins WHERE fp = ?`, fp).toArray();
    if (hit.length) return Number(hit[0].id);
    this.sql.exec(`INSERT INTO logins (fp, account, session_pubkey, exp_ms, login_json, first_ms) VALUES (?, ?, ?, ?, ?, ?)`,
      fp, login.account_id, sessionPubkey, expMs, JSON.stringify(login), Date.now());
    return Number(this.sql.exec(`SELECT id FROM logins WHERE fp = ?`, fp).one().id);
  }

  saveReceipt(r: Receipt, loginId: number): boolean {
    const dup = this.sql.exec(`SELECT 1 FROM receipts WHERE account = ? AND nonce = ?`, r.account_id, r.nonce).toArray();
    if (dup.length) return false;
    this.sql.exec(`INSERT INTO receipts (account, nonce, host, epoch, ts_ms, login_id, receipt_json) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      r.account_id, r.nonce, r.host, r.epoch, r.ts_ms, loginId, JSON.stringify(r));
    return true;
  }

  /** Sessions for /attest, newest first, at most 2 per account and 64 in total. Filters by receipt time [from,to]
   * and, when an epoch is given, also by receipt.epoch (SQLite only: this path makes no RPC calls). */
  sessions(f: { fromMs?: number; toMs?: number; epoch?: number }): { login: Login; receipt: Receipt }[] {
    const epochSql = f.epoch !== undefined ? "AND r.epoch = ?" : "";
    const binds: number[] = [f.fromMs ?? 0, f.toMs ?? Number.MAX_SAFE_INTEGER];
    if (f.epoch !== undefined) binds.push(f.epoch);
    const rows = this.sql.exec(`SELECT r.receipt_json AS rj, l.login_json AS lj, r.account AS account FROM receipts r JOIN logins l ON l.id = r.login_id
      WHERE r.ts_ms >= ? AND r.ts_ms <= ? ${epochSql} ORDER BY r.ts_ms DESC LIMIT 400`, ...binds).toArray();
    const perAccount = new Map<string, number>();
    const out: { login: Login; receipt: Receipt }[] = [];
    for (const r of rows) {
      const n = perAccount.get(String(r.account)) ?? 0;
      if (n >= 2) continue;
      perAccount.set(String(r.account), n + 1);
      out.push({ login: JSON.parse(String(r.lj)), receipt: JSON.parse(String(r.rj)) });
      if (out.length >= 64) break;
    }
    return out;
  }

  /** Applies a finished match: xp, level, skin and counters. Mutates and returns the results with level_after / unlocked filled in. */
  applyResults(results: MatchResult[]): MatchResult[] {
    return this.tx(() => {
      const now = Date.now();
      for (const r of results) {
        const before = this.getPlayer(r.account_id) ?? { account: r.account_id, xp: 0, matches: 0, kos: 0, shards: 0, level: 1, skin: "standard" as const };
        const xp = before.xp + r.xp_gained;
        this.sql.exec(`INSERT INTO players (account, xp, matches, kos, shards, updated_ms) VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT(account) DO UPDATE SET xp = excluded.xp, matches = excluded.matches, kos = excluded.kos, shards = excluded.shards, updated_ms = excluded.updated_ms`,
          r.account_id, xp, before.matches + 1, before.kos + r.kos, before.shards + r.shards, now);
        r.level_before = before.level;
        r.level_after = levelFor(xp);
        r.unlocked = skinFor(r.level_after) !== skinFor(r.level_before) ? skinFor(r.level_after) : null;
      }
      this.setMeta("matches", String(Number(this.getMeta("matches") ?? 0) + 1));
      return results;
    });
  }

  allPlayers(): Record<string, PlayerRow> {
    const out: Record<string, PlayerRow> = {};
    for (const r of this.sql.exec(`SELECT account, xp, matches, kos, shards FROM players`).toArray()) {
      const xp = Number(r.xp), level = levelFor(xp);
      out[String(r.account)] = { kos: Number(r.kos), level, matches: Number(r.matches), shards: Number(r.shards), skin: skinFor(level), xp };
    }
    return out;
  }

  nextSnapshotSeq(): number {
    const meta = Number(this.getMeta("snapshot_seq") ?? 0);
    const row = this.sql.exec(`SELECT MAX(seq) AS m FROM snapshots`).one().m;
    return Math.max(meta, row === null ? 0 : Number(row)) + 1;
  }
  saveSnapshot(seq: number, hash: string, json: string, atMs: number, status: string): void {
    this.sql.exec(`INSERT OR REPLACE INTO snapshots (seq, hash, json, at_ms, status) VALUES (?, ?, ?, ?, ?)`, seq, hash, json, atMs, status);
    this.setMeta("snapshot_seq", String(seq));
  }
  markSnapshot(seq: number, status: string, tx: string | null, error: string | null): void {
    this.sql.exec(`UPDATE snapshots SET status = ?, tx = ?, error = ? WHERE seq = ?`, status, tx, error, seq);
  }

  saveWalrus(seq: number, blobId: string | null, error: string | null): void {
    this.sql.exec(`INSERT OR REPLACE INTO walrus_blobs (seq, blob_id, error, at_ms) VALUES (?, ?, ?, ?)`, seq, blobId, error, Date.now());
  }
  /** Latest snapshots mirrored to Walrus, newest first. */
  latestWalrus(limit = 5): { seq: number; blob_id: string }[] {
    return this.sql.exec(`SELECT seq, blob_id FROM walrus_blobs WHERE blob_id IS NOT NULL ORDER BY seq DESC LIMIT ?`, limit)
      .toArray().map((r) => ({ seq: Number(r.seq), blob_id: String(r.blob_id) }));
  }

  /** Imports a verified snapshot into an empty database; later snapshots continue from its seq. */
  importSnapshot(s: Snapshot, hash: string): void {
    this.tx(() => {
      for (const [account, p] of Object.entries(s.players)) {
        this.sql.exec(`INSERT OR REPLACE INTO players (account, xp, matches, kos, shards, updated_ms) VALUES (?, ?, ?, ?, ?, ?)`,
          account, p.xp, p.matches, p.kos, p.shards, Date.now());
      }
      this.setMeta("snapshot_seq", String(s.seq));
      this.setMeta("restored_hash", hash);
      if (this.getMeta("matches") === null) this.setMeta("matches", "0");
    });
  }

  purge(nowMs: number): void {
    this.sql.exec(`DELETE FROM receipts WHERE ts_ms < ?`, nowMs - RETAIN_MS);
    this.sql.exec(`DELETE FROM logins WHERE exp_ms < ? AND id NOT IN (SELECT login_id FROM receipts)`, nowMs - RETAIN_MS);
  }
}
