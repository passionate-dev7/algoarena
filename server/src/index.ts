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

// Movement Network Configuration
const MOVEMENT_RPC = process.env.MOVEMENT_RPC || "https://testnet.movementnetwork.xyz/v1";
const aptos = new Aptos(new AptosConfig({ network: Network.CUSTOM, fullnode: MOVEMENT_RPC }));

// Pyth Hermes Client for price feeds
const hermesClient = new HermesClient("https://hermes.pyth.network");

// Price feed IDs (Pyth)
const PRICE_FEEDS = {
  "BTC/USD": "0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43",
  "ETH/USD": "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace",
  "SOL/USD": "0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d",
  "MOVE/USD": "0x44a93dddd8effa54ea51076c4e851b6cbbfd938e82eb90197de38fe8876bb66e",
};

// Game State
interface GameState {
  currentRoundId: number;
  roundStartTime: number;
  roundEndTime: number;
  isRoundActive: boolean;
  players: Map<string, PlayerState>;
  priceHistory: PriceCandle[];
  currentPrice: number;
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
  players: new Map(),
  priceHistory: [],
  currentPrice: 0,
};

// Agent hiring tokens (JWT-like access tokens)
const accessTokens = new Map<string, { agentType: string; expiresAt: number }>();

// Treasury address for payments
const TREASURY_ADDRESS = process.env.MOVEMENT_PAY_TO || "0x1";

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
        maxAmountRequired: "10000000", // 0.1 MOVE
        description: "Hire Bullish Bob for current round",
        mimeType: "application/json",
        maxTimeoutSeconds: 600,
      },
      "GET /api/hire/bear": {
        network: "movement",
        asset: "0x1::aptos_coin::AptosCoin",
        maxAmountRequired: "10000000", // 0.1 MOVE
        description: "Hire Bearish Ben for current round",
        mimeType: "application/json",
        maxTimeoutSeconds: 600,
      },
      "GET /api/hire/crab": {
        network: "movement",
        asset: "0x1::aptos_coin::AptosCoin",
        maxAmountRequired: "5000000", // 0.05 MOVE
        description: "Hire Crab Carol for current round",
        mimeType: "application/json",
        maxTimeoutSeconds: 600,
      },
      "GET /api/boost": {
        network: "movement",
        asset: "0x1::aptos_coin::AptosCoin",
        maxAmountRequired: "5000000", // 0.05 MOVE
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

async function fetchPythPrice(): Promise<number> {
  try {
    const priceUpdates = await hermesClient.getLatestPriceUpdates([PRICE_FEEDS["BTC/USD"]]);
    if (priceUpdates.parsed && priceUpdates.parsed.length > 0) {
      const priceData = priceUpdates.parsed[0].price;
      // Pyth prices have an exponent, typically -8
      const price = Number(priceData.price) * Math.pow(10, priceData.expo);
      return price;
    }
  } catch (error) {
    console.error("Error fetching Pyth price:", error);
  }
  // Fallback to simulated price
  return gameState.currentPrice || 95000;
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
  });

  // Check if round should end
  if (gameState.isRoundActive && now >= gameState.roundEndTime) {
    endRound();
  }
}

function processAgentTrades(candle: PriceCandle) {
  const priceChange = candle.close - candle.open;
  const priceChangePercent = (priceChange / candle.open) * 100;

  gameState.players.forEach((player, address) => {
    player.hiredAgents.forEach((agent) => {
      // Agent trading logic based on strategy
      const shouldTrade = Math.random() < 0.3; // 30% chance to trade per tick

      if (shouldTrade) {
        if (agent.type === "BULL") {
          // Bullish Bob: Buy dips, take profit on pumps
          if (priceChangePercent < -0.1 && !agent.position) {
            // Open long on dip
            agent.position = {
              type: "LONG",
              entryPrice: candle.close,
              size: 1000 * (agent.power / 100),
              timestamp: Date.now(),
            };
          } else if (priceChangePercent > 0.2 && agent.position?.type === "LONG") {
            // Take profit
            const pnl = (candle.close - agent.position.entryPrice) * agent.position.size / agent.position.entryPrice;
            agent.trades.push({
              type: "LONG",
              entryPrice: agent.position.entryPrice,
              exitPrice: candle.close,
              pnl,
              timestamp: Date.now(),
            });
            player.pnl += pnl;
            agent.position = null;
          }
        } else if (agent.type === "BEAR") {
          // Bearish Ben: Short pumps, cover on dips
          if (priceChangePercent > 0.1 && !agent.position) {
            // Open short on pump
            agent.position = {
              type: "SHORT",
              entryPrice: candle.close,
              size: 1000 * (agent.power / 100),
              timestamp: Date.now(),
            };
          } else if (priceChangePercent < -0.2 && agent.position?.type === "SHORT") {
            // Take profit
            const pnl = (agent.position.entryPrice - candle.close) * agent.position.size / agent.position.entryPrice;
            agent.trades.push({
              type: "SHORT",
              entryPrice: agent.position.entryPrice,
              exitPrice: candle.close,
              pnl,
              timestamp: Date.now(),
            });
            player.pnl += pnl;
            agent.position = null;
          }
        } else if (agent.type === "CRAB") {
          // Crab Carol: Range trading, small profits
          if (Math.abs(priceChangePercent) > 0.05 && !agent.position) {
            // Mean reversion trade
            agent.position = {
              type: priceChangePercent > 0 ? "SHORT" : "LONG",
              entryPrice: candle.close,
              size: 500 * (agent.power / 100),
              timestamp: Date.now(),
            };
          } else if (agent.position && Math.abs(priceChangePercent) < 0.02) {
            // Close on range
            const pnl = agent.position.type === "LONG"
              ? (candle.close - agent.position.entryPrice) * agent.position.size / agent.position.entryPrice
              : (agent.position.entryPrice - candle.close) * agent.position.size / agent.position.entryPrice;
            agent.trades.push({
              type: agent.position.type,
              entryPrice: agent.position.entryPrice,
              exitPrice: candle.close,
              pnl,
              timestamp: Date.now(),
            });
            player.pnl += pnl;
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

function startRound() {
  gameState.currentRoundId++;
  gameState.roundStartTime = Date.now();
  gameState.roundEndTime = Date.now() + 180000; // 3 minutes
  gameState.isRoundActive = true;

  io.emit("round-started", {
    roundId: gameState.currentRoundId,
    startTime: gameState.roundStartTime,
    endTime: gameState.roundEndTime,
  });

  console.log(`Round ${gameState.currentRoundId} started`);
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

  // Auto-start next round after 10 seconds
  setTimeout(() => {
    // Clear player agents for next round
    gameState.players.forEach((player) => {
      player.hiredAgents = [];
    });
    startRound();
  }, 10000);
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
    currentPrice: gameState.currentPrice,
    priceHistory: gameState.priceHistory.slice(-60),
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

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
  });
});

// ==================
// Start Server
// ==================

httpServer.listen(PORT, async () => {
  console.log(`AlgoArena server running at http://localhost:${PORT}`);
  console.log(`Treasury address: ${TREASURY_ADDRESS}`);

  // Initialize price
  gameState.currentPrice = await fetchPythPrice();
  console.log(`Initial BTC price: $${gameState.currentPrice.toFixed(2)}`);

  // Start game loop (every 1 second)
  setInterval(gameLoop, 1000);

  // Start first round after 5 seconds
  setTimeout(startRound, 5000);
});
