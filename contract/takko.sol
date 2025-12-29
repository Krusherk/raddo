// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IEntropyConsumer} from "@pythnetwork/entropy-sdk-solidity/IEntropyConsumer.sol";
import {IEntropyV2} from "@pythnetwork/entropy-sdk-solidity/IEntropyV2.sol";

/**
 * @title DangerTiles
 * @notice A pay-per-match tile game where players avoid dangerous tiles
 * @dev Uses Pyth Entropy for VRF randomness on Monad Testnet
 * 
 * Game Rules:
 * - Players pay betAmount + 1 MON fee to join
 * - VRF selects 2 dangerous tiles on a 5x5 grid
 * - Players take turns selecting tiles
 * - First player to hit a dangerous tile loses
 * - Winner receives 2x betAmount
 */
contract DangerTiles is IEntropyConsumer {
    // ============ Constants ============
    uint256 public constant PLATFORM_FEE = 1 ether; // 1 MON
    uint256 public constant GRID_SIZE = 25; // 5x5 grid
    uint256 public constant DANGER_TILE_COUNT = 2;

    uint256 public constant TIER_1_BET = 1 ether;   // 1 MON
    uint256 public constant TIER_2_BET = 5 ether;   // 5 MON
    uint256 public constant TIER_3_BET = 10 ether;  // 10 MON

    // ============ Enums ============
    enum GameState {
        WaitingForPlayer,
        WaitingForVRF,
        InProgress,
        Finished
    }

    enum BetTier {
        OneMon,
        FiveMon,
        TenMon
    }

    // ============ Structs ============
    struct Game {
        address player1;
        address player2;
        BetTier tier;
        uint256 betAmount;
        GameState state;
        uint8 dangerTile1;
        uint8 dangerTile2;
        address currentTurn;
        address winner;
        uint64 vrfSequenceNumber;
        uint256 revealedTiles; // Bitmap of revealed tiles
    }

    // ============ State Variables ============
    IEntropyV2 public immutable entropy;
    address public owner;
    uint256 public platformBalance;
    
    uint256 public gameCounter;
    mapping(uint256 => Game) public games;
    
    // Waiting lobbies per tier (gameId, 0 if none waiting)
    mapping(BetTier => uint256) public waitingLobbies;
    
    // VRF sequence number to gameId mapping
    mapping(uint64 => uint256) public vrfToGame;
    
    // Player's active game
    mapping(address => uint256) public playerActiveGame;

    // ============ Events ============
    event GameCreated(uint256 indexed gameId, address indexed player1, BetTier tier, uint256 betAmount);
    event GameStarted(uint256 indexed gameId, address indexed player2);
    event VRFRequested(uint256 indexed gameId, uint64 sequenceNumber);
    event DangerousTilesSet(uint256 indexed gameId);
    event MoveMade(uint256 indexed gameId, address indexed player, uint8 tile, bool hitDanger);
    event GameFinished(uint256 indexed gameId, address indexed winner, uint256 payout);
    event PlatformWithdraw(address indexed to, uint256 amount);

    // ============ Errors ============
    error InvalidPayment(uint256 expected, uint256 received);
    error PlayerAlreadyInGame();
    error GameNotFound();
    error NotYourTurn();
    error GameNotInProgress();
    error InvalidTile();
    error TileAlreadyRevealed();
    error OnlyEntropy();
    error OnlyOwner();
    error TransferFailed();

    // ============ Modifiers ============
    modifier onlyOwner() {
        if (msg.sender != owner) revert OnlyOwner();
        _;
    }

    // ============ Constructor ============
    constructor(address _entropy) {
        entropy = IEntropyV2(_entropy);
        owner = msg.sender;
    }

    // ============ External Functions ============

    /**
     * @notice Join or create a game in the specified tier
     * @param tier The bet tier (0=1MON, 1=5MON, 2=10MON)
     */
    function joinGame(BetTier tier) external payable {
        // Check player not already in active game
        if (playerActiveGame[msg.sender] != 0) {
            uint256 existingGameId = playerActiveGame[msg.sender];
            Game storage existingGame = games[existingGameId];
            if (existingGame.state != GameState.Finished) {
                revert PlayerAlreadyInGame();
            }
        }

        uint256 betAmount = _getBetAmount(tier);
        uint256 requiredPayment = betAmount + PLATFORM_FEE;
        
        if (msg.value != requiredPayment) {
            revert InvalidPayment(requiredPayment, msg.value);
        }

        uint256 waitingGameId = waitingLobbies[tier];
        
        if (waitingGameId == 0) {
            // No one waiting - create new game
            _createGame(tier, betAmount);
        } else {
            // Someone waiting - join their game
            _joinExistingGame(waitingGameId, tier);
        }
    }

    /**
     * @notice Make a move by selecting a tile
     * @param gameId The game ID
     * @param tile The tile index (0-24)
     */
    function makeMove(uint256 gameId, uint8 tile) external {
        Game storage game = games[gameId];
        
        if (game.state != GameState.InProgress) revert GameNotInProgress();
        if (msg.sender != game.currentTurn) revert NotYourTurn();
        if (tile >= GRID_SIZE) revert InvalidTile();
        if (_isTileRevealed(game.revealedTiles, tile)) revert TileAlreadyRevealed();

        // Mark tile as revealed
        game.revealedTiles |= (1 << tile);

        // Check if hit dangerous tile
        bool hitDanger = (tile == game.dangerTile1 || tile == game.dangerTile2);
        
        emit MoveMade(gameId, msg.sender, tile, hitDanger);

        if (hitDanger) {
            // Current player loses
            address loser = msg.sender;
            address winner = (loser == game.player1) ? game.player2 : game.player1;
            _finishGame(gameId, winner);
        } else {
            // Switch turns
            game.currentTurn = (msg.sender == game.player1) ? game.player2 : game.player1;
        }
    }

    /**
     * @notice Withdraw platform fees (owner only)
     * @param to Address to send funds
     * @param amount Amount to withdraw
     */
    function withdrawPlatformFees(address to, uint256 amount) external onlyOwner {
        if (amount > platformBalance) revert TransferFailed();
        platformBalance -= amount;
        
        (bool success, ) = to.call{value: amount}("");
        if (!success) revert TransferFailed();
        
        emit PlatformWithdraw(to, amount);
    }

    // ============ View Functions ============

    /**
     * @notice Get game details
     */
    function getGame(uint256 gameId) external view returns (
        address player1,
        address player2,
        BetTier tier,
        uint256 betAmount,
        GameState state,
        address currentTurn,
        address winner,
        uint256 revealedTiles
    ) {
        Game storage game = games[gameId];
        return (
            game.player1,
            game.player2,
            game.tier,
            game.betAmount,
            game.state,
            game.currentTurn,
            game.winner,
            game.revealedTiles
        );
    }

    /**
     * @notice Get dangerous tiles (only visible after game finished)
     */
    function getDangerousTiles(uint256 gameId) external view returns (uint8, uint8) {
        Game storage game = games[gameId];
        require(game.state == GameState.Finished, "Game not finished");
        return (game.dangerTile1, game.dangerTile2);
    }

    /**
     * @notice Check if a tile has been revealed
     */
    function isTileRevealed(uint256 gameId, uint8 tile) external view returns (bool) {
        return _isTileRevealed(games[gameId].revealedTiles, tile);
    }

    /**
     * @notice Get waiting game for a tier (0 if none)
     */
    function getWaitingGame(BetTier tier) external view returns (uint256) {
        return waitingLobbies[tier];
    }

    /**
     * @notice Get required payment for a tier
     */
    function getRequiredPayment(BetTier tier) external pure returns (uint256) {
        return _getBetAmount(tier) + PLATFORM_FEE;
    }

    // ============ IEntropyConsumer Implementation ============

    function getEntropy() internal view override returns (address) {
        return address(entropy);
    }

    function entropyCallback(
        uint64 sequenceNumber,
        address /* provider */,
        bytes32 randomNumber
    ) internal override {
        uint256 gameId = vrfToGame[sequenceNumber];
        if (gameId == 0) return; // Invalid callback

        Game storage game = games[gameId];
        if (game.state != GameState.WaitingForVRF) return;

        // Generate two different dangerous tiles from random number
        uint8 tile1 = uint8(uint256(randomNumber) % GRID_SIZE);
        uint8 tile2 = uint8((uint256(randomNumber) >> 8) % GRID_SIZE);
        
        // Ensure tiles are different
        if (tile1 == tile2) {
            tile2 = uint8((tile2 + 1) % GRID_SIZE);
        }

        game.dangerTile1 = tile1;
        game.dangerTile2 = tile2;
        game.state = GameState.InProgress;
        game.currentTurn = game.player1; // Player 1 goes first

        emit DangerousTilesSet(gameId);
    }

    // ============ Internal Functions ============

    function _createGame(BetTier tier, uint256 betAmount) internal {
        gameCounter++;
        uint256 gameId = gameCounter;

        games[gameId] = Game({
            player1: msg.sender,
            player2: address(0),
            tier: tier,
            betAmount: betAmount,
            state: GameState.WaitingForPlayer,
            dangerTile1: 0,
            dangerTile2: 0,
            currentTurn: address(0),
            winner: address(0),
            vrfSequenceNumber: 0,
            revealedTiles: 0
        });

        waitingLobbies[tier] = gameId;
        playerActiveGame[msg.sender] = gameId;

        emit GameCreated(gameId, msg.sender, tier, betAmount);
    }

    function _joinExistingGame(uint256 gameId, BetTier tier) internal {
        Game storage game = games[gameId];
        
        // Validate game state
        require(game.state == GameState.WaitingForPlayer, "Game not waiting");
        require(game.player1 != msg.sender, "Cannot play yourself");

        game.player2 = msg.sender;
        game.state = GameState.WaitingForVRF;
        
        // Clear waiting lobby
        waitingLobbies[tier] = 0;
        playerActiveGame[msg.sender] = gameId;

        emit GameStarted(gameId, msg.sender);

        // Request VRF
        _requestRandomness(gameId);
    }

    function _requestRandomness(uint256 gameId) internal {
        // Get VRF fee
        uint256 vrfFee = entropy.getFeeV2();
        
        // Platform keeps: 2 * PLATFORM_FEE - vrfFee (from both players)
        // We collected 2 MON total in fees
        platformBalance += (2 * PLATFORM_FEE) - vrfFee;

        // Request random number
        uint64 sequenceNumber = entropy.requestV2{value: vrfFee}();
        
        games[gameId].vrfSequenceNumber = sequenceNumber;
        vrfToGame[sequenceNumber] = gameId;

        emit VRFRequested(gameId, sequenceNumber);
    }

    function _finishGame(uint256 gameId, address winner) internal {
        Game storage game = games[gameId];
        
        game.state = GameState.Finished;
        game.winner = winner;

        // Winner gets both bets
        uint256 payout = game.betAmount * 2;
        
        // Clear active game status
        playerActiveGame[game.player1] = 0;
        playerActiveGame[game.player2] = 0;

        emit GameFinished(gameId, winner, payout);

        // Transfer payout to winner
        (bool success, ) = winner.call{value: payout}("");
        if (!success) revert TransferFailed();
    }

    function _getBetAmount(BetTier tier) internal pure returns (uint256) {
        if (tier == BetTier.OneMon) return TIER_1_BET;
        if (tier == BetTier.FiveMon) return TIER_2_BET;
        return TIER_3_BET;
    }

    function _isTileRevealed(uint256 bitmap, uint8 tile) internal pure returns (bool) {
        return (bitmap & (1 << tile)) != 0;
    }

    // ============ Receive Function ============
    receive() external payable {}
}
