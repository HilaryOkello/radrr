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
    filecoin_calibration: {
      url: "https://api.calibration.node.glif.io/rpc/v1",
      chainId: 314159,
      accounts: DEPLOYER_KEY ? [DEPLOYER_KEY] : [],
    },
    filecoin_mainnet: {
      url: "https://api.node.glif.io/rpc/v1",
      chainId: 314,
      accounts: DEPLOYER_KEY ? [DEPLOYER_KEY] : [],
    },
  },
};
