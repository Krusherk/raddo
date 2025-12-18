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
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const dom = {
    connectBtn: $('#connectBtn'),
    landingView: $('#landingView'),
    lobbyView: $('#lobbyView'),
    gameView: $('#gameView'),
    playNowBtn: $('#playNowBtn'),
    backToLanding: $('#backToLanding'),

    // Stats
    statGames: $('#statGames'),
    statWaiting: $('#statWaiting'),

    // Stakes
    stake0Status: $('#stake0Status'),
    stake1Status: $('#stake1Status'),
    stake2Status: $('#stake2Status'),

    // Game
    gameId: $('#gameId'),
    gamePot: $('#gamePot'),
    gameState: $('#gameState'),
    gameBoard: $('#gameBoard'),
    boardOverlay: $('#boardOverlay'),
    overlayText: $('#overlayText'),
    p1Card: $('#p1Card'),
    p2Card: $('#p2Card'),
    p1Addr: $('#p1Addr'),
    p2Addr: $('#p2Addr'),
    p1You: $('#p1You'),
    p2You: $('#p2You'),
    exitGameBtn: $('#exitGameBtn'),

    // Result
    resultOverlay: $('#resultOverlay'),
    resultIcon: $('#resultIcon'),
    resultTitle: $('#resultTitle'),
    resultInfo: $('#resultInfo'),
    resultBtn: $('#resultBtn'),

    notifications: $('#notifications')
};

// ============ Initialize ============
function init() {
    createBoard();
    bindEvents();
    checkExistingConnection();
}

function bindEvents() {
    dom.connectBtn.addEventListener('click', connectWallet);
    dom.playNowBtn.addEventListener('click', () => {
        if (!userAddress) {
            connectWallet();
        } else {
            showView('lobby');
        }
    });
    dom.backToLanding.addEventListener('click', () => showView('landing'));
    dom.exitGameBtn.addEventListener('click', exitGame);
    dom.resultBtn.addEventListener('click', closeResult);

    $$('.stake-btn').forEach(btn => {
        btn.addEventListener('click', () => joinGame(parseInt(btn.dataset.tier)));
    });
}

async function checkExistingConnection() {
    if (window.ethereum) {
        const accounts = await window.ethereum.request({ method: 'eth_accounts' });
        if (accounts.length > 0) {
            await connectWallet();
        }
    }
}

// ============ Wallet ============
async function connectWallet() {
    if (!window.ethereum) {
        notify('Please install MetaMask', 'error');
        return;
    }

    try {
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        provider = new ethers.BrowserProvider(window.ethereum);
        signer = await provider.getSigner();
        userAddress = accounts[0];

        // Check and switch network
        const network = await provider.getNetwork();
        if (Number(network.chainId) !== CONTRACT_CONFIG.chainId) {
            await switchNetwork();
        }

        // Setup contract
        contract = new ethers.Contract(CONTRACT_CONFIG.address, CONTRACT_ABI, signer);

        // Update UI
        dom.connectBtn.innerHTML = `<span class="connect-text">${truncate(userAddress)}</span>`;
        dom.connectBtn.classList.add('connected');

        // Setup events
        setupEvents();

        // Check active game
        await checkActiveGame();

        // Update stats
        await updateStats();
        startPolling();

        notify('Wallet connected', 'success');

    } catch (err) {
        console.error(err);
        notify('Connection failed', 'error');
    }
}

async function switchNetwork() {
    const chainIdHex = '0x' + CONTRACT_CONFIG.chainId.toString(16);

    try {
        await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: chainIdHex }]
        });
    } catch (err) {
        if (err.code === 4902) {
            await window.ethereum.request({
                method: 'wallet_addEthereumChain',
                params: [{
                    chainId: chainIdHex,
                    chainName: CONTRACT_CONFIG.chainName,
                    nativeCurrency: CONTRACT_CONFIG.currency,
                    rpcUrls: [CONTRACT_CONFIG.rpcUrl],
                    blockExplorerUrls: [CONTRACT_CONFIG.blockExplorer]
                }]
            });
        }
    }
}

