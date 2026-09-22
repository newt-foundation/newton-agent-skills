# Agent notes

This repository is the canonical home for Newton Agent Skills.

## Layout

- Canonical skill trees live under `skills/<skill-name>/`.
- `.agents/` is gitignored. Codex and Cursor discover repository skills from
  `.agents/skills` (Codex also loads `$HOME/.agents/skills`). For local
  discovery, symlink `ln -sfn ../skills .agents/skills`. Codex install
  details: README "Use in Codex".
- Each skill is a folder with `SKILL.md` (required) and optional `references/`, `templates/`, `scripts/`, and `assets/`.

## Adding a skill

1. Create `skills/<name>/SKILL.md` with YAML frontmatter (`name` and `description`).
2. `name` must match the folder name: lowercase letters, numbers, and hyphens only.
3. Write the description in third person. Include what the skill does and when to use it.
4. Keep `SKILL.md` under 500 lines. Put detailed procedures in `references/` and link them one level deep from `SKILL.md`.
5. Point at `newton-cli` and `newton-policy-packs`. Do not embed CLI source, contracts, or policy-pack source here.

## Updating skills

When `newton-cli` flags or the policy loop change, update `newton-policy` in the same change set as the CLI (or immediately after). Published pack lookup (`newton-cli policy packs`) and composite `--policy-data-address` order belong in `newton-policy`, not `newton-vault-shield`. When `NewtonPolicyClient` / `_validateAttestationDirect` semantics change, update `newton-policy-client`. When VaultKit `createShield` / vendor overlays / `assertIntentBlocked` change, update `newton-vault-shield`. When a vault brief, Shield UI, or VaultKit params envelope / secrets-owner path changes, update `newton-vault-demo`. When the PolicyClient demo app evaluate path or `demo-config.json` shape changes, update `newton-demo`. Do not let the skills drift.

`newton-policy-client/templates/` holds copyable Foundry files (contract, tests,
remappings, deploy/verify scripts). `newton-policy/templates/` holds the policy
handoff JSON. `newton-vault-shield/templates/` holds VaultKit attach scripts and
`shield-handoff.json`. `newton-vault-demo/templates/` holds the Vaults.fyi / Chainalysis envelope
reference, a filled Morpho e2e script, and the Morpho two-view Next.js app.
`newton-vault-demo` is the orchestrator for every vault brief; Morpho is one branch.
`newton-demo/templates/` holds a lite Next.js app and
`demo-config.json`. Do not vendor `newton-contracts` or VaultKit source here.

## Credential safety

- Never ask the user to paste a dashboard JWT, private key, API key, or RPC credential into chat.
- Never commit secrets, private keys, JWTs, or a project-local `.env`.
- Do not invent private keys, credential-bearing RPC URLs, contract addresses, chain IDs, or expiration values.
- Ethereum Sepolia (`11155111`) may use the documented public RPC
  `https://ethereum-sepolia-rpc.publicnode.com` when `RPC_URL` is unset.
- Base Sepolia (`84532`) may use `https://base-sepolia-rpc.publicnode.com`
  (or `https://sepolia.base.org`) when `RPC_URL` is unset. If `RPC_URL` is
  Ethereum Sepolia while the brief is Base Sepolia, do not send txs there.

## What not to put here

- Internal operator or observability skills.
- Policy pack source ([`newton-policy-packs`](https://github.com/newt-foundation/newton-policy-packs)).
- Plugin/marketplace manifests until this pack is actually published that way.
