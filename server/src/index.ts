import express from "express";
import cors from "cors";
import { createServer } from "http";
import { Server as SocketServer } from "socket.io";
import { x402Paywall } from "x402plus";
import { HermesClient } from "@pythnetwork/hermes-client";
import { Aptos, AptosConfig, Network } from "@aptos-labs/ts-sdk";
import "dotenv/config";

const app = express();
const httpServer = createServer(app);
const io = new SocketServer(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST"],
  },
});

const PORT = process.env.PORT || 4402;

// Movement Network Configuration - Using Mainnet (testnet is down)
const MOVEMENT_RPC = process.env.MOVEMENT_RPC || "https://full.mainnet.movementinfra.xyz/v1";
const aptos = new Aptos(new AptosConfig({ network: Network.CUSTOM, fullnode: MOVEMENT_RPC }));

// Pyth Hermes Client for price feeds
const hermesClient = new HermesClient("https://hermes.pyth.network");

// Price feed IDs (Pyth) - All available trading pairs
// Using Stable Price Feed IDs from https://pyth.network/developers/price-feed-ids
const PRICE_FEEDS: Record<string, { id: string; decimals: number; icon: string }> = {
  "BTC/USD": {
    id: "0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43",
    decimals: 8,
    icon: "₿"
  },
  "ETH/USD": {
    id: "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace",
    decimals: 8,
    icon: "Ξ"
  },
  "SOL/USD": {
    id: "0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d",
    decimals: 8,
    icon: "◎"
  },
  "MOVE/USD": {
    id: "0x6bf748c908767baa762a1563d454ebec2d5108f8ee36d806aadacc8f0a075b6d",
    decimals: 8,
    icon: "M"
  },
  "DOGE/USD": {
    id: "0xdcef50dd0a4cd2dcc17e45df1676dcb336a11a61c69df7a0299b0150c672d25c",
    decimals: 8,
    icon: "Ð"
  },
  "AVAX/USD": {
    id: "0x93da3352f9f1d105fdfe4971cfa80e9dd777bfc5d0f683ebb6e1294b92137bb7",
    decimals: 8,
    icon: "A"
  },
};

// Available assets for voting
const AVAILABLE_ASSETS = Object.keys(PRICE_FEEDS);

// Game State
interface GameState {
  currentRoundId: number;
  roundStartTime: number;
  roundEndTime: number;
  isRoundActive: boolean;
  isVotingPhase: boolean;
  votingEndTime: number;
  currentAsset: string;
  assetVotes: Map<string, Set<string>>; // asset -> Set of voter addresses
  players: Map<string, PlayerState>;
  priceHistory: PriceCandle[];
  currentPrice: number;
  x402Transactions: Array<{ address: string; txHash: string; amount: string; timestamp: number }>;
}

interface PlayerState {
  address: string;
  hiredAgents: AgentState[];
  pnl: number;
  startingCapital: number;
}

interface AgentState {
  type: "BULL" | "BEAR" | "CRAB";
  name: string;
  power: number;
  isBoosted: boolean;
  position: Position | null;
  trades: Trade[];
}

interface Position {
  type: "LONG" | "SHORT";
  entryPrice: number;
  size: number;
  timestamp: number;
}

interface Trade {
  type: "LONG" | "SHORT";
  entryPrice: number;
  exitPrice: number;
  pnl: number;
  timestamp: number;
}

interface PriceCandle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

// Initialize game state
const gameState: GameState = {
  currentRoundId: 0,
  roundStartTime: 0,
  roundEndTime: 0,
  isRoundActive: false,
  isVotingPhase: false,
  votingEndTime: 0,
  currentAsset: "BTC/USD",
  assetVotes: new Map(),
  players: new Map(),
  priceHistory: [],
  currentPrice: 0,
  x402Transactions: [],
};

// Agent hiring tokens (JWT-like access tokens)
const accessTokens = new Map<string, { agentType: string; expiresAt: number }>();

// Treasury address for payments (your mainnet wallet)
const TREASURY_ADDRESS = process.env.MOVEMENT_PAY_TO || "0x8fe3cb1e702d46b0540757dcdbe0a1ea2d9d21ccca16bdd63910d0783d2c3288";

