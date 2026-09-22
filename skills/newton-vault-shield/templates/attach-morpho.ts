/**
 * Morpho gold path: attach a Shield, grant allocator (separate owner tx),
 * setParams / uploadSecrets, typed reallocate allow, assertIntentBlocked deny.
 *
 * Fill from policy-handoff.json and env. Do not invent vault, policy, or
 * marketParams addresses. Confirm before live txs.
 *
 * For the Morpho + vaultsfyi gold path, copy
 * `newton-vault-demo/templates/run-morpho-e2e.ts` instead of filling this
 * skeleton.
 *
 * Extra packs: pnpm add @newton-xyz/policy-pack-<id> and .with(thatModule)
 * in the same order as handoff.packs[]. Morpho peers:
 *   pnpm add @morpho-org/blue-sdk @morpho-org/blue-sdk-viem @morpho-org/morpho-ts
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { definePolicy, createShield } from '@newton-xyz/vaultkit'
import { morphoActions } from '@newton-xyz/vaultkit/vendors/morpho'
import { vaultsfyi } from '@newton-xyz/policy-pack-vaultsfyi'
import {
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
  policyData?: Address[]
  params?: { path: string }
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

function rpcUrl(chainId: number): string {
  const fromEnv = process.env.RPC_URL
  if (fromEnv) return fromEnv
  if (chainId === 11155111) return SEPOLIA_RPC
  throw new Error(`RPC_URL is required on chain ${chainId}; do not invent a public endpoint`)
}

const handoffPath = requiredEnv('POLICY_HANDOFF')
const vault = requiredEnv('VAULT') as Address
const handoff = JSON.parse(readFileSync(handoffPath, 'utf8')) as PolicyHandoff

if (!handoff.policy) {
  throw new Error('policy-handoff.json has policy: null; deploy with newton-policy before createShield')
}

const packIds = (handoff.packs ?? []).map((p) => p.id)
if (packIds.length && !packIds.includes('vaultsfyi')) {
  throw new Error(`This template imports vaultsfyi; handoff packs are ${packIds.join(', ')}`)
}

const chain = handoff.chainId === 84532 ? baseSepolia : undefined
if (!chain) {
  throw new Error(`Template chain table only includes Base Sepolia (84532); got ${handoff.chainId}`)
}

const account = privateKeyToAccount(requiredEnv('PRIVATE_KEY') as Hex)
const rpc = rpcUrl(handoff.chainId)
const walletClient = createWalletClient({
  account,
  chain,
  transport: http(rpc),
})

const policy = definePolicy({
  chainId: String(handoff.chainId),
  env: 'prod',
}).with(vaultsfyi)

const shield = (
  await createShield({
    apiKey: requiredEnv('NEWTON_API_KEY'),
    walletClient,
    rpc,
    vault,
    policy,
    policyAddress: handoff.policy,
  })
).extend(morphoActions)

console.log('shield', shield.policyClientAddress)
console.log('policy', shield.policy.address)
console.log('verification', shield.verification)

// Confirm with the user before each of the following.
//
// 1. Vault owner (often not this key) grants allocator/curator:
//    setIsAllocator(shield.policyClientAddress, true)
// 2. Params from the policy dir — do not invent thresholds:
//    await shield.setParams({ vaultsfyi: { ...from configs/params.json } })
// 3. await shield.uploadSecrets({ vaultsfyi: { VAULTS_FYI_API_KEY: process.env.VAULTSFYI_API_KEY! } })
// 4. Allow: shield.morpho.reallocate(vault, allocationsFromUser, { prepareQueryOptions: { vaultsfyi: { previousAllocationHash } } })
// 5. Deny:  shield.assertIntentBlocked({ to: vault, data: denyCalldata, functionSignature })

const out = {
  schemaVersion: 1,
  kind: 'newton-vault-shield-handoff',
  chainId: handoff.chainId,
  environment: 'testnet',
  policyHandoff: handoffPath,
  vendor: 'morpho',
  vault,
  shield: shield.policyClientAddress,
  policy: shield.policy.address,
  policyData: handoff.policyData ?? [],
  packs: handoff.packs ?? [],
  role: { name: 'allocator', granted: false, grantTx: null },
  paramsSet: false,
  secretsUploaded: false,
  allow: { action: 'reallocate', transactionHash: null, taskId: null },
  deny: { action: 'reallocate', blocked: false, taskId: null, reason: null },
}

writeFileSync('shield-handoff.json', `${JSON.stringify(out, null, 2)}\n`)
