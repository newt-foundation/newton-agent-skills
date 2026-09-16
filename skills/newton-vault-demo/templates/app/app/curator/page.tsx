"use client";

import { useState } from "react";
import { useAccount, useConnect } from "wagmi";
import { demoConfig } from "@/lib/config";

type Status = { kind: "idle" | "info" | "ok" | "error"; text: string };

export default function CuratorPage() {
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending: connecting } = useConnect();
  const [status, setStatus] = useState<Status>({ kind: "idle", text: "" });

  async function run(mode: "allow" | "deny") {
    setStatus({ kind: "info", text: `Evaluating ${mode} reallocate on the server…` });
    try {
      const response = await fetch("/api/reallocate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode }),
      });
      const body = (await response.json()) as { error?: string } & Record<string, unknown>;
      if (!response.ok) {
        throw new Error(body.error ?? `HTTP ${response.status}`);
      }
      setStatus({ kind: "ok", text: JSON.stringify(body, null, 2) });
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
        Reallocate through the Newton Shield. Allow omits previousAllocationHash.
        Deny sends previousAllocationHash=deadbeef (assertIntentBlocked, no mined
        deny tx). The Newton API key stays on the server.
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
          <p className="muted">Connected {address} (display). Server signer is PRIVATE_KEY.</p>
        )}
        <p className="muted">
          Shield {demoConfig.shield ?? "(not set)"}. Policy {demoConfig.policy ?? "(not set)"}.
        </p>
        <div className="row">
          <button type="button" onClick={() => run("allow")}>
            Evaluate allow
          </button>
          <button type="button" onClick={() => run("deny")}>
            Evaluate deny
          </button>
        </div>
        {status.text ? <p className={`status ${status.kind}`}>{status.text}</p> : null}
      </section>
    </>
  );
}
