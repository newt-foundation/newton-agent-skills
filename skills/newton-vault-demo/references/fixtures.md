# Optional Base Sepolia leftovers

Reuse **only** when the brief says to reuse an existing dummy Morpho
vault from earlier dogfood in this repo. Do not treat these as defaults
for a new customer. Re-read them from chain before sending txs; they may
be stale.

Network: Base Sepolia (`84532`). Newton gateway `env`: `prod`.

| Thing | Address |
|---|---|
| Dummy MetaMorpho (ndUSDC) | `0xC21e09A657Cf71F541997A82174299a1Af39782E` |
| Circle USDC | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` |
| Morpho Blue | `0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb` |
| vaultsfyi PolicyData | `0x443487D506eEc522e5fb5075eBDbD7496DB454dF` |

Checksum with `getAddress()` before VaultKit. An earlier mixed-case
spelling of the dummy vault was rejected.

Listed Vaults.fyi override used in that dogfood (re-check listing):
Steakhouse USDC on `mainnet`
`0xBEEF01735c132Ada46AA9aA4c54623cAA92A64CB`.

Do **not** reuse these Policies / Shields — they were bound to the wrong
params schema:

- Policy nested schema `0xBc03789c4060099e1bf038257c228a3bc9dfeF1D` +
  Shield v0 `0x35b62B3af903ea15c4051C8d36569D86aB2D3a36`
- Policy flat schema `0xb2b9b07F3355BA0CF98eb8dB60df96dC25a8058a` +
  Shield v1 `0x344df20c0A02069B3f9e5A9Cea193332bF4C84dc`
  (allocator + secrets; evaluate schema-fail; owner already transferred)

A working envelope Policy plus a new Shield version still have to be
deployed. Local gitignored dirs from that run:
`policies/morpho_vaultsfyi_reallocate/`, `shields/morpho-ndusdc/`.
