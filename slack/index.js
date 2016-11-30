var emailSenderClient = require('./sendemail');

// setup direct RPC, to be able to call the Ethereum client's personal.newAccount([pwd]) function
var rpc = require('json-rpc2');
var rpcClient = rpc.Client.$create(8545, "localhost");

// setup web3 API to communicate with Ethereum client
var Web3 = require('./node_modules/web3');
var web3 = new Web3();
//configure web3
web3.setProvider(new web3.providers.HttpProvider('http://localhost:8545'));
// define coinbase
var coinbase = web3.eth.coinbase;
var coinbasePWD = process.env.COINBASE_PWD;

//define slackclient
var RtmClient = require('@slack/client').RtmClient;
//reading functions from slack
var CLIENT_EVENTS = require('@slack/client').CLIENT_EVENTS;
var RTM_CLIENT_EVENTS = require('@slack/client').CLIENT_EVENTS.RTM;
var RTM_EVENTS = require('@slack/client').RTM_EVENTS;
// define slackclient memory database
var MemoryDataStore = require('@slack/client').MemoryDataStore;
//bot token
var bot_token = process.env.SLACK_BOT_TOKEN;
//bot name
var bot_name = process.env.SLACK_BOT_NAME;

var me = null;

var slack = new RtmClient(bot_token, {
  logLevel: 'error',
//initialize Datastore ???
  dataStore: new MemoryDataStore(),
  autoReconnect: true,
  autoMark: true
});

// The client will emit an RTM.AUTHENTICATED event on successful connection, with the 'rtm.start' payload if you want to cache it
slack.on(CLIENT_EVENTS.RTM.AUTHENTICATED, function (rtmStartData) {
  console.log('Logged in, but not yet connected to a channel');
  for (var user_id in slack.dataStore.users) {
    var user = slack.dataStore.users[user_id];
    if (user.name === bot_name) {
      me = user;
      break;
    }
  }
});

slack.start();


//Global Variables within NodeJS
var voterRegisterCode = {};
var voterRegistry = {};
var voterToAddress = {};
var voterToPwd = {};
var voterToEmail = {};
var allowedParties = ['NUE', 'BON', 'ESC', 'MUC', 'BER', 'HAM', 'KOS', 'STR', 'VIE'];
var partyVotes = {'NUE':'not init', 'BON':'not init', 'ESC':'not init', 'MUC':'not init', 'BER':'not init', 'HAM':'not init', 'KOS':'not init', 'STR':'not init', 'VIE':'not init'};

//access filesystem
var fs = require('fs');
var filePath = './files/';
//var binary_file = 'lottery_binary.txt';
var definition_file = 'contract_abi.json';
var definition_JSON = JSON.parse(fs.readFileSync(filePath + definition_file, 'utf8'));
var definition_string = JSON.stringify(definition_JSON);

// init the election contract
var election = web3.eth.contract(definition_JSON);
var electionInst = null;
electionInst = election.at(process.env.CONTRACT_ADR);

var chooseResult = null;
var theWinner = null;

var unlockEthereumAccount = function(accountNr, passphrase, timeInSeconds) {
  return web3.personal.unlockAccount(accountNr, passphrase, timeInSeconds);
}

var testSlack = function(channel) {
	slack.sendMessage('hi there, I am your bot!', channel.id);
	console.log("sent test message to channel..." + channel.id);
}

/**
  goes through all of the accounts that are known to the ethereum client and
  checks if there is any ether on them. if no ethere is found then the account-file
  will be delete.
**/
var cleanupEmptyEthereumAccounts = function(channel, removeMinAccounts) {

  files = fs.readdirSync(process.env.ACCOUNT_PATH);
  
  files.forEach(function(file){
      console.log('account file: ', file);

      web3.eth.accounts.forEach(function(accountNr){
        //console.log(accountNr);

        //console.log(accountNr.substring(2, accountNr.length))

        if (accountNr != null && file.indexOf(accountNr.substring(2, accountNr.length)) >= 0) {
          var accountBalance = web3.eth.getBalance(accountNr);

          //console.log('account = ' + accountNr + ", balance = " + accountBalance);
          //console.log('file path = ' + process.env.ACCOUNT_PATH);

          if (accountBalance == 0 || (removeMinAccounts && accountBalance == parseInt(process.env.INIT_ACCOUNT_MONEY))) {
            console.log("delete empty account: " + process.env.ACCOUNT_PATH + '/' + file);
            fs.unlinkSync(process.env.ACCOUNT_PATH + '/' + file);  
          }
        }
      });

      console.log('next file');
    });

  slack.sendMessage('Cleaned accounts.',channel.id);
}

