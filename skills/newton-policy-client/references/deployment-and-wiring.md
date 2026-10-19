# Deploy and wire a PolicyClient

Use only after local compile + required tests pass, and only with explicit
user approval for live transactions.

## RPC

Reuse `RPC_URL` from the process environment or `~/.newton/.env`. If it is
unset and the chain is Ethereum Sepolia (`11155111`), use
`https://ethereum-sepolia-rpc.publicnode.com`. Do not invent other RPC hosts
or credential-bearing URLs. If that public endpoint rate-limits, ask the
user to inject their own `RPC_URL` outside chat.

## Protocol addresses

Do not invent TaskManager or registry addresses.

```bash
newton-cli --chain-id <id> deployments show
```

Record:

- `newtonProverTaskManager`
- `policyClientRegistry` (needed for identity linking; optional for a local
  demo that never uses IdentityRegistry)

Policy addresses come from each policy's
`<policy-dir>/dist/policy-handoff.json` after a completed `newton-policy`
deploy. A set is those addresses in the order the user wants evaluated.
Do not reconstruct them from chat when those files exist. See
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
| Local deploy key | `PRIVATE_KEY` (Foundry / `cast`) | Deploy, `setPolicies`, register, `setPolicyClientOwner` |
| Login wallet | Address printed by `newton-cli login` (dashboard Turnkey / MetaMask) | Gateway secrets / `newt_createTask`. This skill **cannot** sign as this wallet |

Gateway secrets upload checks `getOwner()` on the PolicyClient against the
dashboard identity behind the API key. For secrets to resolve, the login
wallet must end up as `getOwner()`.

Do **not** pass the login wallet as constructor `owner`. Then `setPolicies`
would need a dashboard signature this skill cannot produce, and must not
attempt in the browser.

Record the login wallet from a prior `newton-cli login` printout, or ask the
user for that **address** only. Never invent it. Never ask for the dashboard
wallet's private key (Turnkey / MetaMask will not give one to the CLI).

## Deploy the client

Constructor args for the golden wrapper: token, TaskManager, owner.
`owner` must be the local key's address, for example:

```bash
cast wallet address --private-key "$PRIVATE_KEY"
```

Never print the key. Prefer the copied
[templates/DeployPolicyClient.s.sol](../templates/DeployPolicyClient.s.sol):

```bash
export TOKEN=<token>
export TASK_MANAGER=<taskManager>
export POLICY_CLIENT_OWNER=<localKeyAddress>
forge script script/DeployPolicyClient.s.sol:DeployPolicyClient \
  --rpc-url "$RPC_URL" \
  --private-key "$PRIVATE_KEY" \
  --broadcast
```

`forge create` with the same constructor args is equivalent if the user already
uses that flow.

### Gas: take the node's estimate, then verify the deploy

On current Ethereum Sepolia, forge's local simulation badly underestimates
contract creation. A client estimated at ~1.6M gas used ~11.5M, so the
broadcast ran out of gas, even with `--gas-estimate-multiplier 200`. Forge
still printed the would-be address. Ask the node and set the limit explicitly:

```bash
cast estimate --from "$(cast wallet address --private-key "$PRIVATE_KEY")" \
  --rpc-url "$RPC_URL" \
  --create "$(jq -r .bytecode.object out/<Client>.sol/<Client>.json)" \
  "constructor(address,address)" "$TASK_MANAGER" "$POLICY_CLIENT_OWNER"
forge create src/<Client>.sol:<Client> --broadcast --gas-limit <estimate + ~15%> \
  --constructor-args "$TASK_MANAGER" "$POLICY_CLIENT_OWNER" \
  --rpc-url "$RPC_URL" --private-key "$PRIVATE_KEY"
```

Never trust a printed address alone. Before `setPolicies`, confirm the
receipt succeeded and code exists:

```bash
cast receipt <deployTx> status --rpc-url "$RPC_URL"   # 1 (success)
cast code 0xCLIENT --rpc-url "$RPC_URL"               # not 0x
```

