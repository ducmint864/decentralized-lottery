// SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

import "@chainlink/contracts/src/v0.8/VRFConsumerBaseV2.sol";
import "./VRFCoordinatorV2InterfaceMock.sol";
import "@chainlink/contracts/src/v0.8/AutomationCompatible.sol";

// Errors
error Lottery__NotOwner();
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
    uint256 private immutable i_prize; // approx. 1000 Eth = $... Old value: 1000000000000000000000
    address private immutable i_owner;
    uint256 private immutable i_joinFee; // approx. 0.003 Eth = $5... Old value: 3000000000000000
    address[] private s_players;
    uint128 private s_roundNumber = 1;
    uint8 private constant MINIMUM_NUMBER_OF_PLAYERS = 10;
    uint8 private constant MAXIMUM_NUMBER_OF_PLAYERS = 30;

    // Chainlink VRF variables
    VRFCoordinatorV2Interface private immutable i_vrfCoordinatorV2Mock;
    uint64 private immutable i_subscriptionId;
    bytes32 private immutable i_gasLane;
    uint32 private immutable i_callbackGasLimit;
    uint32 private constant NUM_WORDS = 3;
    uint16 private constant MINIMUM_REQUEST_CONFIRMATIONS = 3;
    uint256 private s_requestId;
    uint256[] private s_randomWords;

    // Chainlink UpKeep variables
    uint256 private s_lastTimeStamp;
    uint256 private immutable i_upKeepInterval;

    /**Events */
    event LotteryFunded(address funder, uint256 amount); // emits whenever someone funds money into the lottery
    event PlayerJoined(address player); // emits whenever someone joins the lottery
    event PrizeDismissed(uint8 prizeRanking); // emits if a prize has no winner
    event PrizeWon(address winner, uint8 prizeRanking); // emits whenever someone wins a prize
    event PrizeAwarded(address winner, uint8 prizeRanking, uint256 amount); // emits whenever someone gets awarded for the prize they had won
    event LotteryRoundStarted(uint128 roundNumber, uint256 timestamp);
    event LotteryRoundEnded(uint128 roundNumber, uint256 timestamp);
    event UpKeepTriggered(uint128 roundNumber, uint256 timestamp);
    event RandomWordsFulfilled(uint256 requestId, uint256[] randomWords);
    event RandomWordsRequested(
        bytes32 gasLane,
        uint64 subscriptionId,
        uint16 MINIMUM_REQUEST_CONFIRMATIONS,
        uint32 callbackGasLimit,
        uint32 NUM_WORDS
    );

    /**Modifiers*/
    modifier allowedToJoin() {
        if (msg.sender == i_owner) revert Lottery__NotAllowOwnerToJoin();
        if (msg.value < i_joinFee) revert Lottery__NotEnoughFee(); // Note: To ensure fairness for the players, no players is allowed to join until the owner of this contract has funded enough i_prize amount;
        if (address(this).balance < (i_prize + 1 ether))
            revert Lottery__NotEnoughFund(); // Note: Why "+ 1 ether"? Because the contract enforce the fund to exceed i_prize by 1 Ether in to compensate for the txFees when transferring Eth to the winners. Ưhen the Lottery's closed, the remaining balance will be refunded to the owner.
        if (getNumberOfPlayers() >= MAXIMUM_NUMBER_OF_PLAYERS)
            revert Lottery__TooManyPlayers();
        _;
    }

    modifier onlyOwner() {
        require(msg.sender == i_owner);
        _;
    }

    /**Functions */
    fallback() external payable {
        fund();
    }

    receive() external payable {
        fund();
    }

    //Note: On deployment, the contract can have balance = 0. But it won't allow any player to join untill it has been funded with i_prize amount
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
        emit LotteryRoundStarted(s_roundNumber, s_lastTimeStamp);
        i_owner = msg.sender;
        i_prize = _prize;
        i_joinFee = _joinFee;
        i_gasLane = _gasLane;
        i_subscriptionId = _subscriptionId;
        i_callbackGasLimit = _callbackGasLimit;
        i_upKeepInterval = _upKeepInterval;
        i_vrfCoordinatorV2Mock = VRFCoordinatorV2Interface(
            _vrfCoordinatorV2MockAddress
        );
    }

    //Note: In a mock contract, we don't need use this function because it was meant to be called by Chainlink Automation Service. But they don't exist on a local blockchain ¯\_(ツ)_/¯*/
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
        bool hasEnoughPlayers = getNumberOfPlayers() >= 10;
        bool hasEnoughFund = address(this).balance >= (i_prize + 1 ether);
        bool upKeepNeeded = (enoughTimeHasPassed &&
            hasEnoughPlayers &&
            hasEnoughFund);

        // We don't use the checkData in this example. The checkData is defined when the Upkeep was registered.
        return (upKeepNeeded, abi.encodePacked(upKeepNeeded));
    }

    function performUpkeep(bytes calldata /* performData */) external override {
        //We highly recommend re-validating the upkeep in the performUpkeep function
        bool enoughTimeHasPassed = (block.timestamp - s_lastTimeStamp) >
            i_upKeepInterval;
        if (!enoughTimeHasPassed) revert Lottery__NotEnoughTimeHasPassed();

        bool hasEnoughPlayers = getNumberOfPlayers() >=
            MINIMUM_NUMBER_OF_PLAYERS;
        if (!hasEnoughPlayers) revert Lottery__NotEnoughPlayers();

        bool hasEnoughFund = address(this).balance >= (i_prize + 1 ether);
        if (!hasEnoughFund) revert Lottery__NotEnoughFund();

        emit UpKeepTriggered(s_roundNumber, block.timestamp);

        // In the mock contract, we have to fund the Automation subscription with some fake Link token before we requestRandomWords()
        i_vrfCoordinatorV2Mock.fundSubscription(
            i_subscriptionId,
            1000000000000000000000
        );

        s_requestId = i_vrfCoordinatorV2Mock.requestRandomWords(
            i_gasLane,
            i_subscriptionId,
            MINIMUM_REQUEST_CONFIRMATIONS,
            i_callbackGasLimit,
            NUM_WORDS
        );

        emit RandomWordsRequested(
            i_gasLane,
            i_subscriptionId,
            MINIMUM_REQUEST_CONFIRMATIONS,
            i_callbackGasLimit,
            NUM_WORDS
        );
        // We don't use the performData in this example. The performData is generated by the Automation Node's call to your checkUpkeep function
    }

    // Note: this function only exists in the LotteryMock contract
    function requestRandomWords() external {
        // In the mock contract, we have to fund the Automation subscription with some fake Link token before we requestRandomWords()
        i_vrfCoordinatorV2Mock.fundSubscription(
            i_subscriptionId,
            1000000000000000000000
        );

        s_requestId = i_vrfCoordinatorV2Mock.requestRandomWords(
            i_gasLane,
            i_subscriptionId,
            MINIMUM_REQUEST_CONFIRMATIONS,
            i_callbackGasLimit,
            NUM_WORDS
        );

        emit RandomWordsRequested(
            i_gasLane,
            i_subscriptionId,
            MINIMUM_REQUEST_CONFIRMATIONS,
            i_callbackGasLimit,
            NUM_WORDS
        );
    }

    function join() external payable allowedToJoin {
        s_players.push(msg.sender);
    }

    function fund() public payable {
        //Note: anyone can voluntarily fund money into the lottery
        emit LotteryFunded(msg.sender, msg.value);
    }

    // Getter functions
    function getPlayer(uint256 index) external view returns (address) {
        return s_players[index];
    }

    function getMaximumNumberOfPlayers() external pure returns (uint8) {
        return MAXIMUM_NUMBER_OF_PLAYERS;
    }

    function getMinimumNumberOfPlayers() external pure returns (uint8) {
        return MINIMUM_NUMBER_OF_PLAYERS;
    }

    function getRoundNumber() external view returns (uint128) {
        return s_roundNumber;
    }

    function getNumberOfPlayers() public view returns (uint8) {
        return uint8(s_players.length);
    }

    function getOwner() external view returns (address) {
        return i_owner;
    }

    function getPrize() external view returns (uint256) {
        return i_prize;
    }

    function getJoinFee() external view returns (uint256) {
        return i_joinFee;
    }

    // Note: this function only exists in the LotteryMock contract
    function getRequestId() external view returns (uint256) {
        return s_requestId;
    }

    function getVRFCoordinatorV2()
        external
        view
        returns (VRFCoordinatorV2Interface)
    {
        return i_vrfCoordinatorV2Mock;
    }

    function getSubscriptionId() external view returns (uint64) {
        return i_subscriptionId;
    }

    function getGaslane() external view returns (bytes32) {
        return i_gasLane;
    }

    function getCallbackGasLimit() external view returns (uint32) {
        return i_callbackGasLimit;
    }

    function getNumberOfWords() external pure returns (uint32) {
        return NUM_WORDS;
    }

    function getMinumRequestConfirmations() external pure returns (uint16) {
        return MINIMUM_REQUEST_CONFIRMATIONS;
    }

    function getRandomWord(uint32 index) external view returns (uint256) {
        // Note: this function only exists in the mock contract
        return s_randomWords[index];
    }

    function getUpKeepInterval() external view returns (uint256) {
        return i_upKeepInterval;
    }

    function getLastTimeStamp() external view returns (uint256) {
        return s_lastTimeStamp;
    }

    // Other functions
    function countDigits(uint256 x) public pure returns (uint8) {
        if (x < 10) return 1;
        uint8 c = 0;
        while (x > 0) {
            c++;
            x /= 10;
        }
        return c;
    }

    function wordsToIndexes(
        uint256[] memory randomWords,
        uint8 digits
    ) public pure returns (uint256[] memory) {
        for (uint8 i = 0; i < randomWords.length; i++) {
            randomWords[i] = randomWords[i] % (10 ** digits);
        }
        return randomWords;
    }

    function findAndAwardWinner(
        uint8 prizeRanking,
        address[] memory players,
        uint256 index,
        uint256 amount
    ) public {
        if (index >= players.length) {
            // Player not found
            emit PrizeDismissed(prizeRanking);
        } else {
            // Player is found
            address winner = players[index];
            emit PrizeWon(winner, prizeRanking);
            (bool callSuccess, ) = payable(winner).call{value: amount}("");
            if (callSuccess == false) {
                revert Lottery__TransferFailed();
            } else {
                emit PrizeAwarded(winner, prizeRanking, amount);
            }
        }
    }

    // This is a mandatory call-back function: when the 3 random words are generated, go find and award the winner
    function fulfillRandomWords(
        uint256 requestId,
        uint256[] memory randomWords
    ) internal override {
        emit RandomWordsFulfilled(requestId, randomWords);

        // Reduce the the arbitary uint256 values of randomWords into a useable value
        uint8 digitsCount = countDigits(getNumberOfPlayers());
        s_randomWords = wordsToIndexes(randomWords, digitsCount);

        address[] memory players = s_players;

        // Find and award the winner of 1st prize
        findAndAwardWinner(1, players, randomWords[0], ((i_prize * 3) / 5));

        // Find and award the winner of 2nd prize
        findAndAwardWinner(2, players, randomWords[1], (i_prize * 3) / 10);

        // Find and award the winner of 3rd prize
        findAndAwardWinner(3, players, randomWords[2], (i_prize * 1) / 10);

        // Clean up and prepare for new round
        s_players = new address[](0);
        s_randomWords = new uint256[](0);
        s_lastTimeStamp = block.timestamp;
        emit LotteryRoundEnded(s_roundNumber, s_lastTimeStamp);
        s_roundNumber++;
    }

    //Note: This function is intended to by used by the owner only, it will immediately end the lottery and refund the remaining balance to the owner
    function closeLottery() external onlyOwner {
        // Do not allow the owner to end the lottery when there's still players engaged
        require(
            getNumberOfPlayers() == 0,
            "There's still players in the lottery session"
        );

        (bool callSuccess, ) = payable(address(i_owner)).call{
            value: address(this).balance
        }("");
        if (!callSuccess) revert Lottery__TransferFailed();
    }

    // Note: this function is only available in the mock contract
    // This function is used refund the join fee to all the players in s_players array and then clear that array
    // This function should be called before closeLottery()
    function clearPlayers() external onlyOwner {
        address[] memory players = s_players;
        for (uint i = 0; i < players.length; i++) {
            (bool callSuccess, ) = payable(players[i]).call{value: i_joinFee}(
                ""
            );
            if (!callSuccess) revert Lottery__TransferFailed();
        }
        s_players = new address[](0);
    }

    // Note: this function number is only available in the mock contract
    function testWordsToIndexes(uint256[] memory words, uint8 digits) external pure returns (uint256[] memory) {
        words = wordsToIndexes(words, digits);
        return words;
    }

    function getBlockTimestamp() external view returns(uint256) {
        return block.timestamp;
    }
}
