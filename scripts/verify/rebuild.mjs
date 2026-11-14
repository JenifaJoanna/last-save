// Rebuild checks. Default: print the exact commands and the hashes they must produce, build nothing (a Docker build is slow and heavy).
// `pnpm verify --rebuild` runs them. release.wasm and probe.wasm are the code the escrow trusts and are built in OutLayer's pinned
// compiler image (amd64, rustc 1.97.1). The licence wasm is not bit-reproducible today (see its row), and we say so.
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sha256Hex, short } from "./pure.mjs";
import { bad, na, ok, warn } from "./checks-chain.mjs";

export const rebuildCommand = (kind) => `OUTLAYER_OUT_DIR=$PWD/local/repro/${kind} ./scripts/outlayer-build-wasm.sh --dir outlayer/${kind} --target wasm32-wasip2 --keep`;

function rebuildOne(kind) {
  return async (ctx) => {
    const want = (await ctx.info()).config[kind].sha256;
    if (!ctx.opts.rebuild) return na(`not run by default (--rebuild); must print ${short(want)}; command listed below`, { command: rebuildCommand(kind), want });
    if (spawnSync("docker", ["info"], { stdio: "ignore" }).status !== 0) return warn("--rebuild needs Docker running", { command: rebuildCommand(kind), want });
    const out = mkdtempSync(join(tmpdir(), `lastsave-${kind}-`));
    try {
      const r = spawnSync("./scripts/outlayer-build-wasm.sh", ["--dir", `outlayer/${kind}`, "--target", "wasm32-wasip2", "--keep"], {
        cwd: ctx.root, env: { ...process.env, OUTLAYER_OUT_DIR: out }, encoding: "utf8", timeout: 20 * 60_000 });
      if (r.status !== 0) return bad(`rebuild failed: ${String(r.stderr).trim().split("\n").pop().slice(0, 120)}`);
      const got = sha256Hex(readFileSync(join(out, "a", "module.wasm")));
      return got === want ? ok(`rebuilt ${kind}.wasm in OutLayer's pinned image: sha256 ${short(got)} = on chain`, { want, got }) : bad(`rebuilt ${short(got)} != on-chain ${short(want)}`, { want, got });
    } finally { rmSync(out, { recursive: true, force: true }); }
  };
}

const licenceRow = async (ctx) => na(`not bit-reproducible: the published licence wasm is cargo (rust 1.86) + wasm-opt output from a local toolchain. Its identity is the hash ${short((ctx.inst.kind === "factory" ? ctx.inst.globalCodeHash : ctx.inst.codeSha256) ?? "")} and its public on-chain bytes (rows above); the source is contracts/licence`);

export const CHECKS = [
  { id: "rebuild.release", group: "Rebuild", label: "release.wasm rebuilds to the on-chain hash", run: rebuildOne("release") },
  { id: "rebuild.probe", group: "Rebuild", label: "probe.wasm rebuilds to the on-chain hash", run: rebuildOne("probe") },
  { id: "rebuild.licence", group: "Rebuild", label: "Licence wasm rebuild", run: licenceRow },
];
