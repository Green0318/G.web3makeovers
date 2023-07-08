const { assert, expect } = require('chai')
const { ethers } = require('hardhat')

describe('Web3MakeoversSoulbounds', async function () {
    let accounts, owner, user, admin, w3mContract, w3m
    beforeEach(async function () {
        accounts = await ethers.getSigners()
        owner = accounts[0]
        user = accounts[1]
        admin = accounts[2]

        w3mContract = await ethers.getContractFactory('Web3Makeovers')
        w3m = await w3mContract.deploy()
        await w3m.deployed()
        await w3m.grantRole(await w3m.ADMIN_ROLE(), admin.address)
    })

    it('Token initialized, token URI, soulbound status correct and it emits event', async () => {
        expect(await w3m.initializeToken('0', 'TOKENURI', '0', false, true)).to.emit(
            'TokenInitialized'
        )
        assert.equal(await w3m.uri(0), 'TOKENURI')
        assert.equal(await w3m.isSoulbound(0), true)
    })
    it('Reverts if try initialize token that already initialized', async () => {
        await w3m.initializeToken('0', 'TOKENURI', '0', false, true)
        await expect(w3m.initializeToken('0', 'TOKENURI', '0', false, true)).to.be.revertedWith(
            'Web3Makeovers: Already initialized'
        )
    })
    it('Reverts if user without admin or default admin role try initialize token', async () => {
        await expect(
            w3m.connect(user).initializeToken('0', 'TOKENURI', '0', false, true)
        ).to.be.revertedWith('Web3Makeovers: Access denied')
    })
    it('Reverts if user without admin or default admin role try mint token', async () => {
        await w3m.initializeToken('0', 'TOKENURI', '0', false, true)
        await expect(w3m.connect(user).mint(user.address, '0', '1')).to.be.revertedWith(
            'Web3Makeovers: Access denied'
        )
    })
    it('Admin can mint token and it emits event', async () => {
        await w3m.initializeToken('0', 'TOKENURI', '0', false, true)
        expect(await w3m.mint(user.address, '0', '3')).to.emit('TokenMinted')
        assert.equal(await w3m.balanceOf(user.address, '0'), '3')
    })
    it('User with admin role can initialize token', async () => {
        await w3m.grantRole(await w3m.ADMIN_ROLE(), user.address)
        expect(await w3m.connect(user).initializeToken('0', 'TOKENURI', '0', false, true)).to.emit(
            'TokenInitialized'
        )
    })
    it('User with admin role can mint new token', async () => {
        await w3m.grantRole(await w3m.ADMIN_ROLE(), user.address)
        await w3m.initializeToken('0', 'TOKENURI', '0', false, false)
        expect(await w3m.connect(user).mint(user.address, '0', '3')).to.emit('TokenMinted')
    })
    it('Supports interface returns true for ERC5633 and ERC1155', async () => {
        assert.equal(await w3m.supportsInterface('0x911ec470'), true)
        assert.equal(await w3m.supportsInterface('0xd9b67a26'), true)
    })
    it('Reverts if try transfer soulbound', async () => {
        await w3m.initializeToken('0', 'TOKENURI', '0', false, true)
        await w3m.mint(owner.address, '0', '3')
        await expect(
            w3m.safeTransferFrom(owner.address, user.address, '0', '1', '0x00')
        ).to.be.revertedWith('ERC5633: Soulbound, Non-Transferable')
    })
    it('Reverts if try transfer soulbound to zero address', async () => {
        await w3m.initializeToken('0', 'TOKENURI', '0', false, true)
        await w3m.mint(owner.address, '0', '3')
        await expect(
            w3m.safeTransferFrom(owner.address, ethers.constants.AddressZero, '0', '1', '0x00')
        ).to.be.revertedWith('ERC1155: transfer to the zero address')
    })
    it('Tokens transfers if soulbound status false', async () => {
        await w3m.initializeToken('0', 'TOKENURI', '0', false, false)
        await w3m.mint(owner.address, '0', '3')
        await w3m.safeTransferFrom(owner.address, user.address, '0', '3', '0x00')
        assert.equal(await w3m.balanceOf(user.address, '0'), '3')
    })
    it('Reverts if try mint token that not initialized', async () => {
        await expect(w3m.connect(admin).mint(user.address, '0', '1')).to.be.revertedWith(
            'Web3Makeovers: Token not initialized'
        )
    })
    it('User can mint public when price is zero and whitelist off and it emits event', async () => {
        await w3m.initializeToken('0', 'TOKENURI', '0', false, true)
        expect(await w3m.connect(user).mintPublic('0')).to.emit('TokenMinted')
    })
    it('Reverts if user try mint public and token not initialized', async () => {
        await expect(w3m.connect(user).mintPublic('0')).to.be.revertedWith(
            'Web3Makeovers: Token not initialized'
        )
    })
    it('Reverts if tokens price greater then zero and msg value is zero when user mint public', async () => {
        await w3m.initializeToken('0', 'TOKENURI', '10000', false, true)
        await expect(w3m.connect(user).mintPublic('0')).to.be.revertedWith(
            'Web3Makeovers: Wrong value'
        )
    })
    it('Reverts if whitelist activated and user try mint public and not in whitelist', async () => {
        await w3m.initializeToken('0', 'TOKENURI', '0', true, true)
        await expect(w3m.connect(user).mintPublic('0')).to.be.revertedWith(
            'Web3Makeovers: Caller not whitelisted!'
        )
    })
    it('User can mint public token with activated whitelist and user in whitelist', async () => {
        await w3m.initializeToken('0', 'TOKENURI', '0', true, true)
        await w3m.addToWhitelist('0', [user.address])
        await w3m.connect(user).mintPublic('0')
        assert.equal(await w3m.balanceOf(user.address, '0'), '1')
    })
    it('User can mint public only one token if whitelist activated', async () => {
        await w3m.initializeToken('0', 'TOKENURI', '0', true, true)
        await w3m.addToWhitelist('0', [user.address])
        await w3m.connect(user).mintPublic('0')
        await expect(w3m.connect(user).mintPublic('0')).to.be.revertedWith(
            'Web3Makeovers: Caller not whitelisted!'
        )
    })
    it('Owner can withdraw all value from contract', async () => {
        const PRICE = ethers.utils.parseEther('1.0')
        await w3m.initializeToken('0', 'TOKENURI', PRICE, false, true)
        await w3m.connect(user).mintPublic('0', { value: PRICE })
        assert.equal(await w3m.balanceOf(user.address, '0'), '1')
        const ownerBalanceBefore = await owner.getBalance()
        const gasPrice = await ethers.provider.getGasPrice()
        const estimateGas = await w3m.estimateGas.withdraw()
        const gasCost = gasPrice.mul(estimateGas)
        await w3m.withdraw()
        const ownerBalanceAfter = await owner.getBalance()
        const expectedBalance = ownerBalanceBefore.sub(gasCost).add(PRICE)
        const lowerBound = expectedBalance.sub(ethers.utils.parseEther('0.001'))
        const upperBound = expectedBalance.add(ethers.utils.parseEther('0.001'))
        assert.ok(
            ownerBalanceAfter.gt(lowerBound) && ownerBalanceAfter.lt(upperBound),
            'Owner balance is within the expected range'
        )
    })
    it('Reverts if owner try withdraw contract balance and balance is zero', async () => {
        await expect(w3m.connect(owner).withdraw()).to.be.revertedWith(
            'Web3Makeovers: Balance is zero'
        )
    })
    it('Reverts if user try withdraw contract balance', async () => {
        await expect(w3m.connect(user).withdraw()).to.be.revertedWith(
            'Ownable: caller is not the owner'
        )
    })
    it('Reverts if admin try withdraw contract balance', async () => {
        await expect(w3m.connect(admin).withdraw()).to.be.revertedWith(
            'Ownable: caller is not the owner'
        )
    })
    it('Admin can add addresses to whitelist', async () => {
        assert.equal(await w3m.isWhitelisted(user.address, '0'), false)
        await w3m.connect(admin).addToWhitelist('0', [user.address])
        assert.equal(await w3m.isWhitelisted(user.address, '0'), true)
    })
    it('Reverts if user without role try add to whitelist', async () => {
        await expect(w3m.connect(user).addToWhitelist('0', [user.address])).to.be.revertedWith(
            'Web3Makeovers: Access denied'
        )
    })
    it('Admin can remove addresses to whitelist', async () => {
        await w3m.connect(admin).addToWhitelist('0', [user.address])
        assert.equal(await w3m.isWhitelisted(user.address, '0'), true)
        await w3m.connect(admin).removeFromWhitelist('0', [user.address])
        assert.equal(await w3m.isWhitelisted(user.address, '0'), false)
    })

    it('Default admin can remove addresses to whitelist', async () => {
        await w3m.connect(owner).addToWhitelist('0', [user.address])
        assert.equal(await w3m.isWhitelisted(user.address, '0'), true)
        await w3m.connect(owner).removeFromWhitelist('0', [user.address])
        assert.equal(await w3m.isWhitelisted(user.address, '0'), false)
    })
    it('Reverts if user without role try remove from whitelist', async () => {
        await expect(w3m.connect(user).removeFromWhitelist('0', [user.address])).to.be.revertedWith(
            'Web3Makeovers: Access denied'
        )
    })
    it('Default admin role can set whitelist required status and it emits event', async () => {
        await w3m.initializeToken('0', 'TOKENURI', '0', false, true)
        assert.equal(await w3m.getWhitelistRequiredStatus('0'), false)
        expect(await w3m.connect(owner).setWhitelistRequiredStatus('0', true)).to.emit(
            'TokenWhitelistRequiredStatusUpdated'
        )
        assert.equal(await w3m.getWhitelistRequiredStatus('0'), true)
    })
    it('Admin role can set whitelist required status and it emits event', async () => {
        await w3m.initializeToken('0', 'TOKENURI', '0', false, true)
        assert.equal(await w3m.getWhitelistRequiredStatus('0'), false)
        expect(await w3m.connect(admin).setWhitelistRequiredStatus('0', true)).to.emit(
            'TokenWhitelistRequiredStatusUpdated'
        )
        assert.equal(await w3m.getWhitelistRequiredStatus('0'), true)
    })
    it('Reverts if admin try set whitelist required status and token not initialized', async () => {
        await expect(w3m.connect(admin).setWhitelistRequiredStatus('0', true)).to.be.revertedWith(
            'Web3Makeovers: Token not initialized'
        )
    })
    it('Reverts if user without role try set whitelist required status', async () => {
        await expect(w3m.connect(user).setWhitelistRequiredStatus('0', true)).to.be.revertedWith(
            'Web3Makeovers: Access denied'
        )
    })
    it('Reverts if admin try set whitelist required status the same', async () => {
        await w3m.initializeToken('0', 'TOKENURI', '0', true, true)
        await expect(w3m.connect(admin).setWhitelistRequiredStatus('0', true)).to.be.revertedWith(
            'Web3Makeovers: New status the same'
        )
    })
    it('Reverts if default admin try set whitelist required status the same', async () => {
        await w3m.initializeToken('0', 'TOKENURI', '0', true, true)
        await expect(w3m.connect(owner).setWhitelistRequiredStatus('0', true)).to.be.revertedWith(
            'Web3Makeovers: New status the same'
        )
    })
    it('Admin can set token price if token initialized and it emits event', async () => {
        await w3m.initializeToken('0', 'TOKENURI', '0', true, true)
        expect(await w3m.connect(admin).setTokenPrice('0', ethers.utils.parseEther('0.1'))).to.emit(
            'TokenPriceUpdated'
        )
        assert.equal(
            Number(await w3m.getTokenPrice('0')).toString(),
            ethers.utils.parseEther('0.1')
        )
    })
    it('Default admin can set token price if token initialized and it emits event', async () => {
        await w3m.initializeToken('0', 'TOKENURI', '0', true, true)
        expect(await w3m.connect(owner).setTokenPrice('0', ethers.utils.parseEther('0.1'))).to.emit(
            'TokenPriceUpdated'
        )
        assert.equal(
            Number(await w3m.getTokenPrice('0')).toString(),
            ethers.utils.parseEther('0.1')
        )
    })
    it('Reverts if user without role try set token price', async () => {
        await expect(
            w3m.connect(user).setTokenPrice('0', ethers.utils.parseEther('0.1'))
        ).to.be.revertedWith('Web3Makeovers: Access denied')
    })
    it('Reverts if admin try set token price and token not initialized', async () => {
        await expect(
            w3m.connect(admin).setTokenPrice('0', ethers.utils.parseEther('0.1'))
        ).to.be.revertedWith('Web3Makeovers: Token not initialized')
    })
    it('Reverts if default admin try set token price and token not initialized', async () => {
        await expect(
            w3m.connect(owner).setTokenPrice('0', ethers.utils.parseEther('0.1'))
        ).to.be.revertedWith('Web3Makeovers: Token not initialized')
    })
    it('Reverts if admin try set the same price', async () => {
        await w3m.initializeToken('0', 'TOKENURI', '0', true, true)
        expect(await w3m.connect(admin).setTokenPrice('0', ethers.utils.parseEther('0.1'))).to.emit(
            'TokenPriceUpdated'
        )
        await expect(
            w3m.connect(admin).setTokenPrice('0', ethers.utils.parseEther('0.1'))
        ).to.be.revertedWith('Web3Makeovers: New price the same')
    })
    it('Reverts if default admin try set the same price', async () => {
        await w3m.initializeToken('0', 'TOKENURI', '0', true, true)
        expect(await w3m.connect(owner).setTokenPrice('0', ethers.utils.parseEther('0.1'))).to.emit(
            'TokenPriceUpdated'
        )
        await expect(
            w3m.connect(owner).setTokenPrice('0', ethers.utils.parseEther('0.1'))
        ).to.be.revertedWith('Web3Makeovers: New price the same')
    })

    it('Admin can set token uri if token initialized and it emits event', async () => {
        await w3m.initializeToken('0', 'TOKENURI', '0', true, true)
        expect(await w3m.connect(admin).setTokenUri('0', 'newURI')).to.emit('TokenUriUpdated')
        assert.equal(await w3m.uri('0'), 'newURI')
    })
    it('Default admin can set token uri if token initialized and it emits event', async () => {
        await w3m.initializeToken('0', 'TOKENURI', '0', true, true)
        expect(await w3m.connect(owner).setTokenUri('0', 'newURI')).to.emit('TokenUriUpdated')
        assert.equal(await w3m.uri('0'), 'newURI')
    })
    it('Reverts if user without role try set token uri', async () => {
        await expect(w3m.connect(user).setTokenUri('0', 'newURI')).to.be.revertedWith(
            'Web3Makeovers: Access denied'
        )
    })
    it('Reverts if admin try set token uri and token not initialized', async () => {
        await expect(w3m.connect(admin).setTokenUri('0', 'newURI')).to.be.revertedWith(
            'Web3Makeovers: Token not initialized'
        )
    })
    it('Reverts if default admin try set token uri and token not initialized', async () => {
        await expect(w3m.connect(owner).setTokenUri('0', 'newURI')).to.be.revertedWith(
            'Web3Makeovers: Token not initialized'
        )
    })
})
