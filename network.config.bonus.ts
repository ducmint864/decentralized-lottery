import "dotenv/config";
import {ethers} from "hardhat";

export const developmentChainIds = [1337, 31337];
export const networkConfig = {
    1337: {
        NAME: "ganache_localhost" as string,
        VRF_COORDINATOR_ADDRESS: "" as string,
        VRF_GAS_LANE: "0x0000000000000000000000000000000000000000000000000000000000000000" as string,
        VRF_SUBSCRIPTION_ID: 0 as number,
        LINK_ADDRESS: "0x000000000000000000000000000000000000000" as string,
        PRIZE: ethers.parseEther("1000") as bigint, // 1000 Eth
        JOIN_FEE: ethers.parseEther("3") as bigint, // 3 Eth
        CALL_BACK_GAS_LIMIT: BigInt(3000000) as bigint,
        UP_KEEP_INTERVAL: 30n as bigint
    },
    31337: {
        NAME: "hardhat_localhost" as string,
        VRF_COORDINATOR_ADDRESS: "" as string,
        VRF_GAS_LANE: "0x0000000000000000000000000000000000000000000000000000000000000000" as string,
        VRF_SUBSCRIPTION_ID: 0 as number,
        LINK_ADDRESS: "0x000000000000000000000000000000000000000" as string,
        PRIZE: ethers.parseEther("1000") as bigint, // 1000 Eth
        JOIN_FEE: ethers.parseEther("3") as bigint, // 3 Eth
        CALL_BACK_GAS_LIMIT: BigInt(3000000) as bigint,
        UP_KEEP_INTERVAL: 30n as bigint
    },
    11155111: {
        NAME: "sepolia_testnet",
        VRF_COORDINATOR_ADDRESS: "0x8103B0A8A00be2DDC778e6e7eaa21791Cd364625" as string, // hard-coded for sepolia
        VRF_GAS_LANE: "0x474e34a077df58807dbe9c96d3c009b23b3c6d0cce433e59bbf5b34f823bc56c" as string,
        VRF_SUBSCRIPTION_ID: 3813 as number,
        LINK_ADDRESS: "0x779877A7B0D9E8603169DdbD7836e478b4624789" as string,
        PRIZE: ethers.parseEther("0.1") as bigint, // 0.1 Eth
        JOIN_FEE: ethers.parseEther("0.03") as bigint, // 0.03 Eth
        CALL_BACK_GAS_LIMIT: BigInt(3000000) as bigint,
        UP_KEEP_INTERVAL: 6n as bigint
    }
}

