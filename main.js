// ============ Config ============
const CONTRACT_ADDRESS = '0xE6D70350224FA26aC9d0F88D0110F44e0F8f36C4';
const CHAIN_ID = 10143;
const CHAIN_NAME = 'Monad Testnet';
const RPC_URL = 'https://testnet-rpc.monad.xyz';
const EXPLORER = 'https://testnet.monadexplorer.com';

const CONTRACT_ABI = [
    "event GameCreated(uint256 indexed gameId, address indexed player1, uint8 tier, uint256 betAmount)",
    "event GameStarted(uint256 indexed gameId, address indexed player2)",
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

// ============ Wait for DOM ============
window.addEventListener('load', function () {
    console.log('Page loaded, initializing...');
    init();
});

function init() {
    // Get elements
    const connectBtn = document.getElementById('connectBtn');
    const playNowBtn = document.getElementById('playNowBtn');
    const copyAddressBtn = document.getElementById('copyAddressBtn');
    const disconnectBtn = document.getElementById('disconnectBtn');
    const howItWorksLink = document.getElementById('howItWorksLink');
    const backFromHowItWorks = document.getElementById('backFromHowItWorks');
    const backToLanding = document.getElementById('backToLanding');
    const exitGameBtn = document.getElementById('exitGameBtn');
    const resultBtn = document.getElementById('resultBtn');

    console.log('Connect button found:', connectBtn);

    // Bind connect button
    if (connectBtn) {
        connectBtn.onclick = function () {
            console.log('Connect clicked!');
            handleWalletClick();
        };
    }

    // Bind play now button
    if (playNowBtn) {
        playNowBtn.onclick = function () {
            if (!userAddress) {
                connectWallet();
            } else {
                showView('lobby');
            }
        };
    }

    // Bind other buttons
    if (copyAddressBtn) {
        copyAddressBtn.onclick = copyAddress;
    }

    if (disconnectBtn) {
        disconnectBtn.onclick = disconnectWallet;
    }

    if (howItWorksLink) {
        howItWorksLink.onclick = function (e) {
            e.preventDefault();
            showView('howItWorks');
        };
    }

    if (backFromHowItWorks) {
        backFromHowItWorks.onclick = function () {
            showView('landing');
        };
    }

    if (backToLanding) {
        backToLanding.onclick = function () {
            showView('landing');
        };
    }

    if (exitGameBtn) {
        exitGameBtn.onclick = exitGame;
    }

    if (resultBtn) {
        resultBtn.onclick = closeResult;
    }

    // Bind stake buttons
    document.querySelectorAll('.stake-btn').forEach(function (btn) {
        btn.onclick = function () {
            var tier = parseInt(btn.getAttribute('data-tier'));
            joinGame(tier);
        };
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', function (e) {
        if (!e.target.closest('.wallet-wrapper') && dropdownOpen) {
            closeDropdown();
        }
    });

    // Create game board
    createBoard();

    // Check existing connection
    checkExistingConnection();
}

// ============ Wallet Functions ============
function handleWalletClick() {
    console.log('handleWalletClick called, userAddress:', userAddress);
    if (userAddress) {
        toggleDropdown();
    } else {
        connectWallet();
    }
}

function toggleDropdown() {
    dropdownOpen = !dropdownOpen;
    var dropdown = document.getElementById('walletDropdown');
    if (dropdown) {
        dropdown.classList.toggle('hidden', !dropdownOpen);
    }
}

function closeDropdown() {
    dropdownOpen = false;
    var dropdown = document.getElementById('walletDropdown');
    if (dropdown) {
        dropdown.classList.add('hidden');
    }
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

    var connectBtn = document.getElementById('connectBtn');
    if (connectBtn) {
        connectBtn.innerHTML = '<span class="connect-text">Connect</span><svg class="connect-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>';
        connectBtn.classList.remove('connected');
    }

    var balanceDisplay = document.getElementById('balanceDisplay');
    if (balanceDisplay) {
        balanceDisplay.classList.add('hidden');
    }

    closeDropdown();
    showView('landing');
    notify('Wallet disconnected', 'info');
}

async function connectWallet() {
    console.log('connectWallet called');

    if (typeof window.ethereum === 'undefined') {
        notify('Please install MetaMask!', 'error');
        alert('Please install MetaMask to use this app!');
        return;
    }

    try {
        notify('Connecting wallet...', 'info');
        console.log('Requesting accounts...');

        var accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        console.log('Accounts received:', accounts);

        userAddress = accounts[0];

        provider = new ethers.BrowserProvider(window.ethereum);
        signer = await provider.getSigner();

        var network = await provider.getNetwork();
        console.log('Network:', network.chainId);

        if (Number(network.chainId) !== CHAIN_ID) {
            await switchNetwork();
        }

        contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
        console.log('Contract ready');

        // Update button
        var connectBtn = document.getElementById('connectBtn');
        if (connectBtn) {
            connectBtn.innerHTML = '<span class="connect-text">' + truncate(userAddress) + '</span>';
            connectBtn.classList.add('connected');
        }

        await updateBalance();
        setupEvents();
        await checkActiveGame();
        await updateStats();

        setInterval(function () {
            if (currentGameId) {
                refreshGame();
            } else {
                updateStats();
            }
            updateBalance();
        }, 5000);

        notify('Wallet connected!', 'success');

    } catch (err) {
        console.error('Connection error:', err);
        notify(err.message || 'Connection failed', 'error');
    }
}

async function checkExistingConnection() {
    if (typeof window.ethereum !== 'undefined') {
        try {
            var accounts = await window.ethereum.request({ method: 'eth_accounts' });
            if (accounts.length > 0) {
                await connectWallet();
            }
        } catch (e) {
            console.log('No existing connection');
        }
    }
}

async function updateBalance() {
    if (!provider || !userAddress) return;

    try {
        var balance = await provider.getBalance(userAddress);
        var formatted = parseFloat(ethers.formatEther(balance)).toFixed(2);
        var balanceValue = document.getElementById('balanceValue');
        if (balanceValue) {
            balanceValue.textContent = formatted;
        }
        var balanceDisplay = document.getElementById('balanceDisplay');
        if (balanceDisplay) {
            balanceDisplay.classList.remove('hidden');
        }
    } catch (err) {
        console.error('Balance error:', err);
    }
}

async function switchNetwork() {
    var chainIdHex = '0x' + CHAIN_ID.toString(16);

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
    contract.on('GameCreated', async function (gameId, player1) {
        await updateStats();
        if (player1.toLowerCase() === userAddress.toLowerCase()) {
            currentGameId = Number(gameId);
            showView('game');
            await refreshGame();
            notify('Game created - waiting for opponent', 'info');
        }
    });

    contract.on('GameStarted', async function (gameId) {
        if (Number(gameId) === currentGameId) {
            await refreshGame();
            notify('Opponent joined!', 'success');
        }
    });

    contract.on('DangerousTilesSet', async function (gameId) {
        if (Number(gameId) === currentGameId) {
            await refreshGame();
            notify('Game started!', 'success');
        }
    });

    contract.on('MoveMade', async function (gameId, player, tile, hitDanger) {
        if (Number(gameId) === currentGameId) {
            revealTile(Number(tile), hitDanger);
            if (!hitDanger) await refreshGame();
        }
    });

    contract.on('GameFinished', async function (gameId, winner, payout) {
        if (Number(gameId) === currentGameId) {
            var won = winner.toLowerCase() === userAddress.toLowerCase();
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
        var payment = await contract.getRequiredPayment(tier);
        notify('Joining ' + BET_AMOUNTS[tier] + ' MON game...', 'info');

        var tx = await contract.joinGame(tier, { value: payment });
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
        var tx = await contract.makeMove(currentGameId, tile);
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

// ============ UI Functions ============
function showView(view) {
    var landingView = document.getElementById('landingView');
    var lobbyView = document.getElementById('lobbyView');
    var gameView = document.getElementById('gameView');
    var howItWorksView = document.getElementById('howItWorksView');

    if (landingView) landingView.classList.add('hidden');
    if (lobbyView) lobbyView.classList.add('hidden');
    if (gameView) gameView.classList.add('hidden');
    if (howItWorksView) howItWorksView.classList.add('hidden');

    if (view === 'landing' && landingView) landingView.classList.remove('hidden');
    if (view === 'lobby' && lobbyView) {
        lobbyView.classList.remove('hidden');
        updateStats();
    }
    if (view === 'game' && gameView) gameView.classList.remove('hidden');
    if (view === 'howItWorks' && howItWorksView) howItWorksView.classList.remove('hidden');
}

async function checkActiveGame() {
    try {
        var gameId = await contract.playerActiveGame(userAddress);
        if (Number(gameId) > 0) {
            var game = await contract.getGame(gameId);
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
        var total = await contract.gameCounter();
        var statGames = document.getElementById('statGames');
        if (statGames) statGames.textContent = Number(total);

        var waiting = 0;
        for (var tier = 0; tier <= 2; tier++) {
            var gameId = await contract.getWaitingGame(tier);
            var hasWaiting = Number(gameId) > 0;

            var statusEl = document.getElementById('stake' + tier + 'Status');
            if (statusEl) {
                if (hasWaiting) {
                    statusEl.classList.add('waiting');
                    var statusText = statusEl.querySelector('.status-text');
                    if (statusText) statusText.textContent = 'Player waiting';
                    waiting++;
                } else {
                    statusEl.classList.remove('waiting');
                    var statusText = statusEl.querySelector('.status-text');
                    if (statusText) statusText.textContent = 'Empty lobby';
                }
            }
        }

        var statWaiting = document.getElementById('statWaiting');
        if (statWaiting) statWaiting.textContent = waiting;
    } catch (err) {
        console.error(err);
    }
}

async function refreshGame() {
    if (!currentGameId) return;

    try {
        var game = await contract.getGame(currentGameId);

        var gameIdEl = document.getElementById('gameId');
        if (gameIdEl) gameIdEl.textContent = '#' + currentGameId;

        var potMon = Number(ethers.formatEther(game.betAmount)) * 2;
        var gamePot = document.getElementById('gamePot');
        if (gamePot) gamePot.textContent = potMon + ' MON';

        var isP1 = game.player1.toLowerCase() === userAddress.toLowerCase();

        var p1Addr = document.getElementById('p1Addr');
        if (p1Addr) p1Addr.textContent = truncate(game.player1);

        var p2Addr = document.getElementById('p2Addr');
        if (p2Addr) p2Addr.textContent = game.player2 !== ethers.ZeroAddress ? truncate(game.player2) : 'Waiting...';

        var p1Card = document.getElementById('p1Card');
        var p2Card = document.getElementById('p2Card');

        if (p1Card) p1Card.classList.toggle('is-you', isP1);
        if (p2Card) p2Card.classList.toggle('is-you', !isP1 && game.player2 !== ethers.ZeroAddress);

        var isMyTurn = game.currentTurn.toLowerCase() === userAddress.toLowerCase();
        var isP1Turn = game.currentTurn.toLowerCase() === game.player1.toLowerCase();

        if (p1Card) p1Card.classList.toggle('active', Number(game.state) === GameState.InProgress && isP1Turn);
        if (p2Card) p2Card.classList.toggle('active', Number(game.state) === GameState.InProgress && !isP1Turn);

        var stateText = {
            0: 'Waiting for opponent',
            1: 'Generating tiles...',
            2: isMyTurn ? 'Your turn' : "Opponent's turn",
            3: 'Game over'
        };

        var gameState = document.getElementById('gameState');
        if (gameState) {
            gameState.textContent = stateText[Number(game.state)];
            gameState.classList.toggle('your-turn', Number(game.state) === GameState.InProgress && isMyTurn);
        }

        var showOverlay = Number(game.state) === GameState.WaitingForPlayer || Number(game.state) === GameState.WaitingForVRF;
        var boardOverlay = document.getElementById('boardOverlay');
        if (boardOverlay) boardOverlay.classList.toggle('visible', showOverlay);

        var overlayText = document.getElementById('overlayText');
        if (overlayText) overlayText.textContent = stateText[Number(game.state)];

        updateBoard(game);

    } catch (err) {
        console.error(err);
    }
}

function updateBoard(game) {
    var isMyTurn = game.currentTurn.toLowerCase() === userAddress.toLowerCase();
    var isActive = Number(game.state) === GameState.InProgress;

    document.querySelectorAll('.tile').forEach(function (tile, i) {
        var revealed = (BigInt(game.revealedTiles) & (1n << BigInt(i))) !== 0n;
        tile.classList.toggle('revealed', revealed);
        tile.classList.toggle('disabled', !isActive || !isMyTurn || revealed);
    });
}

function revealTile(index, isDanger) {
    var tiles = document.querySelectorAll('.tile');
    if (tiles[index]) {
        tiles[index].classList.add('revealed');
        tiles[index].classList.add(isDanger ? 'danger' : 'safe');
    }
}

function createBoard() {
    var gameBoard = document.getElementById('gameBoard');
    if (!gameBoard) return;

    gameBoard.innerHTML = '';
    for (var i = 0; i < 25; i++) {
        var tile = document.createElement('button');
        tile.className = 'tile disabled';
        tile.setAttribute('data-index', i);
        tile.onclick = (function (index) {
            return function () {
                var t = document.querySelectorAll('.tile')[index];
                if (!t.classList.contains('disabled') && !t.classList.contains('revealed')) {
                    makeMove(index);
                }
            };
        })(i);
        gameBoard.appendChild(tile);
    }
}

function resetBoard() {
    document.querySelectorAll('.tile').forEach(function (tile) {
        tile.className = 'tile disabled';
    });
}

function showResult(won, payout) {
    var resultIcon = document.getElementById('resultIcon');
    if (resultIcon) resultIcon.textContent = won ? '🏆' : '💀';

    var resultTitle = document.getElementById('resultTitle');
    if (resultTitle) {
        resultTitle.textContent = won ? 'Victory!' : 'Defeated';
        resultTitle.className = 'result-title ' + (won ? 'win' : 'lose');
    }

    var resultInfo = document.getElementById('resultInfo');
    if (resultInfo) resultInfo.textContent = won ? 'You won ' + payout + ' MON' : 'Better luck next time';

    var resultOverlay = document.getElementById('resultOverlay');
    if (resultOverlay) resultOverlay.classList.remove('hidden');
}

function closeResult() {
    var resultOverlay = document.getElementById('resultOverlay');
    if (resultOverlay) resultOverlay.classList.add('hidden');
    currentGameId = null;
    showView('lobby');
    resetBoard();
    updateStats();
}

// ============ Helpers ============
function truncate(addr) {
    if (!addr || addr === ethers.ZeroAddress) return '-';
    return addr.slice(0, 6) + '...' + addr.slice(-4);
}

function notify(message, type) {
    type = type || 'info';
    console.log('[' + type + '] ' + message);

    var notifications = document.getElementById('notifications');
    if (notifications) {
        var el = document.createElement('div');
        el.className = 'notification ' + type;
        el.innerHTML = '<span class="notification-text">' + message + '</span>';
        notifications.appendChild(el);
        setTimeout(function () {
            el.remove();
        }, 4000);
    }
}
