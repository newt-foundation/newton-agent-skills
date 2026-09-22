/**
 * Escape hatch when VaultKit has no typed overlay for this vault/action.
 * Encode `data` with viem `encodeFunctionData` from the vault ABI and the
 * policy intent's functionSignature. Do not invent `to` / `data`.
 *
 * Confirm before live txs. Ethereum Sepolia (11155111) and Base Sepolia
 * (84532) are in the chain table.
 *
 * Each pack combination is one definePolicy().with(...).with(...) expression,
 * in handoff.packs[] order. Do not reassign policy = policy.with(next):
 * PolicyDraft tuples are fixed-length. Add a branch for a new combination.
 */
import { readFileSync } from 'node:fs'
import { createShield, definePolicy } from '@newton-xyz/vaultkit'
import { chainalysis } from '@newton-xyz/policy-pack-chainalysis'
import { vaultsfyi } from '@newton-xyz/policy-pack-vaultsfyi'
import { webacy } from '@newton-xyz/policy-pack-webacy'
import {
  createWalletClient,
  getAddress,
  http,
  type Address,
  type Hex,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { baseSepolia, sepolia } from 'viem/chains'

type PolicyHandoff = {
  chainId: number
  policy: Address | null
  packs?: { id: string }[]
  intent?: { functionSignature: string }
}

const PUBLIC_RPC: Record<number, string> = {
  11155111: 'https://ethereum-sepolia-rpc.publicnode.com',
  84532: 'https://base-sepolia-rpc.publicnode.com',
}

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

const chain =
  handoff.chainId === 84532 ? baseSepolia : handoff.chainId === 11155111 ? sepolia : undefined
if (!chain) {
  throw new Error(
    `Template chain table includes Ethereum Sepolia (11155111) and Base Sepolia (84532); got ${handoff.chainId}`,
  )
}

const rpc = process.env.RPC_URL ?? PUBLIC_RPC[handoff.chainId]
if (!rpc) {
  throw new Error(`RPC_URL is required on chain ${handoff.chainId}`)
}

const account = privateKeyToAccount(requiredEnv('PRIVATE_KEY') as Hex)
const walletClient = createWalletClient({
  account,
  chain,
  transport: http(rpc),
})

const vault = getAddress(requiredEnv('VAULT'))
const data = requiredEnv('CALLDATA') as Hex
const functionSignature =
  process.env.FUNCTION_SIGNATURE ??
  handoff.intent?.functionSignature ??
  (() => {
    throw new Error('Set FUNCTION_SIGNATURE or intent.functionSignature on the policy handoff')
  })()

const packIds = (handoff.packs ?? []).map((p) => p.id)
const packKey = packIds.join('+')
const policyConfig = { chainId: String(handoff.chainId), env: 'prod' as const }
const policyAddress = handoff.policy

const clients = {
  apiKey: requiredEnv('NEWTON_API_KEY'),
  walletClient,
  rpc,
  vault,
  policyAddress,
  allowNewVersion: true,
}

const webacyOptions = () => ({ webacy: { address: getAddress(requiredEnv('WEBACY_ADDRESS')) } })
const chainalysisOptions = () => ({
  chainalysis: { address: getAddress(requiredEnv('CHAINALYSIS_ADDRESS')) },
})
const vaultsfyiOptions = () => ({
  vaultsfyi: {
    network: requiredEnv('VAULTSFYI_NETWORK'),
    vaultAddress: getAddress(requiredEnv('VAULTSFYI_VAULT')),
    ...(process.env.VAULTSFYI_PREVIOUS_ALLOCATION_HASH
      ? { previousAllocationHash: process.env.VAULTSFYI_PREVIOUS_ALLOCATION_HASH }
      : {}),
  },
})

const shield =
  packKey === 'webacy'
    ? await createShield({ ...clients, policy: definePolicy(policyConfig).with(webacy) })
    : packKey === 'chainalysis'
      ? await createShield({ ...clients, policy: definePolicy(policyConfig).with(chainalysis) })
      : packKey === 'vaultsfyi'
        ? await createShield({ ...clients, policy: definePolicy(policyConfig).with(vaultsfyi) })
        : packKey === 'vaultsfyi+chainalysis'
          ? await createShield({
              ...clients,
              policy: definePolicy(policyConfig).with(vaultsfyi).with(chainalysis),
            })
          : packKey === 'chainalysis+vaultsfyi'
            ? await createShield({
                ...clients,
                policy: definePolicy(policyConfig).with(chainalysis).with(vaultsfyi),
              })
            : packKey === 'vaultsfyi+webacy'
              ? await createShield({
                  ...clients,
                  policy: definePolicy(policyConfig).with(vaultsfyi).with(webacy),
                })
              : packKey === 'webacy+vaultsfyi'
                ? await createShield({
                    ...clients,
                    policy: definePolicy(policyConfig).with(webacy).with(vaultsfyi),
                  })
                : (() => {
                    throw new Error(
                      `Add a definePolicy().with(...) branch for handoff pack order [${packKey}]. Do not reassign policy = policy.with(next).`,
                    )
                  })()

console.log('shield', shield.policyClientAddress)

const prepareQueryOptions =
  packKey === 'webacy'
    ? webacyOptions()
    : packKey === 'chainalysis'
      ? chainalysisOptions()
      : packKey === 'vaultsfyi'
        ? vaultsfyiOptions()
        : packKey === 'vaultsfyi+chainalysis' || packKey === 'chainalysis+vaultsfyi'
          ? { ...vaultsfyiOptions(), ...chainalysisOptions() }
          : packKey === 'vaultsfyi+webacy' || packKey === 'webacy+vaultsfyi'
            ? { ...vaultsfyiOptions(), ...webacyOptions() }
            : {}

// Confirm before send. Deny with the same calldata via shield.assertIntentBlocked
// when the gate is a pack input (change WEBACY_ADDRESS or CHAINALYSIS_ADDRESS).
const result = await shield.sendCall(
  {
    to: vault,
    data,
    functionSignature,
    prepareQueryOptions,
  },
  'DIRECT',
  30_000,
)

console.log('taskId', result.taskId)
console.log('transactionHash', result.transactionHash)
console.log('evaluationResult', result.evaluationResult)
