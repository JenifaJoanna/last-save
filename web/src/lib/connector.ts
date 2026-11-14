// NEAR Connect (@hot-labs/near-connect): the wallet connector NEAR's docs recommend for new apps.
// Wallet code runs in sandboxed iframes loaded from a public manifest; one connector instance per page, loaded lazily.
// On testnet the modal lists Meteor, Intear, Ledger, Nightly and NEAR CLI; "evm" opens the Ethereum-wallets executor
// (evm-on-near.dev). WalletConnect and Unity need a Reown project id (VITE_WALLETCONNECT_PROJECT_ID) and a
// @walletconnect/sign-client passed as `walletConnect`; without one NEAR Connect leaves them out rather than broken.
import type { NearConnector, NearWalletBase } from "@hot-labs/near-connect";
import { CONTRACT } from "./near";
import { GASLESS_METHODS, KEY_ALLOWANCE_YOCTO } from "./gasless";

export type SignInKind = "near" | "evm";
export const EVM_WALLET_ID = "ethereum-wallets";
const RPCS = ["https://test.rpc.fastnear.com", "https://rpc.testnet.near.org"];

let shared: Promise<NearConnector> | null = null;

export function connector(): Promise<NearConnector> {
  shared ??= import("@hot-labs/near-connect").then(({ NearConnector: C }) =>
    new C({ network: "testnet", providers: { testnet: RPCS }, features: { testnet: true }, footerBranding: null, autoConnect: true }));
  return shared;
}

/** Opens NEAR Connect. "near" asks the wallet to also add this app's function-call key (gas-free holder actions);
 *  "evm" goes straight to MetaMask and other Ethereum wallets, which sign NEAR transactions but cannot add that key. */
export async function connectWallet(kind: SignInKind, publicKey: string | null): Promise<NearWalletBase> {
  const c = await connector();
  if (kind === "evm") return c.connect({ walletId: EVM_WALLET_ID });
  if (!publicKey) return c.connect();
  return c.connect({
    addFunctionCallKey: {
      contractId: CONTRACT, publicKey,
      allowMethods: { anyMethod: false, methodNames: [...GASLESS_METHODS] },
      gasAllowance: { kind: "limited", amount: KEY_ALLOWANCE_YOCTO },
    },
  });
}

/** The account a restored session belongs to, if any. */
export async function restoredAccount(): Promise<{ wallet: NearWalletBase; accountId: string } | null> {
  try {
    const c = await connector();
    const { wallet, accounts } = await c.getConnectedWallet();
    const accountId = accounts[0]?.accountId;
    return accountId ? { wallet, accountId } : null;
  } catch { return null; }
}

/** Sends one function call through the connected wallet. Returns the tx hash and whether any receipt failed. */
export async function walletCall(method: string, args: Record<string, unknown>, gasTgas: number, depositYocto: string): Promise<{ hash: string | null; failed: boolean }> {
  const c = await connector();
  const wallet = await c.wallet();
  const outcome = await wallet.signAndSendTransaction({
    receiverId: CONTRACT,
    actions: [{ type: "FunctionCall", params: { methodName: method, args, gas: (BigInt(gasTgas) * 10n ** 12n).toString(), deposit: depositYocto } }],
  });
  const hash = (outcome as { transaction?: { hash?: string } } | undefined)?.transaction?.hash ?? null;
  return { hash, failed: JSON.stringify((outcome as { status?: unknown } | undefined)?.status ?? "").includes("Failure") };
}