// ==================
// x402 Paywall Setup
// ==================
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  exposedHeaders: ["X-PAYMENT-RESPONSE"],
}));

app.use(express.json());

// x402 protected routes for agent hiring
app.use(
  x402Paywall(
    TREASURY_ADDRESS,
    {
      "GET /api/hire/bull": {
        network: "movement",
        asset: "0x1::aptos_coin::AptosCoin",
        maxAmountRequired: "100000", // 0.001 MOVE (minimal mainnet testing)
        description: "Hire Bullish Bob for current round",
        mimeType: "application/json",
        maxTimeoutSeconds: 600,
      },
      "GET /api/hire/bear": {
        network: "movement",
        asset: "0x1::aptos_coin::AptosCoin",
        maxAmountRequired: "100000", // 0.001 MOVE (minimal mainnet testing)
        description: "Hire Bearish Ben for current round",
        mimeType: "application/json",
        maxTimeoutSeconds: 600,
      },
      "GET /api/hire/crab": {
        network: "movement",
        asset: "0x1::aptos_coin::AptosCoin",
        maxAmountRequired: "100000", // 0.001 MOVE (minimal mainnet testing)
        description: "Hire Crab Carol for current round",
        mimeType: "application/json",
        maxTimeoutSeconds: 600,
      },
      "GET /api/boost": {
        network: "movement",
        asset: "0x1::aptos_coin::AptosCoin",
        maxAmountRequired: "50000", // 0.0005 MOVE (minimal mainnet testing)
        description: "Boost an active agent",
        mimeType: "application/json",
        maxTimeoutSeconds: 600,
      },
    },
    {
      url: process.env.FACILITATOR_URL || "https://facilitator.stableyard.fi",
    }
  )
);

// ==================
// API Routes
// ==================

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok", roundActive: gameState.isRoundActive });
});

// Get current game state
app.get("/api/game-state", (_req, res) => {
  res.json({
    currentRoundId: gameState.currentRoundId,
    roundStartTime: gameState.roundStartTime,
    roundEndTime: gameState.roundEndTime,
    isRoundActive: gameState.isRoundActive,
    currentPrice: gameState.currentPrice,
    priceHistory: gameState.priceHistory.slice(-60), // Last 60 candles
    playerCount: gameState.players.size,
  });
});

// Hire agent endpoints (x402 protected)
app.get("/api/hire/bull", (req, res) => {
  const playerAddress = req.headers["x-player-address"] as string;
  if (!playerAddress) {
    return res.status(400).json({ error: "Missing player address" });
  }

  const token = generateAccessToken(playerAddress, "BULL");
  res.json({
    success: true,
    agentType: "BULL",
    agentName: "Bullish Bob",
    accessToken: token,
    expiresIn: 180, // 3 minutes
  });
});

app.get("/api/hire/bear", (req, res) => {
  const playerAddress = req.headers["x-player-address"] as string;
  if (!playerAddress) {
    return res.status(400).json({ error: "Missing player address" });
  }

  const token = generateAccessToken(playerAddress, "BEAR");
  res.json({
    success: true,
    agentType: "BEAR",
    agentName: "Bearish Ben",
    accessToken: token,
    expiresIn: 180,
  });
});

app.get("/api/hire/crab", (req, res) => {
  const playerAddress = req.headers["x-player-address"] as string;
  if (!playerAddress) {
    return res.status(400).json({ error: "Missing player address" });
  }

  const token = generateAccessToken(playerAddress, "CRAB");
  res.json({
    success: true,
    agentType: "CRAB",
    agentName: "Crab Carol",
    accessToken: token,
    expiresIn: 180,
  });
});

// Boost agent endpoint (x402 protected)
app.get("/api/boost", (req, res) => {
  const playerAddress = req.headers["x-player-address"] as string;
  const agentType = req.query.agent as string;

  if (!playerAddress || !agentType) {
    return res.status(400).json({ error: "Missing player address or agent type" });
  }

  const player = gameState.players.get(playerAddress);
  if (!player) {
    return res.status(404).json({ error: "Player not found" });
  }

  const agent = player.hiredAgents.find((a) => a.type === agentType);
  if (!agent) {
    return res.status(404).json({ error: "Agent not hired" });
  }

  agent.isBoosted = true;
  agent.power += 20;

  res.json({
    success: true,
    agentType,
    newPower: agent.power,
  });
});

