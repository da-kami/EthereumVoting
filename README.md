# EthereumVoting
Enable voting via Ethereum through slack chat

## Into

There are 3 systems acting together:
	1. Slack (slackchat)
	2. NodeJS
	3. Ethereum Client

First you have to create a slack channel. Then you add a bot-user to that channel. The token of the bot-user and the name of the bot-user are given to the NodeJS application upon startup.
Before you start NodeJS you also have to start your Ethereum client and:
	
start like this (ropsten, morden testnet ended): 
	
	geth --datadir %appdata%\Ethereum\testnet\chaindata_ropsten init genesis.json; geth --datadir C:\Users\dkarzel\AppData\Roaming\Ethereum\testnet\chaindata_ropsten --networkid 3 console

expose RPC like this: 
	
	admin.startRPC("127.0.0.1", 8545, "*", "web3,net,eth,personal")
	
you will have to download the genesis block, check here: https://blog.ethereum.org/2016/11/20/from-morden-to-ropsten/ 


## Start the nodeJS program with the following parameters:

	EMAIL_ADR=[the email address that is used to send emails to users]
	EMAIL_PWD=[the password of the email address that is used to send emails to users]
	SLACK_BOT_TOKEN=[the token of the slack bot]
	SLACK_BOT_NAME=[the name of the slack bot]
	SLACK_ADMIN_USER=[the user that is supposed to be admin]
	COINBASE_PWD=[the password of the ethereum-client coinbase account]
	CONTRACT_ADR=[the ethereum address of the contract to be used]
	CONTRACT_ABI=[the ethereum application binary interface of the contract]
	INIT_ACCOUNT_MONEY=[the money that will be transferred to the voter account initially]

you can start like this:
	
	PARAM1_NAME='param1_value' PARAM2_NAME='param2_value' (...) npm start


