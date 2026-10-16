# Direct attestation

## API

```solidity
function _validateAttestationDirect(
    INewtonProverTaskManager.Task calldata task,
    INewtonProverTaskManager.TaskResponse calldata taskResponse,
    bytes calldata signatureData
) internal returns (bool);
```

`signatureData` is ABI-encoded operator signature material
(`NonSignerStakesAndSignature` on source chains, `BN254Certificate` on
destination chains). Do not invent this encoding; use the bytes returned by the
gateway/operator path.

Protected entrypoints take `task`, `taskResponse`, and `signatureData` as
calldata. Read the intent from `taskResponse.intent` (it must match
`task.intent`).

## Direct versus standard validation

| | `_validateAttestation` | `_validateAttestationDirect` |
|---|---|---|
| Prerequisite | Aggregator already called `respondToTask` | Task created; response + signatures in calldata |
| Gas | Lower | Higher (on-chain BLS/certificate verify) |
| Inputs | `Attestation` | `Task` + `TaskResponse` + `signatureData` |
| Demo default | No | Yes |

## Evaluation result

`taskResponse.allowed` is the set verdict. It is true only when every policy
in the frozen set allowed. One deny makes `allowed` false.

The mixin returns the TaskManager's boolean. Revert when validation fails:

```solidity
require(
    _validateAttestationDirect(task, taskResponse, signatureData),
    PolicyDenied()
);
```

Denied responses are still marked spent inside the call; a revert undoes that
marker. Replay of the same `taskId` after a successful allow reverts with
`AttestationAlreadySpent`.

## Expiration

The task freezes `policies`, `policyRevision`, and `policyId` at admission.
Submit that snapshot unchanged. `wasmArgs` has one entry per policy, in set
order. A pure-Rego policy still has an empty entry.

Direct-path expiration follows each spec's `expireAfter` (blocks). Stale
responses also fail the task response window (`TaskResponseTooLate`) when
`taskCreatedBlock` is too old.

## Policy ID mismatch

If `taskResponse.policyId` is not this client's current `getPolicyId()`, the
mixin reverts `Unauthorized("Policy ID does not match")`. That usually means
`setPolicies` was skipped, the set was replaced after the task was created,
or the task was created against a different client. Read
`getPolicySetSnapshot()` and request a fresh evaluation after a replacement.

## Wrong sender / chain

- Other callers cannot spend a user's attestation (`intent.from == msg.sender`)
- Attestations are not portable across chains (`intent.chainId == block.chainid`)
