import { ethers } from "hardhat";

async function deployVRFCoordinatorV2Mock() {
    try {
        
        const VRFCOORDINATORV2MOCK_FACTORY = await ethers.getContractFactory("VRFCoordinatorV2Mock")
        const VRFCOORDINATORV2MOCK_CONTRACT = await VRFCOORDINATORV2MOCK_FACTORY.deploy(1, 1);
        const VRFCOORDINATOR_CONTRACT_ADDRESS = await VRFCOORDINATORV2MOCK_CONTRACT.getAddress();
        await VRFCOORDINATORV2MOCK_CONTRACT.waitForDeployment();
        console.log(`VRFCoordinatorV2Mock contract has been deployed to address ${VRFCOORDINATOR_CONTRACT_ADDRESS}`);
        return VRFCOORDINATOR_CONTRACT_ADDRESS;
        
    } catch (err: any) {
        console.log(err);
        throw new Error("->Failed to deploy VRFCoordinatorV2Mock contract." + err);
    }
}

export default deployVRFCoordinatorV2Mock;