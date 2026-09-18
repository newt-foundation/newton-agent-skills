// Stub WASM for local simulate only. Live operators run the published
// vaultsfyi PolicyData WASM. Do not deploy this file as PolicyData.

export function run(wasm_args) {
  const parsed =
    typeof wasm_args === "string" && wasm_args.length
      ? JSON.parse(wasm_args)
      : wasm_args && typeof wasm_args === "object"
        ? wasm_args
        : {};

  const last =
    parsed.lastKnownAllocationHash ?? parsed.previousAllocationHash ?? null;
  const allocationHash = "cafef00d";
  const changed = Boolean(last) && last !== allocationHash;
  const chainalysisArgs =
    parsed.chainalysis && typeof parsed.chainalysis === "object"
      ? parsed.chainalysis
      : parsed;
  const sanctioned =
    chainalysisArgs.sanctioned === true || parsed.fixture === "sanctioned";

  return JSON.stringify({
    vaultsfyi: {
      apy_z_score: 0,
      tvl_drawdown_24h_pct: 0,
      tvl_drawdown_7d_pct: 0,
      risk_score: 100,
      has_critical_flag: false,
      is_corrupted: false,
      allocation_hash: allocationHash,
      allocation_changed_since_last: changed,
    },
    chainalysis: {
      sanctioned,
      is_high_risk: false,
      risk_categories: [],
    },
  });
}
