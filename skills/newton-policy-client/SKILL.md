---
name: newton-policy-client
description: >-
  Integrate Newton policy enforcement into a Solidity contract by inheriting
  NewtonPolicyClient, binding attested intents, validating with
  _validateAttestationDirect, wiring setPolicy with cast, and submitting
  evaluations by signing an EIP-712 intent and POSTing newt_createTask to the
  chain's gateway. Use when adding a PolicyClient, wrapping an existing
  contract with Newton authorization, or connecting a deployed Policy to an
  application contract. Do not use newton-cli policy-client or newton-cli task.
---

# Newton PolicyClient

> **Status:** Draft v0 under active dogfood testing. Expect gaps and report
> friction instead of silently working around it.

Add Newton enforcement to a smart contract. This skill does not author Rego or
WASM; use `newton-policy` for that. For a one-shot brief or a wallet UI on a
wired client, use `newton-demo`. Do not assume a vertical (stablecoin,
vaults, wallets) unless the user specifies one.

## Choose the workflow first

1. **Local integration:** inspect the app, implement the client, compile, and
   run Foundry tests.
2. **Live wiring:** after tests pass, deploy the client and bind Policy /
   registry only with explicit user confirmation.

On the first turn, tell the user they will eventually need (names only; do
not ask for values yet):

- A funded local `PRIVATE_KEY` in the process environment or `~/.newton/.env`
  (`forge` / `cast` deploy; not the dashboard login wallet)
- A Newton gateway API key from `newton-cli keys` (live `newt_createTask`)
- Target chain/environment
- RPC endpoint. On Ethereum Sepolia (`11155111`), this skill uses
  `https://ethereum-sepolia-rpc.publicnode.com` unless `RPC_URL` is already
  set. Do not ask the user for a Sepolia URL.
- The `newton-cli login` wallet address (dashboard / Turnkey / MetaMask). That
  wallet must become PolicyClient owner so gateway secrets and live evaluate
  resolve. This skill cannot sign as that wallet.
- TaskManager and Policy addresses
- Whether PolicyClientRegistry registration is required

Do not invent contract addresses, chain IDs, or private keys. Local
implementation and Foundry tests can proceed before deploy secrets exist.

If the Policy does not exist yet, run or hand off to `newton-policy` before
live `setPolicy`. Local client implementation can proceed in parallel once the
intent shape is agreed.

## Credential safety

- Never ask the user to paste a dashboard JWT, private key, API key, or RPC
  credential into chat.
- Never put credentials in source files, committed files, or a project-local
  `.env`.
- Prefer existing local credentials from the process environment and
  `~/.newton/.env`.
- Never source a project-local `.env`, a `.env` beside a user-specified CLI
  binary, another repo checkout, or shell rc files.
- For live deploy, at the deploy checkpoint ask the user to inject missing
  `PRIVATE_KEY` into the process environment or `~/.newton/.env`. On Sepolia,
  use the public RPC above if `RPC_URL` is unset; on other chains, ask them
  to inject `RPC_URL` the same way. Verify only whether required variables
  are set; never print their values.
- Never perform browser signup, wallet linking, or signing on the user's behalf.
- Never invent private keys, credential-bearing RPC URLs, contract addresses,
  chain IDs, or expiration values. Ethereum Sepolia may use
  `https://ethereum-sepolia-rpc.publicnode.com` when `RPC_URL` is unset.

## Core sequence

```text
inspect application
  → identify protected actions
  → choose integration pattern
  → define intent encoding
  → implement NewtonPolicyClient
  → add adversarial tests
  → forge build + forge test
  → optional deploy with local key as owner
  → setPolicyAddress / setPolicy via cast (local key)
  → optional registry registerClient via cast (local key)
  → setPolicyClientOwner(login wallet) via cast
  → verify getters
  → optional live evaluate: EIP-712 sign + gateway newt_createTask
```

Read in this order:

1. [references/canonical-pattern.md](references/canonical-pattern.md)
2. [references/integration-patterns.md](references/integration-patterns.md)
3. [references/direct-attestation.md](references/direct-attestation.md)
4. [references/security-checklist.md](references/security-checklist.md)
5. [references/testing.md](references/testing.md)

When needed:

- Upgradeable/existing proxies:
  [references/upgradeable-contracts.md](references/upgradeable-contracts.md)
- Live deploy/register/bind:
  [references/deployment-and-wiring.md](references/deployment-and-wiring.md)
