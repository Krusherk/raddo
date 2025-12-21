import { useState, useEffect } from 'react';
import { supabase, type LeaderboardEntry } from '../lib/supabase';

interface LeaderboardProps {
    onBack: () => void;
}

export function Leaderboard({ onBack }: LeaderboardProps) {
    const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchLeaderboard = async () => {
        try {
            setError(null);
            const { data, error: fetchError } = await supabase
                .from('leaderboard')
                .select('*')
                .order('total_games', { ascending: false })
                .limit(10);

            if (fetchError) throw fetchError;
            setLeaderboard(data || []);
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
    }, []);

    const truncateAddress = (addr: string) => 
        `${addr.slice(0, 6)}...${addr.slice(-4)}`;

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        if (date.toDateString() === today.toDateString()) return 'Today';
        if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    };

    const getRankBadge = (rank: number) => {
        if (rank === 1) return '🥇';
        if (rank === 2) return '🥈';
        if (rank === 3) return '🥉';
        return `#${rank}`;
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
                                <th className="col-games">Games Played</th>
                                <th className="col-date">Joined</th>
                            </tr>
                        </thead>
                        <tbody>
                            {leaderboard.map((entry, index) => {
                                const rank = index + 1;
                                const isTopThree = rank <= 3;

                                return (
                                    <tr key={entry.id} className={`leaderboard-row ${isTopThree ? 'top-three' : ''}`}>
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
                                        <td className="col-games">
                                            <span className="games-value">{entry.total_games}</span>
                                        </td>
                                        <td className="col-date">
                                            <span className="date-value">{formatDate(entry.created_at)}</span>
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
                    Rankings update in real-time based on total games played
                </p>
            </div>
        </section>
    );
}
