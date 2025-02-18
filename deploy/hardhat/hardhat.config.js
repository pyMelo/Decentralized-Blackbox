// Load environment variables from .env file
require("@nomicfoundation/hardhat-toolbox");

// Optional: Debugging line to check if PRIVATE_KEY is loaded

module.exports = {
  solidity: "0.8.18", // Specify the Solidity version
  networks: {
    IotaTestnet: {
      url: "https://json-rpc.evm.testnet.iotaledger.net", // Shimmer EVM RPC URL
      accounts: [`0x28967896ff0de742dec1873334c0782107f5e348b1163875438792170a96a279`]    },
  },
  paths: {
    sources: "./contracts", // Replace with your contracts directory path
  },
};  


