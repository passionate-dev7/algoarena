# AlgoArena Architecture

> Technical deep-dive into the AI Trading Auto-Battler built on Movement Network

---

## System Overview

```mermaid
flowchart TB
    subgraph Client["Frontend (Next.js)"]
        UI[React UI]
        WS[WebSocket Client]
        W[Wallet Adapter]
        X402H[x402 Payment Hook]
    end

    subgraph Server["Game Server (Node.js)"]
        API[Express REST API]
        IO[Socket.IO Server]
        GL[Game Loop]
        AT[Agent Trading Engine]
        X402P[x402 Paywall]
    end

    subgraph External["External Services"]
        PYTH[Pyth Network Oracle]
        FAC[x402 Facilitator]
        MOVE[Movement Network RPC]
    end

    subgraph Blockchain["Movement Network"]
        SC[Arena Smart Contract]
        TR[Treasury Wallet]
    end

    UI --> WS
    UI --> W
    W --> X402H
    X402H --> API
    WS <--> IO

    API --> X402P
    X402P --> FAC
    GL --> AT
    GL --> PYTH
    IO --> GL

    FAC --> MOVE
    MOVE --> SC
    MOVE --> TR

    SC --> TR

    style Client fill:#1a1a2e,stroke:#e94560,color:#fff
    style Server fill:#16213e,stroke:#0f3460,color:#fff
    style External fill:#0f3460,stroke:#e94560,color:#fff
    style Blockchain fill:#533483,stroke:#e94560,color:#fff
```

---

## x402 Payment Flow

The x402 protocol enables HTTP-native micropayments using the `402 Payment Required` status code.

```mermaid
sequenceDiagram
    participant U as User Browser
    participant W as Wallet (Petra/Razor)
    participant S as Game Server
    participant F as x402 Facilitator
    participant M as Movement Network

    U->>S: GET /api/hire/bull
    S->>U: 402 Payment Required<br/>{accepts: [{payTo, amount, asset}]}

    U->>W: Request Signature<br/>(0.001 MOVE transfer)
    W->>U: Signed Transaction

    U->>S: GET /api/hire/bull<br/>X-PAYMENT: [signed_tx_base64]

    S->>F: Verify & Submit Payment
    F->>M: Submit Transaction
    M->>F: Transaction Confirmed
    F->>S: Payment Verified

    S->>U: 200 OK<br/>{accessToken: "..."}

    Note over U,S: Agent is now hired!
```

### x402 Payment Header Format

```typescript
// Payment header structure (base64 encoded)
{
  signatureBcsBase64: string,  // Ed25519 signature
  transactionBcsBase64: string // Unsigned transfer transaction
}
```

### Server-Side x402 Configuration

```typescript
x402Paywall(TREASURY_ADDRESS, {
  "GET /api/hire/bull": {
    network: "movement",
    asset: "0x1::aptos_coin::AptosCoin",
    maxAmountRequired: "100000",  // 0.001 MOVE
    description: "Hire Bullish Bob",
  },
  // ... more endpoints
});
```

---

## Smart Contract Architecture

```mermaid
classDiagram
    class GameState {
        +address admin
        +address treasury
        +u64 current_round_id
        +u64 round_start_time
        +u64 round_end_time
        +bool is_round_active
        +u64 total_pool
        +u64 total_players
        +u64 total_rounds_played
    }

    class PlayerSession {
        +address player_address
        +vector~Agent~ hired_agents
        +u64 total_pnl
        +bool pnl_is_negative
        +u64 wins
        +u64 losses
        +u64 points
        +u64 current_round_id
        +u64 last_active
    }

    class Agent {
        +u8 agent_type
        +String name
        +String strategy
        +u64 power
        +bool is_boosted
    }

    class Leaderboard {
        +vector~LeaderboardEntry~ entries
        +u64 last_updated
    }

    class LeaderboardEntry {
        +address player
        +u64 points
        +u64 wins
        +u64 total_pnl
        +bool pnl_is_negative
    }

    GameState "1" --> "*" PlayerSession : manages
    PlayerSession "1" --> "0..3" Agent : contains
    GameState "1" --> "1" Leaderboard : owns
    Leaderboard "1" --> "*" LeaderboardEntry : contains
```

