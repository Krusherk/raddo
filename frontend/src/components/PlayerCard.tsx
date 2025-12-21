interface PlayerCardProps {
    isPlayer1: boolean;
    address: string;
    isYou: boolean;
    isActive: boolean;
}

export function PlayerCard({ isPlayer1, address, isYou, isActive }: PlayerCardProps) {
    const truncate = (addr: string) =>
        addr && addr !== '0x0000000000000000000000000000000000000000'
            ? `${addr.slice(0, 6)}...${addr.slice(-4)}`
            : 'Waiting...';

    return (
        <div className={`player-card ${isYou ? 'is-you' : ''} ${isActive ? 'active' : ''}`}>
            <div className={`player-indicator ${isPlayer1 ? 'player-x' : 'player-o'}`}>
                {isPlayer1 ? 'X' : 'O'}
            </div>
            <div className="player-info">
                <span className="player-label">Player {isPlayer1 ? 'X' : 'O'}</span>
                <span className="player-addr">{truncate(address)}</span>
            </div>
            {isYou && <div className="player-you">YOU</div>}
        </div>
    );
}
