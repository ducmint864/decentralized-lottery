import "@nomicfoundation/hardhat-toolbox";
import "@nomicfoundation/hardhat-ethers"
import "hardhat-gas-reporter";
import "typechain"
import "solidity-coverage";
import "dotenv/config"
import { HardhatUserConfig } from "hardhat/types";

const PRIVATE_KEYS: string[] = process.env.PRIVATE_KEY?.split(" ") ?? [""];
const SEPOLIA_RPC_URL: string = process.env.SEPOLIA_RPC_URL ?? "";
const ETHERSCAN_API_KEY: string = process.env.ETHERSCAN_API_KEY ?? "";
const COINMARKETCAP_API_KEY: string = process.env.COINMARKETCAP_API_KEY ?? "";
const POLYGON_MUMBAI_RPC_URL: string = process.env.POLYGON_MUMBAI_RPC_URL ?? "";

const config: HardhatUserConfig = {
    solidity: "0.8.19",
    defaultNetwork: "hardhat_localhost",
    networks: {
        sepolia_testnet: {
            url: SEPOLIA_RPC_URL,
            accounts: PRIVATE_KEYS,
            chainId: 11155111,
        },
        hardhat_localhost: {
            url: process.env.HARDHAT_LOCALHOST_RPC_URL,
            chainId: 31337
        },
        ganache_localhost: {
            url: process.env.GANACHE_LOCALHOST_RPC_URL,
            chainId: 1337,
            accounts: ["0xb4da86fe60e59ae527c76f1be8e5171c6d4b25f81dc3bded8f239ea6cf028ac4"],
        },
        polygon_mumbai_testnet: {
            url: POLYGON_MUMBAI_RPC_URL,
            chainId: 80001,
            accounts: PRIVATE_KEYS,
        }
    },
    etherscan: {
        apiKey: ETHERSCAN_API_KEY,
    },
    gasReporter: {
        enabled: true,
        noColors: true,
        currency: 'USD',
        outputFile: "./artifacts/latest-gas-report",
        coinmarketcap: COINMARKETCAP_API_KEY
    },
};

export default config;