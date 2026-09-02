#!/usr/bin/env bash
# Verify a live PolicyClient after deploy + setPolicy (+ optional owner transfer).
# Copy to script/verify-policy-client.sh. Never prints PRIVATE_KEY or RPC credentials.
#
# Required:
#   RPC_URL, POLICY_CLIENT
# Optional expected values (fail if they differ when set):
#   EXPECTED_POLICY, EXPECTED_TASK_MANAGER, EXPECTED_OWNER
#
#   RPC_URL="$RPC_URL" POLICY_CLIENT=0x… ./script/verify-policy-client.sh

set -euo pipefail

if [[ -z "${RPC_URL:-}" || -z "${POLICY_CLIENT:-}" ]]; then
  echo "RPC_URL and POLICY_CLIENT are required" >&2
  exit 1
fi

policy="$(cast call "$POLICY_CLIENT" "getPolicyAddress()(address)" --rpc-url "$RPC_URL")"
policy_id="$(cast call "$POLICY_CLIENT" "getPolicyId()(bytes32)" --rpc-url "$RPC_URL")"
owner="$(cast call "$POLICY_CLIENT" "getOwner()(address)" --rpc-url "$RPC_URL")"
task_manager="$(cast call "$POLICY_CLIENT" "getNewtonPolicyTaskManager()(address)" --rpc-url "$RPC_URL")"

echo "getPolicyAddress=$policy"
echo "getPolicyId=$policy_id"
echo "getOwner=$owner"
echo "getNewtonPolicyTaskManager=$task_manager"

zero_id="0x0000000000000000000000000000000000000000000000000000000000000000"
if [[ "$policy_id" == "$zero_id" ]]; then
  echo "getPolicyId is zero; setPolicy has not been called" >&2
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

check getPolicyAddress "$policy" "${EXPECTED_POLICY:-}"
check getNewtonPolicyTaskManager "$task_manager" "${EXPECTED_TASK_MANAGER:-}"
check getOwner "$owner" "${EXPECTED_OWNER:-}"

exit "$fail"
