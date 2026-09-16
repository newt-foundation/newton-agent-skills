import type { Address } from "viem";
import raw from "../demo-config.json";

export type MarketParamsConfig = {
  loanToken: Address;
  collateralToken: Address;
  oracle: Address;
  irm: Address;
  lltv: string;
};

export type VaultDemoConfig = {
  schemaVersion: number;
  kind: "newton-vault-demo-config";
  chainId: number;
  vault: Address | null;
  asset: Address | null;
  assetSymbol: string;
  assetDecimals: number;
  shareSymbol: string;
  shield: Address | null;
  policy: Address | null;
  shieldVersion: number;
  idleMarket: MarketParamsConfig | null;
  dummyMarket: MarketParamsConfig | null;
  listedVaultsfyi: {
    network: string;
    vaultAddress: Address | null;
  };
  intent: {
    value: string;
    functionSignature: string;
  };
};

export const demoConfig = raw as VaultDemoConfig;

export function isAddress(value: string | null | undefined): value is Address {
  return typeof value === "string" && /^0x[0-9a-fA-F]{40}$/.test(value);
}
