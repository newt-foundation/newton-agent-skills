# Canonical PolicyClient pattern

This is the blessed Solidity pattern agents should reproduce. Copy
[templates/DirectERC20TransferPolicyClient.sol](../templates/DirectERC20TransferPolicyClient.sol)
and adapt the protected action. Do not start from a generic
`intent.to.call{value}(intent.data)` executor.

## Direct execution lifecycle

```text
user supplies Task + TaskResponse + signatureData
  → application checks the intended target, value, selector, and arguments
  → NewtonPolicyClient._validateAttestationDirect verifies protocol authorization
  → application executes only the checked action
```

Follow checks → authorization → effects in one transaction:

1. Bind the application-specific intent shape.
2. Call `_validateAttestationDirect(task, taskResponse, signatureData)`.
3. Execute the protected state change only when that call returns `true`.

If a later check or effect reverts, the whole transaction reverts, including
the TaskManager spent marker.

Use `_validateAttestationDirect` as the default for demos and time-sensitive
actions. `_validateAttestation` is the lower-gas path after the aggregator has
already called `respondToTask`; it is not the canonical one-shot pattern.

## What the protocol already binds

`NewtonPolicyClient._validateAttestationDirect` plus the TaskManager /
AttestationValidator already enforce:

| Check | Bound by |
|---|---|
| `taskResponse.policyId` equals this client's current policy ID | mixin |
| `intent.from == msg.sender` | mixin |
| `intent.chainId == block.chainid` | mixin |
| Caller is `task.policyClient` and `taskResponse.policyClient` | TaskManager |
| Response `policyAddress` equals this client's current policy | TaskManager |
| Policy program hash matches on-chain `getPolicyCodeHash()` | TaskManager |
| Overlapping Task / TaskResponse fields: `taskId`, `policyClient`, intent, `intentSignature`, `initializationTimestamp` | TaskManager |
| Operator/certificate signature and quorum | TaskManager |
| Response window (`taskCreatedBlock` not in the future; not too late) | TaskManager |
| One-time consumption of the task ID | TaskManager |
| Policy evaluation result (`true` / `false`) | TaskManager |

`_validateAttestationDirect` returns `true` only when the policy allowed the
intent. Treat `false` as deny and revert; do not execute.

`intentSignature` is hash-bound between Task and TaskResponse. This path does
**not** cryptographically verify it. Same-sender integrations rely on
`msg.sender == intent.from`. Relayed or delegated designs must verify their
chosen signature scheme separately.

Task-only fields that are not in the signed response (`taskCreatedBlock`,
`wasmArgs`, `quorumNumbers`, `quorumThresholdPercentage`) are
caller-controlled on the optimistic direct path. Do not treat them as
authorization.

## What the application must still bind

A valid attestation authorizes the attested intent, not whatever the function
later executes. Before calling `_validateAttestationDirect`, require:

- **Target:** `intent.to` is the expected downstream contract (or `address(this)` for inherited clients)
- **ETH value:** `intent.value` is `0` unless the protected action truly sends ETH
- **Selector:** `bytes4(intent.data[:4])` is the expected function
- **Function metadata:** `intent.functionSignature` matches the exact UTF-8
  ABI description the policy and gateway decode. Copy it from the policy's
  `intent.json` / `input.decoded_function_signature`. For the ERC-20
  template and `policy scaffold` transfer intent that is
  `bytes("function transfer(address recipient, uint256 amount)")`, not
  unnamed `function transfer(address,uint256)`.
- **Arguments:** every value used by the protected action equals the ABI-decoded
  intent arguments
- **Domain invariants:** token address, receiver, amount caps, and similar

Then execute those checked values. Never validate an attestation and then
`call` caller-supplied `to` / `value` / `data` that were not compared with the
intent.

## Constructor versus `setPolicy`

Safe in a non-upgradeable constructor:

```solidity
_initNewtonPolicyClient(policyTaskManager, policyClientOwner);
_setPolicyAddress(policy);
```

Do **not** call `_setPolicy` / `setPolicy` from a constructor.
`NewtonPolicy.setPolicy` ERC-165-checks the caller, and a contract has no
runtime code during construction, so that call reverts with
`InterfaceNotSupported`.

Required post-deploy owner call:

```solidity
client.setPolicy(INewtonPolicy.PolicyConfig({
    policyParams: bytes(paramsJson), // or hex"" when unused
    expireAfter: expireAfterBlocks   // must be > 0
}));
```

`expireAfter == 0` is rejected by PolicyData and produces attestations that
expire in the same block they are created.

`cast` equivalent after deploy (do not use `newton-cli policy-client`):

```bash
cast send 0xCLIENT "setPolicyAddress(address)" 0xPOLICY \
  --rpc-url "$RPC_URL" --private-key "$PRIVATE_KEY"

PARAMS=$(cast --from-utf8 "$(cat params.json)")
cast send 0xCLIENT "setPolicy((bytes,uint32))" "($PARAMS, <blocks>)" \
  --rpc-url "$RPC_URL" --private-key "$PRIVATE_KEY"
```

`setPolicyAddress` sets the Policy **address**. `setPolicy` creates the
client's `policyId`. Both are required before live evaluation if the
constructor did not already bind the Policy address.

Constructor `policyClientOwner` is the **local deploy key**, not the
`newton-cli login` wallet. After these owner-only calls (and optional
register), transfer ownership with `setPolicyClientOwner(loginWallet)` so
secrets resolve. That transfer is not repeatable from the local key; later
param/policy changes deploy a new client. See
[deployment-and-wiring.md](deployment-and-wiring.md).

## Intent encoding

Keep one encoding across Rego simulation, gateway tasks, and Solidity:

| Intent field | Meaning |
|---|---|
| `from` | User who must submit the protected call (`msg.sender`) |
| `to` | Downstream target the policy evaluated |
| `value` | ETH attached to that target call |
| `data` | Selector + ABI arguments |
| `chainId` | Destination chain |
| `functionSignature` | UTF-8 ABI description as bytes, not a 4-byte selector |

`functionSignature` is metadata. Authorization of the call comes from `data`.
Bind both so a task cannot describe one function and execute another. The
keccak check is byte equality: named vs unnamed parameter lists are
different strings, and Rego compares `decoded_function_signature` to the
named form the CLI scaffolds.

For wrapper clients, `intent.to` is usually the underlying token/vault, not the
wrapper. For inherited clients, `intent.to` is usually `address(this)`.
