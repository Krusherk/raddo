interface HowItWorksProps {
    onBack: () => void;
}

export function HowItWorks({ onBack }: HowItWorksProps) {
    return (
        <section className="view how-it-works">
            <button className="btn-back" onClick={onBack}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="19" y1="12" x2="5" y2="12" />
                    <polyline points="12 19 5 12 12 5" />
                </svg>
                Back
            </button>

            <h2 className="section-title">How It Works</h2>
            <p className="section-subtitle">Get started in minutes. No crypto experience needed.</p>

            <div className="steps-grid">
                <div className="step-card">
                    <div className="step-header">
                        <div className="step-number">1</div>
                        <h3>Login with Email</h3>
                    </div>
                    <p>Enter your email to receive a login code. A wallet is automatically created for you.</p>
                </div>

                <div className="step-card">
                    <div className="step-header">
                        <div className="step-number">2</div>
                        <h3>Choose Stakes</h3>
                    </div>
                    <p>Select a tier: 1, 5, or 10 MON. You'll be matched with a player in the same tier.</p>
                </div>

                <div className="step-card">
                    <div className="step-header">
                        <div className="step-number">3</div>
                        <h3>Wait for Match</h3>
                    </div>
                    <p>Either wait for an opponent, or join an existing game. VRF generates 2 hidden danger tiles.</p>
                </div>

                <div className="step-card">
                    <div className="step-header">
                        <div className="step-number">4</div>
                        <h3>Take Turns</h3>
                    </div>
                    <p>Click tiles in turn. Safe tiles are revealed as X or O. Hit a danger tile and you lose!</p>
                </div>

                <div className="step-card">
                    <div className="step-header">
                        <div className="step-number">5</div>
                        <h3>Win the Pot</h3>
                    </div>
                    <p>Last player standing wins 2x the bet amount. Payouts are instant and automatic.</p>
                </div>
            </div>

            <h3 className="info-section-title">Why Danger Tiles?</h3>
            <div className="info-cards">
                <div className="info-card">
                    <span className="info-icon">💰</span>
                    <h4>Fee Structure</h4>
                    <p>Each player pays bet + 1 MON fee. The fee covers VRF randomness and platform costs.</p>
                </div>
                <div className="info-card">
                    <span className="info-icon">🎲</span>
                    <h4>Provably Fair</h4>
                    <p>Danger tiles are set by Pyth Entropy VRF - verifiable on-chain randomness.</p>
                </div>
                <div className="info-card">
                    <span className="info-icon">⚡</span>
                    <h4>Gas Sponsored</h4>
                    <p>All transaction gas fees are paid for you. Just play and win!</p>
                </div>
            </div>
        </section>
    );
}
