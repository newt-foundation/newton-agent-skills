# Policy handoff manifest

Write one machine-readable JSON file per Policy so `newton-policy-client`,
`newton-vault-shield`, and `newton-demo` can consume deploy + intent facts
without reconstructing them from chat.

Copy [templates/policy-handoff.json](../templates/policy-handoff.json) and fill
it. Default path: `<policy-dir>/dist/policy-handoff.json`.

A client policy set is 1–8 of these files, in evaluation order. This file
is one Policy, not the set.

## When to write

- After local simulate passes: write a **partial** file. `policy` stays
  `null`. Intent and entrypoint are filled. Leave `policyData` as `[]`.
- After `policy deploy -p`: fill `policy`. Copy `expireAfterBlocks` from
  `configs/deployment.toml` when the client should use that window. Copy
  `wasmCid` when the policy has an oracle; leave it `""` for pure Rego.

Never put private keys, RPC URLs, JWTs, or secrets JSON in this file.

## Fields

| Field | Required | Notes |
|---|---|---|
| `schemaVersion` | yes | `1` |
| `kind` | yes | `"newton-policy-handoff"` |
| `chainId` | yes | Numeric chain ID |
| `environment` | no | `"testnet"` / `"mainnet"` / user label |
| `policyDir` | yes | Path the next skill can open |
| `policy` | after deploy | This Policy's address, else `null` |
| `policyData` | yes | Always `[]`. Pre-0.7 PolicyData arrays are not a wiring input |
| `wasmCid` | when known | Oracle CID on this Policy, else `""` |
| `packs` | published pack | At most one `{ "id", "policy", "wasmCid" }` labeling this Policy |
| `entrypoint` | yes | e.g. `stablecoin_transfer.allow` |
| `expireAfterBlocks` | when known | Suggested `setPolicies` window for this spec; else `null` |
| `params.path` | yes | Usually `configs/params.json` |
| `params.schemaPath` | yes | Usually `params_schema.json` |
| `secretsRequired` | yes | `true` when `policy.js` calls `getSecrets()` |
| `secretsSchema` | if secrets | Path to `secrets_schema.json`, else `null` |
| `intent.to` | yes | Role (`"token"`) or a concrete address |
| `intent.value` | yes | Decimal string, usually `"0"` |
| `intent.functionSignature` | yes | Named UTF-8 ABI, same as scaffold `intent.json` |
| `intent.dataEncoding` | yes | Canonical ABI type string for `intent.data` |
| `intent.intentJsonPath` | yes | Path to the six-field simulate fixture |

`functionSignature` must be the named form
`function transfer(address recipient, uint256 amount)`, not
`function transfer(address,uint256)`.

One deployed policy:

```json
{
  "schemaVersion": 1,
  "kind": "newton-policy-handoff",
  "chainId": 84532,
  "environment": "testnet",
  "policy": null,
  "policyData": [],
  "wasmCid": "",
  "packs": [{ "id": "chainalysis", "policy": null, "wasmCid": "" }]
}
```

Replace `policy` with the address from `policy deploy` or from
`newton-cli policy packs show --format json`. Do not invent it. A second
rule is a second file, not a second PolicyData address in this one.

## After writing

Report the file path in the completion report. For a set, report the paths
in evaluation order. Hand off to `newton-policy-client` (Solidity you
control), `newton-vault-shield` (Morpho / Euler / Superform attach), and
`newton-demo` when a UI is in scope. Do not re-list the same facts as the
source of truth.
