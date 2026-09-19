"use client";

import { useCallback, useEffect, useState } from "react";
import { demoConfig } from "@/lib/config";
import { formatAsset, readMarketBalances, type MarketBalances } from "@/lib/allocations";

type Allocator = "clean" | "sanctioned";
type Destination = "dummy" | "idle";
type ReallocateResult = {
  allocator?: string;
  destination?: string;
  blocked?: boolean;
  taskId?: string | null;
  transactionHash?: string | null;
  reason?: unknown;
  error?: string;
};
type Status =
  | { kind: "idle" | "info" | "error"; text: string; result?: undefined }
  | { kind: "ok" | "blocked"; text?: string; result: ReallocateResult };

function explorerTaskUrl(taskId: string, chainId: number): string {
  const network = chainId === 1 || chainId === 8453 ? "mainnet" : "testnet";
  return `https://explorer.newton.xyz/${network}/task/${taskId}`;
}

function StatusPanel({ status }: { status: Status }) {
  if (status.kind === "idle" || (!status.text && !status.result)) {
    return null;
  }
  if (!status.result) {
    return <p className={`status ${status.kind}`}>{status.text}</p>;
  }
  const taskId = typeof status.result.taskId === "string" ? status.result.taskId : null;
  const json = JSON.stringify(status.result, null, 2);
  const quoted = taskId ? JSON.stringify(taskId) : null;
  const [before, ...rest] = quoted && json.includes(quoted) ? json.split(quoted) : [json];
  return (
    <div className={`status ${status.kind}`}>
      <pre>
        {before}
        {taskId && quoted ? (
          <a href={explorerTaskUrl(taskId, demoConfig.chainId)} target="_blank" rel="noreferrer">
            {quoted}
          </a>
        ) : null}
        {quoted ? rest.join(quoted) : null}
      </pre>
      {taskId ? (
        <a href={explorerTaskUrl(taskId, demoConfig.chainId)} target="_blank" rel="noreferrer">
          View task on Newton Explorer
        </a>
      ) : null}
    </div>
  );
}

export default function CuratorPage() {
  const [status, setStatus] = useState<Status>({ kind: "idle", text: "" });
  const [allocator, setAllocator] = useState<Allocator>("clean");
  const [balances, setBalances] = useState<MarketBalances | null>(null);
  const [balancesError, setBalancesError] = useState<string>("");
  const [loadingBalances, setLoadingBalances] = useState(false);
  const twoAllocators = Boolean(demoConfig.allocators?.sanctioned);

  const refreshBalances = useCallback(async () => {
    setLoadingBalances(true);
    setBalancesError("");
    try {
      setBalances(await readMarketBalances());
    } catch (error) {
      setBalances(null);
      setBalancesError(error instanceof Error ? error.message : "could not read balances");
    } finally {
      setLoadingBalances(false);
    }
  }, []);

  useEffect(() => {
    void refreshBalances();
  }, [refreshBalances]);

  async function run(destination: Destination) {
    const allocatorLabel = allocator === "clean" ? "clean allocator" : "sanctioned allocator";
    const destLabel = destination === "dummy" ? "dummy market" : "idle";
    setStatus({
      kind: "info",
      text: `Moving funds to ${destLabel} as ${allocatorLabel}…`,
    });
    try {
      const response = await fetch("/api/reallocate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ allocator, destination }),
      });
      const body = (await response.json()) as ReallocateResult;
      if (!response.ok) {
        throw new Error(body.error ?? `HTTP ${response.status}`);
      }
      setStatus({
        kind: body.blocked ? "blocked" : "ok",
        result: body,
      });
      await refreshBalances();
    } catch (error) {
      setStatus({
        kind: "error",
        text: error instanceof Error ? error.message : "reallocate failed",
      });
    }
  }

  return (
    <>
      <h1>Curator</h1>
      <p className="muted">
        {twoAllocators
          ? "Pick an allocator, then move funds between the dummy market and idle. The clean allocator is attested. The sanctioned allocator is blocked (no mined deny tx). The Newton API key stays on the server."
          : "Reallocate through the Newton Shield between the dummy market and idle. The Newton API key stays on the server."}
      </p>
      <section>
        <p className="muted">
          Shield {demoConfig.shield ?? "(not set)"}. Policy {demoConfig.policy ?? "(not set)"}.
          Server signer is PRIVATE_KEY.
        </p>
        <div className="balances">
          <div>
            <span className="muted">Idle</span>
            <strong>{balances ? formatAsset(balances.idle) : loadingBalances ? "…" : "—"}</strong>
          </div>
          <div>
            <span className="muted">Dummy market</span>
            <strong>{balances ? formatAsset(balances.dummy) : loadingBalances ? "…" : "—"}</strong>
          </div>
        </div>
        <button type="button" onClick={() => void refreshBalances()} disabled={loadingBalances}>
          Refresh balances
        </button>
        {balancesError ? <p className="status error">{balancesError}</p> : null}
        {twoAllocators ? (
          <label>
            Allocator
            <select
              value={allocator}
              onChange={(event) => setAllocator(event.target.value as Allocator)}
            >
              <option value="clean">Clean allocator</option>
              <option value="sanctioned">Sanctioned allocator</option>
            </select>
          </label>
        ) : null}
        <div className="row">
          <button type="button" onClick={() => run("dummy")}>
            Move funds to dummy market
          </button>
          <button type="button" onClick={() => run("idle")}>
            Move funds back to idle
          </button>
        </div>
        <StatusPanel status={status} />
      </section>
    </>
  );
}
