// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.27;

import {Script, console} from "forge-std/Script.sol";
import {DirectERC20TransferPolicyClient} from "../src/DirectERC20TransferPolicyClient.sol";

/// @notice Deploy the golden ERC-20 wrapper. Does not call `setPolicy`.
/// @dev Copy to `script/DeployPolicyClient.s.sol`. Constructor owner MUST be the
///      local Foundry key (`cast wallet address --private-key "$PRIVATE_KEY"`),
///      not the `newton-cli login` wallet. Bind policy and transfer owner afterward
///      with `cast` as in references/deployment-and-wiring.md.
///
/// Required env (addresses, never private keys in this file):
///   TOKEN, TASK_MANAGER, POLICY, POLICY_CLIENT_OWNER
///
///   forge script script/DeployPolicyClient.s.sol:DeployPolicyClient \
///     --rpc-url "$RPC_URL" --private-key "$PRIVATE_KEY" --broadcast
contract DeployPolicyClient is Script {
    function run() external {
        address token = vm.envAddress("TOKEN");
        address taskManager = vm.envAddress("TASK_MANAGER");
        address policy = vm.envAddress("POLICY");
        address owner = vm.envAddress("POLICY_CLIENT_OWNER");

        vm.startBroadcast();
        DirectERC20TransferPolicyClient client =
            new DirectERC20TransferPolicyClient(token, taskManager, policy, owner);
        vm.stopBroadcast();

        console.log("policyClient", address(client));
    }
}
