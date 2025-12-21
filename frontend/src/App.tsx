import { useState, useEffect, useCallback } from 'react';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { Contract, formatEther } from 'ethers';
import { Navbar } from './components/Navbar';
import { Landing } from './components/Landing';
import { Lobby } from './components/Lobby';
import { GameBoard } from './components/GameBoard';
import { HowItWorks } from './components/HowItWorks';
import { ResultModal } from './components/ResultModal';
import { useContract } from './hooks/useContract';
import type { GameData } from './hooks/useContract';
import { GameState } from './config/contract';
import './App.css';

type View = 'landing' | 'lobby' | 'game' | 'howItWorks';

function App() {
    const { authenticated } = usePrivy();
    const { wallets } = useWallets();
    const {
        getContract,
        makeMove,
        getGame,
        getActiveGame,
        getWaitingGame,
        getGameCounter
    } = useContract();

    const [view, setView] = useState<View>('landing');
    const [totalGames, setTotalGames] = useState(0);
    const [waitingGames, setWaitingGames] = useState<number[]>([0, 0, 0]);
    const [currentGameId, setCurrentGameId] = useState<number | null>(null);
    const [currentGame, setCurrentGame] = useState<GameData | null>(null);
    const [tileOwners, setTileOwners] = useState<Map<number, 'p1' | 'p2'>>(new Map());
    const [dangerTiles, setDangerTiles] = useState<Set<number>>(new Set());
    const [showResult, setShowResult] = useState(false);
    const [gameResult, setGameResult] = useState<{ won: boolean; payout: string } | null>(null);
    const [notifications, setNotifications] = useState<Array<{ id: number; msg: string; type: string }>>([]);

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
                        setView('game');
                    }
                }
            };
            checkActiveGame();
            loadStats();
        }
    }, [authenticated, wallets, getActiveGame, getGame, loadStats]);

    // Refresh game state
    const refreshGame = useCallback(async () => {
        if (!currentGameId) return;
        const game = await getGame(currentGameId);
        if (game) {
            setCurrentGame(game);
        }
    }, [currentGameId, getGame]);

    // Poll for game updates
    useEffect(() => {
        if (currentGameId && currentGame) {
            const interval = setInterval(refreshGame, 3000);
            return () => clearInterval(interval);
        }
    }, [currentGameId, currentGame, refreshGame]);

    // Set up contract event listeners
    useEffect(() => {
        if (!authenticated || !wallets.length) return;

        let contract: Contract | null = null;

        const setupEvents = async () => {
            try {
                contract = await getContract();
                const myAddress = wallets[0].address.toLowerCase();
                let player1Address = '';

                contract.on('GameCreated', async (gameId: bigint, player1: string) => {
                    loadStats();
                    if (player1.toLowerCase() === myAddress) {
                        setCurrentGameId(Number(gameId));
                        const game = await getGame(Number(gameId));
                        if (game) {
                            setCurrentGame(game);
                            player1Address = game.player1;
                        }
                        setView('game');
                        notify('Game created - waiting for opponent', 'info');
                    }
                });

                contract.on('GameStarted', async (gameId: bigint) => {
                    if (Number(gameId) === currentGameId) {
                        await refreshGame();
                        notify('Opponent joined!', 'success');
                    }
                });

                contract.on('DangerousTilesSet', async (gameId: bigint) => {
                    if (Number(gameId) === currentGameId) {
                        await refreshGame();
                        notify('Game started!', 'success');
                    }
                });

                contract.on('MoveMade', async (gameId: bigint, player: string, tile: bigint, hitDanger: boolean) => {
                    if (Number(gameId) === currentGameId) {
                        const tileIndex = Number(tile);
                        const isP1 = player.toLowerCase() === player1Address.toLowerCase();

                        if (hitDanger) {
                            setDangerTiles(prev => new Set([...prev, tileIndex]));
                        } else {
                            setTileOwners(prev => new Map([...prev, [tileIndex, isP1 ? 'p1' : 'p2']]));
                        }

                        if (!hitDanger) {
                            await refreshGame();
                        }
                    }
                });

                contract.on('GameFinished', async (gameId: bigint, winner: string, payout: bigint) => {
                    if (Number(gameId) === currentGameId) {
                        const won = winner.toLowerCase() === myAddress;
                        setGameResult({ won, payout: formatEther(payout) });
                        setShowResult(true);
                    }
                });
            } catch (err) {
                console.error('Failed to setup events:', err);
            }
        };

        setupEvents();

        return () => {
            if (contract) {
                contract.removeAllListeners();
            }
        };
    }, [authenticated, wallets, getContract, getGame, loadStats, refreshGame, currentGameId, notify]);

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
        setView('lobby');
    };

    // Handle result close
    const handleResultClose = () => {
        setShowResult(false);
        setGameResult(null);
        handleExitGame();
        loadStats();
    };

    // Handle play click
    const handlePlay = () => {
        if (authenticated) {
            setView('lobby');
        }
    };

    return (
        <>
            <div className="noise"></div>
            <div className="glow glow-1"></div>
            <div className="glow glow-2"></div>

            <div id="app">
                <Navbar onHowItWorks={() => setView('howItWorks')} />

                <main className="main">
                    {view === 'landing' && (
                        <Landing
                            totalGames={totalGames}
                            waitingGames={waitingGames.filter(g => g > 0).length}
                            onPlay={handlePlay}
                        />
                    )}

                    {view === 'lobby' && (
                        <Lobby
                            waitingGames={waitingGames}
                            onBack={() => setView('landing')}
                            onGameJoined={setCurrentGameId}
                        />
                    )}

                    {view === 'game' && currentGame && currentGameId && (
                        <GameBoard
                            gameId={currentGameId}
                            game={currentGame}
                            onExit={handleExitGame}
                            onTileClick={handleTileClick}
                            tileOwners={tileOwners}
                            dangerTiles={dangerTiles}
                        />
                    )}

                    {view === 'howItWorks' && (
                        <HowItWorks onBack={() => setView('landing')} />
                    )}
                </main>

                {showResult && gameResult && (
                    <ResultModal
                        won={gameResult.won}
                        payout={gameResult.payout}
                        onClose={handleResultClose}
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
