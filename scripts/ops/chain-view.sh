#!/usr/bin/env bash
# Film helper for the explorer beats: reads the chain straight from PUBLIC RPCs (no explorer site, no app), printing the
# exact command as a gold "$ " prompt line first. Each recipe is one read; nothing is signed or sent.
#   bash scripts/ops/chain-view.sh <keys|account|tx|evm-tx> <arg> [sender]
set -euo pipefail
NEAR_RPC="https://rpc.testnet.near.org"
BASE_RPC="https://sepolia.base.org"
show() { printf '\033[1;38;2;255;201;74m$ %s\033[0m\n' "$1"; bash -c "$1"; }
case "${1:-}" in
  keys)     # access keys on an account (a locked licence instance has none)
    show "curl -s $NEAR_RPC -H 'content-type: application/json' -d '{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"query\",\"params\":{\"request_type\":\"view_access_key_list\",\"finality\":\"final\",\"account_id\":\"$2\"}}' | jq '{account: \"$2\", keys: .result.keys}'" ;;
  account)  # code hash of an account (a factory instance runs the global contract)
    show "curl -s $NEAR_RPC -H 'content-type: application/json' -d '{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"query\",\"params\":{\"request_type\":\"view_account\",\"finality\":\"final\",\"account_id\":\"$2\"}}' | jq '{account: \"$2\", global_contract_hash: .result.global_contract_hash, code_hash: .result.code_hash, block_height: .result.block_height}'" ;;
  tx)       # one transaction: who signed, what it called, and its final status
    show "curl -s $NEAR_RPC -H 'content-type: application/json' -d '{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"EXPERIMENTAL_tx_status\",\"params\":{\"tx_hash\":\"$2\",\"sender_account_id\":\"$3\",\"wait_until\":\"FINAL\"}}' | jq '{tx: .result.transaction.hash, signer: .result.transaction.signer_id, receiver: .result.transaction.receiver_id, calls: [.result.transaction.actions[] | (.FunctionCall // .Delegate.delegate_action.actions[0].FunctionCall // .) | {method: .method_name, deposit}] , status: (.result.status | keys[0])}'" ;;
  evm-tx)   # a Base Sepolia transaction receipt (status 0x1 = success)
    show "curl -s $BASE_RPC -H 'content-type: application/json' -d '{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"eth_getTransactionReceipt\",\"params\":[\"$2\"]}' | jq '{tx: .result.transactionHash, from: .result.from, to: .result.to, block: .result.blockNumber, status: .result.status}'" ;;
  *) echo "usage: chain-view.sh <keys|account|tx|evm-tx> <arg> [sender]" >&2; exit 2 ;;
esac
