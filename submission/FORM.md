# NEAR Hackathon submission form — drafts (the submitter presses Submit)

Form: one submission at nearhackathon.com (or POST /api/applications). One project, both tracks ticked.

| Field | Draft value | Who |
|---|---|---|
| projectName | Last Save | agent |
| tracks | `nfts` (NFTs That Do Something), `games` (Games With Real Economies) | agent |
| projectUrl | https://github.com/JenifaJoanna/last-save | agent |
| demoUrl | the public X post URL, after the submitter posts it (draft in X-POST.md) | submitter posts, agent fills |
| idea | below (about 1,850 chars, limit 2,000) | agent |
| leadName | **left empty — declaration, the submitter fills** | submitter |
| email | **left empty — declaration, the submitter fills** | submitter |
| size | **left empty — declaration, the submitter fills** | submitter |
| nearAddress (mainnet payout) | **left empty — declaration, the submitter fills** | submitter |
| consent | **left unticked — declaration, the submitter ticks** | submitter |

## idea
Last Save is a game licence on NEAR that outlives its publisher. Each licence is an NFT; 40% of every sale stays locked in
the contract for its holder. Before launch the studio's server build is built in GitHub CI, logged in Sigstore, stored on
Walrus and encrypted; its key is an OutLayer secret only the licence contract can read, through one hash-pinned release
program. Instances come from a NEP-591 global contract through a factory: any studio launches in one transaction, born
locked, with no access keys, so nobody can swap the escrow.

Players, not the studio, prove liveness: OutLayer probes look for sessions signed by licence holders on the official
server (NEP-413 login). Failed probes spaced in time, a quorum of holder reports, or the studio's own end-of-service flips
the contract to Dead; then anyone can trigger the release and the enclave puts the key on-chain.

After death each holder takes a refund or pledges their share to a keep-alive pool; post-shutdown sales add 90% of their
price to it. A fan runs one command (or one Deploy button) that fetches the build from any mirror, checks its hash and
provenance, decrypts it, restores the last on-chain progress snapshot and hosts it. Hosts are paid per verified holder
session in NEAR, or on Base Sepolia through NEAR Chain Signatures from the contract's own MPC-derived address. Holder
actions are gas-free: NEP-366 delegates through a relayer, signed by a key the player's own wallet approved via NEAR
Connect. Demo game: Ember Rift, a real-time 2–8 player arena. Live on NEAR testnet; every transaction is linked in the repo.
On the judge instance the holders declared the studio gone; its key release is still pending, because the enclave's
public-RPC reads were rate-limited on the deadline night. The released afterlife (key, fan host, Base payout) is shown on
the dev instance, which runs the same code.
