---
name: newton-vault-demo
description: >-
  Orchestrate any vault brief: bind the brief's published packs with
  newton-policy, attach a VaultKit Shield with newton-vault-shield, prove one
  allow plus assertIntentBlocked deny, and optionally scaffold a two-view
  local Next.js app. Morpho + Vaults.fyi is the filled reference branch.
  Euler, Superform, and sendCall (DemoVault or any selector without a typed
  overlay) are other branches of this skill. Use when the brief is Morpho,
  Euler, Superform, DemoVault, Shield, vaultsfyi, webacy, chainalysis, or
  newton-morpho-shield-brief. Do not inherit NewtonPolicyClient on a vault
  Newton does not own. Headless wizard / Veda factory is not shipped.
---

# Newton Vault Demo

> **Status:** Draft v0 under active dogfood testing. Expect gaps and report
> friction instead of silently working around it.

Conduct a vault brief from product copy to a runnable beat. This skill does
not replace `newton-policy` or `newton-vault-shield`. It classifies the
brief, runs the shared attach traps on every branch, and copies one vendor
template. Morpho + Vaults.fyi is the filled reference, not the only path.

Do **not** load `newton-demo` for Shield UI. That skill's Next app is a
PolicyClient + EIP-712 `evaluateIntentDirect` wrapper. A vault Newton does
not own will not take `NewtonPolicyClient`.

## Choose the branch first

Classify before copying any template. Do not copy
[templates/run-morpho-e2e.ts](templates/run-morpho-e2e.ts) unless the brief
is Morpho.

| Brief | Branch | Template and action |
|---|---|---|
| Existing MetaMorpho / dummy Morpho vault | **Morpho** | [templates/run-morpho-e2e.ts](templates/run-morpho-e2e.ts). `shield.morpho.reallocate`. Filled UI: [`dummy-morpho-vault-demo`](https://github.com/newt-foundation/dummy-morpho-vault-demo). Gold brief: [`newton-morpho-shield-brief.txt`](../../newton-morpho-shield-brief.txt). |
| Euler Earn | **Euler** | `eulerActions` → `shield.euler.reallocate`. See [newton-vault-shield vendors.md](../newton-vault-shield/references/vendors.md). |
| Euler Vault Kit (EVault) | **EVault** | `eulerVaultActions` → governor `setLTV` / `setCaps` / IRM. |
| Superform SuperVault | **Superform** | `superformActions`. Manager action named in the brief. |
| DemoVault, or any vault/action with no typed overlay | **sendCall** | [newton-vault-shield templates/send-call.ts](../newton-vault-shield/templates/send-call.ts). Encode calldata from the vault ABI. `prepareQueryOptions.<pack_id>` comes from that pack. |
| No vault yet; Veda factory, BoringVault, headless wizard | **Stop** | `newton-vault-wizard` is not shipped. Do not invent a factory flow. |
| Solidity wrapper the user controls | **Wrong skill** | `newton-demo` + `newton-policy-client`. |

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
- Pack secret **names** the policy requires. `vaultsfyi`: `VAULTS_FYI_API_KEY`
  (local alias `VAULTSFYI_API_KEY`). `chainalysis`: `CHAINALYSIS_SANCTIONS_KEY`.
  `webacy`: `WEBACY_API_KEY`. Names come from the pack's `SecretsSchema`
- Chain. Newton gateway `env` is always `prod`
- RPC. Ethereum Sepolia and Base Sepolia have documented public defaults
  ([credentials.md](references/credentials.md)). If `RPC_URL` is Ethereum
  Sepolia while the brief is `84532`, do not send txs there — use the Base
  Sepolia default
- Existing vault address. If the brief has no vault, stop (wizard is not shipped)

On the first turn also check:

```bash
newton-cli policy packs --help
```

If the subcommand is missing, stop. The agent needs a `newton-cli` that
ships `policy packs` (0.5.4+). Do not scaffold a fresh HTTP oracle as a
workaround.

## Workflow

1. Parse the brief ([brief.md](references/brief.md)) and pick the branch
   above. Confirm product / policy / app / frontend / scope. Missing
   decisions → stop. No vault address → stop.
2. Load `newton-policy`. Bind only the published packs the brief names
   (`policy packs`), in handoff order. `definePolicy().with(...).with(...)`
   is **one expression**. Reassigning `policy = policy.with(next)` fails
   typecheck because `PolicyDraft` tuples are fixed-length
   ([orchestration.md](references/orchestration.md)). Copy the NPM1 envelope
   shape ([params-envelope.md](references/params-envelope.md)).
   [templates/policy/](templates/policy/) is the Vaults.fyi and Chainalysis
   reference. For any other pack, keep `params.params.<pack_id>` and author
   the deny rule from that pack's published schema. Local simulate allow vs
   deny against the stub `policy.js` before any deploy.
3. Load `newton-vault-shield` and copy **that branch's** template. Run
   [attach-traps.md](references/attach-traps.md) and
   [secrets-and-owner.md](references/secrets-and-owner.md) on every branch,
   even when they contradict `newton-vault-shield`. The Morpho market and
   `reallocate` signature sections apply only to the Morpho branch.
4. Prove the gate with explicit confirmation: one mined allow, one
   `assertIntentBlocked` deny (no mined deny tx). The action is the
   branch's manager call. Shareholder deposits are ordinary ERC-4626 and
   are not Newton-gated.
5. Optional UI ([frontend.md](references/frontend.md)). Morpho branch:
   clone [`dummy-morpho-vault-demo`](https://github.com/newt-foundation/dummy-morpho-vault-demo)
   for the filled dummy, or copy [templates/app/](templates/app/). Other
   branches: do not copy the dummy-versus-idle curator. `next dev` only.
   No Vercel unless the user asked.

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
| `functionSignature` | From the policy handoff. Morpho branch only: `reallocate(((address,address,address,address,uint256),uint256)[])` |
| Pack inputs | `prepareQueryOptions.<pack_id>` for packs that ship `prepareQuery`. Webacy screens `address` (the pegged token). Chainalysis screens `address` (the allocator). Same calldata twice when the gate is that input |
| Vaults.fyi on testnet | Only when `vaultsfyi` is bound. `prepareQueryOptions.vaultsfyi.{network,vaultAddress,previousAllocationHash}` pointing at a **listed mainnet** vault. Pack wasm_args use `lastKnownAllocationHash` |
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
- Adding a pack the brief did not name
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
