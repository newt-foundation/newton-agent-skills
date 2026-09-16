import { definePolicy, createShield } from "@newton-xyz/vaultkit";
import { morphoActions } from "@newton-xyz/vaultkit/vendors/morpho";
import { vaultsfyi } from "@newton-xyz/policy-pack-vaultsfyi";
import { MetaMorphoAction } from "@morpho-org/blue-sdk-viem";
import { NextResponse } from "next/server";
import {
  createWalletClient,
  getAddress,
  http,
  maxUint256,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { chainFromId, rpcUrl } from "@/lib/chains";
import { demoConfig, isAddress, type MarketParamsConfig } from "@/lib/config";

export const runtime = "nodejs";

function market(raw: MarketParamsConfig) {
  return {
    loanToken: getAddress(raw.loanToken),
    collateralToken: getAddress(raw.collateralToken),
    oracle: getAddress(raw.oracle),
    irm: getAddress(raw.irm),
    lltv: BigInt(raw.lltv),
  };
}

export async function POST(request: Request) {
  const apiKey = process.env.NEWTON_API_KEY?.trim();
  const privateKey = process.env.PRIVATE_KEY?.trim() as Hex | undefined;
  if (!apiKey || !privateKey) {
    return NextResponse.json(
      { error: "NEWTON_API_KEY and PRIVATE_KEY must be set on the server" },
      { status: 500 },
    );
  }
  if (!isAddress(demoConfig.vault) || !isAddress(demoConfig.policy) || !isAddress(demoConfig.shield)) {
    return NextResponse.json(
      { error: "demo-config.json vault, policy, and shield must be set" },
      { status: 400 },
    );
  }
  if (!demoConfig.idleMarket || !demoConfig.dummyMarket || !isAddress(demoConfig.listedVaultsfyi.vaultAddress)) {
    return NextResponse.json(
      { error: "demo-config.json markets and listedVaultsfyi.vaultAddress must be set" },
      { status: 400 },
    );
  }

  const body = (await request.json()) as { mode?: string };
  const mode = body.mode === "deny" ? "deny" : body.mode === "allow" ? "allow" : null;
  if (!mode) {
    return NextResponse.json({ error: "mode must be allow or deny" }, { status: 400 });
  }

  const chain = chainFromId(demoConfig.chainId);
  const rpc = rpcUrl(demoConfig.chainId);
  const account = privateKeyToAccount(privateKey);
  const walletClient = createWalletClient({
    account,
    chain,
    transport: http(rpc),
  });

  const vault = getAddress(demoConfig.vault);
  const allocations = [
    { marketParams: market(demoConfig.idleMarket), assets: 1_000_000n },
    { marketParams: market(demoConfig.dummyMarket), assets: maxUint256 },
  ];
  const listedQuery = {
    network: demoConfig.listedVaultsfyi.network,
    vaultAddress: getAddress(demoConfig.listedVaultsfyi.vaultAddress),
  };

  try {
    const shield = (
      await createShield({
        apiKey,
        walletClient,
        rpc,
        vault,
        policy: definePolicy({
          chainId: String(demoConfig.chainId),
          env: "prod",
        }).with(vaultsfyi),
        policyAddress: getAddress(demoConfig.policy),
        version: BigInt(demoConfig.shieldVersion ?? 0),
        allowNewVersion: true,
      })
    ).extend(morphoActions);

    if (shield.policyClientAddress.toLowerCase() !== demoConfig.shield.toLowerCase()) {
      return NextResponse.json(
        {
          error: `createShield attached ${shield.policyClientAddress}, expected ${demoConfig.shield}. Do not bump shieldVersion from the UI.`,
        },
        { status: 500 },
      );
    }

    if (mode === "allow") {
      const allow = await shield.morpho.reallocate(vault, allocations, {
        prepareQueryOptions: { vaultsfyi: listedQuery },
      });
      return NextResponse.json({
        mode,
        blocked: false,
        transactionHash: allow.transactionHash,
        taskId: allow.taskId ?? null,
      });
    }

    const deny = await shield.assertIntentBlocked({
      to: vault,
      data: MetaMorphoAction.reallocate(allocations),
      functionSignature: demoConfig.intent.functionSignature,
      prepareQueryOptions: {
        vaultsfyi: { ...listedQuery, previousAllocationHash: "deadbeef" },
      },
    });
    return NextResponse.json({
      mode,
      blocked: deny.blocked ?? true,
      taskId: deny.taskId ?? null,
      reason: deny.reason ?? null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "reallocate failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
