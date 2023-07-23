import { ethers, network } from "hardhat";
import { networkConfig } from "../network.config.bonus";
import { developmentChainIds } from "../network.config.bonus";
import deployVRFCoordinatorV2Mock from "./mocks/deployVRFCoordinatorV2Mock"


async function deployLottery(ethPrize: string = "10", callbackGaslimit: bigint = 2500000n, upKeepInterval: bigint = 60n) {
    try {
        const CHAIN_ID: number = (network.config.chainId as number) ?? process.env.DEFAULT_CHAIN_ID;
        /**1. Print network infos*/
        console.log("---------------------------- Contract deployment script ----------------------------\n");
        console.log("--> Network: {\n\tName: ", networkConfig[CHAIN_ID as keyof typeof networkConfig].NAME);
        console.log("\tChain-Id: ", CHAIN_ID);
        console.log("}");
        console.log("------------------------------------------------------------------------------------");

        /**2. Setup variables*/
        let isDevelopmentChain: boolean = developmentChainIds.includes(CHAIN_ID);
        let lotteryFactory;
        let lottery;
        let lotteryAddress;

        // extract network-dependent deploy parameters from networkConfig
        const DEPLOY_PARAMS = {
            VRF_SUBSCRIPTION_ID: networkConfig[CHAIN_ID as keyof typeof networkConfig].VRF_SUBSCRIPTION_ID as number,
            VRF_GAS_LANE: networkConfig[CHAIN_ID as keyof typeof networkConfig].VRF_GAS_LANE as string,
            PRIZE: networkConfig[CHAIN_ID as keyof typeof networkConfig].PRIZE as bigint,
            JOIN_FEE: networkConfig[CHAIN_ID as keyof typeof networkConfig].JOIN_FEE as bigint,
            CALLBACK_GAS_LIMIT: networkConfig[CHAIN_ID as keyof typeof networkConfig].CALL_BACK_GAS_LIMIT as bigint,
            UP_KEEP_INTERVAL: networkConfig[CHAIN_ID as keyof typeof networkConfig].UP_KEEP_INTERVAL as number,
            VRF_COORDINATOR_ADDRRESS: await (async () => {
                /**Auto-detect type of network*/
                // If we're on a development blockchain(hardhat, ganache), we will deploy the mock VRFCoordinatorV2Mock
                let vrfCoordinatorV2Address: string;

                if (isDevelopmentChain) {
                    // Deploy VRFCoordinatorV2Mock contract
                    console.log("--> Local network detected! Deploying mock VRFCoordinatorV2Mock")
                    vrfCoordinatorV2Address = await deployVRFCoordinatorV2Mock() ?? "";
                    console.log(`VRFCoordinatorV2Mock contract has been deployed to address ${vrfCoordinatorV2Address}`);
                }

                // If we're on an online blockchain(testnets, mainnet), we will use the official VRFCoordinatorV2 contract provided by Chainlink
                else {
                    // Gets address of the already on-chain Chainlink VRFCoordinatorV2 contract
                    vrfCoordinatorV2Address = networkConfig[CHAIN_ID as keyof typeof networkConfig].VRF_COORDINATOR_ADDRESS;
                }

                return vrfCoordinatorV2Address;
            })() as string
        }


        /**3.Deploy Lottery/LotteryMock contract*/
        lotteryFactory = await ethers.getContractFactory(isDevelopmentChain ? "LotteryMock" : "Lottery");
        lottery = await lotteryFactory.deploy(
            // Pass in Lottery(Mock)'s constructor params
            DEPLOY_PARAMS.PRIZE,                        // i_prize
            DEPLOY_PARAMS.JOIN_FEE,                     // i_joinFee
            DEPLOY_PARAMS.VRF_COORDINATOR_ADDRRESS,     // i_vrfCoordinatorV2Address
            DEPLOY_PARAMS.VRF_GAS_LANE,                 // i_gasLane
            DEPLOY_PARAMS.VRF_SUBSCRIPTION_ID,          // i_subscriptionId
            DEPLOY_PARAMS.CALLBACK_GAS_LIMIT,           // i_callBackGasLimit
            DEPLOY_PARAMS.UP_KEEP_INTERVAL,             // i_upKeepInterval

            // Overrides
            {
                value: ethers.parseEther(ethPrize + 1)
            })
        await lottery.waitForDeployment();
        lotteryAddress = await lottery.getAddress();

        /**4.Finished deploying, printing Lottery contracts' infos */
        console.log(
            (isDevelopmentChain ? "LotteryMock" : "Lottery") + ` contract has been deployed to address ${lotteryAddress}`
        );
        return [DEPLOY_PARAMS.VRF_COORDINATOR_ADDRRESS, lotteryAddress];

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