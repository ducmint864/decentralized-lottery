import {ethers, network} from "hardhat";
import { networkConfig } from "../network.config.bonus";
import deployVRFCoordinatorV2Mock from "./deployVRFCoordinatorV2Mock"

async function deployLottery() {
    try {
        // Print network info
        const chainId: number = (network.config.chainId as number) ?? process.env.DEFAULT_CHAIN_ID;
        
        console.log("---------------------------- Contract deployment script ----------------------------\n");
        console.log("--> Network: {\n\tName: ", networkConfig[chainId as keyof typeof networkConfig].name);
        console.log("\tChain-Id: ", chainId);
        console.log("}");
        console.log("------------------------------------------------------------------------------------");
        
        // error-handling
        const VRFCOORDINATOR_CONTRACT_ADDRESS: string = await deployVRFCoordinatorV2Mock() ?? "";
        if (VRFCOORDINATOR_CONTRACT_ADDRESS == "") {
            throw new Error("Failed to get address of VRFCoordinatorV2Mock contract");
        }

        const LOTTERY_FACTORY = await ethers.getContractFactory("Lottery"); 
        const LOTTERY_CONTRACT = await LOTTERY_FACTORY.deploy(VRFCOORDINATOR_CONTRACT_ADDRESS, {
            value : ethers.parseEther("1000")
        }); // deploys contract with initial balance of 10000 Eth
        const LOTTERY_CONTRACT_ADDRESS = await LOTTERY_CONTRACT.getAddress();
        console.log(`Lottery contract has been deployed to address ${LOTTERY_CONTRACT_ADDRESS}`);
        return await LOTTERY_CONTRACT_ADDRESS;

    } catch (err: any) {
        console.log("-> Failed to deploy Lottery contract. Reason^: ", err);
    }
}

// Invoke deployLottery()
(async () => {
    await deployLottery();
})();

export default deployLottery;