var printHelp = function(channel) {
  slack.sendMessage('Vote for your next Senacor event location!', channel.id);
  slack.sendMessage('_______________________________________',channel.id);
  slack.sendMessage('The following commands are accepted: ',channel.id);
  slack.sendMessage('    what do I vote for? : tells you the current election name and initial amount of votes.',channel.id);
  slack.sendMessage('    register user@senacor.com : sends a registration code to the email address entered.',channel.id);
  slack.sendMessage('    unlock : use the registration code to unlock your account. After this step your Ethereum account will be sent to you.',channel.id);
  slack.sendMessage('    register at contract : registers you at the contract if the contract-registration has failed.',channel.id);
  slack.sendMessage('    unlock at contract : unlocks you at the contract if the contract-unlock has failed.',channel.id);
  slack.sendMessage('    register account accountAddress accountPwd : registers already existing account by address and password.',channel.id);
  slack.sendMessage('    allowed parties : tells you the allowed parties in this election.',channel.id);
  slack.sendMessage('    add party partyName : adds a party to the current election.',channel.id);
  slack.sendMessage('    vote nrOfVotes partyName : votes for a party.',channel.id);
  slack.sendMessage('    unlock status : checks the contract to see if the user is actually unlocked.',channel.id);
  slack.sendMessage('_______________________________________',channel.id);
  slack.sendMessage('admin only:',channel.id);
  slack.sendMessage('    clean accounts : cleans all empty accounts.',channel.id);
  slack.sendMessage('    clean min accounts : cleans all the accounts with min-value set.',channel.id);
  slack.sendMessage('    new election nrInitialVotes election-Name : set a new election. this resets the contract.',channel.id);
}


var printEthereumNodeStats = function(channel) {
	var curBlockNr = web3.eth.blockNumber;
	var syncingStatus = web3.eth.syncing;
	var peerCount = web3.net.peerCount;
	var coinbaseAccount = web3.eth.coinbase
	
	slack.sendMessage('The current block number on this node is: ' + curBlockNr, channel.id);
	slack.sendMessage('Node syncing status is: ' + syncingStatus, channel.id);
	slack.sendMessage('Number of peers of node: ' + peerCount, channel.id);
	slack.sendMessage('Coinbase account: ' + coinbaseAccount, channel.id);
}

var sendRegistrationEmail = function (channel, uName, emailAdr) {

  newEthereumAccount(channel, uName, emailAdr);

  var registerCode = Math.floor(100000 + Math.random() * 900000);

  voterRegisterCode[uName] = registerCode;
  //voterRegistry[uName] = false;

  emailSenderClient.sendAnEmail(process.env.EMAIL_ADR, process.env.EMAIL_PWD, emailAdr, 'Your registration code', 
    'Call in slack: @' + process.env.SLACK_BOT_NAME + ' unlock ' + registerCode + 
    '\n\nIf you got this message by accident just delete it. It contains registration information for sombody else.');
  voterToEmail[uName] = emailAdr;
  slack.sendMessage('<@'+ uName +'>: Registration code was sent to: ' + emailAdr, channel.id);
}

/** 
  locates the key-file of the account and returns the file path. 
**/
var retrieveKeyFileForAccount = function (accountNr) {
  var files = fs.readdirSync(process.env.ACCOUNT_PATH);
  
  for (i = 0; i < files.length; i++)
  {
    var file = files[i];
    if (accountNr != null && file.indexOf(accountNr.substring(2, accountNr.length)) >= 0)
    {
      return process.env.ACCOUNT_PATH + '/' + file;
    }
  }
}

/** 
  Returns the contenct of a keyfile, uses retrieveKeyFileForAccount(accountNr)
**/
var retrieveKeyFileDataForAccount = function (accountNr) {
  var accountFilePath = retrieveKeyFileForAccount(accountNr);

  console.log(accountFilePath);

  if (accountFilePath == null) {
    return;
  }
  var fileData = fs.readFileSync(accountFilePath, 'utf8')

  return fileData;
}

