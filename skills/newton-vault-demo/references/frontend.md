# Two-view Next.js app

Copy [templates/app/](../templates/app/) to `demos/<slug>/` (gitignored
in this skills repo). Fill `demo-config.json` from the policy and shield
handoffs ([handoff.md](handoff.md)).

Do not copy `newton-demo/templates/app`. That UI signs an EIP-712 intent
and calls `evaluateIntentDirect` on a `NewtonPolicyClient`.

## Views

| Route | Who | Newton? |
|---|---|---|
| `/shareholder` | Depositor | No. ERC-20 `approve` + ERC-4626 `deposit` on the vault |
| `/curator` | Allocator | Yes. POST `/api/reallocate` runs VaultKit on the server |

`/` is a short index that links both. Headline: depositors are
shareholders; the curator cannot reallocate without Newton.

The curator Route Handler uses `NEWTON_API_KEY` and the curator
`PRIVATE_KEY` (approved delegate after owner transfer). Keep both off
`NEXT_PUBLIC_*`. The connected browser wallet on `/curator` is display
unless you later wire `executeDirect` from the wallet; dogfood may use
one key for both views.

**Evaluate allow** mines a `reallocate`. Confirm before the click.
**Evaluate deny** is `assertIntentBlocked` (no deny tx). Pass the same
`shieldVersion` as the typed attach. If `createShield` returns a different
clone than `demo-config.json` `shield`, stop — do not bump version from
the UI.

## Run

```bash
cd demos/<slug>
pnpm install
pnpm dev
```

Do not `next build` for a first demo. Do not deploy to Vercel unless the
user asked.

If VaultKit cannot load inside the Next server (peer / native bindings),
keep `/curator` as a status view that reads `shield-handoff.json` and
tell the user to run `run-morpho-e2e.ts --allow` / `--deny`. Do not fall
back to `newton-demo`.

## Fill before live clicks

Shareholder deposit and curator allow need the filled vault / asset /
shield addresses and user confirmation. Placeholder config is fine for
`next dev` layout only.
