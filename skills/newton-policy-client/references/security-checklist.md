# Security checklist

Run this before compiling is considered done. Fail closed.

## Authorization boundary

- [ ] `_validateAttestationDirect` (or `_validateAttestation`) runs before
      any state change or token movement
- [ ] `false` evaluation result reverts; it does not fall through
- [ ] Protected function executes only values compared with the attested intent
- [ ] `intent.to`, `intent.value`, selector, arguments, and function metadata
      are all bound
- [ ] No generic `intent.to.call{value: intent.value}(intent.data)` unless the
      user explicitly required arbitrary execution and extra constraints exist

## Mixin guarantees you must not weaken

- [ ] Do not bypass `intent.from == msg.sender` without a verified relay scheme
- [ ] Do not skip chain-id checks
- [ ] Do not accept a Task/TaskResponse pair whose overlapping fields diverge
- [ ] Do not treat `intentSignature` as a verified user signature on this path

## Setup

- [ ] Constructor/`initialize` calls `_initNewtonPolicyClient` and
      `_setPolicyAddress` only
- [ ] `setPolicy` happens after deployment
- [ ] `expireAfter > 0`
- [ ] TaskManager and Policy addresses came from the user or
      `newton-cli deployments show` / a prior `newton-policy` deploy; they were
      not invented
- [ ] Constructor `policyClientOwner` is the local deploy key, not the
      dashboard / `newton-cli login` wallet
- [ ] After `setPolicy` (and optional register), ownership is transferred to
      the login wallet with `setPolicyClientOwner` when secrets or gateway
      evaluate are in scope. Do not use registry `setClientOwner` for that
      (registry record only; the two owners can diverge)
- [ ] After that transfer, do not plan `setPolicy` on the same client;
      replace the client instead (see
      [deployment-and-wiring.md](deployment-and-wiring.md))
- [ ] Live evaluate uses EIP-712 signing + gateway `newt_createTask`, not
      `newton-cli policy-client` or `newton-cli task` (see
      [evaluate-intent-direct.md](evaluate-intent-direct.md))

## Tokens and calls

- [ ] ERC-20 wrappers use `safeTransferFrom` (or equivalent) after the sender
      has approved the wrapper
- [ ] ETH is accepted only when `intent.value` was bound and `msg.value` matches
      if the entrypoint is payable
- [ ] Reentrancy: external calls happen after checks and authorization; use a
      non-reentrant guard if the action calls out then updates state

## Replay and freshness

- [ ] Tests cover replay of the same `taskId`
- [ ] Tests cover stale responses past the response window
- [ ] Tests cover policy denial (no funds moved)

## Relayers

If `msg.sender` will not be `intent.from`, stop. Direct validation will revert
`Not authorized intent sender`. Do not "fix" this by forwarding `intent.from`
or skipping the mixin. Relayed designs are out of scope for this skill unless
the user supplies an explicit signature scheme to verify.
