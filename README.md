# Newton Agent Skills

Agent Skills for Newton Protocol — install `newton-cli`, run the policy loop,
integrate PolicyClients, and scaffold a local Next.js demo from Cursor, Codex,
Claude Code, or any Agent Skills client.

Each skill is a folder under `skills/` that an agent can follow to set up
Newton, author Rego + WASM, integrate application contracts, and optionally
produce a wallet UI — using the published `newton-cli` install, not a protocol source checkout.

## Skills

| Skill | Use when |
|---|---|
| [`newton-policy`](skills/newton-policy/SKILL.md) | Installing the CLI, authoring a generic policy, and running scaffold → build → simulate (optional deploy) |
| [`newton-policy-client`](skills/newton-policy-client/SKILL.md) | Integrating Newton into a Solidity contract (`NewtonPolicyClient`, `_validateAttestationDirect`, register/set-policy) |
| [`newton-demo`](skills/newton-demo/SKILL.md) | Turning a customer brief into policy + PolicyClient + a local Next.js demo (delegates to the two skills above) |

All three skills are draft v0 and under dogfood testing. Expect gaps; report friction instead of silently working around it.

The product brief for the Newton-protected Safe passkey attack demo is
[`newton-safe-demo-brief.txt`](newton-safe-demo-brief.txt).

## Layout

```text
skills/
  newton-policy/
    SKILL.md
    references/
    templates/          # policy-handoff.json
  newton-policy-client/
    SKILL.md
    references/
    templates/          # Solidity, Foundry remappings, deploy/verify, client-handoff.json
  newton-demo/
    SKILL.md
    references/
    templates/          # demo-config.json, lite Next.js App Router app
```

`.agents/` is gitignored. Codex and Cursor discover repository skills from
`.agents/skills`. For local discovery when this repo is the workspace:

```bash
mkdir -p .agents && ln -sfn ../skills .agents/skills
```

Copy or symlink the **whole skill folder** (`SKILL.md` plus `references/` and
`templates/`). Do not copy `SKILL.md` alone.

## Use in Cursor

Open this repository as the workspace after creating the local
`.agents/skills` symlink above. Skills load from that path.

To use a skill in another project, copy or symlink the skill folder from
`skills/` into that project's `.agents/skills/` or `.cursor/skills/`.

## Use in Codex

Codex scans `.agents/skills` from the current working directory up to the
repository root, and loads personal skills from `$HOME/.agents/skills`.

**This repository as the workspace.** Create the `.agents/skills` symlink
above, then open the repo in Codex CLI or the IDE extension. List skills with
`/skills`. Invoke with `$newton-policy`, `$newton-policy-client`, or
`$newton-demo`. Restart Codex if a newly linked skill does not appear.

**Another project.** Copy or symlink each skill into that project's
`.agents/skills/` (repo-scoped) or into `~/.agents/skills/` (every repo):

```bash
mkdir -p /path/to/app/.agents/skills
ln -sfn /path/to/newton-agent-skills/skills/newton-policy \
  /path/to/app/.agents/skills/newton-policy
ln -sfn /path/to/newton-agent-skills/skills/newton-policy-client \
  /path/to/app/.agents/skills/newton-policy-client
ln -sfn /path/to/newton-agent-skills/skills/newton-demo \
  /path/to/app/.agents/skills/newton-demo
```

Codex follows symlinked skill folders. If two installed skills share a
`name`, both can appear; do not install duplicates.

## Use in Claude Code

Copy a skill folder from `skills/` into `.claude/skills/` or `~/.claude/skills/`.

## Requirements

Skills shell out to `newton-cli`:

```bash
curl -L cli.newton.xyz | sh && newtup
export PATH="$(npm config get prefix)/bin:$HOME/.newton/bin:$PATH"
newton-cli doctor
```

`doctor` can report `jco` as found while `policy build` still fails if the
npm-global binary directory is not on `PATH`. Keep that `export` in the same
shell that runs builds (`newton-policy` documents this).

Reusable on-chain policy oracles live in [`newton-policy-packs`](https://github.com/newt-foundation/newton-policy-packs), not this repo.

## License

Apache License 2.0. See [LICENSE](LICENSE).
