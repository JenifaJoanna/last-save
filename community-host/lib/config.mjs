// Which instance to host and as whom. Order: build environment variable, then [vars] in wrangler.toml, then the default.
export const DEFAULT_INSTANCE = "ember-rift.lastsave-factory.testnet";
export const DEFAULT_HOST_ID = "community-host.testnet";
export const DEFAULT_RPCS = "https://test.rpc.fastnear.com,https://near-testnet.drpc.org";
export const REPO = "JenifaJoanna/last-save";
const ACCOUNT = /^[a-z0-9][a-z0-9._-]{1,63}$/;

/** Reads the simple `KEY = "value"` lines of the [vars] table. */
export function readVars(toml) {
  const out = {};
  let inVars = false;
  for (const line of String(toml).split("\n")) {
    const t = line.trim();
    if (t.startsWith("[")) { inVars = t === "[vars]"; continue; }
    const m = inVars && /^([A-Z][A-Z0-9_]*)\s*=\s*"([^"]*)"/.exec(t);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

/** Pure. Throws Error with a plain message for an unusable value. */
export function resolveConfig({ env = {}, toml = "" }) {
  const file = readVars(toml);
  const pick = (k, d) => (env[k] && env[k].trim()) || file[k] || d;
  const instance = pick("LICENCE_CONTRACT", DEFAULT_INSTANCE).trim();
  const hostId = pick("HOST_ID", DEFAULT_HOST_ID).trim();
  if (!ACCOUNT.test(instance)) throw new Error(`LICENCE_CONTRACT "${instance}" is not a NEAR account id`);
  if (!ACCOUNT.test(hostId)) throw new Error(`HOST_ID "${hostId}" is not a NEAR account id`);
  const rpcs = pick("RPC_URLS", DEFAULT_RPCS).split(",").map((s) => s.trim()).filter(Boolean);
  if (!rpcs.length || rpcs.some((u) => !/^https:\/\//.test(u))) throw new Error("RPC_URLS must be a comma-separated list of https URLs");
  return { instance, hostId, rpcs, rpcUrls: rpcs.join(","), hostIsPlaceholder: hostId === DEFAULT_HOST_ID,
    tag: /^([a-z0-9][a-z0-9_-]*)\.lastsave-factory\./.exec(instance) ? `build-${instance.split(".")[0]}` : null };
}
