#!/usr/bin/env node
// pnpm demo:fresh [--testnet ...]
//   default   the whole lifecycle on a local NEAR sandbox (mock OutLayer, mock signer): no funds, no keys, no network, ~1-2 min
//   --testnet the original run on a fresh NEAR testnet instance (needs ~3.4 testnet NEAR and the local key store); see scripts/e2e/demo-fresh.mjs
const args = process.argv.slice(2);
if (args.includes("--testnet")) {
  process.argv.splice(2, args.length, ...args.filter((a) => a !== "--testnet"));
  await import("../e2e/demo-fresh.mjs");
} else {
  const { runSandbox } = await import("./sandbox.mjs");
  process.exit(await runSandbox(args));
}