### Contract Entry Functions

```mermaid
flowchart LR
    subgraph Admin["Admin Functions"]
        I[initialize]
        SR[start_round]
        ER[end_round]
        UP[update_player_pnl]
    end

    subgraph Player["Player Functions"]
        RP[register_player]
        HA[hire_agent]
        BA[boost_agent]
    end

    subgraph View["View Functions"]
        GGS[get_game_state]
        GPS[get_player_stats]
        GHC[get_hire_cost]
        IRA[is_round_active]
    end

    style Admin fill:#e94560,stroke:#fff,color:#fff
    style Player fill:#0f3460,stroke:#fff,color:#fff
    style View fill:#533483,stroke:#fff,color:#fff
```

---

## Price Feed Integration (Pyth Network)

```mermaid
flowchart TB
    subgraph Pyth["Pyth Network"]
        HE[Hermes Endpoint]
        PF1[BTC/USD Feed]
        PF2[ETH/USD Feed]
        PF3[SOL/USD Feed]
        PF4[MOVE/USD Feed]
        PF5[DOGE/USD Feed]
        PF6[AVAX/USD Feed]
    end

    subgraph Server["Game Server"]
        HC[Hermes Client]
        PP[Price Processor]
        CB[Candle Builder]
    end

    subgraph Game["Game Logic"]
        GL[Game Loop<br/>1s interval]
        AT[Agent Trading]
        BC[Broadcast]
    end

    HE --> HC
    PF1 & PF2 & PF3 & PF4 & PF5 & PF6 --> HE
    HC --> PP
    PP --> CB
    CB --> GL
    GL --> AT
    GL --> BC

    style Pyth fill:#7c3aed,stroke:#fff,color:#fff
    style Server fill:#16213e,stroke:#fff,color:#fff
    style Game fill:#0f3460,stroke:#fff,color:#fff
```

### Price Feed IDs (Pyth Stable)

| Asset | Price Feed ID |
|-------|--------------|
| BTC/USD | `0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43` |
| ETH/USD | `0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace` |
| SOL/USD | `0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d` |
| MOVE/USD | `0x6bf748c908767baa762a1563d454ebec2d5108f8ee36d806aadacc8f0a075b6d` |
| DOGE/USD | `0xdcef50dd0a4cd2dcc17e45df1676dcb336a11a61c69df7a0299b0150c672d25c` |
| AVAX/USD | `0x93da3352f9f1d105fdfe4971cfa80e9dd777bfc5d0f683ebb6e1294b92137bb7` |

---

## AI Agent Trading Logic

```mermaid
stateDiagram-v2
    [*] --> Idle: Agent Created

    Idle --> Analyzing: Price Update

    state Analyzing {
        [*] --> CheckStrategy
        CheckStrategy --> BullishLogic: type == BULL
        CheckStrategy --> BearishLogic: type == BEAR
        CheckStrategy --> CrabLogic: type == CRAB
    }

    Analyzing --> OpenPosition: Signal Detected
    Analyzing --> Idle: No Signal

    OpenPosition --> Holding: Position Opened

    Holding --> CheckExit: Price Update

    state CheckExit {
        [*] --> ProfitCheck
        ProfitCheck --> TakeProfit: profit > threshold
        ProfitCheck --> StopLoss: loss > threshold
        ProfitCheck --> TimeExit: position_age > max
        ProfitCheck --> Hold: continue
    }

    CheckExit --> ClosePosition: Exit Signal
    CheckExit --> Holding: Hold Position

    ClosePosition --> Idle: PnL Recorded
```

### Agent Strategies

