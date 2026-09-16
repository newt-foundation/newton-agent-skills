# Create or attach a Shield, then grant a vault role

Use only after the policy handoff has a filled `policy` address, and only
with explicit user approval for live transactions.

## Install

Node 22+. Do not vendor these packages into the skills repo.

```bash
pnpm add @newton-xyz/vaultkit @newton-xyz/policy-core viem zod
```

Add one published pack package per `packs[].id` on the handoff, for
example:

```bash
pnpm add @newton-xyz/policy-pack-vaultsfyi
pnpm add @newton-xyz/policy-pack-chainalysis
```

Vendor overlays are optional peer dependencies. Morpho typed actions need:

```bash
pnpm add @morpho-org/blue-sdk @morpho-org/blue-sdk-viem @morpho-org/morpho-ts
```

`@newton-xyz/policy-pack-shared` is not part of VaultKit 2.x. Policy
manifest helpers live in `@newton-xyz/policy-core`.

## Declare the policy

`definePolicy` is synchronous and chainless. `env` is always `'prod'`.
`chainId` is a string matching the policy handoff.

```typescript
import { definePolicy } from '@newton-xyz/vaultkit'
import { vaultsfyi } from '@newton-xyz/policy-pack-vaultsfyi'

const policy = definePolicy({
  chainId: String(handoff.chainId),
  env: 'prod',
}).with(vaultsfyi)
```

Add `.with(...)` once per pack id. Do not invent a pack the handoff did
not list. Duplicate short ids are rejected.

For a fresh-oracle / monolithic policy (`packs` empty), use
`policyFromAddress` and omit `policyAddress` on `createShield`:

```typescript
import { policyFromAddress } from '@newton-xyz/vaultkit'

const policy = policyFromAddress({
  address: handoff.policy,
  chainId: String(handoff.chainId),
  env: 'prod',
})
```

## `createShield`

```typescript
import { createShield } from '@newton-xyz/vaultkit'
import { morphoActions } from '@newton-xyz/vaultkit/vendors/morpho'

const shield = (await createShield({
  apiKey: process.env.NEWTON_API_KEY!,
  walletClient,
  publicClient,
  rpc: process.env.RPC_URL!,
  vault: handoffVault,
  policy,
  policyAddress: handoff.policy,
})).extend(morphoActions)
```

Supported chain ids: `1`, `8453`, `11155111`, `84532`. Wallet client chain
must match.

`createShield` is idempotent: it attaches to an existing compatible clone
or deploys a new one through `ShieldFactory`. Record
`shield.policyClientAddress`.

| Flag | When to use |
|---|---|
| `mustDeploy: true` | Fail instead of attaching to an existing clone |
| `version` | Fresh clone after a botched first bind (default `0n`) |
| `attachWithoutVerify: true` | Recovery only; immediately `setParams`, then remove the flag and `reverify()` |
| `expectedParams` | Require canonical byte equality of stored params at attach |
| `bypassDelaySeconds` | Clone config; default seven days, minimum one day |

Do not leave `attachWithoutVerify` on for a normal run.

After attach, inspect:

```typescript
shield.policy.address
shield.policy.modules
shield.verification
await shield.reverify()
```

Verification rungs: address → oracle set / WASM CIDs → params decode →
optional exact `expectedParams` bytes. A module-set mismatch vs
`getPolicyData()` throws before a vault action.

## Two authorization gates

Newton approving an intent is not enough. The forwarded call still needs
the vendor's role.

1. **Shield delegate** — who may call `execute` / `executeDirect`. The
   curator key is approved at clone init. After an ownership change, call
   `setApprovedDelegate(executor, true)` on the Shield.
2. **Vault role** — who the vault believes is curator / allocator /
   governor. Grant `shield.policyClientAddress` using the vendor's own
   governance. VaultKit does not bypass that.

If `setParams` works but `reallocate` reverts, check the vault role first.

### Morpho MetaMorpho

`reallocate` requires the Shield to be vault curator, owner, or an
approved allocator. Typical grants from the **vault owner**:

- `setIsAllocator(shield.policyClientAddress, true)`
- or `setCurator(shield.policyClientAddress)`

If this `PRIVATE_KEY` is not the vault owner, **stop**. Tell the user the
owner must send the grant. Do not impersonate them.

### Euler Earn

| Role | Typical actions |
|---|---|
| Owner | `setCurator`, `setIsAllocator`, fees, timelock, name |
| Curator | caps, market removal |
| Allocator | `reallocate`, supply / withdraw queues |
| Guardian | veto pending changes |

A curator-role Shield can also call allocator actions. Most integrations
grant curator or mark the clone as allocator. Use `shield.euler.*` for
Earn; `shield.eulerVault.*` for EVault governor actions (`setLTV`,
`setCaps`, …).

### Superform / DemoVault / unknown

Grant whatever manager role the target docs require. If there is no typed
overlay, use `sendCall` ([vendors.md](vendors.md)).

## Params and secrets

```typescript
await shield.setParams({
  vaultsfyi: {
    /* fields from the pack schema and the user's policy params — do not invent thresholds */
  },
})

await shield.uploadSecrets({
  vaultsfyi: {
    VAULTS_FYI_API_KEY: process.env.VAULTSFYI_API_KEY!,
  },
})
```

Read param shapes from the policy directory (`configs/params.json`,
`params_schema.json`) and from the pack's published TypeScript types. Do
not copy pack source into this repo. Do not invent numeric floors.

`setParams` writes an on-chain versioned manifest. Secrets are encrypted
client-side and are **not** stored on-chain. Use
`shield.encodeParams(params)` to inspect bytes before writing.

Confirm before each of: clone deploy, `setParams`, `uploadSecrets`, role
grant.
