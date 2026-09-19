import { defineChain, type Chain } from "viem";
import { base, baseSepolia, mainnet, sepolia } from "viem/chains";

export const PUBLIC_SEPOLIA_RPC = "https://ethereum-sepolia-rpc.publicnode.com";
export const PUBLIC_BASE_SEPOLIA_RPC = "https://base-sepolia-rpc.publicnode.com";

const sepoliaPublic: Chain = {
  ...sepolia,
  rpcUrls: {
    ...sepolia.rpcUrls,
    default: { http: [PUBLIC_SEPOLIA_RPC] },
  },
};

const baseSepoliaPublic: Chain = {
  ...baseSepolia,
  rpcUrls: {
    ...baseSepolia.rpcUrls,
    default: { http: [PUBLIC_BASE_SEPOLIA_RPC] },
  },
};

const known: Record<number, Chain> = {
  1: mainnet,
  8453: base,
  84532: baseSepoliaPublic,
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
  const fromEnv = process.env.RPC_URL || process.env.NEXT_PUBLIC_RPC_URL;
  if (fromEnv) {
    if (chainId === 84532 && /ethereum-sepolia/i.test(fromEnv) && !/base/i.test(fromEnv)) {
      return PUBLIC_BASE_SEPOLIA_RPC;
    }
    return fromEnv;
  }
  if (chainId === 11155111) {
    return PUBLIC_SEPOLIA_RPC;
  }
  if (chainId === 84532) {
    return PUBLIC_BASE_SEPOLIA_RPC;
  }
  const chain = known[chainId];
  const fallback = chain?.rpcUrls.default.http[0];
  if (!fallback) {
    throw new Error(`No RPC URL configured for chain ${chainId}`);
  }
  return fallback;
}
