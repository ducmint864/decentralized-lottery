// SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

import "./mocks/VRFCoordinatorV2Mock.sol";

// Errors
error Lottery__NotEnoughFee();
error Lottery__NotEnoughFund();
error Lottery__NotOwner();
error Lottery__NotAllowedToJoin();

contract Lottery {
    /* State variables */
    uint256 public constant s_JOIN_FEE = 3000000000000000; // approx. 0.003 Eth = $5
    uint256 public constant s_PRIZE = 1000000000000000000000; // approx. 1000 Eth = $...
    address public immutable s_OWNER;
    address[] private s_players;
    // mapping(uint8 => address) s_prizeRankingToWinner; /**prize ranking => winner's address */
    // VRFV2 related variables
    VRFCoordinatorV2Mock private s_mockContract;
    uint64 private s_subId;

    // Events
    event TicketBought(address buyer); // emits whenever someone joins the lottery
    event PrizeWon(address winner, uint8 prizeRanking); // emits whenever someone wins a prize
    event PrizeAwarded(address winner, uint8 prizeRanking, uint256 amount); // emits whenever someone gets awarded for the prize they had won
    event ContractFunded(address funder, uint256 amount); // emits whenever someone funds money into the lottery

    // Modifiers
    modifier paidEnoughFee() {
        if (msg.value < s_JOIN_FEE) revert NotEnoughFee();
        _;
    }

    modifier fundedEnoughPrize() {
        if (address(this).balance < s_PRIZE) revert NotEnoughFund();
        _;
    }

    modifier onlyOwner() {
        if (msg.sender != s_OWNER) revert NotOwner();
        _;
    }

    modifier onlyNonOwner() {
        if (msg.sender == s_OWNER) revert NotAllowedToJoin();
        _;
    }

    // Functions
    fallback() external payable {
        fund();
    }

    receive() external payable {
        fund();
    }

    /**Note: On start-up, this contract requires the owner/operator of the contract itself to fund an amount equal to larger than s_Prize in order to provoke the integrity of the smart contract*/
    constructor(address mockContractAddress) payable fundedEnoughPrize {
        s_OWNER = msg.sender;
        emit ContractFunded(msg.sender, msg.value);
        /** Steps to get setup VRFv2CoordinatorMock */
        // 1. Initialize an instance of deployed VRFCoordinatorV2Mock contract
        s_mockContract = VRFCoordinatorV2Mock(mockContractAddress);
        // 2. Create subscription and save subscription id
        s_subId = s_mockContract.createSubscription();
        // 3. Add consumer to subscription
        s_mockContract.addConsumer(s_subId, address(this));
        // 4. Fund some LINK token to subscription (arbitary amount)
        s_mockContract.fundSubscription(s_subId, 100000000000000000000000);
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

    function getMockContractAddress() external view returns (address) {
        return address(s_mockContract);
    }

    function getNumberOfPlayers() public view returns (uint64) {
        return uint64(s_players.length);
    }

    function getRandomWords(
        uint32 numberOfRandomWords
    ) private returns (uint256[] memory) {
        uint256 foo = 69;
        uint256 requestId = s_mockContract.requestRandomWords(
            bytes32(foo),
            s_subId,
            1,
            100000000,
            numberOfRandomWords
        );
        uint256[] memory randomWords;
        randomWords = s_mockContract.fulfillRandomWordsWithOverride(
            requestId,
            address(this),
            randomWords
        );
        return randomWords;
    }

    /** 3 words are combined into an index of winner */
    function getIndexOfWinner() private returns (uint8) {
        uint256[] memory randomWords = getRandomWords(3);
        uint8 digitCount1 = 0;
        uint8 digitCount2 = 0;
        uint8 digitCount3 = 0;
        uint256 digitSum = 0;

        while (randomWords[0] > 0) {
            digitCount1++;
            digitSum += (randomWords[0] % 10);
            randomWords[0] /= 10;
        }

        while (randomWords[1] > 0) {
            digitCount2++;
            digitSum += (randomWords[1] % 10);
            randomWords[1] /= 10;
        }

        while (randomWords[2] > 0) {
            digitCount3++;
            digitSum += (randomWords[2] % 10);
            randomWords[2] /= 10;
        }

        return
            uint8(
                digitSum /
                    (
                        digitCount1 > digitCount2
                            ? (
                                digitCount1 > digitCount3
                                    ? digitCount1
                                    : digitCount3
                            )
                            : (
                                digitCount2 > digitCount3
                                    ? digitCount2
                                    : digitCount3
                            )
                    )
            );
    }

    function findAndAwardWinners(
        uint8 numberOfWinners,
        uint8 prizeRanking,
        uint256 amount
    ) private {
        for (uint8 i = 0; i < numberOfWinners; i++) {
            uint64 numberOfPlayers = getNumberOfPlayers();
            uint8 indexOfWinner = getIndexOfWinner();
            if (indexOfWinner >= numberOfPlayers) continue;

            address winner = s_players[indexOfWinner];
            emit PrizeWon(winner, prizeRanking);
            (bool callSuccess, ) = payable(winner).call{value: amount}("");
            require(
                callSuccess,
                "Something went wrong! Failed to send award to winner."
            );
            emit PrizeAwarded(winner, prizeRanking, amount);
        }
    }

    /** This functions gets called automatically at the end of every round */
    /** Each round, there are multiple winners (see $project-root/assets/co_cau_giai_thuong.txt)*/
    function executeAtEndOfRound() public onlyOwner fundedEnoughPrize {
        uint256 prize = s_PRIZE;
        // Tim va trao thuong 1 giai dac biet
        findAndAwardWinners(1, 0, (prize * 5) / 9);
        // Tim va trao thuong 1 giai nhat
        findAndAwardWinners(1, 1, (prize * 1) / 9);
        // Tim va trao thuong 2 giai nhi
        findAndAwardWinners(2, 2, (prize * 1) / 18);
        // Tim va trao thuong 3 giai ba
        findAndAwardWinners(3, 3, (prize * 1) / 36);
        // Tim va trao thuong 4 giai khuyen khich
        findAndAwardWinners(4, 4, (prize * 1) / 144);
        // clean-up for upcoming round
        delete s_players;
    }
}
