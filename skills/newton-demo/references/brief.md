# Extract requirements from a customer brief

Turn prose into a checklist the other skills can execute. Do not author
Rego or Solidity here. Do not assume a vertical.

An ERC-20 `transfer` wrapper is only the golden example in
`newton-policy-client`. Use it when the brief is an attested token transfer.
Otherwise derive the protected action from the brief.

## Capture

| Decision | Why it matters |
|---|---|
| Allow / deny conditions | Becomes `policy.rego` + params in `newton-policy` |
| External data the oracle needs | Becomes `policy.js`, `wasm_args`, optional `getSecrets()` |
| Protected action | Function the PolicyClient exposes after `_validateAttestationDirect` |
| Downstream intent | Six-field `NewtonMessage.Intent` (`to`, `value`, named `functionSignature`, `data`) |
| User args | Form fields and the prefix of the protected function before `Task` |
| Who `msg.sender` is | Must equal `intent.from` (the connected wallet) |
| Chain / environment | Handoffs, gateway URL, wagmi chain |
| Token / target address | `intent.to` and constructor extras; `null` until known |
| Whether a UI is in scope | If no, stop after `newton-policy-client` |
| Whether live txs are in scope | Controls deploy / evaluate checkpoints |

## Intent encoding

Keep one encoding across simulate, gateway evaluate, and Solidity:

- `functionSignature`: named UTF-8, e.g.
  `function transfer(address recipient, uint256 amount)`
- `dataEncoding`: canonical ABI types, e.g. `transfer(address,uint256)`
- `from`: the wallet that will sign and later call the PolicyClient
- `to`: the downstream target the *policy* evaluates (often a token), not
  always the PolicyClient address

Protected Solidity shape (generic, not USDC-specific):

```text
protectedFn(userArg1, userArg2, …, Task task, TaskResponse taskResponse, bytes signatureData)
```

`userArgs` are the application arguments. They usually match the decoded
`intent.data` arguments (the golden wrapper checks `recipient` / `amount`
against the attested transfer). If they diverge, record the mapping in
`client-handoff.json` and `demo-config.json`; do not guess.

## Stop and ask

Do **not** invent:

- Allow/deny thresholds, lists, or oracles the brief did not specify
- A chain ID or token address
- A protected function name that is not in the brief or an existing client
- Production secrets or API keys
- A second wallet / relayer so `intent.from != msg.sender`

If the brief is only "make a demo" with no policy rules, ask what should
allow and what should deny before calling `newton-policy`.

## Output of this step

A short requirements block (in chat is fine) plus, when work proceeds:

- Enough for `newton-policy` to scaffold and author
- Enough for `newton-policy-client` to choose a pattern and name
  `userArgs`
- `needsTokenApproval: true` only when the client uses `transferFrom` (or
  similar) and the connected wallet must `approve` the PolicyClient
