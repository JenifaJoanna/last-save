# Last Save — demo brief (locked story: DEMO-STORY.md in the idea folder)

Audience: NEAR Hackathon judges (human + Claude Code / Codex screeners). Length: 2:30 at 1920x1080/30, plus a 45 s
vertical cut (kill → release → back in). Central claim, shown as mechanism: a game licence whose server is released by
an enclave when the studio stops serving players. Magic moment: the official server dies on camera, the contract flips,
the enclave releases the key, a fan hosts it, and the same players are back with the same levels.

Rules applied: narration states mechanisms, not claims; no UI mechanics narrated; every number comes from the live
contract config or the filmed run (whitelist below); real product footage for every product beat; motion graphics only
for the open, the escrow diagram and the close; sound = ElevenLabs VO + SFX + music (approved in the brief).

| t | SPEAK (demo/audio/vo) | SCREEN | Source / evidence |
|---|---|---|---|
| 0:00–0:12 | 01-open | Three verified quotes typed on black (Steam/The Crew 2024, BBC 2026, Game Developer 2025) | demo/SOURCES.md |
| 0:12–0:22 | 02-title | Ember Rift key art → Last Save mark, line "We killed our server. You still have the game." | web/public/art |
| 0:22–0:30 | 03-why | EU Commission reply headline card (16 Jun 2026) → store page Forever Guarantee checks + 10% resale royalty line | SOURCES.md; store capture |
| 0:30–0:42 | 04-buy | Store → buy → library shows licence #, 40% locked; explorer flash of the buy tx | final run tx |
| 0:42–0:52 | 05-promise | Escrow diagram (motion graphic) → explorer: contract with zero access keys | lock tx + access key list |
| 0:52–1:10 | (game audio) | 4-player live match on the official server; level badges, Emberwing skin; dashboard heartbeat beside it | capture |
| 1:10–1:22 | 06-kill | Official Worker deleted on camera → client shows CONNECTION LOST → dashboard probes 1/3, 2/3, 3/3 | probe txs |
| 1:22–1:40 | 07-release | Status flips to Dead → release → enclave receipt → key on-chain (explorer flash) | release tx |
| 1:40–1:55 | 08-choose | Two refunds, two pledges, a post-shutdown buy → pool + runway | choose txs |
| 1:55–2:10 | 09-host | Terminal: `pnpm host --local` → hash verified, decrypted, snapshot restored, public URL, register_host tx | host CLI output |
| 2:10–2:25 | 10-back | Players sign back in on the community host: same levels/skins; non-holder bounced; claim_epoch pays the host | claim tx |
| 2:25–2:35 | 11-close | Close card: line, NEAR + OutLayer marks, tracks, repo + live URL | — |

Number whitelist: 40% locked (fund_bps 4000), 10% royalty (royalty_bps 1000), price 0.25 testnet NEAR, three failed
probes (fail_threshold 3), 20-second probe spacing (demo instance), per-session pay 0.01, epoch cap 0.05, epoch 2 min,
and any count read off the filmed run's proof file.

Fallbacks: if OutLayer stalls during a take, keep the honest wait (edit dead time only) and retry; if the fan host's
tunnel fails, use the `--deploy` path to a pages.dev host.
