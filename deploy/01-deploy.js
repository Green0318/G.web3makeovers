const { network } = require('hardhat')
const { developmentChains } = require('../helper-hardhat-config')
const { verify } = require('../utils/verify')

module.exports = async function ({ getNamedAccounts, deployments }) {
    const { deploy, log } = deployments
    const { deployer } = await getNamedAccounts()

    log('--------------------')
    const args = []
    const web3Makeovers = await deploy('Web3Makeovers', {
        from: deployer,
        args: args,
        log: true,
        waitConfirmations: network.config.blockConfirmations || 1,
    })

    if (!developmentChains.includes(network.name) && process.env.POLYGONSCAN_API_KEY) {
        log('verifying...')
        await verify(web3Makeovers.address, args)
    }
}
module.exports.tags = ['all', 'main']
