// Terminal table for `pnpm verify`. Plain text; colour only on a TTY and never with NO_COLOR.
import { rebuildCommand } from "./rebuild.mjs";

const color = process.stdout.isTTY && !process.env.NO_COLOR;
const paint = (code, s) => (color ? `\u001b[${code}m${s}\u001b[0m` : s);
const MARK = { pass: ["✓", "32"], fail: ["✗", "31;1"], na: ["n/a", "90"], warn: ["!", "33"] };
const mark = (s) => paint(MARK[s][1], MARK[s][0].padEnd(3));

export function renderReport(r, { verbose = false } = {}) {
  const out = [];
  const line = (s = "") => out.push(s);
  line(paint("1", `LAST SAVE verify · ${r.instance.id}`));
  line(`${r.instance.label} · NEAR testnet · read-only: no keys, no funds, no transactions`);
  if (!r.exists) { line(); line(`${mark("fail")} ${r.instance.id} does not exist on testnet (not launched yet?)`); return out.join("\n"); }
  line(`state: ${r.state}`);
  let group = "";
  for (const c of r.results) {
    if (c.group !== group) { group = c.group; line(); line(paint("1;4", group)); }
    line(`${mark(c.status)} ${c.label}`);
    line(`    ${paint("90", c.reason)}`);
  }
  const links = r.results.flatMap((c) => (c.links ?? []).map((l) => `${c.id} #${l.id}  ${l.url}`));
  if (links.length) { line(); line(paint("1;4", "Base Sepolia receipts")); for (const l of links) line(`    ${l}`); }
  const rb = r.results.filter((c) => c.id.startsWith("rebuild.") && c.status === "na");
  if (rb.length) {
    line(); line(paint("1;4", "Rebuild it yourself (not run by default; --rebuild runs it, needs Docker)"));
    for (const k of ["release", "probe"]) line(`    ${rebuildCommand(k)}   # -> ${r.pins[k]}`);
  }
  const n = r.counts;
  line();
  const head = n.fail ? paint("31;1", `FAILED: ${n.fail} check(s) did not hold`) : paint("32;1", "ALL CHECKS THAT RAN HELD");
  line(`${head}  ·  ${n.pass} ✓   ${n.fail} ✗   ${n.warn} !   ${n.na} n/a   ·  ${(r.elapsed_ms / 1000).toFixed(1)} s`);
  line(paint("90", "✓ held · ✗ did not hold · ! partly or not checkable right now (network, dead mirror, not broadcast yet) · n/a does not apply or has not happened yet"));
  line(paint("90", "Not proven here: OutLayer's TEE honesty (trusted, see README trust model), wallet sign-in, game balance. Claim map: JUDGE.md, /proof.json"));
  if (verbose) for (const c of r.results) if (c.ms > 5000) line(paint("90", `slow: ${c.id} ${c.ms} ms`));
  return out.join("\n");
}
