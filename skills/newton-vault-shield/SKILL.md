---
name: newton-vault-shield
description: >-
  Attach a Newton Shield clone to a vault Newton does not own (Morpho
  MetaMorpho, Euler Earn, Superform, or a toy DemoVault) with VaultKit
  createShield. Consume newton-policy policy-handoff.json, grant the vendor
  role, setParams / uploadSecrets, and prove one typed allow plus one deny.
  Use when gating curator or manager actions on an existing vault. Do not
  inherit NewtonPolicyClient on Morpho or Euler, add newton-cli vault/shield,
  or deploy a Veda/BoringVault.
---

# Newton Vault Shield

> **Status:** Draft v0 under active dogfood testing. Expect gaps and report
> friction instead of silently working around it.

Sit a Shield clone between a curator and a vault Newton does not own.
This skill does not author Rego or WASM; use `newton-policy` for that.
Do not inherit `NewtonPolicyClient` on Morpho / Euler / Superform — those
protocols will not take that mixin. The Shield *is* the PolicyClient.

A one-shot wallet UI for Shield is `newton-vault-demo`, not `newton-demo`.
The gold path here is typed allow + `assertIntentBlocked` deny, not a
Next app. Headless wizard / Veda factory work is out of scope
(`newton-vault-wizard`, not this skill).

## Choose the workflow first

1. **Local attach script:** copy templates, load the policy handoff, typecheck.
2. **Live attach:** `createShield` (clone deploy or idempotent attach),
   `setParams`, `uploadSecrets`, vendor role grant — only with explicit
   confirmation.
3. **Prove the gate:** one typed allow (mined) and one deny
   (`assertIntentBlocked`, no mined tx).

On the first turn, tell the user they will eventually need (names only; do
not ask for values yet):

- A funded curator `PRIVATE_KEY` in the process environment or
  `~/.newton/.env` (VaultKit `walletClient`; not the dashboard login wallet)
- A Newton gateway API key from `newton-cli keys` (`NEWTON_API_KEY`)
- Target chain. Newton gateway `env` is always `prod` (testnet production
  on Sepolia / Base Sepolia)
- RPC endpoint. On Ethereum Sepolia (`11155111`), this skill uses
  `https://ethereum-sepolia-rpc.publicnode.com` unless `RPC_URL` is already
  set. On Base Sepolia (`84532`), use
  `https://base-sepolia-rpc.publicnode.com` unless `RPC_URL` is already a
  Base Sepolia URL. If `RPC_URL` is Ethereum Sepolia while the brief is
  `84532`, do not send txs there. Always pass `allowNewVersion: true` on
  `createShield` (public RPCs cap `eth_getLogs`). Other chains still need
  an injected `RPC_URL` — do not invent a URL
- The existing **vault address** (Morpho MetaMorpho, Euler Earn, Superform,
  or DemoVault). Do not invent it
- A deployed `NewtonPolicy` in `policy-handoff.json` (`policy` filled). If
  `policy` is still `null`, hand off to `newton-policy` for deploy before
  live `createShield`
- Per-pack oracle secrets the policy requires (for example
  `VAULTSFYI_API_KEY`). Upload through `shield.uploadSecrets`, never chat
- Authority to grant the Shield a vault role (allocator / curator / …). If
  this key is not the vault owner, stop and tell the user who must sign
  the grant

Do not invent contract addresses, chain IDs, vault addresses, market
params, or private keys. Copying templates and typechecking can proceed
before deploy secrets exist.

If the Policy does not exist yet, run or hand off to `newton-policy`
(published packs + composites) before live attach. Do not resolve
PolicyData from chat or GitHub; that skill already used
`newton-cli policy packs`.

## Credential safety

Read [references/credentials.md](references/credentials.md). Short form:

- Never ask the user to paste a dashboard JWT, private key, API key, or RPC
  credential into chat
- Never put credentials in source files, committed files, or a
  project-local `.env`
- Prefer existing local credentials from the process environment and
  `~/.newton/.env`
- Never source a project-local `.env`, a `.env` beside a user-specified CLI
  binary, another repo checkout, or shell rc files
- Verify only whether required variables are set; never print their values
- Never invent private keys, credential-bearing RPC URLs, contract
  addresses, chain IDs, or expiration values. Ethereum Sepolia may use
  `https://ethereum-sepolia-rpc.publicnode.com` when `RPC_URL` is unset

## Core sequence

```text
require policy-handoff.json with policy filled
  → definePolicy({ chainId, env: 'prod' }).with(...) per packs[]
  → copy templates into shields/<slug>/ (gitignored in this repo)
  → createShield({ vault, policy, policyAddress })
  → grant vendor role to shield.policyClientAddress
  → setParams / uploadSecrets
  → typed allow (mined)
  → assertIntentBlocked deny (no mined tx)
  → write shield-handoff.json
```

Read in this order:

1. [references/handoff.md](references/handoff.md)
2. [references/attach-and-roles.md](references/attach-and-roles.md)
3. [references/vendors.md](references/vendors.md)
4. [references/allow-and-deny.md](references/allow-and-deny.md)
5. [references/credentials.md](references/credentials.md)

Copy these into the user's attach directory (default `shields/<slug>/`,
gitignored here). Do not vendor VaultKit, Morpho, or Euler source into
this skills repo:

