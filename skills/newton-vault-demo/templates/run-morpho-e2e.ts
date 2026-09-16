/**
 * Morpho + vaultsfyi gold path for newton-vault-demo.
 * Default: print a plan. Pass flags after the user confirms each live step:
 *
 *   --create --params --allocator --delegate --owner --secrets --allow --deny
 *
 * Do not invent VAULT, markets, or the listed Vaults.fyi override.
 * Copy into shields/<slug>/ and install peers from templates/package.json.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { definePolicy, createShield } from '@newton-xyz/vaultkit'
import { morphoActions } from '@newton-xyz/vaultkit/vendors/morpho'
import { vaultsfyi } from '@newton-xyz/policy-pack-vaultsfyi'
import { MetaMorphoAction } from '@morpho-org/blue-sdk-viem'
import {
  createPublicClient,
  createWalletClient,
  getAddress,
  http,
  maxUint256,
  parseAbi,
  type Address,
  type Hex,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { baseSepolia, sepolia } from 'viem/chains'

type PolicyHandoff = {
  chainId: number
  policy: Address | null
  packs?: { id: string }[]
  policyData?: Address[]
  intent?: { functionSignature: string }
  params?: { path: string }
}

type MarketParams = {
  loanToken: Address
  collateralToken: Address
  oracle: Address
  irm: Address
  lltv: bigint
}

const ETH_SEPOLIA_RPC = 'https://ethereum-sepolia-rpc.publicnode.com'
const BASE_SEPOLIA_RPC = 'https://base-sepolia-rpc.publicnode.com'
const VAULTKIT_REALLOCATE =
  'reallocate(((address,address,address,address,uint256),uint256)[])'

const flags = new Set(process.argv.slice(2).filter((arg) => arg.startsWith('--')))
function want(name: string): boolean {
  return flags.has('--all') || flags.has(`--${name}`)
}

function requiredEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing ${name}. Inject it in the process environment or ~/.newton/.env`)
  }
  return value
}

function rpcUrl(chainId: number): string {
  const fromEnv = process.env.RPC_URL
  if (fromEnv && chainId === 84532 && /ethereum-sepolia/i.test(fromEnv) && !/base/i.test(fromEnv)) {
    return BASE_SEPOLIA_RPC
  }
  if (fromEnv) {
    return fromEnv
  }
  if (chainId === 84532) {
    return BASE_SEPOLIA_RPC
  }
  if (chainId === 11155111) {
    return ETH_SEPOLIA_RPC
  }
  throw new Error(`RPC_URL is required on chain ${chainId}`)
}

function parseMarket(raw: {
  loanToken: string
  collateralToken: string
  oracle: string
  irm: string
  lltv: string | number
}): MarketParams {
  return {
    loanToken: getAddress(raw.loanToken),
    collateralToken: getAddress(raw.collateralToken),
    oracle: getAddress(raw.oracle),
    irm: getAddress(raw.irm),
    lltv: BigInt(raw.lltv),
  }
}

function packSecret(): string {
  const value = process.env.VAULTS_FYI_API_KEY ?? process.env.VAULTSFYI_API_KEY
  if (!value) {
    throw new Error('Missing VAULTS_FYI_API_KEY (alias VAULTSFYI_API_KEY accepted)')
  }
  return value
}

function innerVaultsfyiParams(paramsPath: string | undefined): Record<string, unknown> {
  if (!paramsPath) {
    throw new Error('Set PARAMS_PATH or policy-handoff params.path to the envelope JSON')
  }
  const raw = JSON.parse(readFileSync(paramsPath, 'utf8')) as {
    params?: { vaultsfyi?: Record<string, unknown> }
    vaultsfyi?: Record<string, unknown>
  }
  const inner = raw.params?.vaultsfyi ?? raw.vaultsfyi
  if (!inner) {
    throw new Error(`${paramsPath} has no params.vaultsfyi (VaultKit envelope)`)
  }
  return inner
}

const live = ['create', 'params', 'allocator', 'delegate', 'owner', 'secrets', 'allow', 'deny'] as const
const requested = live.filter((name) => want(name))

const handoffPath = requiredEnv('POLICY_HANDOFF')
const handoff = JSON.parse(readFileSync(handoffPath, 'utf8')) as PolicyHandoff
if (!handoff.policy) {
  throw new Error('policy-handoff.json has policy: null; deploy with newton-policy first')
}

const vault = getAddress(requiredEnv('VAULT'))
const listedVault = getAddress(requiredEnv('LISTED_VAULTSFYI_VAULT'))
const listedNetwork = process.env.LISTED_VAULTSFYI_NETWORK ?? 'mainnet'
const chain =
  handoff.chainId === 84532 ? baseSepolia : handoff.chainId === 11155111 ? sepolia : undefined
if (!chain) {
  throw new Error(`Unsupported chainId ${handoff.chainId}`)
}

const rpc = rpcUrl(handoff.chainId)
console.log('plan', {
  chainId: handoff.chainId,
  policy: getAddress(handoff.policy),
  vault,
  listedVaultsfyi: { network: listedNetwork, vaultAddress: listedVault },
  flags: requested.length ? requested : ['(none — dry plan)'],
  functionSignature: VAULTKIT_REALLOCATE,
})

if (requested.length === 0) {
  console.log('Pass --create / --params / --allocator / --delegate / --owner / --secrets / --allow / --deny after confirmation')
  process.exit(0)
}

const packIds = (handoff.packs ?? []).map((p) => p.id)
if (packIds.length && !packIds.includes('vaultsfyi')) {
  throw new Error(`This script imports vaultsfyi; handoff packs are ${packIds.join(', ')}`)
}

const account = privateKeyToAccount(requiredEnv('PRIVATE_KEY') as `0x${string}`)
const publicClient = createPublicClient({ chain, transport: http(rpc) })
const walletClient = createWalletClient({
  account,
  chain,
  transport: http(rpc),
})

const version = BigInt(process.env.SHIELD_VERSION ?? '0')
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
    policyAddress: getAddress(handoff.policy),
    version,
    allowNewVersion: true,
  })
).extend(morphoActions)

console.log('shield', shield.policyClientAddress)

const morphoAbi = parseAbi([
  'function reallocate(((address,address,address,address,uint256),uint256)[])',
  'function setIsAllocator(address,bool)',
  'function isAllocator(address) view returns (bool)',
  'function getOwner() view returns (address)',
  'function setPolicyClientOwner(address)',
  'function setApprovedDelegate(address,bool)',
  'function isApprovedDelegate(address) view returns (bool)',
])

let grantTx: Hex | null = null
let ownerTx: Hex | null = null
let delegateTx: Hex | null = null
let paramsSet = false
let secretsUploaded = false
let allowHash: Hex | null = null
let allowTask: string | null = null
let denyBlocked = false
let denyTask: string | null = null
let denyReason: unknown = null

if (want('allocator')) {
  const already = await publicClient.readContract({
    address: vault,
    abi: morphoAbi,
    functionName: 'isAllocator',
    args: [shield.policyClientAddress],
  })
  if (already) {
    console.log('setIsAllocator already true — skip (AlreadySet)')
  } else {
    grantTx = await walletClient.writeContract({
      address: vault,
      abi: morphoAbi,
      functionName: 'setIsAllocator',
      args: [shield.policyClientAddress, true],
    })
    await publicClient.waitForTransactionReceipt({ hash: grantTx })
    console.log('setIsAllocator', grantTx)
  }
}

if (want('params')) {
  const paramsPath = process.env.PARAMS_PATH ?? handoff.params?.path
  await shield.setParams({ vaultsfyi: innerVaultsfyiParams(paramsPath) })
  paramsSet = true
  console.log('setParams ok')
}

if (want('delegate')) {
  const approved = await publicClient.readContract({
    address: shield.policyClientAddress,
    abi: morphoAbi,
    functionName: 'isApprovedDelegate',
    args: [account.address],
  })
  if (approved) {
    console.log('curator already approved delegate')
  } else {
    delegateTx = await walletClient.writeContract({
      address: shield.policyClientAddress,
      abi: morphoAbi,
      functionName: 'setApprovedDelegate',
      args: [account.address, true],
    })
    await publicClient.waitForTransactionReceipt({ hash: delegateTx })
    console.log('setApprovedDelegate', delegateTx)
  }
}

if (want('owner')) {
  const dashboard = getAddress(requiredEnv('DASHBOARD_OWNER'))
  const current = await publicClient.readContract({
    address: shield.policyClientAddress,
    abi: morphoAbi,
    functionName: 'getOwner',
  })
  if (current.toLowerCase() === dashboard.toLowerCase()) {
    console.log('getOwner already dashboard identity')
  } else {
    ownerTx = await walletClient.writeContract({
      address: shield.policyClientAddress,
      abi: morphoAbi,
      functionName: 'setPolicyClientOwner',
      args: [dashboard],
    })
    await publicClient.waitForTransactionReceipt({ hash: ownerTx })
    console.log('setPolicyClientOwner', ownerTx)
  }
}

if (want('secrets')) {
  await shield.uploadSecrets({
    vaultsfyi: { VAULTS_FYI_API_KEY: packSecret() },
  })
  secretsUploaded = true
  console.log('uploadSecrets ok')
}

function loadAllocations(): { marketParams: MarketParams; assets: bigint }[] {
  const path = requiredEnv('MARKETS_PATH')
  const raw = JSON.parse(readFileSync(path, 'utf8')) as {
    idle: Parameters<typeof parseMarket>[0]
    dummy: Parameters<typeof parseMarket>[0]
    idleAssets?: string
  }
  return [
    { marketParams: parseMarket(raw.idle), assets: BigInt(raw.idleAssets ?? '1000000') },
    { marketParams: parseMarket(raw.dummy), assets: maxUint256 },
  ]
}

const listedQuery = {
  network: listedNetwork,
  vaultAddress: listedVault,
}

if (want('allow')) {
  const allocations = loadAllocations()
  const allow = await shield.morpho.reallocate(vault, allocations, {
    prepareQueryOptions: { vaultsfyi: listedQuery },
  })
  await publicClient.waitForTransactionReceipt({ hash: allow.transactionHash })
  allowHash = allow.transactionHash
  allowTask = allow.taskId != null ? String(allow.taskId) : null
  console.log('allow tx', allowHash, 'task', allowTask)
}

if (want('deny')) {
  const allocations = loadAllocations()
  const denyCalldata = MetaMorphoAction.reallocate(allocations)
  const deny = await shield.assertIntentBlocked({
    to: vault,
    data: denyCalldata,
    functionSignature: handoff.intent?.functionSignature ?? VAULTKIT_REALLOCATE,
    prepareQueryOptions: {
      vaultsfyi: { ...listedQuery, previousAllocationHash: 'deadbeef' },
    },
  })
  denyBlocked = Boolean(deny.blocked)
  denyTask = deny.taskId != null ? String(deny.taskId) : null
  denyReason = deny.reason ?? null
  console.log('deny blocked', denyBlocked, 'task', denyTask, 'reason', denyReason)
}

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
  listedVaultsfyi: listedQuery,
  role: { name: 'allocator', granted: Boolean(grantTx) || want('allocator'), grantTx },
  paramsSet: paramsSet || want('params'),
  secretsUploaded: secretsUploaded || want('secrets'),
  allow: { action: 'reallocate', transactionHash: allowHash, taskId: allowTask },
  deny: { action: 'reallocate', blocked: denyBlocked, taskId: denyTask, reason: denyReason },
  ownerTx,
  delegateTx,
}

writeFileSync('shield-handoff.json', `${JSON.stringify(out, null, 2)}\n`)
console.log('wrote shield-handoff.json')
