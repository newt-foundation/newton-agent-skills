"use client";

import { useMemo, useState } from "react";
import { maxUint256, stringToHex, type Address, type Hex } from "viem";
import {
  useAccount,
  useConnect,
  usePublicClient,
  useSignTypedData,
  useWriteContract,
} from "wagmi";
import { buildProtectedAbi, erc20ApproveAbi } from "@/lib/abi";
import { demoConfig, isAddress } from "@/lib/config";
import { INTENT_TYPES, intentTypedMessage, resolveIntentDomain } from "@/lib/eip712";
import { encodeIntentData, functionSignatureHex, parseUserArg } from "@/lib/intent";

type Status = { kind: "idle" | "info" | "ok" | "error"; text: string };

export default function Page() {
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending: connecting } = useConnect();
  const publicClient = usePublicClient();
  const { signTypedDataAsync } = useSignTypedData();
  const { writeContractAsync, isPending: writing } = useWriteContract();

  const [target, setTarget] = useState(demoConfig.target ?? "");
  const [argValues, setArgValues] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<Status>({ kind: "idle", text: "" });

  const policyClient = demoConfig.policyClient;
  const abi = useMemo(
    () => buildProtectedAbi(demoConfig.protectedFunction.name, demoConfig.protectedFunction.userArgs),
    [],
  );

  async function onApprove() {
    if (!isAddress(policyClient) || !isAddress(target)) {
      setStatus({ kind: "error", text: "policyClient and target must be configured addresses." });
      return;
    }
    setStatus({ kind: "info", text: "Submitting token approval…" });
    const hash = await writeContractAsync({
      address: target,
      abi: erc20ApproveAbi,
      functionName: "approve",
      args: [policyClient, maxUint256],
    });
    setStatus({ kind: "ok", text: `Approval submitted: ${hash}` });
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    try {
      if (!address || !publicClient) {
        throw new Error("Connect a wallet first.");
      }
      if (!isAddress(policyClient)) {
        throw new Error("demo-config.json policyClient is not set.");
      }
      if (!isAddress(target)) {
        throw new Error("Set a concrete target address (intent.to).");
      }

      const userArgs = demoConfig.protectedFunction.userArgs.map((arg) =>
        parseUserArg(arg.type, argValues[arg.name] ?? ""),
      );
      const data = encodeIntentData(userArgs);
      const functionSignature = functionSignatureHex();
      const value = BigInt(demoConfig.intent.value);
      const chainId = BigInt(demoConfig.chainId);

      const { domain, source } = await resolveIntentDomain(
        publicClient,
        policyClient,
        demoConfig.chainId,
      );
      setStatus({ kind: "info", text: `Signing intent (${source} domain)…` });

      const intentSignature = await signTypedDataAsync({
        domain,
        types: INTENT_TYPES,
        primaryType: "Intent",
        message: intentTypedMessage({
          from: address,
          to: target as Address,
          value,
          data,
          chainId,
          functionSignature,
        }),
      });

      const wasmArgs =
        demoConfig.wasmArgs == null ? undefined : stringToHex(JSON.stringify(demoConfig.wasmArgs));

      setStatus({ kind: "info", text: "Evaluating intent on the server…" });
      const response = await fetch("/api/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          policyClient,
          intent: {
            from: address,
            to: target,
            value: `0x${value.toString(16)}`,
            data,
            chainId: demoConfig.chainId,
            functionSignature,
          },
          intentSignature,
          wasmArgs,
        }),
      });
      const payload = (await response.json()) as {
        error?: string;
        evaluationResult?: boolean;
        task?: unknown;
        taskResponse?: unknown;
        signatureData?: Hex;
      };
      if (!response.ok) {
        throw new Error(payload.error ?? `Evaluate failed (${response.status})`);
      }
      if (!payload.evaluationResult) {
        setStatus({
          kind: "error",
          text: "Policy denied this intent. No transaction was sent.",
        });
        return;
      }

      setStatus({ kind: "info", text: "Policy allowed. Submitting attested call…" });
      const hash = await writeContractAsync({
        address: policyClient,
        abi,
        functionName: demoConfig.protectedFunction.name,
        args: [...userArgs, payload.task, payload.taskResponse, payload.signatureData],
      });
      setStatus({ kind: "ok", text: `Attested transaction submitted: ${hash}` });
    } catch (error) {
      setStatus({
        kind: "error",
        text: error instanceof Error ? error.message : "Request failed",
      });
    }
  }

  return (
    <main>
      <section>
        <h1>Newton demo</h1>
        <p>
          Signs an EIP-712 intent in the browser, evaluates it on the server, and
          submits the attested PolicyClient call on allow.
        </p>
        <p>
          Chain {demoConfig.chainId}. Protected function{" "}
          <code>{demoConfig.protectedFunction.name}</code>.
        </p>
        {isConnected ? (
          <p>Connected: {address}</p>
        ) : (
          <div className="row">
            {connectors.map((connector) => (
              <button
                key={connector.uid}
                type="button"
                disabled={connecting}
                onClick={() => connect({ connector })}
              >
                Connect {connector.name}
              </button>
            ))}
          </div>
        )}
      </section>

      <form onSubmit={onSubmit}>
        {!demoConfig.target && (
          <label>
            Target (intent.to)
            <input
              value={target}
              onChange={(event) => setTarget(event.target.value)}
              placeholder="0x…"
              required
            />
          </label>
        )}
        {demoConfig.protectedFunction.userArgs.map((arg) => (
          <label key={arg.name}>
            {arg.name} ({arg.type})
            <input
              value={argValues[arg.name] ?? ""}
              onChange={(event) =>
                setArgValues((current) => ({ ...current, [arg.name]: event.target.value }))
              }
              required
            />
          </label>
        ))}
        <div className="row">
          {demoConfig.needsTokenApproval && (
            <button type="button" disabled={!isConnected || writing} onClick={onApprove}>
              Approve token
            </button>
          )}
          <button type="submit" disabled={!isConnected || writing}>
            Evaluate and submit
          </button>
        </div>
      </form>

      {status.text && (
        <p className={`status ${status.kind === "error" ? "error" : status.kind === "ok" ? "ok" : ""}`}>
          {status.text}
        </p>
      )}
    </main>
  );
}
