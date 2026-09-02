# Credentials for the demo app

Same rules as `newton-policy` and `newton-policy-client`, plus Next.js
specifics.

## Never

- Ask the user to paste a dashboard JWT, private key, API key, or RPC
  credential into chat
- Put `NEWTON_API_KEY` in client components, `demo-config.json`, or any
  `NEXT_PUBLIC_*` variable
- Commit `.env`, `.env.local`, secrets JSON, or private keys
- Source a project-local `.env` for `newton-cli` / Foundry (those stay in
  the process environment or `~/.newton/.env`)
- Copy the official frontend guide's browser `apiKey` or
  `SIGNER_PRIVATE_KEY` pattern
- Invent private keys, credential-bearing RPC URLs, contract addresses, or
  chain IDs. Ethereum Sepolia may use
  `https://ethereum-sepolia-rpc.publicnode.com` when `RPC_URL` /
  `NEXT_PUBLIC_RPC_URL` is unset.

## Where values live

| Secret | Where |
|---|---|
| `PRIVATE_KEY` (Foundry deploy) | Process env or `~/.newton/.env` |
| `RPC_URL` (Foundry / CLI) | Process env or `~/.newton/.env`. Ethereum Sepolia default: `https://ethereum-sepolia-rpc.publicnode.com` |
| `NEWTON_API_KEY` (gateway) | From `newton-cli keys` (CLI cache). Copy into `demos/<slug>/.env.local` for Next, or the host's env (Vercel). Not `~/.newton/.env`. |
| `NEXT_PUBLIC_RPC_URL` | Optional public RPC for wagmi; not a secret if it is a public endpoint. Sepolia default is the same PublicNode URL if unset. |
| Policy WASM secrets | `newton-cli secrets upload` after owner transfer; never in the demo form |

`.env.local` is allowed **only** for the generated Next.js app because Next
loads it automatically. Keep it gitignored. Do not copy it into the skills
repo.

## Server vs browser

EIP-712 signing happens in the **browser** with the user's wallet.
`evaluateIntentDirect` happens in the **Route Handler** with
`NEWTON_API_KEY`.

The gateway key is not a "demo evaluate only" credential. The same RpcWrite
key authenticates `newt_createTask` **and** `newton-cli secrets upload`.
Upload is authorized as the dashboard identity behind the key, matched to
PolicyClient `getOwner()`. A key scraped from client JS / `NEXT_PUBLIC_*` /
browser bundles lets an attacker evaluate as that owner **and** replace
client-scoped WASM secrets (including a registered passkey public key).
Keep it on the server. Do not treat "it is only used to create tasks" as
mitigation.

The Route Handler may construct a throwaway viem account so the SDK can
attach wallet-client actions. That account must never sign, never hold
funds, and never be shown as the user's identity. `intent.from` is the
connected wallet.

## Verify without printing

At the evaluate checkpoint, resolve the gateway key from `newton-cli keys`
and confirm `NEWTON_API_KEY` is set in the demo app environment. Confirm only
presence. Never print the value, never echo `Authorization` headers, and
never dump signed intents that embed secret `wasm_args`.
