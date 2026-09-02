# Setup and authentication reference

Read this when installing `newton-cli`, checking its policy toolchain, or when
an operation requires dashboard/gateway authentication.

## Install

Check first:

```bash
newton-cli --version
```

If missing, install `newtup`, then the latest stable CLI:

```bash
curl -L cli.newton.xyz | sh
newtup
newton-cli --version
```

The default binary location is `~/.newton/bin/`. If the shell cannot find it:

```bash
source ~/.zshrc   # or ~/.bashrc
export PATH="$HOME/.newton/bin:$PATH"
```

Useful alternatives:

```bash
newtup --list
newtup -v <version>
newtup -v nightly
```

macOS/Linux have prebuilt binaries. Use WSL on Windows. Prefer `newtup`
over a source build unless the user already has CLI source and asks for it.

## Policy toolchain

Put the npm-global binary directory and `~/.newton/bin` on `PATH` **before**
`doctor` and **before every** `policy build` in this session. `newton-cli
doctor` can report `jco` as found while `policy build` still fails, because
doctor may resolve the binary through the npm prefix while the build
subprocess only searches `PATH`. The CLI README documents this: add the
npm-global binary directory to `PATH`.

```bash
export PATH="$(npm config get prefix)/bin:$HOME/.newton/bin:$PATH"
command -v jco
newton-cli doctor
```

Install missing WASM build dependencies as appropriate:

```bash
brew install node   # macOS example
npm install -g @bytecodealliance/jco @bytecodealliance/componentize-js @bytecodealliance/preview2-shim
export PATH="$(npm config get prefix)/bin:$PATH"
```

Rerun `doctor` until clean, then confirm `command -v jco` succeeds in the
**same** shell that will run `policy build`. A green `doctor` is not proof
that `jco` is on `PATH`.

If the user's interactive shell will run builds later, tell them they can
persist the npm-global `bin` on `PATH` in their shell profile. Do not edit
their rc files without asking.

## Decide whether login is needed

Login is **not required** for scaffold, author, build, or local policy logic.
Only enter this section for an authenticated dashboard/gateway operation.

For gateway-key setup, check without exposing credentials:

```bash
newton-cli keys list
```

- Success + active `rpc`/`rpc_write` key: reuse it.
- `Not logged in`: start browser login.
- Logged in but no usable key: create one; do not relogin unnecessarily.

Do not use `newton-cli auth token` as a status check because it prints the JWT.

## Browser login (human checkpoint)

```bash
newton-cli login
```

The CLI opens or prints a dashboard `/cli-login?session_id=…` URL and waits up
to five minutes.

Agent procedure:

1. Give the displayed URL to the user.
2. Pause while the user signs up/signs in and completes wallet actions.
3. Do not operate the browser, link a wallet, or sign for the user.
4. Resume only after `Login successful.` and a wallet address are printed.
5. Verify by retrying the intended non-secret operation (`keys list`, etc.).

If no wallet is linked, ask the user to link it in the dashboard and rerun
login. If the session expires/times out, rerun login and present the new URL.

Production defaults:

- Dashboard: `https://dashboard.newton.xyz`
- API: `https://dashboard.api.newton.xyz`

For a user-specified non-production environment:

```bash
newton-cli login \
  --dashboard-url https://… \
  --api-url https://…
```

## Headless / CI login

Only use a JWT the user has securely injected into the real process
environment or `~/.newton/.env`:

```bash
newton-cli login
```

`NEWTON_ACCESS_TOKEN` is intentionally not read from a project-local `.env`.
Do not ask the user to paste the token into chat and do not pass
`--access-token "…"` because it can leak through command history/process
inspection.

## Gateway API key

Requires successful dashboard login:

```bash
newton-cli keys list
newton-cli keys create --name <name>
```

Optional creation flags:

- `--description <text>`
- `--rate-limit <number>`
- `--expires-at <ISO-8601>`

Created keys receive `rpc` permission. The secret is shown when minted and the
CLI best-effort caches it locally. Treat it as sensitive; never commit or echo
it back to the user.

Verify metadata without printing the secret:

```bash
newton-cli keys list
```

If an active key exists but its local secret cache is missing, ask before
rotating; regeneration invalidates the current secret:

```bash
newton-cli keys regenerate <key-id>
```

Gateway auth resolution generally prefers:

1. Explicit `--api-key` / `API_KEY`
2. Logged-in user → active RpcWrite key → locally cached secret

Prefer option 2 for an interactive developer machine.

## Setup completion

- `newton-cli --version` works.
- npm-global `bin` is on `PATH` and `command -v jco` succeeds in this shell.
- `newton-cli doctor` is clean for policy build.
- For local-only work: stop; no login/key required.
- For gateway work: non-secret authenticated check succeeds and an active
  RpcWrite key is available.
