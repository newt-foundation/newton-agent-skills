# Parse a vault brief

Extract Product / Policy / App / Frontend / Scope the same way
`newton-demo` does, then classify the vault path.

## Product

Who is the shareholder vs the curator? Deposit and withdraw on Morpho
MetaMorpho are ordinary ERC-4626. They do **not** go through Shield.
Newton typically gates manager calls (`reallocate` is the Morpho gold
path), not `deposit`.

If the brief asks to gate deposits, stop and confirm. That is not the
Morpho attach gold path.

## Policy

Published packs via `newton-cli policy packs` only. Do not scaffold a
fresh HTTP oracle because packs lookup failed — that is a CLI version
problem ([orchestration.md](orchestration.md)).

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

## App

VaultKit `createShield`. Intent `to` is the MetaMorpho vault. Intent
`from` is the curator key and must equal `msg.sender`. Value is `0`.
Newton `env` is `prod`. No relayer.

## Frontend

Two views, one vault:

1. **Shareholder** — connect, approve asset, `deposit`, show shares. No
   evaluate / attestation.
2. **Curator** — reallocate through the Shield. Show allow vs deny
   (task, blocked reason). API key stays on the server.

Dogfood may use one wallet for both views if that key is already owner /
curator / allocator and a depositor.

## Scope

Confirm live policy deploy, Shield clone, role grant, secrets, mined
allow, deposit, and Vercel separately. Local simulate is not a live beat.