var storeAccountInfo = function(accountNr, accountPwd, uName) {
  console.log("account log path: " + filePath + 'accounts.log');
  fs.appendFileSync(filePath + 'accounts.log', "account: " + accountNr + ", pwd: " + accountPwd + ', uName: ' + uName + ' \n\n');
}

var checkAdminAccount = function(channel) {

  var accountBalance = web3.eth.getBalance(coinbase);
  if (accountBalance == null || accountBalance == 0)
  {
    slack.sendMessage('<@'+ uName +'>: Admin account empty. This is not good!!!', channel.id);
    return false;
  }

  return true;
}

var checkUserAccount = function(uName, channel) {
  var voterAdr = voterToAddress[uName];

  if (voterAdr == null)
  {
    slack.sendMessage('<@'+ uName +'>: You did not register yet! You have to call register and then unlock!', channel.id);
    return false;
  }

  var accountBalance = web3.eth.getBalance(voterAdr);
  if (accountBalance == null || accountBalance == 0)
  {
    slack.sendMessage('<@'+ uName +'>: The money did not arrive on the account yet. Please call "unlock at contract" later again.', channel.id);
    return false;
  }

  return true;
}

var registerUserAtContract = function(uName, channel) {
  var voterAdr = voterToAddress[uName];

  if (!checkUserAccount(uName, channel))
    return false;

  var accountBalance = web3.eth.getBalance(voterAdr);

  unlockEthereumAccount(voterAdr, voterToPwd[uName], 1200);
  var transNo = electionInst.registerVoter.sendTransaction({from:voterAdr, gas:4000000});

  slack.sendMessage('<@'+ uName +'>: Voter registered at contract, transaction: ' + transNo, channel.id);
  return true;
}

var unlockUserAtContract = function(uName, channel) {
  var voterAdr = voterToAddress[uName];

  if (!checkAdminAccount(uName, channel))
    return false;

  unlockEthereumAccount(coinbase, coinbasePWD, 1200);
  var transNo = electionInst.unlockVoter.sendTransaction(voterAdr, {from:coinbase});
  slack.sendMessage('<@'+ uName +'>: Voter unlocked at contract, transaction: ' + transNo, channel.id);
  return true;
}

var registerAccount = function(uName, accountAdr, accountPwd, channel) {

  if (!unlockEthereumAccount(accountAdr, accountPwd, 10)) {
    slack.sendMessage('<@'+ uName +'>: account ' + accountNr + ' could not be registered, unlocking the account not possible.', channel.id);
    return;
  }

  voterToAddress[uName] = accountAdr;
  voterToPwd[uName] = accountPwd;

  slack.sendMessage('<@'+ uName +'>: User account ' + accountAdr + ' was registered.', channel.id);

  registerUserAtContract(uName, channel);
  unlockUserAtContract(uName, channel);

}

