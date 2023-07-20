import { ethers } from "hardhat";
import { assert, expect } from "chai"
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { Lottery, Lottery__factory } from "../typechain-types"
import deployLottery from "../scripts/deployLottery";
import { CompilationJobCreationErrorReason } from "hardhat/types";


describe("Lottery", async () => {
    /**Variables */
    let LOTTERY_CONTRACT: Lottery;
    let LOTTERY_CONTRACT_ADDRESS: string;
    let VRFCOORDINATORV2MOCK_CONTRACT_ADDRESS: string;
    let DEFAULT_SIGNER: HardhatEthersSigner;
    let SIGNERS: HardhatEthersSigner[];
    const JOIN_FEE: number = 3000000000000000;
    const PRIZE: bigint = ethers.parseEther("1000");


    /**Before all */
    before(async () => {
        // Contract should be deployed just fine if funded >= 1000 Eth on startup
        SIGNERS = await ethers.getSigners();
        DEFAULT_SIGNER = SIGNERS[0];
        [LOTTERY_CONTRACT_ADDRESS, VRFCOORDINATORV2MOCK_CONTRACT_ADDRESS] = await deployLottery("1000") ?? ["", ""];
        // Note: LOTTERY_CONTRACT is already deployed by and connected to DEFAULT_SIGNER (this is a feature of hardhat)
        LOTTERY_CONTRACT = await ethers.getContractAt("Lottery", LOTTERY_CONTRACT_ADDRESS);
    })

    describe("constructor()", async () => {
        it("Reverts if not funded >= 1000 Eth on deployment", async () => {
            await expect(deployLottery("999")).to.be.rejectedWith("->Failed to deploy Lottery contract.");
        })

        it("Initializes the Lottery contract with the correct VRFCoordinatorV2Mock contract's address", async () => {
            assert.equal(await LOTTERY_CONTRACT.getMockContractAddress(), VRFCOORDINATORV2MOCK_CONTRACT_ADDRESS);
        })

        // it("Emits event ContractFunded(msg.sender, msg.value)", async () => { });

        // it("Creates a new VRFCoordinatorV2Mock subscription", async () => { });

        // it("Registers itself as a consumer of that subscription", async () => { });

        // it("Tops up an amount of 100000000000000000000000 to that subscription", async () => { });
    })

    describe("join()", async () => {
        it("Doesn't allow the owner to join even if they pays enough fee", async () => {
            await expect(LOTTERY_CONTRACT.join({ value: BigInt(JOIN_FEE) })).to.be.revertedWithCustomError(LOTTERY_CONTRACT, "Lottery__NotAllowedToJoin()");
        })

        it("Doesn't allow anyone to join if they don't pay enough fee even if they're not the owner", async () => {
            let connectedContract: Lottery;
            for (let i = 1; i < SIGNERS.length; i++) {
                connectedContract = LOTTERY_CONTRACT.connect(SIGNERS[i]);
                await expect(connectedContract.join({ value: ethers.parseEther("0") })).to.be.revertedWithCustomError(connectedContract, "Lottery__NotEnoughFee()");
            }
        })

        it("Allows everybody except the owner to join if they pays enough fee", async () => {
            let connectedContract: Lottery;
            for (let i = 1; i < SIGNERS.length; i++) {
                connectedContract = LOTTERY_CONTRACT.connect(SIGNERS[i]);
                await expect(connectedContract.join({ value: BigInt(JOIN_FEE) })).to.not.be.revertedWithCustomError(connectedContract, "Lottery__NotEnoughFee()");
                assert.equal(await SIGNERS[i].getAddress(), await connectedContract.getPlayer(BigInt(i - 1)));
            }
        })
    })

    describe("fund()", async () => {
        it("Allows everybody to voluntarily fund the contract", async () => {
            let contractBalanceBefore: bigint = await ethers.provider.getBalance(LOTTERY_CONTRACT_ADDRESS);
            let sendAmount: bigint = ethers.parseEther("10");
            await LOTTERY_CONTRACT.fund({ value: sendAmount });
            let contractBalanceAfter: bigint = await ethers.provider.getBalance(LOTTERY_CONTRACT_ADDRESS);
            assert.equal(contractBalanceBefore, contractBalanceAfter - sendAmount);
        })
    })

    describe("getNumberOfPlayers()", async () => {
        it("It returns the correct number of players that has joined the ltotery", async () => {
            assert.equal(BigInt(SIGNERS.length - 1), await LOTTERY_CONTRACT.getNumberOfPlayers())
        })
    })

    describe("getPlayer()", async () => {
        it("Returns the correct player at a given index", async () => {
            assert.equal(SIGNERS[1].address, await LOTTERY_CONTRACT.getPlayer(BigInt(0)));
        })
    })

    describe("getMockContractAddress()", async () => {
        it("Returns the correct VRFCoordinatorV2Mock contract's address", async () => {
            assert.equal(VRFCOORDINATORV2MOCK_CONTRACT_ADDRESS, await LOTTERY_CONTRACT.getMockContractAddress());
        })
    })

    describe("getRandomWords()", async () => {
        it("Doesn't allow anyone except the owner to be able to call it", async () => {
            let connectedContract: Lottery = LOTTERY_CONTRACT.connect(SIGNERS[1]);
            await expect(connectedContract.getRandomWords(BigInt(1))).to.be.revertedWithCustomError(connectedContract, "Lottery__NotOwner");
        })

        it("Should return 3 distinct words in a single call", async () => {
            let randomWords: bigint[] = await LOTTERY_CONTRACT.getRandomWords(BigInt(3)) as bigint[];
            console.log("randomWords[]: ", randomWords);

            assert.notEqual(randomWords[0], randomWords[1]);
            assert.notEqual(randomWords[0], randomWords[2]);
            assert.notEqual(randomWords[1], randomWords[2]);
        })

        it("Should return 6 distinct words in 2 calls", async () => {
            // Arrange
            let randomWords1: bigint[] = await LOTTERY_CONTRACT.getRandomWords(BigInt(3)) as bigint[];
            let randomWords2: bigint[] = await LOTTERY_CONTRACT.getRandomWords(BigInt(3)) as bigint[];
            console.log("randomWords1[]: ", randomWords1);
            console.log("randomWords2[]: ", randomWords2);

            // Assert
            assert.notEqual(randomWords1[0], randomWords1[1]);
            assert.notEqual(randomWords1[0], randomWords1[2]);
            assert.notEqual(randomWords1[1], randomWords1[2]);
            assert.notEqual(randomWords2[0], randomWords2[1]);
            assert.notEqual(randomWords2[0], randomWords2[2]);
            assert.notEqual(randomWords2[1], randomWords2[2]);

            for (let i = 0; i < randomWords1.length; i++) {
                for (let j = 0; j < randomWords2.length; j++) {
                    assert.notEqual(randomWords1[i], randomWords2[j]);
                }
            }
        })
    })

    describe("getIndexOfWinner()", async () => {
        it("Doesn't allow anyone except the owner to be able to call it", async () => {
            let connectedContract: Lottery = await LOTTERY_CONTRACT.connect(SIGNERS[1]);
            await expect(connectedContract.getIndexOfWinner()).to.be.revertedWithCustomError(connectedContract, "Lottery__NotOwner");
        })

        it("Returns a number >= 0", async () => {
            let txResponse;
            let txReceipt;
            let indexOfWinner: bigint;
            for (let i = 0; i < 100; i++) {
                txResponse = await LOTTERY_CONTRACT.getIndexOfWinner();
                txReceipt = await txResponse.wait();
                indexOfWinner = txReceipt.data;
                assert.isAtLeast(indexOfWinner, BigInt(0));
            }
        })
    })

    describe("findAndAwardWinners()", async () => {
        it("Correctly finds 1 winner of any given prize ranking and transfer money to their account", async () => {
            // listen for events 
        })
    })


})