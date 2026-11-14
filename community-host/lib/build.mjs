// The build step: chain -> released key -> mirrors (first copy matching the on-chain sha256) -> provenance -> decrypt -> build_hash check
// -> unpack into ./bundle, and the deploy variables (including the last on-chain snapshot) into .build/vars.json.
// All verification lives in ../vendor (generated from the repository's host/ and server-bundle/ code), so a clicker's build runs
// exactly the checks `pnpm host` runs.
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { prepare } from "../vendor/prepare.mjs";
import { verifyProvenance } from "../vendor/provenance.mjs";
import { Refusal } from "../vendor/refusal.mjs";
import { chainFor } from "./chain.mjs";
import { REPO, resolveConfig } from "./config.mjs";

/** Cloudflare caps one environment variable at 5 KiB. */
export const MAX_VAR_BYTES = 5 * 1024;

export async function buildCommunityHost({ root, env = process.env, chain = null, fetchBytes, provenance = null, log = () => {} }) {
  const toml = existsSync(join(root, "wrangler.toml")) ? readFileSync(join(root, "wrangler.toml"), "utf8") : "";
  let cfg;
  try { cfg = resolveConfig({ env, toml }); } catch (e) { throw new Refusal("bad_config", e.message); }
  log(`instance ${cfg.instance}, hosting as ${cfg.hostId}`);
  if (cfg.hostIsPlaceholder) log("WARNING: HOST_ID is still the placeholder. Players can connect, but sessions are receipted for it, so you cannot claim pool epochs until it is your own NEAR account.");

  const c = chain ?? chainFor(cfg.instance, cfg.rpcs);
  const prov = provenance ?? ((a) => verifyProvenance({ ...a, repo: env.PROVENANCE_REPO || REPO, tag: cfg.tag }));
  // a refused build must never leave an earlier bundle behind for `npm run deploy` to pick up
  const work = join(root, ".build");
  rmSync(work, { recursive: true, force: true });
  rmSync(join(root, "bundle"), { recursive: true, force: true });
  const prep = await prepare({ chain: c, fetchBytes, workDir: work, provenance: env.SKIP_PROVENANCE === "1" ? null : prov, log });

  const restore = prep.restore ? JSON.stringify(prep.restore) : null;
  if (restore && Buffer.byteLength(restore) > MAX_VAR_BYTES) {
    throw new Refusal("snapshot_too_large", `The on-chain snapshot #${prep.restore.seq} is ${Buffer.byteLength(restore)} bytes as a Worker variable; Cloudflare allows 5120. Refusing to deploy without the progress it holds.`);
  }
  const bundle = join(root, "bundle");
  rmSync(bundle, { recursive: true, force: true });
  cpSync(prep.dir, bundle, { recursive: true });
  rmSync(prep.dir, { recursive: true, force: true });
  const vars = { HOST_ID: cfg.hostId, BUILD_HASH: prep.buildHash, LICENCE_CONTRACT: cfg.instance, RPC_URLS: cfg.rpcUrls, ...(restore ? { RESTORE_SNAPSHOT: restore } : {}) };
  mkdirSync(work, { recursive: true });
  writeFileSync(join(work, "vars.json"), JSON.stringify(vars), { mode: 0o600 });
  log(`ready to deploy: build ${prep.buildHash.slice(0, 12)}…, ${prep.restore ? `restoring snapshot #${prep.restore.seq}` : "no snapshot on chain (fresh start)"}`);
  return { cfg, buildHash: prep.buildHash, restore: prep.restore, provenance: prep.provenance, vars };
}
