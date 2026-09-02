# Integration patterns

Choose one shape. Default to a **narrow wrapper/router**.

## Narrow wrapper/router — default

Create a new `NewtonPolicyClient` that protects one action (or a small explicit
set) on an existing contract.

Use when:

- The target contract should stay unchanged
- Storage layout, upgrade controls, or access control are sensitive
- Newton should gate only a subset of actions
- The application already exists and was not designed around Newton

The wrapper decodes known selectors, binds intent fields, then performs the
equivalent action (`transferFrom` after an attested `transfer`, vault deposit
after an attested `deposit`, and similar). It is not a generic call forwarder.

See [templates/DirectERC20TransferPolicyClient.sol](../templates/DirectERC20TransferPolicyClient.sol).

A wrapper is also the replaceable live shape: after ownership moves to the
`newton-cli login` wallet, params/policy changes deploy a new wrapper rather
than mutating a public address. See
[deployment-and-wiring.md](deployment-and-wiring.md).

## Direct inheritance

Have the application contract inherit `NewtonPolicyClient` and protect its own
entrypoints.

Use when:

- The contract is new, or already designed to inherit Newton
- The protected action is this contract's own state change
- You can review storage and access control as part of the same change

Keep the same intent-binding checks at every protected function. Do not add
Newton to a widely used inherited contract just to avoid a wrapper.

## Module / plugin

Implement Newton as a module behind a host extension interface (smart account,
modular vault, hook, or similar).

Use when the host already has a constrained plugin surface. The module must
bind the host operation to the attested intent and must not silently broaden
the host's authority (for example by enabling arbitrary `execute` through the
module).

## Decision rule

```text
Can the original contract stay unchanged?
  yes → wrapper/router
  no, and it is a modular host → module/plugin
  no, and it is new or already Newton-aware → inherit NewtonPolicyClient
```

If modifying the original contract would change storage layout, upgradeability,
access control, or established invariants, use a wrapper.

## Anti-pattern: generic executor

Do not generate this as the baseline:

```solidity
require(_validateAttestationDirect(task, taskResponse, signatureData));
(bool ok, ) = intent.to.call{value: intent.value}(intent.data);
```

That executes whatever the attested intent names. If arbitrary calls are truly
required, constrain targets, selectors, value, `delegatecall`, reentrancy, and
return-data handling explicitly, and add tests for each constraint.
