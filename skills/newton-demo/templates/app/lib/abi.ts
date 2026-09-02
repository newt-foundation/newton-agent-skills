import type { Abi } from "viem";
import type { UserArg } from "./config";

const intentComponents = [
  { name: "from", type: "address" },
  { name: "to", type: "address" },
  { name: "value", type: "uint256" },
  { name: "data", type: "bytes" },
  { name: "chainId", type: "uint256" },
  { name: "functionSignature", type: "bytes" },
];

const policyDataComponents = [
  { name: "wasmArgs", type: "bytes" },
  { name: "data", type: "bytes" },
  { name: "policyDataAddress", type: "address" },
  { name: "expireBlock", type: "uint32" },
];

const policyTaskDataComponents = [
  { name: "policyId", type: "bytes32" },
  { name: "policyAddress", type: "address" },
  { name: "policy", type: "bytes" },
  { name: "policyData", type: "tuple[]", components: policyDataComponents },
];

const policyConfigComponents = [
  { name: "policyParams", type: "bytes" },
  { name: "expireAfter", type: "uint32" },
];

const taskComponents = [
  { name: "taskId", type: "bytes32" },
  { name: "policyClient", type: "address" },
  { name: "taskCreatedBlock", type: "uint32" },
  { name: "quorumThresholdPercentage", type: "uint32" },
  { name: "intent", type: "tuple", components: intentComponents },
  { name: "intentSignature", type: "bytes" },
  { name: "wasmArgs", type: "bytes" },
  { name: "quorumNumbers", type: "bytes" },
  { name: "initializationTimestamp", type: "uint256" },
];

const taskResponseComponents = [
  { name: "taskId", type: "bytes32" },
  { name: "policyClient", type: "address" },
  { name: "policyId", type: "bytes32" },
  { name: "policyAddress", type: "address" },
  { name: "intent", type: "tuple", components: intentComponents },
  { name: "intentSignature", type: "bytes" },
  { name: "evaluationResult", type: "bytes" },
  { name: "policyTaskData", type: "tuple", components: policyTaskDataComponents },
  { name: "policyConfig", type: "tuple", components: policyConfigComponents },
  { name: "initializationTimestamp", type: "uint256" },
];

export function buildProtectedAbi(functionName: string, userArgs: UserArg[]): Abi {
  return [
    {
      type: "function",
      name: functionName,
      stateMutability: "nonpayable",
      inputs: [
        ...userArgs.map((arg) => ({ name: arg.name, type: arg.type })),
        { name: "task", type: "tuple", components: taskComponents },
        { name: "taskResponse", type: "tuple", components: taskResponseComponents },
        { name: "signatureData", type: "bytes" },
      ],
      outputs: [],
    },
  ];
}

export const erc20ApproveAbi = [
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

export const eip712DomainAbi = [
  {
    type: "function",
    name: "eip712Domain",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "fields", type: "bytes1" },
      { name: "name", type: "string" },
      { name: "version", type: "string" },
      { name: "chainId", type: "uint256" },
      { name: "verifyingContract", type: "address" },
      { name: "salt", type: "bytes32" },
      { name: "extensions", type: "uint256[]" },
    ],
  },
] as const;
