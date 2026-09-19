# Allow, deny, and testnet traps

Confirm before the mined allow. Deny uses `assertIntentBlocked` and must
**not** mine a transaction.

## Typed allow

After role grant + `setParams` + `uploadSecrets`:

```typescript
const result = await shield.morpho.reallocate(vault, allocations, {
  prepareQueryOptions: {
    vaultsfyi: { previousAllocationHash: previousHash },
  },
})

await publicClient.waitForTransactionReceipt({
  hash: result.transactionHash,
})
```

Success with `evaluationResult: true` (or overlay `allow: true`) means
exact calldata, policy evaluation, attestation, and Shield forward all
worked. Record `transactionHash` and `taskId` on the Shield handoff.

Handle expected failures without retrying a deterministic deny:

```typescript
import {
  AttestationTimeoutError,
  PolicyDeniedError,
} from '@newton-xyz/vaultkit'

try {
  await shield.morpho.reallocate(vault, allocations)
} catch (error) {
  if (error instanceof PolicyDeniedError) {
    // Policy said no. Do not retry as a transport error.
  } else if (error instanceof AttestationTimeoutError) {
    // Fresh task after backoff.
  } else {
    throw error
  }
}
```

A `401` is usually the wrong Newton API-key environment. A MetaMorpho
role revert after Newton allow means the clone is not curator / owner /
allocator.

## Deny without a mined tx

```typescript
const proof = await shield.assertIntentBlocked({
  to: vault,
  data: noncompliantCalldata,
  functionSignature: handoff.intent.functionSignature,
  prepareQueryOptions: { /* inputs that should fail the policy */ },
})
// proof.blocked === true, proof.taskId, proof.reason
```

This evaluates the intent and `eth_call`s the denied attestation. It
resolves only if the revert is `InvalidAttestation`.

| Error | Meaning |
|---|---|
| `PolicyNotDeniedError` | The “deny” inputs were actually allowed — fix the fixture |
| `NotApprovedDelegateError` | Wallet is not an approved Shield delegate |
| `PolicyDeniedError` | Gateway denied in a shape the negative assertion cannot submit |

Do not send a live `reallocate` you expect to fail just to see a revert.
Record deny on the handoff with `blocked`, `taskId`, and `reason` — no
transaction hash.

Build the deny calldata the same way as allow (typed overlay encode, or
the same `sendCall` fields) with params / wasm inputs the Rego should
reject. Take those inputs from the policy skill's deny fixture when it
exists (`configs/wasm_args.deny.json` or equivalent). Do not invent a
sanctioned address or a fake risk score.

## What you can prove without a vault role

| Path | What it proves | Needs |
|---|---|---|
| Typecheck / encode | App compiles; calldata is well-typed | Node + packages |
| `createShield` + `setParams` + `uploadSecrets` | Clone and policy bind work | Funded key, API key, RPC |
| `assertIntentBlocked` | Policy denies this intent | Delegate approval; **no** vault role |
| Mined typed allow | Vendor accepts the forwarded call | Shield holds the vault role |

You can therefore prove **deny** before the owner grants allocator. You
cannot prove a mined Morpho allow without that grant.

## Vaults.fyi on testnets

Vaults.fyi indexes production networks, not testnets. A Vaults.fyi policy
on Base Sepolia can fail closed because there is no testnet vault data.

For demos, override `prepareQueryOptions.vaultsfyi.{network,vaultAddress}`
to a Vaults.fyi-listed production vault (network slug `mainnet`, not
`ethereum`). The Shield still executes on the testnet dummy. Pack wasm_args
use `lastKnownAllocationHash` for the same allocation-hash gate VaultKit
calls `previousAllocationHash`. Do not invent the listed address; pick it
at run time. In production, remove the override so the policy describes
the same vault the Shield gates.

## Completion checks

- Allow mined, receipt successful
- Deny: `assertIntentBlocked` returned `blocked: true`
- `shield-handoff.json` written, no secrets in the file
