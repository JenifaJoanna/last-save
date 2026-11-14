import { describe, expect, it } from "vitest";
import { ATTACKS, runAttack } from "../src/attack";

const env = { ALLOWED_RECEIVERS: "v2dev.lastsave-factory.testnet", RELAYER_ACCOUNT: "relay.example.testnet", RELAYER_KEY: "ed25519:x", ATTACKER_ACCOUNT: "attacker.example.testnet", ATTACKER_KEY: "ed25519:x" };

describe("attack demo", () => {
  it("offers only zero-deposit calls the relayer allows", () => {
    for (const a of Object.values(ATTACKS)) expect(["release", "report_down", "claim_epoch", "set_payout_evm", "bump_evm_payout"]).toContain(a.method);
  });
  it("refuses unknown attacks and unknown targets before touching the network", async () => {
    await expect(runAttack({ attack: "steal-everything", target: "v2dev.lastsave-factory.testnet" }, env)).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(runAttack({ attack: "early-release", target: "lastsave-licence.testnet" }, env)).rejects.toMatchObject({ code: "RECEIVER_NOT_ALLOWED" });
  });
  it("is off unless configured", async () => {
    await expect(runAttack({ attack: "early-release", target: "v2dev.lastsave-factory.testnet" }, { ...env, ATTACKER_KEY: undefined })).rejects.toMatchObject({ code: "NOT_CONFIGURED" });
  });
});
