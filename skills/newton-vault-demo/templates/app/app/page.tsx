import { demoConfig } from "@/lib/config";

export default function Page() {
  return (
    <>
      <h1>Newton-gated Morpho vault</h1>
      <p>
        Depositors are shareholders. The curator cannot reallocate without a Newton
        Shield attestation.
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
          <a href="/curator">Curator: Shield-gated reallocate</a>
        </p>
      </section>
    </>
  );
}
