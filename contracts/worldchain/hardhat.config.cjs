require("@nomicfoundation/hardhat-toolbox");
const { config: dotenv } = require("dotenv");
const { resolve } = require("path");

dotenv({ path: resolve(__dirname, "../../.env.local") });

const DEPLOYER_KEY = process.env.EVM_PLATFORM_PRIVATE_KEY;

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  paths: {
    sources:   "./src",
    cache:     "./cache",
    artifacts: "./artifacts",
  },
  solidity: {
    version: "0.8.20",
    settings: { optimizer: { enabled: true, runs: 200 }, viaIR: true },
  },
  networks: {
    worldchain_testnet: {
      url: "https://worldchain-sepolia.g.alchemy.com/public",
      chainId: 4801,
      accounts: DEPLOYER_KEY ? [DEPLOYER_KEY] : [],
    },
    worldchain_mainnet: {
      url: "https://worldchain-mainnet.g.alchemy.com/public",
      chainId: 480,
      accounts: DEPLOYER_KEY ? [DEPLOYER_KEY] : [],
    },
  },
};
