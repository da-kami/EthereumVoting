var emailSenderClient = require('./sendemail');
//var ethClient = require('./ethereumclient');

var rpc = require('json-rpc2');
var rpcClient = rpc.Client.$create(8545, "localhost");

var Web3 = require('./node_modules/web3');
var web3 = new Web3();
//set provider for ethereum     ???
web3.setProvider(new web3.providers.HttpProvider('http://localhost:8545'));
// define coinbase
var coinbase = web3.eth.coinbase;

//access filesystem
var fs = require('fs');
//define slackclient
var RtmClient = require('@slack/client').RtmClient;
//reading functions from slack
var CLIENT_EVENTS = require('@slack/client').CLIENT_EVENTS;
var RTM_CLIENT_EVENTS = require('@slack/client').CLIENT_EVENTS.RTM;
var RTM_EVENTS = require('@slack/client').RTM_EVENTS;
//
var MemoryDataStore = require('@slack/client').MemoryDataStore;

//encoding obsolete
var bot_token = process.env.SLACK_BOT_TOKEN;
//bot name
var bot_name = process.env.SLACK_BOT_NAME;
//initialize slack
var slack = new RtmClient(bot_token, {
  logLevel: 'error',
//initialize Datastore ???
  dataStore: new MemoryDataStore(),
  autoReconnect: true,
  autoMark: true
});
//Global Variables
//var me = null;
//var currentLottery = null;
//playerNum of participants
//var roomPlayers = {};
var voterRegisterCode = {};
var voterRegistry = {};
var voterToAddress = {};
var voterToPwd = {};
var voterToEmail = {};

// daka: removed twilio from this version; get this working if needed in the end
//twilio variables
//var accountSid = '';
//var authToken = '';
//var accountRealSid = '';
//var telNumberTo = "";
//var telNumberFrom = "";
//var client = require('twilio')(accountSid, authToken);

var filePath = './files/';
var binary_file = 'lottery_binary.txt';
var definition_file = 'contract_abi.json';
var definition_JSON = JSON.parse(fs.readFileSync(filePath + definition_file, 'utf8'));
var definition_string = JSON.stringify(definition_JSON);

// DELETE START
//var definition = fs.readFileSync(filePath + binary_file, 'utf8').trim();
//var Lottery = web3.eth.contract(definition_JSON);
//currentLottery = Lottery.at(definition);
// DELETE END

var election = web3.eth.contract(definition_JSON);
var electionInst = null;
electionInst = election.at();

var chooseResult = null;
var theWinner = null;

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

var unlockCoinbaseAccount = function(passphrase, timeInSeconds) {
  web3.personal.unlockAccount(web3.eth.coinbase, passphrase, timeInSeconds);
}

var testSlack = function(channel) {
	slack.sendMessage('hi there, I am your bot!', channel.id);
	console.log("sent test message to channel..." + channel.id);
}

var printLottery = function (channel) {
  slack.sendMessage('there is a lottery running on ' + currentLottery.address, channel.id);
  slack.sendMessage('here is definition:', channel.id);
  slack.sendMessage(definition_string, channel.id);
  console.log(currentLottery);
}

var printHelp = function(channel) {
  slack.sendMessage('This is an automated Lottery Bot utilizing the ethereum blockchain and smart contracts', channel.id);
  slack.sendMessage('It accepts the following commands: ',channel.id);
  slack.sendMessage('balance: - returns your account balance',channel.id);
  slack.sendMessage('running: - returns if a lottery is currently running',channel.id);
  slack.sendMessage('join (<number>): - lets you join the active lottery with the given telephone number',channel.id);
  slack.sendMessage('end game - ends the current game ',channel.id);
  slack.sendMessage('notify - sends a SMS to the winner',channel.id);
}

// TO BE DELETED
/*var endGame = function (channel) {
  slack.sendMessage('All players are now registered. Starting game...', channel.id);
  
  unlockCoinbaseAccount(process.env.COINBASE_PWD, 1200);


  //web3.personal.unlockAccount(web3.eth.accounts[0], passphrase);
  console.log('choose winner call')
  if (chooseResult === null) {
    chooseResult = currentLottery.chooseWinner.sendTransaction({from: web3.eth.accounts[0]}, function(err,result) {
      theWinner = JSON.stringify(result);
      console.log('chooseWinner ['+JSON.stringify(err)+'] [' +JSON.stringify(result)+ ']');
      console.log('should we notify the winner?');
    });
  }
  console.log(JSON.stringify(chooseResult));
  setTimeout(function() {
    slack.sendMessage('Winner is ['+ currentLottery.getWinner.call() +']', channel.id);
    roomPlayers[channel.id] = 0;
  }, 30000);
}*/

