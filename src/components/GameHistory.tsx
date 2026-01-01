import { useState, useEffect, useCallback } from 'react';
import { formatEther } from 'ethers';
import { useWallets } from '@privy-io/react-auth';
import { useContract } from '../hooks/useContract';
import { EXPLORER_URL, BET_AMOUNTS } from '../config/contract';

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
    const { getContract, getProvider } = useContract();
    const [games, setGames] = useState<HistoryGame[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedGame, setExpandedGame] = useState<number | null>(null);

    const loadHistory = useCallback(async () => {
        const walletAddress = wallets[0]?.address;
        if (!walletAddress) {
            setLoading(false);
            return;
        }

        setLoading(true);
        try {
            const contract = await getContract();
            const provider = await getProvider();
            if (!provider) {
                setLoading(false);
                return;
            }

            const myAddress = walletAddress.toLowerCase();

            // Use events-based approach for faster loading
            const currentBlock = await provider.getBlockNumber();
            // Query last 100000 blocks (or from block 0 if chain is newer)
            const fromBlock = Math.max(0, currentBlock - 100000);

            // Get all GameFinished events in range
            const finishedFilter = contract.filters.GameFinished();
            const finishedEvents = await contract.queryFilter(finishedFilter, fromBlock, currentBlock);

            const historyGames: HistoryGame[] = [];

            // Process events in reverse (newest first), limit to 30 to check
            const recentEvents = finishedEvents.slice(-30).reverse();

            for (const event of recentEvents) {
                if (historyGames.length >= 15) break; // Limit to 15 games

                try {
                    const gameId = Number(event.args?.[0]);
                    const winner = event.args?.[1] as string;
                    const payout = event.args?.[2] as bigint;

                    // Get game data to check if user was a player
                    const gameData = await contract.games(gameId);

                    const isPlayer = gameData.player1.toLowerCase() === myAddress ||
                        gameData.player2.toLowerCase() === myAddress;

                    if (isPlayer) {
                        // Get VRF tx hash
                        let vrfTxHash: string | null = null;
                        try {
                            const vrfFilter = contract.filters.VRFRequested(gameId);
                            const vrfEvents = await contract.queryFilter(vrfFilter, fromBlock, currentBlock);
                            vrfTxHash = vrfEvents.length > 0 ? vrfEvents[0].transactionHash : null;
                        } catch {
                            // Skip VRF lookup if it fails
                        }

                        historyGames.push({
                            gameId,
                            player1: gameData.player1,
                            player2: gameData.player2,
                            winner,
                            payout: formatEther(payout),
                            tier: Number(gameData.tier),
                            dangerTile1: Number(gameData.dangerTile1),
                            dangerTile2: Number(gameData.dangerTile2),
                            vrfSequenceNumber: gameData.vrfSequenceNumber,
                            vrfTxHash
                        });
                    }
                } catch (err) {
                    console.error('Failed to load game:', err);
                }
            }

            setGames(historyGames);
        } catch (err) {
            console.error('Failed to load history:', err);
        } finally {
            setLoading(false);
        }
    }, [getContract, getProvider, wallets[0]?.address]);

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
            ) : games.length === 0 ? (
                <div className="history-empty">
                    <p>No finished games found</p>
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

                                        {game.vrfTxHash && (
                                            <a
                                                href={`${EXPLORER_URL}/tx/${game.vrfTxHash}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="btn-verify"
                                            >
                                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                                                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                                                    <polyline points="15 3 21 3 21 9" />
                                                    <line x1="10" y1="14" x2="21" y2="3" />
                                                </svg>
                                                View VRF Transaction on Explorer
                                            </a>
                                        )}
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
