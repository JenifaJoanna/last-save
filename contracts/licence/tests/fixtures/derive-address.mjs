// Derives the payer address the MPC signer holds for (derivation account, path), so it can be put
// in the licence's `evm_payout.address` and re-derived by anyone.
//   node derive-address.mjs <derivation-account> [path] [mpc-account]
// The derivation account is the licence contract itself (the MPC derives per predecessor).
// Defaults: path "lastsave/host-payouts", signer v1.signer-prod.testnet (domain 0, secp256k1).
// Algorithm (near/mpc crates/near-mpc-crypto-types kdf.rs):
//   tweak = sha3_256("near-mpc-recovery v0.1.0 epsilon derivation:" + account + "," + path)
//   derived = root_public_key + tweak * G ; address = keccak256(uncompressed x||y)[12..]
import { secp256k1 } from "@noble/curves/secp256k1";
import { sha3_256 } from "@noble/hashes/sha3";
import { keccak_256 } from "@noble/hashes/sha3";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils";

const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
function b58decode(s) {
  let n = 0n;
  for (const c of s) n = n * 58n + BigInt(B58.indexOf(c));
  let hex = n.toString(16);
  if (hex.length % 2) hex = "0" + hex;
  return Uint8Array.from(hex.match(/../g).map((h) => parseInt(h, 16)));
}

export function deriveAddress(rootPublicKey, account, path) {
  const raw = b58decode(rootPublicKey.replace(/^secp256k1:/, "")); // 64 bytes x||y
  const root = secp256k1.ProjectivePoint.fromHex("04" + bytesToHex(raw));
  const tweak = BigInt("0x" + bytesToHex(sha3_256(utf8ToBytes(`near-mpc-recovery v0.1.0 epsilon derivation:${account},${path}`))));
  const derived = root.add(secp256k1.ProjectivePoint.BASE.multiply(tweak % secp256k1.CURVE.n));
  const uncompressed = derived.toRawBytes(false);
  return "0x" + bytesToHex(keccak_256(uncompressed.slice(1)).slice(12));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [account, path = "lastsave/host-payouts", mpc = "v1.signer-prod.testnet"] = process.argv.slice(2);
  if (!account) throw new Error("usage: node derive-address.mjs <derivation-account> [path] [mpc-account]");
  const res = await fetch("https://test.rpc.fastnear.com", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "query", params: { request_type: "call_function", finality: "final", account_id: mpc, method_name: "public_key", args_base64: Buffer.from("{}").toString("base64") } }),
  });
  const root = JSON.parse(Buffer.from((await res.json()).result.result).toString());
  console.log(JSON.stringify({ mpc, root_public_key: root, account, path, address: deriveAddress(root, account, path) }));
}
