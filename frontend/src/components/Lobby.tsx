import { useState } from 'react';
import { useContract } from '../hooks/useContract';
import { useWallets } from '@privy-io/react-auth';
import { BET_AMOUNTS } from '../config/contract';

interface LobbyProps {
    waitingGames: number[];
    onBack: () => void;
    onGameJoined: (gameId: number) => void;
}

export function Lobby({ waitingGames, onBack, onGameJoined }: LobbyProps) {
    const { joinGame, getActiveGame, loading } = useContract();
    const { wallets } = useWallets();
    const [joining, setJoining] = useState<number | null>(null);

    const handleJoinGame = async (tier: number) => {
        setJoining(tier);
        try {
            await joinGame(tier);
            // Poll for active game after joining
            if (wallets[0]?.address) {
                // Small delay to let blockchain update
                await new Promise(resolve => setTimeout(resolve, 2000));
                const gameId = await getActiveGame(wallets[0].address);
                if (gameId > 0) {
                    onGameJoined(gameId);
                }
            }
        } catch (err) {
            console.error('Failed to join game:', err);
        } finally {
            setJoining(null);
        }
    };

    return (
        <section className="view lobby">
            <div className="lobby-header">
                <h2 className="lobby-title">Select Stakes</h2>
                <p className="lobby-subtitle">Players are matched within the same tier</p>
            </div>

            <div className="stakes-grid">
                {[0, 1, 2].map(tier => (
                    <div
                        key={tier}
                        className={`stake-card ${tier === 1 ? 'featured' : ''}`}
                    >
                        {tier === 1 && <div className="stake-badge">POPULAR</div>}
                        <div className="stake-tier">TIER {tier + 1}</div>
                        <div className="stake-amount">
                            <span className="amount-value">{BET_AMOUNTS[tier]}</span>
                            <span className="amount-currency">MON</span>
                        </div>
                        <div className="stake-details">
                            <div className="detail-row">
                                <span>Entry fee</span>
                                <span>+1 MON</span>
                            </div>
                            <div className="detail-row total">
                                <span>Total</span>
                                <span>{BET_AMOUNTS[tier] + 1} MON</span>
                            </div>
                        </div>
                        <div className={`stake-status ${waitingGames[tier] > 0 ? 'waiting' : ''}`}>
                            <span className="status-dot"></span>
                            <span className="status-text">
                                {waitingGames[tier] > 0 ? 'Player waiting' : 'Empty lobby'}
                            </span>
                        </div>
                        <button
                            className="stake-btn"
                            onClick={() => handleJoinGame(tier)}
                            disabled={loading || joining !== null}
                        >
                            {joining === tier ? 'Joining...' : 'Enter Game'}
                        </button>
                    </div>
                ))}
            </div>

            <button className="btn-back" onClick={onBack}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="19" y1="12" x2="5" y2="12" />
                    <polyline points="12 19 5 12 12 5" />
                </svg>
                Back
            </button>
        </section>
    );
}
