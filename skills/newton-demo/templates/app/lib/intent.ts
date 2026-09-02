import {
  encodeFunctionData,
  stringToHex,
  type Address,
  type Hex,
} from "viem";
import { demoConfig } from "./config";

export type Intent = {
  from: Address;
  to: Address;
  value: Hex | string | bigint;
  data: Hex;
  chainId: number | bigint;
  functionSignature: Hex;
};

export function parseDataEncoding(dataEncoding: string): {
  name: string;
  types: string[];
} {
  const match = /^(\w+)\((.*)\)$/.exec(dataEncoding.trim());
  if (!match) {
    throw new Error(`Invalid intent.dataEncoding: ${dataEncoding}`);
  }
  const name = match[1];
  const inner = match[2].trim();
  const types = inner === "" ? [] : inner.split(",").map((part) => part.trim());
  return { name, types };
}

export function encodeIntentData(values: unknown[]): Hex {
  const { name, types } = parseDataEncoding(demoConfig.intent.dataEncoding);
  if (values.length !== types.length) {
    throw new Error(
      `intent.data expected ${types.length} argument(s) for ${demoConfig.intent.dataEncoding}, got ${values.length}`,
    );
  }
  return encodeFunctionData({
    abi: [
      {
        type: "function",
        name,
        stateMutability: "nonpayable",
        inputs: types.map((type, index) => ({ name: `arg${index}`, type })),
        outputs: [],
      },
    ],
    functionName: name,
    args: values,
  });
}

export function functionSignatureHex(): Hex {
  return stringToHex(demoConfig.intent.functionSignature);
}

export function parseUserArg(type: string, raw: string): unknown {
  const value = raw.trim();
  if (value === "") {
    throw new Error(`Missing value for ${type}`);
  }
  if (type === "address") {
    if (!/^0x[0-9a-fA-F]{40}$/.test(value)) {
      throw new Error(`Invalid address: ${value}`);
    }
    return value as Address;
  }
  if (type === "bool") {
    if (value === "true" || value === "1") {
      return true;
    }
    if (value === "false" || value === "0") {
      return false;
    }
    throw new Error(`Invalid bool: ${value}`);
  }
  if (type.startsWith("uint") || type.startsWith("int")) {
    return BigInt(value);
  }
  if (type === "bytes" || type.startsWith("bytes")) {
    return (value.startsWith("0x") ? value : `0x${value}`) as Hex;
  }
  if (type === "string") {
    return value;
  }
  return value;
}
