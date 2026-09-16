# Attach traps (Morpho + vaultsfyi)

Use [templates/run-morpho-e2e.ts](../templates/run-morpho-e2e.ts) instead
of the `newton-vault-shield` Morpho skeleton. Default invocation prints a
plan. Pass explicit `--` flags for live txs after confirmation.

## Checksum

viem / VaultKit reject mixed-case addresses that are not EIP-55.
`getAddress()` every vault, token, market token, and listed override
before `createShield`.

## `createShield` and `eth_getLogs`

Default clone discovery scans ShieldFactory from deploy block to latest.
Public Base Sepolia RPCs cap log ranges (sepolia.base.org ~10k,
PublicNode ~50k) and fail.

Pass `allowNewVersion: true`. Add `version` when attaching a fresh clone
after a botched bind or an owner-transferred clone that can no longer
`setParams`.

Omit `publicClient` when the script already passes `rpc` if `tsc` reports
duplicate viem `PublicClient` types.

Newton `definePolicy({ env: 'prod' })` is the gateway stack, not the
chain. Chain is `chainId`.

## Allocator role

Vault owner calls `setIsAllocator(shield, true)`. If the Shield is
already allocator, the tx reverts `AlreadySet` (`0xa741a045`). Read
`isAllocator` first and skip.

Do not grant Newton on `deposit` / `withdraw`.

## Markets

Reallocate needs two enabled USDC Morpho Blue markets on the dummy vault
(idle + a second dummy). If the brief says reuse an existing dummy vault,
read allocations from chain; do not invent `marketParams`. If markets are
missing, stop and confirm before `createMarket` / `setSupplyQueue` /
enable.

A typical allow allocation for this demo: `1e6` (1 USDC, 6 decimals) to
idle and `maxUint256` to the dummy market (or the reverse). Confirm
amounts with the user. Do not drain more than the brief asked.

`MARKETS_PATH` JSON for `run-morpho-e2e.ts`:

```json
{
  "idle": { "loanToken": "0x…", "collateralToken": "0x…", "oracle": "0x…", "irm": "0x…", "lltv": "0" },
  "dummy": { "loanToken": "0x…", "collateralToken": "0x…", "oracle": "0x…", "irm": "0x…", "lltv": "0" },
  "idleAssets": "1000000"
}
```

Fill from chain / the brief. Do not invent market tokens.

## Vaults.fyi override

```ts
prepareQueryOptions: {
  vaultsfyi: {
    network: 'mainnet', // listed network slug, not "ethereum"
    vaultAddress: listedMainnetVault, // getAddress(); not the dummy
    previousAllocationHash: undefined, // allow; "deadbeef" to deny
  },
}
```

Pack wasm_args for CLI simulate use `lastKnownAllocationHash` for the
same idea. Do not query the Base Sepolia dummy vault on Vaults.fyi.

## `functionSignature`

VaultKit stamps:

```text
reallocate(((address,address,address,address,uint256),uint256)[])
```

CLI simulate fails to decode a named nested ABI
(`function reallocate(Allocation[] ...)`). Use the unnamed string or the
ASCII hex in [templates/policy/intent.vaultkit.json](../templates/policy/intent.vaultkit.json).

## Pack modules

`.with(vaultsfyi)` in the same order as `handoff.packs[]`. Extra packs
only when the brief names them.

## pnpm scripts

`pnpm` may ignore dependency build scripts (`esbuild`). `tsx` can still
run. If install looks ignored, keep going until typecheck / runtime fail.