// ============ Contract Events ============
function setupEvents() {
    contract.on('GameCreated', async (gameId, player1) => {
        await updateStats();
        if (player1.toLowerCase() === userAddress.toLowerCase()) {
            currentGameId = Number(gameId);
            showView('game');
            await refreshGame();
            notify('Game created - waiting for opponent', 'info');
        }
    });

    contract.on('GameStarted', async (gameId) => {
        if (Number(gameId) === currentGameId) {
            await refreshGame();
            notify('Opponent joined!', 'success');
        }
    });

    contract.on('DangerousTilesSet', async (gameId) => {
        if (Number(gameId) === currentGameId) {
            await refreshGame();
            notify('Game started!', 'success');
        }
    });

    contract.on('MoveMade', async (gameId, player, tile, hitDanger) => {
        if (Number(gameId) === currentGameId) {
            revealTile(Number(tile), hitDanger);
            if (!hitDanger) {
                await refreshGame();
            }
        }
    });

    contract.on('GameFinished', async (gameId, winner, payout) => {
        if (Number(gameId) === currentGameId) {
            const won = winner.toLowerCase() === userAddress.toLowerCase();
            showResult(won, ethers.formatEther(payout));
        }
    });
}

// ============ Game Actions ============
async function joinGame(tier) {
    if (!contract) {
        notify('Connect wallet first', 'error');
        return;
    }

    try {
        const payment = await contract.getRequiredPayment(tier);
        notify(`Joining ${BET_AMOUNTS[tier]} MON game...`, 'info');

        const tx = await contract.joinGame(tier, { value: payment });
        await tx.wait();
    } catch (err) {
        console.error(err);
        notify(err.reason || 'Transaction failed', 'error');
    }
}

async function makeMove(tile) {
    if (!contract || !currentGameId) return;

    try {
        const tx = await contract.makeMove(currentGameId, tile);
        await tx.wait();
    } catch (err) {
        console.error(err);
        notify(err.reason || 'Move failed', 'error');
    }
}

function exitGame() {
    currentGameId = null;
    showView('lobby');
    resetBoard();
}

// ============ UI Updates ============
function showView(view) {
    dom.landingView.classList.add('hidden');
    dom.lobbyView.classList.add('hidden');
    dom.gameView.classList.add('hidden');

    if (view === 'landing') dom.landingView.classList.remove('hidden');
    if (view === 'lobby') {
        dom.lobbyView.classList.remove('hidden');
        updateStats();
    }
    if (view === 'game') dom.gameView.classList.remove('hidden');
}

async function checkActiveGame() {
    try {
        const gameId = await contract.playerActiveGame(userAddress);
        if (Number(gameId) > 0) {
            const game = await contract.getGame(gameId);
            if (Number(game.state) !== GameState.Finished) {
                currentGameId = Number(gameId);
                showView('game');
                await refreshGame();
                return;
            }
        }
        showView('lobby');
    } catch (err) {
        console.error(err);
        showView('lobby');
    }
}

async function updateStats() {
    if (!contract) return;

    try {
        const total = await contract.gameCounter();
        dom.statGames.textContent = Number(total);

        let waiting = 0;
        for (let tier = 0; tier <= 2; tier++) {
            const gameId = await contract.getWaitingGame(tier);
            const hasWaiting = Number(gameId) > 0;

            const statusEl = $(`#stake${tier}Status`);
            if (hasWaiting) {
                statusEl.classList.add('waiting');
                statusEl.querySelector('.status-text').textContent = 'Player waiting';
                waiting++;
            } else {
                statusEl.classList.remove('waiting');
                statusEl.querySelector('.status-text').textContent = 'Empty lobby';
            }
        }
        dom.statWaiting.textContent = waiting;
    } catch (err) {
        console.error(err);
    }
}

