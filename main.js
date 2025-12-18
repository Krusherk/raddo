import { ethers } from 'ethers';
import { CONTRACT_CONFIG, CONTRACT_ABI, GameState, BetTier, BET_AMOUNTS } from './contract.js';

// ============ State ============
let provider = null;
let signer = null;
let contract = null;
let userAddress = null;
let currentGameId = null;
let pollInterval = null;

// ============ DOM Elements ============
const elements = {
    connectBtn: document.getElementById('connectBtn'),
    heroSection: document.getElementById('heroSection'),
    lobbySection: document.getElementById('lobbySection'),
    gameSection: document.getElementById('gameSection'),
    resultModal: document.getElementById('resultModal'),

    // Stats
    totalGames: document.getElementById('totalGames'),
    waitingGames: document.getElementById('waitingGames'),

    // Tier waiting indicators
    tier0Waiting: document.getElementById('tier0Waiting'),
    tier1Waiting: document.getElementById('tier1Waiting'),
    tier2Waiting: document.getElementById('tier2Waiting'),

    // Game elements
    currentGameId: document.getElementById('currentGameId'),
    currentBet: document.getElementById('currentBet'),
    gameStatus: document.getElementById('gameStatus'),
    player1Card: document.getElementById('player1Card'),
    player2Card: document.getElementById('player2Card'),
    player1Address: document.getElementById('player1Address'),
    player2Address: document.getElementById('player2Address'),
    gameBoard: document.getElementById('gameBoard'),
    leaveGameBtn: document.getElementById('leaveGameBtn'),

    // Modal
    resultIcon: document.getElementById('resultIcon'),
    resultTitle: document.getElementById('resultTitle'),
    resultMessage: document.getElementById('resultMessage'),
    closeModalBtn: document.getElementById('closeModalBtn'),

    toastContainer: document.getElementById('toastContainer')
};

// ============ Initialization ============
async function init() {
    // Set up event listeners
    elements.connectBtn.addEventListener('click', connectWallet);
    elements.leaveGameBtn.addEventListener('click', leaveGame);
    elements.closeModalBtn.addEventListener('click', closeModal);

    // Tier button listeners
    document.querySelectorAll('.btn-tier').forEach(btn => {
        btn.addEventListener('click', () => joinGame(parseInt(btn.dataset.tier)));
    });

    // Check if already connected
    if (window.ethereum) {
        const accounts = await window.ethereum.request({ method: 'eth_accounts' });
        if (accounts.length > 0) {
            await connectWallet();
        }
    }

    // Create game board tiles
    createGameBoard();
}

// ============ Wallet Connection ============
async function connectWallet() {
    if (!window.ethereum) {
        showToast('Please install MetaMask!', 'error');
        return;
    }

    try {
        // Request accounts
        const accounts = await window.ethereum.request({
            method: 'eth_requestAccounts'
        });

        // Setup provider and signer
        provider = new ethers.BrowserProvider(window.ethereum);
        signer = await provider.getSigner();
        userAddress = accounts[0];

        // Check network
        const network = await provider.getNetwork();
        if (Number(network.chainId) !== CONTRACT_CONFIG.chainId) {
            await switchToMonad();
        }

        // Setup contract
        contract = new ethers.Contract(
            CONTRACT_CONFIG.address,
            CONTRACT_ABI,
            signer
        );

        // Update UI
        elements.connectBtn.innerHTML = `
      <span class="btn-icon">✓</span>
      <span>${formatAddress(userAddress)}</span>
    `;

        // Show lobby
        elements.heroSection.classList.add('hidden');
        elements.lobbySection.classList.remove('hidden');

        // Setup event listeners
        setupContractEvents();

        // Check for active game
        await checkActiveGame();

        // Update lobby stats
        await updateLobbyStats();

        // Start polling
        startPolling();

        showToast('Wallet connected!', 'success');

    } catch (error) {
        console.error('Connection error:', error);
        showToast('Failed to connect wallet', 'error');
    }
}

async function switchToMonad() {
    try {
        await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: `0x${CONTRACT_CONFIG.chainId.toString(16)}` }]
        });
    } catch (switchError) {
        // Chain not added, add it
        if (switchError.code === 4902) {
            await window.ethereum.request({
                method: 'wallet_addEthereumChain',
                params: [{
                    chainId: `0x${CONTRACT_CONFIG.chainId.toString(16)}`,
                    chainName: CONTRACT_CONFIG.chainName,
                    nativeCurrency: CONTRACT_CONFIG.currency,
                    rpcUrls: [CONTRACT_CONFIG.rpcUrl],
                    blockExplorerUrls: [CONTRACT_CONFIG.blockExplorer]
                }]
            });
        } else {
            throw switchError;
        }
    }
}

