interface HowItWorksProps {
    onBack: () => void;
}

export function HowItWorks({ onBack }: HowItWorksProps) {
    return (
        <section className="view how-it-works">
            <button className="btn-back" onClick={onBack}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M19 12H5M12 19l-7-7 7-7" />
                </svg>
                Back
            </button>

            <div className="how-header">
                <div className="how-badge">GAME RULES</div>
                <h2 className="how-title">
                    How to Play <span className="title-highlight">TAKKOFUN</span>
                </h2>
                <p className="how-subtitle">
                    A strategic game of risk and reward on the blockchain
                </p>
            </div>

            <div className="steps-timeline">
                <div className="step-item">
                    <div className="step-icon-wrapper">
                        <div className="step-icon">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                                <circle cx="12" cy="7" r="4" />
                            </svg>
                        </div>
                        <div className="step-connector"></div>
                    </div>
                    <div className="step-content">
                        <div className="step-number">Step 1</div>
                        <h3>Connect Your Wallet</h3>
                        <p>Login with email or connect your wallet. New users get an automatic wallet created for them - no crypto experience needed!</p>
                    </div>
                </div>

                <div className="step-item">
                    <div className="step-icon-wrapper">
                        <div className="step-icon">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="12" cy="12" r="10" />
                                <path d="M12 6v6l4 2" />
                            </svg>
                        </div>
                        <div className="step-connector"></div>
                    </div>
                    <div className="step-content">
                        <div className="step-number">Step 2</div>
                        <h3>Choose Your Stakes</h3>
                        <p>Select a betting tier: 1 MON, 5 MON, or 10 MON. Higher stakes mean bigger rewards. You'll be matched with a player in the same tier.</p>
                    </div>
                </div>

                <div className="step-item">
                    <div className="step-icon-wrapper">
                        <div className="step-icon">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                                <circle cx="9" cy="7" r="4" />
                                <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
                            </svg>
                        </div>
                        <div className="step-connector"></div>
                    </div>
                    <div className="step-content">
                        <div className="step-number">Step 3</div>
                        <h3>Wait for Match</h3>
                        <p>Either create a new game or join an existing one. Once matched, VRF generates 2 hidden danger tiles that are provably random.</p>
                    </div>
                </div>

                <div className="step-item">
                    <div className="step-icon-wrapper">
                        <div className="step-icon">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <rect x="3" y="3" width="7" height="7" />
                                <rect x="14" y="3" width="7" height="7" />
                                <rect x="14" y="14" width="7" height="7" />
                                <rect x="3" y="14" width="7" height="7" />
                            </svg>
                        </div>
                        <div className="step-connector"></div>
                    </div>
                    <div className="step-content">
                        <div className="step-number">Step 4</div>
                        <h3>Take Turns Revealing Tiles</h3>
                        <p>Click tiles in turn. Safe tiles are revealed as X or O. Hit a danger tile and you lose instantly! Strategy and luck combine.</p>
                    </div>
                </div>

                <div className="step-item">
                    <div className="step-icon-wrapper">
                        <div className="step-icon winner">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M6 9H4.5a2.5 2.5 0 010-5H6" />
                                <path d="M18 9h1.5a2.5 2.5 0 000-5H18" />
                                <path d="M4 22h16" />
                                <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
                                <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
                                <path d="M18 2H6v7a6 6 0 0012 0V2z" />
                            </svg>
                        </div>
                    </div>
                    <div className="step-content">
                        <div className="step-number">Step 5</div>
                        <h3>Win the Pot!</h3>
                        <p>Last player standing wins 2x their bet amount. Payouts are instant and automatic - no waiting, no hassle!</p>
                    </div>
                </div>
            </div>

            <div className="info-section">
                <h3 className="info-section-title">Why Play TAKKOFUN?</h3>
                <div className="info-cards">
                    <div className="info-card">
                        <div className="info-icon">💰</div>
                        <h4>Transparent Fees</h4>
                        <p>Each player pays their bet + 1 MON fee. The fee covers VRF randomness and platform costs. No hidden charges.</p>
                    </div>
                    <div className="info-card">
                        <div className="info-icon">🎲</div>
                        <h4>Provably Fair</h4>
                        <p>Danger tiles are set by Pyth Entropy VRF - verifiable on-chain randomness. Every game is fair and transparent.</p>
                    </div>
                    <div className="info-card">
                        <div className="info-icon">⚡</div>
                        <h4>Gas Sponsored</h4>
                        <p>All transaction gas fees are paid for you. Just play and win! No need to worry about network costs.</p>
                    </div>
                </div>
            </div>
        </section>
    );
}
