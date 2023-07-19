import { ethers, network } from "hardhat";
import { networkConfig } from "../network.config.bonus";
import deployVRFCoordinatorV2Mock from "./deployVRFCoordinatorV2Mock"

async function deployLottery(ethAmount: string) {
    try {

        // Print network info
        const chainId: number = (network.config.chainId as number) ?? process.env.DEFAULT_CHAIN_ID;

        console.log("---------------------------- Contract deployment script ----------------------------\n");
        console.log("--> Network: {\n\tName: ", networkConfig[chainId as keyof typeof networkConfig].name);
        console.log("\tChain-Id: ", chainId);
        console.log("}");
        console.log("------------------------------------------------------------------------------------");


        // Deploy VRFCoordinatorV2Mock contract first
        const VRFCOORDINATORV2MOCK_CONTRACT_ADDRESS = await deployVRFCoordinatorV2Mock()


        // Then deploy Lottery contract
        const LOTTERY_FACTORY = await ethers.getContractFactory("Lottery");
        const LOTTERY_CONTRACT = await LOTTERY_FACTORY.deploy(VRFCOORDINATORV2MOCK_CONTRACT_ADDRESS, {
            value: ethers.parseEther(ethAmount)
        })
        await LOTTERY_CONTRACT.waitForDeployment();
        const LOTTERY_CONTRACT_ADDRESS = await LOTTERY_CONTRACT.getAddress();
        console.log(`Lottery contract has been deployed to address ${LOTTERY_CONTRACT_ADDRESS}`);
        return [LOTTERY_CONTRACT_ADDRESS, VRFCOORDINATORV2MOCK_CONTRACT_ADDRESS];
        
    } catch (err: any) {
        console.log(err);
        throw new Error("->Failed to deploy Lottery contract.");
    }
}

// // Invoke deployLottery()
// (async () => {
//     await deployLottery("1").then().catch((err: Error) => {
//         console.log(err.message);
//     });
// })();

export default deployLottery;