// ============ Contract Events ============
function setupContractEvents() {
    contract.on('GameCreated', (gameId, player1, tier, betAmount) => {
        console.log('GameCreated:', gameId, player1, tier);
        updateLobbyStats();

        if (player1.toLowerCase() === userAddress.toLowerCase()) {
            currentGameId = Number(gameId);
            showGameSection(currentGameId);
            showToast('Game created! Waiting for opponent...', 'info');
        }
    });

    contract.on('GameStarted', (gameId, player2) => {
        console.log('GameStarted:', gameId, player2);

        if (Number(gameId) === currentGameId) {
            elements.player2Address.textContent = formatAddress(player2);
            elements.gameStatus.textContent = 'Waiting for VRF...';
            showToast('Opponent joined! Generating random tiles...', 'info');
        }
    });

    contract.on('DangerousTilesSet', (gameId) => {
        console.log('DangerousTilesSet:', gameId);

        if (Number(gameId) === currentGameId) {
            elements.gameStatus.textContent = 'Game in progress!';
            refreshGameState();
            showToast('Danger tiles set! Game started!', 'success');
        }
    });

    contract.on('MoveMade', (gameId, player, tile, hitDanger) => {
        console.log('MoveMade:', gameId, player, tile, hitDanger);

        if (Number(gameId) === currentGameId) {
            revealTile(Number(tile), hitDanger);
            if (!hitDanger) {
                refreshGameState();
            }
        }
    });

    contract.on('GameFinished', async (gameId, winner, payout) => {
        console.log('GameFinished:', gameId, winner, payout);

        if (Number(gameId) === currentGameId) {
            const isWinner = winner.toLowerCase() === userAddress.toLowerCase();
            showResult(isWinner, ethers.formatEther(payout));
        }
    });
}

// ============ Game Actions ============
async function joinGame(tier) {
    if (!contract) {
        showToast('Please connect wallet first', 'error');
        return;
    }

    try {
        const requiredPayment = await contract.getRequiredPayment(tier);

        showToast(`Joining ${BET_AMOUNTS[tier]} MON game...`, 'info');

        const tx = await contract.joinGame(tier, { value: requiredPayment });
        await tx.wait();

    } catch (error) {
        console.error('Join game error:', error);
        showToast(error.reason || 'Failed to join game', 'error');
    }
}

async function makeMove(tile) {
    if (!contract || currentGameId === null) return;

    try {
        const tx = await contract.makeMove(currentGameId, tile);
        await tx.wait();
    } catch (error) {
        console.error('Move error:', error);
        showToast(error.reason || 'Failed to make move', 'error');
    }
}

function leaveGame() {
    currentGameId = null;
    elements.gameSection.classList.add('hidden');
    elements.lobbySection.classList.remove('hidden');
    resetGameBoard();
}

// ============ UI Updates ============
async function checkActiveGame() {
    try {
        const activeGameId = await contract.playerActiveGame(userAddress);
        if (Number(activeGameId) > 0) {
            const game = await contract.getGame(activeGameId);
            if (Number(game.state) !== GameState.Finished) {
                currentGameId = Number(activeGameId);
                showGameSection(currentGameId);
            }
        }
    } catch (error) {
        console.error('Check active game error:', error);
    }
}

async function updateLobbyStats() {
    try {
        const totalGames = await contract.gameCounter();
        elements.totalGames.textContent = Number(totalGames);

        let waitingCount = 0;

        for (let tier = 0; tier <= 2; tier++) {
            const waitingGameId = await contract.getWaitingGame(tier);
            const hasWaiting = Number(waitingGameId) > 0;

            const waitingEl = document.getElementById(`tier${tier}Waiting`);
            if (hasWaiting) {
                waitingEl.classList.add('has-player');
                waitingEl.querySelector('span:last-child').textContent = 'Player waiting!';
                waitingCount++;
            } else {
                waitingEl.classList.remove('has-player');
                waitingEl.querySelector('span:last-child').textContent = 'No one waiting';
            }
        }

        elements.waitingGames.textContent = waitingCount;

    } catch (error) {
        console.error('Update lobby stats error:', error);
    }
}

async function showGameSection(gameId) {
    elements.lobbySection.classList.add('hidden');
    elements.gameSection.classList.remove('hidden');

    await refreshGameState();
}

