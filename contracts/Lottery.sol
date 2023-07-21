// SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

import "@chainlink/contracts/src/v0.8/VRFConsumerBaseV2.sol";
import "@chainlink/contracts/src/v0.8/interfaces/VRFCoordinatorV2Interface.sol";
import "@chainlink/contracts/src/v0.8/interfaces/LinkTokenInterface.sol";
import "@chainlink/contracts/src/v0.8/AutomationCompatible.sol";

// Errors
error Lottery__NotEnoughFee();
error Lottery__NotEnoughFund();
error Lottery__NotAllowOwnerToJoin();
error Lottery__NotEnoughPlayers(); // num. of players >= 5
error Lottery__TooManyPlayers(); // num. of playres <= 20
error Lottery__TransferFailed();
error Lottery__NotEnoughTimeHasPassed();

contract Lottery is VRFConsumerBaseV2, AutomationCompatibleInterface {
    /* State variables */
    // Lottery variables
    uint256 public immutable i_prize; // approx. 1000 Eth = $... Old value: 1000000000000000000000
    uint256 public immutable i_joinFee; // approx. 0.003 Eth = $5... Old value: 3000000000000000
    address public immutable i_owner;
    address[] private s_players;
    uint128 private s_latestRoundNumber = 0;

    // Chainlink VRF variables
    VRFCoordinatorV2Interface private immutable i_vrfCoordinatorV2;
    bytes32 private immutable i_gasLane; // keyHash
    uint64 private immutable i_subscriptionId;
    uint32 private immutable i_callbackGasLimit;
    uint16 private constant MINIMUM_REQUEST_CONFIRMATIONS = 3;
    uint32 private constant NUM_WORDS = 3;

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

    // Modifiers
    modifier allowedToJoin() {
        if (msg.sender == i_owner) revert Lottery__NotAllowOwnerToJoin();
        if (msg.value < i_joinFee) revert Lottery__NotEnoughFee(); // Note: To ensure fairness for the players, no players is allowed to join until the owner of this contract has funded enough i_prize amount;
        if (address(this).balance < i_prize) revert Lottery__NotEnoughFund();
        if (getNumberOfPlayers() > 20) revert Lottery__TooManyPlayers();
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
        address _vrfCoordinatorV2Address,
        bytes32 _gasLane,
        uint64 _subscriptionId,
        uint32 _callbackGasLimit,
        uint256 _upKeepInterval
    ) payable VRFConsumerBaseV2(_vrfCoordinatorV2Address) {
        s_lastTimeStamp = block.timestamp;
        emit LotteryRoundStarted(s_latestRoundNumber, s_lastTimeStamp);
        i_owner = msg.sender;
        i_prize = _prize;
        i_joinFee = _joinFee;
        i_gasLane = _gasLane;
        i_subscriptionId = _subscriptionId;
        i_callbackGasLimit = _callbackGasLimit;
        i_upKeepInterval = _upKeepInterval;

        /** Initialize an instance of deployed VRFCoordinatorV2Mock contract */
        // 1.
        i_vrfCoordinatorV2 = VRFCoordinatorV2Interface(
            _vrfCoordinatorV2Address
        );
    }

    function checkUpkeep(
        bytes calldata /* checkData */
    )
        external
        view
        override
        returns (bool upkeepNeeded, bytes memory /* performData */)
    {
        bool enoughTimeHasPassed = (block.timestamp - s_lastTimeStamp) > i_upKeepInterval;
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
        bool enoughTimeHasPassed = (block.timestamp - s_lastTimeStamp) > i_upKeepInterval;
        if (!enoughTimeHasPassed) revert Lottery__NotEnoughTimeHasPassed();
        bool hasEnoughPlayers = getNumberOfPlayers() >= 5;
        if (!hasEnoughPlayers) revert Lottery__NotEnoughPlayers();
        bool hasTooManyPlayers = getNumberOfPlayers() > 20;
        if (hasTooManyPlayers) revert Lottery__TooManyPlayers();
        bool hasEnoughFund = address(this).balance >= i_prize;
        if (!hasEnoughFund) revert Lottery__NotEnoughFund();
        // bool upKeepNeeded = (enoughTimeHasPassed && hasEnoughPlayers && !hasTooManyPlayers && hasEnoughFund);

        // if (upKeepNeeded) {
        emit UpKeepTriggered(s_latestRoundNumber, block.timestamp);
        uint256 requestId = i_vrfCoordinatorV2.requestRandomWords(
            i_gasLane,
            i_subscriptionId,
            MINIMUM_REQUEST_CONFIRMATIONS,
            i_callbackGasLimit,
            NUM_WORDS
        );
        // }
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

    // function getRandomWords(
    //     uint32 numberOfRandomWords
    // ) public onlyOwner returns (uint256[] memory) {
    //     uint256 foo = 69;
    //     uint256 requestId = s_mockContract.requestRandomWords(
    //         bytes32(foo),
    //         s_subId,
    //         1,
    //         100000000,
    //         numberOfRandomWords
    //     );
    //     uint256[] memory randomWords;
    //     randomWords = s_mockContract.fulfillRandomWordsWithOverride(
    //         requestId,
    //         address(this),
    //         randomWords
    //     );
    //     return randomWords;
    // }

    /** 3 words are combined into an index of winner */
    // function getIndexOfWinner() public onlyOwner returns (uint256) {
    //     uint256[] memory randomWords = getRandomWords(3);
    //     uint8 digitCount1 = 0;
    //     uint8 digitCount2 = 0;
    //     uint8 digitCount3 = 0;
    //     uint256 digitSum = 0;

    //     while (randomWords[0] > 0) {
    //         digitCount1++;
    //         digitSum += (randomWords[0] % 10);
    //         randomWords[0] /= 10;
    //     }

    //     while (randomWords[1] > 0) {
    //         digitCount2++;
    //         digitSum += (randomWords[1] % 10);
    //         randomWords[1] /= 10;
    //     }

    //     while (randomWords[2] > 0) {
    //         digitCount3++;
    //         digitSum += (randomWords[2] % 10);
    //         randomWords[2] /= 10;
    //     }

    //     return
    //         digitSum /
    //         (
    //             digitCount1 > digitCount2
    //                 ? (digitCount1 > digitCount3 ? digitCount1 : digitCount3)
    //                 : (digitCount2 > digitCount3 ? digitCount2 : digitCount3)
    //         );
    // }

    // function findAndAwardWinners(
    //     uint8 numberOfWinners,
    //     uint8 prizeRanking,
    //     uint256 amount
    // ) public onlyOwner {
    //     for (uint8 i = 0; i < numberOfWinners; i++) {
    //         uint64 numberOfPlayers = getNumberOfPlayers();
    //         uint256 indexOfWinner = getIndexOfWinner();
    //         if (indexOfWinner >= numberOfPlayers) continue;

    //         address winner = s_players[indexOfWinner];
    //         emit PrizeWon(winner, prizeRanking);
    //         (bool callSuccess, ) = payable(winner).call{value: amount}("");
    //         if (!callSuccess) revert Lottery__TransferFailed();
    //         emit PrizeAwarded(winner, prizeRanking, amount);
    //     }
    // }

    // /** This functions gets called automatically at the end of every round */
    // /** Each round, there are multiple winners (see $project-root/assets/co_cau_giai_thuong.txt)*/
    // function executeAtEndOfRound() public onlyOwner fundedEnoughPrize {
    //     uint256 prize = i_prize;
    //     // Tim va trao thuong 1 giai dac biet
    //     findAndAwardWinners(1, 0, (prize * 5) / 9);
    //     // Tim va trao thuong 1 giai nhat
    //     findAndAwardWinners(1, 1, (prize * 1) / 9);
    //     // Tim va trao thuong 2 giai nhi
    //     findAndAwardWinners(2, 2, (prize * 1) / 18);
    //     // Tim va trao thuong 3 giai ba
    //     findAndAwardWinners(3, 3, (prize * 1) / 36);
    //     // Tim va trao thuong 4 giai khuyen khich
    //     findAndAwardWinners(4, 4, (prize * 1) / 144);
    //     // clean-up for upcoming round
    //     delete s_players;
    // }

    function countDigits(uint256 x) internal pure returns (uint8) {
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
    ) internal pure returns (uint256[] memory) {
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
    ) internal {
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

    /**This is a mandatory call-back function: when the 3 random words are generated, go find and award the winner*/
    function fulfillRandomWords(
        uint256 requestId,
        uint256[] memory randomWords
    ) internal override {
        // Reduce the the arbitary uint256 values of randomWords into a useable value
        uint8 digitsCount = countDigits(getNumberOfPlayers());
        digitsCount--;
        randomWords = wordsToIndexes(randomWords, digitsCount);
        address[] memory players = s_players;

        // Find and award the winner of 1st prize
        findAndAwardWinner(1, players, randomWords[0], (i_prize * 3) / 5);

        // Find and award the winner of 2nd prize
        findAndAwardWinner(2, players, randomWords[1], (i_prize * 3) / 10);

        // Find and award the winner of 3rd prize
        findAndAwardWinner(3, players, randomWords[2], (i_prize * 1) / 10);

        // Clean up and prepare for new round
        s_players = new address[](0);
        s_lastTimeStamp = block.timestamp;
        emit LotteryRoundEnded(s_latestRoundNumber, s_lastTimeStamp);
        s_latestRoundNumber++;
    }
}
