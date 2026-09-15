# Policy handoff manifest

Write a machine-readable JSON file so `newton-policy-client` and
`newton-demo` can consume deploy + intent facts without reconstructing them
from chat.

Copy [templates/policy-handoff.json](../templates/policy-handoff.json) and fill
it. Default path: `<policy-dir>/dist/policy-handoff.json`.

## When to write

- After local simulate passes: write a **partial** file. `policy` stays
  `null`. Intent and entrypoint are filled.
  - **Fresh oracle:** leave `policyData` empty (`[]`) until deploy.
  - **Published packs / composite:** fill `policyData` and `packs` now from
    `newton-cli policy packs show --format json`. Those PolicyData contracts
    already exist; do not wait for `policy deploy` and do not copy addresses
    from chat or GitHub.
- After `policy deploy -p`: fill `policy`. For a fresh oracle, also fill
  `policyData` in on-chain order. Copy `expireAfterBlocks` from
  `configs/deployment.toml` when set.

Never put private keys, RPC URLs, JWTs, or secrets JSON in this file.

## Fields

| Field | Required | Notes |
|---|---|---|
| `schemaVersion` | yes | `1` |
| `kind` | yes | `"newton-policy-handoff"` |
| `chainId` | yes | Numeric chain ID |
| `environment` | no | `"testnet"` / `"mainnet"` / user label |
| `policyDir` | yes | Path the next skill can open |
| `policy` | after deploy | Policy address, else `null` |
| `policyData` | after lookup or deploy | Array of PolicyData addresses, positional. Same order as `INewtonPolicy.getPolicyData()` and `packs[]` |
| `packs` | published packs | `[{ "id", "policyData", "wasmCid" }, …]` in that same order. Labels only; `policyData` array is the source of truth for wiring |
| `entrypoint` | yes | e.g. `stablecoin_transfer.allow` |
| `expireAfterBlocks` | when known | PolicyData expiration; else `null` |
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

Published composite example (`packs` optional; `policyData` required and
positional):

```json
{
  "schemaVersion": 1,
  "kind": "newton-policy-handoff",
  "chainId": 84532,
  "environment": "testnet",
  "policy": null,
  "policyData": ["0xVAULTSFYI", "0xCHAINALYSIS"],
  "packs": [
    { "id": "vaultsfyi", "policyData": "0xVAULTSFYI", "wasmCid": "bafy..." },
    { "id": "chainalysis", "policyData": "0xCHAINALYSIS", "wasmCid": "bafy..." }
  ]
}
```

Replace the `0x…` / CID placeholders with values from
`newton-cli --chain-id 84532 policy packs show --pack <id> --format json`.
Do not invent them.

## After writing

Report the file path in the completion report. Hand off to
`newton-policy-client` (and `newton-demo` when a UI is in scope) with that
path; do not re-list the same facts as the source of truth.
