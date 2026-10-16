# Published packs and policy sets

Use this when the brief names an already-deployed pack (`vaultsfyi`,
`webacy`, `chainalysis`, `redstone`, …) or asks to enforce more than one
rule.

Protocol 0.7 composes rules on the **PolicyClient**, not inside one Policy.
A client calls `setPolicies` with an ordered set of 1–8 Policies. Each
Policy is its own contract and carries at most one WASM (`wasmCid` on that
policy; empty for pure Rego). There is no `getPolicyData()` array.

Do **not** vendor pack source from
[`newton-policy-packs`](https://github.com/newt-foundation/newton-policy-packs)
into this repo. Do **not** copy addresses from GitHub or chat. Do **not**
repeat `--policy-data-address` to bind several oracles to one Policy. That
was the pre-0.7 composite.

## One policy, then a set

| Piece | What it is | Who deploys it |
|---|---|---|
| `Policy` | Rego plus at most one `wasmCid` | A published reference Policy when `policy packs show` returns one. Otherwise this skill, once per directory |
| Policy set | Ordered specs `{ policy, policyParams, expireAfter }` | PolicyClient owner via `setPolicies` in `newton-policy-client` |

If the brief names a pack, resolve it first:

```bash
newton-cli --chain-id 11155111 policy packs show --pack webacy --format json
newton-cli --chain-id 84532 policy packs list --format json
```

Lookup is config-free (no `PRIVATE_KEY`, RPC, or login). Always resolve
prod (the CLI default). Do not pass `--env`.

Use a **policy address** from that JSON. Bind it in the client set. Do not
redeploy the pack's WASM.

- Pack ids are case-insensitive. Unknown packs: the CLI lists published ids.
- If `--chain-id` is omitted and that pack has exactly one prod chain, the
  CLI infers it; otherwise require `--chain-id`.
- If `show` fails, **stop**. Do not copy an address from another chain.
- If `show` returns only a legacy `policy_data` address and no policy
  address, **stop**. Do not deploy a Policy against that PolicyData address.
- Override the catalog with `--catalog <path-or-url>` or
  `NEWTON_POLICY_PACKS_CATALOG`.
- Ethereum Sepolia is `11155111`. Base Sepolia is `84532`.

A fresh policy (this directory's Rego, and `policy.js` only when the policy
needs its own oracle) is `newton-cli policy deploy -p <policy-dir>` with no
`--policy-data-address`. Pure Rego leaves `wasmCid` empty and does not
deploy a PolicyData contract.

## Several rules

Scaffold **one directory per policy**. `vaultsfyi` plus `chainalysis` is two
deploys and two handoffs, then one `setPolicies` of length 2. Order is the
evaluation order. Do not sort or deduplicate. The cap is 8.

Each policy's Rego reads only its own `data.wasm.*` and `data.params.*`.
The operators do not merge WASM JSON across the set. The set allows only
when every policy allows.

Local `policy simulate -p` runs that directory's WASM, not the other
policies in the set. Stub `policy.js` with that one policy's fixture JSON.

## Deploy

```bash
newton-cli policy deploy -p <policy-dir>
```

Run it once per policy directory. Record each Policy address. Hand the
ordered list to `newton-policy-client` for `setPolicies`.

Secrets, when `policy.js` calls `getSecrets()`, are scoped to
`(policy client, policy)` after the client owner is the login wallet. One
upload per such policy. See [deploy-and-secrets.md](deploy-and-secrets.md).

## Handoff

After simulate, write one `dist/policy-handoff.json` per policy. `policy`
stays `null` until `policy deploy`. Leave `policyData` as `[]`. See
[handoff.md](handoff.md).

Never take addresses from chat when the CLI catalog answered.
