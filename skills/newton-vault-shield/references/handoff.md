# Policy handoff in, Shield handoff out

## Consume `newton-policy` output

Read the policy handoff before calling `createShield`. Default path:
`<policy-dir>/dist/policy-handoff.json`. Schema:
[newton-policy/references/handoff.md](../../newton-policy/references/handoff.md).

Do **not** reconstruct chain ID, Policy / PolicyData addresses, pack ids,
entrypoint, or `functionSignature` from chat when this file exists.

| Handoff state | What this skill may do |
|---|---|
| Missing file | Load `newton-policy` first. Do not scrape GitHub for PolicyData |
| `policy` is `null` | Copy templates and typecheck. Do **not** live `createShield` |
| `policy` filled, `packs` / `policyData` present | `definePolicy().with(...)` for those pack ids; `policyAddress: policy` |
| `packs` absent (fresh oracle) | `policyFromAddress({ address: policy, chainId, env: 'prod' })`. Do not invent a pack module |

If `packs` is present, treat it as labels for the same positional
`policyData` array. Do not reorder either array. VaultKit matches declared
modules to on-chain `getPolicyData()` at `createShield`; a mismatch throws
before a vault action.

Install `@newton-xyz/policy-pack-<id>` for each pack id. If the npm package
does not exist, **stop** — do not vendor pack source from
`newton-policy-packs`.

`functionSignature` on a later `sendCall` must match the policy intent
byte-for-byte (named UTF-8 from `intent.json` when the policy was authored
for that action).

## Produce Shield output

After attach (and after allow/deny when requested), write
[templates/shield-handoff.json](../templates/shield-handoff.json) as
`shield-handoff.json` in the attach directory.

Never put private keys, RPC URLs, JWTs, pack API keys, or secrets JSON in
this file.

| Field | Required | Notes |
|---|---|---|
| `schemaVersion` | yes | `1` |
| `kind` | yes | `"newton-vault-shield-handoff"` |
| `chainId` | yes | Copy from the policy handoff |
| `environment` | no | User label (`"testnet"` / `"mainnet"`). Newton gateway env is still `prod` |
| `policyHandoff` | yes | Path of the file that was consumed |
| `vendor` | yes | `"morpho"` / `"euler"` / `"euler-vault"` / `"superform"` / `"sendCall"` |
| `vault` | yes | Existing vault address. Never invent |
| `shield` | after attach | `policyClientAddress`, else `null` |
| `policy` | after attach | Bound NewtonPolicy |
| `policyData` / `packs` | yes | Copy from the policy handoff; do not reorder |
| `role` | after grant | Vendor role name, whether granted, optional tx hash |
| `paramsSet` / `secretsUploaded` | after those calls | Booleans only; no secret payloads |
| `allow` | after typed allow | `action`, `transactionHash`, `taskId` |
| `deny` | after `assertIntentBlocked` | `action`, `blocked`, `taskId`, `reason`. No tx hash |

A later orchestrator (`newton-demo` or vault-demo) may copy `chainId`,
`vault`, `shield`, `vendor`, and `policy` from this file. Keep pack ids
here so it does not call `policy packs show` again.
