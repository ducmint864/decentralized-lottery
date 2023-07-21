import "dotenv/config";

export const developmentChainIds = [1337, 31337];
export const networkConfig = {
    1337: {
        NAME: "ganache_localhost" as string,
        VRF_COORDINATOR_ADDRESS: "" as string,
        VRF_GAS_LANE: "",
        LINK_ADDRESS: ""  as string
    },
    31337: {
        NAME: "hardhat_localhost" as string,
        VRF_COORDINATOR_ADDRESS: "" as string,
        VRF_GAS_LANE: "",
        LINK_ADDRESS: "" as string
    },
    11155111: {
        NAME: "sepolia_testnet",
        VRF_COORDINATOR_ADDRESS: "0x8103B0A8A00be2DDC778e6e7eaa21791Cd364625" as string, // hard-coded for sepolia
        VRF_GAS_LANE: "0x474e34a077df58807dbe9c96d3c009b23b3c6d0cce433e59bbf5b34f823bc56c",
        LINK_ADDRESS: "0x779877A7B0D9E8603169DdbD7836e478b4624789" as string
    }
}

