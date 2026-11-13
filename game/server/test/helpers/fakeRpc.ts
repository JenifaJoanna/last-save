// A tiny fake NEAR JSON-RPC server for tests: access keys, licences, get_info, snapshots, send_tx recording.
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import bs58 from "bs58";

export class FakeRpc {
  accessKeys = new Set<string>();
  licences = new Set<string>();
  info: Record<string, unknown> = { released_at_ms: null, pool: { epoch_ms: 120_000 } };
  snapshot: { seq: number; hash: string; blob_base64: string; at_ms: number } | null = null;
  calls: Record<string, number> = {};
  sentTxs: string[] = [];
  failNext = 0;
  private server: Server;
  url = "";

  constructor() {
    this.server = createServer((req, res) => {
      let body = "";
      req.on("data", (c) => (body += c));
      req.on("end", () => {
        if (this.failNext > 0) { this.failNext--; res.writeHead(503).end("busy"); return; }
        const { method, params, id } = JSON.parse(body);
        const out = this.handle(method, params);
        res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ jsonrpc: "2.0", id, ...out }));
      });
    });
  }

  allow(account: string, publicKey: string, opts: { licence?: boolean } = {}) {
    this.accessKeys.add(`${account}|${publicKey}`);
    if (opts.licence !== false) this.licences.add(account);
  }

  private handle(method: string, p: any): { result: unknown } | { error: unknown } {
    this.calls[method] = (this.calls[method] ?? 0) + 1;
    if (method === "block") return { result: { header: { hash: bs58.encode(new Uint8Array(32).fill(9)) } } };
    if (method === "send_tx") { this.sentTxs.push(p.signed_tx_base64); return { result: { status: { SuccessValue: "" }, receipts_outcome: [] } }; }
    if (method !== "query") return { error: { name: "HANDLER_ERROR", message: "unsupported" } };
    if (p.request_type === "view_access_key") {
      if (this.accessKeys.has(`${p.account_id}|${p.public_key}`)) return { result: { nonce: 41, permission: "FullAccess", block_height: 1, block_hash: "x" } };
      return { error: { name: "HANDLER_ERROR", cause: { name: "UNKNOWN_ACCESS_KEY", info: {} }, code: -32000, message: "Server error", data: "access key does not exist" } };
    }
    if (p.request_type === "call_function") {
      this.calls[p.method_name] = (this.calls[p.method_name] ?? 0) + 1;
      const args = JSON.parse(Buffer.from(p.args_base64, "base64").toString() || "{}");
      let value: unknown = null;
      if (p.method_name === "licence_of") value = this.licences.has(args.account_id) ? { token_id: "1", owner_id: args.account_id } : null;
      else if (p.method_name === "get_info") value = this.info;
      else if (p.method_name === "get_snapshot") value = this.snapshot;
      return { result: { result: [...Buffer.from(JSON.stringify(value))], logs: [] } };
    }
    return { error: { name: "HANDLER_ERROR", message: "unsupported" } };
  }

  async start(): Promise<this> {
    await new Promise<void>((r) => this.server.listen(0, "127.0.0.1", r));
    this.url = `http://127.0.0.1:${(this.server.address() as AddressInfo).port}`;
    return this;
  }
  stop() { return new Promise<void>((r) => this.server.close(() => r())); }
}