var removeAccountsExceptFromCoinbase = function(channel) {
  // TODO: Implement this, all the generated accounts should be removed through this function.
  // only the coinbase should remain
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

  emailSenderClient.sendAnEmail(process.env.EMAIL_ADR, process.env.EMAIL_PWD, emailAdr, 'Your registration code', 'Call: unlock ' + registerCode);
  voterToEmail[uName] = emailAdr;
  slack.sendMessage('<@'+ uName +'>: Registration code was sent to: ' + emailAdr, channel.id);
}

var unlockVoterAccount = function(channel, uName, uCode) {
  var registerCode = voterRegisterCode[uName];

  console.log("unlock: code saved in program: " + registerCode);
  console.log("unlock: code given by user: " + uCode);

  if (parseInt(uCode) == registerCode) {
    
    voterRegistry[uName] = true;

    emailSenderClient.sendAnEmail(process.env.EMAIL_ADR, process.env.EMAIL_PWD, voterToEmail[uName], 'Your ethereum account', 'address: ' + voterToAddress[uName] + ", password: " + voterToPwd[uName]);

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

  var accountId;

  // works
  rpcClient.call("personal_newAccount", [pwdNewAccount], function(err,result){ 
    console.log('Account created', result);
    
    if (err != null)
    {
      console.log('ERROR', err);
      slack.sendMessage('<@'+ uName +'>: ERROR: Failed to create account! ', channel.id);
    }
    
    voterToAddress[uName] = result;

    // TODO: transact money to account...

  });
}

var processAction = function (message) {
  var channel = slack.dataStore.getChannelGroupOrDMById(message.channel);
  //if (!roomPlayers[channel.id]) roomPlayers[channel.id] = 0;

  if (message.text.indexOf('init') >= 0) {
    //slack.sendMessage('Initializing game', channel.id);
    //console.log('Initializing game');
    //web3.personal.unlockAccount(web3.eth.accounts[0], passphrase);
    //currentLottery.initialize.sendTransaction({from:web3.eth.accounts[0], gas: 1000000});
    //chooseResult = null;
  } else if (message.text.indexOf('lottery') >= 0 && message.text.indexOf('running') >= 0) {
    slack.sendMessage('Hello <@'+ message.user +'>!', channel.id);
    if (currentLottery === null) {
      slack.sendMessage('there is no lottery running', channel.id);
    } else {
      printLottery(channel);
    }
  } else if (message.text.indexOf('balance') >= 0) {
    var balance = web3.fromWei(web3.eth.getBalance(coinbase));
    slack.sendMessage('Hello <@'+ message.user +'>, your balance is ' + balance.toString(10) + " Ether", channel.id);
  } else if ((message.text.indexOf('join') >= 0) && (message.text.split(" ").length == 3)) {
    /*web3.personal.unlockAccount(web3.eth.accounts[0], passphrase);
    var telephone_number = message.text.split(" ") [2];
    var addResult = currentLottery.addPlayer.sendTransaction(telephone_number, {from: web3.eth.accounts[0]});
    console.log(addResult);
    slack.sendMessage('<@'+ message.user +'>, your are now added to lottery', channel.id);
    roomPlayers[channel.id] = roomPlayers[channel.id] + 1;
    console.log('playerNum is [' + roomPlayers[channel.id] +']');
    var threshold = channel.members.length - 1;
    console.log('threshold [' + threshold + ']');
    if (roomPlayers[channel.id] === threshold) {
      endGame(channel);
    } */
  } else if (message.text.indexOf("end game") >= 0) {
    endGame(channel);
  } else if(message.text.indexOf('help') >= 0) {
	   printHelp(channel);
  } else if (message.text.indexOf('test slack') >= 0) {
	  //testSlack(channel);
    console.log(message.user);
  } else if (message.text.indexOf('node status') >= 0) {
	  printEthereumNodeStats(channel);
  
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

  //} else if (message.text.indexOf('test new account') >= 0) {
  //    newEthereumAccount(channel);
  }
  
  
  // daka: This is the twilio part; currently not in use; fix later
  // else if (message.text.indexOf('notify') >= 0) {
    // client.calls.create({
      // url: "https://handler.twilio.com/twiml/EH50cc57c16f97c4dba1acc1c3af741b77",
      // to: theWinner,
      // from: ""
    // }, function(err, call) {
      // process.stdout.write(call.sid);
    // });
  // }
  web3.eth.getBlock("pending", true).transactions;
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
