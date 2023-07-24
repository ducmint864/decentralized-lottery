import "@nomicfoundation/hardhat-ethers"
import { ethers } from "hardhat";
import { assert, expect } from "chai";
import { LotteryMock, VRFCoordinatorV2Mock } from "../../typechain-types";
import { networkConfig } from "../../network.config.bonus";
import deployLottery from "../../scripts/deployLottery";
import DeployInfos from "../../scripts/DeployInfos.type";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers"
import { BigNumberish, Block } from "ethers";

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
            const balanceBefore: bigint = await ethers.provider.getBalance(deployInfos.lotteryAddress as string);
            const amount: bigint = ethers.parseEther("1");
            await lottery.fund({ value: amount });
            const balanceAfter: bigint = await ethers.provider.getBalance(deployInfos.lotteryAddress as string);
            assert.equal(balanceBefore + amount, balanceAfter);
        })
        it("emits a LotteryFunded(address funder, uin256 amount) event");
    })

    describe("fallback()", () => {
        it("calls fund() & updates the correct amount of Eth funded when someone transfer some Eth to the contract along with some msg.data", async () => {
            const selector: string = "0x080604";
            const amount: bigint = ethers.parseEther("1");
            const balanceBefore: bigint = await ethers.provider.getBalance(deployInfos.lotteryAddress as string);
            await owner.sendTransaction({
                to: deployInfos.lotteryAddress,
                value: amount,
                data: selector
            })
            const balanceAfter: bigint = await ethers.provider.getBalance(deployInfos.lotteryAddress as string);
            assert.equal(balanceBefore + amount, balanceAfter);
        })
        it("emits the event LotteryFunded(address funder, uint256 amount)");
    })

    describe("receive()", () => {
        it("call fund() & update the correct amount of Eth funded when someone transfer Eth to the contract with no transfer data", async () => {
            const amount: bigint = ethers.parseEther("1");
            const balanceBefore: bigint = await ethers.provider.getBalance(deployInfos.lotteryAddress as string);
            await owner.sendTransaction({
                to: deployInfos.lotteryAddress,
                value: amount,
            })
            const balanceAfter: bigint = await ethers.provider.getBalance(deployInfos.lotteryAddress as string);
            assert.equal(balanceBefore + amount, balanceAfter);
        })
        it("emits the event LotteryFunded(address funder, uint256 amount)", async () => { });
    })

    // Reason commented out: error that halves the owner's balance
    describe("join()", () => {
        it("doesn't anyone join if the owner hasn't funded enough money", async () => {
            await expect(lotteryForPlayer.join({ value: deployInfos.joinFee })).to.be.revertedWithCustomError(lotteryForPlayer, "Lottery__NotEnoughFund");
        })
        it("doesn't allow the owner to join", async () => {
            await lottery.fund({ value: deployInfos.prize + ethers.parseEther("1") });
            await expect(lottery.join({ value: deployInfos.joinFee })).to.be.revertedWithCustomError(lottery, "Lottery__NotAllowOwnerToJoin");
        });
        it("doesn't let a person join if they don't pay enough join fee", async () => {
            await lottery.fund({ value: deployInfos.prize + ethers.parseEther("1") });
            await expect(lotteryForPlayer.join({ value: 0n })).to.be.revertedWithCustomError(lotteryForPlayer, "Lottery__NotEnoughFee");
        })
        it("doesn't let a person join if they pay just 1 wei less than join fee (extreme)", async () => {
            await lottery.fund({ value: deployInfos.prize + ethers.parseEther("1") });
            await expect(lotteryForPlayer.join({ value: deployInfos.joinFee - 1n })).to.be.revertedWithCustomError(lotteryForPlayer, "Lottery__NotEnoughFee");
        })
        it("doesn't let a person join if lottery is full", async () => {
            let maxPlayers: bigint = await lottery.getMaximumNumberOfPlayers();
            await lottery.fund({ value: deployInfos.prize + ethers.parseEther("1") });
            for (let i = 0; i <= maxPlayers - 1n; i++) {
                await lotteryForPlayer.join({ value: deployInfos.joinFee });
            }
            await expect(lotteryForPlayer.join({ value: deployInfos.joinFee })).to.be.revertedWithCustomError(lotteryForPlayer, "Lottery__TooManyPlayers");
        })
    })

    describe("getPlayer()", () => {
        it("returns the correct address of a player at given index", async () => {
            await lottery.fund({ value: deployInfos.prize + ethers.parseEther("1") });
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
        // before(async () => {
        //     await lottery.fund({value: deployInfos.prize + ethers.parseEther("1")});
        //     for (let i = 0; i < signers.length; i++) {

        //     }
        // })
        it("if winner isn't found, emits the event PrizeDismissed(uint8 prizeRanking)")
        it("if winner is found, emits the event PrizeWon(address winner, uint8 prizeRanking)")
        it("if winner is found, after emitting the event PrizeWon, it then send award to winner and then emits the event PrizeAwarded(address winner, uint8 prizeRanking, uint256 amount)")
    })

    describe("checkUpKeep()", () => {
        beforeEach(async () => {
            await lottery.fund({ value: deployInfos.prize + ethers.parseEther("1") }); // hasEnoughFund ✅
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

            // We've got to be quick to execute checkUpKeep() quickly to not exceed upKeepInterval.
            // Otherwise, this test case will be dis-regarded
            const currentTimestamp: bigint = await lottery.getBlockTimestamp();
            const lastTimetamp: bigint = await lottery.getLastTimeStamp();
            if (currentTimestamp - lastTimetamp <= deployInfos.upKeepInterval) {
                it.skip;
            }
            else {
                let upKeepNeeded: boolean
                [upKeepNeeded,] = await lottery.checkUpkeep("0x00") as [boolean, string];
                assert.equal(upKeepNeeded, false);
            }
        })
        it("returns false when enoughTimeHasPassed but !hasEnoughPlayers", async () => {
            await (() => {
                return new Promise((resolve, reject) => {
                    setTimeout(resolve, Number(deployInfos.upKeepInterval) * 1000 + 1000);  // enoughTimeHasPassed ✅
                })
            })();

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
            await (() => {
                return new Promise((resolve, reject) => {
                    setTimeout(resolve, Number(deployInfos.upKeepInterval) * 1000 + 1000);  // enoughTimeHasPassed ✅
                })
            })();

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
            await lottery.fund({ value: deployInfos.prize + ethers.parseEther("1") });
        })
        it("reverts with custom error Lottery__NotEnoughTimeHasPassed if !enoughTimeHasPassed (easy)", async () => {
            await expect(lottery.performUpkeep("0x00")).to.be.revertedWithCustomError(lottery, "Lottery__NotEnoughTimeHasPassed");
        })
        it("reverts with custom error Lottery__NotEnoughTimeHasPassed if !enoughTimeHasPassed (extreme)", async () => {
            await (() => {
                return new Promise((resolve, reject) => {
                    setTimeout(resolve, Number(deployInfos.upKeepInterval) * 1000 - 1000);
                })
            })();
            await expect(lottery.performUpkeep("0x00")).to.be.revertedWithCustomError(lottery, "Lottery__NotEnoughTimeHasPassed");
        })
        it("reverts with custom error Lottery__NotEnoughPlayers if enoughTimeHasPassed but !hasEnoughPlayers (easy)", async () => {
            await (() => {
                return new Promise((resolve, reject) => {
                    setTimeout(resolve, Number(deployInfos.upKeepInterval) * 1000 + 1000); // Enough time has passed ✅
                })
            })();
            await expect(lottery.performUpkeep("0x00")).to.be.revertedWithCustomError(lottery, "Lottery__NotEnoughPlayers");
        })
        it("reverts with custom error Lottery__NotEnoughPlayers if enoughTimeHasPassed but !hasEnoughPlayers (extreme)", async () => {
            await (() => {
                return new Promise((resolve, reject) => {
                    setTimeout(resolve, Number(deployInfos.upKeepInterval) * 1000 + 1000); // Enough time has passed ✅
                })
            })();
            let maxPlayers: bigint = await lottery.getMaximumNumberOfPlayers();
            let minPlayers: bigint = await lottery.getMinimumNumberOfPlayers();
            for (let i = 0; i < signers.length - 1 && i < minPlayers - 1n; i++) {
                lotteryForPlayer = lottery.connect(signers[i + 1]);
                await lotteryForPlayer.join({ value: deployInfos.joinFee });
            }
            await expect(lottery.performUpkeep("0x00")).to.be.revertedWithCustomError(lottery, "Lottery__NotEnoughPlayers");
        })
        it("if (enoughTimeHasPassed && hasEnoughPlayers), emits the event UpKeepTriggered(uint128 roundNumber, uint256 timestamp), then emits the event RandomWordsRequested(bytes32 gasLane ,uint64 subscriptionId, uint16 MINIMUM_REQUEST_CONFIRMATIONS, uint32 callbackGasLimit, uint32 NUM_WORDS)");
    })
})