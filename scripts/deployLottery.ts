import { ethers, network } from "hardhat";
import { networkConfig } from "../network.config.bonus";
import { developmentChainIds } from "../network.config.bonus";
import { VRFCoordinatorV2Mock } from "../typechain-types";
import DeployInfos from "./DeployInfos.type";
import deployVRFCoordinatorV2Mock from "./mocks/deployVRFCoordinatorV2Mock"

async function deployLottery(verbose: boolean = true) {
    try {
        /**
         * @dev 0. Arrange
        */
        const CHAIN_ID: number = (network.config.chainId as number) ?? process.env.DEFAULT_CHAIN_ID;
        const IS_DEVELOPMENT_CHAIN: boolean = developmentChainIds.includes(CHAIN_ID);

        /**
         * @dev 1. Print network infos
        */
        if (verbose) {
            console.log("---------------------------- Contract deployment script ----------------------------\n");
            console.log("--> Network: {\n\tName: ", networkConfig[CHAIN_ID as keyof typeof networkConfig].NAME);
            console.log("\tChain-Id: ", CHAIN_ID);
            console.log("}");
        }

        /**
         * @dev 2. Extract network-dependent deploy parameters from networkConfig
        */
        let deployInfos: DeployInfos = {
            chainId: CHAIN_ID,
            isDevelopmentChain: IS_DEVELOPMENT_CHAIN,
            vrfSubscriptionId: networkConfig[CHAIN_ID as keyof typeof networkConfig].VRF_SUBSCRIPTION_ID as bigint,
            vrfGasLane: networkConfig[CHAIN_ID as keyof typeof networkConfig].VRF_GAS_LANE as string,
            prize: networkConfig[CHAIN_ID as keyof typeof networkConfig].PRIZE as bigint,
            ensure: networkConfig[CHAIN_ID as keyof typeof networkConfig].ENSURE as bigint,
            joinFee: networkConfig[CHAIN_ID as keyof typeof networkConfig].JOIN_FEE as bigint,
            callbackGasLimit: networkConfig[CHAIN_ID as keyof typeof networkConfig].CALL_BACK_GAS_LIMIT as bigint,
            upKeepInterval: networkConfig[CHAIN_ID as keyof typeof networkConfig].UP_KEEP_INTERVAL as bigint,

            vrfCoordinatorV2Address: await (async () => {
                /**Auto-detect type of network*/
                // if we're on a development blockchain(hardhat, ganache), we will deploy the mock VRFCoordinatorV2Mock
                let vrfCoordinatorV2Address: string;

                if (IS_DEVELOPMENT_CHAIN) {
                    // deploy VRFCoordinatorV2Mock contract
                    console.log(verbose ? "--> Local network detected! Deploying mock VRFCoordinatorV2Mock" : "")
                    vrfCoordinatorV2Address = await deployVRFCoordinatorV2Mock() ?? "";
                    console.log(verbose ? `VRFCoordinatorV2Mock contract has been deployed to address ${vrfCoordinatorV2Address}` : "");
                }

                // if we're on an online blockchain(testnets, mainnet), we will use the official VRFCoordinatorV2 contract provided by Chainlink
                else {
                    // get the address of the on-chain Chainlink VRFCoordinatorV2 contract
                    vrfCoordinatorV2Address = networkConfig[CHAIN_ID as keyof typeof networkConfig].VRF_COORDINATOR_ADDRESS;
                }

                return vrfCoordinatorV2Address;
            })() as string,

            // We don't initialize lotteryAddress property because we haven't deployed the Lottery(Mock) contract
            lotteryAddress: networkConfig[CHAIN_ID as keyof typeof networkConfig].LOTTERY_ADDRESS as string
        }

        /**
         * @dev 3. If on a local blockchain, subscribe to VRFCoordinatorV2Mock to get the subscriptionId
         */

        if (deployInfos.isDevelopmentChain) {
            let vrfCoordinatorV2Mock: VRFCoordinatorV2Mock = await ethers.getContractAt("VRFCoordinatorV2Mock", deployInfos.vrfCoordinatorV2Address);
            await vrfCoordinatorV2Mock.createSubscription();
            let subscriptionId: bigint = await vrfCoordinatorV2Mock.getCurrentSubId();
            deployInfos.vrfSubscriptionId = subscriptionId;
            console.log(verbose ? `Subscribed to VRFCoordinatorV2Mock. Subscription ID: ${deployInfos.vrfSubscriptionId}` : "");
        }


        /**
         * @dev 4. Deploy Lottery/LotteryMock contract depending on network
         * @dev If we've already deployed Lottery to a testnet/mainnet, we won't have to deploy it again
         */
        if (deployInfos.lotteryAddress == "") {
            let lotteryFactory = await ethers.getContractFactory(deployInfos.isDevelopmentChain ? "LotteryMock" : "Lottery");
            let lottery = await lotteryFactory.deploy(
                // pass in Lottery(Mock)'s constructor params
                deployInfos.prize,                      // i_prize
                deployInfos.ensure,                     // i_ensure
                deployInfos.joinFee,                    // i_joinFee
                deployInfos.vrfCoordinatorV2Address,    // i_vrfCoordinatorV2Address
                deployInfos.vrfGasLane,                 // i_gasLane
                deployInfos.vrfSubscriptionId,          // i_subscriptionId
                deployInfos.callbackGasLimit,           // i_callBackGasLimit
                deployInfos.upKeepInterval,             // i_upKeepInterval

                // overrides
                {
                    // value: deployInfos.isDevelopmentChain ? 0n : deployInfos.prize + ethers.parseEther("1")
                    value: 0n
                }
            )
            await lottery.waitForDeployment();
            deployInfos.lotteryAddress = await lottery.getAddress();
            if (verbose) {
                console.log(
                    (IS_DEVELOPMENT_CHAIN ? "LotteryMock" : "Lottery") + ` contract has been deployed to address ${deployInfos.lotteryAddress}`
                );
            }
        }
        else {
            console.log(verbose ? `Acquired Lottery contract from address ${deployInfos.lotteryAddress}` : "");
        }

        /**
         * @dev 5. If on a local blockchain, we have an additional step,
         * @dev that is to add LotteryMock as a new consumer of VRFCoordinatorV2Mock
        */
        if (deployInfos.isDevelopmentChain) {
            let vrfCooridnatorV2Mock: VRFCoordinatorV2Mock = await ethers.getContractAt("VRFCoordinatorV2Mock", deployInfos.vrfCoordinatorV2Address);
            await vrfCooridnatorV2Mock.addConsumer(deployInfos.vrfSubscriptionId as bigint, deployInfos.lotteryAddress as string);
            console.log(verbose ? `Added consumer to VRFCoordinatorV2Mock: {\n\tSubscription ID: ${deployInfos.vrfSubscriptionId}\n\tConsumer: ${deployInfos.lotteryAddress}\n}` : "");
        }

        /**
         * @dev Finished
        */
        console.log(verbose ? "------------------------------------------------------------------------------------" : "");
        return deployInfos;

    } catch (err: any) {
        console.log(err);
        throw new Error("-> Failed to deploy Lottery contract.");
    }
}

// Invoke deployLottery() with default parameters
deployLottery().catch((err: any) => {
    console.log(err);
})

export default deployLottery;