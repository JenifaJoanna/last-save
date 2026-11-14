// NEAR Connect (@hot-labs/near-connect): the wallet connector NEAR's docs recommend for new apps.
// Wallet code runs in sandboxed iframes loaded from a public manifest; one connector instance per page, loaded lazily.
// On testnet the picker lists Meteor (extension and web), Intear, Nightly, Ledger, NEAR CLI and Ethereum Wallets.
// "Ethereum Wallets" is NEAR Connect's Ethereum executor (evm-on-near.dev): MetaMask, Rabby or Coinbase controls a
// 0x NEAR account natively (NEP-518). WalletConnect and Unity need a Reown project id, so NEAR Connect leaves them out.
import type { NearConnector, NearWalletBase } from "@hot-labs/near-connect";
import { CONTRACT } from "./near";
import { GASLESS_METHODS, KEY_ALLOWANCE_YOCTO } from "./gasless";

export type SignInKind = "near" | "evm";
export const EVM_WALLET_ID = "ethereum-wallets";
const RPCS = ["https://near-testnet.drpc.org", "https://test.rpc.fastnear.com", "https://rpc.testnet.near.org"]; // dRPC first: FastNEAR rate-limits heavy users

let shared: Promise<NearConnector> | null = null;
/** The connected wallet, kept so a signature request runs with NO await after the user's tap (web wallets open a tab,
 *  and browsers block window.open once the tap's activation has expired). */
let current: NearWalletBase | null = null;
export const forgetWallet = () => { current = null; };

export function connector(): Promise<NearConnector> {
  shared ??= import("@hot-labs/near-connect").then(({ NearConnector: C }) =>
    new C({ network: "testnet", providers: { testnet: RPCS }, features: { testnet: true }, footerBranding: null, autoConnect: true }));
  return shared;
}

export interface Connected { wallet: NearWalletBase; walletId: string; walletName: string; keyRequested: boolean }

/** Opens NEAR Connect. "near" shows every testnet wallet; "evm" goes straight to the Ethereum executor.
 *  When the picked wallet can add a function-call key at sign-in and `publicKey` is given, the wallet is asked to add
 *  it (the user approves that in their own wallet). Ethereum Wallets cannot, so they sign every action themselves. */
export async function connectWallet(kind: SignInKind, publicKey: string | null): Promise<Connected> {
  const c = await connector();
  const walletId = kind === "evm" ? EVM_WALLET_ID : await c.selectWallet();
  const w = await c.wallet(walletId);
  const canKey = !!w.manifest.features?.signInWithFunctionCallKey;
  const keyRequested = canKey && !!publicKey;
  const wallet = await c.connect(keyRequested && publicKey ? {
    walletId,
    addFunctionCallKey: {
      contractId: CONTRACT, publicKey,
      allowMethods: { anyMethod: false, methodNames: [...GASLESS_METHODS] },
      gasAllowance: { kind: "limited", amount: KEY_ALLOWANCE_YOCTO },
    },
  } : { walletId });
  current = wallet;
  return { wallet, walletId, walletName: w.manifest.name, keyRequested };
}

/** The account a restored session belongs to, if any. */
export async function restoredAccount(): Promise<{ wallet: NearWalletBase; accountId: string } | null> {
  try {
    const c = await connector();
    const { wallet, accounts } = await c.getConnectedWallet();
    const accountId = accounts[0]?.accountId;
    if (accountId) current = wallet;
    return accountId ? { wallet, accountId } : null;
  } catch { return null; }
}

/** The transaction hash in whatever shape the wallet returned (NEAR outcome, or the Ethereum executor's result). */
export function hashOf(outcome: unknown): string | null {
  const o = (Array.isArray(outcome) ? outcome[outcome.length - 1] : outcome) as Record<string, unknown> | undefined;
  if (!o || typeof o !== "object") return typeof o === "string" ? o : null;
  const tx = o.transaction as { hash?: string } | undefined;
  const to = o.transaction_outcome as { id?: string } | undefined;
  return tx?.hash ?? to?.id ?? (o.nearTransactionHash as string | undefined) ?? (o.hash as string | undefined) ?? null;
}

/** Sends one function call through the connected wallet. Returns the tx hash and whether any receipt failed. */
export async function walletCall(method: string, args: Record<string, unknown>, gasTgas: number, depositYocto: string): Promise<{ hash: string | null; failed: boolean }> {
  const wallet = current ?? await (await connector()).wallet(); // cached: sign straight away, inside the tap's activation
  const outcome = await wallet.signAndSendTransaction({
    receiverId: CONTRACT,
    actions: [{ type: "FunctionCall", params: { methodName: method, args, gas: (BigInt(gasTgas) * 10n ** 12n).toString(), deposit: depositYocto } }],
  });
  const status = JSON.stringify((outcome as { status?: unknown } | undefined)?.status ?? "");
  const receipts = JSON.stringify((outcome as { receipts_outcome?: unknown } | undefined)?.receipts_outcome ?? "");
  return { hash: hashOf(outcome), failed: status.includes("Failure") || receipts.includes("\"Failure\"") };
}
