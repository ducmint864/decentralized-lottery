import "dotenv/config";

export const developmentChainIds = [1337, 31337];
export const networkConfig = {
    1337: {
        name: "ganache_localhost" as string,
        VRFCoordinatorV2Address: "" as string,
        LinkAddress: ""  as string
    },
    31337: {
        name: "hardhat_localhost" as string,
        VRFCoordinatorV2Address: "" as string,
        LinkAddress: "" as string
    },
    11155111: {
        name: "sepolia_testnet",
        VRFCoordinatorV2Address: "0x8103B0A8A00be2DDC778e6e7eaa21791Cd364625" as string, // hard-coded for sepolia
        LinkAddress: "0x779877A7B0D9E8603169DdbD7836e478b4624789" as string
    }
}

