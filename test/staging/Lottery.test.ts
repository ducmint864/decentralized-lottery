import "@nomicfoundation/hardhat-ethers";
import "@nomicfoundation/hardhat-chai-matchers";
import { ethers, network } from "hardhat";
import { assert } from "chai";
import { Lottery, LotteryMock, VRFCoordinatorV2Mock } from "../../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers"
import { developmentChainIds } from "../../network.config.bonus";
import deployLottery from "../../scripts/deployLottery";
import DeployInfos from "../../scripts/DeployInfos.type";
import "dotenv/config";

const CHAIN_ID: number = network.config.chainId as number;

developmentChainIds.includes(CHAIN_ID) ? describe.skip :
describe("Lottery Staging Test", () => {
    /** Variables */
    let lottery: Lottery;
    let vrfCoordinatorV2: VRFCoordinatorV2Mock;
    let lotteryForPlayer: Lottery;
    let signers: HardhatEthersSigner[];
    let player: HardhatEthersSigner;
    let owner: HardhatEthersSigner;
    let deployInfos: DeployInfos;

    before(async () => {
        deployInfos = await deployLottery();
        lottery = await ethers.getContractAt("Lottery", deployInfos.lotteryAddress ?? "");
        vrfCoordinatorV2 = await ethers.getContractAt("VRFCoordinatorV2Mock", deployInfos.vrfCoordinatorV2Address);
        signers = await ethers.getSigners();
        owner = signers[0];
        player = signers[1];
        lotteryForPlayer = lottery.connect(player);

        // print infos about lottery
        console.log(`Lottery: {\n\tLottery address: ${deployInfos.lotteryAddress}\n\tCurrent round: ${await lottery.getRoundNumber()}\n\tNum. of players: ${await lottery.getNumberOfPlayers()}\n\tOwner: ${await lottery.getOwner()}\n}`);
    })

    after(async () => {
        // return left-over money to the owner
        console.log("Refunding to owner...");
        await lottery.closeLottery({
            gasLimit: 2500000
        });
    })

    describe("fulfillRandomWords()", () => {
        it("interacts with the Chainlink VRF to give us random words and award the winners then reset some variables", async () => {
            const maxPlayers: bigint = 30n; // hard-code to save gas
            const minPlayers: bigint = 10n; // hard-code to save gas
            const startingTimeStamp: bigint = await lottery.getLastTimeStamp();
            const winnerStartingBalance: bigint = await ethers.provider.getBalance(owner.address);
            const contractBalance: bigint = await ethers.provider.getBalance(deployInfos.lotteryAddress as string);

            await new Promise<void>(async (resolve, reject) => {
                try {
                    // setup PrizeAwarded listener
                    console.log("Setting up PrizeAwarded() listener...");
                    lottery.on("PrizeAwarded", async (_winner, _prizeRanking, _amount) => {
                        console.log(`-> PrizeAwarded event fired: {\n\twinner: ${_winner}\n\tprizeRanking: ${_prizeRanking}\n\tamount: ${_amount}\n}`);
                        // assertion
                        const endingNumberOfPlayers: bigint = await lottery.getNumberOfPlayers();
                        const endingTimeStamp: bigint = await lottery.getLastTimeStamp();
                        const winnerEndingBalance: bigint = await ethers.provider.getBalance(_winner);
                        assert.equal(endingNumberOfPlayers, 0n);
                        assert.isAbove(endingTimeStamp, startingTimeStamp);
                        assert.isAbove(winnerEndingBalance, winnerStartingBalance);
                        resolve();
                    })

                    // setup PrizeDismissed listener
                    console.log("Setting up PrizeDismissed() listener...");
                    lottery.on("PrizeDismissed", async (_prizeRanking) => {
                        console.log(`-> PrizeDismissed event was fired: {\n\tPrizeRanking: ${_prizeRanking}\n}`);
                        resolve();
                    })

                    // fund the lottery (but only fund just the amount of money)
                    console.log("Funding the lottery...");
                    await lottery.fund({ value: deployInfos.prize + deployInfos.ensure - contractBalance});

                    // fill lottery with max players
                    console.log("Filling the lottery with maximum amount of players...");
                    for (let i = 0; i < maxPlayers - 5n; i++) {
                        await lotteryForPlayer.join({ 
                            value: deployInfos.joinFee,
                            gasLimit: 2500000
                        });
                    }

                    // advance time (local network only)
                    // await ethers.provider.send("evm_increaseTime", [Number(deployInfos.upKeepInterval) + 10]);
                    // await ethers.provider.send("evm_mine", []);

                    // print infos (wait for 2 blocks before we print)
                    let oldBlockNumber = await ethers.provider.send("eth_blockNumber", []);
                    while (true) {
                        let currentBlockNumber = await ethers.provider.send("eth_blockNumber", []);
                        if (currentBlockNumber >= oldBlockNumber + 2)
                            break;
                    }
                    console.log(`Here are some infos before we call performUpKeep(): {\n\tcontract balance: ${await ethers.provider.getBalance(deployInfos.lotteryAddress as string)}\n\tNum. of players: ${await lottery.getNumberOfPlayers()}\n\ts_pendingRequest: ${await lottery.getPendingRequest()}\n}`);

                    // manually call performUpKeep() (local network only)
                    // console.log("Manually performUpKeep...");
                    // await lottery.performUpkeep("0x00");
                    // let requestId: bigint = await vrfCoordinatorV2.getCurrentRequestId();
                    // console.log("request id: ", requestId);
                    // await vrfCoordinatorV2.fulfillRandomWords(requestId, deployInfos.lotteryAddress as string);
                } catch(err: any) {
                    console.log(err);
                    reject(err);
                }
            })
        })
    })
})
