---
name: newton-policy
description: >-
  Install newton-cli, authenticate with Newton when required, create gateway
  API keys, and run the generic policy workflow (scaffold, author, build,
  simulate, iterate, and optionally deploy). Bind published policy packs
  (vaultsfyi, webacy, chainalysis, …) via `newton-cli policy packs`, one
  Policy per rule. A client composes up to 8 of those Policies with
  `setPolicies`. Use when
  setting up Newton, creating a Newton policy, composing published packs,
  or turning a policy goal into Rego + WASM.
---

# Newton Policy (CLI)

> **Status:** Draft v0 under active dogfood testing. Expect gaps and report
> friction instead of silently working around it.

Build generic Newton policies with `newton-cli`. Do not assume a vertical
(stablecoin, vaults, etc.) unless the user specifies one. For Solidity
PolicyClient integration on a contract you control, use
`newton-policy-client`. To attach a Shield to Morpho / Euler / Superform /
DemoVault, use `newton-vault-shield`. For a one-shot PolicyClient UI, use
`newton-demo`. For a Morpho / vaultsfyi / Shield brief (including
[`newton-morpho-shield-brief.txt`](../../newton-morpho-shield-brief.txt)),
use `newton-vault-demo`.

## Choose the workflow first

Determine the requested outcome before running commands:

1. **Local policy work:** scaffold, author, build, and simulate only.
2. **Deployment-ready artifacts:** finish the local loop and prepare deploy
   inputs, but do not perform live writes.
3. **Live deployment:** finish the local loop, then upload artifacts and submit
   transactions after an explicit deployment confirmation.

On the first turn, tell the user they will eventually need (names only; do
not ask for values yet):

- A funded local `PRIVATE_KEY` in the process environment or `~/.newton/.env`
  (CLI / Foundry deploys; not the dashboard login wallet)
- A Newton gateway API key from `newton-cli keys` (secrets upload and live
  evaluate; not required for local simulate)
- Target chain/environment
- RPC endpoint. On Ethereum Sepolia (`11155111`), this skill uses
  `https://ethereum-sepolia-rpc.publicnode.com` unless `RPC_URL` is already
  set. Do not ask the user for a Sepolia URL. On other chains (including
  Base Sepolia `84532`), live deploy needs an injected `RPC_URL` — do not
  invent a public URL. Pack lookup (`policy packs`) needs no RPC.
- IPFS upload route: Newton proxy, or direct Pinata using both `PINATA_JWT`
  and `PINATA_GATEWAY`

Published-pack lookup (`newton-cli policy packs`) is config-free: no
`PRIVATE_KEY`, login, or RPC.

Name the durable injection site: the process environment or
`~/.newton/.env`. Do not tell the user to populate deploy secrets at
install, `doctor`, login, or scaffold. Local scaffold/build/simulate can
proceed before those exist.

Do not request secret values in chat or block local work merely because deploy
configuration is not ready. Collect/verify missing configuration at the
deployment checkpoint after local allow/deny simulation passes.

### Published packs vs a fresh oracle

If the brief names a published pack (`vaultsfyi`, `webacy`, `chainalysis`,
`redstone`, …) or asks for more than one rule, resolve each pack and deploy
**one Policy per rule**. The PolicyClient binds them later with `setPolicies`
(1–8, ordered). Do not vendor pack source. Do not pass `--policy-data-address`.
A 0.7 Policy stores at most one `wasmCid` on the policy itself.

Read [references/published-packs.md](references/published-packs.md). Resolve
addresses with `newton-cli policy packs show` / `list --format json` — never
from chat or GitHub. Scaffold one directory per policy.

`policy deploy -p` publishes that directory's Rego and optional WASM onto
one Policy. Pure Rego uses an empty `wasmCid` and does not deploy a
PolicyData contract. Use that path when the brief does not already name a
published Policy address.

### Local policy workflow (no dashboard login required)

Use for creating or testing policy logic:

1. Install / verify `newton-cli`
2. Put npm-global `bin` on `PATH`, then run `newton-cli doctor` (see
   [setup-and-auth.md](references/setup-and-auth.md); doctor finding `jco`
   is not enough if `jco` is missing from `PATH`)
3. Scaffold
4. Author `policy.js`, `policy.rego`, configs, and schemas; review the
   scaffolded non-secret `configs/deployment.toml`. For a published pack,
   stub `policy.js` for that one policy's `data.wasm.*` so local simulate
   can run. Do not merge several packs into one Rego namespace
5. Build
6. Simulate allow + deny cases
7. Iterate locally

Read [references/setup-and-auth.md](references/setup-and-auth.md) for install
and toolchain setup, then
[references/policy-loop.md](references/policy-loop.md) for the local loop.
For named packs, also read
[references/published-packs.md](references/published-packs.md).
Write a [policy-handoff.json](references/handoff.md) after simulate
(`policy` null; `policyData` stays `[]`) and after deploy (`policy` filled)
so `newton-policy-client`, `newton-vault-shield`, and `newton-demo` can
consume it. A set is several handoffs in evaluation order.

### Authenticated / live workflow

Authentication is required only when the requested operation needs dashboard
or gateway access, such as:

- Managing gateway API keys
- Uploading secrets
- Live gateway evaluate (`newt_createTask` via `newton-policy-client`)
- Any command that explicitly reports that dashboard authentication is needed

Do not force login merely to scaffold, author, build, or locally simulate.
For deploy/client/secrets/evaluate details, read
[references/deploy-and-secrets.md](references/deploy-and-secrets.md).

## Authentication checkpoint

When an authenticated operation is needed:

1. Run a non-secret authenticated check appropriate to the operation. For
   gateway-key setup, use `newton-cli keys list`.
