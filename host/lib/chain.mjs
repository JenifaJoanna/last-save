// Licence-contract views through the coordinator's NEAR helper (failover RPC + key loading) and the two payable calls we make.
import * as near from "../../scripts/lib/near.mjs";

export function chainFor(contract) {
  return {
    info: () => near.view(contract, "get_info", {}),
    releaseInfo: () => near.view(contract, "release_info", {}),
    snapshot: () => near.view(contract, "get_snapshot", {}),
    hosts: () => near.view(contract, "get_hosts", {}),
    claims: (from = 0, limit = 200) => near.view(contract, "get_claims", { from_index: from, limit }),
  };
}

export async function hostPublicKey(account) {
  await near.ensureKey(account);
  const kp = await near.connection().mem.getKey(near.NETWORK, account);
  return kp.getPublicKey().toString();
}

/** register_host(endpoint, host_pubkey), 0.01 NEAR. Returns the near.mjs result ({ hash, url, failure }). */
export async function registerHost({ account, contract, endpoint, deposit = "0.01" }) {
  const host_pubkey = await hostPublicKey(account);
  return near.call(account, contract, "register_host", { endpoint, host_pubkey }, { gas: 30, deposit });
}

export const claimEpoch = ({ account, contract, epoch, deposit = "0.01" }) =>
  near.call(account, contract, "claim_epoch", { epoch }, { gas: 300, deposit });
