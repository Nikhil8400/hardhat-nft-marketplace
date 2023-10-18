const { assert, expect } = require("chai")
const { network, deployments, ethers, getNamedAccounts } = require("hardhat")
const { developmentChains } = require("../../helper-hardhat-config")

!developmentChains.includes(network.name)
    ? describe.skip
    : describe("Nft Marketplace Unit Tests", () => {
          let nftMarketplaceContract,
              nftMarketplace,
              basicNft,
              basicNftContract,
              testHelper,
              testHelperContract
          const PRICE = ethers.utils.parseEther("0.1")
          const TOKEN_ID = 0
          let accounts, deployer
          beforeEach(async () => {
              accounts = await ethers.getSigners()
              deployer = accounts[0]
              player = accounts[1]
              await deployments.fixture(["all"])
              nftMarketplaceContract = await ethers.getContract("NftMarketplace") // THe way it works that it will automatically connect the contract to the deployer
              //If we want to call a function as a being a player then we can do this
              //   nftMarketplace = nftMarketplace.connect(player)   //Now whenever we will call the function we will use the player instead of the deployer
              //nftMarketplaceContract = await ethers.getContract("NftMarketplace", player)  // Or we can do this also
              nftMarketplace = nftMarketplaceContract.connect(deployer)
              basicNftContract = await ethers.getContract("BasicNft")
              testHelperContract = await ethers.getContract("TestHelper")

              basicNft = basicNftContract.connect(deployer)
              await basicNft.mintNft() // Deployer calling the minting function since the  deployer deployed the contract of the BasicNft
              await basicNft.approve(nftMarketplace.address, TOKEN_ID) //Approving the market place contract to sell the nft
          })
          it("list and can be bought", async () => {
              await nftMarketplaceContract.listItem(basicNft.address, TOKEN_ID, PRICE)
              const playerConnectedNftMarketplace = nftMarketplaceContract.connect(player)
              await playerConnectedNftMarketplace.buyItem(basicNft.address, TOKEN_ID, {
                  value: PRICE,
              })
              const newOwner = await basicNftContract.ownerOf(TOKEN_ID)
              const deployerProceeds = await nftMarketplaceContract.getProceeds(deployer.address)
              assert(newOwner.toString() == player.address)
              assert(deployerProceeds.toString() == PRICE.toString())
          })
          describe("listItem", () => {
              it("emits an event after listing an item", async () => {
                  expect(await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)).to.emit(
                      "ItemListed"
                  )
              })
              it("exclusively items that haven't been listed", async function () {
                  await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
                  await expect(
                      nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
                  ).to.be.revertedWith("AlreadyListed")
              })
              it("exclusively allows owner to list", async () => {
                  nftMarketplace = await nftMarketplaceContract.connect(player)
                  await basicNft.approve(player.address, TOKEN_ID)
                  await expect(
                      nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
                  ).to.be.revertedWith("NftMarketplace__NotOwner")
              })
              it("needs approval to list item", async () => {
                  await basicNft.approve(ethers.constants.AddressZero, TOKEN_ID)
                  await expect(
                      nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
                  ).to.be.revertedWith("NotApprovedForMarketplace")
              })
              it("reverts if the price be 0", async () => {
                  const ZERO_PRICE = ethers.utils.parseEther("0")
                  await expect(
                      nftMarketplace.listItem(basicNft.address, TOKEN_ID, ZERO_PRICE)
                  ).to.be.revertedWith("NftMarketplace__PriceMustBeAboveZero")
              })
          })
          describe("cancelListing", () => {
              it("reverts if there is no listing", async () => {
                  await expect(
                      nftMarketplace.cancelListing(basicNft.address, TOKEN_ID)
                  ).to.be.revertedWith("NftMarketplace__NotListed")
              })
              it("reverts if anyone other than  owner tries to call", async () => {
                  await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
                  nftMarketplace = nftMarketplaceContract.connect(player)
                  await basicNft.approve(player.address, TOKEN_ID)
                  await expect(
                      nftMarketplace.cancelListing(basicNft.address, TOKEN_ID)
                  ).to.be.revertedWith("NftMarketplace__NotOwner")
              })
              it("emits event and removes listing", async () => {
                  await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
                  expect(await nftMarketplace.cancelListing(basicNft.address, TOKEN_ID)).to.emit(
                      "ItemCanceled"
                  )
                  const listing = await nftMarketplace.getListing(basicNft.address, TOKEN_ID)
                  assert(listing.price.toString() == "0")
              })
          })
          describe("buyItem", () => {
              it("reverts if the item isnt listed", async () => {
                  await expect(
                      nftMarketplace.buyItem(basicNft.address, TOKEN_ID)
                  ).to.be.revertedWith("NotListed")
              })
              it("revert if price isnt met", async () => {
                  await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
                  await expect(
                      nftMarketplace.buyItem(basicNft.address, TOKEN_ID)
                  ).to.be.revertedWith("NftMarketplace__PriceNotMet")
              })
              it("transfer the nft to the buyer and update the internal proceeds record", async () => {
                  await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
                  nftMarketplace = nftMarketplaceContract.connect(player)
                  expect(
                      await nftMarketplace.buyItem(basicNft.address, TOKEN_ID, { value: PRICE })
                  ).to.emit("ItemBought")
                  const newOwner = await basicNft.ownerOf(TOKEN_ID)
                  const deployerProceeds = await nftMarketplace.getProceeds(deployer.address)
                  assert.equal(deployerProceeds.toString(), PRICE)
                  assert.equal(newOwner.toString(), player.address)
              })
          })
          describe("UpdateListing", () => {
              it("must be owner and listed", async () => {
                  await expect(
                      nftMarketplace.updateListing(basicNft.address, TOKEN_ID, PRICE)
                  ).to.be.revertedWith("NftMarketplace__NotListed")
                  await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
                  nftMarketplace = await nftMarketplaceContract.connect(player)
                  await expect(
                      nftMarketplace.updateListing(basicNft.address, TOKEN_ID, PRICE)
                  ).to.be.revertedWith("NftMarketplace__NotOwner")
              })
              it("reverts if new price is 0", async function () {
                  const updatedPrice = ethers.utils.parseEther("0")
                  await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
                  await expect(
                      nftMarketplace.updateListing(basicNft.address, TOKEN_ID, updatedPrice)
                  ).to.be.revertedWith("PriceMustBeAboveZero")
              })
              it("updates the price of item", async () => {
                  const updatePrice = ethers.utils.parseEther("0.02")
                  await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
                  await nftMarketplace.updateListing(basicNft.address, TOKEN_ID, updatePrice)
                  const updatedListing = await nftMarketplace.getListing(
                      basicNft.address,
                      TOKEN_ID
                  )
                  const updatedPrice = await updatedListing.price.toString()
                  assert.equal(updatedPrice, updatePrice.toString())
              })
          })
          describe("WithdrawProceeds", () => {
              it("does'nt allow 0 proceed withdrawls", async () => {
                  await expect(nftMarketplace.withdrawProceeds()).to.be.revertedWith(
                      "NftMarketplace__NoProceeds"
                  )
              })
              it("withdraw Proceeds", async () => {
                  const updateProceeds = ethers.utils.parseEther("0")
                  await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
                  nftMarketplace = nftMarketplaceContract.connect(player)
                  await nftMarketplace.buyItem(basicNft.address, TOKEN_ID, { value: PRICE })
                  const proceeds = await nftMarketplace.getProceeds(deployer.address)
                  assert.equal(proceeds.toString(), PRICE.toString())
                  nftMarketplace = nftMarketplaceContract.connect(deployer)
                  await nftMarketplace.withdrawProceeds()
                  const updatedProceeds = await nftMarketplace.getProceeds(deployer.address)
                  assert.equal(updateProceeds.toString(), updatedProceeds.toString())
              })
              it("Deployer rececived the proceeds", async () => {
                  await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
                  nftMarketplace = nftMarketplaceContract.connect(player)
                  await nftMarketplace.buyItem(basicNft.address, TOKEN_ID, { value: PRICE })
                  nftMarketplace = nftMarketplaceContract.connect(deployer)

                  const deployerProceedsBefore = await nftMarketplace.getProceeds(deployer.address)
                  const deployerBalanceBefore = await deployer.getBalance()
                  const txResponse = await nftMarketplace.withdrawProceeds()
                  const transactionReceipt = await txResponse.wait(1)
                  const { gasUsed, effectiveGasPrice } = transactionReceipt
                  const gasCost = gasUsed.mul(effectiveGasPrice)
                  const deployerBalanceAfter = await deployer.getBalance()
                  assert.equal(
                      deployerBalanceAfter.add(gasCost).toString(),
                      deployerProceedsBefore.add(deployerBalanceBefore).toString()
                  )
              })
              
          })
      })
