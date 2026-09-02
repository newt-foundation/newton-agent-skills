import type { Address, Hex, PublicClient } from "viem";
import { eip712DomainAbi } from "./abi";
import { demoConfig } from "./config";

export const INTENT_TYPES = {
  Intent: [
    { name: "from", type: "address" },
    { name: "to", type: "address" },
    { name: "value", type: "uint256" },
    { name: "data", type: "bytes" },
    { name: "chainId", type: "uint256" },
    { name: "functionSignature", type: "bytes" },
  ],
} as const;

export type IntentDomain = {
  name: string;
  version: string;
  chainId: number;
  verifyingContract: Address;
};

export async function resolveIntentDomain(
  publicClient: PublicClient,
  policyClient: Address,
  chainId: number,
): Promise<{ domain: IntentDomain; source: "eip712Domain" | "fallback" }> {
  try {
    const result = await publicClient.readContract({
      address: policyClient,
      abi: eip712DomainAbi,
      functionName: "eip712Domain",
    });
    return {
      domain: {
        name: result[1],
        version: result[2],
        chainId: Number(result[3]),
        verifyingContract: result[4],
      },
      source: "eip712Domain",
    };
  } catch {
    return {
      domain: {
        name: demoConfig.eip712.name,
        version: demoConfig.eip712.version,
        chainId,
        verifyingContract: policyClient,
      },
      source: "fallback",
    };
  }
}

export function intentTypedMessage(input: {
  from: Address;
  to: Address;
  value: bigint;
  data: Hex;
  chainId: bigint;
  functionSignature: Hex;
}) {
  return {
    from: input.from,
    to: input.to,
    value: input.value,
    data: input.data,
    chainId: input.chainId,
    functionSignature: input.functionSignature,
  };
}
