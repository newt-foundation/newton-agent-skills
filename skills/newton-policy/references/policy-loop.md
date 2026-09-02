# Local policy loop reference

Use this for scaffold → author → build → simulate → iterate. Dashboard login
and gateway API keys are not required.

## Scaffold

```bash
newton-cli policy scaffold <policy-name> -o <output-dir>
```

The policy is created at `<output-dir>/<policy-name>/`; output defaults to `.`.
Hyphens in the name become underscores in the Rego package. The command fails
if the destination already exists.

Generated layout:

```text
<policy-name>/
  policy.js
  policy.rego
  newton-provider.wit
  params_schema.json
  policy_metadata.json
  policy_data_metadata.json
  .env.example
  README.md
  configs/
    deployment.toml
    wasm_args.json
    params.json
    intent.json
```

The initial JS/Rego pair is a trivial allow stub. Do not treat it as a complete
real policy.

## Author

First clarify:

- Conditions that allow and deny
- External data the oracle needs
- Configurable parameters
- Secret names (if any)
- At least one expected allow and deny intent

Data model:

| Source | Rego path |
|---|---|
| JSON returned by `policy.js` | `data.wasm.*` |
| Policy params | `data.params.*` |
| Transaction intent | `input.*` |

Local `policy simulate`, gateway `newt_simulatePolicy`, and live operators
all inject WASM output under `data.wasm`. Do not read it from `data.data`.

Entrypoint derives from the Rego package:
`package my_policy` → `data.my_policy.allow`.
Use `default allow := false`.

### Code first, then schemas

- Write `policy.js` to read only intended inputs/secrets.
- Define `secrets_schema.json` to match keys actually read from `getSecrets()`.
- Write Rego against intended `data.wasm.*` and `data.params.*` fields.
- Keep `params_schema.json` and `configs/params.json` aligned.
- Do not declare unused fields or read undeclared fields.

### `policy.js`

It must export `run(wasm_args)` and return a JSON string. JavaScript parameter
names are positional (the WIT calls this parameter `input`), but Newton policy
examples consistently use `wasm_args` because `configs/wasm_args.json` supplies
this value.

`policy build` disables WASI `stdio`, `random`, `clocks`, `http`, and
`fetch-event`. Do not use globals backed by those features. Import Newton WIT
interfaces instead:

```javascript
import { fetch as httpFetch } from "newton:provider/http@0.2.0";
import { get as getSecrets } from "newton:provider/secrets@0.2.0";
```

`getSecrets()` returns one JSON document as bytes, not a per-key API. Parse
once, then read fields. Leave imports unused/commented when the policy does not
need them.

Keep returned fields stable because Rego reads them through `data.wasm`.

### `policy.rego`

```rego
package my_policy

import future.keywords

default allow := false

allow if {
    data.wasm.success
    # goal-specific checks using data.wasm, data.params, and input
}
```

### Configs

- `configs/wasm_args.json`: JSON string/object passed into `run()`
- `configs/params.json`: values exposed as `data.params`
- `configs/intent.json`: transaction exposed as `input`

Typical intent (gateway six-field shape; `functionSignature` is hex-encoded
UTF-8 of the named ABI string, matching `policy scaffold`):

```json
{
  "from": "0x0000000000000000000000000000000000000001",
  "to": "0x0000000000000000000000000000000000000002",
  "value": "0",
  "chainId": "11155111",
  "functionSignature": "0x66756e6374696f6e207472616e73666572286164647265737320726563697069656e742c2075696e7432353620616d6f756e7429",
  "data": "0xa9059cbb0000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000002540be400"
}
```

Decoded `functionSignature` must be
`function transfer(address recipient, uint256 amount)` (named parameters).
Do not use `functionName` / `args`; those fields are not the gateway intent.

## Build

```bash
newton-cli policy build -p <policy-dir>
```

Use the CLI; do not invoke `jco componentize` directly.

The CLI checks source/template files, creates `dist/`, compiles
`policy.js` to `dist/policy.wasm`, and copies Rego/schema/metadata artifacts.

Expected:

```text
<policy-dir>/dist/
  policy.wasm
  policy.rego
  params_schema.json
  policy_metadata.json
  policy_data_metadata.json
```

`policy_cids.json` is produced later during deploy/generate-cids.

Common failures:

- Missing files: scaffold/restore the required template files.
- `jco` missing: run `doctor` and install componentize dependencies.
- `jco` found by `doctor` but `policy build` cannot run it: the npm-global
  binary directory is not on `PATH`. Export
  `PATH="$(npm config get prefix)/bin:$PATH"` in this session (CLI README)
  and retry. Do not reinstall until `command -v jco` fails.
- Componentize failure: fix JS/WIT syntax, import version, or disabled WASI
  usage.

Never hand-edit `dist/policy.wasm`; edit source and rebuild.

## Simulate

Preferred:

```bash
newton-cli policy simulate -p <policy-dir>
```

With `-p`, the CLI resolves:

- `dist/policy.wasm`
- `dist/policy.rego`
- `<package>.allow`
- `configs/wasm_args.json` (or `{}`)
- `configs/intent.json` (or default zero intent)
- `configs/params.json` (or `{}`)

Explicit overrides:

```bash
newton-cli policy simulate -p <policy-dir> \
  --wasm-args <wasm_args.json> \
  --secrets-file </path/outside-repo/local-secrets.json> \
  --intent-json <intent.json> \
  --policy-params-data <params.json> \
  --entrypoint <package>.allow
```

The CLI runs WASM, constructs
`{"params": <params>, "wasm": <wasm-output>}`, evaluates Rego, and prints
ALLOWED/DENIED. That object is the same shape live evaluation uses.

When `policy.js` calls `getSecrets()`, use `--secrets-file` with a
non-production plaintext JSON object. The CLI injects it into `getSecrets()`
for that local run only; it does not upload, encrypt, print, or validate it
against an on-chain schema. Never commit the fixture or use production
credentials. Do not silently fall back to putting secret-shaped values in
`wasm_args`.

Run at least:

1. Expected allow case → ALLOWED
2. Expected deny case → DENIED

For WASM-only debugging:

```bash
newton-cli policy-data simulate \
  --wasm-file <policy-dir>/dist/policy.wasm \
  --input-json '{"address":"0x1234..."}'
```

Local execution has no live `(policy_client, policy_data)` secrets context, so
uploaded production secrets are not available. `--secrets-file` is only a
local fixture path; live deployment/evaluation still uses client-scoped,
encrypted secrets.

## Iterate

```text
observe output/error
  → classify oracle vs Rego vs config issue
  → patch the smallest relevant source
  → rebuild if needed
  → rerun allow + deny
```

Rebuild after changing:

- `policy.js`
- `newton-provider.wit`
- `policy.rego`
- schema/metadata files copied into `dist/`

Re-simulate without rebuilding when only changing:

- `configs/wasm_args.json`
- `configs/intent.json`
- `configs/params.json`
- Local `--secrets-file` fixture contents

Local loop is done when:

- Build and simulation have no errors.
- Allow and deny cases match the goal.
- Code, configs, and schemas remain aligned.
- The user can rerun the documented commands.

Do not deploy unless the user explicitly asks or confirms.
