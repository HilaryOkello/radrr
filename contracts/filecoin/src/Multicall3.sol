// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;

/// @title Multicall3
/// @notice Aggregate results from multiple function calls
/// @dev Deployed to match the interface of 0xcA11bde05977b3631167028862bE2a173976CA11
/// @author Michael Elliot <mike@makerdao.com>
/// @author Joshua Levine <joshua@makerdao.com>
/// @author Nick Johnson <arachnid@notdot.net>
/// @author Andreas Bigger <andreas@nascent.xyz>
/// @author Matt Solomon <matt@mattsolomon.dev>
contract Multicall3 {
    struct Call {
        address target;
        bytes callData;
    }

    struct Call3 {
        address target;
        bool allowFailure;
        bytes callData;
    }

    struct Call3Value {
        address target;
        bool allowFailure;
        uint256 value;
        bytes callData;
    }

    struct Result {
        bool success;
        bytes returnData;
    }

    function aggregate(Call[] calldata calls) public payable returns (uint256 blockNumber, bytes[] memory returnData) {
        blockNumber = block.number;
        uint256 length = calls.length;
        returnData = new bytes[](length);
        Call calldata call;
        for (uint256 i = 0; i < length; ) {
            bool success;
            call = calls[i];
            (success, returnData[i]) = call.target.call(call.callData);
            require(success, "Multicall3: call failed");
            unchecked { ++i; }
        }
    }

    function tryAggregate(bool requireSuccess, Call[] calldata calls) public payable returns (Result[] memory returnData) {
        uint256 length = calls.length;
        returnData = new Result[](length);
        Call calldata call;
        for (uint256 i = 0; i < length; ) {
            Result memory result = returnData[i];
            call = calls[i];
            (result.success, result.returnData) = call.target.call(call.callData);
            if (requireSuccess) require(result.success, "Multicall3: call failed");
            unchecked { ++i; }
        }
    }

    function tryBlockAndAggregate(bool requireSuccess, Call[] calldata calls) public payable returns (uint256 blockNumber, bytes32 blockHash, Result[] memory returnData) {
        blockNumber = block.number;
        blockHash = blockhash(block.number - 1);
        returnData = tryAggregate(requireSuccess, calls);
    }

    function blockAndAggregate(Call[] calldata calls) public payable returns (uint256 blockNumber, bytes32 blockHash, Result[] memory returnData) {
        (blockNumber, blockHash, returnData) = tryBlockAndAggregate(true, calls);
    }

    function aggregate3(Call3[] calldata calls) public payable returns (Result[] memory returnData) {
        uint256 length = calls.length;
        returnData = new Result[](length);
        for (uint256 i = 0; i < length; ) {
            Result memory result = returnData[i];
            Call3 calldata calli = calls[i];
            bool success;
            (success, result.returnData) = calli.target.call(calli.callData);
            if (!calli.allowFailure && !success) {
                revert("Multicall3: call failed");
            }
            result.success = success;
            unchecked { ++i; }
        }
    }

    function aggregate3Value(Call3Value[] calldata calls) public payable returns (Result[] memory returnData) {
        uint256 valAccumulator;
        uint256 length = calls.length;
        returnData = new Result[](length);
        for (uint256 i = 0; i < length; ) {
            Result memory result = returnData[i];
            Call3Value calldata calli = calls[i];
            uint256 val = calli.value;
            unchecked { valAccumulator += val; }
            bool success;
            (success, result.returnData) = calli.target.call{value: val}(calli.callData);
            if (!calli.allowFailure && !success) {
                revert("Multicall3: call failed");
            }
            result.success = success;
            unchecked { ++i; }
        }
        require(msg.value == valAccumulator, "Multicall3: value mismatch");
    }

    function getBlockHash(uint256 blockNumber) public view returns (bytes32 blockHash) {
        blockHash = blockhash(blockNumber);
    }

    function getBlockNumber() public view returns (uint256 blockNumber) {
        blockNumber = block.number;
    }

    function getCurrentBlockCoinbase() public view returns (address coinbase) {
        coinbase = block.coinbase;
    }

    function getCurrentBlockGasLimit() public view returns (uint256 gaslimit) {
        gaslimit = block.gaslimit;
    }

    function getCurrentBlockTimestamp() public view returns (uint256 timestamp) {
        timestamp = block.timestamp;
    }

    function getEthBalance(address addr) public view returns (uint256 balance) {
        balance = addr.balance;
    }

    function getLastBlockHash() public view returns (bytes32 blockHash) {
        unchecked { blockHash = blockhash(block.number - 1); }
    }

    function getBasefee() public view returns (uint256 basefee) {
        basefee = block.basefee;
    }

    function getChainId() public view returns (uint256 chainid) {
        chainid = block.chainid;
    }
}
