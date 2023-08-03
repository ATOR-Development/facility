import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers'

describe("Facility contract", function () {

  async function deploy() {
    const Token = await ethers.getContractFactory('Token')
    const Facility = await ethers.getContractFactory('Facility')
    const [ admin, tester, operator ] = await ethers.getSigners()

    const token = await Token.deploy(100_000_000n * BigInt(10e18))
    const tokenAddress = await token.getAddress()

    const facility = await upgrades.deployProxy(
      Facility,
      [ tokenAddress, operator.address ]
    )
    await facility.waitForDeployment()
    const facilityAddress = await facility.getAddress()

    return {
      Facility,
      facility,
      facilityAddress,
      admin,
      tester,
      operator,
      token,
      tokenAddress
    }
  }

  it('Deploys with a reference to provided token contract address', async () => {
    const { facility, tokenAddress } = await loadFixture(deploy)
    expect(await facility.tokenAddress()).to.equal(tokenAddress)
  })

  it('Emits an event when eth-for-gas budget is updated for a given address', async () => {
    const { facility, operator, tester } = await loadFixture(deploy)
    
    const previousBalance = await ethers.provider.getBalance(operator.address);

    const transferAmount = ethers.parseEther("0.0123");
    // Send ETH to the contract's address from tester
    await tester.sendTransaction({
      to: facility.getAddress(),
      value: transferAmount,
    });

    const newBalance = await ethers.provider.getBalance(operator.address);
    expect(newBalance).to.equal(transferAmount + previousBalance);

    // @ts-ignore
    await expect(facility.connect(tester).requestUpdate())
      .to.emit(facility, "RequestingUpdate")
      .withArgs(tester.address)
  })
  
  it('Reverts when requesting update and no eth-for-gas budget', async () => {
    const { facility, tester } = await loadFixture(deploy)
    
    // @ts-ignore
    await expect(facility.connect(tester).requestUpdate()).to.be.revertedWith(
      'Facility: requires user provided gas budget to create allocation updates'
    )
  })

  it('Receives and requests updates in a single call', async () => {
    const { facility, operator, tester } = await loadFixture(deploy)

    const previousBalance = await ethers.provider.getBalance(operator.address)

    const value = ethers.parseEther('0.0123')
    // @ts-ignore
    await expect(facility.connect(tester).receiveAndRequestUpdate({ value }))
      .to.emit(facility, 'RequestingUpdate')
      .withArgs(tester.address)

    const newBalance = await ethers.provider.getBalance(operator.address)
    expect(newBalance).to.equal(value + previousBalance)
  })

  it('Updates token allocation for a given address, tracking budget', async () => {
    const { facility, operator, tester } = await loadFixture(deploy)    
    const newValue = 1_500_100_900
    console.log(`Address: ${operator.address} ${tester.address}`)
    await expect(
      // @ts-ignore
      facility.connect(operator).updateAllocation(tester.address, newValue)
    ).to.emit(facility, "AllocationUpdated")
      .withArgs(tester.address, newValue)

    const GAS_PRICE: bigint = await facility.GAS_PRICE()
    const GAS_COST: bigint = await facility.GAS_COST()
    const requiredBudget = GAS_PRICE * GAS_COST

    const operatorUsedBudget = await facility.usedBudget(operator.address)
    expect(operatorUsedBudget).to.equal(0n)
    const testerUsedBudget = await facility.usedBudget(tester.address)
    expect(testerUsedBudget).to.equal(requiredBudget)
  })

  it('Allows claiming tokens allocated to a given address', async () => {
    const {
      admin,
      facility,
      facilityAddress,
      operator,
      tester,
      token 
    } = await loadFixture(deploy)
    const newValue = 1_500_300_500

    // @ts-ignore
    await token.connect(admin).transfer(
      facilityAddress,
      2_000_000n * BigInt(10e18)
    )

    // @ts-ignore
    await facility.connect(operator).updateAllocation(tester.address, newValue)

    await expect(
      // @ts-ignore
      facility.connect(tester).claimAllocation()
    ).to.emit(facility, "AllocationClaimed")
      .withArgs(tester.address, newValue)
  })

  it.skip('Requires available eth-for-gas to be greater than used to request update', async() => {

  })
  
  it('Requires budget be greater than required amount to request update')

  it('Updates and delivers claimable tokens in one step')

  it('Ignores unauthorized token allocation updates')

  it('Prevents claiming tokens when not enough are available')

  it('Prevents claiming tokens when none are allocated')

  it('Prevents claiming tokens when already at limit')

});
