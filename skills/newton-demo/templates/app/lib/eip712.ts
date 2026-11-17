import type { Address, Hex } from "viem";

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

/**
 * The gateway verifies every intent signature under this fixed domain:
 * name "NewtonPolicyClient", version "1", the intent's chain, and the
 * PolicyClient address. It ignores the client's own `eip712Domain()`.
 */
export const INTENT_DOMAIN_NAME = "NewtonPolicyClient";
export const INTENT_DOMAIN_VERSION = "1";

export type IntentDomain = {
  name: string;
  version: string;
  chainId: number;
  verifyingContract: Address;
};

export function intentDomain(policyClient: Address, chainId: number): IntentDomain {
  return {
    name: INTENT_DOMAIN_NAME,
    version: INTENT_DOMAIN_VERSION,
    chainId,
    verifyingContract: policyClient,
  };
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
