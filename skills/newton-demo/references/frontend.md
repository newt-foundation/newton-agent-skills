# Lite Next.js demo app

Copy [templates/app/](../templates/app/) to `demos/<slug>/` in the user's
workspace (this repo gitignores `demos/`). Do not start from a USDC-specific
page. Fill `demo-config.json` from the handoffs.

## Why App Router

Wallet connect and the attested write run in the browser. The gateway API
key must not. A Next.js Route Handler is the smallest Vercel-native way to
keep `NEWTON_API_KEY` on the server. Do not put evaluate in a client
component.

Vite is not the primary template: you would still need a serverless proxy
for `newt_createTask`.

## Fill `demo-config.json`

Map from `client-handoff.json` (and the policy handoff it points at):

| Demo field | Source |
|---|---|
| `chainId` | Client / policy handoff |
| `policyClient` | `client-handoff.policyClient` (null until deployed) |
| `target` | Concrete `intent.to` when known; else `null` and the UI asks |
| `needsTokenApproval` | `true` only for `transferFrom`-style wrappers |
| `protectedFunction.name` | Solidity entrypoint name |
| `protectedFunction.userArgs` | Application args before `Task` |
| `intent.*` | Same named `functionSignature` / `dataEncoding` as the handoffs |
| `eip712` | `"NewtonPolicyClient"` / `"1"` unless the client has an EIP-712 mixin |
| `wasmArgs` | Optional JSON object for the oracle; `null` if unused |

Never put keys, RPC URLs, or secrets JSON in this file.

`userArgs` order is the protected function's user arguments and, for the
golden wrapper, the `intent.data` arguments. If those lists differ, document
the mapping in the handoff and wire the page explicitly.

## Run locally

```bash
cd demos/<slug>
cp .env.example .env.local   # copy gateway key from newton-cli keys; never paste in chat
npm install
npm run dev
```

Open the printed localhost URL. Confirm the connected wallet is the address
that will be `intent.from` / `msg.sender`.

The Route Handler uses `@newton-xyz/sdk` `evaluateIntentDirect`. `timeout`
is **seconds** (send `30`). The published SDK page sometimes labels this
field milliseconds; the gateway struct and
[evaluate-intent-direct.md](../../newton-policy-client/references/evaluate-intent-direct.md)
are seconds.

If the SDK client is awkward on the server (it wants a `WalletClient`), the
template builds a throwaway account that never signs. Prefer that over a
real `SIGNER_PRIVATE_KEY`. HTTP `newt_createTask` in
`evaluate-intent-direct.md` is an allowed fallback.

## Signing and evaluate

1. Prefer `eip712Domain()` on the PolicyClient. If it reverts (the golden
   wrapper has no EIP-712 mixin), use `demo-config.eip712` with
   `verifyingContract` = PolicyClient.
2. Sign typed data `Intent` in the browser (`value` and `chainId` are
   `BigInt`; `functionSignature` is hex UTF-8 of the **named** ABI string).
3. POST `{ policyClient, intent, intentSignature, wasmArgs? }` to
   `/api/evaluate`. Do not send the API key.
4. Allow is `evaluationResult === true` (SDK) / non-zero
   `evaluation_result` bytes (raw gateway). Deny is a completed evaluation;
   do not retry as if the POST failed.
5. On allow, `writeContract` the protected function with normalized
   `task`, `taskResponse`, and `signatureData` (`blsSignature` in the SDK
   return). Gateway JSON may use snake_case and byte arrays; the Route
   Handler normalizes to viem hex (uint fields as `0x…` strings, not
   `BigInt` — `JSON.stringify` cannot serialize BigInt).

`functionSignature` must match the client `keccak256` check byte-for-byte.
Do not use the unnamed form from some public SDK examples.

## Token approval

If `needsTokenApproval` is true, show an ERC-20 `approve(policyClient, …)`
against `target` before the attested write. Do not hard-code a token symbol.

## Vercel env shape (do not deploy unless asked)

| Name | Where | Notes |
|---|---|---|
| `NEWTON_API_KEY` | Server env | Required. Never `NEXT_PUBLIC_` |
| `NEXT_PUBLIC_RPC_URL` | Build / client | Optional public RPC. Ethereum Sepolia default: `https://ethereum-sepolia-rpc.publicnode.com` |
| `RPC_URL` | Server env | Optional; Route Handler falls back to `NEXT_PUBLIC_RPC_URL`, then the Sepolia public URL above, then the chain default |

Do not add `NEXT_PUBLIC_NEWTON_API_KEY`. Production deploy, preview URLs,
and custom domains are out of scope until the user asks.

## Do not

- Import `@newton-xyz/sdk` with an apiKey in a Client Component (scraped
  keys can `newt_createTask` and `secrets upload` as `getOwner()`)
- Import `injected` from `wagmi/connectors` (that barrel pulls Coinbase
  `baseAccount` / optional `@x402/*`). Use `@wagmi/core` instead.
- Use `newton-cli task` or `newton-cli policy-client` from the app
- Submit the attested tx on deny
- Change `functionSignature` to make a public SDK snippet compile
