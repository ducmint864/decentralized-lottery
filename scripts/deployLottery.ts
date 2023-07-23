import { ethers, network } from "hardhat";
import { networkConfig } from "../network.config.bonus";
import { developmentChainIds } from "../network.config.bonus";
import DeployInfos from "./DeployInfos.type";
import deployVRFCoordinatorV2Mock from "./mocks/deployVRFCoordinatorV2Mock"

async function deployLottery() {
    try {
        /**0. Arrange */
        const CHAIN_ID: number = (network.config.chainId as number) ?? process.env.DEFAULT_CHAIN_ID;
        const IS_DEVELOPMENT_CHAIN: boolean = developmentChainIds.includes(CHAIN_ID);

        /**1. Print network infos*/
        console.log("---------------------------- Contract deployment script ----------------------------\n");
        console.log("--> Network: {\n\tName: ", networkConfig[CHAIN_ID as keyof typeof networkConfig].NAME);
        console.log("\tChain-Id: ", CHAIN_ID);
        console.log("}");
        console.log("------------------------------------------------------------------------------------");

        /**2. extract network-dependent deploy parameters from networkConfig*/
        //Note, this deployInfos is an object that stores all the informations that reflects the deployment process of contracts and it will later be returned by this function
        let deployInfos: DeployInfos = {
            chainId: CHAIN_ID,
            isDevelopmentChain: IS_DEVELOPMENT_CHAIN,
            vrfSubscriptionId: networkConfig[CHAIN_ID as keyof typeof networkConfig].VRF_SUBSCRIPTION_ID as number,
            vrfGasLane: networkConfig[CHAIN_ID as keyof typeof networkConfig].VRF_GAS_LANE as string,
            prize: networkConfig[CHAIN_ID as keyof typeof networkConfig].PRIZE as bigint,
            joinFee: networkConfig[CHAIN_ID as keyof typeof networkConfig].JOIN_FEE as bigint,
            callbackGasLimit: networkConfig[CHAIN_ID as keyof typeof networkConfig].CALL_BACK_GAS_LIMIT as bigint,
            upKeepInterval: networkConfig[CHAIN_ID as keyof typeof networkConfig].UP_KEEP_INTERVAL as bigint,

            vrfCoordinatorV2Address: await (async () => {
                /**Auto-detect type of network*/
                // If we're on a development blockchain(hardhat, ganache), we will deploy the mock VRFCoordinatorV2Mock
                let vrfCoordinatorV2Address: string;

                if (IS_DEVELOPMENT_CHAIN) {
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
            })() as string,
            
            // We don't initialize lotteryAddress because we haven't deployed the Lottery(Mock) contract
            }


        /**3.Deploy Lottery/LotteryMock contract*/
        let lotteryFactory = await ethers.getContractFactory(IS_DEVELOPMENT_CHAIN ? "LotteryMock" : "Lottery");
        let lottery = await lotteryFactory.deploy(
            // Pass in Lottery(Mock)'s constructor params
            deployInfos.prize,                        // i_prize
            deployInfos.joinFee,                     // i_joinFee
            deployInfos.vrfCoordinatorV2Address,     // i_vrfCoordinatorV2Address
            deployInfos.vrfGasLane,                 // i_gasLane
            deployInfos.vrfSubscriptionId,          // i_subscriptionId
            deployInfos.callbackGasLimit,           // i_callBackGasLimit
            deployInfos.upKeepInterval,             // i_upKeepInterval

            // Overrides
            {
                value: deployInfos.prize + ethers.parseEther("1")
            })
        await lottery.waitForDeployment();
        deployInfos.lotteryAddress = await lottery.getAddress();

        /**4.Finished deploying, printing Lottery contracts' infos */
        console.log(
            (IS_DEVELOPMENT_CHAIN ? "LotteryMock" : "Lottery") + ` contract has been deployed to address ${deployInfos.lotteryAddress}`
        );
        return deployInfos;

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