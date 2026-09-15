# Published packs and composites

Use this when the brief names an already-deployed oracle (`vaultsfyi`,
`webacy`, `chainalysis`, `redstone`, …) or asks to compose more than one.

Do **not** vendor pack source from
[`newton-policy-packs`](https://github.com/newt-foundation/newton-policy-packs)
into this repo. Do **not** copy PolicyData hex from GitHub or chat.

## Prefer published PolicyData

A Newton policy is two pieces:

| Piece | What it is | Who deploys it |
|---|---|---|
| `PolicyData` | WASM oracle | Published packs already live per `pack × chain` (prod) |
| `Policy` | Your Rego over those oracle outputs | This skill, via `policy deploy` |

If the brief names a pack, **bind** a new Policy to that pack's PolicyData.
Do not auto-deploy a fresh `NewtonPolicyData` from the scaffolded
`policy.js`. Scaffold a policy directory for *your* Rego; the live oracles
are the published contracts.

Fresh-oracle (scaffold `policy.js` as the production WASM, omit
`--policy-data-address` so `policy deploy -p` auto-deploys one PolicyData)
only when the brief does **not** name a published pack and needs a new
oracle.

## Resolve addresses with `newton-cli`

Lookup is config-free (no `PRIVATE_KEY`, RPC, or login). Always resolve
prod PolicyData (the CLI default). Do not pass `--env`.

```bash
# One pack on Ethereum Sepolia prod
newton-cli --chain-id 11155111 policy packs show --pack webacy --format json

# One pack on Base Sepolia prod
newton-cli --chain-id 84532 policy packs show --pack vaultsfyi --format json

# All prod packs on a chain
newton-cli --chain-id 84532 policy packs list --format json
```

JSON `show` fields: `pack`, `chain_id`, `env`, `policy_data`, `wasm_cid`.
Pass each `policy_data` to `--policy-data-address` in the same order you
will use in Rego / handoff.

- Pack ids are case-insensitive. Unknown packs: the CLI lists published ids.
- If `--chain-id` is omitted and that pack has exactly one prod chain, the
  CLI infers it; otherwise require `--chain-id`.
- If `show` fails for a pack × chain, **stop**. Do not copy a PolicyData
  from another chain, invent an address, or scrape GitHub.
- Override the catalog with `--catalog <path-or-url>` or
  `NEWTON_POLICY_PACKS_CATALOG`.
- Ethereum Sepolia is `11155111`. Base Sepolia is `84532`. Do not invent
  other chain IDs. Lookup does not need `RPC_URL`.

## Namespacing

The AVS runs each bound PolicyData WASM and shallow-merges JSON under
`data.wasm.<pack_id>.*`. Author composite Rego against those keys, not
`data.data.*`:

```rego
data.wasm.vaultsfyi.risk_score
data.wasm.chainalysis.sanctioned
data.params.vaultsfyi.risk_score_floor
```

Copy the *shape* of deny rules from the pack's published docs / npm types,
not the pack's `policy.js` into this repo. Full convention:
[`composite-policies.md`](https://github.com/newt-foundation/newton-policy-packs/blob/main/docs/composite-policies.md).

## Local simulate (stub WASM)

`policy simulate -p` runs the **local** `policy.js`, not the published pack
WASMs. For a published-pack or composite policy:

1. Keep a stub `policy.js` that returns namespaced fixture JSON so Rego can
   be tested (`{ "vaultsfyi": { ... }, "chainalysis": { ... } }`).
2. Drive allow vs deny with `configs/wasm_args.json` (or a second intent /
   params fixture), not by pasting live oracle payloads from chat.
3. Do not treat that stub WASM as something to deploy as PolicyData.

Live operators use the published PolicyData WASMs you pass at deploy time.

## Deploy

Repeat `--policy-data-address` once per pack, **same order** as
`INewtonPolicy.getPolicyData()` (protocol validation is positional):

```bash
newton-cli --chain-id 84532 policy deploy \
  -p <policy-dir> \
  --policy-data-address 0xVAULTSFYI_PD \
  --policy-data-address 0xCHAINALYSIS_PD
```

Passing one or more `--policy-data-address` flags skips auto-deploy of a
fresh PolicyData. One flag = single published pack; N flags = composite.

Do not reorder the array after deploy. Secrets upload (when a pack uses
`getSecrets()`) is per `(policy_client, policy_data)` — run it once per
PolicyData address after the client owner is the login wallet.

## Handoff

After simulate, write `dist/policy-handoff.json` with `packs` (ids) and
`policyData` (addresses from `policy packs show`) already filled. `policy`
stays `null` until `policy deploy`. See [handoff.md](handoff.md).

Never take those addresses from chat when the CLI catalog answered.
