# Credentials for vault demos

Same never-print rules as `newton-policy`. Plus CLI `API_KEY` vs VaultKit
`NEWTON_API_KEY`, and Base Sepolia public RPCs.

## Never

- Ask the user to paste a dashboard JWT, private key, API key, or RPC
  credential into chat
- Print `NEWTON_API_KEY`, `API_KEY`, pack keys, `PRIVATE_KEY`, or
  credential-bearing RPC URLs
- Run `newton-cli keys show` (it prints the secret)
- Put the gateway key in client components, `demo-config.json`, or
  `NEXT_PUBLIC_*`
- Invent private keys, vault addresses, or chain IDs
- Source a project-local `.env` for `newton-cli` / VaultKit (those stay
  in the process environment or `~/.newton/.env`). The generated Next
  app may use gitignored `demos/<slug>/.env.local` only

## Gateway key: two env names, one secret

| Consumer | Env name |
|---|---|
| `newton-cli policy deploy` (CID upload) | `API_KEY` |
| VaultKit `createShield` / evaluate / `uploadSecrets` | `NEWTON_API_KEY` |
| Next curator Route Handler | `NEWTON_API_KEY` in `.env.local` |

Resolve the cached key without printing it. Typical cache file (do not
cat it into chat):

- macOS: `~/Library/Application Support/newton/api_keys.json`

Write both names into a `0600` session file such as
`~/.newton/session-api-key.env` and `set -a; source` that file in the
same shell that runs CLI and VaultKit. Confirm presence only
(`[[ -n $API_KEY && -n $NEWTON_API_KEY ]]`).

A `401` from the gateway usually means the key was minted for a different
Newton environment than `prod`.

## RPC

| Chain | Default if `RPC_URL` unset |
|---|---|
| Ethereum Sepolia `11155111` | `https://ethereum-sepolia-rpc.publicnode.com` |
| Base Sepolia `84532` | `https://base-sepolia-rpc.publicnode.com` |

Also valid on Base Sepolia: `https://sepolia.base.org` (viem default).
Its `eth_getLogs` cap is ~10k blocks; PublicNode is ~50k. Neither can
scan ShieldFactory from deploy block to latest — always pass
`allowNewVersion: true` on `createShield` ([attach-traps.md](attach-traps.md)).

If `RPC_URL` is set to an Ethereum Sepolia URL while `chainId` is
`84532`, ignore it for this demo and use the Base Sepolia default. Do
not send Base Sepolia txs to Ethereum Sepolia.

## Pack secrets

Upload uses the pack's expected name `VAULTS_FYI_API_KEY`. If the machine
only has `VAULTSFYI_API_KEY`, map the alias at `uploadSecrets` time.
Never rename live dashboard secrets in chat.

Chainalysis is out of this skill's Morpho gold path unless the brief
names it.

## Next.js

| Secret | Where |
|---|---|
| `NEWTON_API_KEY` | `demos/<slug>/.env.local` (server) |
| `PRIVATE_KEY` | same file, curator Route Handler / typed script only |
| `NEXT_PUBLIC_RPC_URL` | optional public RPC; Base Sepolia default if unset |

`.env.local` is gitignored. Do not copy filled values into this skills
repo.