| Template | Destination |
|---|---|
| [templates/package.json](templates/package.json) | project root (merge if present) |
| [templates/tsconfig.json](templates/tsconfig.json) | project root |
| [templates/.env.example](templates/.env.example) | checklist only; inject real values in process env or `~/.newton/.env` |
| [templates/attach-morpho.ts](templates/attach-morpho.ts) | Morpho gold path |
| [templates/send-call.ts](templates/send-call.ts) | DemoVault / unknown vendor (`sendCall` escape hatch) |
| [templates/shield-handoff.json](templates/shield-handoff.json) | fill after attach / allow / deny |

Canonical docs (do not scrape GitHub for addresses):

- [VaultKit overview](https://docs.newton.xyz/developers/vaults/sdk/overview)
- [Integration guide](https://docs.newton.xyz/developers/vaults/sdk/integration-guide)
- [Morpho](https://docs.newton.xyz/developers/vaults/sdk/morpho)
- [Policies](https://docs.newton.xyz/developers/vaults/sdk/policies)
- [Reference](https://docs.newton.xyz/developers/vaults/sdk/reference)

## Inspect the brief

Before writing TypeScript, determine:

- Vendor: MetaMorpho, Euler Earn, EVault, Superform, or generic/`sendCall`
- Vault address and chain
- Protected manager action (`reallocate`, cap change, …). End-user
  `deposit` / `withdraw` are **not** this skill
- Which published packs the policy already bound (`packs[]` on the handoff)
- Who can grant the Shield a vault role

If the brief names packs but there is no `policy-handoff.json`, load
`newton-policy` first. This skill does not run `policy packs show`.

## Live attach checkpoint

After the script typechecks, if the user asked to attach on-chain:

1. Reuse Policy / packs / RPC / signer from the policy handoff, process
   environment, or `~/.newton/.env`
2. Stop if `policy` in the handoff is `null`
3. Stop if `PRIVATE_KEY` or `NEWTON_API_KEY` is missing. If `RPC_URL` is
   unset, Ethereum Sepolia may use the PublicNode URL above and Base
   Sepolia may use `https://base-sepolia-rpc.publicnode.com`. If `RPC_URL`
   is unset on any other chain, stop
4. Stop if the vault address is unknown
5. Summarize chain, vault, policy, `definePolicy` modules, clone deploy vs
   attach, `setParams`, secrets **names** (not values), and the role grant
6. Wait for explicit confirmation
7. `createShield` → role grant → `setParams` → `uploadSecrets` → verify
   `client.policy` / `client.verification`
8. Typed allow, then `assertIntentBlocked` deny
9. Write `shield-handoff.json`

Do **not** use `newton-cli policy-client`, `newton-cli task`, or a
`newton-cli vault` / `shield` subcommand. Do **not** call
`newton-cli secrets upload` for this path; VaultKit
`shield.uploadSecrets` encrypts and uploads with `NEWTON_API_KEY`.

Gateway `uploadSecrets` still matches the API-key dashboard identity to
Shield `getOwner()`. If they differ, follow
[`newton-vault-demo` secrets-and-owner.md](../newton-vault-demo/references/secrets-and-owner.md):
`setParams` and `setApprovedDelegate` while the curator still owns the
clone, then `setPolicyClientOwner(dashboardWallet)` (or use a
curator-owned API key). After that transfer the curator cannot
`setParams` on that version.

## Completion report

Tell the user:

- Vendor, vault address, chain, and protected action
- Path of consumed `policy-handoff.json` and written `shield-handoff.json`
- `shield.policyClientAddress`, bound Policy, pack ids (from the handoff,
  not from chat)
- Role granted (or who must grant it)
- Allow: transaction hash + task id. Deny: `assertIntentBlocked` reason +
  task id (no transaction hash)
- Env var **names** used (`PRIVATE_KEY`, `RPC_URL`, `NEWTON_API_KEY`,
  pack secret names). Never values
- Friction or gaps discovered in the skill or VaultKit

## Dogfood scenarios

1. **Morpho attach:** “gate this MetaMorpho `reallocate` with vaultsfyi;
   show allow vs deny” on Base Sepolia (`84532`) after `newton-policy`
   deployed the Policy. Clone + role + mined allow + blocked deny +
   handoff. Wallet UI for that brief is `newton-vault-demo`.
2. **Composite:** same vault with `vaultsfyi` + `chainalysis` modules
   matching the policy handoff `packs[]` order on-chain.
3. **Generic `sendCall`:** toy DemoVault or a vendor overlay this skill
   does not wrap yet. Integration owns calldata integrity.

## Out of scope

- Authoring or compiling Rego/WASM (use `newton-policy`)
- Inheriting `NewtonPolicyClient` on Morpho / Euler / Superform (use this
  skill, not `newton-policy-client`)
- Deploying a Veda / BoringVault / wizard factory (not this skill)
- Adding `newton-cli vault` or `newton-cli shield`
- Vendoring VaultKit, policy-pack, or vendor SDK source into this repo
- Agent-as-curator / production allocator bots
- Two-view Next.js shareholder/curator UI (`newton-vault-demo`)
- Dashboard / explorer UI, MCP packaging
