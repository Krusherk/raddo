interface ResultModalProps {
    won: boolean;
    payout: string;
    onClose: () => void;
}

export function ResultModal({ won, payout, onClose }: ResultModalProps) {
    return (
        <div className="result-overlay">
            <div className="result-card">
                <div className="result-icon">{won ? '🏆' : '💀'}</div>
                <h2 className={`result-title ${won ? 'win' : 'lose'}`}>
                    {won ? 'Victory!' : 'Defeated'}
                </h2>
                <p className="result-info">
                    {won ? `You won ${payout} MON` : 'Better luck next time'}
                </p>
                <button className="result-btn" onClick={onClose}>
                    Continue
                </button>
            </div>
        </div>
    );
}
