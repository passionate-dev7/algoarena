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

export interface AssetInfo {
  symbol: string;
  icon: string;
}

export interface GameState {
  currentRoundId: number;
  roundStartTime: number;
  roundEndTime: number;
  isRoundActive: boolean;
  isVotingPhase: boolean;
  votingEndTime: number;
  currentAsset: string;
  assetIcon: string;
  availableAssets: AssetInfo[];
  currentPrice: number;
  priceHistory: PriceCandle[];
}

export interface RoundResult {
  roundId: number;
  rankings: { address: string; pnl: number }[];
  winner: { address: string; pnl: number } | null;
}

export interface VoteResults {
  [asset: string]: number;
}

export function useGameSocket(playerAddress: string | undefined) {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [currentPrice, setCurrentPrice] = useState(0);
  const [currentAsset, setCurrentAsset] = useState("BTC/USD");
  const [assetIcon, setAssetIcon] = useState("₿");
  const [priceHistory, setPriceHistory] = useState<PriceCandle[]>([]);
  const [playerState, setPlayerState] = useState<PlayerUpdate | null>(null);
  const [roundResult, setRoundResult] = useState<RoundResult | null>(null);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [isVotingPhase, setIsVotingPhase] = useState(false);
  const [votingTimeRemaining, setVotingTimeRemaining] = useState(0);
  const [availableAssets, setAvailableAssets] = useState<AssetInfo[]>([]);
  const [voteResults, setVoteResults] = useState<VoteResults>({});
  const [myVote, setMyVote] = useState<string | null>(null);
  const [roundStartPrice, setRoundStartPrice] = useState<number | null>(null);
  const currentRoundIdRef = useRef<number>(0);

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
      setCurrentAsset(state.currentAsset || "BTC/USD");
      setAssetIcon(state.assetIcon || "₿");
      setPriceHistory(state.priceHistory);
      setAvailableAssets(state.availableAssets || []);
      setIsVotingPhase(state.isVotingPhase || false);

      // Track round changes and reset start price for new rounds
      if (state.currentRoundId !== currentRoundIdRef.current) {
        currentRoundIdRef.current = state.currentRoundId;
        // Set start price from first candle if available, otherwise reset
        if (state.priceHistory && state.priceHistory.length > 0) {
          setRoundStartPrice(state.priceHistory[0].open);
        } else {
          setRoundStartPrice(null);
        }
      }
    });

    socket.on("price-update", (data: { price: number; candle: PriceCandle; asset: string; assetIcon: string }) => {
      setCurrentPrice(data.price);
      setCurrentAsset(data.asset || "BTC/USD");
      setAssetIcon(data.assetIcon || "₿");
      setPriceHistory((prev) => {
        const updated = [...prev, data.candle];
        // Capture starting price from first candle of the round
        if (prev.length === 0 && data.candle) {
          setRoundStartPrice(data.candle.open);
        }
        return updated.slice(-60);
      });
    });

    socket.on("player-update", (data: PlayerUpdate) => {
      setPlayerState(data);
    });

    socket.on("round-started", (data: { roundId: number; startTime: number; endTime: number; asset: string; assetIcon: string }) => {
      console.log(`Round ${data.roundId} started on ${data.asset}`);
      currentRoundIdRef.current = data.roundId;
      setCurrentAsset(data.asset);
      setAssetIcon(data.assetIcon);
      setIsVotingPhase(false);
      setPriceHistory([]); // Clear for new asset
      setRoundStartPrice(null); // Will be set from first price update
      setGameState((prev) =>
        prev
          ? {
              ...prev,
              currentRoundId: data.roundId,
              roundStartTime: data.startTime,
              roundEndTime: data.endTime,
              isRoundActive: true,
              isVotingPhase: false,
              currentAsset: data.asset,
              assetIcon: data.assetIcon,
            }
          : null
      );
      setRoundResult(null);
      setMyVote(null);
    });

    socket.on("round-ended", (result: RoundResult) => {
      setRoundResult(result);
      setGameState((prev) => (prev ? { ...prev, isRoundActive: false } : null));
    });

    socket.on("voting-started", (data: { assets: AssetInfo[]; votingEndTime: number }) => {
      setIsVotingPhase(true);
      setAvailableAssets(data.assets);
      setVoteResults({});
      setRoundStartPrice(null); // Clear start price during voting phase
      setPriceHistory([]); // Clear price history for new asset selection
      setGameState((prev) => (prev ? { ...prev, isVotingPhase: true, votingEndTime: data.votingEndTime } : null));
    });

    socket.on("voting-ended", (data: { winningAsset: string; voteResults: VoteResults; icon: string }) => {
      setIsVotingPhase(false);
      setCurrentAsset(data.winningAsset);
      setAssetIcon(data.icon);
    });

    socket.on("vote-update", (data: { voteResults: VoteResults; voterAddress: string; votedAsset: string }) => {
      setVoteResults(data.voteResults);
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

  // Update time remaining for round
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

  // Update voting time remaining
  useEffect(() => {
    if (!isVotingPhase || !gameState?.votingEndTime) {
      setVotingTimeRemaining(0);
      return;
    }

    const interval = setInterval(() => {
      const remaining = Math.max(0, gameState.votingEndTime - Date.now());
      setVotingTimeRemaining(Math.floor(remaining / 1000));
    }, 100);

    return () => clearInterval(interval);
  }, [isVotingPhase, gameState?.votingEndTime]);

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

  const voteForAsset = useCallback(
    (asset: string) => {
      if (socketRef.current && playerAddress && isVotingPhase) {
        socketRef.current.emit("vote-asset", {
          address: playerAddress,
          asset,
        });
        setMyVote(asset);
      }
    },
    [playerAddress, isVotingPhase]
  );

  return {
    isConnected,
    gameState,
    currentPrice,
    currentAsset,
    assetIcon,
    priceHistory,
    playerState,
    roundResult,
    timeRemaining,
    isVotingPhase,
    votingTimeRemaining,
    availableAssets,
    voteResults,
    myVote,
    roundStartPrice,
    notifyAgentHired,
    voteForAsset,
  };
}
