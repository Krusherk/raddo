import 'dotenv/config';
import { ethers } from 'ethers';
import {
    CONTRACT_ADDRESS,
    CONTRACT_ABI,
    RPC_URL,
    GameState,
    BOT_CONFIG
} from './config.js';

// ============ Setup ============
const provider = new ethers.JsonRpcProvider(RPC_URL);
const wallet = new ethers.Wallet(process.env.BOT_PRIVATE_KEY, provider);
const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, wallet);

console.log('🤖 Danger Tiles Bot Starting...');
console.log(`📍 Bot Address: ${wallet.address}`);

// Track active games the bot is playing
const activeGames = new Map();

// ============ Utility Functions ============
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

async function getBalance() {
    const balance = await provider.getBalance(wallet.address);
    return ethers.formatEther(balance);
}

// ============ Game Logic ============
async function checkAndJoinGames() {
    // Don't join more if at max capacity
    if (activeGames.size >= BOT_CONFIG.MAX_CONCURRENT_GAMES) {
        return;
    }

    for (const tier of BOT_CONFIG.ENABLED_TIERS) {
        try {
            const waitingGameId = await contract.getWaitingGame(tier);

            if (waitingGameId > 0n) {
                // Check if we're already in this game
                if (activeGames.has(Number(waitingGameId))) continue;

                // Check if we created this game (don't join our own games)
                const game = await contract.getGame(waitingGameId);
                if (game.player1.toLowerCase() === wallet.address.toLowerCase()) continue;

                console.log(`\n🎮 Found waiting game #${waitingGameId} (Tier ${tier + 1})`);

                // Join the game
                const payment = await contract.getRequiredPayment(tier);
                console.log(`💰 Joining with ${ethers.formatEther(payment)} MON...`);

                const tx = await contract.joinGame(tier, { value: payment });
                await tx.wait();

                console.log(`✅ Joined game #${waitingGameId}!`);

                // Start tracking this game
                activeGames.set(Number(waitingGameId), {
                    tier,
                    joinedAt: Date.now()
                });
            }
        } catch (err) {
            console.error(`❌ Error checking tier ${tier}:`, err.message);
        }
    }
}

async function playActiveGames() {
    for (const [gameId, gameInfo] of activeGames) {
        try {
            const game = await contract.getGame(gameId);

            // Game finished - remove from tracking
            if (Number(game.state) === GameState.Finished) {
                const won = game.winner.toLowerCase() === wallet.address.toLowerCase();
                console.log(`\n🏁 Game #${gameId} finished - ${won ? '🎉 BOT WON!' : '😔 Bot lost'}`);
                activeGames.delete(gameId);
                continue;
            }

            // Not our turn or game not in progress
            if (Number(game.state) !== GameState.InProgress) continue;
            if (game.currentTurn.toLowerCase() !== wallet.address.toLowerCase()) continue;

            // It's our turn - make a move!
            console.log(`\n🎯 Game #${gameId} - Bot's turn`);

            // Add delay to feel more natural
            await sleep(BOT_CONFIG.MOVE_DELAY);

            const tile = getRandomUnrevealedTile(game.revealedTiles);
            if (tile === null) {
                console.log(`⚠️ No available tiles in game #${gameId}`);
                continue;
            }

            console.log(`🔲 Picking tile ${tile}...`);
            const tx = await contract.makeMove(gameId, tile);
            await tx.wait();
            console.log(`✅ Move made!`);

        } catch (err) {
            console.error(`❌ Error playing game #${gameId}:`, err.message);
        }
    }
}

async function checkBotActiveGame() {
    // Check if bot was already in a game when it started
    try {
        const activeGameId = await contract.playerActiveGame(wallet.address);
        if (activeGameId > 0n) {
            console.log(`📌 Resuming active game #${activeGameId}`);
            activeGames.set(Number(activeGameId), {
                tier: -1,
                joinedAt: Date.now()
            });
        }
    } catch (err) {
        console.error('Error checking active game:', err.message);
    }
}

// ============ Main Loop ============
async function main() {
    // Show balance
    const balance = await getBalance();
    console.log(`💵 Bot Balance: ${balance} MON\n`);

    if (parseFloat(balance) < 2) {
        console.error('⚠️ Bot wallet has insufficient funds! Please add MON.');
        console.error('   Minimum recommended: 50 MON');
        process.exit(1);
    }

    // Check for existing active game
    await checkBotActiveGame();

    console.log('🔄 Starting game loop...\n');
    console.log(`   Poll interval: ${BOT_CONFIG.POLL_INTERVAL}ms`);
    console.log(`   Enabled tiers: ${BOT_CONFIG.ENABLED_TIERS.map(t => t + 1).join(', ')}`);
    console.log(`   Max concurrent games: ${BOT_CONFIG.MAX_CONCURRENT_GAMES}`);
    console.log('');

    // Main loop
    while (true) {
        try {
            await checkAndJoinGames();
            await playActiveGames();
        } catch (err) {
            console.error('Loop error:', err.message);
        }

        await sleep(BOT_CONFIG.POLL_INTERVAL);
    }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\n👋 Bot shutting down...');
    process.exit(0);
});

// Start the bot
main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
