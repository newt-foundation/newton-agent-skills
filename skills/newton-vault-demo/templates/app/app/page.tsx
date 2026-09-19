import { demoConfig } from "@/lib/config";

export default function Page() {
  return (
    <>
      <h1>Newton-gated Morpho vault</h1>
      <p>
        Depositors are shareholders. Reallocations go through a Newton Shield.
        The allocator identity is screened: one allocator passes, one is blocked.
      </p>
      <section>
        <p className="muted">
          Chain {demoConfig.chainId}. Vault {demoConfig.vault ?? "(not set)"}. Shield{" "}
          {demoConfig.shield ?? "(not set)"}.
        </p>
        <p>
          <a href="/shareholder">Shareholder: deposit {demoConfig.assetSymbol}</a>
        </p>
        <p>
          <a href="/curator">Curator: two allocators</a>
        </p>
      </section>
    </>
  );
}
