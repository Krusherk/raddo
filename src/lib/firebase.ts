import { initializeApp } from 'firebase/app';
import { getDatabase, ref, get, set, update, query, orderByChild, limitToLast } from 'firebase/database';

// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyAeeum3JxynSPn7SaXuPwn1DgUUNY_EvjU",
    authDomain: "takko-774ca.firebaseapp.com",
    databaseURL: "https://takko-774ca-default-rtdb.firebaseio.com",
    projectId: "takko-774ca",
    storageBucket: "takko-774ca.firebasestorage.app",
    messagingSenderId: "245692088880",
    appId: "1:245692088880:web:b5b3232eaf5dfdd11623f5",
    measurementId: "G-1BPS2FCFH0"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

export { database };

// Types
export interface LeaderboardEntry {
    player_address: string;
    wins: number;
    losses: number;
    total_games: number;
    total_earnings: number;
    updated_at: number;
}

/**
 * Update player stats after a game ends
 */
export async function updatePlayerStats(
    address: string,
    won: boolean,
    earnings: number
): Promise<void> {
    const normalizedAddress = address.toLowerCase();
    const playerRef = ref(database, `leaderboard/${normalizedAddress.replace(/\./g, '_')}`);

    try {
        const snapshot = await get(playerRef);

        if (snapshot.exists()) {
            const existing = snapshot.val();
            await update(playerRef, {
                wins: (existing.wins || 0) + (won ? 1 : 0),
                losses: (existing.losses || 0) + (won ? 0 : 1),
                total_games: (existing.total_games || 0) + 1,
                total_earnings: (existing.total_earnings || 0) + earnings,
                updated_at: Date.now()
            });
        } else {
            await set(playerRef, {
                player_address: normalizedAddress,
                wins: won ? 1 : 0,
                losses: won ? 0 : 1,
                total_games: 1,
                total_earnings: earnings,
                updated_at: Date.now()
            });
        }
    } catch (err) {
        console.error('Failed to update player stats:', err);
    }
}

/**
 * Get leaderboard data sorted by wins
 */
export async function getLeaderboard(limit: number = 20): Promise<LeaderboardEntry[]> {
    try {
        const leaderboardRef = ref(database, 'leaderboard');
        const snapshot = await get(leaderboardRef);

        if (!snapshot.exists()) return [];

        const data = snapshot.val();
        const entries: LeaderboardEntry[] = Object.values(data);

        // Sort by wins descending
        entries.sort((a, b) => (b.wins || 0) - (a.wins || 0));

        return entries.slice(0, limit);
    } catch (err) {
        console.error('Failed to fetch leaderboard:', err);
        return [];
    }
}
