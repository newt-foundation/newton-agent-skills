---
name: newton-vault-demo
description: >-
  Orchestrate a vault-platform demo from a customer brief: bind published
  packs with newton-policy, attach a VaultKit Shield with newton-vault-shield,
  prove typed allow plus assertIntentBlocked deny, and optionally scaffold a
  two-view local Next.js app (ungated shareholder deposit vs Shield-gated
  curator reallocate). Use when the brief is Morpho, Euler, Superform, Shield,
  vaultsfyi, or newton-morpho-shield-brief. Do not inherit NewtonPolicyClient
  on Morpho. Headless wizard / Veda factory is newton-vault-wizard (not shipped).
---

# Newton Vault Demo

> **Status:** Draft v0 under active dogfood testing. Expect gaps and report
> friction instead of silently working around it.

Conduct a vault brief from product copy to a runnable beat. This skill does
not replace `newton-policy` or `newton-vault-shield`. It chooses a path,
overrides sibling traps that fail a first-time Morpho + Vaults.fyi attach,
and optionally copies a two-view wallet UI.

Do **not** load `newton-demo` for Shield UI. That skill's Next app is a
PolicyClient + EIP-712 `evaluateIntentDirect` wrapper. Morpho will not take
`NewtonPolicyClient`.

## Choose the path first

| Brief | Path |
|---|---|
| Existing Morpho / Euler / Superform / dummy MetaMorpho | **Attach** (`newton-vault-shield` after `newton-policy` packs). Gold for [`newton-morpho-shield-brief.txt`](../../newton-morpho-shield-brief.txt). |
| Headless wizard, Veda factory, BoringVault deploy | **Wizard.** `newton-vault-wizard` is not shipped (NEWT-2555). Stop. Do not invent a factory flow. |
| Solidity wrapper the user controls | Wrong skill. Use `newton-demo` + `newton-policy-client`. |