```mermaid
flowchart TB
    subgraph Bull["Bullish Bob"]
        B1[Open LONG on dips]
        B2[15% random entry]
        B3[Take profit: +0.01%]
        B4[Stop loss: -0.02%]
        B5[Max hold: 15s]
    end

    subgraph Bear["Bearish Ben"]
        BR1[Open SHORT on pumps]
        BR2[15% random entry]
        BR3[Take profit: +0.01%]
        BR4[Stop loss: -0.02%]
        BR5[Max hold: 15s]
    end

    subgraph Crab["Crab Carol"]
        C1[Mean reversion trades]
        C2[20% random entry]
        C3[Take profit: +0.005%]
        C4[Stop loss: -0.01%]
        C5[Max hold: 10s]
    end

    style Bull fill:#22c55e,stroke:#fff,color:#fff
    style Bear fill:#ef4444,stroke:#fff,color:#fff
    style Crab fill:#3b82f6,stroke:#fff,color:#fff
```

---

## Game Round Lifecycle

```mermaid
stateDiagram-v2
    [*] --> VotingPhase: Server Start

    VotingPhase --> RoundActive: 15s Timer / Votes Tallied

    state VotingPhase {
        [*] --> CollectingVotes
        CollectingVotes --> TallyVotes: Timer Ends
        TallyVotes --> SelectAsset: Most Votes
    }

    state RoundActive {
        [*] --> Trading
        Trading --> Trading: 1s Price Updates
        Trading --> AgentTrades: Process Positions
        AgentTrades --> BroadcastPnL
        BroadcastPnL --> Trading
    }

    RoundActive --> RoundEnded: 3min Timer

    state RoundEnded {
        [*] --> ClosePositions
        ClosePositions --> CalculateWinner
        CalculateWinner --> UpdateLeaderboard
        UpdateLeaderboard --> ClearAgents
    }

    RoundEnded --> VotingPhase: 5s Delay
```

---

## Real-Time Communication (Socket.IO)

```mermaid
sequenceDiagram
    participant C as Client
    participant S as Server
    participant GL as Game Loop

    C->>S: connect()
    S->>C: game-state (initial)

    C->>S: join-game({address})
    S->>C: joined({player})

    loop Every 1 second
        GL->>S: Price Update
        S->>C: price-update({price, candle, asset})
        S->>C: player-update({pnl, agents})
    end

    C->>S: agent-hired({agentType, accessToken})
    S->>C: agent-confirmed({agent})

    C->>S: vote-asset({asset})
    S->>C: vote-update({voteResults})

    S->>C: voting-started({assets})
    S->>C: voting-ended({winningAsset})
    S->>C: round-started({roundId, asset})
    S->>C: round-ended({rankings, winner})
```

### Socket Events Reference

| Event | Direction | Payload |
|-------|-----------|---------|
| `game-state` | Server -> Client | Full game state on connect |
| `price-update` | Server -> Client | `{price, candle, asset, assetIcon}` |
| `player-update` | Server -> Client | `{address, pnl, agents[]}` |
| `join-game` | Client -> Server | `{address}` |
| `agent-hired` | Client -> Server | `{address, agentType, accessToken}` |
| `vote-asset` | Client -> Server | `{address, asset}` |
| `round-started` | Server -> Client | `{roundId, startTime, endTime, asset}` |
| `round-ended` | Server -> Client | `{roundId, rankings, winner}` |

---

## Data Flow Diagram

```mermaid
flowchart TB
    subgraph User["User Actions"]
        CW[Connect Wallet]
        HA[Hire Agent]
        BA[Boost Agent]
        VA[Vote Asset]
    end

    subgraph Frontend["Frontend State"]
        GS[gameState]
        PS[playerState]
        PH[priceHistory]
        LB[leaderboard]
    end

    subgraph Backend["Backend Processing"]
        X4[x402 Verification]
        TK[Token Generation]
        GL[Game Loop]
        AE[Agent Engine]
    end

    subgraph Blockchain["On-Chain"]
        TX[MOVE Transfer]
        SC[Contract State]
    end

    CW --> PS
    HA --> X4
    X4 --> TX
    TX --> TK
    TK --> AE
    BA --> X4
    VA --> GL

    GL --> PH
    AE --> PS
    GL --> GS
    PS --> LB

    style User fill:#e94560,stroke:#fff,color:#fff
    style Frontend fill:#16213e,stroke:#fff,color:#fff
    style Backend fill:#0f3460,stroke:#fff,color:#fff
    style Blockchain fill:#533483,stroke:#fff,color:#fff
```