var unlockVoterAccount = function(channel, uName, uCode) {
  var registerCode = voterRegisterCode[uName];

  console.log("unlock: code saved in program: " + registerCode);
  console.log("unlock: code given by user: " + uCode);

  if (parseInt(uCode) == registerCode) {
    
    voterRegistry[uName] = true;

    // send ethereum account inform to user, so he can just integrate it into his 
    emailSenderClient.sendAnEmail(process.env.EMAIL_ADR, process.env.EMAIL_PWD, voterToEmail[uName], 
      'Your Ethereum Account', 
      'account address: ' + voterToAddress[uName] + 
      '\naccount password: ' + voterToPwd[uName] + 
      '\nthe small amount of ' + web3.fromWei(parseInt(process.env.INIT_ACCOUNT_MONEY)) + ' ether was put on your account so you can send simple transactions.' +
      '\n\naccount keyfile data: \n' + retrieveKeyFileDataForAccount(voterToAddress[uName]) + '\n\n' + 
      'Instructions: \n' + 
      '\t1. Download Ethereum Client (recommended: https://geth.ethereum.org/) \n' + 
      '\t2. Start geth on test-net (geth --testnet console) and sync the blockchain. \n' + 
      '\t3. Locate the keystore folder, where the account key files are stored. \n' + 
      '\t\tWindows path (usually, with new ropsten network it may be different): %appdata%/Ethereum/testnet/keystore \n' +
      '\t4. Save the keyfile data into a file (any filename OK) and copy it into the keystore folder.\n' + 
      '\t\t geth should immediately recognize the account. You can check that by typing web.eth.accounts in the geth console. \n' +
      '\t5. Read documentation: \n' + 
      '\t\thttps://blog.ethereum.org/2016/11/20/from-morden-to-ropsten/ \n' +
      '\t\thttps://github.com/ethereum/go-ethereum/wiki/Command-Line-Options \n' +
      '\t\thttps://github.com/ethereum/go-ethereum/wiki/JavaScript-Console \n' + 
      '\t\thttps://github.com/ethereum/wiki/wiki/JavaScript-API \n\n' +
      'in order to interact with the election contract you need the contract address and the contract interface: \n' +
      'contract address: ' + process.env.CONTRACT_ADR + 
      '\n\contract interface: \n' + definition_string
      );

    // register the user at the contract - if that fails one can also trigger it again in the bot
    var success;
    success = registerUserAtContract(uName, channel);
    if (success)
      success = unlockUserAtContract(uName, channel);

    if (success)
      slack.sendMessage('<@'+ uName +'>: Registration complete, email with your account and password was sent to you ', channel.id);
  }
  else {
    slack.sendMessage('<@'+ uName +'>: ERROR: Registration code mismatch! ', channel.id);
  }
}

var newEthereumAccount = function(channel, uName, emailAdr) {
  var pwdNewAccount = "Senacor" + Math.floor(100000 + Math.random() * 900000);
  voterToPwd[uName] = pwdNewAccount;
  //console.log("password for new account: " + pwdNewAccount);

  // works
  rpcClient.call("personal_newAccount", [pwdNewAccount], function(err,result){ 
    if (err != null)
    {
      console.log('ERROR', err);
      slack.sendMessage('<@'+ uName +'>: ERROR: Failed to create account!', channel.id);
      return;
    }

    console.log('Account created', result);
    voterToAddress[uName] = result;

    //transact money to account
    unlockEthereumAccount(coinbase, process.env.COINBASE_PWD, 1200);
    web3.eth.sendTransaction({from: coinbase, to: result, value: parseInt(process.env.INIT_ACCOUNT_MONEY), gas: 4000000});

    // keep a copy of account + passowrd for testing, so we don't burn too much ether
    storeAccountInfo(result, pwdNewAccount, uName);

  });
}

var resetElection = function(electionName, nrOfInitVotes, uName, channel) {

  unlockEthereumAccount(coinbase, coinbasePWD, 1200);
  var transNo = electionInst.setElection.sendTransaction(electionName, nrOfInitVotes, {from:coinbase, gas: 4000000});
  
  slack.sendMessage('<@'+ uName +'>: Transaction to set election to ' + electionName + ' sent! Transaction Number: ' + transNo, channel.id);
}

/**
  Info for users: prints the election name and how many votes initially are allowed.
**/
var whatDoIVoteFor = function(uName, channel) {
  var electionName = electionInst.getCurrentElectionName.call();
  var initialVoteCount = electionInst.getInitialVotesPerPerson.call();

  if (electionName.length < 1)
    slack.sendMessage('<@'+ uName +'>: It seems there is no election defined yet - talk to your admin!', channel.id);
  else {
    slack.sendMessage('<@'+ uName +'>: You are voting for: ' + electionName, channel.id);
    slack.sendMessage('<@'+ uName +'>: The initial votes per person for this election are set to: ' + initialVoteCount, channel.id);
  }
}

