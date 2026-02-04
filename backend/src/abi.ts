export const VOTING_READ_ABI = [
  {
    name: "hasVotedNim",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "", type: "uint256" },
      { name: "", type: "bytes32" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

export const VOTING_WRITE_ABI = [
  {
    name: "voteByRelayer",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "electionId", type: "uint256" },
      { name: "candidateId", type: "uint256" },
      { name: "nimHash", type: "bytes32" },
    ],
    outputs: [],
  },
] as const;

export const VOTING_ADMIN_ABI = [
  {
    name: "createElection",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "title", type: "string" }],
    outputs: [{ name: "electionId", type: "uint256" }],
  },
  {
    name: "addCandidate",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "electionId", type: "uint256" },
      { name: "name", type: "string" },
    ],
    outputs: [],
  },
  {
    name: "openElection",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "electionId", type: "uint256" }],
    outputs: [],
  },
  {
    name: "closeElection",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "electionId", type: "uint256" }],
    outputs: [],
  },
  {
    name: "updateCandidate",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "electionId", type: "uint256" },
      { name: "candidateId", type: "uint256" },
      { name: "name", type: "string" },
    ],
    outputs: [],
  },
  {
    name: "hideCandidate",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "electionId", type: "uint256" },
      { name: "candidateId", type: "uint256" },
    ],
    outputs: [],
  },
  {
    name: "setElectionMode",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "electionId", type: "uint256" },
      { name: "mode", type: "uint8" },
    ],
    outputs: [],
  },
  {
    name: "setElectionSchedule",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "electionId", type: "uint256" },
      { name: "startTime", type: "uint64" },
      { name: "endTime", type: "uint64" },
    ],
    outputs: [],
  },
  {
    name: "getCandidate",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "electionId", type: "uint256" },
      { name: "candidateId", type: "uint256" },
    ],
    outputs: [
      { name: "id", type: "uint256" },
      { name: "name", type: "string" },
      { name: "voteCount", type: "uint256" },
      { name: "isActive", type: "bool" },
    ],
  },
  {
    name: "electionsCount",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "getElection",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "electionId", type: "uint256" }],
    outputs: [
      { name: "title", type: "string" },
      { name: "isOpen", type: "bool" },
      { name: "mode", type: "uint8" },
      { name: "startTime", type: "uint64" },
      { name: "endTime", type: "uint64" },
      { name: "candidatesCount", type: "uint256" },
      { name: "activeCandidatesCount", type: "uint256" },
    ],
  },
] as const;
