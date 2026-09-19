# Credentials for VaultKit attach

Same rules as `newton-policy`. VaultKit reads secrets from the process
environment (and this skill also accepts `~/.newton/.env` for the curator
key and RPC).

## Never

- Ask the user to paste a dashboard JWT, private key, API key, or RPC
  credential into chat
- Commit `.env`, secrets JSON, or private keys
- Source a project-local `.env`, a `.env` beside a user-specified CLI
  binary, another repo checkout, or shell rc files
- Print `NEWTON_API_KEY`, pack API keys, `PRIVATE_KEY`, or
  credential-bearing RPC URLs
- Invent private keys, vault addresses, Policy addresses, chain IDs, or
  market params. Ethereum Sepolia may use
  `https://ethereum-sepolia-rpc.publicnode.com` when `RPC_URL` is unset.
  Base Sepolia may use `https://base-sepolia-rpc.publicnode.com`

## Where values live

| Secret | Where |
|---|---|
| `PRIVATE_KEY` (curator / VaultKit `walletClient`) | Process env or `~/.newton/.env`. VaultKit docs sometimes call this `CURATOR_PRIVATE_KEY`; use `PRIVATE_KEY` |
| `RPC_URL` | Process env or `~/.newton/.env`. Ethereum Sepolia default: `https://ethereum-sepolia-rpc.publicnode.com`. Base Sepolia default: `https://base-sepolia-rpc.publicnode.com`. If `RPC_URL` is Ethereum Sepolia while `chainId` is `84532`, use the Base Sepolia default instead |
| `NEWTON_API_KEY` | From `newton-cli keys`. Process env for the attach script. Same key authenticates evaluate **and** `uploadSecrets` |
| Pack oracle secrets (`VAULTSFYI_API_KEY`, …) | Process env. Pass into `shield.uploadSecrets({ <pack_id>: { ... } })`. Never chat, never handoff JSON |

[templates/.env.example](../templates/.env.example) is a **name checklist**
only. Do not populate it and do not commit filled values.

## Two identities (do not conflate them)

| Role | Who | What it signs |
|---|---|---|
| Curator key | `PRIVATE_KEY` | `createShield`, `setParams`, typed actions, `setApprovedDelegate` |
| Dashboard login wallet | Address printed by `newton-cli login` | Identity behind `NEWTON_API_KEY` for gateway `uploadSecrets` |

`shield.uploadSecrets` uses `NEWTON_API_KEY`, not `newton-cli secrets upload`.
The gateway still checks that identity against Shield `getOwner()`. If
the curator owns the clone and the API key belongs to the login wallet,
upload returns `AuthorizationFailed`. Do **not** skip that check.

Order: `setParams` and `setApprovedDelegate(curator)` **before**
`setPolicyClientOwner(dashboardWallet)`, then `uploadSecrets`. After the
transfer the curator cannot `setParams` / `setPolicy` on that clone.
Alternative: an API key whose dashboard identity is the curator address.
Details: [`newton-vault-demo` secrets-and-owner.md](../../newton-vault-demo/references/secrets-and-owner.md).

The initial Shield owner is an approved delegate at clone init. After an
ownership handoff, confirm `isApprovedDelegate(curator)` before typed
actions.

## Newton `env` vs chain

VaultKit `definePolicy({ env: 'prod' })` is the Newton **gateway stack**.
On Base Sepolia / Ethereum Sepolia that is testnet production. Always
`prod`. Do not pass `stagef`. Chain selection is `chainId` (`84532`,
`11155111`, `8453`, `1`).

A `401` from the gateway usually means the API key was minted for a
different Newton environment than `prod`.

## Verify without printing

At the live-attach checkpoint, confirm presence of `PRIVATE_KEY`,
`NEWTON_API_KEY`, and `RPC_URL` (or the Sepolia default). Confirm pack
secret **names** required by the policy. Never print values, never echo
`Authorization` headers, and never dump `wasmArgs` that embed secrets.
