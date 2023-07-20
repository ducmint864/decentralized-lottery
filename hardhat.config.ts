import "@nomicfoundation/hardhat-toolbox";
import "@nomicfoundation/hardhat-ethers"
import "hardhat-gas-reporter";
import "typechain"
import "solidity-coverage";
import "dotenv/config"
import { HardhatUserConfig } from "hardhat/types";

const PRIVATE_KEY: string = process.env.PRIVATE_KEY ?? "";
const SEPOLIA_RPC_URL: string = process.env.SEPOLIA_RPC_URL ?? "";
const ETHERSCAN_API_KEY: string = process.env.ETHERSCAN_API_KEY ?? "";
const COINMARKETCAP_API_KEY: string = process.env.COINMARKETCAP_API_KEY ?? "";

const config: HardhatUserConfig = {
    solidity: "0.8.18",
    defaultNetwork: "hardhat_localhost",
    networks: {
        sepolia_testnet: {
            url: SEPOLIA_RPC_URL,
            accounts: [PRIVATE_KEY],
            chainId: 11155111,
        },
        hardhat_localhost: {
            url: process.env.HARDHAT_LOCALHOST_RPC_URL,
            chainId: 31337
        },
        ganache_localhost: {
            url: process.env.GANACHE_LOCALHOST_RPC_URL,
            chainId: 5777,
            accounts: ["0xfeb4285878f4b43556fabc6ade58b99e3ba91cbeeb7ada47e3f2ebab38adcbfa"],
        }
    },
    etherscan: {
        apiKey: ETHERSCAN_API_KEY,
    },
    gasReporter: {
        enabled: true,
        noColors: true,
        currency: 'USD',
        coinmarketcap: COINMARKETCAP_API_KEY
    },
};

export default config;