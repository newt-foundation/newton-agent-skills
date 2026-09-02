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

The TaskManager interprets `taskResponse.evaluationResult` as allow/deny
(`TaskLib.evaluateResult`). Typical allow encodings are ABI `true` or the
string `"true"`. Anything else is deny.

The mixin returns that boolean. Revert on `false`:

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

Direct-path expiration is `block.number + policyConfig.expireAfter` at
validation time. Stale responses also fail the task response window
(`TaskResponseTooLate`) when `taskCreatedBlock` is too old.

## Policy ID mismatch

If `taskResponse.policyId` is not this client's current `getPolicyId()`, the
mixin reverts `Unauthorized("Policy ID does not match")`. That usually means
`setPolicy` was skipped or the task was created against a different
client/policy.

## Wrong sender / chain

- Other callers cannot spend a user's attestation (`intent.from == msg.sender`)
- Attestations are not portable across chains (`intent.chainId == block.chainid`)
