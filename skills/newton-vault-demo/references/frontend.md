# Two-view Next.js app

Shareholder deposit is ungated ERC-4626 on every branch. The curator view
calls the same VaultKit action as the typed script.

The filled dummy Morpho ndUSDC app is
[`dummy-morpho-vault-demo`](https://github.com/newt-foundation/dummy-morpho-vault-demo).
Clone that repo for the Base Sepolia two-allocator beat. Do not copy it
back into this skills repo.

[templates/app/](../templates/app/) is the Morpho `reallocate` UI
(dummy market vs idle, optional Chainalysis allocator dropdown). Copy it
only for a new Morpho vault. Fill `demo-config.json` from the policy and
shield handoffs ([handoff.md](handoff.md)).

Euler, Superform, and `sendCall` do not use that curator. If the brief
asks for a UI, keep `/shareholder` and replace `/curator` with one button
labeled from the brief. The server route runs the branch's overlay or
`shield.sendCall`. Allow and deny that differ only by a pack input
(`webacy.address`, `chainalysis.address`) send the same calldata twice.

Do not copy `newton-demo/templates/app`. That UI signs an EIP-712 intent
and calls `evaluateIntentDirect` on a `NewtonPolicyClient`.

## Views

| Route | Who | Newton? |
|---|---|---|
| `/shareholder` | Depositor | No. ERC-20 `approve` + ERC-4626 `deposit` on the vault |
| `/curator` | Allocator | Yes. POST `/api/reallocate` runs VaultKit on the server |

`/` is a short index that links both. Headline: depositors are
shareholders; reallocations go through Newton. When the brief is
two-allocator, add that the allocator identity is screened.

The curator Route Handler uses `NEWTON_API_KEY` and the curator
`PRIVATE_KEY` (approved delegate after owner transfer). Keep both off
`NEXT_PUBLIC_*`. The connected browser wallet on `/curator` is display
unless you later wire `executeDirect` from the wallet; dogfood may use
one key for both views.

On a two-allocator brief the curator view is an allocator **dropdown**
plus two destination CTAs: **Move funds to dummy market** and **Move
funds back to idle**. Show idle vs dummy supplied balances from Morpho
Blue `position` (vault as supplier). Clean allocator mines a
`reallocate` to that destination. Sanctioned allocator is
`assertIntentBlocked` (no deny tx); show that JSON in red. Link each
`taskId` (allow and deny) to
`https://explorer.newton.xyz/testnet/task/<taskId>` (mainnet explorer
when `chainId` is `1` or `8453`). Confirm before a clean click. Pass
the same `shieldVersion` as the typed attach. If `createShield` returns
a different clone than `demo-config.json` `shield`, stop — do not bump
version from the UI.

## Run

Filled dummy Morpho vault:

```bash
git clone https://github.com/newt-foundation/dummy-morpho-vault-demo.git
cd dummy-morpho-vault-demo
pnpm install
pnpm dev
```

New customer slug:

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
