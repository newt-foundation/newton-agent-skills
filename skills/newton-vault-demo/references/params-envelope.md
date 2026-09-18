# VaultKit params envelope

VaultKit `setParams({ vaultsfyi: { ...inner } })` does **not** store the
inner object as Policy params. It writes an NPM1 composite envelope:

```json
{
  "_manifest": { "magic": "NPM1", "version": 1 },
  "modules": [
    { "id": "vaultsfyi", "policyDataAddress": "0x…", "wasmCid": "bafy…" }
  ],
  "params": {
    "vaultsfyi": {
      "apy_z_max": 1000000,
      "tvl_drawdown_24h_max_pct": 100,
      "tvl_drawdown_7d_max_pct": 100,
      "risk_score_floor": 0,
      "deny_on_allocation_change": true,
      "deny_on_critical_flag": false,
      "deny_on_corrupted": false
    }
  }
}
```

The AVS validates live params against the **custom Policy**
`params_schema.json`. A schema that only allows `{ "vaultsfyi": {…} }`
or the pack's flat fields fails evaluate with missing property
`vaultsfyi` or `apy_z_max`. `modules` items are objects
(`id`, `policyDataAddress`, `wasmCid`), not CID strings. Arrays must
include `items` (AVS parse error otherwise: `missing field items`).

## What to copy

From [templates/policy/](../templates/policy/):

| File | Into the policy dir |
|---|---|
| `params-schema.envelope.json` | `params_schema.json` |
| `params.envelope.json` | `configs/params.json` |
| `policy.rego` | `policy.rego` |
| `policy.js` | stub WASM for **local simulate only** — never deploy as PolicyData |
| `wasm_args.allow.json` / `wasm_args.deny.json` | `configs/` |
| `intent.vaultkit.json` | `configs/intent.json` |

Tighten inner thresholds only when the brief says so. Generous APY/TVL
ceilings keep `deny_on_allocation_change` as the vaultsfyi-only demo
gate. When the brief is two-allocator, add a `chainalysis` slice
(`deny_on_sanctioned: true`, `deny_on_high_risk_category: false`,
`risk_categories_blocklist: []`) and set `deny_on_allocation_change` to
`false` so identity is the gate.

## Rego

Read the inner object from the envelope, with a fallback so a flat local
fixture still simulates:

```rego
t := object.get(object.get(data.params, "params", {}), "vaultsfyi", object.get(data.params, "vaultsfyi", data.params))
v := object.get(data.wasm, "vaultsfyi", data.wasm)
```

Do not assume `data.params.vaultsfyi` on the live path.

`newton-policy` published-pack docs that show `data.params.vaultsfyi` are
correct for CLI-authored params **without** VaultKit. VaultKit consumers
must use the envelope.

## Local simulate vs live

`policy simulate -p` runs the stub `policy.js`, not the published pack
WASM. Drive allow vs deny with wasm_args:

- vaultsfyi-only allow: omit `lastKnownAllocationHash` or match the stub hash
- vaultsfyi-only deny: `"deadbeef"` → `allocation_changed`
- two-allocator allow: stub `chainalysis.sanctioned = false`
- two-allocator deny: stub `chainalysis.sanctioned = true` →
  `chainalysis_sanctioned`

After envelope schema + params, simulate again before the live Policy
deploy. A Policy already deployed with a wrong schema cannot be patched
in place for this demo — deploy a new Policy and a new Shield version.
