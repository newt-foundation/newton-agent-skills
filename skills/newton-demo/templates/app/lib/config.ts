import type { Address, Hex } from "viem";
import raw from "../demo-config.json";

export type UserArg = {
  name: string;
  type: string;
};

export type DemoConfig = {
  schemaVersion: number;
  kind: "newton-demo-config";
  chainId: number;
  policyClient: Address | null;
  target: Address | null;
  needsTokenApproval: boolean;
  protectedFunction: {
    name: string;
    userArgs: UserArg[];
  };
  intent: {
    value: string;
    functionSignature: string;
    dataEncoding: string;
  };
  eip712: {
    name: string;
    version: string;
  };
  wasmArgs: Record<string, unknown> | null;
};

export const demoConfig = raw as DemoConfig;

export function isAddress(value: string | null | undefined): value is Address {
  return typeof value === "string" && /^0x[0-9a-fA-F]{40}$/.test(value);
}

export function asHex(value: string): Hex {
  return (value.startsWith("0x") ? value : `0x${value}`) as Hex;
}
