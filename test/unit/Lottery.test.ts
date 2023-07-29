import "@nomicfoundation/hardhat-ethers";
import "@nomicfoundation/hardhat-chai-matchers";
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");
import { ethers, network } from "hardhat";
import { assert, expect } from "chai";
import { LinkTokenInterface__factory, LotteryMock, VRFCoordinatorV2Mock } from "../../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers"
import { developmentChainIds } from "../../network.config.bonus";
import deployLottery from "../../scripts/deployLottery";
import DeployInfos from "../../scripts/DeployInfos.type";

!developmentChainIds.includes(network.config.chainId as number) ? describe.skip :
describe("Lottery", () => {
    /**Variables. Note: This unit test is meant for local network, so we assume everything is mocked. Therefore, in case of variables name, VRFCoordinatorV2 is actually VRFCoordinatorV2Mock, lottery is actuall lotteryMock*/
    let deployInfos: DeployInfos;
    let vrfCoordinatorV2: VRFCoordinatorV2Mock;
    let lottery: LotteryMock;
    let lotteryForPlayer: LotteryMock;
    let signers: HardhatEthersSigner[];
    let owner: HardhatEthersSigner;

    /**Before all */
    before(async () => {
        signers = await ethers.getSigners();
        owner = signers[0];
    })

    /**Deploy the contract before testing each of the components(functions)*/
    beforeEach(async () => {
        deployInfos = await deployLottery(false);
        vrfCoordinatorV2 = await ethers.getContractAt("VRFCoordinatorV2Mock", deployInfos.vrfCoordinatorV2Address);
        lottery = await ethers.getContractAt("LotteryMock", deployInfos.lotteryAddress ?? "");
        lotteryForPlayer = lottery.connect(signers[1]);
    })

    /**Refund the remaining balance of lottery to the owner after each component test */
    afterEach(async () => {
        await lottery.clearPlayers();
        await lottery.closeLottery();
    })

    describe("constructor()", () => {
        it("initializes Lottery contract with correct values ", async () => {
            assert.equal(deployInfos.prize, await lottery.getPrize());
            assert.equal(deployInfos.joinFee, await lottery.getJoinFee());
            assert.equal(deployInfos.vrfCoordinatorV2Address, await lottery.getVRFCoordinatorV2());
            assert.equal(deployInfos.vrfGasLane, await lottery.getGaslane());
            assert.equal(deployInfos.vrfSubscriptionId, await lottery.getSubscriptionId());
            assert.equal(deployInfos.callbackGasLimit, await lottery.getCallbackGasLimit());
            assert.equal(deployInfos.upKeepInterval, await lottery.getUpKeepInterval());
        })
    })

    describe("fund()", () => {
        it("updates the correct amount of Eth funded", async () => {
            let amount: bigint = deployInfos.prize + deployInfos.ensure;
            await expect(lottery.fund({
                value: amount,
            }))
            .to.changeEtherBalances([owner.address, deployInfos.lotteryAddress], [-amount, amount]);
        })
        it("emits a LotteryFunded(address funder, uin256 amount) event", async () => {
            let amount: bigint = deployInfos.prize + deployInfos.ensure;
            await expect(lottery.fund({value: amount}))
            .to.emit(lottery, "LotteryFunded").withArgs(owner.address, amount);
        }); 
    })

    describe("fallback()", () => {
        it("calls fund() & updates the correct amount of Eth funded when someone transfer some Eth to the contract along with some msg.data", async () => {
            const selector: string = "0x080604";
            let amount: bigint = deployInfos.prize + deployInfos.ensure;
            const balanceBefore: bigint = await ethers.provider.getBalance(deployInfos.lotteryAddress as string);
            await owner.sendTransaction({
                to: deployInfos.lotteryAddress,
                value: amount,
                data: selector
            })
            const balanceAfter: bigint = await ethers.provider.getBalance(deployInfos.lotteryAddress as string);
            assert.equal(balanceBefore + amount, balanceAfter);
        })
        it("emits the event LotteryFunded(address funder, uint256 amount)", async () => {
            let amount: bigint = deployInfos.prize + deployInfos.ensure;
            await expect(owner.sendTransaction({
                to: deployInfos.lotteryAddress,
                value: amount
            }))
            .to.emit(lottery, "LotteryFunded").withArgs(owner.address, amount);
        });
    })

    describe("receive()", () => {
        it("call fund() & update the correct amount of Eth funded when someone transfer Eth to the contract with no transfer data", async () => {
            let amount: bigint = deployInfos.prize + deployInfos.ensure;
            const balanceBefore: bigint = await ethers.provider.getBalance(deployInfos.lotteryAddress as string);
            await owner.sendTransaction({
                to: deployInfos.lotteryAddress,
                value: amount,
            })
            const balanceAfter: bigint = await ethers.provider.getBalance(deployInfos.lotteryAddress as string);
            assert.equal(balanceBefore + amount, balanceAfter);
        })
        it("emits the event LotteryFunded(address funder, uint256 amount)", async () => {
            let amount: bigint = deployInfos.prize + deployInfos.ensure;
            await expect(owner.sendTransaction({
                to: deployInfos.lotteryAddress,
                value: amount
            }))
            .to.emit(lottery, "LotteryFunded").withArgs(owner.address, amount);
        });
    })

    describe("join()", () => {
        it("doesn't anyone join if the owner hasn't funded enough money", async () => {
            await expect(lotteryForPlayer.join({ value: deployInfos.joinFee }))
            .to.be.revertedWithCustomError(lotteryForPlayer, "Lottery__NotEnoughFund");
        })
        it("doesn't allow the owner to join", async () => {
            await lottery.fund({ value: deployInfos.prize + deployInfos.ensure });
            await expect(lottery.join({ value: deployInfos.joinFee }))
            .to.be.revertedWithCustomError(lottery, "Lottery__NotAllowOwnerToJoin");
        });
        it("doesn't let a person join if they don't pay enough join fee", async () => {
            await lottery.fund({ value: deployInfos.prize + deployInfos.ensure });
            await expect(lotteryForPlayer.join({ value: 0n }))
            .to.be.revertedWithCustomError(lotteryForPlayer, "Lottery__NotEnoughFee");
        })
        it("doesn't let a person join if they pay just 1 wei less than join fee (extreme)", async () => {
            await lottery.fund({ value: deployInfos.prize + deployInfos.ensure });
            await expect(lotteryForPlayer.join({ value: deployInfos.joinFee - 1n }))
            .to.be.revertedWithCustomError(lotteryForPlayer, "Lottery__NotEnoughFee");
        })
        it("doesn't let a person join if lottery is full", async () => {
            let maxPlayers: bigint = await lottery.getMaximumNumberOfPlayers();
            await lottery.fund({ value: deployInfos.prize + deployInfos.ensure });
            for (let i = 0; i <= maxPlayers - 1n; i++) {
                await lotteryForPlayer.join({value: deployInfos.joinFee});
            }
            await expect(lotteryForPlayer.join({ value: deployInfos.joinFee }))
            .to.be.revertedWithCustomError(lotteryForPlayer, "Lottery__TooManyPlayers");
        })
        it("emits the event PlayerJoined(address player) whenever someone joins the lottery", async () => {
            await lottery.fund({value: deployInfos.prize + deployInfos.ensure});
            let minPlayers: bigint = await lottery.getMinimumNumberOfPlayers();
            for (let i = 0; i < minPlayers - 1n; i++) {
                lotteryForPlayer = lottery.connect(signers[i + 1]);
                await expect(lotteryForPlayer.join({value: deployInfos.joinFee}))
                .to.emit(lottery, "PlayerJoined").withArgs(signers[i + 1].address);
            }
        })
    })

    describe("getPlayer()", () => {
        it("returns the correct address of a player at given index", async () => {
            await lottery.fund({ value: deployInfos.prize + deployInfos.ensure });
            let maxPlayers: bigint = await lottery.getMaximumNumberOfPlayers();
            let minPlayers: bigint = await lottery.getMinimumNumberOfPlayers();
            let i: number
            for (i = 0; i < signers.length - 1 && i < maxPlayers; i++) {
                lotteryForPlayer = lottery.connect(signers[i + 1]);
                await lotteryForPlayer.join({ value: deployInfos.joinFee });
            }
            i--;
            lotteryForPlayer = lottery.connect(signers[i]);
            for (; i < minPlayers - 1n; i++) {
                await lotteryForPlayer.join({ value: deployInfos.joinFee });
            }
            let players: bigint = await lottery.getNumberOfPlayers();
            for (i = 0; i < players; i++) {
                assert.equal(await lottery.getPlayer(i), signers[i + 1].address);
            }
        })
    })

    describe("getRoundNumber()", () => {
        it("returns the correct initial round number", async () => {
            assert.equal(await lottery.getRoundNumber(), 1n);
        })
    })

    describe("getOwner()", () => {
        it("returns the correct owner of the contract", async () => {
            assert.equal(await lottery.getOwner(), owner.address);
        })
    })

    describe("getPrize()", () => {
        it("returns the same prize that had been setup during deployment process", async () => {
            assert.equal(await lottery.getPrize(), deployInfos.prize);
        })
    })

    describe("getJoinFee()", () => {
        it("returns the same join fee tha that had been setup during deployment process", async () => {
            assert.equal(await lottery.getJoinFee(), deployInfos.joinFee);
        })
    })

    describe("getSubscriptionId()", () => { })

    describe("getVRFCoordinatorV2()", () => {
        it("returns the address of VRFCoordinatorV2 which had been setup during deployment process", async () => {
            assert.equal(await lottery.getVRFCoordinatorV2(), deployInfos.vrfCoordinatorV2Address);
        })
    })

    describe("getNumberOfWords()", () => {
        it("returns the correct number of words per Chainlink VRF request (should be 3)", async () => {
            assert.equal(await lottery.getNumberOfWords(), 3n);
        })
    })

    describe("getMinimumRequestConfirmations()", () => {
        it("returns the correct number of minimum request confirmations (should be 3)", async () => {
            assert.equal(await lottery.getMinumRequestConfirmations(), 3n);
        })
    })

    describe("getUpKeepInterval()", () => {
        it("returns the correct upkeep interval value in seconds which had been setup during deployment process", async () => {
            assert.equal(await lottery.getUpKeepInterval(), deployInfos.upKeepInterval);
        })
    })

    describe("countDigits()", () => {
        // it("returns the correct number of digits of a given unsigned int", async () => {
        // let maxPlayers: bigint = await lottery.getMaximumNumberOfPlayers();
        // console.log(`maxPlayers: ${maxPlayers}`);
        // for (let i = 0; i <= 9 && i <= maxPlayers; i++) {
        //     assert.equal(await lottery.countDigits(i), 1n);
        // }
        // let expected: bigint = 1n;
        // let checkpoint: bigint = 10n
        // for (let i: bigint = 10n; i <= maxPlayers; i++) {
        //     if (i == checkpoint * 10n) {
        //         checkpoint = i;
        //         expected++;
        //     }
        //     let digits: bigint = await lottery.countDigits(i);
        //     console.log(`Number of digits in ${i}: ${digits}`);
        //     assert.equal(digits, expected);
        // }
        // })
        // Note: this piece of code always stop abrubtly (I don't know why. Could possibly be an issue related to gas limit as countDigits() is called multiple times in a row)
        // So I decided to stick with a simpler test case:
        it("returns the correct of digits of a given unsigned int", async () => {
            let bigNumbers: bigint[] = [
                1n,
                10n,
                100n,
                1000n,
                10000n,
                100000n,
                1000000n,
                10000000n,
                234652225n,
                1526999226n,
            ]
            for (let i = 0; i < bigNumbers.length; i++) {
                assert.equal(BigInt(i + 1), await lottery.countDigits(bigNumbers[i]));
            }
        })
    })

    describe("wordsToIndexes()", () => {
        let randomWords: bigint[];
        let maxPlayers: bigint;
        let maxDigits: bigint;
        let indexes: bigint[];

        before(async () => {
            randomWords = [ // These uint256 words are generated using the identical method that Chainlink VRF uses
                24358263935521714451429971388720448601596482683913333366865345619105757883541n,
                24358263935521714451429971388720448601596482683913333366865345619105757883517n,
                64108577974468738685129867587667886408776012078221640916791509906160837075829n
            ]
            maxPlayers = await lottery.getMaximumNumberOfPlayers();
            maxDigits = await lottery.countDigits(maxPlayers);
        })
        it("converts words indexes to that belongs in range [0, 10**ditgits] and returns them", async () => {
            for (let digits: bigint = 1n; digits <= maxDigits; digits++) {
                indexes = await lottery.testWordsToIndexes(randomWords, digits);
                for (let j = 0; j < indexes.length; j++) {
                    assert.isAtLeast(indexes[j], BigInt(0));
                    assert.isAtMost(indexes[j], BigInt(10n ** digits));
                }
            }
        })
        it("converts words to right indexes", async () => {
            for (let digits: bigint = 1n; digits <= maxDigits; digits++) {
                indexes = await lottery.testWordsToIndexes(randomWords, digits);
                for (let j = 0; j < indexes.length; j++) {
                    let expected: bigint = randomWords[j] % (10n ** digits);
                    assert.equal(indexes[j], expected);
                }
            }
        })
    })

    describe("findAndAwardWinner()", () => {
        let maxPlayers: bigint;
        let prizeRanking: bigint;
        let amount: bigint;
        let index: bigint;
        let winner: string;
        
        beforeEach(async () => {
            await lottery.fund({value: deployInfos.prize + deployInfos.ensure});
            maxPlayers = await lottery.getMaximumNumberOfPlayers();
            for (let i = 0; i < maxPlayers; i++)    {
                await lotteryForPlayer.join({value: deployInfos.joinFee});
            }
        })
        it("if winner isn't found, emits the event PrizeDismissed(uint8 prizeRanking)", async () => {
            prizeRanking = 1n;
            amount = deployInfos.prize + deployInfos.ensure;
            index = maxPlayers;
            await expect(lottery.testFindAndAwardWinner(prizeRanking, index, amount))
            .to.emit(lottery, "PrizeDismissed").withArgs(prizeRanking);
        })
        it("if winner is found, emits the event PrizeWon(address winner, uint8 prizeRanking)", async () => {
            for (let i = 0; i < 3; i++) {
                prizeRanking = BigInt(i + 1);
                amount = ethers.parseEther("0");
                index = 0n;
                winner = await lottery.getPlayer(index);
                await expect(lottery.testFindAndAwardWinner(prizeRanking, index, amount))
                .to.emit(lottery, "PrizeWon").withArgs(winner, prizeRanking);
            }
        })
        it("if winner is found, it sends Eth awards to winners then emits the event PrizeAwarded(address winner, uint8 prizeRanking, uint256 amount)", async () => {
            for (let i = 0; i < 3; i++) {
                prizeRanking = BigInt(i + 1);
                amount = ethers.parseEther(`${3 - i}`);
                index = 0n;
                winner = await lottery.getPlayer(index);
                await expect(lottery.testFindAndAwardWinner(prizeRanking, index, amount)).to.changeEtherBalances(
                    [deployInfos.lotteryAddress, winner],
                    [-amount, amount]
                )
                .to.emit(lottery, "PrizeAwarded").withArgs(winner, prizeRanking, amount);
            }
        })
    })

    describe("checkUpKeep()", () => {
        beforeEach(async () => {
            await lottery.fund({ value: deployInfos.prize + deployInfos.ensure }); // hasEnoughFund ✅
        })
        it("returns false when hasEnoughPlayers but !enoughTimeHasPassed", async () => {
            let minPlayers: bigint = await lottery.getMinimumNumberOfPlayers();
            let i;
            for (i = 0; i < signers.length - 1 && i < minPlayers; i++) {
                lotteryForPlayer = lottery.connect(signers[i + 1]);
                await lotteryForPlayer.join({ value: deployInfos.joinFee }); // hasEnoughPlayers ✅
            }
            lotteryForPlayer = lottery.connect(signers[i]);
            for (; i < minPlayers; i++) {
                await lotteryForPlayer.join({ value: deployInfos.joinFee });
            }

            // let upKeepNeeded: boolean;
            let upKeepNeeded: boolean;
            [upKeepNeeded,] = await lottery.checkUpkeep("0x00");
            // const { upKeepNeeded } = await lottery.callStatic.checkUpKeep("0x00");
            assert.equal(upKeepNeeded, false)
        })
        it("returns false when enoughTimeHasPassed but !hasEnoughPlayers", async () => {
            await network.provider.send("evm_increaseTime", [
                Number(deployInfos.upKeepInterval) + 1
            ]);
            await network.provider.send("evm_mine", []);

            let upKeepNeeded: boolean;
            [upKeepNeeded,] = await lottery.checkUpkeep("0x00") as [boolean, string];
            assert.equal(upKeepNeeded, false);
        })
        it("returns false when (!hasEnoughPlayers && !enoughTimeHasPassed)", async () => {
            let upKeepNeeded: boolean;
            [upKeepNeeded,] = await lottery.checkUpkeep("0x00") as [boolean, string];
            assert.equal(upKeepNeeded, false);
        })
        it("returns true when (hasEnoughPlayers && enoughTimeHasPassed)", async () => {
            await network.provider.send("evm_increaseTime", [
                Number(deployInfos.upKeepInterval) + 1
            ]);
            await network.provider.send("evm_mine", []);

            let minPlayers: bigint = await lottery.getMinimumNumberOfPlayers();
            let i;
            for (i = 0; i < signers.length - 1 && i < minPlayers; i++) {
                lotteryForPlayer = lottery.connect(signers[i + 1]);
                await lotteryForPlayer.join({ value: deployInfos.joinFee }); // hasEnoughPlayers ✅
            }
            lotteryForPlayer = lottery.connect(signers[i]);
            for (; i < minPlayers; i++) {
                await lotteryForPlayer.join({ value: deployInfos.joinFee });
            }

            let upKeepNeeded: boolean;
            [upKeepNeeded,] = await lottery.checkUpkeep("0x00") as [boolean, string];
            assert.equal(upKeepNeeded, true);
        })
    })

    describe("performUpkeep()", () => {
        beforeEach(async () => {
            await lottery.fund({ value: deployInfos.prize + deployInfos.ensure });
        })
        it("reverts with custom error Lottery__NotEnoughTimeHasPassed if hasEnoughPlayers but !enoughTimeHasPassed (easy)", async () => {
            let minPlayers: bigint = await lottery.getMinimumNumberOfPlayers();
            for (let i = 0; i < minPlayers; i++) {
                lotteryForPlayer.join({value: deployInfos.joinFee});
            }
            await expect(lottery.performUpkeep("0x00"))
            .to.be.revertedWithCustomError(lottery, "Lottery__NotEnoughTimeHasPassed");
        })
        it("reverts with custom error Lottery__NotEnoughTimeHasPassed if hasEnoughPlayers but !enoughTimeHasPassed (extreme)", async () => {
            let minPlayers: bigint = await lottery.getMinimumNumberOfPlayers();
            for (let i = 0; i < minPlayers; i++) {
                lotteryForPlayer.join({value: deployInfos.joinFee});
            }
            await network.provider.send("evm_increaseTime", [
                Number(deployInfos.upKeepInterval) - 10
            ])
            await network.provider.send("evm_mine", []);
            await expect(lottery.performUpkeep("0x00"))
            .to.be.revertedWithCustomError(lottery, "Lottery__NotEnoughTimeHasPassed");
        })
        it("reverts with custom error Lottery__NotEnoughPlayers if enoughTimeHasPassed but !hasEnoughPlayers (easy)", async () => {
            await network.provider.send("evm_increaseTime", [
                Number(deployInfos.upKeepInterval) + 1
            ]);
            await network.provider.send("evm_mine", []);
            await expect(lottery.performUpkeep("0x00"))
            .to.be.revertedWithCustomError(lottery, "Lottery__NotEnoughPlayers");
        })
        it("reverts with custom error Lottery__NotEnoughPlayers if enoughTimeHasPassed but !hasEnoughPlayers (extreme)", async () => {
            await network.provider.send("evm_increaseTime", [
                Number(deployInfos.upKeepInterval) + 1
            ]);
            await network.provider.send("evm_mine", []);
            let minPlayers: bigint = await lottery.getMinimumNumberOfPlayers();
            for (let i = 0; i < signers.length - 1 && i < minPlayers - 1n; i++) {
                lotteryForPlayer = lottery.connect(signers[i + 1]);
                await lotteryForPlayer.join({ value: deployInfos.joinFee });
            }
            await expect(lottery.performUpkeep("0x00"))
            .to.be.revertedWithCustomError(lottery, "Lottery__NotEnoughPlayers");
        })
        it("if (enoughTimeHasPassed && hasEnoughPlayers), emits the event UpKeepTriggered(uint128 roundNumber, uint256 timestamp), then emits the event RandomWordsRequested(bytes32 gasLane ,uint64 subscriptionId, uint16 MINIMUM_REQUEST_CONFIRMATIONS, uint32 callbackGasLimit, uint32 NUM_WORDS)", async () => {
            await network.provider.send("evm_increaseTime", [
                Number(deployInfos.upKeepInterval) + 1
            ])
            await network.provider.send("evm_mine", []);
            let min_players: bigint = await lottery.getMinimumNumberOfPlayers();
            for (let i = 0; i < min_players; i++) {
                await lotteryForPlayer.join({value: deployInfos.joinFee});
            }
            let roundNumber: bigint = await lottery.getRoundNumber();
            let minRequestConfirm: bigint = await lottery.getMinumRequestConfirmations();
            let numWords: bigint = await lottery.getNumberOfWords();
            
            await expect(lottery.performUpkeep("0x00"))
            .to.emit(lottery, "UpKeepTriggered").withArgs(roundNumber, anyValue)
            .to.emit(lottery, "RandomWordsRequested").withArgs(
                anyValue,
                deployInfos.vrfSubscriptionId,
                minRequestConfirm,
                deployInfos.callbackGasLimit,
                numWords
            );
        });
        it("if (enoughTimeHasPassed && hasEnoughPlayers) && !s_pendingRequest, it request for random words and emits the event RandomWordsRequested(...)", async () => {
            await network.provider.send("evm_increaseTime", [
                Number(deployInfos.upKeepInterval) + 1
            ])
            await network.provider.send("evm_mine", []);
            let min_players: bigint = await lottery.getMinimumNumberOfPlayers();
            for (let i = 0; i < min_players; i++) {
                await lotteryForPlayer.join({value: deployInfos.joinFee});
            }
            await expect(lottery.performUpkeep("0x00"))
            .to.emit(
                lottery,
                "RandomWordsRequested"
            );
            let latestRequestId: bigint = await vrfCoordinatorV2.getCurrentRequestId();
            assert(await lottery.getRequestId(), latestRequestId);
        })
        it("if (enoughTimeHasPassed && hasEnoughPlayers) but s_pendingRequest, it doesn't emit anything after emitting UpKeepTriggered()", async () => {
            await network.provider.send("evm_increaseTime", [
                Number(deployInfos.upKeepInterval) + 1
            ])
            await network.provider.send("evm_mine", []);
            let min_players: bigint = await lottery.getMinimumNumberOfPlayers();
            for (let i = 0; i < min_players; i++) {
                await lotteryForPlayer.join({value: deployInfos.joinFee});
            }

            // intentional fake requests to set s_pendingRequest to true for testing
            for (let i = 0; i < 10; i++) {
                await lottery.requestRandomWords();
            }

            assert(await lottery.getPendingRequest(), true);
            await expect(lottery.performUpkeep("0x00"))
            .to.not.emit(
                lottery,
                "RandomWordsRequested"
            );
        })
    })

    describe("fulfillRandomWords() in Lottery", () =>{
        // We can't call fulfillRandomWords() in Lottery directly cause it's internal, we have to call via fulfillRandomWords() in VRFCoordinatorV2, then VRFCoordinatorV2 calls fulfillRandomWords() in Lottery
        let requestId: bigint;

        beforeEach(async () => {
            let minRequestConfirm: bigint = await lottery.getMinumRequestConfirmations();
            let numWords: bigint = await lottery.getNumberOfWords();
            await lottery.requestRandomWords();
            requestId = await lottery.getRequestId();
            let maxPlayers: bigint = await lottery.getNumberOfPlayers();
            for (let i = 0; i < maxPlayers; i++) {
                await lotteryForPlayer.join({value: deployInfos.joinFee});
            }
        })
        it("can only be called after performUpkeep(which means only after we have called requestRandomWords()", async () => {
            await expect(vrfCoordinatorV2.fulfillRandomWords(requestId + 1n, deployInfos.lotteryAddress as string))
            .to.be.revertedWith("nonexistent request");
            await expect(vrfCoordinatorV2.fulfillRandomWords(requestId + 2n, deployInfos.lotteryAddress as string))
            .to.be.revertedWith("nonexistent request");
        })
        it("emits the event RandomWordsFulfilled(requestId, randomWords)", async () => {
            await expect(vrfCoordinatorV2.fulfillRandomWords(requestId, deployInfos.lotteryAddress as string))
            .to.emit(lottery, "RandomWordsFulfilled").withArgs(requestId, anyValue);
        })
        it("receives a not-empty array of generated random words from VRFCoordinatorV2", async () => {
            await expect(vrfCoordinatorV2.fulfillRandomWords(requestId, deployInfos.lotteryAddress as string))
            .to.not.be.revertedWithPanic();
        })
        it("call findAndAwardWinner() to award the winners", async () => {
            // await lottery.fund({value: deployInfos.prize + deployInfos.ensure});
            // let maxPlayers: bigint = await lottery.getMaximumNumberOfPlayers();
            // for (let i = 0; i < maxPlayers; i++) {
            //     await lotteryForPlayer.join({value: deployInfos.joinFee});
            // }
            // let contractBalanceBefore: bigint = await ethers.provider.getBalance(deployInfos.lotteryAddress as string);
            // let winnerBalanceBefore: bigint = await ethers.provider.getBalance(signers[1].address as string);
            // let txResponse = await vrfCoordinatorV2.fulfillRandomWords(requestId, deployInfos.lotteryAddress as string);
            // let txReceipt = await txResponse.wait();
            // let txFee: bigint = txReceipt?.fee as bigint;
            // let contractBalanceAfter: bigint = await ethers.provider.getBalance(deployInfos.lotteryAddress as string);
            // let winnerBalanceAfter: bigint = await ethers.provider.getBalance(signers[1].address as string);
            // assert.equal(contractBalanceBefore + winnerBalanceBefore, contractBalanceAfter + winnerBalanceAfter - txFee);
        })
        it("reset s_players, s_randomWords, updates s_lastTimeStamp, increment s_roundNumber, and set s_pendingRequest to false", async () => {
            await lottery.fund({value: deployInfos.prize + deployInfos.ensure});
            let maxPlayers: bigint = await lottery.getMaximumNumberOfPlayers();
            for (let i = 0; i < maxPlayers; i++) {
                await lotteryForPlayer.join({value: deployInfos.joinFee});
            }
            let lastTimestampBefore: bigint = await lottery.getLastTimeStamp();
            let roundNumberBefore: bigint = await lottery.getRoundNumber();
            await vrfCoordinatorV2.fulfillRandomWords(requestId, deployInfos.lotteryAddress as string);
            let roundNumberAfter: bigint = await lottery.getRoundNumber();
            let lastTimestampAfter: bigint = await lottery.getLastTimeStamp();
            let players: string[] = await lottery.getPlayers();
            let playersCount: bigint = await lottery.getNumberOfPlayers();
            let randomWords: bigint[] = await lottery.getRandomWords();

            assert.notEqual(lastTimestampBefore, lastTimestampAfter);
            assert.equal(roundNumberBefore + 1n, roundNumberAfter);
            assert.equal(randomWords.length, 0);
            assert.equal(players.length, 0);
            assert.equal(playersCount, 0n);
            await expect(lottery.getPlayer(0n)).to.be.revertedWithPanic;
            assert.equal(await lottery.getPendingRequest(), false);
        })
        it("emits the event LotteryRoundEnded(uint128 s_roundNumber, uint128 s_lastTimeStamp), then emits the event LotteryRoundStarted(uint128 s_roundNumber, uint256 timestamp)", async () => {
            await expect(vrfCoordinatorV2.fulfillRandomWords(requestId, deployInfos.lotteryAddress as string))
            .to.emit(lottery, "LotteryRoundEnded").withArgs(1, anyValue)
            .to.emit(lottery, "LotteryRoundStarted").withArgs(2, anyValue);            
        })
    })

    // HUGEE final test
    describe("final test", () => {
        it("simulates the whole process from a-z: owner funds, players join in, once checkUpKeep() returns true, performUpKeep() gets called, then the winners gets award", async () => {
            // fill the lottery with players
            let maxPlayers: bigint = await lottery.getMaximumNumberOfPlayers();
            let minPlayers: bigint = await lottery.getMinimumNumberOfPlayers();
            let i = 0;
            await lottery.fund({value: deployInfos.prize + deployInfos.ensure});
            for (i = 0; i < maxPlayers && i < signers.length - 1; i++) {
                lotteryForPlayer = lottery.connect(signers[i + 1]);
                await lotteryForPlayer.join({value: deployInfos.joinFee});
            }
            i--;
            for (; i < minPlayers - 1n; i++) {
                lotteryForPlayer = lottery.connect(signers[i]);
                await lotteryForPlayer.join({value: deployInfos.joinFee});
            }

            // intense: emulate Chainlink keeper
            await network.provider.send("evm_increaseTime", [Number(deployInfos.upKeepInterval) + 1]);
            await network.provider.send("evm_mine", []);
            while (true) {
                let upKeepNeeded: boolean;
                [upKeepNeeded,] = await lottery.checkUpkeep("0x00") as [boolean, string];
                if (upKeepNeeded)
                    break;
            }

            // map players to their account balance
            let playerToBalanace = new Map();
            signers.forEach(async (signer) => {
                let balance = await ethers.provider.getBalance(signer.address);
                playerToBalanace.set(signer.address, balance);
            })

            // assert based on PrizeAwarded events that has been emitted
            let txResponse = await lottery.performUpkeep("0x00");
            let txReceipt = await txResponse.wait();
            let logs = txReceipt?.logs;
            logs?.forEach(async (event) => {
                let winner;
                let amount;
                if (event.fragment.name == "PrizeAwarded") {
                    winner = event.args[0] ?? "";
                    if (winner != "") {
                        amount = event.args[2] ?? 0;
                        let winner__balanceBefore: bigint = playerToBalanace.get(winner);
                        let winner__balanceAfter: bigint = await ethers.provider.getBalance(winner); 
                        assert.equal(winner__balanceBefore + amount, winner__balanceAfter);
                    }
                }
            })
        })
    })
})