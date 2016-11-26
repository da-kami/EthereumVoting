pragma solidity ^0.4.2;

contract Election {
	address public admin;

    string public electionName;
    uint public initialNrOfVotesPerPerson;

    mapping(string => uint) private partyVotes;
    mapping(address => uint) public personVotes;
    mapping(address => bool) public voterIsAlreadyUnlocked;

    bool public initialized;

    string public highestVotesParty;
    uint public nrOfVotesHighestVotesParty;

    modifier adminOnly() { if (msg.sender == admin) _; }

    function Election() {
        initialized = false;
    }

    /*  */
    function setElection(string _electionName, uint _initialNrOfVotesPerPerson) adminOnly {
    	if (_initialNrOfVotesPerPerson < 1) throw;
    	if (bytes(_electionName).length < 1) throw;

        electionName = _electionName;
        initialNrOfVotesPerPerson = _initialNrOfVotesPerPerson;
        initialized = true;
    }

    function addParty(string _partyName) adminOnly {
    	partyVotes[_partyName] = 0;

    	if (bytes(highestVotesParty).length == 0)
    	{
    		highestVotesParty = _partyName;
    	}
    }

    function registerVoter() {
    	voterIsAlreadyUnlocked[msg.sender] = false;
    }

    function unlockVoter(address _voterToBeUnlocked) adminOnly {
    	voterIsAlreadyUnlocked[_voterToBeUnlocked] = true;
    	personVotes[_voterToBeUnlocked] = initialNrOfVotesPerPerson;
    }

    function vote(string _partyName, uint _nrOfVotes)
    {
    	if (!voterIsAlreadyUnlocked[msg.sender]) throw;
    	if (personVotes[msg.sender] < _nrOfVotes) throw;
    	if (partyVotes[_partyName] == uint(0x0)) throw;

    	personVotes[msg.sender] -= _nrOfVotes;
    	partyVotes[_partyName] += _nrOfVotes;

    	if (partyVotes[_partyName] > nrOfVotesHighestVotesParty)
    	{
    		highestVotesParty = _partyName;
    		nrOfVotesHighestVotesParty = partyVotes[_partyName];
    	}
    }

    function getPartyWithHighestVotes() returns (string party) {
    	return highestVotesParty;
    }

    function getNrOfVotesOfHighestVotesParty() returns (uint votes) {
    	return nrOfVotesHighestVotesParty;
    }
    
    function getVotesForParty(string _partyName) returns (uint votes) {
        return partyVotes[_partyName];
    }
}