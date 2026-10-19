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
e.g. `"00"`), `quorum_threshold_percentage` (0–100), `wasm_args`,
`proof_cid`, `include_validate_calldata`.

The admitted task freezes the client's ordered policy set. `wasmArgs` is one
slot per policy, in that same order. A pure-Rego policy still takes an empty
slot. Do not merge oracle JSON across policies.

On the wire, `wasm_args` is an **array of hex strings** (the gateway type is
`Vec<String>`). Each entry is the hex-encoded UTF-8 of the string that
policy's `run(wasm_args)` receives, usually a JSON document. This one is
`{"chainId":"11155111"}`:

```json
"wasm_args": ["0x7b22636861696e4964223a223131313535313131227d"]
```

`wasm_args` is caller-controlled and lands in public task data. Use it to
select or anchor what the oracle fetches, never for secrets or authorization.

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
| `task_response` | Second argument (intent, `policy_id`, `allowed`, …) |
| `signature_data` | Third argument (`blsSignature` in the SDK return) |

On chain, allow is `taskResponse.allowed == true`, which is true only when
every policy in the set allowed. A deny is still a completed evaluation; do
not retry as if the POST failed. If the JSON still names
`evaluation_result`, map a non-zero result to `allowed` before you describe
the verdict, and submit the gateway's `task` / `task_response` bytes
unchanged.

`allowed: true` is not on-chain execution. The user still submits
`task`, `taskResponse`, and `signatureData` to the PolicyClient.

### Oracle output and Rego in the response

`task_response.policy_task_data[i]` (one per policy, in set order) holds what
operators signed for that policy:

| Field | Contents |
|---|---|
| `policyAddress` | The Policy that evaluated |
| `policyData[0].data` | Hex of the JSON the policy's `run()` returned |
| `policyData[0].wasmArgs` | Hex of that policy's `wasm_args` entry |
| `policy` | Hex of the Rego source operators evaluated |

Decode `data` to show users the measured values behind a verdict. A denied
task (`allowed: false`) is still a signed, completed evaluation.

A failed `status` whose error contains `failed to instantiate wasm component`
and an import such as `newton:provider/tlsn@0.2.0` means the policy WASM was
built against an outdated WIT. Fix it in `newton-policy` (policy-loop.md,
Build) and deploy a new Policy.

To list past verdicts for a client without an indexer, read the TaskManager's
logs: [reading-results.md](reading-results.md).

## Do not

- Call `newton-cli task submit-evaluation-request`
- Call `newton-cli policy-client` for submit, status, or wiring
- Invent chain IDs, gateway URLs, contract addresses, or a signer
- Ask the user to paste an API key or private key into chat
