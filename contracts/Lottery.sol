// SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

import "@chainlink/contracts/src/v0.8/VRFConsumerBaseV2.sol";
import "@chainlink/contracts/src/v0.8/interfaces/VRFCoordinatorV2Interface.sol";
import "@chainlink/contracts/src/v0.8/interfaces/LinkTokenInterface.sol";

// Errors
error Lottery__NotEnoughFee();
error Lottery__NotEnoughFund();
error Lottery__NotOwner();
error Lottery__NotAllowedToJoin();
error Lottery__TransferFailed();

contract Lottery is VRFConsumerBaseV2 {
    /* State variables */
    // Lottery variables
    uint256 public immutable i_prize; // approx. 1000 Eth = $... Old value: 1000000000000000000000
    uint256 public immutable i_joinFee; // approx. 0.003 Eth = $5... Old value: 3000000000000000
    address public immutable i_owner;
    address[] private s_players;

    // Chainlink VRF variables
    VRFCoordinatorV2Interface private immutable i_vrfCoordinatorV2;
    bytes32 private immutable i_gasLane; // keyHash
    uint64 private immutable i_subscriptionId;
    uint32 private immutable i_callbackGasLimit;
    uint16 private constant MINIMUM_REQUEST_CONFIRMATIONS = 3;
    uint32 private constant NUM_WORDS = 3;

    // Events
    event PlayerJoined(address player); // emits whenever someone joins the lottery
    event PrizeDismissed(uint8 prizeRanking); // emits if a prize has no winner
    event PrizeWon(address winner, uint8 prizeRanking); // emits whenever someone wins a prize
    event PrizeAwarded(address winner, uint8 prizeRanking, uint256 amount); // emits whenever someone gets awarded for the prize they had won
    event ContractFunded(address funder, uint256 amount); // emits whenever someone funds money into the lottery

    // Modifiers
    modifier paidEnoughFee() {
        if (msg.value < i_joinFee) revert Lottery__NotEnoughFee();
        _;
    }

    modifier fundedEnoughPrize() {
        if (address(this).balance < i_prize) revert Lottery__NotEnoughFund();
        _;
    }

    modifier onlyOwner() {
        if (msg.sender != i_owner) revert Lottery__NotOwner();
        _;
    }

    modifier onlyNonOwner() {
        if (msg.sender == i_owner) revert Lottery__NotAllowedToJoin();
        _;
    }

    // Functions
    fallback() external payable {}

    receive() external payable {
        fund();
    }

    /**Note: On start-up, this contract requires the owner/operator of the contract itself to fund an amount equal to larger than s_Prize in order to provoke the integrity of the smart contract*/
    constructor(
        uint256 _prize,
        uint256 _joinFee,
        address _vrfCoordinatorV2Address,
        bytes32 _gasLane,
        uint64 _subscriptionId,
        uint32 _callbackGasLimit
    ) VRFConsumerBaseV2(_vrfCoordinatorV2Address) payable {
        emit ContractFunded(msg.sender, msg.value);
        i_owner = msg.sender;
        i_prize = _prize;
        i_joinFee = _joinFee;
        i_gasLane = _gasLane;
        i_subscriptionId = _subscriptionId;
        i_callbackGasLimit = _callbackGasLimit;

        /** Steps to get setup VRFv2CoordinatorMock */
        // 1. Initialize an instance of deployed VRFCoordinatorV2Mock contract
        i_vrfCoordinatorV2 = VRFCoordinatorV2Interface(_vrfCoordinatorV2Address);
        // 2. Add consumer to subscription. Assuming that you have already subscribed to Chainlikn VRF and you have a subscription ID
        i_vrfCoordinatorV2.addConsumer(i_subscriptionId, address(this));
    }

    function join() external payable onlyNonOwner paidEnoughFee {
        s_players.push(msg.sender);
    }

    /**Note: anyone can voluntarily fund money into the lottery */
    function fund() public payable {
        emit ContractFunded(msg.sender, msg.value);
    }

    function getPlayer(uint256 index) external view returns (address) {
        return s_players[index];
    }

    function getNumberOfPlayers() public view returns (uint64) {
        return uint64(s_players.length);
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

    /**This is a call-back function: when the 3 random words are generated, go find and award the winner*/
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
    }
}
