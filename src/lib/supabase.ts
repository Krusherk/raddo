import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL!;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY!;

export const supabase = createClient(supabaseUrl, supabaseKey);

// Database types
export interface LeaderboardEntry {
    id: number;
    player_address: string;
    wins: number;
    losses: number;
    total_games: number;
    total_earnings: number;
    created_at: string;
    updated_at: string;
}

/**
 * Update player stats after a game ends
 * @param address Player wallet address
 * @param won Whether the player won
 * @param earnings Amount won (0 for loser)
 */
export async function updatePlayerStats(
    address: string,
    won: boolean,
    earnings: number
): Promise<void> {
    const normalizedAddress = address.toLowerCase();

    try {
        // Check if player exists
        const { data: existing } = await supabase
            .from('leaderboard')
            .select('*')
            .eq('player_address', normalizedAddress)
            .single();

        if (existing) {
            // Update existing player
            await supabase
                .from('leaderboard')
                .update({
                    wins: (existing.wins || 0) + (won ? 1 : 0),
                    losses: (existing.losses || 0) + (won ? 0 : 1),
                    total_games: (existing.total_games || 0) + 1,
                    total_earnings: (existing.total_earnings || 0) + earnings,
                    updated_at: new Date().toISOString()
                })
                .eq('player_address', normalizedAddress);
        } else {
            // Insert new player
            await supabase
                .from('leaderboard')
                .insert({
                    player_address: normalizedAddress,
                    wins: won ? 1 : 0,
                    losses: won ? 0 : 1,
                    total_games: 1,
                    total_earnings: earnings
                });
        }
    } catch (err) {
        console.error('Failed to update player stats:', err);
    }
}
