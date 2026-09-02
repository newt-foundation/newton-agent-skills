# Orchestrate policy + client + demo

This skill is a conductor. It does not replace `newton-policy` or
`newton-policy-client`.

## Resume first

Before scaffolding anything, look for existing files:

| File | Default path |
|---|---|
| Policy handoff | `<policy-dir>/dist/policy-handoff.json` |
| Client handoff | Foundry project root `client-handoff.json` |
| Demo config | `demos/<slug>/demo-config.json` |

If both handoffs exist with addresses filled, skip to
[frontend.md](frontend.md). If the policy handoff is partial (`policy` /
`policyData` still `null`), you may still copy the Next.js template and fill
placeholders, but do not call `/api/evaluate` or send application txs.

Do not reconstruct chain ID, Policy / PolicyData, `functionSignature`, or
PolicyClient address from chat when a handoff file exists.

## Full path

1. Extract requirements ([brief.md](brief.md)).
2. Load `newton-policy` and run its workflow (local simulate before any
   deploy). Write `policy-handoff.json`.
3. Load `newton-policy-client` and run its workflow (Foundry tests before
   live `setPolicy`). Write `client-handoff.json`, including the frontend
   fields in that skill's [handoff.md](../../newton-policy-client/references/handoff.md).
4. Copy [templates/app/](../templates/app/) and fill `demo-config.json`.
5. Run locally. Live evaluate and the attested write need explicit
   confirmation.

Secrets upload (`newton-cli secrets upload`) stays in `newton-policy`. The
demo UI must not collect production secrets. If `secretsRequired` is true,
the policy skill must finish upload (owner = login wallet) before a live
gateway evaluate will succeed.

## Checkpoints

Stop and get confirmation before:

| Checkpoint | Why |
|---|---|
| Missing product decisions | Do not invent policy rules or addresses |
| Live policy deploy | Uploads artifacts and spends gas |
| Live client deploy / `setPolicy` / owner transfer | Binds a replaceable client |
| First gateway evaluate | Uses `NEWTON_API_KEY` and the login-wallet owner check |
| First attested application tx | Moves user funds / state |
| Vercel / production deploy | Out of scope unless the user asked |

Foundry tests (`forge test`) must pass before the first live application tx.

## What not to do

- Re-author Rego because the UI needs a field — change the policy skill
  artifacts, then refresh the handoff
- Call `newton-cli policy-client` or `newton-cli task`
- Put the API key in the Next.js client bundle
- Vendor `newton-contracts` source into the demo app
- Commit `policies/`, `policy-clients/`, or `demos/` in this skills repo
