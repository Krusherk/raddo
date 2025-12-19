// ============ Config ============
const CONTRACT_ADDRESS = '0xE6D70350224FA26aC9d0F88D0110F44e0F8f36C4';
const CHAIN_ID = 10143;
const CHAIN_NAME = 'Monad Testnet';
const RPC_URL = 'https://testnet-rpc.monad.xyz';
const EXPLORER = 'https://testnet.monadexplorer.com';

const CONTRACT_ABI = [
    "event GameCreated(uint256 indexed gameId, address indexed player1, uint8 tier, uint256 betAmount)",
    "event GameStarted(uint256 indexed gameId, address indexed player2)",
    "event VRFRequested(uint256 indexed gameId, uint64 sequenceNumber)",
    "event DangerousTilesSet(uint256 indexed gameId)",
    "event MoveMade(uint256 indexed gameId, address indexed player, uint8 tile, bool hitDanger)",
    "event GameFinished(uint256 indexed gameId, address indexed winner, uint256 payout)",
    "function joinGame(uint8 tier) external payable",
    "function makeMove(uint256 gameId, uint8 tile) external",
    "function getGame(uint256 gameId) external view returns (address player1, address player2, uint8 tier, uint256 betAmount, uint8 state, address currentTurn, address winner, uint256 revealedTiles)",
    "function getWaitingGame(uint8 tier) external view returns (uint256)",
    "function getRequiredPayment(uint8 tier) external pure returns (uint256)",
    "function gameCounter() external view returns (uint256)",
    "function playerActiveGame(address player) external view returns (uint256)"
];

const GameState = { WaitingForPlayer: 0, WaitingForVRF: 1, InProgress: 2, Finished: 3 };
const BET_AMOUNTS = { 0: 1, 1: 5, 2: 10 };

// ============ State ============
let provider = null;
let signer = null;
let contract = null;
let userAddress = null;
let currentGameId = null;
let dropdownOpen = false;

// ============ DOM ============
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const dom = {
    connectBtn: $('#connectBtn'),
    walletDropdown: $('#walletDropdown'),
    copyAddressBtn: $('#copyAddressBtn'),
    disconnectBtn: $('#disconnectBtn'),
    balanceDisplay: $('#balanceDisplay'),
    balanceValue: $('#balanceValue'),
    landingView: $('#landingView'),
    lobbyView: $('#lobbyView'),
    gameView: $('#gameView'),
    howItWorksView: $('#howItWorksView'),
    playNowBtn: $('#playNowBtn'),
    howItWorksLink: $('#howItWorksLink'),
    backFromHowItWorks: $('#backFromHowItWorks'),
    backToLanding: $('#backToLanding'),
    statGames: $('#statGames'),
    statWaiting: $('#statWaiting'),
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
    exitGameBtn: $('#exitGameBtn'),
    resultOverlay: $('#resultOverlay'),
    resultIcon: $('#resultIcon'),
    resultTitle: $('#resultTitle'),
    resultInfo: $('#resultInfo'),
    resultBtn: $('#resultBtn'),
    notifications: $('#notifications')
};

// ============ Init ============
document.addEventListener('DOMContentLoaded', () => {
    createBoard();
    bindEvents();
    checkExistingConnection();
});

function bindEvents() {
    console.log('Binding events...');
    console.log('connectBtn element:', dom.connectBtn);

    if (dom.connectBtn) {
        dom.connectBtn.addEventListener('click', handleWalletClick);
        console.log('Connect button event bound');
    } else {
        console.error('Connect button not found!');
    }

    dom.copyAddressBtn?.addEventListener('click', copyAddress);
    dom.disconnectBtn?.addEventListener('click', disconnectWallet);

    if (dom.playNowBtn) {
        dom.playNowBtn.addEventListener('click', () => {
            if (!userAddress) {
                connectWallet();
            } else {
                showView('lobby');
            }
        });
    }
    dom.howItWorksLink?.addEventListener('click', (e) => {
        e.preventDefault();
        showView('howItWorks');
    });
    dom.backFromHowItWorks?.addEventListener('click', () => showView('landing'));
    dom.backToLanding?.addEventListener('click', () => showView('landing'));
    dom.exitGameBtn?.addEventListener('click', exitGame);
    dom.resultBtn?.addEventListener('click', closeResult);

    $$('.stake-btn').forEach(btn => {
        btn.addEventListener('click', () => joinGame(parseInt(btn.dataset.tier)));
    });

    document.addEventListener('click', (e) => {
        if (!e.target.closest('.wallet-wrapper') && dropdownOpen) {
            closeDropdown();
        }
    });
}

