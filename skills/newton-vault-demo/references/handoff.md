# Vault demo config

Write `demos/<slug>/demo-config.json` from handoffs. Do not invent
addresses. `null` means not deployed yet.

```json
{
  "schemaVersion": 1,
  "kind": "newton-vault-demo-config",
  "chainId": 84532,
  "vault": null,
  "asset": null,
  "assetSymbol": "USDC",
  "assetDecimals": 6,
  "shareSymbol": "ndUSDC",
  "shield": null,
  "policy": null,
  "shieldVersion": 0,
  "idleMarket": null,
  "dummyMarket": null,
  "listedVaultsfyi": {
    "network": "mainnet",
    "vaultAddress": null
  },
  "intent": {
    "value": "0",
    "functionSignature": "reallocate(((address,address,address,address,uint256),uint256)[])"
  }
}
```

Market objects, when known from chain (not invented), are Morpho
`MarketParams`:

```json
{
  "loanToken": "0x…",
  "collateralToken": "0x…",
  "oracle": "0x…",
  "irm": "0x…",
  "lltv": "0"
}
```

`kind` must stay `newton-vault-demo-config` so agents do not feed this
file to `newton-demo`.
