// Ethereum wallets in this page, found the EIP-6963 way: each installed wallet (MetaMask, Rabby, Coinbase, ...)
// announces itself with its own name and icon, so nothing guesses at window.ethereum. Used to show which EVM wallets
// are installed, and on the Hosts page to bind a Base payout address by signature (personal_sign).
import { secp256k1 } from "@noble/curves/secp256k1";
import { keccak_256 } from "@noble/hashes/sha3";
import { useEffect, useState } from "react";

export interface Eip1193 { request: (a: { method: string; params?: unknown[] }) => Promise<unknown> }
export interface EvmWallet { uuid: string; name: string; icon: string; rdns: string; provider: Eip1193 }

const found = new Map<string, EvmWallet>();
const subs = new Set<() => void>();
let listening = false;

function listen(): void {
  if (listening || typeof window === "undefined") return;
  listening = true;
  window.addEventListener("eip6963:announceProvider", (e) => {
    const d = (e as CustomEvent<{ info: { uuid: string; name: string; icon: string; rdns: string }; provider: Eip1193 }>).detail;
    if (!d?.info?.uuid || !d.provider || found.has(d.info.uuid)) return;
    found.set(d.info.uuid, { ...d.info, provider: d.provider });
    subs.forEach((f) => f());
  });
}

/** Asks installed wallets to announce themselves; returns them as they answer. */
export function discoverEvmWallets(): EvmWallet[] {
  listen();
  if (typeof window !== "undefined") window.dispatchEvent(new Event("eip6963:requestProvider"));
  return [...found.values()];
}

export function useEvmWallets(): EvmWallet[] {
  const [list, setList] = useState<EvmWallet[]>(() => [...found.values()]);
  useEffect(() => {
    const f = () => setList([...found.values()]);
    subs.add(f);
    discoverEvmWallets();
    f();
    return () => { subs.delete(f); };
  }, []);
  return list;
}

/** Opens the wallet's connect prompt and returns the first address it shares. */
export async function requestAddress(w: EvmWallet): Promise<string> {
  const accts = (await w.provider.request({ method: "eth_requestAccounts" })) as string[];
  const a = accts?.[0];
  if (!a || !/^0x[0-9a-fA-F]{40}$/.test(a)) throw new Error("The wallet shared no address.");
  return a;
}

/** The message a host signs to bind a Base payout address to its NEAR host account. */
export function payoutMessage(hostId: string, contract: string, address: string, issuedAt: string): string {
  return [
    "Last Save · Base payout address",
    "",
    `I control ${address.toLowerCase()} and want host payouts for ${hostId} sent to it on Base Sepolia (chain 84532).`,
    "",
    `Licence contract: ${contract}`,
    `Host account: ${hostId}`,
    `Issued at: ${issuedAt}`,
  ].join("\n");
}

const utf8 = (s: string) => new TextEncoder().encode(s);
const hexToBytes = (h: string) => Uint8Array.from((h.replace(/^0x/, "").match(/.{2}/g) ?? []).map((b) => parseInt(b, 16)));
const toHex = (u: Uint8Array) => [...u].map((b) => b.toString(16).padStart(2, "0")).join("");

/** personal_sign in the wallet. The message goes hex-encoded, as EIP-1193 wallets expect. */
export async function personalSign(w: EvmWallet, address: string, message: string): Promise<string> {
  const sig = (await w.provider.request({ method: "personal_sign", params: [`0x${toHex(utf8(message))}`, address] })) as string;
  if (typeof sig !== "string" || !/^0x[0-9a-fA-F]{130}$/.test(sig)) throw new Error("The wallet returned no signature.");
  return sig;
}

/** EIP-191 recovery: the address that produced `sig` over `message`. */
export function recoverSigner(message: string, sig: string): string {
  const m = utf8(message);
  const digest = keccak_256(new Uint8Array([...utf8(`\x19Ethereum Signed Message:\n${m.length}`), ...m]));
  const b = hexToBytes(sig);
  const v = b[64] >= 27 ? b[64] - 27 : b[64];
  const pub = secp256k1.Signature.fromCompact(b.slice(0, 64)).addRecoveryBit(v).recoverPublicKey(digest).toRawBytes(false);
  return `0x${toHex(keccak_256(pub.slice(1)).slice(-20))}`;
}
