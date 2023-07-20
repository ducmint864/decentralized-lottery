import "dotenv/config";

export const networkConfig = {
    5777: {
        name: "ganache_localhost" as string,
        VRFv2CoordinatorAddress: "" as string,
        LinkAddress: ""  as string
    },
    31337: {
        name: "hardhat_localhost" as string,
        VRFV2CoordinatorAddress: "" as string,
        LinkAddress: "" as string
    },
    11155111: {
        name: "sepolia_testnet",
        VRFv2CoordinatorAddress: "0x8103B0A8A00be2DDC778e6e7eaa21791Cd364625" as string, // hard-coded for sepolia
        LinkAddress: "0x779877A7B0D9E8603169DdbD7836e478b4624789" as string
    }
}
