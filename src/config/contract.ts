export const CONTRACT_ADDRESS = '0xE6D70350224FA26aC9d0F88D0110F44e0F8f36C4';

export const CHAIN_ID = 10143;
export const CHAIN_NAME = 'Monad Testnet';
export const RPC_URL = 'https://testnet-rpc.monad.xyz';
export const EXPLORER_URL = 'https://testnet.monadexplorer.com';

export const CONTRACT_ABI = [
    // Events
    "event GameCreated(uint256 indexed gameId, address indexed player1, uint8 tier, uint256 betAmount)",
    "event GameStarted(uint256 indexed gameId, address indexed player2)",
    "event VRFRequested(uint256 indexed gameId, uint64 sequenceNumber)",
    "event DangerousTilesSet(uint256 indexed gameId)",
    "event MoveMade(uint256 indexed gameId, address indexed player, uint8 tile, bool hitDanger)",
    "event GameFinished(uint256 indexed gameId, address indexed winner, uint256 payout)",

    // Functions
    "function joinGame(uint8 tier) external payable",
    "function makeMove(uint256 gameId, uint8 tile) external",
    "function getGame(uint256 gameId) external view returns (address player1, address player2, uint8 tier, uint256 betAmount, uint8 state, address currentTurn, address winner, uint256 revealedTiles)",
    "function getDangerousTiles(uint256 gameId) external view returns (uint8, uint8)",
    "function games(uint256) external view returns (address player1, address player2, uint8 tier, uint256 betAmount, uint8 state, uint8 dangerTile1, uint8 dangerTile2, address currentTurn, address winner, uint64 vrfSequenceNumber, uint256 revealedTiles)",
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
} as const;

export const BetTier = {
    OneMon: 0,
    FiveMon: 1,
    TenMon: 2
} as const;

export const BET_AMOUNTS = [1, 5, 10];

export const MONAD_CHAIN = {
    id: 10143,
    name: 'Monad Testnet',
    network: 'monad-testnet',
    nativeCurrency: { name: 'MON', symbol: 'MON', decimals: 18 },
    rpcUrls: { default: { http: ['https://testnet-rpc.monad.xyz'] } },
    blockExplorers: { default: { name: 'Monad Explorer', url: 'https://testnet.monadexplorer.com' } }
};
