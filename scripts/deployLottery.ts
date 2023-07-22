import { ethers, network } from "hardhat";
import { networkConfig } from "../network.config.bonus";
import { developmentChainIds } from "../network.config.bonus";
import deployVRFCoordinatorV2Mock from "./mocks/deployVRFCoordinatorV2Mock"


async function deployLottery(ethPrize: string = "10", callbackGaslimit: bigint = 2500000n, upKeepInterval: bigint = 60n) {
    try {

        /**Variables */
        const CHAIN_ID: number = (network.config.chainId as number) ?? process.env.DEFAULT_CHAIN_ID;
        const VRF_SUBSCRIPTION_ID: number = networkConfig[CHAIN_ID as keyof typeof networkConfig].VRF_SUBSCRIPTION_ID;
        const VRF_GAS_LANE: string = networkConfig[CHAIN_ID as keyof typeof networkConfig].VRF_GAS_LANE;
        let vrfCoordinatorV2Address: string;
        let lotteryFactory;
        let lottery;
        let lotteryAddress;
        let isDevelopmentChain: boolean = developmentChainIds.includes(CHAIN_ID);

        /**Print network infos*/
        console.log("---------------------------- Contract deployment script ----------------------------\n");
        console.log("--> Network: {\n\tName: ", networkConfig[CHAIN_ID as keyof typeof networkConfig].NAME);
        console.log("\tChain-Id: ", CHAIN_ID);
        console.log("}");
        console.log("------------------------------------------------------------------------------------");


        /**Auto-detect type of network*/
        // If we're on a development blockchain(hardhat, ganache), we will deploy the mock contracts
        if (isDevelopmentChain) {
            // Deploy VRFCoordinatorV2Mock contract
            vrfCoordinatorV2Address = await deployVRFCoordinatorV2Mock();
            console.log(`VRFCoordinatorV2Mock contract has been deployed to address ${vrfCoordinatorV2Address}`);
        }

        // If we're on an online blockchain(testnets, mainnet), we will use the official VRFCoordinatorV2 contract provided by Chainlink
        else {
            // Gets address of the already on-chain Chainlink VRFCoordinatorV2 contract
            vrfCoordinatorV2Address = networkConfig[CHAIN_ID as keyof typeof networkConfig].VRF_COORDINATOR_ADDRESS ?? "";
        }

        // Then deploy Lottery/LotteryMock contract
        lotteryFactory = await ethers.getContractFactory(isDevelopmentChain ? "LotteryMock" : "Lottery");
        lottery = await lotteryFactory.deploy(
            // Constructor's params
            ethers.parseEther(ethPrize), // i_prize
            BigInt(3000000000000000),     // i_joinFee
            vrfCoordinatorV2Address,      // i_vrfCoordinatorV2Address
            VRF_GAS_LANE,                 // i_gasLane
            VRF_SUBSCRIPTION_ID,          // i_subscriptionId
            callbackGaslimit,             // i_callBackGasLimit
            upKeepInterval,               // i_upKeepInterval

            // Overrides
            {
                value: ethers.parseEther(ethPrize + 1)
            })
        await lottery.waitForDeployment();
        lotteryAddress = await lottery.getAddress();

        /**Finished deploying, printing Lottery contracts' infos */
        console.log(
            (isDevelopmentChain ? "LotteryMock" : "Lottery") + ` contract has been deployed to address ${lotteryAddress}`
        );
        return [vrfCoordinatorV2Address, lotteryAddress];

    } catch (err: any) {
        console.log(err);
        throw new Error("->Failed to deploy Lottery contract.");
    }
}

// Invoke deployLottery() with default parameters
deployLottery().catch((err: any) => {
    console.log(err);
})

export default deployLottery;