/**
 * Escape hatch when VaultKit has no typed overlay for this vault/action.
 * The caller owns calldata integrity. Prefer attach-morpho.ts (or another
 * vendor overlay) when one exists.
 *
 * Confirm before live txs. Do not invent `to` / `data`.
 */
import { readFileSync } from 'node:fs'
import { createShield, definePolicy, policyFromAddress } from '@newton-xyz/vaultkit'
import { vaultsfyi } from '@newton-xyz/policy-pack-vaultsfyi'
import {
  createPublicClient,
  createWalletClient,
  http,
  type Address,
  type Hex,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { baseSepolia } from 'viem/chains'

type PolicyHandoff = {
  chainId: number
  policy: Address | null
  packs?: { id: string }[]
  intent?: { functionSignature: string }
}

const SEPOLIA_RPC = 'https://ethereum-sepolia-rpc.publicnode.com'

function requiredEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing ${name}. Inject it in the process environment or ~/.newton/.env`)
  }
  return value
}

const handoff = JSON.parse(
  readFileSync(requiredEnv('POLICY_HANDOFF'), 'utf8'),
) as PolicyHandoff

if (!handoff.policy) {
  throw new Error('policy-handoff.json has policy: null; deploy with newton-policy before createShield')
}

const chain = handoff.chainId === 84532 ? baseSepolia : undefined
if (!chain) {
  throw new Error(`Template chain table only includes Base Sepolia (84532); got ${handoff.chainId}`)
}

const rpc =
  process.env.RPC_URL ??
  (handoff.chainId === 11155111
    ? SEPOLIA_RPC
    : (() => {
        throw new Error(`RPC_URL is required on chain ${handoff.chainId}`)
      })())

const account = privateKeyToAccount(requiredEnv('PRIVATE_KEY') as Hex)
const publicClient = createPublicClient({ chain, transport: http(rpc) })
const walletClient = createWalletClient({
  account,
  chain,
  transport: http(rpc),
})

const vault = requiredEnv('VAULT') as Address
const data = requiredEnv('CALLDATA') as Hex
const functionSignature =
  process.env.FUNCTION_SIGNATURE ??
  handoff.intent?.functionSignature ??
  (() => {
    throw new Error('Set FUNCTION_SIGNATURE or intent.functionSignature on the policy handoff')
  })()

const packIds = (handoff.packs ?? []).map((p) => p.id)
const policy = packIds.includes('vaultsfyi')
  ? definePolicy({ chainId: String(handoff.chainId), env: 'prod' }).with(vaultsfyi)
  : policyFromAddress({
      address: handoff.policy,
      chainId: String(handoff.chainId),
      env: 'prod',
    })

const shield = await createShield({
  apiKey: requiredEnv('NEWTON_API_KEY'),
  walletClient,
  publicClient,
  rpc,
  vault,
  policy,
  ...(packIds.includes('vaultsfyi') ? { policyAddress: handoff.policy } : {}),
})

console.log('shield', shield.policyClientAddress)

// Confirm before send. Deny with the same args via shield.assertIntentBlocked.
const result = await shield.sendCall(
  {
    to: vault,
    data,
    functionSignature,
  },
  'DIRECT',
  30_000,
)

console.log('taskId', result.taskId)
console.log('transactionHash', result.transactionHash)
console.log('evaluationResult', result.evaluationResult)
