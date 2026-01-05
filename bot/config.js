// Contract configuration for Danger Tiles bot
export const CONTRACT_ADDRESS = '0xE6D70350224FA26aC9d0F88D0110F44e0F8f36C4';

export const RPC_URL = 'https://testnet-rpc.monad.xyz';
export const CHAIN_ID = 10143;

export const CONTRACT_ABI = [
    // Events
    "event GameCreated(uint256 indexed gameId, address indexed player1, uint8 tier, uint256 betAmount)",
    "event GameStarted(uint256 indexed gameId, address indexed player2)",
    "event MoveMade(uint256 indexed gameId, address indexed player, uint8 tile, bool hitDanger)",
    "event GameFinished(uint256 indexed gameId, address indexed winner, uint256 payout)",

    // Functions
    "function joinGame(uint8 tier) external payable",
    "function makeMove(uint256 gameId, uint8 tile) external",
    "function getGame(uint256 gameId) external view returns (address player1, address player2, uint8 tier, uint256 betAmount, uint8 state, address currentTurn, address winner, uint256 revealedTiles)",
    "function getWaitingGame(uint8 tier) external view returns (uint256)",
    "function getRequiredPayment(uint8 tier) external pure returns (uint256)",
    "function gameCounter() external view returns (uint256)",
    "function playerActiveGame(address player) external view returns (uint256)"
];

export const GameState = {
    WaitingForPlayer: 0,
    WaitingForVRF: 1,
    InProgress: 2,
    Finished: 3
};

// Bet amounts in MON
export const BET_AMOUNTS = [1, 5, 10];

// Bot configuration
export const BOT_CONFIG = {
    POLL_INTERVAL: 5000,        // Poll for games every 5 seconds
    MOVE_DELAY: 1500,           // Wait 1.5 seconds before making a move (feels more natural)
    MAX_CONCURRENT_GAMES: 3,    // Max games bot can play at once
    ENABLED_TIERS: [0, 1, 2]    // Which tiers the bot will join (0=1MON, 1=5MON, 2=10MON)
};
