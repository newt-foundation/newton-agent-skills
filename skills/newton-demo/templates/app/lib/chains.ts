import { defineChain, type Chain } from "viem";
import { base, baseSepolia, mainnet, sepolia } from "viem/chains";

/** Public Ethereum Sepolia RPC. Not a secret. Override with RPC_URL / NEXT_PUBLIC_RPC_URL. */
export const PUBLIC_SEPOLIA_RPC = "https://ethereum-sepolia-rpc.publicnode.com";

const sepoliaPublic: Chain = {
  ...sepolia,
  rpcUrls: {
    ...sepolia.rpcUrls,
    default: { http: [PUBLIC_SEPOLIA_RPC] },
  },
};

const known: Record<number, Chain> = {
  1: mainnet,
  8453: base,
  84532: baseSepolia,
  11155111: sepoliaPublic,
};

export function chainFromId(chainId: number): Chain {
  const chain = known[chainId];
  if (chain) {
    return chain;
  }
  return defineChain({
    id: chainId,
    name: `chain-${chainId}`,
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: {
      default: { http: [rpcUrl(chainId)] },
    },
  });
}

export function rpcUrl(chainId: number): string {
  if (process.env.RPC_URL) {
    return process.env.RPC_URL;
  }
  if (process.env.NEXT_PUBLIC_RPC_URL) {
    return process.env.NEXT_PUBLIC_RPC_URL;
  }
  if (chainId === 11155111) {
    return PUBLIC_SEPOLIA_RPC;
  }
  const chain = known[chainId];
  const fallback = chain?.rpcUrls.default.http[0];
  if (!fallback) {
    throw new Error(`No RPC URL configured for chain ${chainId}`);
  }
  return fallback;
}
