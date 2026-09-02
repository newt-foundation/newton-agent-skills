---
name: newton-policy
description: >-
  Install newton-cli, authenticate with Newton when required, create gateway
  API keys, and run the generic policy workflow (scaffold, author, build,
  simulate, iterate, and optionally deploy). Use when setting up Newton,
  creating a Newton policy, or turning a policy goal into Rego + WASM.
---

# Newton Policy (CLI)

> **Status:** Draft v0 under active dogfood testing. Expect gaps and report
> friction instead of silently working around it.

Build generic Newton policies with `newton-cli`. Do not assume a vertical
(stablecoin, vaults, etc.) unless the user specifies one. For Solidity
PolicyClient integration, use `newton-policy-client`. For a one-shot brief
→ policy → client → local UI, use `newton-demo`.

## Choose the workflow first

Determine the requested outcome before running commands:

1. **Local policy work:** scaffold, author, build, and simulate only.
2. **Deployment-ready artifacts:** finish the local loop and prepare deploy
   inputs, but do not perform live writes.
3. **Live deployment:** finish the local loop, then upload artifacts and submit
   transactions after an explicit deployment confirmation.

If live deployment is in scope, disclose its eventual prerequisites at the
start so they are not a surprise:

- Target chain/environment
- RPC endpoint
- Funded signing method (the current CLI flow uses `PRIVATE_KEY`)
- IPFS upload route: Newton proxy, or direct Pinata using both `PINATA_JWT` and
  `PINATA_GATEWAY`

In that same disclosure, name the durable injection site: the process
environment or `~/.newton/.env`. Do not ask for values yet. Do not tell the
user to populate deploy secrets at install, `doctor`, login, or scaffold.

Do not request secret values in chat or block local work merely because deploy
configuration is not ready. Collect/verify missing configuration at the
deployment checkpoint after local allow/deny simulation passes.

### Local policy workflow (no dashboard login required)

Use for creating or testing policy logic:

1. Install / verify `newton-cli`
2. Run `newton-cli doctor`
3. Scaffold
4. Author `policy.js`, `policy.rego`, configs, and schemas; review the
   scaffolded non-secret `configs/deployment.toml`
5. Build
6. Simulate allow + deny cases
7. Iterate locally

Read [references/setup-and-auth.md](references/setup-and-auth.md) for install
and toolchain setup, then
[references/policy-loop.md](references/policy-loop.md) for the local loop.
Write a [policy-handoff.json](references/handoff.md) after simulate (partial)
and after deploy (addresses filled) so `newton-policy-client` and
`newton-demo` can consume it.

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
  `PRIVATE_KEY`, credential-bearing `RPC_URL`, and `PINATA_JWT` into the
  process environment or `~/.newton/.env`. Verify only whether required
  variables are set; never print their values.
- For headless/CI login, the user must provide `NEWTON_ACCESS_TOKEN` through the
  process environment or `~/.newton/.env`; do not put the token directly in a
  command argument.
- Never perform browser signup, wallet linking, or signing on the user's behalf.
- Never invent private keys, RPC URLs, contract addresses, chain IDs, or
  expiration values.

## Core policy sequence

```text
scaffold
  → author policy.js + policy.rego + configs/schemas
  → policy build
  → policy simulate (allow + deny)
  → iterate
  → write policy-handoff.json (partial; addresses after deploy)
  → optional deploy
  → optional newton-policy-client (deploy / setPolicy / setPolicyClientOwner via cast), then secrets / live evaluate
```

Rules:

- Code defines intent; schemas must match fields actually read by `policy.js`
  and Rego.
- WASM JSON is `data.wasm.*` in Rego (local simulate, gateway simulate, and
  live operators). Do not use `data.data.*` for oracle output.
- `policy build` disables WASI `stdio`, `random`, `clocks`, `http`, and
  `fetch-event`. Use Newton WIT imports, not those globals.
- Stay local until build/simulate behavior matches the user's goal.
- Do not deploy unless the user explicitly requests or confirms deployment.

## Completion report

Tell the user:

- Policy directory and what the policy enforces
- Build/simulate commands
- Allow and deny results
- Path of the written `policy-handoff.json` (see
  [references/handoff.md](references/handoff.md))
- Friction or gaps discovered in the skill/CLI
- For live work: chain/environment and deployed PolicyData, Policy, and
  PolicyClient addresses (without exposing secrets). If deploy secrets were
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

## Out of scope

- Building dashboard/explorer UI (a local attested-call demo is `newton-demo`)
- Assuming use-case-specific product logic not provided by the user
- Implementing a policy-client application contract; hand off to
  `newton-policy-client` for Solidity integration. This skill wires an
  existing `INewtonPolicyClient`
- MCP / ecosystem plugin packaging