- Live evaluate (sign intent, POST gateway):
  [references/evaluate-intent-direct.md](references/evaluate-intent-direct.md)
- Policy / client JSON handoff:
  [references/handoff.md](references/handoff.md)

Copy these into the user's Foundry project (do not vendor `newton-contracts`
source into this skill repo):

| Template | Destination |
|---|---|
| [DirectERC20TransferPolicyClient.sol](templates/DirectERC20TransferPolicyClient.sol) | `src/` |
| [DirectERC20TransferPolicyClient.t.sol](templates/DirectERC20TransferPolicyClient.t.sol) | `test/` |
| [DeployPolicyClient.s.sol](templates/DeployPolicyClient.s.sol) | `script/` |
| [verify-policy-client.sh](templates/verify-policy-client.sh) | `script/` |
| [foundry.toml](templates/foundry.toml) / [remappings.txt](templates/remappings.txt) | project root (merge if present) |
| [client-handoff.json](templates/client-handoff.json) | project root (fill after tests / wiring) |

Replace the ERC-20 transfer with the user's protected action. Keep the
intent-binding structure. Install `newton-contracts` from `main` as in
`templates/foundry.toml`.

## Inspect the application

Before writing Solidity, determine:

- Which functions must be gated
- Whether the target contract can change
- Storage / upgrade / access-control constraints
- The exact downstream call (target, selector, arguments, ETH value)
- Who `msg.sender` will be at execution time

Default to a **narrow wrapper** when modifying the original contract would
alter storage layout, upgradeability, access control, or established
invariants. See [references/integration-patterns.md](references/integration-patterns.md).

## Implement

Required shape for each protected entrypoint:

1. Bind `intent.to`, `intent.value`, selector, `functionSignature`, and
   arguments to the function's parameters. `functionSignature` must be the
   exact named UTF-8 from the policy's `intent.json` /
   `decoded_function_signature` (template:
   `function transfer(address recipient, uint256 amount)`), not unnamed
   `function transfer(address,uint256)`.
2. `require(_validateAttestationDirect(task, taskResponse, signatureData), ...)`.
3. Execute only the checked values.

Constructor/`initialize` may call `_initNewtonPolicyClient` and
`_setPolicyAddress`. Do **not** call `setPolicy` during construction.

Protocol addresses: `newton-cli --chain-id <id> deployments show` for
TaskManager and PolicyClientRegistry. Policy address comes from
`newton-policy` or the user.

## Tests before deploy

Do not skip adversarial tests. Minimum: allow, deny, replay, wrong sender,
wrong chain, wrong target/selector/arguments, stale response. Details in
[references/testing.md](references/testing.md) and
[references/security-checklist.md](references/security-checklist.md).

## Live wiring checkpoint

After tests pass, if the user asked to deploy:

1. Reuse TaskManager / Policy / RPC / signer from user input, process
   environment, or `~/.newton/.env`. Record the `newton-cli login` wallet
   address (from a prior login printout, or ask for the address only).
2. Stop if `PRIVATE_KEY` is missing. If `RPC_URL` is unset and the chain is
   Ethereum Sepolia (`11155111`), use
   `https://ethereum-sepolia-rpc.publicnode.com`. If `RPC_URL` is unset on
   any other chain, stop.
3. Summarize chain, constructor args (owner = local key), `setPolicy` /
   register txs, and the later `setPolicyClientOwner` to the login wallet.
4. Wait for explicit confirmation.
5. Deploy, bind, optionally register, transfer owner, then verify getters.

Do **not** set the constructor owner to the login wallet. Then `setPolicy`
would need a dashboard signature this skill cannot produce.

Do **not** use `newton-cli policy-client` or `newton-cli task` for any
PolicyClient work (deploy, bind, register, ownership, or evaluation). Wire
with `forge` / `cast`. Evaluate with the gateway procedure in
[evaluate-intent-direct.md](references/evaluate-intent-direct.md).

## Ownership transfer is one-way for the local key

Gateway secrets, client-scoped simulate, and `newt_createTask` check
`getOwner()` against the dashboard identity behind `newton-cli login`
(Turnkey / MetaMask). The local `PRIVATE_KEY` cannot sign as that wallet.

Required first-time sequence, all signed by the local key:

1. Deploy the client with constructor owner = local `PRIVATE_KEY` address.
2. `setPolicyAddress` / `setPolicy` via `cast send` while that key is still
   owner.
3. Optional `registerClient` on PolicyClientRegistry via `cast send`.
4. `setPolicyClientOwner(loginWallet)` via `cast send`.
5. Verify `getOwner()` is the login wallet. Then `newton-policy` may upload
   secrets.

