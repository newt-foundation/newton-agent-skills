---
name: newton-policy-client
description: >-
  Integrate Newton policy enforcement into a Solidity contract you control
  by inheriting NewtonPolicyClient, binding attested intents, validating with
  _validateAttestationDirect, wiring setPolicies with cast, and submitting
  evaluations by signing an EIP-712 intent and POSTing newt_createTask to the
  chain's gateway. Use when adding a PolicyClient to an app contract you can
  change. Do not inherit this mixin on Morpho, Euler, or Superform (use
  newton-vault-shield). Do not use newton-cli policy-client or newton-cli task.
---

# Newton PolicyClient

> **Status:** Draft v0 under active dogfood testing. Expect gaps and report
> friction instead of silently working around it.

Add Newton enforcement to a smart contract **you control**. This skill
does not author Rego or WASM; use `newton-policy` for that. To attach a
Shield clone to Morpho / Euler / Superform / DemoVault (a vault Newton
does not own), use `newton-vault-shield` — do not inherit
`NewtonPolicyClient` on those protocols. For a one-shot brief or a wallet
UI on a wired PolicyClient, use `newton-demo`. For a Shield / Morpho vault
UI, use `newton-vault-demo`. Do not assume a vertical
(stablecoin, vaults, wallets) unless the user specifies one.

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

If a Policy does not exist yet, run or hand off to `newton-policy` before
live `setPolicies`. A client binds an ordered set of 1–8 already deployed
Policies. Local client implementation can proceed in parallel once the
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
  → setPolicies (ordered set, 1–8) via cast (local key)
  → optional registry registerClient via cast (local key)
  → setPolicyClientOwner(login wallet) via cast
  → verify getPolicySetSnapshot
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
- Past verdicts for a client, read from TaskManager logs (dashboards):
  [references/reading-results.md](references/reading-results.md)
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

Constructor/`initialize` calls `_initNewtonPolicyClient(taskManager, owner)`.
Leave the policy set empty there. The owner calls `setPolicies` after
deployment. `_initPolicies` is only for a later initializer that already
has the specs; an empty list defers configuration. Do not call
`setPolicyAddress` or `setPolicy`. Those are the pre-0.7 single-policy
calls. `setPolicies` replaces the whole ordered set (1–8). Every policy
must allow. Do not sort or deduplicate entries.

Protocol addresses: `newton-cli --chain-id <id> deployments show` for
TaskManager and PolicyClientRegistry. Policy addresses come from
`newton-policy` or the user. Each Policy carries at most one WASM.

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
3. Summarize chain, constructor args (owner = local key), the `setPolicies`
   set (addresses in order, each `expireAfter`), register txs, and the later
   `setPolicyClientOwner` to the login wallet.
4. Wait for explicit confirmation.
5. Deploy, `setPolicies`, optionally register, transfer owner, then verify
   `getPolicySetSnapshot()`.

Do **not** set the constructor owner to the login wallet. Then `setPolicies`
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
2. `setPolicies` via `cast send` while that key is still owner. Pass the
   complete ordered set (1–8). Each entry is `(policy, (params, expireAfter))`
   with `expireAfter > 0`.
3. Optional `registerClient` on PolicyClientRegistry via `cast send`.
4. `setPolicyClientOwner(loginWallet)` via `cast send`.
5. Verify `getOwner()` is the login wallet and `getPolicySetSnapshot()`
   matches the set. Then `newton-policy` may upload secrets.

Registry `setClientOwner` is **not** that call. It changes the
PolicyClientRegistry record owner, not PolicyClient `getOwner()`. Secrets,
`setPolicies`, and `setPolicyClientOwner` all use `getOwner()`. The two owners
can diverge if you transfer one and not the other. If the client is
registered and you move contract ownership, also update the registry record
so they match — they are not substitutes.

That last `setPolicyClientOwner` step is not repeatable from the local key
after transfer. The login wallet can still call `setPolicies` on this same
client. A routine param or membership change does **not** need a new client.

`setPolicies` replaces the entire set. Pass every entry you want to keep,
including unchanged ones. Every successful call increments `policyRevision`,
including an identical replacement, and the new `policyId` invalidates old
attestations. Reordering changes the id. Cap is 8 (`TooManyPolicies`). An
empty set reverts (`EmptyPolicySet`). Do not sort or deduplicate; repeated
addresses stay separate entries.

After the transfer, this skill cannot sign `setPolicies` (dashboard Turnkey /
MetaMask). Stop and tell the user the owner must sign that replacement.
Do not deploy a second client to avoid that signature.

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
4. Allow is `task_response.allowed` (true only when every policy in the set
   allowed). Pass `task`, `task_response`, and `signature_data` into
   `_validateAttestationDirect`.

## Handoff from `newton-policy`

Read `<policy-dir>/dist/policy-handoff.json` (or the path reported by
`newton-policy`). Schema and fields:
[references/handoff.md](references/handoff.md).

Consume that file; do not reconstruct chain ID, Policy addresses,
entrypoint, params path, or `functionSignature` from chat when it exists.
A set is several handoffs in order, capped at 8.
If addresses are still `null`, implement and test locally; do not live-wire
until the policy skill fills them.

Write `client-handoff.json` at the Foundry project root after tests, and
again after live wiring (ordered `policies`, `policyId`, `policyRevision`,
`ownerIsLoginWallet`, registry, plus `userArgs` / `target` / `eip712` for a
UI). Secrets upload in `newton-policy` needs `policyClient`, each Policy
address whose WASM calls `getSecrets()`, and `ownerIsLoginWallet: true`.
If the user wants a frontend, hand off to `newton-demo` with that file.

## Completion report

Tell the user:

- Integration pattern chosen and why
- PolicyClient path and protected functions
- Intent encoding (target, selector, arguments, value)
- Test commands and results
- Paths of consumed `policy-handoff.json` and written `client-handoff.json`
- For live work: chain, client address, ordered policy addresses,
  `policyId` / `policyRevision` from `getPolicySetSnapshot()`, TaskManager,
  `getOwner()` (login wallet after transfer), registration state, and
  gateway evaluate result if requested, without exposing secrets. Later
  set changes are another `setPolicies` by the current owner on this client.
- Friction or gaps discovered in the skill

## Out of scope

- Authoring or compiling Rego/WASM (use `newton-policy`)
- Attaching to Morpho / Euler / Superform / DemoVault (use
  `newton-vault-shield`; those vaults do not inherit this mixin)
- One-shot product demos from a customer brief, or a wallet UI for a wired
  PolicyClient (use `newton-demo`)
- Relayed/meta-transaction designs that break `intent.from == msg.sender`
- Dashboard/explorer UI
- MCP / plugin packaging
