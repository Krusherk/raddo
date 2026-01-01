import { useState, useEffect, useCallback, useRef } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { formatEther } from 'ethers';
import { Navbar } from './components/Navbar';
import { Landing } from './components/Landing';
import { Lobby } from './components/Lobby';
import { GameBoard } from './components/GameBoard';
import { HowItWorks } from './components/HowItWorks';
import { GameHistory } from './components/GameHistory';
import { ResultModal } from './components/ResultModal';
import { DepositModal } from './components/DepositModal';
import { Leaderboard } from './components/Leaderboard';
import { useContract } from './hooks/useContract';
import type { GameData } from './hooks/useContract';
import { GameState } from './config/contract';
import { updatePlayerStats } from './lib/firebase';
import './App.css';

function App() {
    const navigate = useNavigate();
    const { authenticated } = usePrivy();
    const { wallets } = useWallets();
    const {
        getBalance,
        makeMove,
        getGame,
        getActiveGame,
        getWaitingGame,
        getGameCounter
    } = useContract();

    const [totalGames, setTotalGames] = useState(0);
    const [waitingGames, setWaitingGames] = useState<number[]>([0, 0, 0]);
    const [currentGameId, setCurrentGameId] = useState<number | null>(null);
    const [currentGame, setCurrentGame] = useState<GameData | null>(null);
    const [tileOwners, setTileOwners] = useState<Map<number, 'p1' | 'p2'>>(new Map());
    const [dangerTiles, setDangerTiles] = useState<Set<number>>(new Set());
    const [showResult, setShowResult] = useState(false);
    const [gameResult, setGameResult] = useState<{ won: boolean; payout: string } | null>(null);
    const [notifications, setNotifications] = useState<Array<{ id: number; msg: string; type: string }>>([]);

    // Deposit modal state
    const [showDeposit, setShowDeposit] = useState(false);
    const [walletBalance, setWalletBalance] = useState('0.00');
    const [hasShownDeposit, setHasShownDeposit] = useState(false);

    // Refs to prevent duplicate notifications
    const lastNotifiedGameId = useRef<{ [key: string]: number }>({});

    // Notification helper
    const notify = useCallback((msg: string, type: string = 'info') => {
        const id = Date.now();
        setNotifications(prev => [...prev, { id, msg, type }]);
        setTimeout(() => {
            setNotifications(prev => prev.filter(n => n.id !== id));
        }, 4000);
    }, []);

    // Load stats
    const loadStats = useCallback(async () => {
        if (!authenticated || !wallets.length) return;

        try {
            const total = await getGameCounter();
            setTotalGames(total);

            const waiting = await Promise.all([
                getWaitingGame(0),
                getWaitingGame(1),
                getWaitingGame(2)
            ]);
            setWaitingGames(waiting);
        } catch (err) {
            console.error('Failed to load stats:', err);
        }
    }, [authenticated, wallets, getGameCounter, getWaitingGame]);

    // Refresh wallet balance
    const refreshBalance = useCallback(async () => {
        if (wallets.length > 0) {
            try {
                const balance = await getBalance();
                setWalletBalance(balance);
            } catch (err) {
                console.error('Failed to get balance:', err);
            }
        }
    }, [wallets, getBalance]);

    // Check for active game on login
    useEffect(() => {
        if (authenticated && wallets.length > 0) {
            const checkActiveGame = async () => {
                const gameId = await getActiveGame(wallets[0].address);
                if (gameId > 0) {
                    const game = await getGame(gameId);
                    if (game && game.state !== GameState.Finished) {
                        setCurrentGameId(gameId);
                        setCurrentGame(game);
                        navigate('/game');
                    }
                }
            };
            checkActiveGame();
            loadStats();
            refreshBalance();

            // Show deposit modal for new users (first time per session)
            if (!hasShownDeposit) {
                setTimeout(() => {
                    setShowDeposit(true);
                    setHasShownDeposit(true);
                }, 500);
            }
        }
    }, [authenticated, wallets, getActiveGame, getGame, loadStats, refreshBalance, hasShownDeposit, navigate]);

    // Track previous game state for change detection (polling-based approach)
    // Note: Using polling instead of event listeners because Monad testnet RPC
    // limits eth_getLogs to 100 blocks and has aggressive rate limiting
    const prevGameState = useRef<{
        state: number;
        revealedTiles: bigint;
        winner: string;
        player2: string;
    } | null>(null);

    // Poll for game state changes (replaces event listeners)
    useEffect(() => {
        if (!currentGameId || !currentGame || !authenticated || !wallets.length) return;

        const myAddress = wallets[0].address.toLowerCase();

        const pollGameState = async () => {
            try {
                const game = await getGame(currentGameId);
                if (!game) return;

                const prev = prevGameState.current;

                // Detect state changes
                if (prev) {
                    // Game started (player2 joined)
                    if (prev.player2 === '0x0000000000000000000000000000000000000000' &&
                        game.player2 !== '0x0000000000000000000000000000000000000000') {
                        if (lastNotifiedGameId.current['started'] !== currentGameId) {
                            lastNotifiedGameId.current['started'] = currentGameId;
                            notify('Opponent joined!', 'success');
                        }
                    }

                    // VRF completed (state changed from WaitingForVRF to InProgress)
                    if (prev.state === GameState.WaitingForVRF && game.state === GameState.InProgress) {
                        if (lastNotifiedGameId.current['tiles'] !== currentGameId) {
                            lastNotifiedGameId.current['tiles'] = currentGameId;
                            notify('Game started!', 'success');
                        }
                    }


                    // Game finished
                    if (prev.state !== GameState.Finished && game.state === GameState.Finished) {
                        const won = game.winner.toLowerCase() === myAddress;
                        const payout = formatEther(game.betAmount * 2n);
                        setGameResult({ won, payout });
                        setShowResult(true);

                        // Update leaderboard stats
                        try {
                            const loser = game.winner.toLowerCase() === game.player1.toLowerCase()
                                ? game.player2
                                : game.player1;
                            await updatePlayerStats(game.winner, true, parseFloat(payout));
                            await updatePlayerStats(loser, false, 0);
                        } catch (err) {
                            console.error('Failed to update leaderboard:', err);
                        }
                    }
                }

                // Update tracked state
                prevGameState.current = {
                    state: game.state,
                    revealedTiles: game.revealedTiles,
                    winner: game.winner,
                    player2: game.player2
                };

                setCurrentGame(game);
            } catch (err) {
                console.error('Failed to poll game state:', err);
            }
        };

        // Poll every 2 seconds
        const interval = setInterval(pollGameState, 2000);
        pollGameState(); // Initial poll

        return () => clearInterval(interval);
    }, [currentGameId, currentGame, authenticated, wallets, getGame, notify]);

    // Handle tile click
    const handleTileClick = async (tile: number) => {
        if (!currentGameId) return;

        try {
            await makeMove(currentGameId, tile);
        } catch (err) {
            notify('Move failed', 'error');
        }
    };

    // Handle exit game
    const handleExitGame = () => {
        setCurrentGameId(null);
        setCurrentGame(null);
        setTileOwners(new Map());
        setDangerTiles(new Set());
        navigate('/lobby');
    };

    // Handle result close
    const handleResultClose = () => {
        setShowResult(false);
        setGameResult(null);
        handleExitGame();
        loadStats();
        refreshBalance();
    };

    // Handle play click
    const handlePlay = () => {
        if (authenticated) {
            navigate('/lobby');
        }
    };

    // Handle game joined
    const handleGameJoined = async (gameId: number) => {
        setCurrentGameId(gameId);
        const game = await getGame(gameId);
        if (game) {
            setCurrentGame(game);
            navigate('/game');
            notify('Game joined!', 'success');
        }
    };

    return (
        <>
            <div className="noise"></div>
            <div className="glow glow-1"></div>
            <div className="glow glow-2"></div>

            <div id="app">
                <Navbar onHowItWorks={() => navigate('/how-it-works')} onHistory={() => navigate('/history')} />

                <main className="main">
                    <Routes>
                        <Route path="/" element={
                            <Landing
                                totalGames={totalGames}
                                waitingGames={waitingGames.filter(g => g > 0).length}
                                onPlay={handlePlay}
                            />
                        } />
                        <Route path="/lobby" element={
                            <Lobby
                                waitingGames={waitingGames}
                                onBack={() => navigate('/')}
                                onGameJoined={handleGameJoined}
                            />
                        } />
                        <Route path="/game" element={
                            currentGame && currentGameId ? (
                                <GameBoard
                                    gameId={currentGameId}
                                    game={currentGame}
                                    onExit={handleExitGame}
                                    onTileClick={handleTileClick}
                                    tileOwners={tileOwners}
                                    dangerTiles={dangerTiles}
                                />
                            ) : null
                        } />
                        <Route path="/how-it-works" element={
                            <HowItWorks onBack={() => navigate('/')} />
                        } />
                        <Route path="/leaderboard" element={
                            <Leaderboard onBack={() => navigate('/')} />
                        } />
                        <Route path="/history" element={
                            <GameHistory onBack={() => navigate('/')} />
                        } />

                    </Routes>
                </main>

                {/* Mobile Footer */}
                <footer className="mobile-footer">
                    <button className="footer-link" onClick={() => navigate('/how-it-works')}>
                        How it Works
                    </button>
                    <button className="footer-link" onClick={() => navigate('/history')}>
                        Verify Games
                    </button>
                    <a href="https://x.com/takkofun" target="_blank" rel="noopener noreferrer" className="footer-link">
                        <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                        </svg>
                        Twitter
                    </a>
                </footer>

                {showResult && gameResult && (
                    <ResultModal
                        won={gameResult.won}
                        payout={gameResult.payout}
                        onClose={handleResultClose}
                    />
                )}

                {showDeposit && (
                    <DepositModal
                        balance={walletBalance}
                        onClose={() => setShowDeposit(false)}
                        onRefresh={refreshBalance}
                    />
                )}

                <div className="notifications">
                    {notifications.map(n => (
                        <div key={n.id} className={`notification ${n.type}`}>
                            <span className="notification-text">{n.msg}</span>
                        </div>
                    ))}
                </div>
            </div>
        </>
    );
}

export default App;
