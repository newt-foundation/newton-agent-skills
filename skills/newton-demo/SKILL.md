---
name: newton-demo
description: >-
  Turn a customer brief into a Newton policy, PolicyClient, and a local Next.js
  demo that signs an EIP-712 intent, evaluates it on a server Route Handler with
  the Newton SDK, and submits the attested contract call. Use when the user
  wants a one-shot product demo from a brief, a wallet UI for a PolicyClient, or
  an end-to-end walkthrough from policy authoring to a local frontend. Delegates
  Rego/WASM to newton-policy and Solidity to newton-policy-client.
---

# Newton Demo

> **Status:** Draft v0 under active dogfood testing. Expect gaps and report
> friction instead of silently working around it.

Build a generic product demo: policy + PolicyClient + a lite Next.js App
Router UI. Do not assume a vertical (stablecoin, vaults, wallets) unless the
user specifies one. An ERC-20 transfer wrapper is only the golden *example*.

Do **not** reimplement Rego, WASM, or Solidity in this skill. Load
`newton-policy` and `newton-policy-client` and follow them.

## Choose the workflow first

1. **Resume:** policy-handoff and/or client-handoff already exist → fill
   `demo-config.json` and scaffold the app. Do not redeploy.
2. **Frontend only:** a wired PolicyClient exists → skip policy/client work.
3. **Full brief:** extract requirements, then policy → client → frontend.
4. **Local-only:** scaffold the UI against placeholders; do not call the
   gateway or send application txs.

On the first turn, tell the user they will eventually need (names only, no
values yet):

- A funded local `PRIVATE_KEY` for Foundry deploy (`newton-policy-client`)
- A Newton gateway API key from `newton-cli keys` (as `NEWTON_API_KEY` on the
  **server** Route Handler; not `~/.newton/.env`)
- Target chain / environment
- RPC endpoint. On Ethereum Sepolia (`11155111`), this skill uses
  `https://ethereum-sepolia-rpc.publicnode.com` unless `RPC_URL` /
  `NEXT_PUBLIC_RPC_URL` is already set. Do not ask the user for a Sepolia URL.
- Dashboard login wallet (PolicyClient owner after transfer)
- Whether Policy / PolicyClient are already deployed

Local scaffold can proceed before those exist. Do not ask for secret values
in chat. Do not invent chain IDs, token addresses, allow/deny rules, or
private keys.

## Credential safety

Read [references/credentials.md](references/credentials.md). Short form:

- Never ask the user to paste keys, JWTs, or RPC credentials into chat.
- Never put `NEWTON_API_KEY` in client JS or `NEXT_PUBLIC_*`. The same
  gateway key can evaluate tasks and upload dashboard secrets; a scraped
  key is a secrets-manager credential, not just an evaluate token.
- Never commit `.env`, `.env.local`, or secrets JSON.
- Prefer process environment and `~/.newton/.env` for `PRIVATE_KEY` and
  `RPC_URL`. Resolve the gateway key from `newton-cli keys` and copy it into
  `demos/<name>/.env.local` (gitignored) for Next.js only.
- Official Newton frontend docs put the API key (and sometimes a signer key)
  in the browser. Do **not** copy that.

## Core sequence

```text
extract requirements from the brief
  → newton-policy (scaffold → author → simulate → optional deploy)
  → newton-policy-client (implement → test → optional live wiring)
  → write / extend client-handoff.json
  → copy templates/app to demos/<slug>/
  → fill demo-config.json from the handoffs
  → local next dev
  → optional live evaluate + attested write (explicit confirmation)
```

Stop for confirmation before: live policy deploy, live client deploy /
`setPolicy`, gateway evaluate, and the first attested application tx.
Do not deploy to Vercel unless the user asked.

## Read these references

| When | Read |
|---|---|
| Parsing the brief | [references/brief.md](references/brief.md) |
| Delegating / resuming | [references/orchestration.md](references/orchestration.md) |
| Copying and running the app | [references/frontend.md](references/frontend.md) |
| Keys and env injection | [references/credentials.md](references/credentials.md) |

Policy and client procedures live in those skills, not here.

## Brief → requirements

Follow [references/brief.md](references/brief.md). Capture allow/deny
conditions, the protected action (target, selector, user args), who
`msg.sender` / `intent.from` is, chain, and whether a UI is in scope.

If a product decision is missing, stop and ask. Do not invent a vertical,
token address, or policy rule to keep moving.

## Delegate policy and client

Follow [references/orchestration.md](references/orchestration.md).

- Policy facts come from `<policy-dir>/dist/policy-handoff.json`.
- Client facts come from the Foundry root `client-handoff.json`.
- Extend that client handoff with frontend fields (`userArgs`, `target`,
  `needsTokenApproval`, `eip712`).
- Foundry tests must pass before any live application tx.

## Frontend

Follow [references/frontend.md](references/frontend.md).

Copy [templates/app/](templates/app/) to `demos/<slug>/` (gitignored in this
repo). Fill `demo-config.json` from the handoffs — do not hard-code a token
or function name into the page.

The app:

1. Connects a browser wallet (`intent.from` / later `msg.sender`).
2. Renders form fields from `protectedFunction.userArgs`.
3. Signs EIP-712 `Intent` in the browser.
4. POSTs to `/api/evaluate`, which calls `@newton-xyz/sdk`
   `evaluateIntentDirect` with `NEWTON_API_KEY` on the server.
5. On allow, sends the guarded write:
   `userArgs…, Task, TaskResponse, signatureData`.
6. On deny, shows the result and does **not** send a tx.

`functionSignature` is named UTF-8 hex matching the scaffold
(`function transfer(address recipient, uint256 amount)`), not
`function transfer(address,uint256)`.

## Completion report

Tell the user:

- Requirements extracted from the brief (and any questions still open)
- Paths of `policy-handoff.json`, `client-handoff.json`, and `demo-config.json`
- Policy / PolicyClient / TaskManager addresses when live work ran, without
  exposing secrets
- How to run the demo (`cd demos/<slug> && npm install && npm run dev`)
- Env var **names** required (`NEWTON_API_KEY`, `PRIVATE_KEY` for live
  deploy). RPC: `RPC_URL` / `NEXT_PUBLIC_RPC_URL`, with Sepolia default
  `https://ethereum-sepolia-rpc.publicnode.com`
- What was not done (Vercel, other verticals, live txs if not confirmed)
- Friction or gaps discovered in the skill

## Out of scope

- Reimplementing Rego, WASM, or Solidity (use the sibling skills)
- Operator / observability work
- Relayed / meta-transaction designs that break `intent.from == msg.sender`
- Putting the gateway API key in the browser
- Vercel/production deploy unless the user asked
- Dashboard/explorer UI
- MCP / plugin packaging

## Failure attribution

| Symptom | Likely layer |
|---|---|
| Local `policy simulate` deny | `newton-policy` (Rego / `data.wasm.*` / intent fixture) |
| `forge test` fail | `newton-policy-client` (binding or attestation checks) |
| Gateway JSON-RPC / 401 | API key, owner ≠ login wallet, or wrong chain gateway |
| `evaluationResult` false | Policy denied this intent; do not retry as a transport error |
| Attested tx revert | Client checks (`intent.to`, signature, args) or missing token approval |
| Browser cannot evaluate | API key leaked to `NEXT_PUBLIC_*`, or Route Handler missing |
