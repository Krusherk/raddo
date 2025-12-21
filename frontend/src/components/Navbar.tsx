import { usePrivy, useWallets } from '@privy-io/react-auth';
import { useEffect, useState } from 'react';
import { useContract } from '../hooks/useContract';

interface NavbarProps {
    onHowItWorks: () => void;
}

export function Navbar({ onHowItWorks }: NavbarProps) {
    const { ready, authenticated, login, logout, user } = usePrivy();
    const { wallets } = useWallets();
    const { getBalance } = useContract();
    const [balance, setBalance] = useState('0.00');
    const [dropdownOpen, setDropdownOpen] = useState(false);

    useEffect(() => {
        if (authenticated && wallets.length > 0) {
            getBalance().then(setBalance);
            const interval = setInterval(() => getBalance().then(setBalance), 10000);
            return () => clearInterval(interval);
        }
    }, [authenticated, wallets, getBalance]);

    const truncateAddress = (addr: string) =>
        addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : '';

    const handleCopyAddress = () => {
        if (wallets[0]?.address) {
            navigator.clipboard.writeText(wallets[0].address);
            setDropdownOpen(false);
        }
    };

    return (
        <nav className="nav">
            <div className="nav-brand">
                <div className="brand-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2" />
                        <line x1="12" y1="22" x2="12" y2="15.5" />
                        <polyline points="22 8.5 12 15.5 2 8.5" />
                    </svg>
                </div>
                <span className="brand-text">TAKKO<span className="brand-accent">FUN</span></span>
            </div>

            <div className="nav-center">
                <button className="nav-link" onClick={onHowItWorks}>How it Works</button>
                <a href="https://x.com/takkofun" target="_blank" rel="noopener" className="nav-link nav-twitter">
                    <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                    </svg>
                    <span>@takkofun</span>
                </a>
            </div>

            <div className="nav-right">
                {authenticated && (
                    <div className="balance-display">
                        <span className="balance-value">{balance}</span>
                        <span className="balance-currency">MON</span>
                    </div>
                )}

                <div className="wallet-wrapper">
                    {!ready ? (
                        <button className="connect-btn" disabled>Loading...</button>
                    ) : authenticated ? (
                        <>
                            <button
                                className="connect-btn connected"
                                onClick={() => setDropdownOpen(!dropdownOpen)}
                            >
                                <span className="connect-text">
                                    {user?.email?.address?.slice(0, 8) || truncateAddress(wallets[0]?.address)}
                                </span>
                            </button>
                            {dropdownOpen && (
                                <div className="wallet-dropdown">
                                    <button className="dropdown-item" onClick={handleCopyAddress}>
                                        Copy Address
                                    </button>
                                    <button className="dropdown-item" onClick={() => { logout(); setDropdownOpen(false); }}>
                                        Disconnect
                                    </button>
                                </div>
                            )}
                        </>
                    ) : (
                        <button className="connect-btn" onClick={login}>
                            <span className="connect-text">Login</span>
                        </button>
                    )}
                </div>
            </div>
        </nav>
    );
}
