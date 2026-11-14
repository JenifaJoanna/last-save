#!/usr/bin/env node
// Base Sepolia balance and nonce of an address:  node scripts/chainsig/balance.mjs <0xaddress> [<0xaddress> ...]
import { basescanAddress, evmRpc, fmtEth, hexInt } from "./evm.mjs";

const addrs = process.argv.slice(2).filter((a) => !a.startsWith("--"));
if (!addrs.length || addrs.some((a) => !/^0x[0-9a-fA-F]{40}$/.test(a))) {
  process.stderr.write("usage: balance.mjs <0xaddress> [...]\n");
  process.exit(2);
}
for (const a of addrs) {
  const [bal, nonce] = await Promise.all([evmRpc("eth_getBalance", [a, "latest"]), evmRpc("eth_getTransactionCount", [a, "latest"])]);
  process.stdout.write(`${a}  ${fmtEth(hexInt(bal))} ETH (${hexInt(bal)} wei)  nonce ${hexInt(nonce)}  ${basescanAddress(a)}\n`);
}
