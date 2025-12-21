import React, { useState } from 'react';
import { useSendTransaction, useWallets } from '@privy-io/react-auth';
import { parseEther } from 'ethers';

interface WithdrawModalProps {
    balance: string;
    onClose: () => void;
    onSuccess: () => void;
}

export function WithdrawModal({ balance, onClose, onSuccess }: WithdrawModalProps) {
    const { wallets } = useWallets();
    const { sendTransaction } = useSendTransaction();
    const [toAddress, setToAddress] = useState('');
    const [amount, setAmount] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    const [txHash, setTxHash] = useState('');

    const isValidAddress = (addr: string) => /^0x[a-fA-F0-9]{40}$/.test(addr);

    const handleWithdraw = async () => {
        if (!toAddress || !amount) {
            setError('Please fill in all fields');
            return;
        }

        if (!isValidAddress(toAddress)) {
            setError('Invalid address format');
            return;
        }

        const amountNum = parseFloat(amount);
        const balanceNum = parseFloat(balance);

        if (isNaN(amountNum) || amountNum <= 0) {
            setError('Invalid amount');
            return;
        }

        if (amountNum > balanceNum - 0.01) {
            setError('Insufficient balance (keep some for gas)');
            return;
        }

        setLoading(true);
        setError('');

        try {
            // Use Privy's sendTransaction hook - the proper way for embedded wallets
            const valueWei = parseEther(amount);

            const receipt = await sendTransaction(
                {
                    to: toAddress as `0x${string}`,
                    value: valueWei,
                    chainId: 10143 // Monad Testnet
                },
                {
                    address: wallets[0]?.address as `0x${string}`
                }
            );

            if (receipt?.hash) {
                setTxHash(receipt.hash);
                setSuccess(true);
                onSuccess();
            } else {
                setError('Transaction failed - no receipt');
            }
        } catch (err: any) {
            console.error('Withdraw failed:', err);
            if (err.message?.includes('User rejected') || err.message?.includes('denied')) {
                setError('Transaction cancelled');
            } else {
                setError(err.shortMessage || err.message || 'Transaction failed');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleMaxAmount = () => {
        const max = Math.max(0, parseFloat(balance) - 0.01).toFixed(4);
        setAmount(max);
    };

    // Close overlay when clicking backdrop
    const handleBackdropClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    };

    if (success) {
        return (
            <div className="withdraw-overlay" onClick={handleBackdropClick}>
                <div className="withdraw-card">
                    <div className="withdraw-success">
                        <div className="success-icon">✓</div>
                        <h3>Withdrawal Sent!</h3>
                        <p>Your MON is on its way</p>
                        <a
                            href={`https://testnet.monadexplorer.com/tx/${txHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="tx-link"
                        >
                            View Transaction →
                        </a>
                        <button className="withdraw-btn" onClick={onClose}>
                            Done
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="withdraw-overlay" onClick={handleBackdropClick}>
            <div className="withdraw-card">
                <button className="withdraw-close" onClick={onClose}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                </button>

                <h2 className="withdraw-title">Withdraw MON</h2>
                <p className="withdraw-subtitle">
                    Send MON to any address
                </p>

                <div className="withdraw-balance">
                    <span className="balance-label">Available</span>
                    <span className="balance-amount">{balance} MON</span>
                </div>

                <div className="withdraw-form">
                    <div className="form-group">
                        <label>Recipient Address</label>
                        <input
                            type="text"
                            placeholder="0x..."
                            value={toAddress}
                            onChange={(e) => setToAddress(e.target.value)}
                            className="withdraw-input"
                            disabled={loading}
                        />
                    </div>

                    <div className="form-group">
                        <label>
                            Amount
                            <button
                                type="button"
                                className="max-btn"
                                onClick={handleMaxAmount}
                                disabled={loading}
                            >
                                MAX
                            </button>
                        </label>
                        <div className="amount-input-wrapper">
                            <input
                                type="number"
                                placeholder="0.00"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                className="withdraw-input"
                                step="0.01"
                                min="0"
                                disabled={loading}
                            />
                            <span className="amount-suffix">MON</span>
                        </div>
                    </div>

                    {error && <div className="withdraw-error">{error}</div>}

                    <button
                        type="button"
                        className="withdraw-btn"
                        onClick={handleWithdraw}
                        disabled={loading || !toAddress || !amount}
                    >
                        {loading ? 'Sending...' : 'Withdraw'}
                    </button>
                </div>
            </div>
        </div>
    );
}
