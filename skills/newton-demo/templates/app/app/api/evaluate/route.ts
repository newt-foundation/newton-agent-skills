import { newtonWalletClientActions } from "@newton-xyz/sdk";
import { NextResponse } from "next/server";
import { createWalletClient, http, type Address, type Hex } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { chainFromId, rpcUrl } from "@/lib/chains";
import { isAllow, normalizeGatewayValue } from "@/lib/normalize";

export const runtime = "nodejs";

type EvaluateBody = {
  policyClient?: Address;
  intent?: {
    from: Address;
    to: Address;
    value: string;
    data: Hex;
    chainId: number | string;
    functionSignature: Hex;
  };
  intentSignature?: Hex;
  wasmArgs?: Hex;
};

export async function POST(request: Request) {
  const apiKey = process.env.NEWTON_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json(
      { error: "NEWTON_API_KEY is not set on the server" },
      { status: 500 },
    );
  }

  const body = (await request.json()) as EvaluateBody;
  if (!body.policyClient || !body.intent || !body.intentSignature) {
    return NextResponse.json(
      { error: "policyClient, intent, and intentSignature are required" },
      { status: 400 },
    );
  }

  const chainId = Number(body.intent.chainId);
  const chain = chainFromId(chainId);
  // Throwaway account so the SDK can attach wallet-client actions. It never
  // signs; the user's EIP-712 signature is in the request body.
  const account = privateKeyToAccount(generatePrivateKey());
  const walletClient = createWalletClient({
    account,
    chain,
    transport: http(rpcUrl(chainId)),
  }).extend(newtonWalletClientActions({ apiKey }));

  try {
    const { result } = await walletClient.evaluateIntentDirect({
      policyClient: body.policyClient,
      intent: {
        from: body.intent.from,
        to: body.intent.to,
        value: body.intent.value,
        data: body.intent.data,
        chainId,
        functionSignature: body.intent.functionSignature,
      },
      intentSignature: body.intentSignature,
      ...(body.wasmArgs ? { wasmArgs: body.wasmArgs } : {}),
      // Gateway timeout is seconds. The published SDK page sometimes labels ms.
      timeout: 30,
    });

    const evaluationResult = Boolean(
      result.evaluationResult ?? isAllow((result as { taskResponse?: { evaluationResult?: unknown } }).taskResponse?.evaluationResult),
    );
    const task = normalizeGatewayValue(result.task);
    const taskResponse = normalizeGatewayValue(result.taskResponse);
    const signatureData = normalizeGatewayValue(
      result.blsSignature ?? (result as { signatureData?: unknown }).signatureData,
      "blsSignature",
    );

    return NextResponse.json({
      evaluationResult,
      task,
      taskResponse,
      signatureData,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "evaluateIntentDirect failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
