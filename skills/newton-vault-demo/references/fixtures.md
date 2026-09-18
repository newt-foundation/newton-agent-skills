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
| chainalysis PolicyData | `0xdC2e9d30B8e415F907e39f0bfe22974B9894740F` |

Checksum with `getAddress()` before VaultKit. An earlier mixed-case
spelling of the dummy vault was rejected.

Listed Vaults.fyi override used in that dogfood (re-check listing):
Steakhouse USDC on `mainnet`
`0xBEEF01735c132Ada46AA9aA4c54623cAA92A64CB`.

Working two-allocator bind from this dogfood (reuse only with this vault):

- Policy `0x155893eD3f381D37496640C164715e27a1518181`
- Shield v6 `0x45D37d1D18EDb221C808E38e120665EcD9023e3E`
- Clean allocator `0xd232c8d0Dc8069eBA108954A5f2307752547Df1a`
- Sanctioned allocator (OFAC SDN / SECONDEYE SOLUTION) `0x1da5821544e25c636c1417Ba96Ade4Cf6D2f9B5A`
- Shield owner (gateway API-key identity) `0x216931A25973ED4EC13cD12cc810319ba6D6E05A`

Do **not** reuse these Policies / Shields — they were bound to the wrong
params schema, or their Shield owner is a different dashboard wallet:

- Policy `0x11007A4F2948ddD045dE06e5Fe81ba7a846e70e2` +
  Shield v5 `0xC703f65d7D43FFc488592Cc51192a129D02f448E`
  (owner `0xF216…`; API key for `0x2169…` cannot `newt_createTask`)

- Policy nested schema `0xBc03789c4060099e1bf038257c228a3bc9dfeF1D` +
  Shield v0 `0x35b62B3af903ea15c4051C8d36569D86aB2D3a36`
- Policy flat schema `0xb2b9b07F3355BA0CF98eb8dB60df96dC25a8058a` +
  Shield v1 `0x344df20c0A02069B3f9e5A9Cea193332bF4C84dc`
  (allocator + secrets; evaluate schema-fail; owner already transferred)
- vaultsfyi-only envelope Policy `0xd4925D6d02e5b0C04152225c0252f556B7143b6A` +
  Shield v4 `0x6106afCAfa83fA780763d7cE0Bc58afD39691728`
  (owner already transferred; hash-fixture UI, not two allocators)

Filled Next.js app:
[`dummy-morpho-vault-demo`](https://github.com/newt-foundation/dummy-morpho-vault-demo).

Local gitignored dirs: `policies/morpho_two_allocators/`,
`policies/morpho_vaultsfyi_reallocate/`, `shields/morpho-ndusdc/`.