Record `cast receipt <deployTx> blockNumber`; it is where a history scan
starts ([reading-results.md](reading-results.md)).

Then the **current** owner (still the local key) replaces the client's
policy set with one `cast` call. Do not use `newton-cli policy-client`.
Do not call `setPolicyAddress` or `setPolicy`.

```bash
PARAMS_0=$(cast from-utf8 "$(cat policies/first/configs/params.json)")
PARAMS_1=$(cast from-utf8 "$(cat policies/second/configs/params.json)")
cast send "$POLICY_CLIENT" \
  'setPolicies((address,(bytes,uint32))[])' \
  "[($POLICY_0,($PARAMS_0,<blocks>)),($POLICY_1,($PARAMS_1,<blocks>))]" \
  --rpc-url "$RPC_URL" --private-key "$PRIVATE_KEY"
cast call "$POLICY_CLIENT" \
  'getPolicySetSnapshot()(bytes32,uint64,(address,(bytes,uint32))[])' \
  --rpc-url "$RPC_URL"
```

One policy uses a one-element array. The set is ordered, length 1–8.
Each `expireAfter` is in blocks and must be greater than 0. Ask for the
window if the user has not supplied one. Params bytes must match that
policy's schema and stay at or under 65,536 bytes. Each address must be a
policy the TaskManager's factory returns from `isPolicy`. Do not sort or
deduplicate; a repeated address is a separate entry.

`setPolicies` writes the whole set and the set's `policyId` in that one
transaction. A second call replaces the set again and bumps
`policyRevision` even when the specs are unchanged. Old attestations stop
matching `getPolicyId()`.

Finish **all** owner-only client writes (`setPolicies` and optional
register below) before transferring ownership. After transfer, the local
key can no longer call them. The new owner can.

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
| `cast send … setPolicyClientOwner(loginWallet)` | PolicyClient `getOwner()` | Secrets, `setPolicies`, later `setPolicyClientOwner`, gateway `newt_createTask` |
| `cast send … setClientOwner(client, loginWallet)` on the registry | PolicyClientRegistry record owner | Identity linking directory |

Do not use registry `setClientOwner` as a substitute for
`setPolicyClientOwner`.

The two owners can diverge if you transfer one and not the other. After
`setPolicyClientOwner`, `getOwner()` is the login wallet but the registry
record still names the local key until you also `setClientOwner` on the
registry. After registry `setClientOwner` alone, the registry names the
login wallet but secrets, evaluate, and `setPolicies` still require the local
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
MetaMask; this skill cannot sign later `setPolicies` on this client. The
owner can. Replacing the set on this client is the configuration path.

## Replace the set on the same client

Params, membership, and order change with another `setPolicies` by the
current `getOwner()`. Deploying a new client is not the way to edit the set.

Pass the entire desired list, including unchanged entries. Every successful
replacement increments `policyRevision` and changes `policyId`, so previous
attestations no longer validate. Read the new id, revision, and specs back
with `getPolicySetSnapshot()` in one call. Separate getter calls can straddle
an update.

After ownership transfer, tell the user the login wallet must sign that
transaction. Do not work around it by deploying another client. Secrets for
a policy that stays in the set do not need a new upload just because the
revision changed. A newly added policy whose WASM calls `getSecrets()` still
needs its own upload, scoped to this client and that policy.

## Verify configuration

After wiring, run
[templates/verify-policy-client.sh](../templates/verify-policy-client.sh):

```bash
RPC_URL="$RPC_URL" POLICY_CLIENT=0xCLIENT \
  EXPECTED_POLICIES=0xPOLICY_0,0xPOLICY_1 \
  EXPECTED_TASK_MANAGER=0xTASK_MANAGER \
  EXPECTED_OWNER=0xLOGIN_WALLET \
  ./script/verify-policy-client.sh
```

The client must report:

- `getNewtonPolicyTaskManager()` = intended TaskManager
- `getPolicySetSnapshot()` nonzero `policyId`, `policyRevision >= 1`, and
  the ordered specs (1–8)
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
