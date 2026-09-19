import {
  createPublicClient,
  encodeAbiParameters,
  formatUnits,
  getAddress,
  http,
  keccak256,
  parseAbi,
  type Address,
  type Hex,
} from "viem";
import { chainFromId, rpcUrl } from "./chains";
import {
  demoConfig,
  isAddress,
  type MarketParamsConfig,
} from "./config";

const morphoAbi = parseAbi([
  "function position(bytes32 id, address user) view returns (uint256 supplyShares, uint128 borrowShares, uint128 collateral)",
  "function market(bytes32 id) view returns (uint128 totalSupplyAssets, uint128 totalSupplyShares, uint128 totalBorrowAssets, uint128 totalBorrowShares, uint128 lastUpdate, uint128 fee)",
]);

export type MarketBalances = {
  idle: bigint;
  dummy: bigint;
};

export function marketId(params: MarketParamsConfig): Hex {
  return keccak256(
    encodeAbiParameters(
      [
        { type: "address" },
        { type: "address" },
        { type: "address" },
        { type: "address" },
        { type: "uint256" },
      ],
      [
        getAddress(params.loanToken),
        getAddress(params.collateralToken),
        getAddress(params.oracle),
        getAddress(params.irm),
        BigInt(params.lltv),
      ],
    ),
  );
}

function toAssets(shares: bigint, totalAssets: bigint, totalShares: bigint): bigint {
  if (shares === 0n || totalShares === 0n) {
    return 0n;
  }
  return (shares * totalAssets) / totalShares;
}

async function suppliedAssets(
  client: ReturnType<typeof createPublicClient>,
  morpho: Address,
  vault: Address,
  params: MarketParamsConfig,
): Promise<bigint> {
  const id = marketId(params);
  const [position, market] = await Promise.all([
    client.readContract({
      address: morpho,
      abi: morphoAbi,
      functionName: "position",
      args: [id, vault],
    }),
    client.readContract({
      address: morpho,
      abi: morphoAbi,
      functionName: "market",
      args: [id],
    }),
  ]);
  return toAssets(position[0], market[0], market[1]);
}

export async function readMarketBalances(): Promise<MarketBalances> {
  const vault = demoConfig.vault;
  const morpho = demoConfig.morphoBlue;
  if (
    !isAddress(vault) ||
    !isAddress(morpho) ||
    !demoConfig.idleMarket ||
    !demoConfig.dummyMarket
  ) {
    throw new Error("demo-config.json vault, morphoBlue, and markets must be set");
  }
  const client = createPublicClient({
    chain: chainFromId(demoConfig.chainId),
    transport: http(rpcUrl(demoConfig.chainId)),
  });
  const [idle, dummy] = await Promise.all([
    suppliedAssets(client, morpho, vault, demoConfig.idleMarket),
    suppliedAssets(client, morpho, vault, demoConfig.dummyMarket),
  ]);
  return { idle, dummy };
}

export function formatAsset(amount: bigint): string {
  return `${formatUnits(amount, demoConfig.assetDecimals)} ${demoConfig.assetSymbol}`;
}
