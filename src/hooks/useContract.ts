import { useCallback, useState } from 'react';
import { useWallets } from '@privy-io/react-auth';
import { BrowserProvider, Contract, formatEther } from 'ethers';
import { CONTRACT_ADDRESS, CONTRACT_ABI, CHAIN_ID } from '../config/contract';

export interface GameData {
    player1: string;
    player2: string;
    tier: number;
    betAmount: bigint;
    state: number;
    currentTurn: string;
    winner: string;
    revealedTiles: bigint;
}

export function useContract() {
    const { wallets } = useWallets();
    const [loading, setLoading] = useState(false);

    const getContract = useCallback(async () => {
        if (!wallets || wallets.length === 0) {
            throw new Error('No wallet connected');
        }

        const wallet = wallets[0];
        await wallet.switchChain(CHAIN_ID);
        const ethereumProvider = await wallet.getEthereumProvider();
        const provider = new BrowserProvider(ethereumProvider);
        const signer = await provider.getSigner();
        return new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
    }, [wallets]);

    const getProvider = useCallback(async () => {
        if (!wallets || wallets.length === 0) return null;
        const wallet = wallets[0];
        await wallet.switchChain(CHAIN_ID);
        const ethereumProvider = await wallet.getEthereumProvider();
        return new BrowserProvider(ethereumProvider);
    }, [wallets]);

    const getBalance = useCallback(async (): Promise<string> => {
        const provider = await getProvider();
        if (!provider || !wallets[0]) return '0.00';
        const balance = await provider.getBalance(wallets[0].address);
        return parseFloat(formatEther(balance)).toFixed(2);
    }, [getProvider, wallets]);

    const joinGame = useCallback(async (tier: number) => {
        setLoading(true);
        try {
            const contract = await getContract();
            const payment = await contract.getRequiredPayment(tier);
            const tx = await contract.joinGame(tier, { value: payment });
            await tx.wait();
            return true;
        } finally {
            setLoading(false);
        }
    }, [getContract]);

    const makeMove = useCallback(async (gameId: number, tile: number) => {
        setLoading(true);
        try {
            const contract = await getContract();
            const tx = await contract.makeMove(gameId, tile);
            await tx.wait();
            return true;
        } finally {
            setLoading(false);
        }
    }, [getContract]);

    const getGame = useCallback(async (gameId: number): Promise<GameData | null> => {
        try {
            const contract = await getContract();
            const game = await contract.getGame(gameId);
            return {
                player1: game.player1,
                player2: game.player2,
                tier: Number(game.tier),
                betAmount: game.betAmount,
                state: Number(game.state),
                currentTurn: game.currentTurn,
                winner: game.winner,
                revealedTiles: game.revealedTiles
            };
        } catch {
            return null;
        }
    }, [getContract]);

    const getActiveGame = useCallback(async (address: string): Promise<number> => {
        try {
            const contract = await getContract();
            const gameId = await contract.playerActiveGame(address);
            return Number(gameId);
        } catch {
            return 0;
        }
    }, [getContract]);

    const getWaitingGame = useCallback(async (tier: number): Promise<number> => {
        try {
            const contract = await getContract();
            return Number(await contract.getWaitingGame(tier));
        } catch {
            return 0;
        }
    }, [getContract]);

    const getGameCounter = useCallback(async (): Promise<number> => {
        try {
            const contract = await getContract();
            return Number(await contract.gameCounter());
        } catch {
            return 0;
        }
    }, [getContract]);

    return {
        loading,
        getContract,
        getProvider,
        getBalance,
        joinGame,
        makeMove,
        getGame,
        getActiveGame,
        getWaitingGame,
        getGameCounter
    };
}
