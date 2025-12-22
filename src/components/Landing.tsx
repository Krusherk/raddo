import { usePrivy } from '@privy-io/react-auth';

interface LandingProps {
    totalGames: number;
    waitingGames: number;
    onPlay: () => void;
    onLeaderboard: () => void;
    onDemo: () => void;
}

export function Landing({ totalGames, waitingGames, onPlay, onLeaderboard, onDemo }: LandingProps) {
    const { authenticated, login } = usePrivy();

    const handlePlayClick = () => {
        if (!authenticated) {
            login();
        } else {
            onPlay();
        }
    };

    return (
        <section className="view landing">
            <div className="landing-content">
                <div className="landing-badge">LIVE ON MONAD</div>
                <h1 className="landing-title">
                    Step carefully.<br />
                    <span className="title-highlight">Win big.</span>
                </h1>
                <p className="landing-desc">
                    25 tiles. 2 are lethal. Take turns picking tiles with your opponent.
                    Hit a danger tile and lose your bet. Last one standing takes the pot.
                </p>

                <div className="landing-cta">
                    <button className="btn-play" onClick={handlePlayClick}>
                        <span>Play Now</span>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polygon points="5 3 19 12 5 21 5 3" />
                        </svg>
                    </button>
                    <button className="btn-demo" onClick={onDemo}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                            <line x1="8" y1="21" x2="16" y2="21" />
                            <line x1="12" y1="17" x2="12" y2="21" />
                        </svg>
                        Try Demo
                    </button>
                </div>

                <button className="btn-leaderboard-visual" onClick={onLeaderboard}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M8.21 13.89L7 23 12 20l5 3-1.21-9.12" />
                        <circle cx="12" cy="8" r="7" />
                    </svg>
                    Leaderboard
                </button>

                <div className="landing-stats">
                    <div className="stat">
                        <span className="stat-num">{totalGames}</span>
                        <span className="stat-label">Games</span>
                    </div>
                    <div className="stat-divider"></div>
                    <div className="stat">
                        <span className="stat-num">{waitingGames}</span>
                        <span className="stat-label">Waiting</span>
                    </div>
                    <div className="stat-divider"></div>
                    <div className="stat">
                        <span className="stat-num">2x</span>
                        <span className="stat-label">Payout</span>
                    </div>
                </div>
            </div>

            <div className="landing-visual">
                <div className="grid-preview">
                    <div className="preview-tile"></div>
                    <div className="preview-tile"></div>
                    <div className="preview-tile danger"></div>
                    <div className="preview-tile"></div>
                    <div className="preview-tile"></div>
                    <div className="preview-tile"></div>
                    <div className="preview-tile safe"></div>
                    <div className="preview-tile"></div>
                    <div className="preview-tile"></div>
                    <div className="preview-tile"></div>
                    <div className="preview-tile"></div>
                    <div className="preview-tile"></div>
                    <div className="preview-tile safe"></div>
                    <div className="preview-tile"></div>
                    <div className="preview-tile"></div>
                    <div className="preview-tile danger"></div>
                </div>
            </div>
        </section>
    );
}
