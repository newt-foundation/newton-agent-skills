# Upgradeable PolicyClients

Treat upgradeable clients as a variant of the canonical pattern, not the
default. First implementations should be non-upgradeable wrappers.

## Initializer, not constructor

```solidity
function initialize(
    address policyTaskManager,
    address policy,
    address owner
) public initializer {
    __Ownable_init();
    _transferOwnership(owner);
    _initNewtonPolicyClient(policyTaskManager, owner);
    _setPolicyAddress(policy);
}
```

Disable initializers in the implementation constructor:

```solidity
constructor() {
    _disableInitializers();
}
```

Still call `setPolicy` after the proxy is deployed. ERC-165 during
construction is the same failure mode for implementation constructors; do not
call `_setPolicy` from `initialize` unless the proxy is already live and
`supportsInterface` will succeed on `address(this)` (the proxy). The safe
sequence is: deploy proxy → initialize task manager/owner/policy address →
owner `setPolicy`.

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

Then `setPolicyAddress` and `setPolicy` as owner calls. Do not try to pack
`setPolicy` into the upgrade transaction's constructor.

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

Registry registration and `NewtonPolicy.setPolicy` both require
`INewtonPolicyClient` via ERC-165.

## Versioning

Inheriting `NewtonPolicyClient` exposes `version()` from `SemVerMixin`.
`setPolicyAddress` checks the policy factory against the TaskManager's runtime
`minCompatiblePolicyVersion`.

Those owner calls only work if the current `getOwner()` can sign. After
`setPolicyClientOwner(loginWallet)`, the CLI cannot sign them (dashboard
Turnkey / MetaMask). For CLI-driven updates, deploy a new wrapper client
instead of mutating the old one; see
[deployment-and-wiring.md](deployment-and-wiring.md). Do not apply that
replace-the-client workaround to a long-lived public inherited address;
that needs a dashboard signature this skill will not perform.
