import { useState } from 'react';
import { useContract } from '../hooks/useContract';
import { useWallets } from '@privy-io/react-auth';
import { BET_AMOUNTS } from '../config/contract';

interface LobbyProps {
    waitingGames: number[];
    onBack: () => void;
    onGameJoined: (gameId: number, isSinglePlayer: boolean) => void;
}

type GameMode = 'select' | 'single' | 'multi';

export function Lobby({ waitingGames, onBack, onGameJoined }: LobbyProps) {
    const { joinGame, getActiveGame, loading } = useContract();
    const { wallets } = useWallets();
    const [joining, setJoining] = useState<number | null>(null);
    const [gameMode, setGameMode] = useState<GameMode>('select');

    // Trigger the bot API to check for games
    const triggerBot = async () => {
        try {
            const BOT_API_URL = import.meta.env.VITE_BOT_API_URL || 'https://botrad.vercel.app';
            await fetch(`${BOT_API_URL}/api/bot`, { method: 'GET' });
        } catch (err) {
            console.log('Bot trigger failed (non-critical):', err);
        }
    };

    const handleJoinGame = async (tier: number, isSinglePlayer: boolean) => {
        setJoining(tier);
        try {
            await joinGame(tier);

            // Only trigger bot for single player mode
            if (isSinglePlayer) {
                triggerBot();
                // Trigger again after delay to ensure bot sees the game
                setTimeout(() => triggerBot(), 3000);
                setTimeout(() => triggerBot(), 6000);
            }

            // Poll for active game after joining
            if (wallets[0]?.address) {
                await new Promise(resolve => setTimeout(resolve, 2000));
                const gameId = await getActiveGame(wallets[0].address);
                if (gameId > 0) {
                    onGameJoined(gameId, isSinglePlayer);
                }
            }
        } catch (err) {
            console.error('Failed to join game:', err);
        } finally {
            setJoining(null);
        }
    };

    // Mode selection screen
    if (gameMode === 'select') {
        return (
            <section className="view lobby">
                <div className="lobby-header">
                    <h2 className="lobby-title">Choose Game Mode</h2>
                    <p className="lobby-subtitle">Play against AI or other players</p>
                </div>

                <div className="mode-selection">
                    <div className="mode-card disabled" style={{ opacity: 0.5, cursor: 'not-allowed', position: 'relative' }}>
                        <div className="mode-icon">🤖</div>
                        <div className="mode-info">
                            <h3 className="mode-title">Single Player</h3>
                            <p className="mode-desc" style={{ color: '#f59e0b' }}>Coming Soon</p>
                        </div>
                        <div className="mode-arrow" style={{ opacity: 0.3 }}>→</div>
                    </div>

                    <div className="mode-card" onClick={() => setGameMode('multi')}>
                        <div className="mode-icon">👥</div>
                        <div className="mode-info">
                            <h3 className="mode-title">Multiplayer</h3>
                            <p className="mode-desc">Play against other players</p>
                        </div>
                        <div className="mode-arrow">→</div>
                    </div>
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

    // Stakes selection screen (for both modes)
    const isSinglePlayer = gameMode === 'single';

    return (
        <section className="view lobby">
            <div className="lobby-header">
                <h2 className="lobby-title">
                    {isSinglePlayer ? '🤖 Single Player' : '👥 Multiplayer'}
                </h2>
                <p className="lobby-subtitle">
                    {isSinglePlayer
                        ? 'Select stakes to play against the AI bot'
                        : 'Select stakes to play against other players'}
                </p>
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
                        {!isSinglePlayer && (
                            <div className={`stake-status ${waitingGames[tier] > 0 ? 'waiting' : ''}`}>
                                <span className="status-dot"></span>
                                <span className="status-text">
                                    {waitingGames[tier] > 0 ? 'Player waiting' : 'Empty lobby'}
                                </span>
                            </div>
                        )}
                        {isSinglePlayer && (
                            <div className="stake-status ai-ready">
                                <span className="status-dot"></span>
                                <span className="status-text">AI Ready</span>
                            </div>
                        )}
                        <button
                            className="stake-btn"
                            onClick={() => handleJoinGame(tier, isSinglePlayer)}
                            disabled={loading || joining !== null}
                        >
                            {joining === tier
                                ? (isSinglePlayer ? 'Starting...' : 'Joining...')
                                : (isSinglePlayer ? 'Play vs AI' : 'Enter Game')}
                        </button>
                    </div>
                ))}
            </div>

            <button className="btn-back" onClick={() => setGameMode('select')}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="19" y1="12" x2="5" y2="12" />
                    <polyline points="12 19 5 12 12 5" />
                </svg>
                Back
            </button>
        </section>
    );
}
