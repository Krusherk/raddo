import { useWallets } from '@privy-io/react-auth';
import { formatEther } from 'ethers';
import { PlayerCard } from './PlayerCard';
import { useContract } from '../hooks/useContract';
import type { GameData } from '../hooks/useContract';
import { GameState } from '../config/contract';

interface GameBoardProps {
    gameId: number;
    game: GameData;
    onExit: () => void;
    onTileClick: (tile: number) => void;
    tileOwners: Map<number, 'p1' | 'p2'>;
    dangerTiles: Set<number>;
}

export function GameBoard({
    gameId,
    game,
    onExit,
    onTileClick,
    tileOwners,
    dangerTiles
}: GameBoardProps) {
    const { wallets } = useWallets();
    const { loading } = useContract();

    const myAddress = wallets[0]?.address?.toLowerCase() || '';
    const isPlayer1 = game.player1.toLowerCase() === myAddress;
    const isMyTurn = game.currentTurn.toLowerCase() === myAddress;
    const isActive = game.state === GameState.InProgress;
    const isP1Turn = game.currentTurn.toLowerCase() === game.player1.toLowerCase();

    const getStateText = () => {
        switch (game.state) {
            case GameState.WaitingForPlayer: return 'Waiting for opponent';
            case GameState.WaitingForVRF: return 'Generating tiles...';
            case GameState.InProgress: return isMyTurn ? 'Your turn' : "Opponent's turn";
            case GameState.Finished: return 'Game over';
            default: return 'Unknown';
        }
    };

    const isTileRevealed = (index: number) => {
        return (game.revealedTiles & (1n << BigInt(index))) !== 0n;
    };

    const getTileClass = (index: number) => {
        const classes = ['tile'];
        const revealed = isTileRevealed(index);

        if (revealed) {
            classes.push('revealed');
            if (dangerTiles.has(index)) {
                classes.push('danger');
            } else {
                const owner = tileOwners.get(index);
                if (owner) classes.push(owner);
            }
        }

        if (!isActive || !isMyTurn || revealed) {
            classes.push('disabled');
        }

        return classes.join(' ');
    };

    const handleTileClick = (index: number) => {
        if (!isTileRevealed(index) && isActive && isMyTurn && !loading) {
            onTileClick(index);
        }
    };

    const pot = Number(formatEther(game.betAmount)) * 2;

    return (
        <section className="view game">
            <div className="game-top">
                <div className="game-meta">
                    <span className="meta-item">
                        <span className="meta-label">GAME</span>
                        <span className="meta-value">#{gameId}</span>
                    </span>
                    <span className="meta-divider">|</span>
                    <span className="meta-item">
                        <span className="meta-label">POT</span>
                        <span className="meta-value">{pot} MON</span>
                    </span>
                </div>
                <div className={`game-state ${isMyTurn && isActive ? 'your-turn' : ''}`}>
                    {getStateText()}
                </div>
            </div>

            <div className="game-arena">
                <div className="player-panel left">
                    <PlayerCard
                        isPlayer1={true}
                        address={game.player1}
                        isYou={isPlayer1}
                        isActive={isActive && isP1Turn}
                    />
                </div>

                <div className="board-container">
                    <div className="board">
                        {Array.from({ length: 25 }, (_, i) => (
                            <button
                                key={i}
                                className={getTileClass(i)}
                                onClick={() => handleTileClick(i)}
                                disabled={!isActive || !isMyTurn || isTileRevealed(i) || loading}
                            />
                        ))}
                    </div>
                    {game.state <= GameState.WaitingForVRF && (
                        <div className="board-overlay visible">
                            <div className="overlay-content">
                                <div className="spinner"></div>
                                <span>{getStateText()}</span>
                            </div>
                        </div>
                    )}
                </div>

                <div className="player-panel right">
                    <PlayerCard
                        isPlayer1={false}
                        address={game.player2}
                        isYou={!isPlayer1 && game.player2 !== '0x0000000000000000000000000000000000000000'}
                        isActive={isActive && !isP1Turn}
                    />
                </div>
            </div>

            <div className="game-bottom">
                <button className="btn-exit" onClick={onExit}>
                    Exit Game
                </button>
            </div>
        </section>
    );
}
