# PolicyClient handoff manifests

## Consume `newton-policy` output

Read the policy handoff file before writing Solidity or sending txs. Default
path: `<policy-dir>/dist/policy-handoff.json`. Schema:
[newton-policy/references/handoff.md](../../newton-policy/references/handoff.md).

Do **not** reconstruct chain ID, Policy / PolicyData addresses, entrypoint,
params path, or `functionSignature` from chat when this file exists. If it is
partial (addresses `null`), implement and test locally; stop before live
`setPolicy` until `newton-policy` fills them.

Match `intent.functionSignature` byte-for-byte in the client. Named vs unnamed
parameter lists are different strings.

## Produce client output

After tests (and after live wiring when requested), write
[templates/client-handoff.json](../templates/client-handoff.json) to the
Foundry project root as `client-handoff.json`.

Never put private keys, RPC URLs, JWTs, or secrets JSON in this file.

| Field | Required | Notes |
|---|---|---|
| `schemaVersion` | yes | `1` |
| `kind` | yes | `"newton-policy-client-handoff"` |
| `chainId` / `environment` | yes / no | Copy from the policy handoff |
| `policyHandoff` | yes | Path of the file that was consumed |
| `policyClient` | after deploy | Client address, else `null` |
| `protectedFunction` | yes | Solidity entrypoint that validates then executes |
| `userArgs` | yes for UI | Application args before `Task` / `TaskResponse` / `signatureData` |
| `target` | when known | Concrete `intent.to` address (token or other); else `null` |
| `needsTokenApproval` | yes for UI | `true` when the connected wallet must `approve` the client |
| `eip712` | yes for UI | Fallback domain `name` / `version` if `eip712Domain()` reverts |
| `intent` | yes | Same encoding as the policy handoff |
| `policy` / `policyId` / `taskManager` / `owner` | after wiring | From getters |
| `ownerIsLoginWallet` | after wiring | `true` only after verified `setPolicyClientOwner` |
| `registered` | after wiring | Whether `registerClient` ran |
| `policyClientRegistry` | if registered | Registry address, else `null` |

`newton-policy` secrets upload needs `policyClient`, `policyData` from the
policy handoff, and `ownerIsLoginWallet: true`. If owner is still the local
key, do not hand off to secrets upload.

`newton-demo` copies `chainId`, `policyClient`, `userArgs`, `target`,
`needsTokenApproval`, `eip712`, and `intent` into `demo-config.json`. Keep
`functionSignature` in the named UTF-8 form. Never put keys or RPC URLs in
this file.
