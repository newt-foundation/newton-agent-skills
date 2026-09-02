# Deploy and wire a PolicyClient

Use only after local compile + required tests pass, and only with explicit
user approval for live transactions.

## Protocol addresses

Do not invent TaskManager or registry addresses.

```bash
newton-cli --chain-id <id> deployments show
```

Record:

- `newtonProverTaskManager`
- `policyClientRegistry` (needed for identity linking; optional for a local
  demo that never uses IdentityRegistry)

Policy and PolicyData addresses come from
`<policy-dir>/dist/policy-handoff.json` after a completed `newton-policy`
deploy. Do not reconstruct them from chat when that file exists. See
[handoff.md](handoff.md).

## Foundry dependency

Install the Solidity package, not an operator or gateway checkout:

```bash
forge install newt-foundation/newton-contracts
git -C lib/newton-contracts submodule update --init --recursive
```

`newton-contracts` currently has no version tags, so install from `main`.
Copy [templates/foundry.toml](../templates/foundry.toml) and
[templates/remappings.txt](../templates/remappings.txt) into the app project.

That clone includes EigenLayer / OpenZeppelin as submodules under
`lib/newton-contracts/lib/`. If `forge build` cannot find them after the
install command above, re-run the submodule update.

Do **not** forge-install an operator, gateway, or CLI source tree.
Application clients only need [`newton-contracts`](https://github.com/newt-foundation/newton-contracts).

Import path used by this skill:

```solidity
import {NewtonPolicyClient} from "newton-contracts/src/mixins/NewtonPolicyClient.sol";
import {NewtonMessage} from "newton-contracts/src/core/NewtonMessage.sol";
import {INewtonProverTaskManager} from "newton-contracts/src/interfaces/INewtonProverTaskManager.sol";
import {INewtonPolicy} from "newton-contracts/src/interfaces/INewtonPolicy.sol";
```

The mixin uses `@openzeppelin/...` (and transitively `@eigenlayer/...`).
The app project does not inherit `newton-contracts/foundry.toml`. The copied
`foundry.toml` / `remappings.txt` already include:

```
newton-contracts/=lib/newton-contracts/
forge-std/=lib/forge-std/src/
@openzeppelin/=lib/newton-contracts/lib/eigenlayer-middleware/lib/openzeppelin-contracts/
@openzeppelin-upgrades/=lib/newton-contracts/lib/eigenlayer-middleware/lib/openzeppelin-contracts-upgradeable/
@eigenlayer/=lib/newton-contracts/lib/eigenlayer-middleware/lib/eigenlayer-contracts/src/
@eigenlayer-middleware/=lib/newton-contracts/lib/eigenlayer-middleware/
```

If `newton-contracts/foundry.toml` lists further remappings the mixin needs,
copy those the same way. Do not vendor-edit mixin source.

## Two signers (do not conflate them)

Live wiring uses two identities:

| Role | Who | What it can sign |
|---|---|---|
| Local deploy key | `PRIVATE_KEY` (Foundry / `cast`) | Deploy, `setPolicy`, register, `setPolicyClientOwner` |
| Login wallet | Address printed by `newton-cli login` (dashboard Turnkey / MetaMask) | Gateway secrets / `newt_createTask`. This skill **cannot** sign as this wallet |

Gateway secrets upload checks `getOwner()` on the PolicyClient against the
dashboard identity behind the API key. For secrets to resolve, the login
wallet must end up as `getOwner()`.

Do **not** pass the login wallet as constructor `owner`. Then `setPolicy`
would need a dashboard signature this skill cannot produce, and must not
attempt in the browser.

Record the login wallet from a prior `newton-cli login` printout, or ask the
user for that **address** only. Never invent it. Never ask for the dashboard
wallet's private key (Turnkey / MetaMask will not give one to the CLI).

## Deploy the client

Constructor args for the golden wrapper: token, TaskManager, Policy, owner.
`owner` must be the local key's address, for example:

```bash
cast wallet address --private-key "$PRIVATE_KEY"
```

Never print the key. Prefer the copied
[templates/DeployPolicyClient.s.sol](../templates/DeployPolicyClient.s.sol):

```bash
export TOKEN=<token>
export TASK_MANAGER=<taskManager>
export POLICY=<policy>
export POLICY_CLIENT_OWNER=<localKeyAddress>
forge script script/DeployPolicyClient.s.sol:DeployPolicyClient \
  --rpc-url "$RPC_URL" \
  --private-key "$PRIVATE_KEY" \
  --broadcast
```

`forge create` with the same constructor args is equivalent if the user already
uses that flow.

Then the **current** owner (still the local key) binds policy configuration
with `cast`. Do not use `newton-cli policy-client`.

```bash
cast send 0xCLIENT "setPolicyAddress(address)" 0xPOLICY \
  --rpc-url "$RPC_URL" --private-key "$PRIVATE_KEY"

PARAMS=$(cast --from-utf8 "$(cat params.json)")
cast send 0xCLIENT "setPolicy((bytes,uint32))" "($PARAMS, <blocks>)" \
  --rpc-url "$RPC_URL" --private-key "$PRIVATE_KEY"
```

`setPolicyAddress` writes the Policy address (needed if the constructor used
`address(0)` or you are rebinding). If the constructor already called
`_setPolicyAddress`, `setPolicy` is still required to create `policyId`.
Ask for `<blocks>` if the user has not supplied an expiration policy;
`expireAfter` must be greater than 0.

Finish **all** owner-only client writes (`setPolicyAddress`, `setPolicy`,
and optional register below) before transferring ownership. After transfer,
the local key can no longer call them.

## Register

`registerClient` does **not** deploy a client. It registers an existing
`INewtonPolicyClient` in PolicyClientRegistry.

Register when identity linking is in scope, or when the user asks for
registry presence:

```bash
cast send 0xREGISTRY "registerClient(address)" 0xCLIENT \
  --rpc-url "$RPC_URL" --private-key "$PRIVATE_KEY"
```

Verify:

```bash
cast call 0xREGISTRY "getClientRecord(address)" 0xCLIENT --rpc-url "$RPC_URL"
```

## Two owners (do not mix these up)

| Call | What it changes | Used by |
|---|---|---|
| `cast send … setPolicyClientOwner(loginWallet)` | PolicyClient `getOwner()` | Secrets, `setPolicy`, later `setPolicyClientOwner`, gateway `newt_createTask` |
| `cast send … setClientOwner(client, loginWallet)` on the registry | PolicyClientRegistry record owner | Identity linking directory |

Do not use registry `setClientOwner` as a substitute for
`setPolicyClientOwner`.

The two owners can diverge if you transfer one and not the other. After
`setPolicyClientOwner`, `getOwner()` is the login wallet but the registry
record still names the local key until you also `setClientOwner` on the
registry. After registry `setClientOwner` alone, the registry names the
login wallet but secrets, evaluate, and `setPolicy` still require the local
key because `getOwner()` did not move.

If the client is registered and you move contract ownership, update both.
If it was never registered, skip registry `setClientOwner`.

## Transfer PolicyClient owner to the login wallet

After bind (and optional register), transfer contract ownership while the
local key can still sign:

```bash
cast send 0xCLIENT "setPolicyClientOwner(address)" 0xLOGIN_WALLET \
  --rpc-url "$RPC_URL" \
  --private-key "$PRIVATE_KEY"
```

Then verify `getOwner()` is `0xLOGIN_WALLET`. Only then hand off to
`newton-policy` for `secrets upload`.

Do not confuse this with registry `setClientOwner` (registry record only).
See [Two owners](#two-owners-do-not-mix-these-up).

This transfer is one-way for the local key. The dashboard wallet is Turnkey /
MetaMask; this skill cannot sign later `setPolicy` on this client.

## Treat the client as replaceable

If params or the Policy address need to change after ownership transfer, do
**not** call `setPolicy` on the old client. Deploy a new one:

1. Deploy with the local key as owner.
2. `setPolicyAddress` / `setPolicy` via `cast`.
3. `registerClient` if registration is in scope.
4. `setPolicyClientOwner(loginWallet)`.
5. Re-upload secrets against the **new** `policy_client`.
6. Point every caller at the new address.

Everything bound to the old client address must be updated:

- Registry registration (`registerClient`)
- Secrets (`secrets upload` is scoped to `(policy_client, policy_data)`)
- Any app / SDK / `policy_client` already in use
- Identity links (docs treat them as tied to the client address)

That is cheaper than a dashboard signing flow when the client is a narrow
wrapper / demo address. If the client is a long-lived public integration
address (inherited production contract, published SDK default, and similar),
do not silently replace it. Tell the user that mutating it needs a dashboard
wallet signature this skill will not perform.

## Verify configuration

After wiring, run
[templates/verify-policy-client.sh](../templates/verify-policy-client.sh):

```bash
RPC_URL="$RPC_URL" POLICY_CLIENT=0xCLIENT \
  EXPECTED_POLICY=0xPOLICY \
  EXPECTED_TASK_MANAGER=0xTASK_MANAGER \
  EXPECTED_OWNER=0xLOGIN_WALLET \
  ./script/verify-policy-client.sh
```

The client must report:

- `getNewtonPolicyTaskManager()` = intended TaskManager
- `getPolicyAddress()` = intended Policy
- `getPolicyId() != bytes32(0)`
- `getOwner()` = the `newton-cli login` wallet (not the local deploy key)

Then write `client-handoff.json` ([handoff.md](handoff.md)).

## Live evaluate

After wiring, if the user asked for a gateway round-trip, sign the intent
(EIP-712) and POST `newt_createTask` to the chain's gateway. Procedure:
[evaluate-intent-direct.md](evaluate-intent-direct.md). Do not use
`newton-cli task` or `newton-cli policy-client`.

## Credentials

Same rules as `newton-policy`:

- Never ask the user to paste `PRIVATE_KEY`, RPC credentials, or JWTs in chat
- Inject secrets through the process environment or `~/.newton/.env`
- Never commit a project-local `.env`
- Summarize chain, addresses, and transactions, then wait for explicit
  confirmation before sending
