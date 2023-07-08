require("@nomiclabs/hardhat-waffle")
require("hardhat-gas-reporter")
require("@nomiclabs/hardhat-etherscan")
require("dotenv").config()
require("solidity-coverage")
require("hardhat-deploy")

const POLYGON_MUMBAI_RPC_URL = process.env.POLYGON_MUMBAI_RPC_URL
const POLYGON_PRIVATE_KEY = process.env.POLYGON_PRIVATE_KEY
const POLYGONSCAN_API_KEY = process.env.POLYGONSCAN_API_KEY

module.exports = {
    defaultNetwork: "hardhat",
    networks: {
        hardhat: {
            chainId: 31337,
        },
        polygon: {
            url: POLYGON_MUMBAI_RPC_URL,
            accounts: [POLYGON_PRIVATE_KEY],
            chainId: 80001,
            blockConfirmations: 6,
        },
    },
    solidity: {
        compilers: [
            {
                version: "0.8.17",
            },
        ],
    },
    etherscan: {
        apiKey: POLYGONSCAN_API_KEY,
    },
    gasReporter: {
        enabled: false,
        currency: "USD",
        outputFile: "gas-report.txt",
        noColors: true,
        // coinmarketcap: COINMARKETCAP_API_KEY,
    },
    namedAccounts: {
        deployer: {
            default: 0, // here this will by default take the first account as deployer
            1: 0,
        },
    },
    mocha: {
        timeout: 200000, // 200 seconds max for running tests
    },
}
