# v2 end-to-end run on v2dev.lastsave-factory.testnet

Report: `proof/run-v2dev-20261114T0857Z.json`. Started 2026-11-14T08:57:46.674Z, finished 2026-11-14T09:56:00.228Z. Gas-free relayer mode: true.
Totals: 173 assertions passed, 1 failed; 15 phases passed, 1 failed.

| Phase | Result | Assertions | Failed assertions |
|---|---|---|---|
| preflight | passed | 9/9 | none |
| relayer-guards | passed | 8/8 | none |
| factory | passed | 6/6 | none |
| buy | passed | 15/15 | none |
| play | passed | 13/13 | none |
| probe-alive | passed | 7/7 | none |
| report | passed | 8/8 | none |
| kill | passed | 1/1 | none |
| death | passed | 7/7 | none |
| release | passed | 7/7 | none |
| choose | passed | 26/26 | none |
| post-death-buy | passed | 9/9 | none |
| host | passed | 9/9 | none |
| claim | passed | 7/7 | none |
| evm-payout | failed | 39/40 | the payer paid value_wei plus gas, nothing else |
| evm-payout-recheck | passed | 2/2 | none |

## Transactions

| Phase | Label | Link |
|---|---|---|
| buy | buy_licence lastsave-mira.testnet | https://testnet.nearblocks.io/txns/DWK7tXYg4X1i5TRhDNekuFVD8aAgUN3JgpyU2o8QqDQ7 |
| buy | buy_licence lastsave-kofi.testnet | https://testnet.nearblocks.io/txns/Dyf6W5XMKBzW2mBeQFnJEWxM2hojv7hfH1zt3SFvnSFQ |
| buy | buy_licence lastsave-yuna.testnet | https://testnet.nearblocks.io/txns/5waq17UsAWN8c3XPUYGwyFLNcnCstKMdZiK7yfvcP6pB |
| buy | buy_licence lastsave-dario.testnet | https://testnet.nearblocks.io/txns/5T9RaQKvs2B3fMxf2RFCDGJxaj9LccCusULNd8eL9LH8 |
| probe-alive | probe_official #1 (gas-free) | https://testnet.nearblocks.io/txns/3MWVsW7Hq8HFPxyr8fdvoi2hCmdgXNuExDJmCnskr7FS |
| report | report_down lastsave-mira.testnet | https://testnet.nearblocks.io/txns/EzkXnw7m26Pv6aeiYLEM4wf6GVZpTkzVQb6KhKLNVxUc |
| report | report_down again lastsave-mira.testnet (refused) | https://testnet.nearblocks.io/txns/6Qz8RYrnbuZqtHiuP7afLRzkBTU7dNnW7uQwJS4q88Cj |
| death | probe_official r1 #1 (gas-free) | https://testnet.nearblocks.io/txns/J5iyiRkvuNCMLnh9QSW78V2sHQ7ZwB3tPa6ydVnUk9Fa |
| death | probe_official r2 #1 (gas-free) | https://testnet.nearblocks.io/txns/6gim2dfJM9zZNCEC214FZpzJsJUYQgGEanKQ6i7f5o6K |
| death | probe_official r3 #1 (gas-free) | https://testnet.nearblocks.io/txns/13LRSaUHm81qH1Wa3aKbbM4sXdaYjVeF9CFtCu8kCFtL |
| release | release #1 (gas-free) | https://testnet.nearblocks.io/txns/ju7Suoea5F8A2yinTfRrYwkbnp7kWbKWAeVqx4DWezR |
| choose | choose Refund lastsave-yuna.testnet | https://testnet.nearblocks.io/txns/14aMWkgDhb3e6RybLidLQ9X2UG29EbCHH8WdGHmbtGFG |
| choose | choose Refund lastsave-dario.testnet | https://testnet.nearblocks.io/txns/4P14vEncvMNJwbGxmn8Dg34qq3KjmYQAvurEvUJ8QN9x |
| choose | choose Pledge lastsave-mira.testnet | https://testnet.nearblocks.io/txns/6fbFXUduqQWECbR9VseUAK9f3LwjFXMtuvYCpyQmEkVC |
| choose | choose Pledge lastsave-kofi.testnet | https://testnet.nearblocks.io/txns/239XVX2fkA96jpGLgd1xpa9dtzaXuggGm8dix86E217b |
| choose | choose again lastsave-mira.testnet (refused) | https://testnet.nearblocks.io/txns/8cLny67JuTPBgHmgJ8USxZoNtKaAf49ftAkQgFDEqyLV |
| choose | choose again lastsave-yuna.testnet (refused) | https://testnet.nearblocks.io/txns/2TVWuLdHKHWnEftfgSt4csCtykQJbLLa3itop1JWsCyC |
| post-death-buy | buy_licence lastsave-fanhost.testnet | https://testnet.nearblocks.io/txns/HszrLpFGCYgVkoY9dfF3jVSJhHArq31wPU8hsFNDquWx |
| post-death-buy | choose (must be refused) (refused) | https://testnet.nearblocks.io/txns/9Mvz2AH68rgrMiiZDJxzBzwsGzTMjzyHN2ch2dqDtyag |
| host | register_host | https://testnet.nearblocks.io/txns/GgoAPAcHdNXFrdoEnv7QkifKi5iXvZsZ5seYkYC4j6oW |
| host | create throwaway e2e-nl-mwg7fc6x.lastsave-fanhost.testnet | https://testnet.nearblocks.io/txns/CzRjx4Y5RPMxH9T8bzxs46bvnYT8GVv6Gtzs9uT5kGrY |
| host | delete throwaway e2e-nl-mwg7fc6x.lastsave-fanhost.testnet | https://testnet.nearblocks.io/txns/E2eWm7zEdD8i8crCw1AiqQnDzwNLUX4MTzqYuc7shsHP |
| claim | claim_epoch 10 #1 | https://testnet.nearblocks.io/txns/cwucJfkGEZH4ZSZgUZenFkG17JXp2A6x3Avuum7iAx7 |
| claim | claim_epoch 10 again (refused) | https://testnet.nearblocks.io/txns/8mF8CPsiyMwopTcqPxPVMapAmFZKbrkdum8wFCjKq5pY |
| evm-payout | set_payout_evm (gas-free) | https://testnet.nearblocks.io/txns/4SMyfs7t7bAzcNgRSdGReaKvxhmzmS4FEVKvt5zfGuhD |
| evm-payout | set_payout_evm with a malformed address (must be refused) (refused) | https://testnet.nearblocks.io/txns/7bzn8WJQ2VUkeGRBQLg8PPYGMZiApqr5Xhc98yV8ZjsL |
| evm-payout | claim_epoch 11 (EVM rail) #1 (gas-free) | https://testnet.nearblocks.io/txns/2P1eiUqXeDRm3KEBjJJRDwkGYEk7mxoRVmVvW3aftcVL |
| evm-payout | sign_evm_payout #1 (gas-free) | https://testnet.nearblocks.io/txns/4VkUpQJkRB4HruwFW3X1ot1vXebB5i5pZCezviN45vgE |
| evm-payout | bump_evm_payout #1 (gas-free) | https://testnet.nearblocks.io/txns/4rWMQp2ubNw4w33uzRhZmP5EKHzKQ16oQSwLXyRGMN9Z |
| evm-payout | Base Sepolia payout | https://sepolia.basescan.org/tx/0x7351064ac55d55fb81d42419451667fcca35d49e18286385e26b4eb78d52e8eb |