async function refreshGameState() {
    if (currentGameId === null) return;

    try {
        const game = await contract.getGame(currentGameId);

        // Update game info
        elements.currentGameId.textContent = currentGameId;
        elements.currentBet.textContent = ethers.formatEther(game.betAmount);

        // Update players
        elements.player1Address.textContent = formatAddress(game.player1);
        elements.player2Address.textContent = game.player2 !== ethers.ZeroAddress
            ? formatAddress(game.player2)
            : 'Waiting...';

        // Highlight current player and your card
        const isPlayer1 = game.player1.toLowerCase() === userAddress.toLowerCase();
        const isMyTurn = game.currentTurn.toLowerCase() === userAddress.toLowerCase();

        elements.player1Card.classList.toggle('is-you', isPlayer1);
        elements.player2Card.classList.toggle('is-you', !isPlayer1);

        elements.player1Card.classList.toggle('active',
            Number(game.state) === GameState.InProgress &&
            game.currentTurn.toLowerCase() === game.player1.toLowerCase()
        );
        elements.player2Card.classList.toggle('active',
            Number(game.state) === GameState.InProgress &&
            game.currentTurn.toLowerCase() === game.player2.toLowerCase()
        );

        // Update status
        const stateMessages = {
            [GameState.WaitingForPlayer]: 'Waiting for opponent...',
            [GameState.WaitingForVRF]: 'Generating random tiles...',
            [GameState.InProgress]: isMyTurn ? '🎯 Your turn!' : "Opponent's turn...",
            [GameState.Finished]: 'Game finished!'
        };
        elements.gameStatus.textContent = stateMessages[Number(game.state)];

        // Update board
        updateBoardState(game);

    } catch (error) {
        console.error('Refresh game state error:', error);
    }
}

function updateBoardState(game) {
    const isMyTurn = game.currentTurn.toLowerCase() === userAddress.toLowerCase();
    const isInProgress = Number(game.state) === GameState.InProgress;

    const tiles = document.querySelectorAll('.tile');
    tiles.forEach((tile, index) => {
        const isRevealed = (BigInt(game.revealedTiles) & (1n << BigInt(index))) !== 0n;

        tile.classList.toggle('revealed', isRevealed);
        tile.classList.toggle('disabled', !isInProgress || !isMyTurn || isRevealed);

        if (isRevealed && !tile.classList.contains('safe') && !tile.classList.contains('danger')) {
            tile.classList.add('safe');
            tile.textContent = '✓';
        }
    });
}

function revealTile(tileIndex, isDanger) {
    const tile = document.querySelectorAll('.tile')[tileIndex];
    tile.classList.add('revealed');
    tile.classList.remove('disabled');

    if (isDanger) {
        tile.classList.add('danger');
        tile.textContent = '💀';
    } else {
        tile.classList.add('safe');
        tile.textContent = '✓';
    }
}

function createGameBoard() {
    elements.gameBoard.innerHTML = '';
    for (let i = 0; i < 25; i++) {
        const tile = document.createElement('button');
        tile.className = 'tile disabled';
        tile.dataset.index = i;
        tile.addEventListener('click', () => {
            if (!tile.classList.contains('disabled') && !tile.classList.contains('revealed')) {
                makeMove(i);
            }
        });
        elements.gameBoard.appendChild(tile);
    }
}

function resetGameBoard() {
    const tiles = document.querySelectorAll('.tile');
    tiles.forEach(tile => {
        tile.className = 'tile disabled';
        tile.textContent = '';
    });
}

function showResult(isWinner, payout) {
    elements.resultIcon.textContent = isWinner ? '🎉' : '💀';
    elements.resultTitle.textContent = isWinner ? 'You Won!' : 'You Lost!';
    elements.resultMessage.textContent = isWinner
        ? `You received ${payout} MON`
        : 'Better luck next time!';

    elements.resultModal.classList.remove('hidden');
}

function closeModal() {
    elements.resultModal.classList.add('hidden');
    leaveGame();
    updateLobbyStats();
}

// ============ Helpers ============
function formatAddress(address) {
    if (!address || address === ethers.ZeroAddress) return '-';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;

    elements.toastContainer.appendChild(toast);

    setTimeout(() => {
        toast.remove();
    }, 4000);
}

function startPolling() {
    pollInterval = setInterval(() => {
        if (currentGameId !== null) {
            refreshGameState();
        } else {
            updateLobbyStats();
        }
    }, 5000);
}

// ============ Start ============
init();
