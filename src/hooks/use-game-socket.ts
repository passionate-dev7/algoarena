import { useEffect, useState, useCallback, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { SERVER_URL } from "@/lib/aptos";

export interface PriceCandle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface AgentInfo {
  type: "BULL" | "BEAR" | "CRAB";
  name: string;
  power: number;
  isBoosted: boolean;
  position: {
    type: "LONG" | "SHORT";
    entryPrice: number;
    size: number;
  } | null;
  tradeCount: number;
  totalPnl: number;
}

export interface PlayerUpdate {
  address: string;
  pnl: number;
  agents: AgentInfo[];
}

export interface GameState {
  currentRoundId: number;
  roundStartTime: number;
  roundEndTime: number;
  isRoundActive: boolean;
  currentPrice: number;
  priceHistory: PriceCandle[];
}

export interface RoundResult {
  roundId: number;
  rankings: { address: string; pnl: number }[];
  winner: { address: string; pnl: number } | null;
}

export function useGameSocket(playerAddress: string | undefined) {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [currentPrice, setCurrentPrice] = useState(0);
  const [priceHistory, setPriceHistory] = useState<PriceCandle[]>([]);
  const [playerState, setPlayerState] = useState<PlayerUpdate | null>(null);
  const [roundResult, setRoundResult] = useState<RoundResult | null>(null);
  const [timeRemaining, setTimeRemaining] = useState(0);

  useEffect(() => {
    const socket = io(SERVER_URL, {
      transports: ["websocket", "polling"],
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("Connected to game server");
      setIsConnected(true);
    });

    socket.on("disconnect", () => {
      console.log("Disconnected from game server");
      setIsConnected(false);
    });

    socket.on("game-state", (state: GameState) => {
      setGameState(state);
      setCurrentPrice(state.currentPrice);
      setPriceHistory(state.priceHistory);
    });

    socket.on("price-update", (data: { price: number; candle: PriceCandle }) => {
      setCurrentPrice(data.price);
      setPriceHistory((prev) => {
        const updated = [...prev, data.candle];
        return updated.slice(-60); // Keep last 60 candles
      });
    });

    socket.on("player-update", (data: PlayerUpdate) => {
      setPlayerState(data);
    });

    socket.on("round-started", (data: { roundId: number; startTime: number; endTime: number }) => {
      setGameState((prev) =>
        prev
          ? {
              ...prev,
              currentRoundId: data.roundId,
              roundStartTime: data.startTime,
              roundEndTime: data.endTime,
              isRoundActive: true,
            }
          : null
      );
      setRoundResult(null);
    });

    socket.on("round-ended", (result: RoundResult) => {
      setRoundResult(result);
      setGameState((prev) => (prev ? { ...prev, isRoundActive: false } : null));
    });

    socket.on("agent-confirmed", (data: { agent: AgentInfo }) => {
      console.log("Agent confirmed:", data.agent);
    });

    socket.on("error", (error: { message: string }) => {
      console.error("Socket error:", error.message);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  // Join game when player address is available
  useEffect(() => {
    if (playerAddress && socketRef.current?.connected) {
      socketRef.current.emit("join-game", { address: playerAddress });
    }
  }, [playerAddress, isConnected]);

  // Update time remaining
  useEffect(() => {
    if (!gameState?.isRoundActive || !gameState.roundEndTime) {
      setTimeRemaining(0);
      return;
    }

    const interval = setInterval(() => {
      const remaining = Math.max(0, gameState.roundEndTime - Date.now());
      setTimeRemaining(Math.floor(remaining / 1000));
    }, 100);

    return () => clearInterval(interval);
  }, [gameState?.isRoundActive, gameState?.roundEndTime]);

  const notifyAgentHired = useCallback(
    (agentType: string, accessToken: string) => {
      if (socketRef.current && playerAddress) {
        socketRef.current.emit("agent-hired", {
          address: playerAddress,
          agentType,
          accessToken,
        });
      }
    },
    [playerAddress]
  );

  return {
    isConnected,
    gameState,
    currentPrice,
    priceHistory,
    playerState,
    roundResult,
    timeRemaining,
    notifyAgentHired,
  };
}
