# Read verdict history from the TaskManager

Use this for a dashboard, an audit trail, or any "show past verdicts for this
client" view. No indexer is needed: the gateway broadcasts each task it
evaluates to the TaskManager, which emits the full response as an event.

## The events

On the TaskManager (`newtonProverTaskManager` from
`newton-cli --chain-id <id> deployments show`):

| Event | topic0 | Indexed | Emitted |
|---|---|---|---|
| `TaskResponded(TaskResponse taskResponse, ResponseCertificate responseCertificate)` | `0xad9c194d3134d2167a85391c2f8b2641e7bb4e64303e7a2a2334ef04702a6c2c` | none | every responded task, allowed or denied |
| `PolicyDenied(address indexed policyClient, bytes32 indexed taskId, bytes32 policyId, bytes32 intentHash, uint32 referenceBlock)` | `0xef8ce97d2fa69839d5bfbc66f9e14b1a4ee8ae0dd640f5237360ccb638f499af` | client, task | denials only |

Canonical `TaskResponded` signature:

```text
TaskResponded((bytes32,address,bytes32,(address,address,uint256,bytes,uint256,bytes),bytes,bool,(bytes32,address,bytes,(bytes,bytes,uint32)[])[],uint256),(uint32,uint32,bytes32,bytes))
```

Take the ABI from `INewtonProverTaskManager` in `newton-contracts` (it is in
`out/` after `forge build` of a client project). Match on the selector
above. The interface also declares `DirectTaskResponded`, but gateway-broadcast
tasks emit `TaskResponded`; decoding with the wrong event finds nothing.

## What a `TaskResponded` gives you

`taskResponse` fields:

| Field | Use |
|---|---|
| `taskId` | Task identity; link to the transaction (`transactionHash` of the log) |
| `policyClient` | Filter to your client (not indexed, see below) |
| `policyId` | The client's policy set at task creation |
| `intent` | `from`, `to`, `data`, … Decode `data` with your protected function's ABI to get the published arguments |
| `allowed` | The set's verdict: true only if every policy allowed |
| `policyTaskData[i]` | Per policy, in set order: `policyAddress`, `policy` (Rego bytes), `policyData[0].data` (hex of the oracle JSON), `policyData[0].wasmArgs` |
| `initializationTimestamp` | Task creation time, unix seconds |

Oracle output and Rego are public here, so design `policy.js` output for
disclosure (`newton-policy`, policy-loop.md, "Oracle output is public").

## Filter to one client

`policyClient` is not indexed on `TaskResponded`. Fetch logs by `topic0` in
block chunks, from the client's deploy block (record it at deploy time from
`cast receipt <deployTx> blockNumber`) to the head, then decode and keep
`taskResponse.policyClient == client`. Ethereum Sepolia's PublicNode RPC
accepts 10,000-block `eth_getLogs` ranges. For denials only, filter
`PolicyDenied` by its indexed `policyClient` instead.

Run the scan server-side and cache it for a few seconds; do not ship an RPC
key to the browser.

## Verify the Rego shown

`keccak256(policyTaskData[i].policy)` equals `policyCodeHash()` on the Policy
at `policyTaskData[i].policyAddress`. Comparing the two proves the Rego you
display is the code operators evaluated. Compare against the policy that
evaluated the task, not the client's current policy, which may have changed.

## viem sketch

```ts
import { createPublicClient, decodeEventLog, hexToString, http, keccak256, hexToBytes } from "viem";
import { sepolia } from "viem/chains";

const rpc = createPublicClient({ chain: sepolia, transport: http(RPC_URL) });
const head = await rpc.getBlockNumber();
const rows = [];
for (let from = DEPLOY_BLOCK; from <= head; from += 10_000n) {
  const to = from + 9_999n > head ? head : from + 9_999n;
  const logs = await rpc.request({
    method: "eth_getLogs",
    params: [{ address: TASK_MANAGER, topics: [TASK_RESPONDED_TOPIC], fromBlock: `0x${from.toString(16)}`, toBlock: `0x${to.toString(16)}` }],
  });
  for (const log of logs) {
    const { args } = decodeEventLog({ abi: [TASK_RESPONDED_EVENT], data: log.data, topics: log.topics });
    const r = args.taskResponse;
    if (r.policyClient.toLowerCase() !== CLIENT.toLowerCase()) continue;
    const p = r.policyTaskData[0];
    rows.push({
      taskId: r.taskId,
      tx: log.transactionHash,
      allowed: r.allowed,
      timeMs: Number(r.initializationTimestamp) * 1000,
      oracle: JSON.parse(hexToString(p.policyData[0].data)),
      regoHash: keccak256(hexToBytes(p.policy)), // compare with Policy.policyCodeHash()
    });
  }
}
```