2. If it succeeds and a usable active key exists, continue without login.
3. If it reports `Not logged in`, run:

   ```bash
   newton-cli login
   ```

4. Give the user the URL printed by the CLI and **pause**. The user must sign
   up/sign in, link a wallet, and approve browser/wallet interactions.
5. Resume only after the CLI prints `Login successful.` and a wallet address.
6. Re-run the non-secret authenticated check; never verify by printing the JWT.

If login says no wallet is linked, ask the user to link one in the dashboard,
then rerun `newton-cli login`.

## Credential safety

- Never ask the user to paste a dashboard JWT, private key, API key, or RPC
  credential into chat.
- Never run `newton-cli auth token` for routine verification: it prints the JWT
  into terminal/transcript output.
- Never run `newton-cli … --help` with secrets in the environment or
  `~/.newton/.env`: help output prints env-backed values (see
  [setup-and-auth.md](references/setup-and-auth.md)).
- Never put credentials in source files, committed files, or a project-local
  `.env`.
- Treat the scaffolded `.env.example` only as a variable checklist. Inject
  populated values through the real process environment or `~/.newton/.env`.
- Prefer existing local credentials from the process environment,
  `~/.newton/.env`, and the CLI's encrypted/local key cache.
- Never source a project-local `.env`, a `.env` beside a user-specified CLI
  binary, another repo checkout, or shell rc files. A custom `newton-cli`
  path does not change where secrets are loaded from.
- For live deployment, at the deploy checkpoint ask the user to inject missing
  `PRIVATE_KEY` and `PINATA_JWT` into the process environment or
  `~/.newton/.env`. On Sepolia, use the public RPC above if `RPC_URL` is
  unset; on other chains, ask them to inject `RPC_URL` the same way. Verify
  only whether required variables are set; never print their values.
- For headless/CI login, the user must provide `NEWTON_ACCESS_TOKEN` through the
  process environment or `~/.newton/.env`; do not put the token directly in a
  command argument.
- Never perform browser signup, wallet linking, or signing on the user's behalf.
- Never invent private keys, credential-bearing RPC URLs, contract addresses,
  chain IDs, or expiration values. Ethereum Sepolia may use
  `https://ethereum-sepolia-rpc.publicnode.com` when `RPC_URL` is unset.

## Core policy sequence

```text
scaffold
  → if brief names packs: policy packs show/list --format json
  → author policy.js + policy.rego + configs/schemas
  → policy build
  → policy simulate (allow + deny)
  → iterate
  → write policy-handoff.json (one file per policy; policy null)
  → optional deploy (one `policy deploy -p` per policy; no --policy-data-address)
  → optional newton-policy-client (Solidity you control) or newton-vault-shield (Morpho / Euler attach)
  → optional secrets / live evaluate
```

Rules:

- Code defines intent; schemas must match fields actually read by `policy.js`
  and Rego.
- WASM JSON is `data.wasm.*` inside that one policy (local simulate,
  gateway simulate, and live operators). Do not use `data.data.*`. A policy
  set does not merge WASM output across policies; every policy must allow.
- Never copy addresses from chat or GitHub when `newton-cli policy packs`
  answered. Do not repeat `--policy-data-address`.
- `policy build` disables WASI `stdio`, `random`, `clocks`, `http`, and
  `fetch-event`. Use Newton WIT imports, not those globals.
- Stay local until build/simulate behavior matches the user's goal.
- Do not deploy unless the user explicitly requests or confirms deployment.
- On a testnet with CLI 0.7.4 or older, deploy with `DEPLOYMENT_ENV=prod`
  and confirm `isPolicy` on the TaskManager's factory before binding
  ([deploy-and-secrets.md](references/deploy-and-secrets.md)).
- After each build, confirm the WASM imports only `newton:provider/http`
  and `newton:provider/secrets` ([policy-loop.md](references/policy-loop.md)).

## Completion report

Tell the user:

- Policy directory and what the policy enforces
- Build/simulate commands
- Allow and deny results
- Path of the written `policy-handoff.json` (see
  [references/handoff.md](references/handoff.md))
- For published packs: pack ids and Policy addresses from `policy packs show`
  (not from chat), in the order the client set will use
- Friction or gaps discovered in the skill/CLI
- For live work: chain/environment, each Policy address in set order, and
  the PolicyClient address (without exposing secrets). If deploy secrets were
  only in the process environment, remind the user to persist them in
  `~/.newton/.env`.

## Dogfood scenarios

Test this draft with:

1. **Fresh user:** no account/credentials → browser signup → wallet link →
   gateway key creation.
2. **Returning user:** `~/.newton/.env` (`PRIVATE_KEY` / `RPC_URL`) plus an
   active `newton-cli keys` cache → no browser login and no deploy-secret
   prompt.
3. **Expired/revoked credentials:** authenticated check fails → clean
   reauthentication.
4. **Local-only policy:** complete scaffold → build → simulate without login.
5. **Policy set:** `vaultsfyi` + `chainalysis` on Base Sepolia (`84532`) →
   `policy packs show` for each id → one directory and allow+deny simulate
   per policy → one handoff each. Do not bind both oracles to one Policy.

## Out of scope

- Building dashboard/explorer UI (a local attested-call demo is `newton-demo`)
- Assuming use-case-specific product logic not provided by the user
- Vendoring policy-pack source from `newton-policy-packs` (bind the published
  Policy address; do not copy pack `policy.js`)
- Adding `newton-cli vault` / `shield` commands; published oracles are
  `policy packs` + this skill
- Implementing a policy-client application contract; hand off to
  `newton-policy-client` for Solidity you control, or `newton-vault-shield`
  to attach a Shield to a vault Newton does not own. This skill wires an
  existing `INewtonPolicyClient` only via those skills
- MCP / ecosystem plugin packaging
