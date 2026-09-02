// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.27;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {INewtonProverTaskManager} from "newton-contracts/src/interfaces/INewtonProverTaskManager.sol";
import {NewtonMessage} from "newton-contracts/src/core/NewtonMessage.sol";
import {NewtonPolicyClient} from "newton-contracts/src/mixins/NewtonPolicyClient.sol";

/// @title DirectERC20TransferPolicyClient
/// @notice Canonical narrow wrapper: execute an ERC-20 transfer after direct Newton validation.
/// @dev Deploy first, then have `policyClientOwner` call inherited `setPolicy`.
///      `setPolicy` cannot run in this constructor because NewtonPolicy verifies
///      the caller's ERC-165 interface, and a contract has no runtime code during construction.
contract DirectERC20TransferPolicyClient is NewtonPolicyClient {
    using SafeERC20 for IERC20;

    error InvalidIntentTarget(address expected, address actual);
    error InvalidIntentValue(uint256 value);
    error InvalidFunctionSignature();
    error InvalidCalldata();
    error InvalidSelector(bytes4 expected, bytes4 actual);
    error IntentArgumentsMismatch();
    error PolicyDenied();

    IERC20 public immutable token;

    event ProtectedTransfer(address indexed sender, address indexed recipient, uint256 amount);

    constructor(
        address token_,
        address policyTaskManager_,
        address policy_,
        address policyClientOwner_
    ) {
        require(token_ != address(0) && policyTaskManager_ != address(0) && policy_ != address(0));
        require(policyClientOwner_ != address(0));

        token = IERC20(token_);
        _initNewtonPolicyClient(policyTaskManager_, policyClientOwner_);
        _setPolicyAddress(policy_);
    }

    /// @notice Transfer the configured token using a directly verified Newton policy response.
    /// @dev The intent describes downstream ERC-20 `transfer(recipient, amount)`.
    ///      `functionSignature` must match `policy scaffold` / Rego
    ///      `decoded_function_signature` (named parameters). This wrapper
    ///      executes `transferFrom(msg.sender, recipient, amount)`, so the
    ///      sender must approve the wrapper first.
    function transferWithAttestation(
        address recipient,
        uint256 amount,
        INewtonProverTaskManager.Task calldata task,
        INewtonProverTaskManager.TaskResponse calldata taskResponse,
        bytes calldata signatureData
    ) external {
        NewtonMessage.Intent calldata intent = taskResponse.intent;

        require(intent.to == address(token), InvalidIntentTarget(address(token), intent.to));
        require(intent.value == 0, InvalidIntentValue(intent.value));
        require(
            keccak256(intent.functionSignature)
                == keccak256(bytes("function transfer(address recipient, uint256 amount)")),
            InvalidFunctionSignature()
        );
        require(intent.data.length == 68, InvalidCalldata());

        bytes4 selector = bytes4(intent.data[:4]);
        require(selector == IERC20.transfer.selector, InvalidSelector(IERC20.transfer.selector, selector));

        (address attestedRecipient, uint256 attestedAmount) = abi.decode(intent.data[4:], (address, uint256));
        require(attestedRecipient == recipient && attestedAmount == amount, IntentArgumentsMismatch());

        require(_validateAttestationDirect(task, taskResponse, signatureData), PolicyDenied());

        token.safeTransferFrom(msg.sender, recipient, amount);
        emit ProtectedTransfer(msg.sender, recipient, amount);
    }
}
