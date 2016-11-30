# EthereumVoting
Enable voting via Ethereum through slack chat

## Setup and Startup

There are 3 systems acting together:

1. Slack (slackchat)
2. NodeJS
3. Ethereum Client

Please note: If you are a beginner with Ethereum you should first read through some documentation before you can work with this example.

### Preparing Slack
First you have to create a slack channel. Then you add a bot-user to that channel. You will receive a token for the bot-user from slack. Be aware that you should not make this token publicly available. The token of the bot-user and the name of the bot-user are given to the NodeJS application upon startup.

### Deploying smart contract on Ethereum test-net
Note that the deployment of the contract (that is used via nodeJS through web3) is independent from the slack-nodeJS setup. You have to deploy the contract before you can startup the nodeJS application. 
You find the contract in the folder "contract". Once deployed you will need the contract's address and ABI (application binary interface) for the startup of the nodeJS application. 

Since the ABI won't change unless you use a different contract the ABI is not part of the parameter-set for the nodeJS application, but it is loaded from file (./slack/files/contract_abi.json).

### Preparing Ethereum Node
Before you start NodeJS you also have to start your Ethereum Client. It is assumed that you are already familiar with Ethereum the go-Implementation (geth). The Ethereum Client has to be in sync for this to work. So far we only tested on the test-net (ropsten); but you can also start the Ethereum Client on the main-net and expose your RPC. Be aware that this is dangerous, because the application automatically generates accounts and transfers money to them. It is furthermore not recommended that you expose your client's RPC interface with a main-net account behind.
	
At the moment you have to start the test-net like this (ropsten test-net): 
	
	geth --datadir %appdata%\Ethereum\testnet\chaindata_ropsten init genesis.json; geth --datadir  %appdata%\Ethereum\testnet\chaindata_ropsten --networkid 3 console

more info here: https://blog.ethereum.org/2016/11/20/from-morden-to-ropsten/ 

Note that the pathes used are for Windows ;)

expose RPC like this: 
	
	admin.startRPC("127.0.0.1", 8545, "*", "web3,net,eth,personal")

Note that "personal" is also exposed, so we are able to automatically generate accounts via the client like this:

```javascript
	var rpc = require('json-rpc2');
	var rpcClient = rpc.Client.$create(8545, "localhost");
	//
	// ...
	//
	rpcClient.call("personal_newAccount", [pwdNewAccount], function(err,result){ 
		if (err != null)
		{
			console.log('ERROR', err);
			return;
		}

		console.log('Account created', result);

		//transact money to account
		unlockCoinbaseAccount(process.env.COINBASE_PWD, 1200);
		web3.eth.sendTransaction({from: coinbase, to: result, value: parseInt(process.env.INIT_ACCOUNT_MONEY)});
	});
```
	
### Startup the NodeJS component
The nodeJS component listens to the slackbot, takes the commands that come in and communicates to the Ethereum Client via the web3 Javascript API, that can also be installed via npm.

Install like this:

	npm install

This will fetch all of the node modules (dependencies). For details take a look at the package.json file.

Start the program with the following environment-variables as parameters (all of them have to be set):

	EMAIL_ADR=[the email address that is used to send emails to users]
	EMAIL_PWD=[the password of the email address that is used to send emails to users]
	SLACK_BOT_TOKEN=[the token of the slack bot]
	SLACK_BOT_NAME=[the name of the slack bot]
	SLACK_ADMIN_USER=[the user that is supposed to be admin]
	COINBASE_PWD=[the password of the ethereum-client coinbase account]
	CONTRACT_ADR=[the ethereum address of the contract to be used]
	INIT_ACCOUNT_MONEY=[the money that will be transferred to the voter account initially]
	ACCOUNT_PATH=[the path to the keystore directory of your Ethereum client (according to the chain you are on)]

you can start like this:
	
	PARAM1_NAME='param1_value' PARAM2_NAME='param2_value' (...) npm start