async function refreshGame() {
    if (!currentGameId) return;

    try {
        const game = await contract.getGame(currentGameId);

        // Update meta
        dom.gameId.textContent = `#${currentGameId}`;
        const potMon = Number(ethers.formatEther(game.betAmount)) * 2;
        dom.gamePot.textContent = `${potMon} MON`;

        // Players
        const isP1 = game.player1.toLowerCase() === userAddress.toLowerCase();
        dom.p1Addr.textContent = truncate(game.player1);
        dom.p2Addr.textContent = game.player2 !== ethers.ZeroAddress ? truncate(game.player2) : 'Waiting...';

        dom.p1Card.classList.toggle('is-you', isP1);
        dom.p2Card.classList.toggle('is-you', !isP1 && game.player2 !== ethers.ZeroAddress);

        // Current turn
        const isMyTurn = game.currentTurn.toLowerCase() === userAddress.toLowerCase();
        const isP1Turn = game.currentTurn.toLowerCase() === game.player1.toLowerCase();

        dom.p1Card.classList.toggle('active', Number(game.state) === GameState.InProgress && isP1Turn);
        dom.p2Card.classList.toggle('active', Number(game.state) === GameState.InProgress && !isP1Turn);

        // State
        const stateText = {
            [GameState.WaitingForPlayer]: 'Waiting for opponent',
            [GameState.WaitingForVRF]: 'Generating tiles...',
            [GameState.InProgress]: isMyTurn ? 'Your turn' : "Opponent's turn",
            [GameState.Finished]: 'Game over'
        };

        dom.gameState.textContent = stateText[Number(game.state)];
        dom.gameState.classList.toggle('your-turn', Number(game.state) === GameState.InProgress && isMyTurn);

        // Board overlay
        const showOverlay = Number(game.state) === GameState.WaitingForPlayer || Number(game.state) === GameState.WaitingForVRF;
        dom.boardOverlay.classList.toggle('visible', showOverlay);
        dom.overlayText.textContent = stateText[Number(game.state)];

        // Update tiles
        updateBoard(game);

    } catch (err) {
        console.error(err);
    }
}

function updateBoard(game) {
    const isMyTurn = game.currentTurn.toLowerCase() === userAddress.toLowerCase();
    const isActive = Number(game.state) === GameState.InProgress;

    $$('.tile').forEach((tile, i) => {
        const revealed = (BigInt(game.revealedTiles) & (1n << BigInt(i))) !== 0n;
        tile.classList.toggle('revealed', revealed);
        tile.classList.toggle('disabled', !isActive || !isMyTurn || revealed);
    });
}

function revealTile(index, isDanger) {
    const tile = $$('.tile')[index];
    tile.classList.add('revealed');
    tile.classList.add(isDanger ? 'danger' : 'safe');
}

function createBoard() {
    dom.gameBoard.innerHTML = '';
    for (let i = 0; i < 25; i++) {
        const tile = document.createElement('button');
        tile.className = 'tile disabled';
        tile.addEventListener('click', () => {
            if (!tile.classList.contains('disabled') && !tile.classList.contains('revealed')) {
                makeMove(i);
            }
        });
        dom.gameBoard.appendChild(tile);
    }
}

function resetBoard() {
    $$('.tile').forEach(tile => {
        tile.className = 'tile disabled';
    });
}

function showResult(won, payout) {
    dom.resultIcon.textContent = won ? '🏆' : '💀';
    dom.resultTitle.textContent = won ? 'Victory!' : 'Defeated';
    dom.resultTitle.className = `result-title ${won ? 'win' : 'lose'}`;
    dom.resultInfo.textContent = won ? `You won ${payout} MON` : 'Better luck next time';
    dom.resultOverlay.classList.remove('hidden');
}

function closeResult() {
    dom.resultOverlay.classList.add('hidden');
    currentGameId = null;
    showView('lobby');
    resetBoard();
    updateStats();
}

// ============ Helpers ============
function truncate(addr) {
    if (!addr || addr === ethers.ZeroAddress) return '-';
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function notify(message, type = 'info') {
    const el = document.createElement('div');
    el.className = `notification ${type}`;
    el.innerHTML = `<span class="notification-text">${message}</span>`;
    dom.notifications.appendChild(el);

    setTimeout(() => el.remove(), 4000);
}

function startPolling() {
    pollInterval = setInterval(() => {
        if (currentGameId) {
            refreshGame();
        } else {
            updateStats();
        }
    }, 5000);
}

// ============ Start ============
init();