// Get leaderboard
app.get("/api/leaderboard", (_req, res) => {
  const entries = Array.from(gameState.players.values())
    .map((p) => ({
      address: p.address,
      pnl: p.pnl,
      agentCount: p.hiredAgents.length,
    }))
    .sort((a, b) => b.pnl - a.pnl)
    .slice(0, 10);

  res.json({ leaderboard: entries });
});

// Get price history
app.get("/api/prices", (_req, res) => {
  res.json({
    currentPrice: gameState.currentPrice,
    history: gameState.priceHistory,
  });
});

// ==================
// Helper Functions
// ==================

function generateAccessToken(playerAddress: string, agentType: string): string {
  const token = `${playerAddress}_${agentType}_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  accessTokens.set(token, {
    agentType,
    expiresAt: Date.now() + 180000, // 3 minutes
  });
  return token;
}

// ==================
// Price Feed
// ==================

async function fetchPythPrice(asset?: string): Promise<number> {
  const targetAsset = asset || gameState.currentAsset;
  const feedInfo = PRICE_FEEDS[targetAsset];

  if (!feedInfo) {
    console.error(`Unknown asset: ${targetAsset}`);
    return gameState.currentPrice || 95000;
  }

  try {
    const priceUpdates = await hermesClient.getLatestPriceUpdates([feedInfo.id]);
    if (priceUpdates.parsed && priceUpdates.parsed.length > 0) {
      const priceData = priceUpdates.parsed[0].price;
      // Pyth prices have an exponent, typically -8
      const price = Number(priceData.price) * Math.pow(10, priceData.expo);
      return price;
    }
  } catch (error) {
    console.error(`Error fetching Pyth price for ${targetAsset}:`, error);
  }
  // Fallback to simulated price
  return gameState.currentPrice || 95000;
}

// Determine winning asset from votes
function getWinningAsset(): string {
  let maxVotes = 0;
  let winner = "BTC/USD";

  gameState.assetVotes.forEach((voters, asset) => {
    if (voters.size > maxVotes) {
      maxVotes = voters.size;
      winner = asset;
    }
  });

  // If no votes, pick random
  if (maxVotes === 0) {
    const assets = Object.keys(PRICE_FEEDS);
    winner = assets[Math.floor(Math.random() * assets.length)];
  }

  return winner;
}

// ==================
// Game Loop
// ==================

async function gameLoop() {
  // Fetch current price
  const newPrice = await fetchPythPrice();
  const now = Date.now();

  // Create candle
  const lastCandle = gameState.priceHistory[gameState.priceHistory.length - 1];
  const candle: PriceCandle = {
    timestamp: now,
    open: lastCandle?.close || newPrice,
    high: Math.max(lastCandle?.close || newPrice, newPrice),
    low: Math.min(lastCandle?.close || newPrice, newPrice),
    close: newPrice,
  };

  gameState.currentPrice = newPrice;
  gameState.priceHistory.push(candle);

  // Keep only last 200 candles
  if (gameState.priceHistory.length > 200) {
    gameState.priceHistory = gameState.priceHistory.slice(-200);
  }

  // Process agent trading logic
  if (gameState.isRoundActive) {
    processAgentTrades(candle);
  }

  // Broadcast to connected clients
  io.emit("price-update", {
    price: newPrice,
    candle,
    timestamp: now,
    asset: gameState.currentAsset,
    assetIcon: PRICE_FEEDS[gameState.currentAsset]?.icon || "₿",
  });

  // Check if round should end
  if (gameState.isRoundActive && now >= gameState.roundEndTime) {
    endRound();
  }
}

function processAgentTrades(candle: PriceCandle) {
  const priceChange = candle.close - candle.open;
  const priceChangePercent = (priceChange / candle.open) * 100;
  const now = Date.now();

  gameState.players.forEach((player, address) => {
    player.hiredAgents.forEach((agent) => {
      const positionAge = agent.position ? now - agent.position.timestamp : 0;
      const positionAgeSeconds = positionAge / 1000;

      // Calculate unrealized PnL for open positions
      let unrealizedPnl = 0;
      if (agent.position) {
        unrealizedPnl = agent.position.type === "LONG"
          ? (candle.close - agent.position.entryPrice) * agent.position.size / agent.position.entryPrice
          : (agent.position.entryPrice - candle.close) * agent.position.size / agent.position.entryPrice;
      }

      if (agent.type === "BULL") {
        // Bullish Bob: Aggressive long trader, buys often, holds for gains
        if (!agent.position) {
          // Open long when price dips OR randomly with 15% chance
          if (priceChangePercent < -0.005 || Math.random() < 0.15) {
            agent.position = {
              type: "LONG",
              entryPrice: candle.close,
              size: 1000 * (agent.power / 100) * (agent.isBoosted ? 1.5 : 1),
              timestamp: now,
            };
            console.log(`[BULL] ${player.address.slice(0,8)} opened LONG at $${candle.close.toFixed(2)}`);
          }
        } else {
          // Close position: take profit at +0.01%, stop loss at -0.02%, or after 15 seconds
          const profitPercent = (unrealizedPnl / agent.position.size) * 100;
          if (profitPercent > 0.01 || profitPercent < -0.02 || positionAgeSeconds > 15) {
            agent.trades.push({
              type: "LONG",
              entryPrice: agent.position.entryPrice,
              exitPrice: candle.close,
              pnl: unrealizedPnl,
              timestamp: now,
            });
            player.pnl += unrealizedPnl;
            console.log(`[BULL] ${player.address.slice(0,8)} closed LONG: PnL $${unrealizedPnl.toFixed(2)}`);
            agent.position = null;
          }
        }
      } else if (agent.type === "BEAR") {
        // Bearish Ben: Aggressive short trader
        if (!agent.position) {
          // Open short when price pumps OR randomly with 15% chance
          if (priceChangePercent > 0.005 || Math.random() < 0.15) {
            agent.position = {
              type: "SHORT",
              entryPrice: candle.close,
              size: 1000 * (agent.power / 100) * (agent.isBoosted ? 1.5 : 1),
              timestamp: now,
            };
            console.log(`[BEAR] ${player.address.slice(0,8)} opened SHORT at $${candle.close.toFixed(2)}`);
          }
        } else {
          // Close position: take profit, stop loss, or time-based
          const profitPercent = (unrealizedPnl / agent.position.size) * 100;
          if (profitPercent > 0.01 || profitPercent < -0.02 || positionAgeSeconds > 15) {
            agent.trades.push({
              type: "SHORT",
              entryPrice: agent.position.entryPrice,
              exitPrice: candle.close,
              pnl: unrealizedPnl,
              timestamp: now,
            });
            player.pnl += unrealizedPnl;
            console.log(`[BEAR] ${player.address.slice(0,8)} closed SHORT: PnL $${unrealizedPnl.toFixed(2)}`);
            agent.position = null;
          }
        }
      } else if (agent.type === "CRAB") {
        // Crab Carol: Mean reversion scalper, trades frequently
        if (!agent.position) {
          // Trade on any small movement OR randomly with 20% chance
          if (Math.abs(priceChangePercent) > 0.002 || Math.random() < 0.2) {
            // Mean reversion: short if price went up, long if price went down
            agent.position = {
              type: priceChangePercent > 0 ? "SHORT" : "LONG",
              entryPrice: candle.close,
              size: 500 * (agent.power / 100) * (agent.isBoosted ? 1.5 : 1),
              timestamp: now,
            };
            console.log(`[CRAB] ${player.address.slice(0,8)} opened ${agent.position.type} at $${candle.close.toFixed(2)}`);
          }
        } else {
          // Quick scalps: close after small profit or 10 seconds
          const profitPercent = (unrealizedPnl / agent.position.size) * 100;
          if (profitPercent > 0.005 || profitPercent < -0.01 || positionAgeSeconds > 10) {
            agent.trades.push({
              type: agent.position.type,
              entryPrice: agent.position.entryPrice,
              exitPrice: candle.close,
              pnl: unrealizedPnl,
              timestamp: now,
            });
            player.pnl += unrealizedPnl;
            console.log(`[CRAB] ${player.address.slice(0,8)} closed ${agent.position.type}: PnL $${unrealizedPnl.toFixed(2)}`);
            agent.position = null;
          }
        }
      }
    });

    // Broadcast player update
    io.to(address).emit("player-update", {
      address,
      pnl: player.pnl,
      agents: player.hiredAgents.map((a) => ({
        type: a.type,
        name: a.name,
        power: a.power,
        isBoosted: a.isBoosted,
        position: a.position,
        tradeCount: a.trades.length,
        totalPnl: a.trades.reduce((sum, t) => sum + t.pnl, 0),
      })),
    });
  });
}

function startVotingPhase() {
  gameState.isVotingPhase = true;
  gameState.votingEndTime = Date.now() + 15000; // 15 seconds to vote
  gameState.assetVotes = new Map();

  // Initialize votes for all assets
  AVAILABLE_ASSETS.forEach(asset => {
    gameState.assetVotes.set(asset, new Set());
  });

  io.emit("voting-started", {
    assets: AVAILABLE_ASSETS.map(a => ({
      symbol: a,
      icon: PRICE_FEEDS[a].icon,
    })),
    votingEndTime: gameState.votingEndTime,
  });

  console.log("Voting phase started - players choose next asset");

  // End voting after 15 seconds
  setTimeout(() => {
    endVotingPhase();
  }, 15000);
}

function endVotingPhase() {
  gameState.isVotingPhase = false;
  const winningAsset = getWinningAsset();
  gameState.currentAsset = winningAsset;
  gameState.priceHistory = []; // Clear history for new asset

  const voteResults: Record<string, number> = {};
  gameState.assetVotes.forEach((voters, asset) => {
    voteResults[asset] = voters.size;
  });

  io.emit("voting-ended", {
    winningAsset,
    voteResults,
    icon: PRICE_FEEDS[winningAsset].icon,
  });

  console.log(`Voting ended - ${winningAsset} selected with icon ${PRICE_FEEDS[winningAsset].icon}`);

  // Start round immediately after voting
  startRound();
}

function startRound() {
  gameState.currentRoundId++;
  gameState.roundStartTime = Date.now();
  gameState.roundEndTime = Date.now() + 180000; // 3 minutes
  gameState.isRoundActive = true;

  io.emit("round-started", {
    roundId: gameState.currentRoundId,
    startTime: gameState.roundStartTime,
    endTime: gameState.roundEndTime,
    asset: gameState.currentAsset,
    assetIcon: PRICE_FEEDS[gameState.currentAsset].icon,
  });

  console.log(`Round ${gameState.currentRoundId} started on ${gameState.currentAsset}`);
}

function endRound() {
  gameState.isRoundActive = false;

  // Close all open positions
  gameState.players.forEach((player) => {
    player.hiredAgents.forEach((agent) => {
      if (agent.position) {
        const pnl = agent.position.type === "LONG"
          ? (gameState.currentPrice - agent.position.entryPrice) * agent.position.size / agent.position.entryPrice
          : (agent.position.entryPrice - gameState.currentPrice) * agent.position.size / agent.position.entryPrice;
        player.pnl += pnl;
        agent.position = null;
      }
    });
  });

  // Calculate winners
  const rankings = Array.from(gameState.players.entries())
    .map(([address, player]) => ({ address, pnl: player.pnl }))
    .sort((a, b) => b.pnl - a.pnl);

  io.emit("round-ended", {
    roundId: gameState.currentRoundId,
    rankings,
    winner: rankings[0] || null,
  });

  console.log(`Round ${gameState.currentRoundId} ended. Winner: ${rankings[0]?.address || "none"}`);

  // Clear player agents and start voting phase after 5 seconds
  setTimeout(() => {
    gameState.players.forEach((player) => {
      player.hiredAgents = [];
    });
    startVotingPhase();
  }, 5000);
}

// ==================
// WebSocket Events
// ==================

io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

  // Send current game state on connect
  socket.emit("game-state", {
    currentRoundId: gameState.currentRoundId,
    roundStartTime: gameState.roundStartTime,
    roundEndTime: gameState.roundEndTime,
    isRoundActive: gameState.isRoundActive,
    isVotingPhase: gameState.isVotingPhase,
    votingEndTime: gameState.votingEndTime,
    currentAsset: gameState.currentAsset,
    assetIcon: PRICE_FEEDS[gameState.currentAsset]?.icon || "₿",
    availableAssets: AVAILABLE_ASSETS.map(a => ({
      symbol: a,
      icon: PRICE_FEEDS[a].icon,
    })),
    currentPrice: gameState.currentPrice,
    priceHistory: gameState.priceHistory.slice(-60),
    x402Transactions: gameState.x402Transactions.slice(-10), // Last 10 transactions
  });

  // Player joins with their wallet address
  socket.on("join-game", (data: { address: string }) => {
    const { address } = data;
    socket.join(address);

    if (!gameState.players.has(address)) {
      gameState.players.set(address, {
        address,
        hiredAgents: [],
        pnl: 0,
        startingCapital: 1000,
      });
    }

    socket.emit("joined", { address, player: gameState.players.get(address) });
    console.log(`Player joined: ${address}`);
  });

  // Player hires an agent (after x402 payment)
  socket.on("agent-hired", (data: { address: string; agentType: string; accessToken: string }) => {
    const { address, agentType, accessToken } = data;

    // Verify access token
    const tokenData = accessTokens.get(accessToken);
    if (!tokenData || tokenData.expiresAt < Date.now()) {
      socket.emit("error", { message: "Invalid or expired access token" });
      return;
    }

    const player = gameState.players.get(address);
    if (!player) {
      socket.emit("error", { message: "Player not found" });
      return;
    }

    // Check if agent already hired
    if (player.hiredAgents.some((a) => a.type === agentType)) {
      socket.emit("error", { message: "Agent already hired" });
      return;
    }

    const agent: AgentState = {
      type: agentType as "BULL" | "BEAR" | "CRAB",
      name: agentType === "BULL" ? "Bullish Bob" : agentType === "BEAR" ? "Bearish Ben" : "Crab Carol",
      power: agentType === "CRAB" ? 80 : 100,
      isBoosted: false,
      position: null,
      trades: [],
    };

    player.hiredAgents.push(agent);
    accessTokens.delete(accessToken);

    socket.emit("agent-confirmed", { agent });
    io.emit("player-count", { count: gameState.players.size });
  });

  // Vote for next round's asset
  socket.on("vote-asset", (data: { address: string; asset: string }) => {
    const { address, asset } = data;

    if (!gameState.isVotingPhase) {
      socket.emit("error", { message: "Voting is not active" });
      return;
    }

    if (!AVAILABLE_ASSETS.includes(asset)) {
      socket.emit("error", { message: "Invalid asset" });
      return;
    }

    // Remove previous vote from other assets
    gameState.assetVotes.forEach((voters, _) => {
      voters.delete(address);
    });

    // Add vote to selected asset
    const voters = gameState.assetVotes.get(asset) || new Set();
    voters.add(address);
    gameState.assetVotes.set(asset, voters);

    // Broadcast updated vote counts
    const voteResults: Record<string, number> = {};
    gameState.assetVotes.forEach((voters, asset) => {
      voteResults[asset] = voters.size;
    });

    io.emit("vote-update", { voteResults, voterAddress: address, votedAsset: asset });
    console.log(`${address.slice(0, 8)} voted for ${asset}`);
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
  });
});

// ==================
// Start Server
// ==================

// API endpoint to get available assets
app.get("/api/assets", (_req, res) => {
  res.json({
    assets: AVAILABLE_ASSETS.map(a => ({
      symbol: a,
      icon: PRICE_FEEDS[a].icon,
    })),
    currentAsset: gameState.currentAsset,
  });
});

// API endpoint to get x402 transaction proof
app.get("/api/x402-transactions", (_req, res) => {
  res.json({
    transactions: gameState.x402Transactions,
    treasuryAddress: TREASURY_ADDRESS,
  });
});

httpServer.listen(PORT, async () => {
  console.log(`AlgoArena server running at http://localhost:${PORT}`);
  console.log(`Treasury address: ${TREASURY_ADDRESS}`);
  console.log(`Available assets: ${AVAILABLE_ASSETS.join(", ")}`);

  // Initialize price
  gameState.currentPrice = await fetchPythPrice();
  console.log(`Initial ${gameState.currentAsset} price: $${gameState.currentPrice.toFixed(2)}`);

  // Start game loop (every 1 second)
  setInterval(gameLoop, 1000);

  // Start with voting phase after 5 seconds
  setTimeout(startVotingPhase, 5000);
});
