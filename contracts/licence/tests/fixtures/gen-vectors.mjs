// Generates evm-vectors.json: EIP-1559 (Base Sepolia, chainId 84532) transactions encoded and signed
// by ethers with a throwaway TEST signer. The Rust tests rebuild every field independently and compare.
// Run: node gen-vectors.mjs > evm-vectors.json
import { Transaction, SigningKey, keccak256, computeAddress } from "ethers";

const TEST_SIGNER = keccak256(new TextEncoder().encode("lastsave-test-signer-v1"));
const sk = new SigningKey(TEST_SIGNER);
const address = computeAddress(TEST_SIGNER).toLowerCase();

function vec(name, f) {
  const tx = Transaction.from({
    type: 2, chainId: 84532, nonce: f.nonce, to: f.to, value: f.value,
    maxPriorityFeePerGas: f.prio, maxFeePerGas: f.fee, gasLimit: f.gas, data: "0x", accessList: [],
  });
  const hash = tx.unsignedHash;
  const sig = sk.sign(hash);
  const signed = Transaction.from({ ...tx.toJSON(), signature: sig });
  return {
    name, nonce: f.nonce, to: f.to, gas: f.gas,
    value: f.value.toString(), prio: f.prio.toString(), fee: f.fee.toString(),
    unsigned: tx.unsignedSerialized, payload: hash,
    r: sig.r, s: sig.s, y_parity: sig.yParity, raw: signed.serialized, tx_hash: signed.hash,
  };
}

const to1 = "0x70997970c51812dc3a010c7d01b50e0d17dc79c8";
const to2 = "0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc";
const base = { to: to1, value: 20000000000000n, prio: 1000000n, fee: 2000000000n, gas: 21000 };
const out = {
  chain_id: 84532, signer_address: address,
  vectors: [
    vec("small", { ...base, nonce: 0 }),
    vec("wide", { nonce: 300, to: to2, value: 123456789012345678901n, prio: 1500000000n, fee: 70000000000n, gas: 21000 }),
    vec("second", { ...base, nonce: 1, to: to2 }),
    vec("bumped", { ...base, nonce: 0, prio: 1250000n, fee: 2500000000n }),
  ],
};
// one vector whose r or s has a leading zero byte (RLP must strip it)
for (let n = 1; n < 5000; n++) {
  const v = vec("short-int", { ...base, nonce: n });
  if (v.r.startsWith("0x00") || v.s.startsWith("0x00")) { out.vectors.push(v); break; }
}
// a vector with y_parity 1 if none yet
if (!out.vectors.some((v) => v.y_parity === 1)) {
  for (let n = 1; n < 50; n++) {
    const v = vec("odd-parity", { ...base, to: to2, nonce: n });
    if (v.y_parity === 1) { out.vectors.push(v); break; }
  }
}
console.log(JSON.stringify(out, null, 1));
