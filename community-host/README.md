# Host Ember Rift in your own Cloudflare account

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/JenifaJoanna/last-save/tree/main/community-host)

This directory is a self-contained template for the Deploy to Cloudflare button. Cloudflare copies it into a new repository in your
GitHub account, then Workers Builds runs `npm run build` and `npm run deploy` for you.

## What the build does

1. Reads the licence instance from NEAR testnet: the released key, the committed artifact hash and mirror list, the last progress snapshot.
2. **Refuses** (the build fails and nothing is deployed) if the instance has not released its key (its status is not Dead), if the released
   key does not match the on-chain commitment, if no mirror serves bytes matching the on-chain sha256, or if the decrypted bundle does
   not match the on-chain `build_hash`.
3. Downloads the encrypted artifact from the first mirror that verifies (studio copy, then Walrus, then GitHub), one log line each.
4. Checks the build's Sigstore provenance (workflow, commit, Rekor entry). Unreachable GitHub only warns; the on-chain hash still gates.
5. Decrypts, unpacks into `bundle/`, and deploys it as a Worker with one SQLite Durable Object, restoring the last on-chain snapshot
   (progress is imported once, into an empty database).

The checks are the same code `pnpm host` runs: `vendor/` is generated from `host/` and `server-bundle/` by `scripts/sync-community-host.mjs`.

## What you set

Defaults work for a first look. Before you rely on it, set these in `wrangler.toml` `[vars]` of **your copy** of the repository
(or as Workers Builds *build variables* of the same names, which win):

| Variable | Default | Meaning |
|---|---|---|
| `LICENCE_CONTRACT` | `ember-rift.lastsave-factory.testnet` | The licence instance to host. It must have released its key. |
| `HOST_ID` | `community-host.testnet` | **Your** NEAR testnet account. Sessions are receipted for it; it is the account that registers and claims. |

After changing a variable, push a commit (or press *Retry build*) to redeploy. Your server appears at
`https://ember-rift-community.<your-subdomain>.workers.dev`; `/health` shows the host id and build hash.
The server is a public `workers.dev` address in *your* account: this template is the only one in the repository that enables it.

## Registering on chain is separate

Deploying makes the game playable. It does **not** register you as a host, and the pool pays only registered hosts. From your own NEAR
account call `register_host(endpoint, host_pubkey)` (0.01 N) with your `workers.dev` URL, for example on the
[Hosts page](https://last-save.pages.dev/app/hosts). That is a signed transaction the build cannot and does not make.

## Limits

- The restore snapshot is passed as a Worker variable (5 KiB). A larger on-chain snapshot makes the build refuse rather than drop progress.
- Progress earned on a community host stays in that host's database; only the studio key can post snapshots.
- Testnet only.

## Local check

```
npm install
LICENCE_CONTRACT=<instance> HOST_ID=<you>.testnet npm run build
node scripts/deploy.mjs --dry-run        # wrangler deploy --dry-run, publishes nothing
npm test
```

`npm run deploy` refuses outside Workers Builds unless `COMMUNITY_HOST_ALLOW_LOCAL=1` (use that only with your own account).
