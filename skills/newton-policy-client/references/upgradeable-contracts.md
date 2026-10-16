# Upgradeable PolicyClients

Treat upgradeable clients as a variant of the canonical pattern, not the
default. First implementations should be non-upgradeable wrappers.

## Initializer, not constructor

```solidity
function initialize(
    address policyTaskManager,
    address owner
) public initializer {
    __Ownable_init();
    _transferOwnership(owner);
    _initNewtonPolicyClient(policyTaskManager, owner);
}
```

Disable initializers in the implementation constructor:

```solidity
constructor() {
    _disableInitializers();
}
```

Call `setPolicies` after the proxy is deployed. `_initPolicies(specs)` may
run from `initialize` when the specs are already known; an empty list defers
configuration. The usual sequence is: deploy proxy → initialize task manager
and owner → owner `setPolicies` with the full ordered set.

## Storage

`NewtonPolicyClient` uses namespaced ERC-7201 storage
(`newton.storage.NewtonPolicyClient`). Do not redeclare those fields. When
adding Newton to an existing upgradeable contract:

1. Inherit `NewtonPolicyClient`
2. Add only an explicit initialized flag if you need a one-time admin bind
3. Put new app storage at the end of the existing layout
4. Fork-test before mainnet

## Existing contract, deferred bind

```solidity
function initializeNewtonPolicyClient(
    address policyTaskManager,
    address policyClientOwner
) external onlyOwner {
    require(!_newtonPolicyClientInitialized, AlreadyInitialized());
    _initNewtonPolicyClient(policyTaskManager, policyClientOwner);
    _newtonPolicyClientInitialized = true;
}
```

Then `setPolicies` as an owner call. Do not call `setPolicy` or
`setPolicyAddress`.

## `supportsInterface`

If the contract already overrides ERC-165, keep Newton in the chain:

```solidity
function supportsInterface(bytes4 interfaceId)
    public
    view
    override
    returns (bool)
{
    return super.supportsInterface(interfaceId);
}
```

Registry registration checks `INewtonPolicyClient` via ERC-165. Preserve
`supportsInterface` through `super`. Do not hardcode a pre-0.7 interface id.
`setPolicies` checks `isPolicy` on the TaskManager's configured factory. It
does not compare factory semantic versions inside `_setPolicies`.

Those owner calls only work if the current `getOwner()` can sign. After
`setPolicyClientOwner(loginWallet)`, this skill cannot sign a later
`setPolicies` (dashboard Turnkey / MetaMask). The owner replaces the set on
the same client. See [deployment-and-wiring.md](deployment-and-wiring.md).
