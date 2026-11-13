# NEAR Hackathon submission form — drafts (the submitter presses Submit)

Form: one submission at nearhackathon.com (or POST /api/applications). One project, both tracks ticked.

| Field | Draft value | Who |
|---|---|---|
| projectName | Last Save | agent |
| tracks | `nfts` (NFTs That Do Something), `games` (Games With Real Economies) | agent |
| projectUrl | https://github.com/JenifaJoanna/last-save | agent |
| demoUrl | the public X post URL, after the submitter posts it (draft in X-POST.md) | submitter posts, agent fills |
| idea | below (1,4xx chars, limit 2,000) | agent |
| leadName | **left empty — declaration, the submitter fills** | submitter |
| email | **left empty — declaration, the submitter fills** | submitter |
| size | **left empty — declaration, the submitter fills** | submitter |
| nearAddress (mainnet payout) | **left empty — declaration, the submitter fills** | submitter |
| consent | **left unticked — declaration, the submitter ticks** | submitter |

## idea
Last Save is a game licence on NEAR that outlives its publisher. Each licence is an NFT; 40% of every sale stays locked
in the contract for the holder. The studio's server build is encrypted and its key is stored as an OutLayer secret
owned by the licence contract, readable only by requests the contract makes and only by one exact, reproducibly built
release program. No keys remain on the contract, so nobody can delete or swap the escrow.

Liveness is proven by players, not by the studio: anyone can trigger an OutLayer probe that must find sessions signed by
licence holders on the official server (NEP-413 login plus per-session receipts). Failed probes spaced in time, a quorum
of holder reports, or the studio's own end-of-service flips the contract to Dead. Anyone can then trigger release: the
enclave re-reads the contract, confirms it is Dead and returns the key on-chain.

After death each holder takes a refund or pledges their share to a keep-alive pool; post-shutdown sales fund it too. A fan
runs one command to download the released build, verify it against the hash committed at launch, decrypt it, restore the
last on-chain progress snapshot and host it. Hosts are paid per verified holder session, and studios earn NEP-199
royalties on resale. Demo title: Ember Rift, a real-time 2–8 player arena game with levels and an unlockable skin. Live on
NEAR testnet with reproducible builds and every transaction linked in the repo.