---

## Technology Stack

```mermaid
mindmap
    root((AlgoArena))
        Frontend
            Next.js 16
            React 19
            Tailwind CSS
            Framer Motion
            Socket.IO Client
            Aptos Wallet Adapter
        Backend
            Node.js
            Express
            Socket.IO Server
            x402plus SDK
            Pyth Hermes Client
        Blockchain
            Movement Network
            Move Language
            Aptos SDK
        External
            Pyth Network
            x402 Facilitator
            Movement RPC
```

---

## Deployment Architecture

```mermaid
flowchart TB
    subgraph Users["Users"]
        B1[Browser 1]
        B2[Browser 2]
        B3[Browser N]
    end

    subgraph Hosting["Hosting Layer"]
        FE[Frontend<br/>Vercel/Netlify]
        BE[Backend<br/>Railway/Fly.io]
    end

    subgraph Services["External Services"]
        PYTH[Pyth Hermes<br/>hermes.pyth.network]
        X402[x402 Facilitator<br/>facilitator.stableyard.fi]
        RPC[Movement RPC<br/>mainnet.movementinfra.xyz]
    end

    B1 & B2 & B3 --> FE
    FE <--> BE
    BE --> PYTH
    BE --> X402
    X402 --> RPC

    style Users fill:#1a1a2e,stroke:#e94560,color:#fff
    style Hosting fill:#16213e,stroke:#0f3460,color:#fff
    style Services fill:#533483,stroke:#e94560,color:#fff
```

---

## Security Considerations

```mermaid
flowchart TB
    subgraph Security["Security Layers"]
        direction TB
        L1[x402 Payment Verification]
        L2[Access Token Expiry - 3min]
        L3[Wallet Signature Verification]
        L4[Rate Limiting]
        L5[CORS Protection]
    end

    subgraph Risks["Mitigated Risks"]
        R1[Replay Attacks]
        R2[Unauthorized Access]
        R3[Payment Fraud]
        R4[Bot Abuse]
    end

    L1 --> R3
    L2 --> R1
    L3 --> R2
    L4 --> R4
    L5 --> R4

    style Security fill:#22c55e,stroke:#fff,color:#fff
    style Risks fill:#ef4444,stroke:#fff,color:#fff
```

---

## Future Enhancements

```mermaid
timeline
    title AlgoArena Roadmap

    Phase 1 : MVP (Current)
             : 3 AI Agents
             : x402 Payments
             : Live Price Feeds
             : Basic Leaderboard

    Phase 2 : Enhanced Gameplay
            : More Agent Types
            : Power-ups & Events
            : Achievement System
            : Tournament Mode

    Phase 3 : Social Features
            : Spectator Mode
            : Chat & Emotes
            : Agent Customization
            : NFT Agents

    Phase 4 : DeFi Integration
            : Staking Rewards
            : Prize Pools
            : Governance Token
            : Cross-chain
```

---

## Quick Reference

### Environment Variables

```bash
# Server
PORT=4402
MOVEMENT_RPC=https://full.mainnet.movementinfra.xyz/v1
MOVEMENT_PAY_TO=0x...treasury_address
FACILITATOR_URL=https://facilitator.stableyard.fi
FRONTEND_URL=http://localhost:3000

# Frontend
NEXT_PUBLIC_SERVER_URL=http://localhost:4402
```

### Key Files

| File | Purpose |
|------|---------|
| `contracts/sources/arena.move` | Move smart contract |
| `server/src/index.ts` | Game server |
| `src/hooks/use-x402-payment.ts` | x402 client integration |
| `src/hooks/use-game-socket.ts` | WebSocket state management |
| `src/components/arena.tsx` | Trading chart visualization |

---

*Built for Movement Encode M1 Hackathon*
