import { definePolicy, createShield } from "@newton-xyz/vaultkit";
import { morphoActions } from "@newton-xyz/vaultkit/vendors/morpho";
import { chainalysis } from "@newton-xyz/policy-pack-chainalysis";
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

  const body = (await request.json()) as {
    allocator?: string;
    destination?: string;
    mode?: string;
  };
  const allocator =
    body.allocator === "sanctioned" || body.mode === "deny"
      ? "sanctioned"
      : body.allocator === "clean" || body.mode === "allow"
        ? "clean"
        : null;
  if (!allocator) {
    return NextResponse.json(
      { error: "allocator must be clean or sanctioned" },
      { status: 400 },
    );
  }
  const destination =
    body.destination === "dummy"
      ? "dummy"
      : body.destination === "idle" || body.mode === "allow" || body.mode === "deny"
        ? "idle"
        : null;
  if (!destination) {
    return NextResponse.json(
      { error: "destination must be dummy or idle" },
      { status: 400 },
    );
  }

  const twoAllocators = isAddress(demoConfig.allocators?.clean) && isAddress(demoConfig.allocators?.sanctioned);
  if (allocator === "sanctioned" && twoAllocators && !isAddress(demoConfig.allocators?.sanctioned)) {
    return NextResponse.json({ error: "demo-config.json allocators.sanctioned must be set" }, { status: 400 });
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
  const idle = market(demoConfig.idleMarket);
  const dummy = market(demoConfig.dummyMarket);
  // Withdraw the funded market first, then supply the destination.
  const allocations =
    destination === "dummy"
      ? [
          { marketParams: idle, assets: 0n },
          { marketParams: dummy, assets: maxUint256 },
        ]
      : [
          { marketParams: dummy, assets: 0n },
          { marketParams: idle, assets: maxUint256 },
        ];
  const listedQuery = {
    network: demoConfig.listedVaultsfyi.network,
    vaultAddress: getAddress(demoConfig.listedVaultsfyi.vaultAddress),
  };
  const prepareQueryOptions = twoAllocators
    ? {
        vaultsfyi: listedQuery,
        chainalysis: {
          address: getAddress(
            allocator === "clean"
              ? (demoConfig.allocators?.clean as string)
              : (demoConfig.allocators?.sanctioned as string),
          ),
        },
      }
    : {
        vaultsfyi:
          allocator === "sanctioned"
            ? { ...listedQuery, previousAllocationHash: "deadbeef" }
            : listedQuery,
      };

  try {
    const policyConfig = {
      chainId: String(demoConfig.chainId),
      env: "prod" as const,
    };
    const policy = twoAllocators
      ? definePolicy(policyConfig).with(vaultsfyi).with(chainalysis)
      : definePolicy(policyConfig).with(vaultsfyi);

    const shield = (
      await createShield({
        apiKey,
        walletClient,
        rpc,
        vault,
        policy,
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

    if (allocator === "clean") {
      const allow = await shield.morpho.reallocate(vault, allocations, {
        prepareQueryOptions,
      });
      return NextResponse.json({
        allocator,
        destination,
        blocked: false,
        transactionHash: allow.transactionHash,
        taskId: allow.taskId ?? null,
      });
    }

    const deny = await shield.assertIntentBlocked({
      to: vault,
      data: MetaMorphoAction.reallocate(allocations),
      functionSignature: demoConfig.intent.functionSignature,
      prepareQueryOptions,
    });
    return NextResponse.json({
      allocator,
      destination,
      blocked: deny.blocked ?? true,
      taskId: deny.taskId ?? null,
      reason: deny.reason ?? null,
    });
  } catch (error) {
    const err = error as {
      name?: string;
      message?: string;
      status?: number;
      httpStatus?: number;
      rpcMethod?: string;
      rpcCode?: number;
      body?: unknown;
      data?: unknown;
      cause?: { message?: string };
    };
    const bodyText = typeof err.body === "string" ? err.body : JSON.stringify(err.body ?? null);
    return NextResponse.json(
      {
        error: err.message ?? "reallocate failed",
        detail: {
          name: err.name ?? null,
          status: err.status ?? err.httpStatus ?? null,
          rpcMethod: err.rpcMethod ?? null,
          rpcCode: err.rpcCode ?? null,
          body: bodyText?.slice(0, 2000) ?? null,
          data: err.data ?? null,
          cause: err.cause?.message ?? null,
        },
      },
      { status: 502 },
    );
  }
}
