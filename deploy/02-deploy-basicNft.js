const { network } = require("hardhat")
const { verify } = require("../utils/verify")
const {developmentChains} = require("../helper-hardhat-config")

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy, log } = deployments
    const { deployer } = await getNamedAccounts()

    log("--------------------------------------")
    const args = []
    const bascinft = await deploy("BasicNft", {
        from: deployer,
        args: args,
        log: true,
        waitConfirmations: network.config.blockConfirmations || 1,
    })
    if (!developmentChains.includes(network.name)) {
        log("Verifying..")
        await verify(bascinft.address, args)

    }
}

module.exports.tags = ["all", "basicNft"]