Registry `setClientOwner` is **not** that call. It changes the
PolicyClientRegistry record owner, not PolicyClient `getOwner()`. Secrets,
`setPolicy`, and `setPolicyClientOwner` all use `getOwner()`. The two owners
can diverge if you transfer one and not the other. If the client is
registered and you move contract ownership, also update the registry record
so they match — they are not substitutes.

That last `setPolicyClientOwner` step is not repeatable from the local key
after transfer. After it, do not call `setPolicy` on the same client.

**Treat the PolicyClient as replaceable instead of mutating it.** If params
or the Policy address need to change, deploy a **new** client with the local
key, bind it with `cast`, register it, call
`setPolicyClientOwner(loginWallet)`, re-upload secrets, and point callers at
the new address. Do not try to `setPolicy` on the old one.

Replacing a client also means updating everything bound to the old address:

- PolicyClientRegistry registration (`registerClient`)
- Secrets (`secrets upload` is per `policy_client`)
- Any app / SDK / `policy_client` address already in use
- Identity links (tied to the client address)

That is cheaper than a dashboard signing flow, as long as the client is not a
long-lived public integration address. Inherited or already-published clients
cannot cheaply use this workaround; stop and tell the user those owner calls
need a dashboard/wallet signature this skill will not perform.

Details: [references/deployment-and-wiring.md](references/deployment-and-wiring.md).

## Live evaluate (no newton-cli)

When the user asks for a gateway round-trip, do **not** call
`newton-cli task` or `newton-cli policy-client`. Follow
[references/evaluate-intent-direct.md](references/evaluate-intent-direct.md)
(this is `@newton-xyz/sdk` `evaluateIntentDirect`):

1. Form the six-field intent (`from`, `to`, `value`, `data`, `chainId`,
   `functionSignature`). Addresses are `0x` hex strings.
2. Sign it EIP-712 as type `Intent`. Prefer `eip712Domain()` on the client;
   otherwise a fallback domain whose `verifyingContract` is the PolicyClient.
   `value` and `chainId` in the message are `BigInt`. The signature must be
   65 bytes; `"0x"` is not valid.
3. POST JSON-RPC `newt_createTask` to the gateway for that chain:

   | Chain ID | Gateway |
   |---|---|
   | `11155111`, `84532` | `https://gateway.testnet.newton.xyz/rpc` |
   | `1`, `8453` | `https://gateway.newton.xyz/rpc` |

   Bearer API key. JSON-RPC `id` is a UUID string. `timeout` is seconds.
   `function_signature` in the body is hex-encoded UTF-8 of the ABI string.
4. Allow is a non-zero `task_response.evaluation_result`. Pass `task`,
   `task_response`, and `signature_data` into `_validateAttestationDirect`.

## Handoff from `newton-policy`

Read `<policy-dir>/dist/policy-handoff.json` (or the path reported by
`newton-policy`). Schema and fields:
[references/handoff.md](references/handoff.md).

Consume that file; do not reconstruct chain ID, Policy / PolicyData,
entrypoint, params path, or `functionSignature` from chat when it exists.
If addresses are still `null`, implement and test locally; do not live-wire
until the policy skill fills them.

Write `client-handoff.json` at the Foundry project root after tests, and
again after live wiring (addresses, `policyId`, `ownerIsLoginWallet`,
registry, plus `userArgs` / `target` / `eip712` for a UI). Secrets upload
in `newton-policy` needs `policyClient` plus `ownerIsLoginWallet: true`.
If the user wants a frontend, hand off to `newton-demo` with that file.

## Completion report

Tell the user:

- Integration pattern chosen and why
- PolicyClient path and protected functions
- Intent encoding (target, selector, arguments, value)
- Test commands and results
- Paths of consumed `policy-handoff.json` and written `client-handoff.json`
- For live work: chain, client/policy/TaskManager addresses, `getOwner()`
  (should be the login wallet after transfer), registration state, gateway
  evaluate result if requested, and that later param/policy changes need a
  new client rather than mutating this one, without exposing secrets
- Friction or gaps discovered in the skill

## Out of scope

- Authoring or compiling Rego/WASM (use `newton-policy`)
- One-shot product demos from a customer brief, or a wallet UI for a wired
  PolicyClient (use `newton-demo`)
- Relayed/meta-transaction designs that break `intent.from == msg.sender`
- Dashboard/explorer UI
- MCP / plugin packaging
