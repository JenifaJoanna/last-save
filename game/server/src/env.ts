// Worker environment and parsed configuration.
export interface Env {
  ARENA: DurableObjectNamespace;
  ASSETS: Fetcher;
  HOST_ID?: string;
  BUILD_HASH?: string;
  LICENCE_CONTRACT?: string;
  RPC_URLS?: string;
  /** studio only: function-call key secret ("ed25519:<b58>") that posts snapshots */
  SNAPSHOT_SIGNER?: string;
  STUDIO_ACCOUNT?: string;
  /** fan host: JSON {"seq":n,"hash":"<sha256 hex>","blob_base64":"..."} verified on first boot */
  RESTORE_SNAPSHOT?: string;
  /** studio only: Walrus publisher the snapshots are mirrored to ("off" disables; default the public testnet publisher) */
  WALRUS_PUBLISHER?: string;
  WALRUS_AGGREGATOR?: string;
  /** milliseconds an RPC answer stays cached (default 60000) */
  RPC_CACHE_MS?: string;
  /** base backoff between RPC retries in ms (default 400) */
  RPC_BACKOFF_MS?: string;
  /** test knob: simulation steps per 30 Hz tick, 1..30 (default 1) */
  TIME_SCALE?: string;
}

export interface Config {
  hostId: string;
  buildHash: string;
  licenceContract: string;
  rpcUrls: string[];
  snapshotSigner: string | null;
  studioAccount: string;
  restoreSnapshot: string | null;
  walrusPublisher: string;
  walrusAggregator: string;
  rpcCacheMs: number;
  rpcBackoffMs: number;
  timeScale: number;
}

const int = (v: string | undefined, d: number, min: number, max: number) => {
  const n = Number(v);
  return v !== undefined && v !== "" && Number.isFinite(n) ? Math.min(max, Math.max(min, Math.floor(n))) : d;
};

export function loadConfig(env: Env): Config {
  return {
    hostId: env.HOST_ID || "official",
    buildHash: env.BUILD_HASH || "dev",
    licenceContract: env.LICENCE_CONTRACT || "lastsave-licence.testnet",
    rpcUrls: (env.RPC_URLS || "https://test.rpc.fastnear.com,https://near-testnet.drpc.org")
      .split(",").map((s) => s.trim()).filter(Boolean),
    snapshotSigner: env.SNAPSHOT_SIGNER || null,
    studioAccount: env.STUDIO_ACCOUNT || "lastsave-studio.testnet",
    restoreSnapshot: env.RESTORE_SNAPSHOT || null,
    walrusPublisher: env.WALRUS_PUBLISHER ?? "https://publisher.walrus-testnet.walrus.space",
    walrusAggregator: (env.WALRUS_AGGREGATOR || "https://aggregator.walrus-testnet.walrus.space").replace(/\/$/, ""),
    rpcCacheMs: int(env.RPC_CACHE_MS, 60_000, 0, 3_600_000),
    rpcBackoffMs: int(env.RPC_BACKOFF_MS, 400, 0, 10_000),
    timeScale: int(env.TIME_SCALE, 1, 1, 30),
  };
}
