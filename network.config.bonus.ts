import "dotenv/config";
import {ethers} from "hardhat";

export const developmentChainIds = [1337, 31337];
export const networkConfig = {
    1337: {
        NAME: "ganache_localhost" as string,
        VRF_COORDINATOR_ADDRESS: "" as string,
        VRF_GAS_LANE: "0x0000000000000000000000000000000000000000000000000000000000000000" as string,
        VRF_SUBSCRIPTION_ID: 0n as bigint,
        LINK_ADDRESS: "0x000000000000000000000000000000000000000" as string,
        PRIZE: ethers.parseEther("1000") as bigint, // 1000 Eth
        ENSURE: ethers.parseEther("1") as bigint,
        JOIN_FEE: ethers.parseEther("3") as bigint, // 3 Eth
        CALL_BACK_GAS_LIMIT: BigInt(3000000) as bigint,
        UP_KEEP_INTERVAL: 30n as bigint,
        LOTTERY_ADDRESS: "" as string
    },
    31337: {
        NAME: "hardhat_localhost" as string,
        VRF_COORDINATOR_ADDRESS: "" as string,
        VRF_GAS_LANE: "0x0000000000000000000000000000000000000000000000000000000000000000" as string,
        VRF_SUBSCRIPTION_ID: 0n as bigint,
        LINK_ADDRESS: "0x000000000000000000000000000000000000000" as string,
        PRIZE: ethers.parseEther("1000") as bigint, // 1000 Eth
        ENSURE: ethers.parseEther("1") as bigint,
        JOIN_FEE: ethers.parseEther("3") as bigint, // 3 Eth
        CALL_BACK_GAS_LIMIT: BigInt(3000000) as bigint,
        UP_KEEP_INTERVAL: 30n as bigint,
        LOTTERY_ADDRESS: "" as string
    },
    11155111: {
        NAME: "sepolia_testnet",
        VRF_COORDINATOR_ADDRESS: "0x8103B0A8A00be2DDC778e6e7eaa21791Cd364625" as string, // hard-coded for sepolia
        VRF_GAS_LANE: "0x474e34a077df58807dbe9c96d3c009b23b3c6d0cce433e59bbf5b34f823bc56c" as string,
        VRF_SUBSCRIPTION_ID: 3813n as bigint,
        LINK_ADDRESS: "0x779877A7B0D9E8603169DdbD7836e478b4624789" as string,
        PRIZE: ethers.parseEther("0.01") as bigint, // 0.1 Eth
        ENSURE: ethers.parseEther("1") as bigint,
        JOIN_FEE: ethers.parseEther("0") as bigint, // 0.03 Eth
        CALL_BACK_GAS_LIMIT: BigInt(2500000) as bigint,
        UP_KEEP_INTERVAL: 60n as bigint,
        LOTTERY_ADDRESS: "0x42Be0470309EE7bDD338187E100053f413d00600" as string
    },
    80001: {
        NAME: "polygon_mumbai_testnet",
        VRF_COORDINATOR_ADDRESS: "0x7a1BaC17Ccc5b313516C5E16fb24f7659aA5ebed" as string,
        VRF_GAS_LANE: "0x4b09e658ed251bcafeebbc69400383d49f344ace09b9576fe248bb02c003fe9f" as string,
        VRF_SUBSCRIPTION_ID: 5555n as bigint,
        LINK_ADDRESS: "0x326C977E6efc84E512bB9C30f76E30c160eD06FB" as string,
        PRIZE: ethers.parseEther("0.01") as bigint,
        ENSURE: ethers.parseEther("1") as bigint,
        JOIN_FEE: ethers.parseEther("0") as bigint,
        CALL_BACK_GAS_LIMIT: BigInt(2500000) as bigint,
        UP_KEEP_INTERVAL: 60n as bigint,
        LOTTERY_ADDRESS: "0xF6457501f3f95106aCfB293f67a7dbE7B0BAb996" as string,
    }
}