var voteForParty = function(uName, party, nrOfVotes, channel) {

  if (!checkUserAccount(uName, channel))
    return false;

  if (partyVotes[party] == null) {
    slack.sendMessage('<@'+ uName +'>: Sorry, the party ' + party + ' is not allowed in this election', channel.id);
    return;
  }

  if (partyVotes[party] == 'not init') {
    slack.sendMessage('<@'+ uName +'>: The party was not added to the election yet. Please call @' + process.env.SLACK_BOT_NAME + ' add party ' + party, channel.id);
    return;
  }

  var userAddress = voterToAddress[uName];

  unlockEthereumAccount(userAddress, voterToPwd[uName], 1200);
  var transNo = electionInst.vote.sendTransaction(party, nrOfVotes, {from: userAddress});

  slack.sendMessage('<@'+ uName +'>: Transaction to vote for ' + party + ' with ' + nrOfVotes + ' votes was sent. Transaction number: ' + transNo, channel.id);
}

var addPartyToElection = function(uName, party, channel) {

  if (partyVotes[party] == null) {
    slack.sendMessage('<@'+ uName +'>: Sorry, the party ' + party + ' is not allowed in this election', channel.id);
    return;
  }

  unlockEthereumAccount(coinbase, coinbasePWD, 1200);
  // just send viy coinbase, makes it fairer and easier (one could also send this via user-account...)
  var transNo = electionInst.addParty.sendTransaction(party, {from: coinbase});

  partyVotes[party]='init';
  slack.sendMessage('<@'+ uName +'>: Transaction to add party ' + party + ' was sent. Transaction number: ' + transNo, channel.id);

}

var getAccountBalance = function(uName, channel) {

  if (uName == process.env.SLACK_ADMIN_USER)
  {
    var adminBalance = web3.fromWei(web3.eth.getBalance(coinbase));
    slack.sendMessage('<@'+ uName +'>: The admin account balance is ' + adminBalance + ' ether', channel.id);
  }

  if (!checkUserAccount(uName, channel))
    return false;

  var balance = web3.fromWei(web3.eth.getBalance(voterToAddress[uName]));

  slack.sendMessage('<@'+ uName +'>: Your balance is ' + balance + ' ether.', channel.id);

}

var getPartyVotes = function(uName, party, channel) {

  var partyVotes = electionInst.getVotesForParty.call(party);

  slack.sendMessage('<@'+ uName +'>: Party ' + party + ' currently has ' + partyVotes + ' votes.', channel.id);
}

var getWinningParty = function(uName, channel) {

  var winningParty = electionInst.getPartyWithHighestVotes.call();
  var winningPartyVotes = electionInst.getNrOfVotesOfHighestVotesParty.call();

  if (winningParty == null || winningParty == '' || winningPartyVotes == 0)
  {
    slack.sendMessage('<@'+ uName +'>: It seems nobody voted yet. No leading party yet.', channel.id);
    return;
  }

  slack.sendMessage('<@'+ uName +'>: Party ' + winningParty + ' is leading with ' + winningPartyVotes + ' votes.', channel.id);
}

var checkUserUnlocked = function(uName, channel) {

  if (!checkUserAccount(uName, channel))
    return false;

  var isUnlocked = electionInst.isVoterRegisteredAndUnlocked.call(voterToAddress[uName]);

  slack.sendMessage('<@'+ uName +'>: The unlock status of your account is: ' + isUnlocked, channel.id);
}

