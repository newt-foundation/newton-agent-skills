#!/usr/bin/env bash
# Verify a live PolicyClient after deploy + setPolicies (+ optional owner transfer).
# Copy to script/verify-policy-client.sh. Never prints PRIVATE_KEY or RPC credentials.
#
# Required:
#   RPC_URL, POLICY_CLIENT
# Optional expected values (fail if they differ when set):
#   EXPECTED_POLICIES  comma-separated addresses in set order
#   EXPECTED_TASK_MANAGER, EXPECTED_OWNER
#
#   RPC_URL="$RPC_URL" POLICY_CLIENT=0x… \
#     EXPECTED_POLICIES=0xA,0xB ./script/verify-policy-client.sh

set -euo pipefail

if [[ -z "${RPC_URL:-}" || -z "${POLICY_CLIENT:-}" ]]; then
  echo "RPC_URL and POLICY_CLIENT are required" >&2
  exit 1
fi

snapshot="$(cast call "$POLICY_CLIENT" \
  "getPolicySetSnapshot()(bytes32,uint64,(address,(bytes,uint32))[])" \
  --rpc-url "$RPC_URL")"
policy_id="$(cast call "$POLICY_CLIENT" "getPolicyId()(bytes32)" --rpc-url "$RPC_URL")"
revision="$(cast call "$POLICY_CLIENT" "policyRevision()(uint64)" --rpc-url "$RPC_URL")"
owner="$(cast call "$POLICY_CLIENT" "getOwner()(address)" --rpc-url "$RPC_URL")"
task_manager="$(cast call "$POLICY_CLIENT" "getNewtonPolicyTaskManager()(address)" --rpc-url "$RPC_URL")"

echo "getPolicySetSnapshot=$snapshot"
echo "getPolicyId=$policy_id"
echo "policyRevision=$revision"
echo "getOwner=$owner"
echo "getNewtonPolicyTaskManager=$task_manager"

zero_id="0x0000000000000000000000000000000000000000000000000000000000000000"
if [[ "$(printf '%s' "$policy_id" | tr '[:upper:]' '[:lower:]')" == "$zero_id" || "$revision" == "0" ]]; then
  echo "policy set is unset; setPolicies has not been called" >&2
  exit 1
fi

fail=0
check() {
  local label="$1" actual="$2" expected="${3:-}"
  if [[ -n "$expected" ]]; then
    actual_lc="$(printf '%s' "$actual" | tr '[:upper:]' '[:lower:]')"
    expected_lc="$(printf '%s' "$expected" | tr '[:upper:]' '[:lower:]')"
    if [[ "$actual_lc" != "$expected_lc" ]]; then
      echo "$label mismatch: got $actual expected $expected" >&2
      fail=1
    fi
  fi
}

if [[ -n "${EXPECTED_POLICIES:-}" ]]; then
  snapshot_lc="$(printf '%s' "$snapshot" | tr '[:upper:]' '[:lower:]')"
  IFS=',' read -r -a expected_policies <<< "$EXPECTED_POLICIES"
  cursor=0
  for raw in "${expected_policies[@]}"; do
    addr="$(printf '%s' "$raw" | tr -d '[:space:]' | tr '[:upper:]' '[:lower:]')"
    [[ -z "$addr" ]] && continue
    rest="${snapshot_lc:$cursor}"
    pos="$(printf '%s' "$rest" | awk -v a="$addr" 'BEGIN{IGNORECASE=1} {print index($0, a)}')"
    if [[ "$pos" -eq 0 ]]; then
      echo "policy set missing $addr in order" >&2
      fail=1
      break
    fi
    cursor=$((cursor + pos + ${#addr} - 1))
  done
fi

check getNewtonPolicyTaskManager "$task_manager" "${EXPECTED_TASK_MANAGER:-}"
check getOwner "$owner" "${EXPECTED_OWNER:-}"

exit "$fail"
