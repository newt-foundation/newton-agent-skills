# Evaluate an intent (gateway, not CLI)

Do **not** use `newton-cli policy-client` or `newton-cli task` for evaluation.
This path is what `@newton-xyz/sdk` `evaluateIntentDirect` does: sign the
intent with EIP-712, then POST `newt_createTask` to the gateway for the
intent's chain.

Source of truth: [`@newton-xyz/sdk`](https://www.npmjs.com/package/@newton-xyz/sdk)
(`evaluateIntentDirect` → `newt_createTask`). Agents may call the HTTP
endpoint directly; installing the SDK is optional.

Only run this when the user asked for a live gateway round-trip, the client
is wired (`getPolicyId() != bytes32(0)`), and `getOwner()` is the dashboard
login wallet. The gateway checks that wallet against the API key.

## Pick the gateway by chain

SDK `GATEWAY_API_URLS` (wallet-client `chain.id`):

| Chain | ID | Gateway |
|---|---|---|
| Ethereum Sepolia | `11155111` | `https://gateway.testnet.newton.xyz/rpc` |
| Base Sepolia | `84532` | `https://gateway.testnet.newton.xyz/rpc` |
| Ethereum | `1` | `https://gateway.newton.xyz/rpc` |
| Base | `8453` | `https://gateway.newton.xyz/rpc` |

Use the URL for `intent.chainId`. Do not invent other gateway hosts.

Auth: `Authorization: Bearer <API_KEY>` and `Content-Type: application/json`.
Resolve the bearer from `newton-cli keys` (logged-in user → active RpcWrite
key → local CLI cache). Do not look for `NEWTON_API_KEY` in `~/.newton/.env`;
that file is for `PRIVATE_KEY` and `RPC_URL`. For a Next.js demo, copy the
cached secret into `demos/<slug>/.env.local` (never `NEXT_PUBLIC_*`). Never
print the key.

The live gateway also requires PolicyClient ownership: `getOwner()` must match
the dashboard identity behind that key.

## 1. Form the intent

Same six fields as on-chain `NewtonMessage.Intent`. Keep one encoding across
Rego simulation, this POST, and Solidity:

| Field | Meaning |
|---|---|
| `from` | Signer / later `msg.sender` (`0x` address) |
| `to` | Downstream target the policy evaluates (`0x` address) |
| `value` | ETH attached to that target call |
| `data` | Selector + ABI arguments (`0x` hex) |
| `chainId` | Destination chain |
| `functionSignature` | UTF-8 ABI description as bytes, not a 4-byte selector |

`from` must be the address that will sign and later call the protected
entrypoint. Addresses are `0x`-prefixed hex strings, never JSON objects.

`functionSignature` in the HTTP body is **hex-encoded UTF-8** of the exact
string the client hashes (for the template,
`function transfer(address recipient, uint256 amount)` — the same named
form `policy scaffold` puts in `intent.json`). Hex-encode that whole
string; do not swap in a 4-byte selector or drop parameter names. Use the
same bytes the Solidity `keccak256` check uses, including the `function `
prefix.

For the POST, convert `value` and `chainId` to hex quantities (`0x0`,
`0xaa36a7` for Sepolia). The SDK's `sanitizeIntentForRequest` does that and
renames to snake_case (`chain_id`, `function_signature`).

## 2. Sign the intent (EIP-712)

`evaluateIntentDirect` does **not** sign. The app signs first and passes
`intentSignature`. Omit it or send `"0x"` and the gateway can fail with
`Failed to encode intent signature: 0x reason: expected exactly 65 bytes`.

Typed data:

```text
primaryType: Intent
Intent: from address, to address, value uint256, data bytes,
        chainId uint256, functionSignature bytes
```

In the message, `value` and `chainId` must be `BigInt`. `functionSignature`
is the raw ABI-description bytes (hex in viem). `intent.from` is the signer.

### Domain

1. Prefer EIP-5267 on the PolicyClient. Read `eip712Domain()` and use
   `name`, `version`, `Number(chainId)`, `verifyingContract`:

```text
eip712Domain() returns
  (bytes1 fields, string name, string version, uint256 chainId,
   address verifyingContract, bytes32 salt, uint256[] extensions)
```

2. If that call reverts (this skill's template has no EIP-712 mixin), use a
   fallback domain that you record and keep stable:

| Field | Value |
|---|---|
| `name` / `version` | Match the client's `EIP712(name, version)` constructor if it has one; otherwise a documented pair such as `"NewtonPolicyClient"` / `"1"` |
| `chainId` | Intent chain id |
| `verifyingContract` | The PolicyClient address |

Do not invent a verifying contract. If you later add OpenZeppelin `EIP712` to
the client, those constructor strings must match the domain you sign with.

viem shape (same as the SDK docs):

```js
const intentSignature = await walletClient.signTypedData({
  account,
  domain, // from eip712Domain() or the fallback above
  types: {
    Intent: [
      { name: "from", type: "address" },
      { name: "to", type: "address" },
      { name: "value", type: "uint256" },
      { name: "data", type: "bytes" },
      { name: "chainId", type: "uint256" },
      { name: "functionSignature", type: "bytes" },
    ],
  },
  primaryType: "Intent",
  message: {
    from: intent.from,
    to: intent.to,
    value: BigInt(intent.value),
    data: intent.data,
    chainId: BigInt(intent.chainId),
    functionSignature: intent.functionSignature,
  },
});
```

The result is a 65-byte secp256k1 signature (`0x` + 130 hex chars). Never
print the private key. `cast wallet sign` without typed-data hashing is not a
substitute unless you build the same EIP-712 digest.

## 3. POST `newt_createTask`

JSON-RPC `id` must be a **UUID string**, not integer `1` (gateway `422`).

`timeout` is **seconds** (gateway default if omitted is 10). Do not send
milliseconds. The published SDK page sometimes labels this field ms; the SDK
type and the gateway struct are seconds.

The SDK always sets `direct_broadcast: true` and strips the `0x` prefix from
`intent_signature` / `wasm_args` / `quorum_number`. The gateway accepts
signatures with or without `0x`. Extra unknown fields are ignored.

```bash
curl -sS -X POST "$GATEWAY_URL" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $API_KEY" \
  -d "$(cat <<EOF
{
  "jsonrpc": "2.0",
  "id": "$(uuidgen | tr '[:upper:]' '[:lower:]')",
  "method": "newt_createTask",
  "params": {
    "policy_client": "0xPOLICY_CLIENT",
    "intent": {
      "from": "0xFROM",
      "to": "0xTO",
      "value": "0x0",
      "data": "0xCALLDATA",
      "chain_id": "0xaa36a7",
      "function_signature": "0xHEX_UTF8_ABI"
    },
    "intent_signature": "0x65_BYTE_SIG",
    "timeout": 30
  }
}
EOF
)"
```

Optional params the SDK forwards when present: `quorum_number` (hex bytes,
e.g. `"00"`), `quorum_threshold_percentage` (0–100), `wasm_args` (hex),
`proof_cid`, `include_validate_calldata`.

Do not echo the Authorization header or the signed JSON if it contains
secrets in `wasm_args`.

## 4. Read the result

On JSON-RPC `error`, stop and report the message. On `result.error` / failed
`status`, same.

Success (`status: "success"`) includes:

| Field | Use |
|---|---|
| `task_id` | Correlate logs; later replay tests |
| `task` | First argument to `_validateAttestationDirect` |
| `task_response` | Second argument (intent, `policy_id`, `evaluation_result`, …) |
| `signature_data` | Third argument (`blsSignature` in the SDK return) |

The SDK treats `task_response.evaluation_result` as allow when the bytes
decode to a non-zero integer (`hexToBigInt`). Zero bytes are deny. A deny is
still a completed evaluation; do not retry as if the POST failed.

`evaluation_result: true` is not on-chain execution. The user still submits
`task`, `taskResponse`, and `signatureData` to the PolicyClient.

## Do not

- Call `newton-cli task submit-evaluation-request`
- Call `newton-cli policy-client` for submit, status, or wiring
- Invent chain IDs, gateway URLs, contract addresses, or a signer
- Ask the user to paste an API key or private key into chat