var processAction = function (message) {
  var channel = slack.dataStore.getChannelGroupOrDMById(message.channel);

  if (message.text.indexOf('balance') >= 0) {
    getAccountBalance(message.user, channel);

  } else if(message.text.indexOf('help') >= 0) {
	   printHelp(channel);

  } else if (message.text.indexOf('node status') >= 0) {
    if (message.user == process.env.SLACK_ADMIN_USER)
	   printEthereumNodeStats(channel);

  // #### INFO: ALLOWED PARTIES ####
  } else if (message.text.indexOf('allowed parties') >= 0) {
    slack.sendMessage('<@'+ message.user +'>: Allowed parties in this election: ' + allowedParties, channel.id);

  // #### INFO: ALLOWED PARTIES ####
  } else if (message.text.indexOf('unlock status') >= 0) {
    checkUserUnlocked(message.user, channel);

  // #### INFO: VOTES FOR PARTY ####
  } else if (message.text.indexOf('party votes') >= 0) {
    var partyName = message.text.split(" ") [3];
    getPartyVotes(message.user, partyName, channel);

  // #### get the winning party ####
  } else if (message.text.indexOf('winning party') >= 0) {
    getWinningParty(message.user, channel);

  // #### INFO: CURRENT ELECTION ####
  } else if (message.text.indexOf('what do I vote for?') >= 0) {
    whatDoIVoteFor(message.user, channel);

  // #### NEW ELECTION ####
  } else if (message.text.indexOf('new election') >= 0) {
    if (message.user == process.env.SLACK_ADMIN_USER) {
      var electionName = message.text.split(" ") [4];
      var nrOfInitVotes = parseInt(message.text.split(" ") [3]);

      resetElection(electionName, nrOfInitVotes, message.user, channel);
    }
    else
      slack.sendMessage('<@'+ message.user +'>: You are not allowed to clean yccounts! Why you do that!', channel.id);
  
  // #### BACKUP functionality in case the registration at contract fails because the account does not have money yet. ####
  } else if (message.text.indexOf('register at contract') >= 0) {
    registerUserAtContract(message.user, channel);

  // #### BACKUP functionality to register already existing ethereum testnet account. ####
  } else if (message.text.indexOf('register account') >= 0) {
    var address = message.text.split(" ") [3];
    var pwd = message.text.split(" ") [4];
    
    registerAccount(message.user, address, pwd, channel);

  // #### BACKUP functionality in case the unlock at contract fails because the account does not have money yet. ####
  } else if (message.text.indexOf('unlock at contract') >= 0) {
    unlockUserAtContract(message.user, channel);


  // #### REGISTER ####
  } else if (message.text.indexOf('register') >= 0) {
    //console.log('Email address for login:', process.env.EMAIL_ADR);
    //console.log('Email pwd for login:', process.env.EMAIL_PWD);

    var email_adr_stuff = message.text.split(" ") [2];
    var email_adr = email_adr_stuff.substring(8, email_adr_stuff.indexOf("@senacor.com") + 12);

    if (email_adr.indexOf('@senacor.com') >= 0) {
      //console.log(email_adr);
      sendRegistrationEmail(channel, message.user, email_adr);
    }
    else {
      slack.sendMessage('<@'+ message.user +'>: the email address you provided is not allowed. it has to be a Senacor email address.', channel.id);
    }

  // #### UNLOCK ####
  } else if (message.text.indexOf('unlock') >= 0) {
    var reg_code = message.text.split(" ") [2];

    unlockVoterAccount(channel, message.user, reg_code);

  // #### VOTE ####
  } else if (message.text.indexOf('add party') >= 0) {

    var partyName = message.text.split(" ") [3];

    addPartyToElection(message.user, partyName, channel);

  // #### VOTE ####
  } else if (message.text.indexOf('vote') >= 0) {

    var nrOfVotes = message.text.split(" ") [2];
    var partyName = message.text.split(" ") [3];

    voteForParty(message.user, partyName, parseInt(nrOfVotes), channel);

  // #### REMOVE MIN ACCOUNTS ####
  } else if (message.text.indexOf('clean min accounts') >= 0) {

    console.log(message.user);
    if (message.user == process.env.SLACK_ADMIN_USER)
      cleanupEmptyEthereumAccounts(channel, true);
    else
      slack.sendMessage('<@'+ message.user +'>: You are not allowed to clean accounts! Why you do that?', channel.id);

  // #### REMOVE ZERO ACCOUNTS ####
  } else if (message.text.indexOf('clean accounts') >= 0) {

    if (message.user == process.env.SLACK_ADMIN_USER)
      cleanupEmptyEthereumAccounts(channel, false);
    else
      slack.sendMessage('<@'+ message.user +'>: You are not allowed to clean accounts! Why you do that?', channel.id);

  // #### COMMAND NOT RECOGNIZED ####
  } else {
    slack.sendMessage('<@'+ message.user +'>: Sorry, I am not sure what you are trying to tell me.', channel.id);
  }
  
}

slack.on(RTM_EVENTS.MESSAGE, function handleRtmMessage(message) {
  if (me !== null) {
    if ((message.text) && (message.text.indexOf(me.id) >= 0)) {
      console.log("Incoming message");
      processAction(message);
    }
  }
  if (message.subtype && message.subtype == "channel_join") {
      slack.sendMessage('<@'+ message.user +'>, please execute the "@fancypants join (telephone number)" ', message.channel);
  }
  console.log('Message:', message);
});