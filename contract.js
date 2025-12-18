// Contract configuration
export const CONTRACT_CONFIG = {
  // Deployed on Monad Testnet
  address: '0xE6D70350224FA26aC9d0F88D0110F44e0F8f36C4',

  chainId: 10143,
  chainName: 'Monad Testnet',
  rpcUrl: 'https://testnet-rpc.monad.xyz',

  currency: {
    name: 'MON',
    symbol: 'MON',
    decimals: 18
  },

  blockExplorer: 'https://testnet.monadexplorer.com'
};

// Contract ABI (only the functions we need)
export const CONTRACT_ABI = [
  // Events
  "event GameCreated(uint256 indexed gameId, address indexed player1, uint8 tier, uint256 betAmount)",
  "event GameStarted(uint256 indexed gameId, address indexed player2)",
  "event VRFRequested(uint256 indexed gameId, uint64 sequenceNumber)",
  "event DangerousTilesSet(uint256 indexed gameId)",
  "event MoveMade(uint256 indexed gameId, address indexed player, uint8 tile, bool hitDanger)",
  "event GameFinished(uint256 indexed gameId, address indexed winner, uint256 payout)",

  // Write functions
  "function joinGame(uint8 tier) external payable",
  "function makeMove(uint256 gameId, uint8 tile) external",

  // Read functions
  "function getGame(uint256 gameId) external view returns (address player1, address player2, uint8 tier, uint256 betAmount, uint8 state, address currentTurn, address winner, uint256 revealedTiles)",
  "function getWaitingGame(uint8 tier) external view returns (uint256)",
  "function getRequiredPayment(uint8 tier) external pure returns (uint256)",
  "function isTileRevealed(uint256 gameId, uint8 tile) external view returns (bool)",
  "function getDangerousTiles(uint256 gameId) external view returns (uint8, uint8)",
  "function gameCounter() external view returns (uint256)",
  "function playerActiveGame(address player) external view returns (uint256)",

  // Constants
  "function GRID_SIZE() external pure returns (uint256)",
  "function PLATFORM_FEE() external pure returns (uint256)"
];

// Game states matching contract enum
export const GameState = {
  WaitingForPlayer: 0,
  WaitingForVRF: 1,
  InProgress: 2,
  Finished: 3
};

// Bet tiers matching contract enum
export const BetTier = {
  OneMon: 0,
  FiveMon: 1,
  TenMon: 2
};

// Bet amounts in MON
export const BET_AMOUNTS = {
  [BetTier.OneMon]: 1,
  [BetTier.FiveMon]: 5,
  [BetTier.TenMon]: 10
};
