# Vendor overlays vs `sendCall`

Pick **one** overlay from the brief. Do not mix Morpho `reallocate` with
wizard/Veda factory calls in the same script.

## Typed overlays

```typescript
import { morphoActions } from '@newton-xyz/vaultkit/vendors/morpho'
import { morphoBlueActions } from '@newton-xyz/vaultkit/vendors/morpho-blue'
import { eulerActions } from '@newton-xyz/vaultkit/vendors/euler'
import { eulerVaultActions } from '@newton-xyz/vaultkit/vendors/euler-vault'
import { superformActions } from '@newton-xyz/vaultkit/vendors/superform'
```

`extend(...)` throws if a namespace would collide. Install only the vendor
SDKs that overlay needs.

| Brief says | Overlay | Gold manager action |
|---|---|---|
| MetaMorpho / Morpho vault | `morphoActions` → `shield.morpho.*` | `reallocate(vault, allocations, options?)` |
| Morpho Blue sleeve | `morphoBlueActions` | position ops on the Blue overlay |
| Euler Earn | `eulerActions` → `shield.euler.*` | `reallocate(vault, [{ id, assets }], options?)` |
| EVault (Euler Vault Kit lending) | `eulerVaultActions` → `shield.eulerVault.*` | governor `setLTV` / `setCaps` / IRM |
| Superform SuperVault | `superformActions` | manager actions + typed hooks |
| DemoVault / unknown selector | none | `shield.sendCall(...)` |

Overlays wrap **manager** calls only. They do not wrap end-user ERC-4626
`deposit`, `mint`, `withdraw`, or `redeem`.

### Morpho `reallocate`

Positional `(vault, allocations, options?)`. Each allocation is Morpho
`marketParams` plus `assets`. Do not invent `marketParams`; take them from
the user, the vault's current allocation, or a named fixture they pointed
at.

Per-call policy inputs go in `prepareQueryOptions.<pack_id>`. Vaults.fyi
uses `previousAllocationHash`, `network`, and `vaultAddress`. Pack wasm_args
for the same idea use `lastKnownAllocationHash`. On testnets override
`network` + `vaultAddress` to a Vaults.fyi-listed production vault; do not
query the dummy. Add `chainalysis` (or other) slices only when that pack
is on the handoff.

### Euler Earn `reallocate`

Positional `(vault, allocations, options?)`. Each allocation is
`{ id: marketAddress, assets }`. Wrong overlay (Earn vs EVault) produces
unexpected calldata — do not guess.

## `sendCall` escape hatch

Use when VaultKit has no typed helper for this vendor/action. Encode
`data` with viem `encodeFunctionData` from the vault ABI and the same
`functionSignature` as the policy intent. Do not hand-write hex.

When allow and deny differ only by a pack input, send the same calldata
twice and change `prepareQueryOptions.<pack_id>` (`webacy.address` is the
pegged token, `chainalysis.address` is the screened allocator).

```typescript
await shield.sendCall(
  {
    to: vault,
    data: encodedCalldata,
    functionSignature: handoff.intent.functionSignature,
    prepareQueryOptions: {
      /* per pack id, only for modules that ship prepareQuery */
    },
    wasmArgs: {
      /* per pack id, only for modules with no prepareQuery */
    },
  },
  'DIRECT',
  30_000,
)
```

`functionSignature` must match the policy's intent string. Prefer the
named UTF-8 form from `policy-handoff.json` when present.

Do not pass both a stray `wasmArgs` slice and a `prepareQuery` for the
same module hoping they merge — they do not. Packs with `prepareQuery`
own that slice. Packs without it take `wasmArgs` (VaultKit ≥ 2.2.0).
Empty `{}` for a required slice throws `InvalidConfigurationError`.

Template: [templates/send-call.ts](../templates/send-call.ts).
