#!/usr/bin/env node
// Creates a funded top-level NEAR testnet account for the demo cast (a second studio, a non-holder player). A fresh
// ed25519 key is written to the local credentials store (0600) before the account exists; the secret is never printed.
//   node scripts/ops/new-account.mjs <id>.testnet <initial NEAR> [--from lastsave-studio.testnet]
import * as nearApi from "near-api-js";
import { accountState, call, connection } from "../lib/near.mjs";

const [id, amount] = process.argv.slice(2);
const i = process.argv.indexOf("--from");
const from = i > 0 ? process.argv[i + 1] : "lastsave-studio.testnet";
if (!/^[a-z0-9][a-z0-9-_]{1,50}\.testnet$/.test(id ?? "") || !(Number(amount) > 0 && Number(amount) <= 3)) {
  process.stderr.write("usage: new-account.mjs <name>.testnet <NEAR 0-3> [--from <funder>]\n");
  process.exit(2);
}
if (await accountState(id)) { process.stdout.write(`${id} already exists; nothing sent\n`); process.exit(0); }
const kp = nearApi.KeyPair.fromRandom("ed25519");
await connection().store.keyStores[1].setKey("testnet", id, kp);
const r = await call(from, "testnet", "create_account", { new_account_id: id, new_public_key: kp.getPublicKey().toString() }, { gas: 30, deposit: amount });
if (r.failure) throw new Error(`create_account failed: ${JSON.stringify(r.failure)} ${r.url}`);
process.stdout.write(`created ${id} with ${amount} N from ${from}: ${r.url}\n`);
