import { ethers } from "hardhat";

async function deployVRFCoordinatorV2Mock() {
    try {
        /**Variables */
        let vrfCoordinatorV2MockFactory;
        let vrfCoordinatorV2Mock;
        let vrfCoordinatorV2MockAddress: string;

        /**Deploy contract */
        vrfCoordinatorV2MockFactory = await ethers.getContractFactory("VRFCoordinatorV2Mock");
        vrfCoordinatorV2Mock = await vrfCoordinatorV2MockFactory.deploy(1, 1);
        await vrfCoordinatorV2Mock.waitForDeployment();
        vrfCoordinatorV2MockAddress = await vrfCoordinatorV2Mock.getAddress();

        return vrfCoordinatorV2MockAddress;
    } catch (err: any) {
        console.log(err);
        throw new Error("-> Failed to deploy VRFCoordinatorV2Mock contract");
    }
}

export default deployVRFCoordinatorV2Mock;