Resume existing `policy-handoff.json`, `shield-handoff.json`, and
`demos/<slug>/demo-config.json` before scaffolding. Do not invent vault,
policy, market, or listed Vaults.fyi addresses. Reuse a dummy vault the
brief names; leftovers from this repo's dogfood are in
[fixtures.md](references/fixtures.md) and are reuse-only. The filled
dummy Morpho ndUSDC Next app lives in
[`dummy-morpho-vault-demo`](https://github.com/newt-foundation/dummy-morpho-vault-demo),
not under `demos/` here.

## Credentials (first turn)

Names only. Never ask for values, never print them.

- Funded curator `PRIVATE_KEY` (`~/.newton/.env` or process env)
- Gateway key from `newton-cli keys`, injected as **both** `API_KEY` and
  `NEWTON_API_KEY` ([credentials.md](references/credentials.md))
- Pack secret **names** the policy requires (`VAULTS_FYI_API_KEY`; accept
  local alias `VAULTSFYI_API_KEY`. If the brief names `chainalysis`, also
  `CHAINALYSIS_SANCTIONS_KEY`)
- Chain. Newton gateway `env` is always `prod`
- RPC. Ethereum Sepolia and Base Sepolia have documented public defaults
  ([credentials.md](references/credentials.md)). If `RPC_URL` is Ethereum
  Sepolia while the brief is `84532`, do not send txs there — use the Base
  Sepolia default
- Existing vault address (or confirmation to create a tiny dummy vault)

On the first turn also check:

```bash
newton-cli policy packs --help
```

If the subcommand is missing, stop. The agent needs a `newton-cli` that
ships `policy packs` (0.5.4+). Do not scaffold a fresh HTTP oracle as a
workaround.

## Workflow

1. Parse the brief ([brief.md](references/brief.md)). Confirm product /
   policy / app / frontend / scope. Missing decisions → stop.
2. Load `newton-policy`. Bind published packs only (`policy packs`). Copy
   [templates/policy/](templates/policy/) into the policy dir so
   `params_schema.json` accepts the VaultKit NPM1 envelope, Rego reads
   `data.params.params.vaultsfyi`, and intent uses the VaultKit
   `functionSignature` ([params-envelope.md](references/params-envelope.md)).
   Local simulate allow vs deny against the stub `policy.js` before any
   deploy. Vaults.fyi-only: omit / matching allocation hash vs
   `deadbeef` → `allocation_changed`. Two-allocator / chainalysis: clean
   address vs sanctioned address → `chainalysis_sanctioned`.
3. Load `newton-vault-shield`. Copy
   [templates/run-morpho-e2e.ts](templates/run-morpho-e2e.ts) over the
   Morpho skeleton. Follow [attach-traps.md](references/attach-traps.md)
   and [secrets-and-owner.md](references/secrets-and-owner.md) even when
   they contradict `newton-vault-shield` — those overrides are from live
   gateway behavior.
4. Prove the gate with explicit confirmation: one mined typed
   `reallocate` allow, one `assertIntentBlocked` deny (no mined deny tx).
   Shareholder deposits are ordinary ERC-4626 and are not Newton-gated.
5. Optional UI: copy [templates/app/](templates/app/) to `demos/<slug>/`
   ([frontend.md](references/frontend.md)). For the filled dummy Morpho
   vault, clone
   [`dummy-morpho-vault-demo`](https://github.com/newt-foundation/dummy-morpho-vault-demo)
   instead of scaffolding a second copy. `next dev` only. No Vercel
   unless the user asked.

## Sibling overrides (do not "fix" by ignoring)

If a loaded skill disagrees, this table wins for vault demos:

| Topic | Do this |
|---|---|
| UI | Two-view app in this skill, not `newton-demo` |
| Base Sepolia RPC | Documented public URLs in [credentials.md](references/credentials.md) |
| `createShield` logs | `allowNewVersion: true` (public RPCs cap `eth_getLogs`) |
| Addresses | `getAddress()` before VaultKit |
| `setParams` schema | NPM1 envelope; see [params-envelope.md](references/params-envelope.md) |
| Secrets owner | Gateway matches API-key identity to Shield `getOwner()`. Transfer owner **or** use a curator-owned API key, then `setApprovedDelegate`. See [secrets-and-owner.md](references/secrets-and-owner.md) |
| `functionSignature` | `reallocate(((address,address,address,address,uint256),uint256)[])` |
| Vaults.fyi on testnet | `prepareQueryOptions.vaultsfyi.{network,vaultAddress,previousAllocationHash}` pointing at a **listed mainnet** vault. Pack wasm_args use `lastKnownAllocationHash` |
| CLI simulate | Unnamed VaultKit signature (or its ASCII hex). Named nested ABI fails parse |

## Checkpoints

Stop and get confirmation before:

| Checkpoint | Why |
|---|---|
| Missing product decisions | Do not invent markets, packs, or listed vaults |
| Live policy deploy | Uploads artifacts and spends gas |
| `createShield` / new Shield **version** | Clone deploy. Bump version when a prior clone's owner was transferred |
| Role grant / `setParams` / owner transfer / `uploadSecrets` | Binds the vault and gateway secrets |
| First gateway evaluate / mined allow | Uses the API key and moves vault allocations |
| Shareholder deposit | Moves the user's test USDC |
| Vercel | Out of scope unless asked |

## Out of scope

- `newton-cli vault` / `newton-cli shield`
- Inheriting `NewtonPolicyClient` on Morpho / Euler / Superform
- webacy unless the brief names it (chainalysis is in when the brief names two allocators / `chainalysis`)
- Wizard / Veda / BoringVault (`newton-vault-wizard`)
- Putting `NEWTON_API_KEY` in the browser or `NEXT_PUBLIC_*`
- Committing `policies/`, `shields/`, or `demos/` in this skills repo

## References

- [brief.md](references/brief.md) — parse vault briefs
- [orchestration.md](references/orchestration.md) — resume, order, CLI
- [credentials.md](references/credentials.md) — keys, RPC, injection
- [params-envelope.md](references/params-envelope.md) — VaultKit NPM1 schema
- [secrets-and-owner.md](references/secrets-and-owner.md) — uploadSecrets owner
- [attach-traps.md](references/attach-traps.md) — checksum, logs, roles, packs
- [frontend.md](references/frontend.md) — two-view Next app
- [handoff.md](references/handoff.md) — `demo-config.json`
- [fixtures.md](references/fixtures.md) — optional Base Sepolia leftovers
