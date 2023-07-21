// SPDX-License-Identifier: MIT
// An example of a consumer contract that relies on a subscription for funding.
pragma solidity ^0.8.7;

import "@chainlink/contracts/src/v0.8/VRFConsumerBaseV2.sol";
import "./VRFCoordinatorV2InterfaceMock.sol";
import "@chainlink/contracts/src/v0.8/AutomationCompatible.sol";

// Errors
error Lottery__NotEnoughFee();
error Lottery__NotEnoughFund();
error Lottery__NotAllowOwnerToJoin();
error Lottery__NotEnoughPlayers(); // num. of players >= 5
error Lottery__TooManyPlayers(); // num. of playres <= 20
error Lottery__TransferFailed();
error Lottery__NotEnoughTimeHasPassed();

contract LotteryMock is VRFConsumerBaseV2, AutomationCompatibleInterface {
    /**State variables */
    // Lottery variables
    uint256 public immutable i_prize; // approx. 1000 Eth = $... Old value: 1000000000000000000000
    address private immutable i_owner;
    uint256 public immutable i_joinFee; // approx. 0.003 Eth = $5... Old value: 3000000000000000
    address[] private s_players;
    uint128 private s_latestRoundNumber = 0;
    uint256 public s_requestId;

    // Chainlink VRF variables
    VRFCoordinatorV2Interface private immutable i_vrfCoordinatorV2Mock;
    uint64 private immutable i_subscriptionId;
    bytes32 private immutable i_gasLane;
    uint32 private immutable i_callbackGasLimit;
    uint32 constant NUM_WORDS = 1;
    uint16 constant MINIMUM_REQUEST_CONFIRMATIONS = 3;
    uint256[] private s_randomWords;

    // Chainlink UpKeep variables
    uint256 private s_lastTimeStamp;
    uint256 private immutable i_upKeepInterval;

    // Events
    event LotteryFunded(address funder, uint256 amount); // emits whenever someone funds money into the lottery
    event PlayerJoined(address player); // emits whenever someone joins the lottery
    event PrizeDismissed(uint8 prizeRanking); // emits if a prize has no winner
    event PrizeWon(address winner, uint8 prizeRanking); // emits whenever someone wins a prize
    event PrizeAwarded(address winner, uint8 prizeRanking, uint256 amount); // emits whenever someone gets awarded for the prize they had won
    event LotteryRoundStarted(uint128 roundNumber, uint256 timestamp);
    event LotteryRoundEnded(uint128 roundNumber, uint256 timestamp);
    event UpKeepTriggered(uint128 roundNumber, uint256 timestamp);
    event ReturnedRandomness(uint256[] randomWords);

    // Modifiers
    modifier allowedToJoin() {
        if (msg.sender == i_owner) revert Lottery__NotAllowOwnerToJoin();
        if (msg.value < i_joinFee) revert Lottery__NotEnoughFee(); // Note: To ensure fairness for the players, no players is allowed to join until the owner of this contract has funded enough i_prize amount;
        if (address(this).balance < i_prize) revert Lottery__NotEnoughFund();
        if (getNumberOfPlayers() > 20) revert Lottery__TooManyPlayers();
        _;
    }

    modifier onlyOwner() {
        require(msg.sender == i_owner);
        _;
    }

    // Functions
    fallback() external payable {
        fund();
    }

    receive() external payable {
        fund();
    }

    /**Note: On deployment, the contract can have balance = 0. But it won't allow any player to join untill it has been funded with i_prize amount*/
    constructor(
        uint256 _prize,
        uint256 _joinFee,
        address _vrfCoordinatorV2MockAddress,
        bytes32 _gasLane,
        uint64 _subscriptionId,
        uint32 _callbackGasLimit,
        uint256 _upKeepInterval
    ) payable VRFConsumerBaseV2(_vrfCoordinatorV2MockAddress) {
        s_lastTimeStamp = block.timestamp;
        emit LotteryRoundStarted(s_latestRoundNumber, s_lastTimeStamp);
        i_owner = msg.sender;
        i_prize = _prize;
        i_joinFee = _joinFee;
        i_gasLane = _gasLane;
        // i_subscriptionId = _subscriptionId;
        i_callbackGasLimit = _callbackGasLimit;
        i_upKeepInterval = _upKeepInterval;
        i_vrfCoordinatorV2Mock = VRFCoordinatorV2Interface(
            _vrfCoordinatorV2MockAddress
        );

        i_subscriptionId = i_vrfCoordinatorV2Mock.createSubscription();
        i_vrfCoordinatorV2Mock.addConsumer(i_subscriptionId, address(this));
    }

    /**In a mock contract, we don't need use this function because it was meant to be called by Chainlink Automation Service. But they don't exist on a local blockchain ¯\_(ツ)_/¯*/
    function checkUpkeep(
        bytes calldata /* checkData */
    )
        external
        view
        override
        returns (bool upkeepNeeded, bytes memory /* performData */)
    {
        bool enoughTimeHasPassed = (block.timestamp - s_lastTimeStamp) >
            i_upKeepInterval;
        bool hasEnoughPlayers = getNumberOfPlayers() >= 5;
        bool hasTooManyPlayers = getNumberOfPlayers() > 20;
        bool hasEnoughFund = address(this).balance >= i_prize;
        bool upKeepNeeded = (enoughTimeHasPassed &&
            hasEnoughPlayers &&
            !hasTooManyPlayers &&
            hasEnoughFund);

        // We don't use the checkData in this example. The checkData is defined when the Upkeep was registered.
        return (upKeepNeeded, abi.encodePacked(upKeepNeeded));
    }

    function performUpkeep(bytes calldata /* performData */) external override {
        //We highly recommend re-validating the upkeep in the performUpkeep function
        bool enoughTimeHasPassed = (block.timestamp - s_lastTimeStamp) >
            i_upKeepInterval;
        if (!enoughTimeHasPassed) revert Lottery__NotEnoughTimeHasPassed();
        bool hasEnoughPlayers = getNumberOfPlayers() >= 5;
        if (!hasEnoughPlayers) revert Lottery__NotEnoughPlayers();
        bool hasTooManyPlayers = getNumberOfPlayers() > 20;
        if (hasTooManyPlayers) revert Lottery__TooManyPlayers();
        bool hasEnoughFund = address(this).balance >= i_prize;
        if (!hasEnoughFund) revert Lottery__NotEnoughFund();

        emit UpKeepTriggered(s_latestRoundNumber, block.timestamp);
        // We have to fund the Automation subscription with some fake Link token before we requestRandomWords()
        i_vrfCoordinatorV2Mock.fundSubscription(i_subscriptionId, 1000000000000000000000);
        s_requestId = i_vrfCoordinatorV2Mock.requestRandomWords(
            i_gasLane,
            i_subscriptionId,
            MINIMUM_REQUEST_CONFIRMATIONS,
            i_callbackGasLimit,
            NUM_WORDS
        );
        // We don't use the performData in this example. The performData is generated by the Automation Node's call to your checkUpkeep function
    }


    function join() external payable allowedToJoin {
        s_players.push(msg.sender);
    }

    /**Note: anyone can voluntarily fund money into the lottery */
    function fund() public payable {
        emit LotteryFunded(msg.sender, msg.value);
    }

    function getPlayer(uint256 index) external view returns (address) {
        return s_players[index];
    }

    function getMaximumNumberOfPlayers() external pure returns (uint8) {
        return 20;
    }

    function getMinimumNumberOfPlayers() external pure returns (uint8) {
        return 5;
    }

    function getRoundNumber() external view returns (uint128) {
        return s_latestRoundNumber;
    }

    function getNumberOfPlayers() public view returns (uint8) {
        return uint8(s_players.length);
    }

    /**
     * @notice Requests randomness
     * Assumes the subscription is funded sufficiently; "Words" refers to unit of data in Computer Science
     */
    function requestRandomWords() external onlyOwner {
        // Will revert if subscription is not set and funded.
        s_requestId = i_vrfCoordinatorV2Mock.requestRandomWords(
            i_gasLane,
            i_subscriptionId,
            MINIMUM_REQUEST_CONFIRMATIONS,
            i_callbackGasLimit,
            NUM_WORDS
        );
    }

    /**
     * @notice Callback function used by VRF Coordinator
     *
     * @param  - id of the request
     * @param randomWords - array of random results from VRF Coordinator
     */
    function fulfillRandomWords(
        uint256 /* requestId */,
        uint256[] memory randomWords
    ) internal override {
        s_randomWords = randomWords;
        emit ReturnedRandomness(randomWords);
    }

    function countDigits(uint256 x) private pure returns (uint8) {
        uint8 r = 0;
        do {
            x /= 10;
            if (0 == x) break;
            r++;
        } while (true);
        return r;
    }

    function wordsToIndexes(
        uint256[] memory randomWords,
        uint8 multiplier
    ) private pure returns (uint256[] memory) {
        for (uint8 i = 0; i < randomWords.length; i++) {
            randomWords[i] = randomWords[i] % (10 * multiplier);
        }
        return randomWords;
    }

    function findAndAwardWinner(
        uint8 prizeRanking,
        address[] memory players,
        uint256 index,
        uint256 amount
    ) private {
        if (index >= players.length) {
            // Player not found
            emit PrizeDismissed(prizeRanking);
        } else {
            // Player is found
            address winner = players[index];
            emit PrizeWon(winner, prizeRanking);
            (bool callSuccess, ) = payable(winner).call{value: amount}("");
            if (!callSuccess) {
                revert Lottery__TransferFailed();
            } else {
                emit PrizeAwarded(winner, prizeRanking, amount);
            }
        }
    }
}
