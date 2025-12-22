import { useState } from 'react';
import { useWallets } from '@privy-io/react-auth';

interface DepositModalProps {
    balance: string;
    onClose: () => void;
    onRefresh: () => void;
}

export function DepositModal({ balance, onClose, onRefresh }: DepositModalProps) {
    const { wallets } = useWallets();
    const [copied, setCopied] = useState(false);

    const walletAddress = wallets[0]?.address || '';

    const handleCopy = () => {
        if (walletAddress) {
            navigator.clipboard.writeText(walletAddress);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    return (
        <div className="deposit-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
            <div className="deposit-card">
                <button className="deposit-close" onClick={onClose}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                </button>

                <div className="deposit-icon">💰</div>
                <h2 className="deposit-title">Fund Your Wallet</h2>
                <p className="deposit-subtitle">
                    Send MON to your game wallet to start playing
                </p>

                <div className="deposit-balance">
                    <span className="balance-label">Current Balance</span>
                    <span className="balance-amount">{balance} MON</span>
                </div>

                <div className="deposit-address-section">
                    <label className="address-label">Your Game Wallet Address</label>
                    <div className="address-box">
                        <span className="address-text">{walletAddress}</span>
                        <button className="copy-btn" onClick={handleCopy}>
                            {copied ? (
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <polyline points="20 6 9 17 4 12" />
                                </svg>
                            ) : (
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                                    <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                                </svg>
                            )}
                        </button>
                    </div>
                </div>

                <div className="deposit-notice">
                    <div className="notice-icon">ℹ️</div>
                    <div className="notice-content">
                        <strong>Entry Fee Required</strong>
                        <p>Each game costs your bet amount + 1 MON fee.</p>
                        <ul>
                            <li>Tier 1: 2 MON total (1 bet + 1 fee)</li>
                            <li>Tier 2: 6 MON total (5 bet + 1 fee)</li>
                            <li>Tier 3: 11 MON total (10 bet + 1 fee)</li>
                        </ul>
                    </div>
                </div>

                <div className="deposit-actions">
                    <button className="deposit-btn secondary" onClick={onRefresh}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                            <path d="M23 4v6h-6M1 20v-6h6" />
                            <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
                        </svg>
                        Refresh Balance
                    </button>
                    <button className="deposit-btn primary" onClick={onClose}>
                        Got it, let's play!
                    </button>
                </div>

                <p className="deposit-tip">
                    💡 Tip: Get test MON from the{' '}
                    <a href="https://faucet.monad.xyz" target="_blank" rel="noopener noreferrer">
                        Monad Faucet
                    </a>
                </p>
            </div>
        </div>
    );
}
