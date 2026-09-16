"use client";

import { useState } from "react";
import { parseUnits } from "viem";
import { useAccount, useConnect, usePublicClient, useWriteContract } from "wagmi";
import { erc20Abi, erc4626Abi } from "@/lib/abi";
import { demoConfig, isAddress } from "@/lib/config";

type Status = { kind: "idle" | "info" | "ok" | "error"; text: string };

export default function ShareholderPage() {
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending: connecting } = useConnect();
  const publicClient = usePublicClient();
  const { writeContractAsync, isPending: writing } = useWriteContract();
  const [amount, setAmount] = useState("10");
  const [shares, setShares] = useState<string>("");
  const [status, setStatus] = useState<Status>({ kind: "idle", text: "" });

  const vault = demoConfig.vault;
  const asset = demoConfig.asset;

  async function refreshShares() {
    if (!address || !publicClient || !isAddress(vault)) {
      return;
    }
    const balance = await publicClient.readContract({
      address: vault,
      abi: erc4626Abi,
      functionName: "balanceOf",
      args: [address],
    });
    setShares(balance.toString());
  }

  async function onApprove() {
    if (!isAddress(vault) || !isAddress(asset)) {
      setStatus({ kind: "error", text: "demo-config.json vault and asset must be set." });
      return;
    }
    setStatus({ kind: "info", text: "Approving the vault to spend the asset…" });
    const hash = await writeContractAsync({
      address: asset,
      abi: erc20Abi,
      functionName: "approve",
      args: [vault, parseUnits(amount || "0", demoConfig.assetDecimals)],
    });
    setStatus({ kind: "ok", text: `Approval submitted: ${hash}` });
  }

  async function onDeposit(event: React.FormEvent) {
    event.preventDefault();
    try {
      if (!address) {
        throw new Error("Connect a wallet first.");
      }
      if (!isAddress(vault)) {
        throw new Error("demo-config.json vault is not set.");
      }
      setStatus({ kind: "info", text: "Depositing (ERC-4626, not Newton-gated)…" });
      const hash = await writeContractAsync({
        address: vault,
        abi: erc4626Abi,
        functionName: "deposit",
        args: [parseUnits(amount || "0", demoConfig.assetDecimals), address],
      });
      setStatus({ kind: "ok", text: `Deposit submitted: ${hash}` });
      await refreshShares();
    } catch (error) {
      setStatus({
        kind: "error",
        text: error instanceof Error ? error.message : "deposit failed",
      });
    }
  }

  return (
    <>
      <h1>Shareholder</h1>
      <p className="muted">
        Approve {demoConfig.assetSymbol} and deposit into the vault. You receive{" "}
        {demoConfig.shareSymbol}. This view does not evaluate a Newton policy.
      </p>
      <section>
        {!isConnected ? (
          <button
            type="button"
            disabled={connecting}
            onClick={() => connect({ connector: connectors[0] })}
          >
            Connect
          </button>
        ) : (
          <p className="muted">Connected {address}</p>
        )}
        <form onSubmit={onDeposit}>
          <label>
            Amount ({demoConfig.assetSymbol})
            <input value={amount} onChange={(event) => setAmount(event.target.value)} />
          </label>
          <div className="row">
            <button type="button" onClick={onApprove} disabled={writing || !isConnected}>
              Approve
            </button>
            <button type="submit" disabled={writing || !isConnected}>
              Deposit
            </button>
            <button type="button" onClick={refreshShares} disabled={!isConnected}>
              Refresh shares
            </button>
          </div>
        </form>
        {shares ? <p className="muted">Share balance: {shares}</p> : null}
        {status.text ? <p className={`status ${status.kind}`}>{status.text}</p> : null}
      </section>
    </>
  );
}
