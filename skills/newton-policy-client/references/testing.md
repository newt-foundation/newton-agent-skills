# Testing

Local Foundry tests are required. Do not deploy until they pass.

Copy
[templates/DirectERC20TransferPolicyClient.t.sol](../templates/DirectERC20TransferPolicyClient.t.sol)
to `test/` (and the matching contract to `src/`). That file is the behavioral
spec: allow, deny, replay, wrong sender/chain/policyId/target/signature/
selector/args/value, stale response, and downstream failure. Adapt the
protected action; keep the mock TaskManager/Policy pattern. Do not copy
protocol-internal harnesses (`TaskCreationTest` and similar) and do not invent
BLS signatures.

## Required cases

| Case | Expected |
|---|---|
| Valid allow | Protected action executes |
| Policy deny (`evaluationResult` false) | Revert `PolicyDenied` (or equivalent); no state change |
| Replay of the same task | Revert spent/already-used |
| Wrong `msg.sender` | Revert unauthorized sender |
| Wrong `chainId` | Revert unauthorized chain |
| Wrong policy ID / policy address | Revert |
| Wrong `intent.to` | Application revert |
| Wrong selector / `functionSignature` | Application revert |
| Argument mismatch (bound params ≠ intent) | Application revert |
| Non-zero `intent.value` when ETH is not used | Application revert |
| Stale `taskCreatedBlock` | Revert too-late / expired |
| Downstream token/app failure | Whole tx reverts; attestation not consumed |

## Fixtures

The copied test template includes application-level `MockTaskManager` and
`MockNewtonPolicy`. Reuse those mocks; they record spent task IDs and honor
`evaluationResult`. You still need (for the golden wrapper) a token plus
approvals.

If the user already has a Foundry fork of the target chain, you may additionally
run against live TaskManager addresses from
`newton-cli --chain-id <id> deployments show`. That does not replace the unit
suite.

Do not invent BLS signatures. `vm.mockCall` the TaskManager only when a test is
explicitly about application-level intent binding.

## Intent construction

```solidity
NewtonMessage.Intent memory intent = NewtonMessage.Intent({
    from: sender,
    to: address(token),
    value: 0,
    data: abi.encodeWithSelector(IERC20.transfer.selector, recipient, amount),
    chainId: block.chainid,
    functionSignature: bytes("function transfer(address recipient, uint256 amount)")
});
```

`task.intent` and `taskResponse.intent` must be identical. `task.policyClient`
and `taskResponse.policyClient` must be the client under test.
`taskResponse.policyId` must equal `client.getPolicyId()` after `setPolicy`.

## Compile gate

```bash
forge build
forge test --match-contract DirectERC20TransferPolicyClientTest
```

Fix compiler/remapping issues before writing more production code. Copy
[templates/foundry.toml](../templates/foundry.toml) and
[templates/remappings.txt](../templates/remappings.txt) rather than inventing
paths. If `NewtonPolicyClient.sol` still fails to compile, merge any extra
remappings from `lib/newton-contracts/foundry.toml` instead of rewriting the
mixin.
