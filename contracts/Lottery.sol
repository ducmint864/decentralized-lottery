// SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

// Errors
error NotEnoughMoney();
error NotOwner();

contract Lottery {
    /* State variables */
    uint256 public constant JOIN_FEE = 3000000000000000; // approx. $5
    uint256 public immutable PRIZE;
    address immutable OWNER;
    address[] private s_players;
    
    // Modifiers
    modifier joinFeeReached() {
        if (msg.value < JOIN_FEE)
            revert NotEnoughMoney();
        _;
    }

    modifier onlyOwner() {
        if (msg.sender != OWNER)
            revert NotOwner();
        _;
    }

    // Functions
    fallback() external payable {
        join();
    }
    receive() external payable {
        join();
    }

    constructor(uint256 _prize) {
        PRIZE = _prize;
        OWNER = msg.sender;
    }

    function join() public payable joinFeeReached {
        s_players.push(msg.sender);
    }

    function getPlayer(uint256 index) external view returns (address) {
        return s_players[index];
    }

    function getNumberOfPlayers() external view returns (uint256) {
        return s_players.length;
    }

    function getWinner() private view onlyOwner returns (address) {
        // get random index
    }
}