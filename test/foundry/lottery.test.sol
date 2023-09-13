// SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

import "../../lib/forge-std/src/Test.sol";
import "../../contracts/Lottery.sol";

// Test will be deployed to 0xb4c79daB8f259C7Aee6E5b2Aa729821864227e84

contract TestLottery is Test, Lottery {
    Lottery lottery;

    address constant VRF_COORDINATOR_ADDRESS =
        0x7a1BaC17Ccc5b313516C5E16fb24f7659aA5ebed;
    bytes32 constant VRF_GAS_LANE =
        0x4b09e658ed251bcafeebbc69400383d49f344ace09b9576fe248bb02c003fe9f;
    uint64 constant VRF_SUBSCRIPTION_ID = 5555;
    address constant LINK_ADDRESS = 0x326C977E6efc84E512bB9C30f76E30c160eD06FB;
    uint256 constant PRIZE = 0.01 ether;
    uint256 constant ENSURE = 0.1 ether;
    uint256 constant JOIN_FEE = 0 ether;
    uint32 constant CALL_BACK_GAS_LIMIT = 2500000 wei;
    uint256 constant UP_KEEP_INTERVAL = 60;

    // similar to beforeEach() in hardhat tests
    constructor()
        Lottery(
            PRIZE,
            ENSURE,
            JOIN_FEE,
            VRF_COORDINATOR_ADDRESS,
            VRF_GAS_LANE,
            VRF_SUBSCRIPTION_ID,
            CALL_BACK_GAS_LIMIT,
            UP_KEEP_INTERVAL
        )
    {
    }

    function setUp() public {
    }

    function test_countDigits(uint8 power, uint256 fuzzNumber) public {
        vm.assume(power >=0);
        vm.assume(power <= 3);
        vm.assume(fuzzNumber >= 10**power);
        vm.assume(fuzzNumber < 10**(power + 1));
        assertEq(countDigits(fuzzNumber), power + 1);
    }

    function test_wordsToIndexes(uint256[] memory fuzz) public {
        uint8 digitsCount = countDigits(MAXIMUM_NUMBER_OF_PLAYERS);
        uint256[] memory indexes = wordsToIndexes(fuzz, digitsCount);
        for (uint i = 0; i < indexes.length; i++) {
            assertGe(indexes[i], 0);
            assertLe(indexes[i], 10**digitsCount);
        }
    }

    // Prefix testFail_: the test will fail if this function doesn't revert
    // function testFail_pleaseRevert() public {
    //     secret -= 43;
    //     vm.expectRevert(stdError.arithmeticError);
    // }
}
