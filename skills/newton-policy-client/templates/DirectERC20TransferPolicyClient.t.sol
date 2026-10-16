// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.27;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {INewtonPolicy} from "newton-contracts/src/interfaces/INewtonPolicy.sol";
import {INewtonPolicyClient} from "newton-contracts/src/interfaces/INewtonPolicyClient.sol";
import {INewtonProverTaskManager} from "newton-contracts/src/interfaces/INewtonProverTaskManager.sol";
import {NewtonMessage} from "newton-contracts/src/core/NewtonMessage.sol";
import {DirectERC20TransferPolicyClient} from "../src/DirectERC20TransferPolicyClient.sol";

/// @notice Adversarial suite for the golden ERC-20 wrapper.
/// @dev Copy to `test/DirectERC20TransferPolicyClient.t.sol` (contract → `src/`).
///      Mocks are application-level: they record spent task IDs and honor
///      `allowed`. Do not invent BLS signatures.

contract MockERC20 is ERC20 {
    constructor() ERC20("Mock USD", "mUSD") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

/// @dev Factory registry check used by `NewtonPolicyClient.setPolicies`.
contract MockPolicyFactory {
    mapping(address => bool) public registered;

    function register(address policy) external {
        registered[policy] = true;
    }

    function isPolicy(address policy) external view returns (bool) {
        return registered[policy];
    }
}

/// @dev Application-level TaskManager: records spent task IDs and honors `allowed`.
contract MockTaskManager {
    error AlreadySpent();
    error StaleResponse();

    uint32 public taskResponseWindowBlock = 100;
    MockPolicyFactory public immutable factory;
    mapping(bytes32 => bool) public spent;

    constructor(MockPolicyFactory factory_) {
        factory = factory_;
    }

    function policyFactory() external view returns (address) {
        return address(factory);
    }

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
        return taskResponse.allowed;
    }
}

contract DirectERC20TransferPolicyClientTest is Test {
    bytes internal constant TRANSFER_SIGNATURE =
        bytes("function transfer(address recipient, uint256 amount)");

    MockERC20 internal token;
    MockPolicyFactory internal factory;
    MockTaskManager internal taskManager;
    DirectERC20TransferPolicyClient internal client;
    address internal policy = address(0xBEEF);

    address internal owner = address(0xA11CE);
    address internal sender = address(0xB0B);
    address internal recipient = address(0xCAFE);
    uint256 internal amount = 10_000e6;
    bytes32 internal policyId;

    function setUp() public {
        token = new MockERC20();
        factory = new MockPolicyFactory();
        factory.register(policy);
        taskManager = new MockTaskManager(factory);
        client = new DirectERC20TransferPolicyClient(address(token), address(taskManager), owner);

        INewtonPolicyClient.PolicySpec[] memory specs = new INewtonPolicyClient.PolicySpec[](1);
        specs[0] = INewtonPolicyClient.PolicySpec({
            policy: policy,
            config: INewtonPolicy.PolicyConfig({policyParams: bytes("{}"), expireAfter: 25})
        });
        vm.prank(owner);
        policyId = client.setPolicies(specs);

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

        INewtonPolicyClient.PolicySpec[] memory specs = new INewtonPolicyClient.PolicySpec[](1);
        specs[0] = INewtonPolicyClient.PolicySpec({
            policy: policy,
            config: INewtonPolicy.PolicyConfig({policyParams: bytes("{}"), expireAfter: 25})
        });
        bytes[] memory wasmArgs = new bytes[](1);
        NewtonMessage.PolicyData[] memory oracleData;
        NewtonMessage.PolicyTaskData[] memory policyTaskData = new NewtonMessage.PolicyTaskData[](1);
        policyTaskData[0] = NewtonMessage.PolicyTaskData({
            policyId: policyId,
            policyAddress: policy,
            policy: hex"",
            policyData: oracleData
        });
        task = INewtonProverTaskManager.Task({
            taskId: keccak256("task-1"),
            policyClient: address(client),
            policyId: policyId,
            policyRevision: client.policyRevision(),
            taskCreatedBlock: createdBlock,
            quorumThresholdPercentage: 100,
            intent: intent,
            intentSignature: hex"11",
            policies: specs,
            wasmArgs: wasmArgs,
            quorumNumbers: hex"00",
            initializationTimestamp: 1
        });
        taskResponse = INewtonProverTaskManager.TaskResponse({
            taskId: task.taskId,
            policyClient: address(client),
            policyId: policyId,
            intent: intent,
            intentSignature: hex"11",
            allowed: allowed,
            policyTaskData: policyTaskData,
            initializationTimestamp: 1
        });
    }
}
