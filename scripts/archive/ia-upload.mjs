#!/usr/bin/env node
// Preserves a released Ember Rift server build on the Internet Archive. It reads the released key from the licence
// contract, fetches the encrypted build from its mirrors (sha256 checked against the chain), decrypts it, refuses unless
// sha256(plaintext) == the on-chain build_hash, then uploads the build, the last on-chain progress snapshot and a
// README to one archive.org item via the IAS3 API. Keys come from local/ia/keys.env (gitignored, 0600), never printed.
//   node scripts/archive/ia-upload.mjs --instance <id> [--item <identifier>] [--dry-run]
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { decryptBundle } from "../../server-bundle/lib/crypto.mjs";
import { fetchVerifiedArtifact } from "../../host/lib/prepare.mjs";
import { view } from "../lib/near.mjs";

const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const INSTANCE = arg("instance", "ember-rift.lastsave-factory.testnet");
const ITEM = arg("item", `ember-rift-server-${INSTANCE.split(".")[0]}-lastsave`);
const DRY = process.argv.includes("--dry-run");
const REPO = "https://github.com/JenifaJoanna/last-save";
const out = (s) => process.stdout.write(`${s}\n`);
const sha = (b) => createHash("sha256").update(b).digest("hex");

function keys() {
  const f = "local/ia/keys.env";
  if (!existsSync(f)) throw new Error(`missing ${f} (IA S3 keys)`);
  const kv = Object.fromEntries(readFileSync(f, "utf8").split("\n").filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]));
  if (!kv.LASTSAVE_IA_ACCESS || !kv.LASTSAVE_IA_SECRET) throw new Error("keys file lacks LASTSAVE_IA_ACCESS / LASTSAVE_IA_SECRET");
  return `LOW ${kv.LASTSAVE_IA_ACCESS}:${kv.LASTSAVE_IA_SECRET}`;
}

async function put(name, body, meta, auth) {
  const headers = { authorization: auth, "x-amz-auto-make-bucket": "1", "x-archive-queue-derive": "0", "x-archive-size-hint": String(body.length), "content-type": "application/octet-stream" };
  if (meta) for (const [k, v] of Object.entries(meta)) headers[`x-archive-meta-${k}`] = `uri(${encodeURIComponent(v)})`;
  for (let attempt = 0; attempt < 5; attempt++) {
    const r = await fetch(`https://s3.us.archive.org/${ITEM}/${encodeURIComponent(name)}`, { method: "PUT", headers, body });
    if (r.ok) return;
    if (r.status === 503) { await new Promise((res) => setTimeout(res, 4000 * (attempt + 1))); continue; } // SlowDown
    throw new Error(`upload ${name} failed: ${r.status} ${(await r.text()).slice(0, 200)}`);
  }
  throw new Error(`upload ${name}: archive.org kept answering SlowDown`);
}

const [info, rel, snap] = await Promise.all([view(INSTANCE, "get_info"), view(INSTANCE, "release_info"), view(INSTANCE, "get_snapshot").catch(() => null)]);
const key = info?.released_key;
if (!key) throw new Error(`${INSTANCE} has not released its server key; nothing to preserve yet`);
const got = await fetchVerifiedArtifact({ rel, log: (l) => out(`  ${l}`) });
const plain = decryptBundle(got.encrypted, Buffer.from(key, "hex"));
if (sha(plain) !== String(rel.build_hash).toLowerCase()) throw new Error("decrypted build does not hash to the on-chain build_hash; refusing");
out(`build ${rel.build_hash.slice(0, 16)}… verified (${plain.length} bytes) from ${got.label}`);

const snapJson = snap?.blob_base64 ? Buffer.from(snap.blob_base64, "base64") : null;
const readme = Buffer.from([
  "Ember Rift: the community server build, preserved by its players.",
  "",
  `Released on NEAR testnet by the Last Save licence contract ${INSTANCE} after its studio went dark.`,
  `The licence contract committed to this exact build before launch (build sha256 ${rel.build_hash}).`,
  `An OutLayer enclave released the server key on-chain; anyone can decrypt and host the game.`,
  "",
  `Contract: https://testnet.near.rocks/account/${INSTANCE}`,
  `Code (MIT): ${REPO}`,
  "Ember Rift and its studio are fictional, made for the Last Save demo.",
].join("\n"));
const meta = {
  title: "Ember Rift: server build, preserved by its players",
  creator: "Jenifa", mediatype: "software", collection: "opensource", licenseurl: "https://opensource.org/licenses/MIT",
  subject: "videogame preservation;NEAR;Last Save;game servers", date: new Date().toISOString().slice(0, 10),
  description: `The released community server build of Ember Rift, a fictional game used to demonstrate Last Save, a NEAR game licence that outlives its publisher. Code: ${REPO} . Licence contract (NEAR testnet): https://testnet.near.rocks/account/${INSTANCE} . Build sha256 ${rel.build_hash}.`,
};
const files = [["README.txt", readme], [`ember-rift-server-${rel.build_hash.slice(0, 12)}.tar.gz`, plain], ...(snapJson ? [[`progress-snapshot-${snap.seq}.json`, snapJson]] : [])];
out(`item https://archive.org/details/${ITEM}: ${files.map(([n]) => n).join(", ")}`);
if (DRY) { out("dry run: nothing uploaded"); process.exit(0); }
const auth = keys();
for (const [i, [name, body]] of files.entries()) { await put(name, body, i === 0 ? meta : null, auth); out(`uploaded ${name}`); }
// Append an "archive" step to the instance's launch proof (same append-only shape launch.mjs writes). Re-read at write
// time: launch.mjs is finished by the time a build is released, so nothing else holds this file open.
const PROOF = `proof/launch-${INSTANCE.split(".")[0]}.json`;
const proof = existsSync(PROOF) ? JSON.parse(readFileSync(PROOF, "utf8")) : { contract: INSTANCE, steps: [] };
proof.steps.push({ step: "archive", at: new Date().toISOString(), item: ITEM, url: `https://archive.org/details/${ITEM}`, build_hash: rel.build_hash,
  files: files.map(([name, body]) => ({ name, sha256: sha(body), bytes: body.length })) });
writeFileSync(PROOF, JSON.stringify(proof, null, 2) + "\n");
out(`recorded in ${PROOF}`);
out(`done: https://archive.org/details/${ITEM} (the item page can lag a few minutes while archive.org ingests)`);
