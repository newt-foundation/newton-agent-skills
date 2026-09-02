# Agent notes

This repository is the canonical home for Newton Agent Skills.

## Layout

- Canonical skill trees live under `skills/<skill-name>/`.
- `.agents/` is gitignored. For local Cursor/Codex discovery, symlink
  `ln -sfn ../skills .agents/skills`.
- Each skill is a folder with `SKILL.md` (required) and optional `references/`, `templates/`, `scripts/`, and `assets/`.

## Adding a skill

1. Create `skills/<name>/SKILL.md` with YAML frontmatter (`name` and `description`).
2. `name` must match the folder name: lowercase letters, numbers, and hyphens only.
3. Write the description in third person. Include what the skill does and when to use it.
4. Keep `SKILL.md` under 500 lines. Put detailed procedures in `references/` and link them one level deep from `SKILL.md`.
5. Point at `newton-cli` and `newton-policy-packs`. Do not embed CLI source, contracts, or policy-pack source here.

## Updating skills

When `newton-cli` flags or the policy loop change, update `newton-policy` in the same change set as the CLI (or immediately after). When `NewtonPolicyClient` / `_validateAttestationDirect` semantics change, update `newton-policy-client`. When the demo app evaluate path or `demo-config.json` shape changes, update `newton-demo`. Do not let the skills drift.

`newton-policy-client/templates/` holds copyable Foundry files (contract, tests,
remappings, deploy/verify scripts). `newton-policy/templates/` holds the policy
handoff JSON. `newton-demo/templates/` holds a lite Next.js app and
`demo-config.json`. Do not vendor `newton-contracts` contract source here.

## Credential safety

- Never ask the user to paste a dashboard JWT, private key, API key, or RPC credential into chat.
- Never commit secrets, private keys, JWTs, or a project-local `.env`.
- Do not invent private keys, RPC URLs, contract addresses, chain IDs, or expiration values.

## What not to put here

- Internal operator or observability skills.
- Policy pack source ([`newton-policy-packs`](https://github.com/newt-foundation/newton-policy-packs)).
- Plugin/marketplace manifests until this pack is actually published that way.