async function checkExistingConnection() {
    if (typeof window.ethereum !== 'undefined') {
        try {
            const accounts = await window.ethereum.request({ method: 'eth_accounts' });
            if (accounts.length > 0) {
                await connectWallet();
            }
        } catch (e) {
            console.log('No existing connection');
        }
    }
}

// ============ Wallet ============
function handleWalletClick() {
    if (userAddress) {
        toggleDropdown();
    } else {
        connectWallet();
    }
}

function toggleDropdown() {
    dropdownOpen = !dropdownOpen;
    dom.walletDropdown?.classList.toggle('hidden', !dropdownOpen);
}

function closeDropdown() {
    dropdownOpen = false;
    dom.walletDropdown?.classList.add('hidden');
}

function copyAddress() {
    if (userAddress) {
        navigator.clipboard.writeText(userAddress);
        notify('Address copied!', 'success');
        closeDropdown();
    }
}

function disconnectWallet() {
    userAddress = null;
    provider = null;
    signer = null;
    contract = null;
    currentGameId = null;

    dom.connectBtn.innerHTML = `
    <span class="connect-text">Connect</span>
    <svg class="connect-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/>
      <polyline points="10 17 15 12 10 7"/>
      <line x1="15" y1="12" x2="3" y2="12"/>
    </svg>
  `;
    dom.connectBtn.classList.remove('connected');
    dom.balanceDisplay?.classList.add('hidden');
    closeDropdown();
    showView('landing');
    notify('Wallet disconnected', 'info');
}

async function connectWallet() {
    console.log('Connect wallet clicked');

    if (typeof window.ethereum === 'undefined') {
        notify('Please install MetaMask!', 'error');
        return;
    }

    try {
        notify('Connecting wallet...', 'info');

        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        console.log('Accounts:', accounts);

        userAddress = accounts[0];

        provider = new ethers.BrowserProvider(window.ethereum);
        signer = await provider.getSigner();

        const network = await provider.getNetwork();
        console.log('Network:', network.chainId);

        if (Number(network.chainId) !== CHAIN_ID) {
            await switchNetwork();
        }

        contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
        console.log('Contract ready');

        dom.connectBtn.innerHTML = `<span class="connect-text">${truncate(userAddress)}</span>`;
        dom.connectBtn.classList.add('connected');

        await updateBalance();
        setupEvents();
        await checkActiveGame();
        await updateStats();

        setInterval(() => {
            if (currentGameId) refreshGame();
            else updateStats();
            updateBalance();
        }, 5000);

        notify('Wallet connected!', 'success');

    } catch (err) {
        console.error('Connection error:', err);
        notify(err.message || 'Connection failed', 'error');
    }
}

async function updateBalance() {
    if (!provider || !userAddress) return;

    try {
        const balance = await provider.getBalance(userAddress);
        const formatted = parseFloat(ethers.formatEther(balance)).toFixed(2);
        if (dom.balanceValue) dom.balanceValue.textContent = formatted;
        dom.balanceDisplay?.classList.remove('hidden');
    } catch (err) {
        console.error('Balance error:', err);
    }
}

