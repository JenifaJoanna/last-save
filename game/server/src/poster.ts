// Posts `post_snapshot(seq, hash, blob_base64)` to the licence contract with the studio's function-call key.
import { publicKeyOf } from "../../shared/auth";
import { Chain } from "./chain";
import { buildSignedTx } from "./nearTx";

export interface PostResult { ok: boolean; tx: string | null; error: string | null }

export class SnapshotPoster {
  private queue: Promise<unknown> = Promise.resolve();
  private nonce = 0n;
  constructor(private chain: Chain, private secret: string, private studio: string, private contract: string) {}

  /** The seq the contract already holds (0 if none or unreachable), so a fresh official DB never posts a stale seq. */
  async chainSeq(): Promise<number> {
    try {
      const s = await this.chain.view<{ seq: number } | null>(this.contract, "get_snapshot", {});
      return s ? Number(s.seq) : 0;
    } catch { return 0; }
  }

  post(seq: number, hash: string, blobBase64: string): Promise<PostResult> {
    const run = () => this.send(seq, hash, blobBase64);
    const p = this.queue.then(run, run);
    this.queue = p.catch(() => undefined);
    return p;
  }

  private async send(seq: number, hash: string, blobBase64: string): Promise<PostResult> {
    try {
      const pub = publicKeyOf(this.secret);
      const ak = await this.chain.rpc<{ nonce: number }>("query", { request_type: "view_access_key", finality: "optimistic", account_id: this.studio, public_key: pub });
      const block = await this.chain.rpc<{ header: { hash: string } }>("block", { finality: "final" });
      this.nonce = BigInt(ak.nonce) + 1n > this.nonce ? BigInt(ak.nonce) + 1n : this.nonce + 1n;
      const tx = buildSignedTx({ signerId: this.studio, signerSecret: this.secret, receiverId: this.contract, nonce: this.nonce,
        blockHash: block.header.hash, method: "post_snapshot", args: { seq, hash, blob_base64: blobBase64 },
        gas: 100_000_000_000_000n, deposit: 0n });
      const res = await this.chain.rpc<any>("send_tx", { signed_tx_base64: tx.base64, wait_until: "EXECUTED_OPTIMISTIC" });
      const statuses = [res?.status, ...(res?.receipts_outcome ?? []).map((r: any) => r?.outcome?.status)];
      const failed = statuses.find((s) => s && typeof s === "object" && "Failure" in s);
      if (failed) return { ok: false, tx: tx.hash, error: JSON.stringify(failed.Failure).slice(0, 300) };
      return { ok: true, tx: tx.hash, error: null };
    } catch (e) {
      return { ok: false, tx: null, error: String((e as Error)?.message ?? e).slice(0, 300) };
    }
  }
}
