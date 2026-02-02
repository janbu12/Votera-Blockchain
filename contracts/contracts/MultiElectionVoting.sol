// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract MultiElectionVoting {
    address public admin;
    address public signer;

    struct Candidate {
        string name;
        uint256 voteCount;
        bool isActive;
    }

    struct Election {
        string title;
        bool isOpen;
        uint256 candidatesCount;
        uint256 activeCandidatesCount;
    }

    uint256 public electionsCount;

    // electionId => Election
    mapping(uint256 => Election) public elections;

    // electionId => candidateId => Candidate
    mapping(uint256 => mapping(uint256 => Candidate)) private _candidates;

    // electionId => voter => voted?
    mapping(uint256 => mapping(address => bool)) public hasVoted;
    // electionId => nimHash => voted?
    mapping(uint256 => mapping(bytes32 => bool)) public hasVotedNim;

    event ElectionCreated(uint256 indexed electionId, string title);
    event CandidateAdded(uint256 indexed electionId, uint256 indexed candidateId, string name);
    event CandidateUpdated(uint256 indexed electionId, uint256 indexed candidateId, string name);
    event CandidateHidden(uint256 indexed electionId, uint256 indexed candidateId);
    event ElectionStatusChanged(uint256 indexed electionId, bool isOpen);
    event Voted(uint256 indexed electionId, address indexed voter, uint256 indexed candidateId);
    event SignerUpdated(address indexed signer);

    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin");
        _;
    }

    modifier onlySigner() {
        require(msg.sender == signer, "Only signer");
        _;
    }

    constructor() {
        admin = msg.sender;
        signer = msg.sender;
    }

    function createElection(string calldata title) external onlyAdmin returns (uint256 electionId) {
        electionsCount += 1;
        electionId = electionsCount;

        elections[electionId] = Election({
            title: title,
            isOpen: false,
            candidatesCount: 0,
            activeCandidatesCount: 0
        });

        emit ElectionCreated(electionId, title);
    }

    function addCandidate(uint256 electionId, string calldata name) external onlyAdmin {
        require(electionId > 0 && electionId <= electionsCount, "Invalid election");
        require(!elections[electionId].isOpen, "Election already open");

        elections[electionId].candidatesCount += 1;
        elections[electionId].activeCandidatesCount += 1;
        uint256 candidateId = elections[electionId].candidatesCount;

        _candidates[electionId][candidateId] = Candidate({
            name: name,
            voteCount: 0,
            isActive: true
        });

        emit CandidateAdded(electionId, candidateId, name);
    }

    function openElection(uint256 electionId) external onlyAdmin {
        require(electionId > 0 && electionId <= electionsCount, "Invalid election");
        require(elections[electionId].activeCandidatesCount > 0, "No candidates");
        elections[electionId].isOpen = true;
        emit ElectionStatusChanged(electionId, true);
    }

    function closeElection(uint256 electionId) external onlyAdmin {
        require(electionId > 0 && electionId <= electionsCount, "Invalid election");
        elections[electionId].isOpen = false;
        emit ElectionStatusChanged(electionId, false);
    }

    function getCandidate(uint256 electionId, uint256 candidateId)
        external
        view
        returns (uint256 id, string memory name, uint256 voteCount, bool isActive)
    {
        require(electionId > 0 && electionId <= electionsCount, "Invalid election");
        require(candidateId > 0 && candidateId <= elections[electionId].candidatesCount, "Invalid candidate");
        Candidate storage c = _candidates[electionId][candidateId];
        return (candidateId, c.name, c.voteCount, c.isActive);
    }

    function updateCandidate(uint256 electionId, uint256 candidateId, string calldata name) external onlyAdmin {
        require(electionId > 0 && electionId <= electionsCount, "Invalid election");
        require(!elections[electionId].isOpen, "Election open");
        require(candidateId > 0 && candidateId <= elections[electionId].candidatesCount, "Invalid candidate");

        Candidate storage c = _candidates[electionId][candidateId];
        require(c.isActive, "Candidate hidden");
        c.name = name;
        emit CandidateUpdated(electionId, candidateId, name);
    }

    function hideCandidate(uint256 electionId, uint256 candidateId) external onlyAdmin {
        require(electionId > 0 && electionId <= electionsCount, "Invalid election");
        require(!elections[electionId].isOpen, "Election open");
        require(candidateId > 0 && candidateId <= elections[electionId].candidatesCount, "Invalid candidate");

        Candidate storage c = _candidates[electionId][candidateId];
        require(c.isActive, "Candidate hidden");
        c.isActive = false;
        elections[electionId].activeCandidatesCount -= 1;
        emit CandidateHidden(electionId, candidateId);
    }

    function vote(
        uint256 electionId,
        uint256 candidateId,
        bytes32 nimHash,
        uint256 deadline,
        bytes calldata signature
    ) external {
        require(electionId > 0 && electionId <= electionsCount, "Invalid election");
        require(elections[electionId].isOpen, "Election closed");
        require(!hasVoted[electionId][msg.sender], "Already voted");
        require(!hasVotedNim[electionId][nimHash], "NIM already voted");
        require(candidateId > 0 && candidateId <= elections[electionId].candidatesCount, "Invalid candidate");
        require(_candidates[electionId][candidateId].isActive, "Candidate hidden");
        require(block.timestamp <= deadline, "Signature expired");

        bytes32 messageHash = keccak256(
            abi.encodePacked(address(this), electionId, msg.sender, nimHash, deadline)
        );
        bytes32 ethSignedHash = keccak256(
            abi.encodePacked("\x19Ethereum Signed Message:\n32", messageHash)
        );
        address recovered = _recover(ethSignedHash, signature);
        require(recovered == signer, "Invalid signature");

        hasVoted[electionId][msg.sender] = true;
        hasVotedNim[electionId][nimHash] = true;
        _candidates[electionId][candidateId].voteCount += 1;

        emit Voted(electionId, msg.sender, candidateId);
    }

    function voteByRelayer(
        uint256 electionId,
        uint256 candidateId,
        bytes32 nimHash
    ) external onlySigner {
        require(electionId > 0 && electionId <= electionsCount, "Invalid election");
        require(elections[electionId].isOpen, "Election closed");
        require(!hasVotedNim[electionId][nimHash], "NIM already voted");
        require(candidateId > 0 && candidateId <= elections[electionId].candidatesCount, "Invalid candidate");
        require(_candidates[electionId][candidateId].isActive, "Candidate hidden");

        hasVotedNim[electionId][nimHash] = true;
        _candidates[electionId][candidateId].voteCount += 1;

        emit Voted(electionId, msg.sender, candidateId);
    }

    function setSigner(address newSigner) external onlyAdmin {
        require(newSigner != address(0), "Invalid signer");
        signer = newSigner;
        emit SignerUpdated(newSigner);
    }

    function _recover(bytes32 hash, bytes calldata signature) internal pure returns (address) {
        require(signature.length == 65, "Invalid signature length");
        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly {
            r := calldataload(signature.offset)
            s := calldataload(add(signature.offset, 32))
            v := byte(0, calldataload(add(signature.offset, 64)))
        }
        if (v < 27) {
            v += 27;
        }
        require(v == 27 || v == 28, "Invalid signature v");
        return ecrecover(hash, v, r, s);
    }
}
