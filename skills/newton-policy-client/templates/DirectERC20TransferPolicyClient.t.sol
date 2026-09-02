// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.27;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {INewtonPolicy} from "newton-contracts/src/interfaces/INewtonPolicy.sol";
import {INewtonProverTaskManager} from "newton-contracts/src/interfaces/INewtonProverTaskManager.sol";
import {NewtonMessage} from "newton-contracts/src/core/NewtonMessage.sol";
import {DirectERC20TransferPolicyClient} from "../src/DirectERC20TransferPolicyClient.sol";

/// @notice Adversarial suite for the golden ERC-20 wrapper.
/// @dev Copy to `test/DirectERC20TransferPolicyClient.t.sol` (contract → `src/`).
///      Mocks are application-level: they record spent task IDs and honor
///      `evaluationResult`. Do not invent BLS signatures.

contract MockERC20 is ERC20 {
    constructor() ERC20("Mock USD", "mUSD") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract MockNewtonPolicy {
    bytes32 public lastPolicyId;
    INewtonPolicy.PolicyConfig public lastConfig;

    function setPolicy(INewtonPolicy.PolicyConfig calldata policyConfig) external returns (bytes32) {
        lastConfig = policyConfig;
        lastPolicyId = keccak256(abi.encode(msg.sender, policyConfig.policyParams, policyConfig.expireAfter));
        return lastPolicyId;
    }

    function getPolicyConfig(bytes32) external view returns (INewtonPolicy.PolicyConfig memory) {
        return lastConfig;
    }
}

/// @dev Application-level TaskManager: records spent task IDs and honors evaluationResult.
contract MockTaskManager {
    error AlreadySpent();
    error StaleResponse();

    uint32 public taskResponseWindowBlock = 100;
    mapping(bytes32 => bool) public spent;

    function minCompatiblePolicyVersion() external pure returns (string memory) {
        return "";
    }

    function validateAttestationDirect(
        INewtonProverTaskManager.Task calldata task,
        INewtonProverTaskManager.TaskResponse calldata taskResponse,
        bytes calldata
    ) external returns (bool) {
        if (spent[task.taskId]) revert AlreadySpent();
        if (block.number > uint256(task.taskCreatedBlock) + uint256(taskResponseWindowBlock)) {
            revert StaleResponse();
        }
        spent[task.taskId] = true;
        bytes memory result = taskResponse.evaluationResult;
        if (result.length == 0) return false;
        return result[result.length - 1] != 0;
    }
}

contract DirectERC20TransferPolicyClientTest is Test {
    bytes internal constant TRANSFER_SIGNATURE =
        bytes("function transfer(address recipient, uint256 amount)");

    MockERC20 internal token;
    MockNewtonPolicy internal policy;
    MockTaskManager internal taskManager;
    DirectERC20TransferPolicyClient internal client;

    address internal owner = address(0xA11CE);
    address internal sender = address(0xB0B);
    address internal recipient = address(0xCAFE);
    uint256 internal amount = 10_000e6;
    bytes32 internal policyId;

    function setUp() public {
        token = new MockERC20();
        policy = new MockNewtonPolicy();
        taskManager = new MockTaskManager();
        client = new DirectERC20TransferPolicyClient(
            address(token), address(taskManager), address(policy), owner
        );

        vm.prank(owner);
        policyId = client.setPolicy(
            INewtonPolicy.PolicyConfig({policyParams: bytes("{}"), expireAfter: 25})
        );

        token.mint(sender, amount * 2);
        vm.prank(sender);
        token.approve(address(client), type(uint256).max);
    }

    function test_allow_executesTransfer() public {
        (
            INewtonProverTaskManager.Task memory task,
            INewtonProverTaskManager.TaskResponse memory taskResponse
        ) = _attestation(sender, address(token), recipient, amount, true, uint32(block.number));

        vm.prank(sender);
        client.transferWithAttestation(recipient, amount, task, taskResponse, hex"");

        assertEq(token.balanceOf(recipient), amount);
        assertEq(token.balanceOf(sender), amount);
    }

    function test_deny_revertsAndNoTransfer() public {
        (
            INewtonProverTaskManager.Task memory task,
            INewtonProverTaskManager.TaskResponse memory taskResponse
        ) = _attestation(sender, address(token), recipient, amount, false, uint32(block.number));

        vm.prank(sender);
        vm.expectRevert(DirectERC20TransferPolicyClient.PolicyDenied.selector);
        client.transferWithAttestation(recipient, amount, task, taskResponse, hex"");

        assertEq(token.balanceOf(recipient), 0);
    }

    function test_replay_reverts() public {
        (
            INewtonProverTaskManager.Task memory task,
            INewtonProverTaskManager.TaskResponse memory taskResponse
        ) = _attestation(sender, address(token), recipient, amount, true, uint32(block.number));

        vm.prank(sender);
        client.transferWithAttestation(recipient, amount, task, taskResponse, hex"");

        vm.prank(sender);
        vm.expectRevert(MockTaskManager.AlreadySpent.selector);
        client.transferWithAttestation(recipient, amount, task, taskResponse, hex"");
    }

    function test_wrongSender_reverts() public {
        (
            INewtonProverTaskManager.Task memory task,
            INewtonProverTaskManager.TaskResponse memory taskResponse
        ) = _attestation(sender, address(token), recipient, amount, true, uint32(block.number));

        vm.prank(address(0xBAD));
        vm.expectRevert(abi.encodeWithSelector(NewtonMessage.Unauthorized.selector, "Not authorized intent sender"));
        client.transferWithAttestation(recipient, amount, task, taskResponse, hex"");
    }

    function test_wrongChain_reverts() public {
        (
            INewtonProverTaskManager.Task memory task,
            INewtonProverTaskManager.TaskResponse memory taskResponse
        ) = _attestation(sender, address(token), recipient, amount, true, uint32(block.number));
        task.intent.chainId = 1;
        taskResponse.intent.chainId = 1;

        vm.prank(sender);
        vm.expectRevert(abi.encodeWithSelector(NewtonMessage.Unauthorized.selector, "Chain ID does not match"));
        client.transferWithAttestation(recipient, amount, task, taskResponse, hex"");
    }

    function test_wrongPolicyId_reverts() public {
        (
            INewtonProverTaskManager.Task memory task,
            INewtonProverTaskManager.TaskResponse memory taskResponse
        ) = _attestation(sender, address(token), recipient, amount, true, uint32(block.number));
        taskResponse.policyId = bytes32(uint256(1));

        vm.prank(sender);
        vm.expectRevert(abi.encodeWithSelector(NewtonMessage.Unauthorized.selector, "Policy ID does not match"));
        client.transferWithAttestation(recipient, amount, task, taskResponse, hex"");
    }

    function test_wrongTarget_reverts() public {
        (
            INewtonProverTaskManager.Task memory task,
            INewtonProverTaskManager.TaskResponse memory taskResponse
        ) = _attestation(sender, address(0xDEAD), recipient, amount, true, uint32(block.number));

        vm.prank(sender);
        vm.expectRevert(
            abi.encodeWithSelector(
                DirectERC20TransferPolicyClient.InvalidIntentTarget.selector, address(token), address(0xDEAD)
            )
        );
        client.transferWithAttestation(recipient, amount, task, taskResponse, hex"");
    }

    function test_wrongFunctionSignature_reverts() public {
        (
            INewtonProverTaskManager.Task memory task,
            INewtonProverTaskManager.TaskResponse memory taskResponse
        ) = _attestation(sender, address(token), recipient, amount, true, uint32(block.number));
        task.intent.functionSignature = bytes("function transfer(address,uint256)");
        taskResponse.intent.functionSignature = bytes("function transfer(address,uint256)");

        vm.prank(sender);
        vm.expectRevert(DirectERC20TransferPolicyClient.InvalidFunctionSignature.selector);
        client.transferWithAttestation(recipient, amount, task, taskResponse, hex"");
    }

    function test_wrongSelector_reverts() public {
        (
            INewtonProverTaskManager.Task memory task,
            INewtonProverTaskManager.TaskResponse memory taskResponse
        ) = _attestation(sender, address(token), recipient, amount, true, uint32(block.number));
        bytes memory data = abi.encodeWithSelector(IERC20.transferFrom.selector, sender, recipient, amount);
        bytes memory padded = new bytes(68);
        for (uint256 i; i < 68; ++i) {
            padded[i] = i < data.length ? data[i] : bytes1(0);
        }
        task.intent.data = padded;
        taskResponse.intent.data = padded;

        vm.prank(sender);
        vm.expectRevert(
            abi.encodeWithSelector(
                DirectERC20TransferPolicyClient.InvalidSelector.selector,
                IERC20.transfer.selector,
                IERC20.transferFrom.selector
            )
        );
        client.transferWithAttestation(recipient, amount, task, taskResponse, hex"");
    }

    function test_argumentMismatch_reverts() public {
        (
            INewtonProverTaskManager.Task memory task,
            INewtonProverTaskManager.TaskResponse memory taskResponse
        ) = _attestation(sender, address(token), recipient, amount, true, uint32(block.number));

        vm.prank(sender);
        vm.expectRevert(DirectERC20TransferPolicyClient.IntentArgumentsMismatch.selector);
        client.transferWithAttestation(recipient, amount + 1, task, taskResponse, hex"");
    }

    function test_nonzeroValue_reverts() public {
        (
            INewtonProverTaskManager.Task memory task,
            INewtonProverTaskManager.TaskResponse memory taskResponse
        ) = _attestation(sender, address(token), recipient, amount, true, uint32(block.number));
        task.intent.value = 1;
        taskResponse.intent.value = 1;

        vm.prank(sender);
        vm.expectRevert(abi.encodeWithSelector(DirectERC20TransferPolicyClient.InvalidIntentValue.selector, 1));
        client.transferWithAttestation(recipient, amount, task, taskResponse, hex"");
    }

    function test_staleResponse_reverts() public {
        (
            INewtonProverTaskManager.Task memory task,
            INewtonProverTaskManager.TaskResponse memory taskResponse
        ) = _attestation(sender, address(token), recipient, amount, true, uint32(block.number));

        vm.roll(block.number + taskManager.taskResponseWindowBlock() + 1);
        vm.prank(sender);
        vm.expectRevert(MockTaskManager.StaleResponse.selector);
        client.transferWithAttestation(recipient, amount, task, taskResponse, hex"");
        assertEq(token.balanceOf(recipient), 0);
    }

    function test_downstreamFailure_revertsAndDoesNotSpendTwice() public {
        vm.prank(sender);
        token.approve(address(client), 0);

        (
            INewtonProverTaskManager.Task memory task,
            INewtonProverTaskManager.TaskResponse memory taskResponse
        ) = _attestation(sender, address(token), recipient, amount, true, uint32(block.number));

        vm.prank(sender);
        vm.expectRevert();
        client.transferWithAttestation(recipient, amount, task, taskResponse, hex"");

        assertEq(token.balanceOf(recipient), 0);
        assertFalse(taskManager.spent(task.taskId));
    }

    function _attestation(
        address from,
        address to,
        address recipient_,
        uint256 amount_,
        bool allowed,
        uint32 createdBlock
    )
        internal
        view
        returns (INewtonProverTaskManager.Task memory task, INewtonProverTaskManager.TaskResponse memory taskResponse)
    {
        NewtonMessage.Intent memory intent = NewtonMessage.Intent({
            from: from,
            to: to,
            value: 0,
            data: abi.encodeWithSelector(IERC20.transfer.selector, recipient_, amount_),
            chainId: block.chainid,
            functionSignature: TRANSFER_SIGNATURE
        });

        NewtonMessage.PolicyData[] memory policyData;
        task = INewtonProverTaskManager.Task({
            taskId: keccak256("task-1"),
            policyClient: address(client),
            taskCreatedBlock: createdBlock,
            quorumThresholdPercentage: 100,
            intent: intent,
            intentSignature: hex"11",
            wasmArgs: hex"",
            quorumNumbers: hex"00",
            initializationTimestamp: 1
        });
        taskResponse = INewtonProverTaskManager.TaskResponse({
            taskId: task.taskId,
            policyClient: address(client),
            policyId: policyId,
            policyAddress: address(policy),
            intent: intent,
            intentSignature: hex"11",
            evaluationResult: allowed ? abi.encode(true) : abi.encode(false),
            policyTaskData: NewtonMessage.PolicyTaskData({
                policyId: policyId,
                policyAddress: address(policy),
                policy: hex"",
                policyData: policyData
            }),
            policyConfig: INewtonPolicy.PolicyConfig({policyParams: bytes("{}"), expireAfter: 25}),
            initializationTimestamp: 1
        });
    }
}
