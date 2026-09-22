# Parse a vault brief

Extract Product / Policy / App / Frontend / Scope the same way
`newton-demo` does, then classify the branch in
[SKILL.md](../SKILL.md) before copying a template.

## Branch

Record vendor, chain, existing vault address, protected manager action,
and pack ids. That record picks the template:

- MetaMorpho → Morpho branch (`run-morpho-e2e.ts`)
- Euler Earn → `shield.euler.reallocate`
- EVault → `shield.eulerVault.*`
- Superform → `shield` superform overlay
- DemoVault or no typed overlay → `send-call.ts`
- No vault address, or a Veda / BoringVault deploy → stop

## Product

Who is the shareholder vs the curator? Deposit and withdraw on an
ERC-4626 vault do **not** go through Shield. Newton gates the manager
call named in the brief (`reallocate` on Morpho and Euler Earn, a
governor call on EVault, `sendCall` when there is no overlay).

If the brief asks to gate deposits, stop and confirm.

## Policy

Published packs via `newton-cli policy packs` only. Bind the packs the
brief names, in that order. Do not scaffold a fresh HTTP oracle because
packs lookup failed — that is a CLI version problem
([orchestration.md](orchestration.md)).

`templates/policy/` is the Vaults.fyi and Chainalysis reference. A
`webacy` brief uses the same NPM1 envelope with `params.params.webacy`
and screens `prepareQueryOptions.webacy.address` (the pegged token).
Allow and deny are the same manager call with a different address.

The rest of this section is the Vaults.fyi / Morpho reference.

Vaults.fyi indexes production networks. On Base Sepolia the dummy vault
is not listed. `prepareQueryOptions.vaultsfyi` must override `network` +
`vaultAddress` to a Vaults.fyi-listed vault (usually Ethereum `mainnet`).
The Shield still reallocates the testnet dummy vault. Pick the listed
vault at run time (live site or `GET /v2/detailed-vaults?network=mainnet`).
The slug is `mainnet`, not `ethereum` (that path 403s). Do not invent a
listed address. A known listed example used in dogfood is in
[fixtures.md](fixtures.md); re-check it is still listed before using it.

Allocation-hash gate:

- Pack wasm_args: `lastKnownAllocationHash`
- VaultKit `prepareQueryOptions.vaultsfyi`: `previousAllocationHash`
- Omit or match → allow. Garbage hash + `deny_on_allocation_change` →
  deny reason `allocation_changed`

Keep other Vaults.fyi thresholds generous unless the brief tightens them
so they do not steal the demo.

## Two allocators

If the brief asks for two allocators (one passes, one fails), that is
**Chainalysis on identity**, not two Morpho Blue markets. Markets are
destinations. The Morpho vault still has **one** on-chain allocator: the
Shield clone. Humans are Shield delegates.

- Bind published `vaultsfyi` + `chainalysis`. Do not grant a second
  Morpho allocator EOA that reallocates around Newton.
- Screen `prepareQueryOptions.chainalysis.address`. The published pack
  does not bind this to `msg.sender`.
- Allow: screened address is the clean curator.
- Deny: screened address is a documented OFAC / Chainalysis sanctioned
  Ethereum address. Pick it at run time; do not invent one. Deny reason
  `chainalysis_sanctioned`.
- Dogfood may sign both attempts with the funded curator key.
- Turn Vaults.fyi's `deny_on_allocation_change` **off** so the hash
  fixture does not steal the story. Keep other Vaults.fyi thresholds
  generous. Still override `prepareQueryOptions.vaultsfyi` to a listed
  mainnet vault.
- Curator UI: allocator **dropdown** (clean vs sanctioned), then two
  destination CTAs (**Move funds to dummy market** / **Move funds back
  to idle**). Not Evaluate allow / Evaluate deny.

## App

VaultKit `createShield`. Intent `to` is the vault. Intent `from` is the
curator key and must equal `msg.sender`. Value is `0`. Newton `env` is
`prod`. No relayer. `functionSignature` comes from the policy handoff.
On the Morpho branch it is
`reallocate(((address,address,address,address,uint256),uint256)[])`.

## Frontend

Two views, one vault, on every branch:

1. **Shareholder** — connect, approve asset, `deposit`, show shares. No
   evaluate / attestation.
2. **Curator** — the branch's manager call through the Shield. Morpho
   two-allocator: an allocator dropdown, then destination CTAs (dummy vs
   idle). Other branches: one action labeled from the brief, then allow
   vs deny (task, blocked reason). API key stays on the server. Do not
   copy the Morpho dummy-versus-idle controls onto Euler, Superform, or
   `sendCall`.

Dogfood may use one wallet for both views if that key is already owner /
curator / allocator and a depositor.

## Scope

Confirm live policy deploy, Shield clone, role grant, secrets, mined
allow, deposit, and Vercel separately. Local simulate is not a live beat.