## Balances (NEAR)

| Account | Start | End |
|---|---|---|
| lastsave-mira.testnet | 0.7333 N | 0.4831 N |
| lastsave-kofi.testnet | 0.7370 N | 0.4867 N |
| lastsave-yuna.testnet | 0.7347 N | 0.5844 N |
| lastsave-dario.testnet | 0.7484 N | 0.5981 N |
| lastsave-fanhost.testnet | 0.9533 N | 0.3932 N |

Failed assertions in full:

- evm-payout: the payer paid value_wei plus gas, nothing else (0.000040131250000092 ETH = 0.00004 + gas 0.00000013125)

## Base Sepolia payout (Chain Signatures)

- Payer (MPC-derived, contract-controlled): 0xfe8a6a6a417e3ccc4d73191c62361207dfe01aea. Host EVM address: 0xfc2c2fe195675cc0f3852eb2813d6877d54026a3 (key in local/evm/fanhost.key, not committed).
- Payout #0, epoch 11, 4 verified sessions, 0.00004 ETH (40000000000000 wei), nonce 0, debited 0.04 N from the pool into evm_settled.
- sign_evm_payout then bump_evm_payout (same nonce, fee 1.0 to 1.25 gwei, both gas-free through the relayer); the newest version was broadcast with scripts/chainsig/relay.mjs.
- Transaction: https://sepolia.basescan.org/tx/0x7351064ac55d55fb81d42419451667fcca35d49e18286385e26b4eb78d52e8eb (block 58635246, success). The host's EVM balance rose by exactly 40000000000000 wei; the superseded first version has no receipt.

## Notes

- The one failed assertion is my own check: it left out Base's L1 data fee. The evm-payout-recheck phase redoes it from the receipt (value + execution gas + l1Fee equals the payer's loss to the wei).
- A resumed run (phase host, then m) was needed after a DNS outage killed the first host start (the earlier attempt is kept under `superseded`). A second evm-payout run (epochs 12 and 13) found no verified sessions on the restarted host and was stopped; it is kept under `aborted_reruns`. Its extra claim attempts cost the ops budget about 0.1 N and the host about 0.05 N.
- Gas-free coverage: report_down, probe_official (alive and 3 death probes), release, choose (2 refunds, 2 pledges), set_payout_evm, sign_evm_payout, bump_evm_payout, claim_epoch (a gas-free claim is allowed once per host and epoch; retries used a 0.02 N deposit). Relayer refusals: disallowed methods, receiver, 0.01 N and 1 yocto deposits, bad signature, expired delegate.
- Not covered: bump of a payout that was already broadcast and stuck (the first version never went out); relayer rate limiting; creating a second factory instance (left for the filming).
- The v1 phases ran on v2dev with the existing harness; the kill phase deleted Worker emberrift-v2dev-arena as planned.

## NEAR spend this run (N)

mira 0.2502, kofi 0.2503, yuna 0.1503, dario 0.1503 (each still holds at least 0.48), fanhost 0.2476 (includes a 0.25 licence, 0.04 earned), studio net -0.1581 despite receiving about 0.59 from the licence sales, so another session moved studio funds in the same window (this run sent nothing from the studio), relayer account 0.0183 (gas for relayed calls).
