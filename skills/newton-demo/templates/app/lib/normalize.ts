import { bytesToHex, type Hex } from "viem";

const UINT_KEYS = new Set([
  "value",
  "chainId",
  "chain_id",
  "taskCreatedBlock",
  "task_created_block",
  "quorumThresholdPercentage",
  "quorum_threshold_percentage",
  "expireBlock",
  "expire_block",
  "expireAfter",
  "expire_after",
  "initializationTimestamp",
  "initialization_timestamp",
]);

const BYTES_KEYS = new Set([
  "data",
  "functionSignature",
  "function_signature",
  "intentSignature",
  "intent_signature",
  "wasmArgs",
  "wasm_args",
  "quorumNumbers",
  "quorum_numbers",
  "policy",
  "evaluationResult",
  "evaluation_result",
  "policyParams",
  "policy_params",
  "signatureData",
  "signature_data",
  "blsSignature",
  "taskId",
  "task_id",
  "policyId",
  "policy_id",
  "salt",
]);

function snakeToCamel(key: string): string {
  return key.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());
}

function isByteArray(value: unknown): value is number[] {
  return Array.isArray(value) && value.every((item) => typeof item === "number");
}

function toHexBytes(value: unknown): Hex {
  if (typeof value === "string") {
    if (value === "") {
      return "0x";
    }
    return (value.startsWith("0x") ? value : `0x${value}`) as Hex;
  }
  if (value instanceof Uint8Array) {
    return bytesToHex(value);
  }
  if (isByteArray(value)) {
    return bytesToHex(Uint8Array.from(value));
  }
  if (typeof value === "number" || typeof value === "bigint") {
    return `0x${BigInt(value).toString(16)}` as Hex;
  }
  return "0x";
}

function toUintHex(value: unknown): Hex {
  const n =
    typeof value === "bigint"
      ? value
      : typeof value === "number"
        ? BigInt(value)
        : BigInt(String(value));
  return `0x${n.toString(16)}` as Hex;
}

export function normalizeGatewayValue(value: unknown, key?: string): unknown {
  if (value == null) {
    return value;
  }
  // JSON cannot carry BigInt. Emit hex quantities so NextResponse.json and
  // the browser fetch stay valid; viem accepts hex for uint fields.
  if (typeof value === "bigint") {
    if (key && BYTES_KEYS.has(key)) {
      return toHexBytes(value);
    }
    return toUintHex(value);
  }
  if (key && BYTES_KEYS.has(key)) {
    return toHexBytes(value);
  }
  if (key && UINT_KEYS.has(key)) {
    try {
      return toUintHex(value);
    } catch {
      return value;
    }
  }
  if (isByteArray(value)) {
    return toHexBytes(value);
  }
  if (Array.isArray(value)) {
    return value.map((item) => normalizeGatewayValue(item));
  }
  if (typeof value === "object") {
    const output: Record<string, unknown> = {};
    for (const [rawKey, nested] of Object.entries(value as Record<string, unknown>)) {
      const camel = snakeToCamel(rawKey);
      output[camel] = normalizeGatewayValue(nested, rawKey);
    }
    return output;
  }
  return value;
}

export function isAllow(evaluationResult: unknown): boolean {
  if (evaluationResult === true) {
    return true;
  }
  if (evaluationResult === false || evaluationResult == null) {
    return false;
  }
  try {
    const hex = toHexBytes(evaluationResult);
    return BigInt(hex === "0x" ? "0x0" : hex) !== 0n;
  } catch {
    return false;
  }
}
