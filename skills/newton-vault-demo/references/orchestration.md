# Orchestrate policy + Shield + optional UI

This skill is a conductor. Load `newton-policy` and `newton-vault-shield`
and follow them, applying the overrides in this skill's `SKILL.md`.

## Resume first

| File | Default path |
|---|---|
| Policy handoff | `<policy-dir>/dist/policy-handoff.json` |
| Shield handoff | `shields/<slug>/shield-handoff.json` |
| Demo config | `demos/<slug>/demo-config.json` |

If the policy handoff has `policy: null`, do not `createShield`. Published
pack `policyData` from `policy packs show` is not a complete deploy.

If a prior Shield clone's owner was already transferred to the dashboard
wallet, the curator key cannot `setPolicy` / `setParams` on that version.
Bump `version` and `allowNewVersion: true` for a new clone bound to the
envelope Policy.

## CLI

`newton-cli policy packs` must exist. 0.5.2 and earlier fail with
`unrecognized subcommand packs`. Require 0.5.4+ (or a local debug build
that includes packs). `newton-cli --version` alone is not enough.

`policy deploy` CID upload reads **`API_KEY`**, not the keys cache and not
only `NEWTON_API_KEY`. Inject both names from the same cached secret
([credentials.md](credentials.md)). VaultKit evaluate / `uploadSecrets`
read `NEWTON_API_KEY`.

## Which template to copy

| Branch | Copy |
|---|---|
| Morpho | [templates/run-morpho-e2e.ts](../templates/run-morpho-e2e.ts) and, for a new UI, [templates/app/](../templates/app/) |
| Euler / EVault / Superform | `newton-vault-shield` attach script, then the overlay in [vendors.md](../../newton-vault-shield/references/vendors.md). Do not copy `run-morpho-e2e.ts` |
| sendCall | [newton-vault-shield/templates/send-call.ts](../../newton-vault-shield/templates/send-call.ts) |

## Bind every pack in one expression

`PolicyDraft` tuples are fixed-length. This fails typecheck:

```typescript
let policy = definePolicy(config).with(vaultsfyi)
policy = policy.with(chainalysis)
```

Write the chain once, in `handoff.packs[]` order:

```typescript
const policy = definePolicy(config).with(vaultsfyi).with(chainalysis)
```

Install `@newton-xyz/policy-pack-<id>` for each id. [send-call.ts](../../newton-vault-shield/templates/send-call.ts)
branches on the joined pack ids and throws when that combination is
missing, so a new pack is a new branch, not a loop.

## Order

1. Policy: bind pack PolicyData in brief order → author envelope schema +
   Rego under `params.params.<pack_id>` → stub WASM simulate allow/deny →
   (confirm) deploy Policy.
2. Shield, every branch: checksum vault → `createShield` with
   `allowNewVersion` → `setParams` **while the curator still owns the
   clone** → grant the vendor role → secrets owner step
   ([secrets-and-owner.md](secrets-and-owner.md)) → `uploadSecrets` →
   one mined allow → `assertIntentBlocked` deny.
3. Optional UI after the typed beat. Do not call the curator route or
   deposit until confirmed. Morpho UI posts `/api/reallocate`. Other
   branches post the manager action from the brief.

Do not reconstruct chain ID, Policy, Shield, or `functionSignature` from
chat when a handoff exists.

## What not to do

- Route a Morpho UI through `newton-demo` / `evaluateIntentDirect`
- Call `newton-cli policy-client`, `newton-cli task`, `newton-cli vault`,
  or `newton-cli shield`
- Vendor `newton-contracts` or VaultKit source into the demo app
- Commit `policies/`, `shields/`, or `demos/` in this skills repo
