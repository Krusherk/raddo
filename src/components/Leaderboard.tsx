import { useState, useEffect } from 'react';
import { getLeaderboard, type LeaderboardEntry } from '../lib/firebase';

interface LeaderboardProps {
    onBack: () => void;
}

export function Leaderboard({ onBack }: LeaderboardProps) {
    const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [sortBy, setSortBy] = useState<'wins' | 'earnings' | 'games'>('wins');

    const fetchLeaderboard = async () => {
        try {
            setError(null);
            const data = await getLeaderboard(20);

            // Sort based on selected filter
            const sorted = [...data].sort((a, b) => {
                if (sortBy === 'earnings') return (b.total_earnings || 0) - (a.total_earnings || 0);
                if (sortBy === 'games') return (b.total_games || 0) - (a.total_games || 0);
                return (b.wins || 0) - (a.wins || 0);
            });

            setLeaderboard(sorted);
        } catch (err) {
            console.error('Error fetching leaderboard:', err);
            setError('Failed to load leaderboard data');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLeaderboard();

        // Refresh every 30 seconds
        const interval = setInterval(fetchLeaderboard, 30000);
        return () => clearInterval(interval);
    }, [sortBy]);

    const truncateAddress = (addr: string) =>
        `${addr.slice(0, 6)}...${addr.slice(-4)}`;

    const formatDate = (timestamp: number) => {
        const date = new Date(timestamp);
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        if (date.toDateString() === today.toDateString()) return 'Today';
        if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    const getRankBadge = (rank: number) => {
        if (rank === 1) return '🥇';
        if (rank === 2) return '🥈';
        if (rank === 3) return '🥉';
        return `#${rank}`;
    };

    const getWinRate = (wins: number, losses: number) => {
        const total = wins + losses;
        if (total === 0) return 0;
        return Math.round((wins / total) * 100);
    };

    if (loading) {
        return (
            <section className="view leaderboard">
                <button className="btn-back" onClick={onBack}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M19 12H5M12 19l-7-7 7-7" />
                    </svg>
                    Back
                </button>
                <div className="leaderboard-loading">
                    <div className="spinner"></div>
                    <p>Loading leaderboard...</p>
                </div>
            </section>
        );
    }

    if (error) {
        return (
            <section className="view leaderboard">
                <button className="btn-back" onClick={onBack}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M19 12H5M12 19l-7-7 7-7" />
                    </svg>
                    Back
                </button>
                <div className="leaderboard-error">
                    <p>{error}</p>
                    <button className="btn-retry" onClick={fetchLeaderboard}>Retry</button>
                </div>
            </section>
        );
    }

    return (
        <section className="view leaderboard">
            <div className="leaderboard-header">
                <button className="btn-back" onClick={onBack}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M19 12H5M12 19l-7-7 7-7" />
                    </svg>
                    Back
                </button>

                <div className="leaderboard-title-section">
                    <h1 className="leaderboard-title">
                        <span className="title-icon">🏆</span>
                        Leaderboard
                    </h1>
                    <p className="leaderboard-subtitle">Top players competing on TAKKOFUN</p>
                </div>

                <div className="leaderboard-filters">
                    <button
                        className={`filter-btn ${sortBy === 'wins' ? 'active' : ''}`}
                        onClick={() => setSortBy('wins')}
                    >
                        Most Wins
                    </button>
                    <button
                        className={`filter-btn ${sortBy === 'earnings' ? 'active' : ''}`}
                        onClick={() => setSortBy('earnings')}
                    >
                        Top Earners
                    </button>
                    <button
                        className={`filter-btn ${sortBy === 'games' ? 'active' : ''}`}
                        onClick={() => setSortBy('games')}
                    >
                        Most Active
                    </button>
                </div>
            </div>

            {leaderboard.length === 0 ? (
                <div className="leaderboard-empty">
                    <p>No players yet. Be the first to play!</p>
                </div>
            ) : (
                <div className="leaderboard-table-container">
                    <table className="leaderboard-table">
                        <thead>
                            <tr>
                                <th className="col-rank">Rank</th>
                                <th className="col-player">Player</th>
                                <th className="col-record">W/L</th>
                                <th className="col-winrate">Win Rate</th>
                                <th className="col-score">Earnings</th>
                                <th className="col-date">Last Active</th>
                            </tr>
                        </thead>
                        <tbody>
                            {leaderboard.map((entry, index) => {
                                const rank = index + 1;
                                const isTopThree = rank <= 3;
                                const winRate = getWinRate(entry.wins || 0, entry.losses || 0);

                                return (
                                    <tr key={entry.player_address} className={`leaderboard-row ${isTopThree ? 'top-three' : ''}`}>
                                        <td className="col-rank">
                                            <span className={`rank-badge ${isTopThree ? 'medal' : ''}`}>
                                                {getRankBadge(rank)}
                                            </span>
                                        </td>
                                        <td className="col-player">
                                            <div className="player-info">
                                                <div className="player-avatar">
                                                    {entry.player_address.slice(2, 4).toUpperCase()}
                                                </div>
                                                <span className="player-address">{truncateAddress(entry.player_address)}</span>
                                            </div>
                                        </td>
                                        <td className="col-record">
                                            <span className="record-wins">{entry.wins || 0}</span>
                                            <span className="record-separator">/</span>
                                            <span className="record-losses">{entry.losses || 0}</span>
                                        </td>
                                        <td className="col-winrate">
                                            <div className="winrate-container">
                                                <span className="winrate-value">{winRate}%</span>
                                                <div className="winrate-bar">
                                                    <div
                                                        className="winrate-fill"
                                                        style={{ width: `${winRate}%` }}
                                                    ></div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="col-score">
                                            <span className="score-value">{(entry.total_earnings || 0).toFixed(1)} MON</span>
                                        </td>
                                        <td className="col-date">
                                            <span className="date-value">{formatDate(entry.updated_at || Date.now())}</span>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            <div className="leaderboard-footer">
                <p className="footer-note">
                    Rankings update in real-time after each game
                </p>
            </div>
        </section>
    );
}
