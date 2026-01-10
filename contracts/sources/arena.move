module algoarena::arena {
    use std::signer;
    use std::vector;
    use std::string::{Self, String};
    use aptos_framework::coin;
    use aptos_framework::aptos_coin::AptosCoin;
    use aptos_framework::timestamp;
    use aptos_framework::event;
    use aptos_framework::account;

    // =============================================
    // AlgoArena: AI Trading Auto-Battler
    // This module handles:
    // - Game rounds and state
    // - Player registration and stats
    // - Agent hiring via x402 payments
    // - PnL tracking and leaderboards
    // =============================================

    // Error codes
    const E_NOT_INITIALIZED: u64 = 1;
    const E_ALREADY_INITIALIZED: u64 = 2;
    const E_ROUND_NOT_ACTIVE: u64 = 3;
    const E_ROUND_ALREADY_ACTIVE: u64 = 4;
    const E_AGENT_NOT_FOUND: u64 = 5;
    const E_INSUFFICIENT_BALANCE: u64 = 6;
    const E_PLAYER_NOT_FOUND: u64 = 7;
    const E_AGENT_ALREADY_HIRED: u64 = 8;
    const E_UNAUTHORIZED: u64 = 9;

    // Agent types
    const AGENT_BULLISH_BOB: u8 = 1;
    const AGENT_BEARISH_BEN: u8 = 2;
    const AGENT_CRAB_CAROL: u8 = 3;

    // Game constants
    const ROUND_DURATION_SECS: u64 = 180; // 3 minutes
    const HIRE_COST_OCTAS: u64 = 10000000; // 0.1 MOVE (8 decimals)
    const BOOST_COST_OCTAS: u64 = 5000000; // 0.05 MOVE
    const HOUSE_FEE_BPS: u64 = 500; // 5%

    // Agent definition
    struct Agent has copy, drop, store {
        agent_type: u8,
        name: String,
        strategy: String, // "bullish", "bearish", "neutral"
        power: u64, // Affects trading performance
        is_boosted: bool,
    }

    // Player's active game session
    struct PlayerSession has key {
        player_address: address,
        hired_agents: vector<Agent>,
        total_pnl: u64, // Absolute value of PnL
        pnl_is_negative: bool, // True if PnL is negative
        wins: u64,
        losses: u64,
        points: u64,
        current_round_id: u64,
        last_active: u64,
    }

    // Global game state
    struct GameState has key {
        admin: address,
        treasury: address,
        current_round_id: u64,
        round_start_time: u64,
        round_end_time: u64,
        is_round_active: bool,
        total_pool: u64,
        total_players: u64,
        total_rounds_played: u64,
    }

    // Leaderboard entry
    struct LeaderboardEntry has copy, drop, store {
        player: address,
        points: u64,
        wins: u64,
        total_pnl: u64,
        pnl_is_negative: bool,
    }

    // Global leaderboard
    struct Leaderboard has key {
        entries: vector<LeaderboardEntry>,
        last_updated: u64,
    }

    // Events
    #[event]
    struct AgentHiredEvent has drop, store {
        player: address,
        agent_type: u8,
        round_id: u64,
        timestamp: u64,
    }

    #[event]
    struct AgentBoostedEvent has drop, store {
        player: address,
        agent_type: u8,
        round_id: u64,
        timestamp: u64,
    }

    #[event]
    struct RoundStartedEvent has drop, store {
        round_id: u64,
        start_time: u64,
        end_time: u64,
    }

    #[event]
    struct RoundEndedEvent has drop, store {
        round_id: u64,
        total_pool: u64,
        total_players: u64,
    }

    #[event]
    struct PlayerJoinedEvent has drop, store {
        player: address,
        round_id: u64,
        timestamp: u64,
    }

    // ==================
    // Initialization
    // ==================

    /// Initialize the game state (called once by admin)
    public entry fun initialize(admin: &signer, treasury: address) {
        let admin_addr = signer::address_of(admin);
        assert!(!exists<GameState>(admin_addr), E_ALREADY_INITIALIZED);

        move_to(admin, GameState {
            admin: admin_addr,
            treasury,
            current_round_id: 0,
            round_start_time: 0,
            round_end_time: 0,
            is_round_active: false,
            total_pool: 0,
            total_players: 0,
            total_rounds_played: 0,
        });

        move_to(admin, Leaderboard {
            entries: vector::empty<LeaderboardEntry>(),
            last_updated: timestamp::now_seconds(),
        });
    }

    // ==================
    // Player Functions
    // ==================

    /// Register a new player (creates their session)
    public entry fun register_player(player: &signer) {
        let player_addr = signer::address_of(player);

        if (!exists<PlayerSession>(player_addr)) {
            move_to(player, PlayerSession {
                player_address: player_addr,
                hired_agents: vector::empty<Agent>(),
                total_pnl: 0,
                pnl_is_negative: false,
                wins: 0,
                losses: 0,
                points: 0,
                current_round_id: 0,
                last_active: timestamp::now_seconds(),
            });
        }
    }

    /// Hire an agent for the current round (x402 payment already verified off-chain)
    public entry fun hire_agent(
        player: &signer,
        game_admin: address,
        agent_type: u8
    ) acquires PlayerSession, GameState {
        let player_addr = signer::address_of(player);
        assert!(exists<PlayerSession>(player_addr), E_PLAYER_NOT_FOUND);
        assert!(exists<GameState>(game_admin), E_NOT_INITIALIZED);

        let game_state = borrow_global<GameState>(game_admin);
        assert!(game_state.is_round_active, E_ROUND_NOT_ACTIVE);

        let session = borrow_global_mut<PlayerSession>(player_addr);

        // Check if agent already hired
        let i = 0;
        let len = vector::length(&session.hired_agents);
        while (i < len) {
            let agent = vector::borrow(&session.hired_agents, i);
            assert!(agent.agent_type != agent_type, E_AGENT_ALREADY_HIRED);
            i = i + 1;
        };

        // Create the agent
        let agent = create_agent(agent_type);
        vector::push_back(&mut session.hired_agents, agent);
        session.current_round_id = game_state.current_round_id;
        session.last_active = timestamp::now_seconds();

        // Transfer hire cost to treasury
        coin::transfer<AptosCoin>(player, game_state.treasury, HIRE_COST_OCTAS);

        // Emit event
        event::emit(AgentHiredEvent {
            player: player_addr,
            agent_type,
            round_id: game_state.current_round_id,
            timestamp: timestamp::now_seconds(),
        });
    }

    /// Boost an active agent
    public entry fun boost_agent(
        player: &signer,
        game_admin: address,
        agent_type: u8
    ) acquires PlayerSession, GameState {
        let player_addr = signer::address_of(player);
        assert!(exists<PlayerSession>(player_addr), E_PLAYER_NOT_FOUND);
        assert!(exists<GameState>(game_admin), E_NOT_INITIALIZED);

        let game_state = borrow_global<GameState>(game_admin);
        assert!(game_state.is_round_active, E_ROUND_NOT_ACTIVE);

        let session = borrow_global_mut<PlayerSession>(player_addr);

        // Find and boost the agent
        let i = 0;
        let len = vector::length(&session.hired_agents);
        let found = false;
        while (i < len) {
            let agent = vector::borrow_mut(&mut session.hired_agents, i);
            if (agent.agent_type == agent_type) {
                agent.is_boosted = true;
                agent.power = agent.power + 20; // +20% power
                found = true;
                break
            };
            i = i + 1;
        };
        assert!(found, E_AGENT_NOT_FOUND);

        // Transfer boost cost to treasury
        coin::transfer<AptosCoin>(player, game_state.treasury, BOOST_COST_OCTAS);

        event::emit(AgentBoostedEvent {
            player: player_addr,
            agent_type,
            round_id: game_state.current_round_id,
            timestamp: timestamp::now_seconds(),
        });
    }

    // ==================
    // Admin Functions
    // ==================

    /// Start a new round
    public entry fun start_round(admin: &signer) acquires GameState {
        let admin_addr = signer::address_of(admin);
        assert!(exists<GameState>(admin_addr), E_NOT_INITIALIZED);

        let game_state = borrow_global_mut<GameState>(admin_addr);
        assert!(game_state.admin == admin_addr, E_UNAUTHORIZED);
        assert!(!game_state.is_round_active, E_ROUND_ALREADY_ACTIVE);

        let now = timestamp::now_seconds();
        game_state.current_round_id = game_state.current_round_id + 1;
        game_state.round_start_time = now;
        game_state.round_end_time = now + ROUND_DURATION_SECS;
        game_state.is_round_active = true;
        game_state.total_pool = 0;

        event::emit(RoundStartedEvent {
            round_id: game_state.current_round_id,
            start_time: now,
            end_time: now + ROUND_DURATION_SECS,
        });
    }

    /// End the current round and distribute rewards
    public entry fun end_round(admin: &signer) acquires GameState {
        let admin_addr = signer::address_of(admin);
        assert!(exists<GameState>(admin_addr), E_NOT_INITIALIZED);

        let game_state = borrow_global_mut<GameState>(admin_addr);
        assert!(game_state.admin == admin_addr, E_UNAUTHORIZED);
        assert!(game_state.is_round_active, E_ROUND_NOT_ACTIVE);

        game_state.is_round_active = false;
        game_state.total_rounds_played = game_state.total_rounds_played + 1;

        event::emit(RoundEndedEvent {
            round_id: game_state.current_round_id,
            total_pool: game_state.total_pool,
            total_players: game_state.total_players,
        });
    }

    /// Update player PnL after round (called by backend with verified results)
    /// pnl_delta is the absolute value, pnl_is_positive indicates if gain or loss
    public entry fun update_player_pnl(
        admin: &signer,
        player: address,
        pnl_delta: u64,
        pnl_is_positive: bool,
        won: bool
    ) acquires GameState, PlayerSession, Leaderboard {
        let admin_addr = signer::address_of(admin);
        assert!(exists<GameState>(admin_addr), E_NOT_INITIALIZED);

        let game_state = borrow_global<GameState>(admin_addr);
        assert!(game_state.admin == admin_addr, E_UNAUTHORIZED);
        assert!(exists<PlayerSession>(player), E_PLAYER_NOT_FOUND);

        let session = borrow_global_mut<PlayerSession>(player);

        // Update PnL with sign handling
        if (pnl_is_positive) {
            if (session.pnl_is_negative) {
                // Adding positive to negative
                if (pnl_delta >= session.total_pnl) {
                    session.total_pnl = pnl_delta - session.total_pnl;
                    session.pnl_is_negative = false;
                } else {
                    session.total_pnl = session.total_pnl - pnl_delta;
                }
            } else {
                // Adding positive to positive
                session.total_pnl = session.total_pnl + pnl_delta;
            }
        } else {
            // Adding negative (loss)
            if (session.pnl_is_negative) {
                // Adding negative to negative
                session.total_pnl = session.total_pnl + pnl_delta;
            } else {
                // Adding negative to positive
                if (pnl_delta >= session.total_pnl) {
                    session.total_pnl = pnl_delta - session.total_pnl;
                    session.pnl_is_negative = true;
                } else {
                    session.total_pnl = session.total_pnl - pnl_delta;
                }
            }
        };

        if (won) {
            session.wins = session.wins + 1;
            session.points = session.points + 10; // 10 points per win
        } else {
            session.losses = session.losses + 1;
            session.points = session.points + 2; // 2 points for participation
        };

        // Clear hired agents for next round
        session.hired_agents = vector::empty<Agent>();

        // Update leaderboard
        update_leaderboard(admin_addr, player, session.points, session.wins, session.total_pnl, session.pnl_is_negative);
    }

    // ==================
    // Helper Functions
    // ==================

    fun create_agent(agent_type: u8): Agent {
        if (agent_type == AGENT_BULLISH_BOB) {
            Agent {
                agent_type: AGENT_BULLISH_BOB,
                name: string::utf8(b"Bullish Bob"),
                strategy: string::utf8(b"bullish"),
                power: 100,
                is_boosted: false,
            }
        } else if (agent_type == AGENT_BEARISH_BEN) {
            Agent {
                agent_type: AGENT_BEARISH_BEN,
                name: string::utf8(b"Bearish Ben"),
                strategy: string::utf8(b"bearish"),
                power: 100,
                is_boosted: false,
            }
        } else {
            Agent {
                agent_type: AGENT_CRAB_CAROL,
                name: string::utf8(b"Crab Carol"),
                strategy: string::utf8(b"neutral"),
                power: 80,
                is_boosted: false,
            }
        }
    }

    fun update_leaderboard(
        game_admin: address,
        player: address,
        points: u64,
        wins: u64,
        total_pnl: u64,
        pnl_is_negative: bool
    ) acquires Leaderboard {
        let leaderboard = borrow_global_mut<Leaderboard>(game_admin);

        // Find existing entry or add new one
        let i = 0;
        let len = vector::length(&leaderboard.entries);
        let found = false;

        while (i < len) {
            let entry = vector::borrow_mut(&mut leaderboard.entries, i);
            if (entry.player == player) {
                entry.points = points;
                entry.wins = wins;
                entry.total_pnl = total_pnl;
                entry.pnl_is_negative = pnl_is_negative;
                found = true;
                break
            };
            i = i + 1;
        };

        if (!found) {
            vector::push_back(&mut leaderboard.entries, LeaderboardEntry {
                player,
                points,
                wins,
                total_pnl,
                pnl_is_negative,
            });
        };

        leaderboard.last_updated = timestamp::now_seconds();
    }

    // ==================
    // View Functions
    // ==================

    #[view]
    public fun get_game_state(game_admin: address): (u64, u64, u64, bool, u64) acquires GameState {
        let state = borrow_global<GameState>(game_admin);
        (
            state.current_round_id,
            state.round_start_time,
            state.round_end_time,
            state.is_round_active,
            state.total_pool
        )
    }

    #[view]
    public fun get_player_stats(player: address): (u64, bool, u64, u64, u64) acquires PlayerSession {
        if (!exists<PlayerSession>(player)) {
            return (0, false, 0, 0, 0)
        };
        let session = borrow_global<PlayerSession>(player);
        (session.total_pnl, session.pnl_is_negative, session.wins, session.losses, session.points)
    }

    #[view]
    public fun get_hire_cost(): u64 {
        HIRE_COST_OCTAS
    }

    #[view]
    public fun get_boost_cost(): u64 {
        BOOST_COST_OCTAS
    }

    #[view]
    public fun is_round_active(game_admin: address): bool acquires GameState {
        if (!exists<GameState>(game_admin)) {
            return false
        };
        borrow_global<GameState>(game_admin).is_round_active
    }

    // Agent type constants for external use
    public fun agent_bullish_bob(): u8 { AGENT_BULLISH_BOB }
    public fun agent_bearish_ben(): u8 { AGENT_BEARISH_BEN }
    public fun agent_crab_carol(): u8 { AGENT_CRAB_CAROL }
}
