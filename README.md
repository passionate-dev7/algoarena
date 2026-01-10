# AlgoArena

> AI Trading Auto-Battler on Movement Network - Built for Movement Encode M1 Hackathon

AlgoArena is a DeFi-infused auto-battler game where players "manage" AI trading agents in gladiatorial battles on live candlestick charts. Using x402 micropayments, users hire and boost agents with instant, low-gas transactions on Movement Network.

## Features

- **x402 Micropayments**: Pay-per-request agent hiring using the x402 protocol
- **Live Price Feeds**: Real-time BTC/USD prices via Pyth Oracle
- **AI Trading Agents**: Three unique agents with different trading strategies
  - **Bullish Bob**: Buys dips, rides momentum
  - **Bearish Ben**: Shorts pumps, covers on dips
  - **Crab Carol**: Range trades for consistent small gains
- **Real-time Battles**: Watch agents compete on live candlestick charts
- **Leaderboard**: Compete for top PnL and earn points
- **Wallet Integration**: Supports Privy (email/social) and native wallets

## Tech Stack

- **Frontend**: Next.js 16, React 19, Tailwind CSS, Framer Motion
- **Backend**: Node.js, Express, Socket.io, x402plus
- **Blockchain**: Movement Network (Bardock Testnet)
- **Smart Contracts**: Move language
- **Oracles**: Pyth Network Hermes
- **Wallets**: Privy, Aptos Wallet Adapter

## Project Structure

```
algoarena/
├── contracts/           # Move smart contracts
│   ├── Move.toml
│   └── sources/
│       └── arena.move   # Main game contract
├── server/              # x402 backend server
│   ├── package.json
│   └── src/
│       └── index.ts     # Express + Socket.io server
├── src/                 # Next.js frontend
│   ├── app/            # App router pages
│   ├── components/     # React components
│   ├── hooks/          # Custom hooks
│   └── lib/            # Utilities
└── public/             # Static assets
```

## Getting Started

### Prerequisites

- Node.js 18+
- Movement CLI (for contract deployment)
- A wallet with testnet MOVE tokens

### 1. Clone and Install

```bash
cd algoarena

# Install frontend dependencies
npm install

# Install server dependencies
cd server
npm install
cd ..
```

### 2. Configure Environment

```bash
# Frontend
cp .env.local.example .env.local
# Edit .env.local with your Privy App ID

# Server
cd server
cp .env.example .env
# Edit .env with your treasury address
```

### 3. Deploy Smart Contracts (Optional)

```bash
cd contracts
movement move compile
movement move publish --named-addresses algoarena=YOUR_ADDRESS
```

### 4. Start the Server

```bash
cd server
npm run dev
```

### 5. Start the Frontend

```bash
# In the root directory
npm run dev
```

Visit `http://localhost:3000` to play!

## x402 Payment Flow

1. Player clicks "Hire" on an agent
2. Frontend requests the resource from the server
3. Server responds with 402 + payment requirements
4. Frontend prompts wallet signature
5. Payment is signed and sent to server
6. Server verifies via x402 facilitator
7. Agent is unlocked for the current round

## Game Mechanics

### Rounds
- Each round lasts 3 minutes
- Players hire agents during the round
- Agents auto-trade based on their strategies
- PnL is calculated at round end

### Agents

| Agent | Strategy | Cost | Best In |
|-------|----------|------|---------|
| Bullish Bob | Long on dips | 0.1 MOVE | Bull markets |
| Bearish Ben | Short on pumps | 0.1 MOVE | Bear markets |
| Crab Carol | Range trading | 0.05 MOVE | Sideways markets |

### Boosts
- Mid-round power-ups for 0.05 MOVE
- Increases agent trading power by 20%

## Contract Addresses

- **Arena Contract**: `0xBEEF` (Update after deployment)
- **Network**: Movement Bardock Testnet

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/hire/bull` | GET | Hire Bullish Bob (x402) |
| `/api/hire/bear` | GET | Hire Bearish Ben (x402) |
| `/api/hire/crab` | GET | Hire Crab Carol (x402) |
| `/api/boost` | GET | Boost an agent (x402) |
| `/api/game-state` | GET | Current game state |
| `/api/leaderboard` | GET | Top players |

## WebSocket Events

| Event | Direction | Description |
|-------|-----------|-------------|
| `game-state` | Server -> Client | Initial state on connect |
| `price-update` | Server -> Client | New price candle |
| `player-update` | Server -> Client | Player PnL update |
| `round-started` | Server -> Client | New round begins |
| `round-ended` | Server -> Client | Round results |
| `join-game` | Client -> Server | Player joins |
| `agent-hired` | Client -> Server | Agent hire confirmed |

## Hackathon Categories

- **Best Gaming App**: Fun, engaging gameplay with DeFi education
- **Best x402 App**: Novel use of x402 for agent hiring
- **Best New DeFi App**: Live trading simulation with PnL
- **Best App Using Privy**: Seamless wallet onboarding

## License

MIT

## Links

- [Movement Network](https://movementnetwork.xyz)
- [x402 Protocol](https://x402.org)
- [Pyth Network](https://pyth.network)
- [Privy](https://privy.io)
