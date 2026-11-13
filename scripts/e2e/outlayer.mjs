// OutLayer-backed contract calls (probe_official, release, claim_epoch) must be retried until they land:
// runs take 30-70 s and OutLayer has windows where runs time out, which the contract records as "inconclusive".
import { call, view } from "../lib/near.mjs";
import { failText, log, sleep } from "./util.mjs";

export const getInfo = (ctx) => view(ctx.contract, "get_info", {});

/**
 * Calls `method` until `verdict(before, after, result)` returns "conclusive". Every attempt is recorded in the report.
 * Returns { conclusive, attempts, last: {before, after, result}, terminal }.
 * `terminal` is a refusal that retrying cannot fix (matches opts.terminal), e.g. the game is already dead.
 */
export async function untilLanded(ctx, opts) {
  const { label, signer, method, args = {}, deposit = "0.02", gas = 300, verdict, terminal, maxAttempts = 10, pauseMs = 8000, gate } = opts;
  const attempts = [];
  let last = null;
  for (let i = 1; i <= maxAttempts; i++) {
    if (gate) await gate(i);
    const before = await getInfo(ctx);
    let result;
    try {
      result = await call(signer, ctx.contract, method, args, { gas, deposit });
    } catch (e) {
      attempts.push({ n: i, outcome: "transport error", detail: String(e.message).slice(0, 160) });
      log(`  ${label} attempt ${i}: transport error (${String(e.message).slice(0, 100)}), retrying`);
      await sleep(pauseMs);
      continue;
    }
    ctx.report.tx(`${label} #${i}`, result);
    const after = await getInfo(ctx);
    last = { before, after, result };
    if (result.failure) {
      const text = failText(result);
      if (terminal?.test(text)) {
        attempts.push({ n: i, outcome: "refused", hash: result.hash, detail: text.slice(0, 160) });
        return { conclusive: false, attempts, last, terminal: true };
      }
      attempts.push({ n: i, outcome: /already running/i.test(text) ? "in flight" : "failed", hash: result.hash, detail: text.slice(0, 160) });
      log(`  ${label} attempt ${i}: ${/already running/i.test(text) ? "another run in flight, waiting" : "call failed"}`);
      await sleep(/already running/i.test(text) ? 20000 : pauseMs);
      continue;
    }
    const v = await verdict(before, after, result);
    attempts.push({ n: i, outcome: v.conclusive ? "conclusive" : "inconclusive", hash: result.hash, detail: v.detail });
    log(`  ${label} attempt ${i}: ${v.conclusive ? "conclusive" : "inconclusive"} - ${v.detail}`);
    if (v.conclusive) return { conclusive: true, attempts, last, verdict: v };
    await sleep(pauseMs);
  }
  return { conclusive: false, attempts, last, terminal: false };
}

/** Verdict for probe_official: a conclusive probe moves last_probe_ms and leaves no last_error. */
export const probeVerdict = (before, after) => {
  const moved = after.probe.last_probe_ms !== before.probe.last_probe_ms;
  if (moved && !after.probe.last_error) {
    return { conclusive: true, detail: `failures ${after.probe.consecutive_failures}, status ${after.status}` };
  }
  return { conclusive: false, detail: after.probe.last_error ?? "no state change (probe still running or refused)" };
};