async function switchNetwork() {
    const chainIdHex = '0x' + CHAIN_ID.toString(16);

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
                    chainName: CHAIN_NAME,
                    nativeCurrency: { name: 'MON', symbol: 'MON', decimals: 18 },
                    rpcUrls: [RPC_URL],
                    blockExplorerUrls: [EXPLORER]
                }]
            });
        } else {
            throw err;
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
            if (!hitDanger) await refreshGame();
        }
    });

    contract.on('GameFinished', async (gameId, winner, payout) => {
        if (Number(gameId) === currentGameId) {
            const won = winner.toLowerCase() === userAddress.toLowerCase();
            showResult(won, ethers.formatEther(payout));
            await updateBalance();
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
        notify('Transaction sent...', 'info');
        await tx.wait();
        await updateBalance();
    } catch (err) {
        console.error(err);
        notify(err.reason || err.message || 'Transaction failed', 'error');
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

// ============ UI ============
function showView(view) {
    dom.landingView?.classList.add('hidden');
    dom.lobbyView?.classList.add('hidden');
    dom.gameView?.classList.add('hidden');
    dom.howItWorksView?.classList.add('hidden');

    if (view === 'landing') dom.landingView?.classList.remove('hidden');
    if (view === 'lobby') {
        dom.lobbyView?.classList.remove('hidden');
        updateStats();
    }
    if (view === 'game') dom.gameView?.classList.remove('hidden');
    if (view === 'howItWorks') dom.howItWorksView?.classList.remove('hidden');
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
        if (dom.statGames) dom.statGames.textContent = Number(total);

        let waiting = 0;
        for (let tier = 0; tier <= 2; tier++) {
            const gameId = await contract.getWaitingGame(tier);
            const hasWaiting = Number(gameId) > 0;

            const statusEl = $(`#stake${tier}Status`);
            if (statusEl) {
                if (hasWaiting) {
                    statusEl.classList.add('waiting');
                    statusEl.querySelector('.status-text').textContent = 'Player waiting';
                    waiting++;
                } else {
                    statusEl.classList.remove('waiting');
                    statusEl.querySelector('.status-text').textContent = 'Empty lobby';
                }
            }
        }
        if (dom.statWaiting) dom.statWaiting.textContent = waiting;
    } catch (err) {
        console.error(err);
    }
}

async function refreshGame() {
    if (!currentGameId) return;

    try {
        const game = await contract.getGame(currentGameId);

        if (dom.gameId) dom.gameId.textContent = `#${currentGameId}`;
        const potMon = Number(ethers.formatEther(game.betAmount)) * 2;
        if (dom.gamePot) dom.gamePot.textContent = `${potMon} MON`;

        const isP1 = game.player1.toLowerCase() === userAddress.toLowerCase();
        if (dom.p1Addr) dom.p1Addr.textContent = truncate(game.player1);
        if (dom.p2Addr) dom.p2Addr.textContent = game.player2 !== ethers.ZeroAddress ? truncate(game.player2) : 'Waiting...';

        dom.p1Card?.classList.toggle('is-you', isP1);
        dom.p2Card?.classList.toggle('is-you', !isP1 && game.player2 !== ethers.ZeroAddress);

        const isMyTurn = game.currentTurn.toLowerCase() === userAddress.toLowerCase();
        const isP1Turn = game.currentTurn.toLowerCase() === game.player1.toLowerCase();

        dom.p1Card?.classList.toggle('active', Number(game.state) === GameState.InProgress && isP1Turn);
        dom.p2Card?.classList.toggle('active', Number(game.state) === GameState.InProgress && !isP1Turn);

        const stateText = {
            [GameState.WaitingForPlayer]: 'Waiting for opponent',
            [GameState.WaitingForVRF]: 'Generating tiles...',
            [GameState.InProgress]: isMyTurn ? 'Your turn' : "Opponent's turn",
            [GameState.Finished]: 'Game over'
        };

        if (dom.gameState) {
            dom.gameState.textContent = stateText[Number(game.state)];
            dom.gameState.classList.toggle('your-turn', Number(game.state) === GameState.InProgress && isMyTurn);
        }

        const showOverlay = Number(game.state) === GameState.WaitingForPlayer || Number(game.state) === GameState.WaitingForVRF;
        dom.boardOverlay?.classList.toggle('visible', showOverlay);
        if (dom.overlayText) dom.overlayText.textContent = stateText[Number(game.state)];

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
    if (!dom.gameBoard) return;
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
    if (dom.resultIcon) dom.resultIcon.textContent = won ? '🏆' : '💀';
    if (dom.resultTitle) {
        dom.resultTitle.textContent = won ? 'Victory!' : 'Defeated';
        dom.resultTitle.className = `result-title ${won ? 'win' : 'lose'}`;
    }
    if (dom.resultInfo) dom.resultInfo.textContent = won ? `You won ${payout} MON` : 'Better luck next time';
    dom.resultOverlay?.classList.remove('hidden');
}

function closeResult() {
    dom.resultOverlay?.classList.add('hidden');
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
    console.log(`[${type}] ${message}`);
    const el = document.createElement('div');
    el.className = `notification ${type}`;
    el.innerHTML = `<span class="notification-text">${message}</span>`;
    dom.notifications?.appendChild(el);
    setTimeout(() => el.remove(), 4000);
}
