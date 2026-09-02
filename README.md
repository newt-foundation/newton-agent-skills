# Newton Agent Skills

Agent Skills for Newton Protocol — install `newton-cli`, run the policy loop,
integrate PolicyClients, and scaffold a local Next.js demo from Cursor, Claude
Code, or any Agent Skills client.

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

`.agents/` is gitignored. For local Cursor/Codex discovery when this repo is
the workspace:

```bash
mkdir -p .agents && ln -sfn ../skills .agents/skills
```

## Use in Cursor

Open this repository as the workspace after creating the local
`.agents/skills` symlink above. Skills load from that path.

To use a skill in another project, copy or symlink the skill folder from `skills/` into that project's `.agents/skills/` or `.cursor/skills/`.

## Use in Claude Code

Copy a skill folder from `skills/` into `.claude/skills/` or `~/.claude/skills/`.

## Requirements

Skills shell out to `newton-cli`:

```bash
curl -L cli.newton.xyz | sh && newtup
newton-cli doctor
```

Reusable on-chain policy oracles live in [`newton-policy-packs`](https://github.com/newt-foundation/newton-policy-packs), not this repo.

## License

Apache License 2.0. See [LICENSE](LICENSE).
