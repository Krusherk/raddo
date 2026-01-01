import { useState, useEffect, useCallback } from 'react';
import { formatEther, JsonRpcProvider, Contract } from 'ethers';
import { useWallets } from '@privy-io/react-auth';
import { EXPLORER_URL, BET_AMOUNTS, CONTRACT_ADDRESS, CONTRACT_ABI, RPC_URL } from '../config/contract';

interface HistoryGame {
    gameId: number;
    player1: string;
    player2: string;
    winner: string;
    payout: string;
    tier: number;
    dangerTile1: number;
    dangerTile2: number;
    vrfSequenceNumber: bigint;
    vrfTxHash: string | null;
}

interface GameHistoryProps {
    onBack: () => void;
}

export function GameHistory({ onBack }: GameHistoryProps) {
    const { wallets } = useWallets();
    const [games, setGames] = useState<HistoryGame[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [expandedGame, setExpandedGame] = useState<number | null>(null);

    const loadHistory = useCallback(async () => {
        const walletAddress = wallets[0]?.address;
        if (!walletAddress) {
            console.log('GameHistory: No wallet connected');
            setLoading(false);
            setError('Please connect your wallet to view game history');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            console.log('GameHistory: Loading for wallet:', walletAddress);

            // Use a read-only provider to avoid chain switching issues
            const provider = new JsonRpcProvider(RPC_URL);
            const contract = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);

            const myAddress = walletAddress.toLowerCase();

            // Get total game count first
            let gameCount;
            try {
                gameCount = await contract.gameCounter();
            } catch (err) {
                console.error('GameHistory: Error getting game count:', err);
                setError('Unable to connect to blockchain. Please try again.');
                setLoading(false);
                return;
            }

            console.log('GameHistory: Total games on contract:', Number(gameCount));

            if (Number(gameCount) === 0) {
                setGames([]);
                setLoading(false);
                return;
            }

            const historyGames: HistoryGame[] = [];

            // Iterate through recent games to find user's finished games
            const startGame = Math.max(1, Number(gameCount) - 50);
            console.log('GameHistory: Checking games from', startGame, 'to', Number(gameCount));

            for (let gameId = Number(gameCount); gameId >= startGame && historyGames.length < 15; gameId--) {
                try {
                    const gameData = await contract.games(gameId);

                    const isPlayer = gameData.player1.toLowerCase() === myAddress ||
                        gameData.player2.toLowerCase() === myAddress;
                    const isFinished = Number(gameData.state) === 3; // GameState.Finished = 3

                    if (isPlayer && isFinished) {
                        console.log('GameHistory: Found your game #', gameId);

                        // Calculate payout (winner gets 2x bet)
                        const payout = gameData.winner.toLowerCase() !== '0x0000000000000000000000000000000000000000'
                            ? formatEther(gameData.betAmount * 2n)
                            : '0';

                        historyGames.push({
                            gameId,
                            player1: gameData.player1,
                            player2: gameData.player2,
                            winner: gameData.winner,
                            payout,
                            tier: Number(gameData.tier),
                            dangerTile1: Number(gameData.dangerTile1),
                            dangerTile2: Number(gameData.dangerTile2),
                            vrfSequenceNumber: gameData.vrfSequenceNumber,
                            vrfTxHash: null // Skip VRF lookup for now to speed up loading
                        });
                    }
                } catch (err: unknown) {
                    // Only log errors that aren't eth_getLogs related (those are from Privy/viem internals)
                    const errorMessage = err instanceof Error ? err.message : String(err);
                    if (!errorMessage.includes('eth_getLogs') && !errorMessage.includes('413')) {
                        console.error('GameHistory: Error loading game', gameId, err);
                    }
                }
            }

            console.log('GameHistory: Found', historyGames.length, 'games for user');
            setGames(historyGames);
        } catch (err: unknown) {
            // Check if this is a non-critical error (eth_getLogs limit from Privy/viem)
            const errorMessage = err instanceof Error ? err.message : String(err);
            if (errorMessage.includes('eth_getLogs') || errorMessage.includes('413') || errorMessage.includes('limited to a 100 range')) {
                console.warn('GameHistory: Non-critical eth_getLogs error from provider (can be ignored):', errorMessage);
                // Don't show error to user as this is a background issue
            } else {
                console.error('GameHistory: Failed to load history:', err);
                setError('Failed to load game history. Please try again.');
            }
        } finally {
            setLoading(false);
        }
    }, [wallets[0]?.address]);

    useEffect(() => {
        loadHistory();
    }, [loadHistory]);

    const shortenAddress = (addr: string) =>
        `${addr.slice(0, 6)}...${addr.slice(-4)}`;

    const getTierLabel = (tier: number) => `${BET_AMOUNTS[tier]} MON`;

    const getTileCoords = (tile: number) => {
        const row = Math.floor(tile / 5) + 1;
        const col = (tile % 5) + 1;
        return `Row ${row}, Col ${col}`;
    };

    return (
        <section className="view game-history">
            <button className="btn-back" onClick={onBack}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="19" y1="12" x2="5" y2="12" />
                    <polyline points="12 19 5 12 12 5" />
                </svg>
                Back
            </button>

            <h2 className="section-title">Game History</h2>
            <p className="section-subtitle">Verify the randomness behind each game outcome</p>

            {loading ? (
                <div className="history-loading">
                    <div className="spinner"></div>
                    <p>Loading game history...</p>
                </div>
            ) : error ? (
                <div className="history-empty">
                    <p>{error}</p>
                    <button className="btn-verify" onClick={loadHistory} style={{ marginTop: '1rem' }}>
                        Try Again
                    </button>
                </div>
            ) : games.length === 0 ? (
                <div className="history-empty">
                    <p>No finished games found for your wallet</p>
                    <p style={{ fontSize: '0.8rem', marginTop: '0.5rem', opacity: 0.7 }}>
                        Play some games first, then check back here!
                    </p>
                </div>
            ) : (
                <div className="history-list">
                    {games.map((game) => (
                        <div
                            key={game.gameId}
                            className={`history-card ${expandedGame === game.gameId ? 'expanded' : ''}`}
                        >
                            <div
                                className="history-card-header"
                                onClick={() => setExpandedGame(
                                    expandedGame === game.gameId ? null : game.gameId
                                )}
                            >
                                <div className="history-card-main">
                                    <span className="game-id">Game #{game.gameId}</span>
                                    <span className="game-tier">{getTierLabel(game.tier)}</span>
                                </div>
                                <div className="history-card-result">
                                    <span className="payout">+{game.payout} MON</span>
                                    <svg
                                        className="expand-icon"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                    >
                                        <polyline points="6 9 12 15 18 9" />
                                    </svg>
                                </div>
                            </div>

                            {expandedGame === game.gameId && (
                                <div className="history-card-details">
                                    <div className="detail-section">
                                        <h4>Players</h4>
                                        <div className="players-info">
                                            <div className="player-row">
                                                <span className="player-label">Player 1:</span>
                                                <span className="player-address">{shortenAddress(game.player1)}</span>
                                                {game.winner.toLowerCase() === game.player1.toLowerCase() && (
                                                    <span className="winner-badge">Winner</span>
                                                )}
                                            </div>
                                            <div className="player-row">
                                                <span className="player-label">Player 2:</span>
                                                <span className="player-address">{shortenAddress(game.player2)}</span>
                                                {game.winner.toLowerCase() === game.player2.toLowerCase() && (
                                                    <span className="winner-badge">Winner</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="detail-section verification-section">
                                        <h4>
                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                                                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                                            </svg>
                                            VRF Verification
                                        </h4>

                                        {/* Mini Danger Tile Grid */}
                                        <div className="danger-tiles-preview">
                                            <p className="preview-label">Danger Tiles Location:</p>
                                            <div className="mini-grid">
                                                {Array.from({ length: 25 }, (_, i) => (
                                                    <div
                                                        key={i}
                                                        className={`mini-tile ${i === game.dangerTile1 || i === game.dangerTile2
                                                            ? 'danger'
                                                            : ''
                                                            }`}
                                                        style={{
                                                            animationDelay: i === game.dangerTile1 ? '0s' : '0.3s'
                                                        }}
                                                    />
                                                ))}
                                            </div>
                                            <div className="tile-legend">
                                                <span className="legend-item">
                                                    <span className="legend-dot safe"></span>
                                                    Safe
                                                </span>
                                                <span className="legend-item">
                                                    <span className="legend-dot danger"></span>
                                                    Danger
                                                </span>
                                            </div>
                                        </div>

                                        <div className="verification-info">
                                            <div className="verification-row">
                                                <span className="verification-label">VRF Sequence #:</span>
                                                <code className="verification-value">{game.vrfSequenceNumber.toString()}</code>
                                            </div>
                                            <div className="verification-row">
                                                <span className="verification-label">Danger Tile 1:</span>
                                                <span className="verification-value tile-value">
                                                    Tile {game.dangerTile1} ({getTileCoords(game.dangerTile1)})
                                                </span>
                                            </div>
                                            <div className="verification-row">
                                                <span className="verification-label">Danger Tile 2:</span>
                                                <span className="verification-value tile-value">
                                                    Tile {game.dangerTile2} ({getTileCoords(game.dangerTile2)})
                                                </span>
                                            </div>
                                        </div>

                                        <div className="verification-formula">
                                            <p className="formula-title">How tiles were calculated:</p>
                                            <code className="formula">
                                                tile1 = randomNumber % 25<br />
                                                tile2 = (randomNumber &gt;&gt; 8) % 25
                                            </code>
                                        </div>

                                        <a
                                            href={`${EXPLORER_URL}/address/${CONTRACT_ADDRESS}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="btn-verify"
                                        >
                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                                                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                                                <polyline points="15 3 21 3 21 9" />
                                                <line x1="10" y1="14" x2="21" y2="3" />
                                            </svg>
                                            View on Explorer
                                        </a>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            <div className="history-info">
                <h4>How Verification Works</h4>
                <p>
                    Each game uses <strong>Pyth Entropy VRF</strong> to generate random danger tiles.
                    The VRF sequence number links to an on-chain random number that can be independently verified.
                    Click any game to see the exact calculation used.
                </p>
            </div>
        </section>
    );
}
