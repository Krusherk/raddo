import { useState, useEffect } from 'react';

interface GameProps {
    onBack: () => void;
}

export function Game({ onBack }: GameProps) {
    const [revealedTiles, setRevealedTiles] = useState<Set<number>>(new Set());
    const [dangerTiles, setDangerTiles] = useState<Set<number>>(new Set());

    // Initialize danger tiles on mount
    useEffect(() => {
        const tiles = new Set<number>();
        while (tiles.size < 4) {
            tiles.add(Math.floor(Math.random() * 16));
        }
        setDangerTiles(tiles);
    }, []);

    const handleTileClick = (index: number) => {
        if (!revealedTiles.has(index)) {
            setRevealedTiles(prev => new Set([...prev, index]));
        }
    };

    const handleReset = () => {
        setRevealedTiles(new Set());
        const tiles = new Set<number>();
        while (tiles.size < 4) {
            tiles.add(Math.floor(Math.random() * 16));
        }
        setDangerTiles(tiles);
    };

    const getTileClass = (index: number) => {
        if (!revealedTiles.has(index)) return 'preview-tile';
        if (dangerTiles.has(index)) return 'preview-tile danger revealed';
        return 'preview-tile safe revealed';
    };

    return (
        <section className="view game-demo">
            {/* <button className="btn-back" onClick={onBack}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M19 12H5M12 19l-7-7 7-7" />
                </svg>
                Back
            </button> */}

            <div className="game-container">
                <div className="game-header">
                  
                </div>

                <div className="game-grid-wrapper">
                    <div className="game-grid">
                        {Array.from({ length: 16 }, (_, i) => (
                            <button
                                key={i}
                                className={getTileClass(i)}
                                onClick={() => handleTileClick(i)}
                                disabled={revealedTiles.has(i)}
                            >
                                {revealedTiles.has(i) && (
                                    <span className="tile-icon">
                                        {dangerTiles.has(i) ? '💀' : '✓'}
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="game-stats">
                    <div className="game-stat">
                        <span className="game-stat-value">{revealedTiles.size}</span>
                        <span className="game-stat-label">Revealed</span>
                    </div>
                    <div className="game-stat">
                        <span className="game-stat-value">
                            {Array.from(revealedTiles).filter(i => dangerTiles.has(i)).length}
                        </span>
                        <span className="game-stat-label">Danger Hit</span>
                    </div>
                    <div className="game-stat">
                        <span className="game-stat-value">
                            {Array.from(revealedTiles).filter(i => !dangerTiles.has(i)).length}
                        </span>
                        <span className="game-stat-label">Safe</span>
                    </div>
                </div>

                <button className="btn-reset" onClick={handleReset}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
                        <path d="M21 3v5h-5" />
                        <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
                        <path d="M3 21v-5h5" />
                    </svg>
                    Reset Game
                </button>
            </div>
        </section>
    );
}
