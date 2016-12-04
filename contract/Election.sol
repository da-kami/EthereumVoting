pragma solidity ^0.4.2;

contract Election {

    address public admin;

    string public electionName;
    uint public initialNrOfVotesPerPerson;

    mapping(string => uint) private partyVotes;
    mapping(address => uint) public personVotes;
    mapping(address => bool) public voterIsAlreadyUnlocked;

    string[] public parties;

    bool public initialized;

    string public highestVotesParty;
    uint public nrOfVotesHighestVotesParty;

    modifier adminOnly() { if (msg.sender == admin) _; }

    function Election(
        string _electionName, 
        uint _initialNrOfVotesPerPerson) {
        
        admin = msg.sender;

        electionName = _electionName;
        initialNrOfVotesPerPerson = _initialNrOfVotesPerPerson;

        //for (uint i = 0; i < parties.length)
    }

    // Interesting fun fact: Resetting has the bug that one cannot reset the mappings.
    // So one can set a new election, but the parties and their votes stay :D
    // Thus: Reset not allowed any more, just use one contract instance per election!
    /*function setElection(string _electionName, uint _initialNrOfVotesPerPerson) adminOnly {
        if (_initialNrOfVotesPerPerson < 1) throw;
        if (bytes(_electionName).length < 1) throw;

        electionName = _electionName;
        initialNrOfVotesPerPerson = _initialNrOfVotesPerPerson;
        initialized = true;
    }*/

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
        if (voterIsAlreadyUnlocked[_voterToBeUnlocked]) throw;

        voterIsAlreadyUnlocked[_voterToBeUnlocked] = true;
        personVotes[_voterToBeUnlocked] = initialNrOfVotesPerPerson;
    }

    function vote(string _partyName, uint _nrOfVotes)
    {
        if (!voterIsAlreadyUnlocked[msg.sender]) throw;
        if (personVotes[msg.sender] < _nrOfVotes) throw;

        uint currPersVotes = personVotes[msg.sender];
        personVotes[msg.sender] = currPersVotes - _nrOfVotes;

        uint currentVotes = partyVotes[_partyName];
        partyVotes[_partyName] = currentVotes + _nrOfVotes;

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

    function getCurrentElectionName() returns (string name) {
        return electionName;
    }

    function getInitialVotesPerPerson() returns (uint votes) {
        return initialNrOfVotesPerPerson;
    }

    function isVoterRegisteredAndUnlocked(address _voter) returns (bool status) {
        return voterIsAlreadyUnlocked[_voter];
    }
 }