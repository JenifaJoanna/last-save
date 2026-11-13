# The judge instance: launched, locked, killed, released, hosted (14 Nov 2026, IST)

Contract `lastsave-licence.testnet`. Every link opens on NEAR Rocks (FastNear's testnet explorer); the same hashes open on
nearblocks. This instance is locked and stays dead by design; `pnpm demo:fresh` re-runs the lifecycle on a fresh account.

| When (IST) | Step | Transaction | What it shows |
|---|---|---|---|
| 02:26 | deploy + init | [33hTa6kh…](https://testnet.near.rocks/tx/33hTa6khdCc94xTwPPFAC1SC7PpSwEWTkeUFN25WLxUr) | code sha256 `c884be5a…16d2`, demo-speed liveness (probe 20 s, 3 failures, windows 2–3 min), epoch 2 min |
| 02:27 | escrow_key | [4Ztpt7PF…](https://testnet.near.rocks/tx/4Ztpt7PFKdWUTawGrQ5aA53PXnNCVtvHt6Fk2eVpYvMH) | `store_secrets` on outlayer.testnet; accessor WasmHash(release), access And[Predecessor{Whitelist[contract]}, WasmHash] |
| 02:27 | attest | [B2VM5c9y…](https://testnet.near.rocks/tx/B2VM5c9yixFZT2eV4LAsHeJFQNWX48t8JVCPRwvK44gu) | enclave downloaded the artifact (sha256 `ad3eb4f5…`), decrypted it with K, build hash `b723c6d4…` matches → escrow_verified |
| 02:29 | lock | [EmH8toyF…](https://testnet.near.rocks/tx/EmH8toyFEpym4bc5o1Mh1zQGpUygUWXaKZpoGrszj3om) | DeleteKey: the contract account has 0 access keys from here on |
| 02:34 | buy (yuna, filmed) | [GPhminv2…](https://testnet.near.rocks/tx/GPhminv2idpSWgbVx3udNbQchgoGENb1QjVgwhsz53Kz) | token #1, 0.1 locked, 0.15 minus mint storage to the studio |
| 02:35 | buys (mira, kofi, dario) | [331bcFHB…](https://testnet.near.rocks/tx/331bcFHBwQRoZZgcaNLQJ4Q2qB6fu5RyBwyAxkJBBnGd) [HiMGKqLA…](https://testnet.near.rocks/tx/HiMGKqLAqcCdUK34Cp7tja6QZgAq7gNHQhPn89HN4QiW) [HBe1ydUQ…](https://testnet.near.rocks/tx/HBe1ydUQMTQUgjgHah6CEpGCMUWrgyEFf4xKiqA1PmXp) | tokens #2–4; pot 0.4 |
| 02:36 | probe (alive) | [FDhVT1jg…](https://testnet.near.rocks/tx/FDhVT1jgmL79ZS2e3HNiAMHeAQqW2aADn37yRJ9hkuyZ) | probe.wasm verified 4 holder-signed sessions on the official server |
| 02:44 | official server deleted | (Cloudflare, scripts/ops/kill-official.sh) | `/health` → 500; the open WebSocket dropped at 02:47:37 |
| 02:48 | probe → failure 1 | [7WJDcTBp…](https://testnet.near.rocks/tx/7WJDcTBpB3msb67ZTekEqQYez3faC1XDkLw9EmigeS81) | unreachable |
| 02:49 | probe → failure 2 | [5Ckj335e…](https://testnet.near.rocks/tx/5Ckj335e76ZfrUU3WLZEFqLNtq9TaLEU73GynmP34qWu) | unreachable |
| 02:51 | probe → inconclusive | [GJWMDYef…](https://testnet.near.rocks/tx/GJWMDYefkTpm3zQ4PCxQiztpLeqYRnuWhYcKL5hRHNGv) | OutLayer run timed out; not counted, as designed |
| 02:58 | probe → failure 3 → Dead | [8yjRPbsg…](https://testnet.near.rocks/tx/8yjRPbsgGFevZkGuFDgBXH1CytvUqQruCxiDngKZXDEm) | cause "probes" |
| 03:00 | release | [AxEXFj6G…](https://testnet.near.rocks/tx/AxEXFj6GxprNfPohgXoFMKMQnLVf439faQijq1kbMcfn) | release.wasm read status Dead, output K; sha256(K) = commitment; K public on-chain |
| 03:01 | refund (yuna, filmed) | [oRtXVocH…](https://testnet.near.rocks/tx/oRtXVocHDa1H8bhERcueex1L6gSwGfeeYGSs4PtEun9) | 0.1 back |
| 03:02 | pledge (mira, filmed), refund (dario), pledge (kofi) | [2yxCg4QA…](https://testnet.near.rocks/tx/2yxCg4QAuoAE7tB1gAubovuGujNdzTZSEqgBp1HzkdK6) [9wSxYP5r…](https://testnet.near.rocks/tx/9wSxYP5rP46RxDgUzwn6LEwxi8s6bz4rGJEqRbm5WGGK) [BAXoyi3h…](https://testnet.near.rocks/tx/BAXoyi3hyhM3XdETb7smwSzjPrcWjjzJq9zgCbP68iCh) | pool 0.2 |
| 03:03 | post-shutdown buy (fanhost, filmed) | [2dJNA1Ag…](https://testnet.near.rocks/tx/2dJNA1AgNWueowGmFJGCEmZYMifdQmbGpXv4uJhwfJsc) | token #5, pot share 0, pool 0.448 |
| 03:06 | register_host (local, tunnel) | [EZve8FLQ…](https://testnet.near.rocks/tx/EZve8FLQBbSyudVgfVbxZZkPaUXf6YZy1BygbjJc8uJh) | `pnpm host --local`: key ↔ commitment, artifact hash, decrypt, build hash, snapshot #7 restored |
| 03:19 | claim_epoch(8) | [tpW2JXZU…](https://testnet.near.rocks/tx/tpW2JXZUsddE346UuhrtYV9PB9HDLS1HRfaDVL7XrP1) | 3 holder sessions verified in the enclave → 0.03 paid |
| 03:22 | claim_epoch | [Fo3oehCC…](https://testnet.near.rocks/tx/Fo3oehCCG8GxrwLy696sp8GjKbrSfaxE6K3uf7AKHFF1) | second paid epoch (host earned 0.06 total) |
| 03:24 | register_host (persistent) | [8fqYhcQ8…](https://testnet.near.rocks/tx/8fqYhcQ85uzEvhX5S9ZzouKA3jNQvSp735Aqtv2kSB1a) | https://emberrift-community.pages.dev, the released build on Cloudflare, progress restored |

Observed and recorded honestly: the fan host's first claim attempts failed with INVALID_TRANSACTION because the host
account was down to 0.099 N after its post-shutdown purchase; after a 0.5 testnet N top-up from the studio account
([9aE28ja2…](https://testnet.near.rocks/tx/9aE28ja2MgZtcifHnKHxBgNTdKio5o9WgfoxRarrw1W5)) the next pass paid.
