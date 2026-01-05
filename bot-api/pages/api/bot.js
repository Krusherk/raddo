import { ethers } from 'ethers';

// Contract configuration
const CONTRACT_ADDRESS = '0xE6D70350224FA26aC9d0F88D0110F44e0F8f36C4';
const RPC_URL = 'https://testnet-rpc.monad.xyz';

const CONTRACT_ABI = [
    "function joinGame(uint8 tier) external payable",
    "function makeMove(uint256 gameId, uint8 tile) external",
    "function getGame(uint256 gameId) external view returns (address player1, address player2, uint8 tier, uint256 betAmount, uint8 state, address currentTurn, address winner, uint256 revealedTiles)",
    "function getWaitingGame(uint8 tier) external view returns (uint256)",
    "function getRequiredPayment(uint8 tier) external pure returns (uint256)",
    "function playerActiveGame(address player) external view returns (uint256)"
];

const GameState = {
    WaitingForPlayer: 0,
    WaitingForVRF: 1,
    InProgress: 2,
    Finished: 3
};

// Bot configuration
const ENABLED_TIERS = [0, 1, 2]; // All tiers
const MAX_CONCURRENT_GAMES = 3;
const MOVE_DELAY = 1000; // 1 second

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function getRandomUnrevealedTile(revealedTiles) {
    const available = [];
    for (let i = 0; i < 25; i++) {
        const isRevealed = (revealedTiles & (1n << BigInt(i))) !== 0n;
        if (!isRevealed) {
            available.push(i);
        }
    }
    if (available.length === 0) return null;
    return available[Math.floor(Math.random() * available.length)];
}

export default async function handler(req, res) {
    console.log('🤖 Bot cycle starting...');

    // Verify this is a cron request (optional security)
    const authHeader = req.headers.authorization;
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && process.env.CRON_SECRET) {
        // Allow if CRON_SECRET is not set (for testing)
        if (process.env.CRON_SECRET) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
    }

    try {
        const provider = new ethers.JsonRpcProvider(RPC_URL);
        const wallet = new ethers.Wallet(process.env.BOT_PRIVATE_KEY, provider);
        const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, wallet);

        console.log(`📍 Bot Address: ${wallet.address}`);

        // Get balance
        const balance = await provider.getBalance(wallet.address);
        const balanceEth = ethers.formatEther(balance);
        console.log(`💵 Bot Balance: ${balanceEth} MON`);

        if (parseFloat(balanceEth) < 2) {
            return res.status(500).json({
                error: 'Insufficient funds',
                balance: balanceEth
            });
        }

        const results = {
            gamesJoined: [],
            movesMade: [],
            gamesFinished: [],
            errors: []
        };

        // Check for existing active game
        const activeGameId = await contract.playerActiveGame(wallet.address);
        const activeGames = new Map();

        if (activeGameId > 0n) {
            console.log(`📌 Found active game #${activeGameId}`);
            activeGames.set(Number(activeGameId), { tier: -1 });
        }

        // Check for waiting games and join
        for (const tier of ENABLED_TIERS) {
            if (activeGames.size >= MAX_CONCURRENT_GAMES) break;

            try {
                const waitingGameId = await contract.getWaitingGame(tier);

                if (waitingGameId > 0n && !activeGames.has(Number(waitingGameId))) {
                    const game = await contract.getGame(waitingGameId);

                    // Don't join our own games
                    if (game.player1.toLowerCase() === wallet.address.toLowerCase()) continue;

                    console.log(`🎮 Found waiting game #${waitingGameId} (Tier ${tier + 1})`);

                    const payment = await contract.getRequiredPayment(tier);
                    const tx = await contract.joinGame(tier, { value: payment });
                    await tx.wait();

                    console.log(`✅ Joined game #${waitingGameId}`);
                    results.gamesJoined.push(Number(waitingGameId));
                    activeGames.set(Number(waitingGameId), { tier });
                }
            } catch (err) {
                console.error(`Error checking tier ${tier}:`, err.message);
                results.errors.push(`Tier ${tier}: ${err.message}`);
            }
        }

        // Small delay if we joined games
        if (results.gamesJoined.length > 0) {
            await sleep(2000);
        }

        // Play active games
        for (const [gameId] of activeGames) {
            try {
                const game = await contract.getGame(gameId);

                // Game finished
                if (Number(game.state) === GameState.Finished) {
                    const won = game.winner.toLowerCase() === wallet.address.toLowerCase();
                    console.log(`🏁 Game #${gameId} finished - ${won ? 'WON!' : 'Lost'}`);
                    results.gamesFinished.push({ gameId, won });
                    continue;
                }

                // Not our turn or not in progress
                if (Number(game.state) !== GameState.InProgress) continue;
                if (game.currentTurn.toLowerCase() !== wallet.address.toLowerCase()) continue;

                // Make a move
                console.log(`🎯 Game #${gameId} - Making move...`);
                await sleep(MOVE_DELAY);

                const tile = getRandomUnrevealedTile(game.revealedTiles);
                if (tile === null) continue;

                const tx = await contract.makeMove(gameId, tile);
                await tx.wait();

                console.log(`✅ Played tile ${tile} in game #${gameId}`);
                results.movesMade.push({ gameId, tile });
            } catch (err) {
                console.error(`Error playing game ${gameId}:`, err.message);
                results.errors.push(`Game ${gameId}: ${err.message}`);
            }
        }

        console.log('✅ Bot cycle complete!');
        return res.status(200).json({
            success: true,
            botAddress: wallet.address,
            balance: balanceEth,
            ...results
        });

    } catch (err) {
        console.error('Bot error:', err);
        return res.status(500).json({ error: err.message });
    }
}
