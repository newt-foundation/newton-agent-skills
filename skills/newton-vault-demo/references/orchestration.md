# Orchestrate policy + Shield + optional UI

This skill is a conductor. Load `newton-policy` and `newton-vault-shield`
and follow them, applying the overrides in this skill's `SKILL.md`.

## Resume first

| File | Default path |
|---|---|
| Policy handoff | `<policy-dir>/dist/policy-handoff.json` |
| Shield handoff | `shields/<slug>/shield-handoff.json` |
| Demo config | `demos/<slug>/demo-config.json` |

If the policy handoff has `policy: null`, do not `createShield`. A published
pack address from `policy packs show` is not a complete deploy until that
policy is on the client set.

If a prior Shield clone's owner was already transferred to the dashboard
wallet, the curator key cannot `setPolicies` / `setParams` on that clone.
The owner replaces the ordered set with `setPolicies` on the same clone.
Bump `version` and `allowNewVersion: true` only when the brief needs a new
clone, not to edit the set.

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

## Several packs

Do not chain `definePolicy().with(a).with(b)` to put several oracles on one
Policy. That was the pre-0.7 composite. Deploy or reuse one Policy per pack.
The shield owner then calls `setPolicies` with those addresses in brief
order (max 8).

Install `@newton-xyz/policy-pack-<id>` for each id when the attach script
still imports a pack module. [send-call.ts](../../newton-vault-shield/templates/send-call.ts)
branches on pack id for a single-policy attach.

## Order

1. Policy: one directory per pack, in brief order. Reuse a published Policy
   address from `policy packs show`, or `policy deploy -p` for a new policy.
   Simulate allow/deny per directory. Do not pass `--policy-data-address`.
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
