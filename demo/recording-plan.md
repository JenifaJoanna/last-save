# Recording plan — the filmed run on the locked judge instance

All UI captures: agent-browser `record start <file>.mp4 --cursor` at a 1920x1080 viewport, 30 fps, on a local build of
the platform (`web`, test-account signer, localhost only) and the game client (`game/client`, `?server=` the real
deployed host). The URL bar is never in frame. Every transaction is on NEAR testnet against `lastsave-licence.testnet`
after it is locked. Terminal: asciinema recording of the real command, replayed by demo/capture/term.html and recorded.
Raw captures in demo/film/public/footage/raw/ (gitignored), cut files in demo/film/public/footage/.

## Reset and launch (not filmed)
1. `RESET=yes node scripts/launch/reset-dev.mjs` (dev instance wiped)
2. `node scripts/launch/launch.mjs bundle mirrors` → commit + push `artifacts/`, `./scripts/deploy-web.sh`
3. `node scripts/launch/launch.mjs deploy escrow attest official` (attest must show escrow_verified)
4. `LOCK=yes node scripts/launch/launch.mjs lock` → access keys 0
5. Warm-up (not filmed): bots play 3 matches on the official server so players have levels (Emberwing at level 3).

## Takes, in story order
| Take | Steps | Proof captured |
|---|---|---|
| store | /app/store signed in as yuna (no licence yet): guarantee checks all green, price, split bar | contract state |
| buy | click Buy → toast → library card (#n, 0.1 locked) ; then nearblocks tx page 2 s | buy tx |
| keys | /judges "Access keys on contract: 0" → nearblocks keys tab | lock tx |
| match | game client as mira + 3 bots on emberrift.pages.dev, 25 s of play; second capture: /status heartbeat | snapshot tx |
| kill | terminal: `wrangler delete` of emberrift-arena (asciinema) ; game client shows CONNECTION LOST | — |
| release | /status: Run a probe ×3 (spaced ≥ 20 s), failures 1/3 → 3/3, status flips Dead; Release the server → key released | probe + release txs |
| choose | /app/afterlife as yuna: Refund; as mira: Pledge; dario refund + kofi pledge scripted; fanhost post-shutdown buy | choose txs |
| host | asciinema of `pnpm host --local --account lastsave-fanhost.testnet` → tunnel URL, register_host | register tx |
| back | game client `?server=<tunnel>` as mira: same level/skin ; non-holder bounced ; /app/hosts claim epoch → paid | claim tx |

Dead time (OutLayer runs, epoch waits) is cut; causality is kept: trigger → wait → result → proof, in order.
