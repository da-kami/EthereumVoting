//access to ethereum library & instantiation

var directAccessToWeb3 = function() {
	return web3;
}

module.exports.unlockCoinbaseAccount = unlockCoinbaseAccount;
module.exports.web3 = directAccessToWeb3;