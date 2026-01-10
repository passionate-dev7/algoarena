"use client";

import { useState, useEffect, useCallback } from "react";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { usePrivy } from "@privy-io/react-auth";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  Coins,
  Wallet,
  LogOut,
  Volume2,
  VolumeX,
  Trophy,
  Zap,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { WalletModal } from "@/components/wallet-modal";
import { Arena } from "@/components/arena";
import { AgentCard } from "@/components/agent-card";
import { Leaderboard } from "@/components/leaderboard";
import { RoundTimer } from "@/components/round-timer";
import { RoundResultModal } from "@/components/round-result-modal";
import { useX402Payment } from "@/hooks/use-x402-payment";
import { useGameSocket } from "@/hooks/use-game-socket";
import { formatAddress, formatPnL } from "@/lib/utils";

const AGENTS = [
  {
    type: "BULL" as const,
    name: "Bullish Bob",
    description: "Buys dips, rides momentum. Profits when market pumps.",
    cost: 0.001,
  },
  {
    type: "BEAR" as const,
    name: "Bearish Ben",
    description: "Shorts pumps, covers on dips. Wins in down markets.",
    cost: 0.001,
  },
  {
    type: "CRAB" as const,
    name: "Crab Carol",
    description: "Range trades the chop. Consistent small gains.",
    cost: 0.001,
  },
];

export default function Home() {
  // Wallet state
  const { connected, account, disconnect } = useWallet();
  const { authenticated, logout: privyLogout, user } = usePrivy();
  const [showWalletModal, setShowWalletModal] = useState(false);

  // Get player address from either wallet source
  const playerAddress =
    account?.address?.toString() ||
    (user?.wallet?.address as string) ||
    undefined;

  // Game hooks
  const { hireAgent, boostAgent, isConnected: isWalletConnected } = useX402Payment();
  const {
    isConnected: isSocketConnected,
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
  } = useGameSocket(playerAddress);

  // Local UI state
  const [hiredAgents, setHiredAgents] = useState<Set<string>>(new Set());
  const [showResult, setShowResult] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Show result modal when round ends
  useEffect(() => {
    if (roundResult) {
      setShowResult(true);
    }
  }, [roundResult]);

  // Reset hired agents on new round
  useEffect(() => {
    if (gameState?.currentRoundId) {
      setHiredAgents(new Set());
    }
  }, [gameState?.currentRoundId]);

  // Update hired agents from player state
  useEffect(() => {
    if (playerState?.agents) {
      const types = new Set(playerState.agents.map((a) => a.type));
      setHiredAgents(types);
    }
  }, [playerState?.agents]);

  const handleHireAgent = useCallback(
    async (agentType: "BULL" | "BEAR" | "CRAB") => {
      if (!playerAddress) {
        setShowWalletModal(true);
        return;
      }

      const typeMap = {
        BULL: "bull" as const,
        BEAR: "bear" as const,
        CRAB: "crab" as const,
      };

      toast.loading(`Hiring ${agentType}...`, { id: `hire-${agentType}` });

      const result = await hireAgent(typeMap[agentType]);

      if (result.success && result.accessToken) {
        setHiredAgents((prev) => new Set(prev).add(agentType));
        notifyAgentHired(agentType, result.accessToken);
        toast.success(`${agentType} agent hired!`, { id: `hire-${agentType}` });
      } else {
        toast.error(result.error || "Failed to hire agent", {
          id: `hire-${agentType}`,
        });
      }
    },
    [playerAddress, hireAgent, notifyAgentHired]
  );

  const handleBoostAgent = useCallback(
    async (agentType: string) => {
      toast.loading(`Boosting ${agentType}...`, { id: `boost-${agentType}` });

      const result = await boostAgent(agentType);

      if (result.success) {
        toast.success(`${agentType} boosted!`, { id: `boost-${agentType}` });
      } else {
        toast.error(result.error || "Failed to boost", {
          id: `boost-${agentType}`,
        });
      }
    },
    [boostAgent]
  );

  const handleDisconnect = () => {
    if (connected) {
      disconnect();
    }
    if (authenticated) {
      privyLogout();
    }
  };

  const isLoggedIn = connected || authenticated;
  const totalPnl = playerState?.pnl || 0;

  return (
    <main className="min-h-screen bg-background text-foreground flex flex-col items-center p-4 overflow-hidden relative">
      {/* Background Grid */}
      <div
        className="absolute inset-0 z-0 opacity-10 pointer-events-none"
        style={{
          backgroundImage: "radial-gradient(#fff 1px, transparent 1px)",
          backgroundSize: "20px 20px",
        }}
      />

      {/* Header */}
      <header className="z-10 w-full max-w-6xl flex justify-between items-center mb-6 border-b-4 border-white pb-4">
        <motion.h1
          initial={{ x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          className="text-3xl md:text-4xl font-black uppercase italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary drop-shadow-[2px_2px_0_#fff]"
        >
          AlgoArena
        </motion.h1>

        <div className="flex items-center gap-3">
          {/* Sound toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSoundEnabled(!soundEnabled)}
          >
            {soundEnabled ? (
              <Volume2 className="w-5 h-5" />
            ) : (
              <VolumeX className="w-5 h-5" />
            )}
          </Button>

          {/* Connection status */}
          <div
            className={`w-2 h-2 rounded-full ${
              isSocketConnected ? "bg-green-500" : "bg-red-500"
            }`}
            title={isSocketConnected ? "Connected" : "Disconnected"}
          />

          {/* Wallet / User info */}
          {isLoggedIn ? (
            <div className="flex items-center gap-3 bg-card p-2 px-4 border-2 border-white">
              <div className="hidden md:block text-right">
                <div className="text-xs text-zinc-400">Balance</div>
                <div className="font-mono font-bold text-accent">
                  {formatPnL(totalPnl)}
                </div>
              </div>
              <div className="font-mono text-sm">
                {formatAddress(playerAddress || "")}
              </div>
              <Button variant="ghost" size="icon" onClick={handleDisconnect}>
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          ) : (
            <Button onClick={() => setShowWalletModal(true)}>
              <Wallet className="w-4 h-4" />
              Connect
            </Button>
          )}
        </div>
      </header>

      <div className="z-10 w-full max-w-6xl grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Main game area (3 cols) */}
        <div className="lg:col-span-3 space-y-6">
          {/* Voting Phase UI */}
          {isVotingPhase && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-gradient-to-r from-purple-900/50 to-pink-900/50 border-4 border-primary p-6"
            >
              <div className="text-center mb-4">
                <h2 className="text-2xl font-bold text-primary uppercase">
                  Vote for Next Asset
                </h2>
                <p className="text-zinc-400">
                  Time remaining: <span className="text-white font-mono">{votingTimeRemaining}s</span>
                </p>
              </div>
              <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
                {availableAssets.map((asset) => (
                  <button
                    key={asset.symbol}
                    onClick={() => voteForAsset(asset.symbol)}
                    className={`p-4 border-2 transition-all ${
                      myVote === asset.symbol
                        ? "border-primary bg-primary/20"
                        : "border-white/20 hover:border-white/50"
                    }`}
                  >
                    <div className="text-2xl mb-1">{asset.icon}</div>
                    <div className="text-xs font-mono">{asset.symbol.split("/")[0]}</div>
                    <div className="text-xs text-zinc-500 mt-1">
                      {voteResults[asset.symbol] || 0} votes
                    </div>
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {/* Round Timer */}
          <RoundTimer
            roundId={gameState?.currentRoundId || 0}
            timeRemaining={timeRemaining}
            isActive={gameState?.isRoundActive || false}
          />

          {/* Arena with Asset Label */}
          <Arena
            priceHistory={priceHistory}
            currentPrice={currentPrice}
            currentAsset={currentAsset}
            assetIcon={assetIcon}
            agents={playerState?.agents || []}
            isRoundActive={gameState?.isRoundActive || false}
            roundStartPrice={roundStartPrice}
          />

          {/* Player Stats */}
          {playerState && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-card border-4 border-white p-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  {/* Round Start Price */}
                  {roundStartPrice && (
                    <>
                      <div>
                        <div className="text-xs text-yellow-400 uppercase font-bold">
                          Round Start
                        </div>
                        <div className="font-mono text-xl font-bold text-yellow-400">
                          ${roundStartPrice.toFixed(2)}
                        </div>
                      </div>
                      <div className="h-10 w-px bg-white/20" />
                    </>
                  )}
                  <div>
                    <div className="text-xs text-zinc-400 uppercase">
                      Your PnL
                    </div>
                    <div
                      className={`font-mono text-2xl font-bold ${
                        totalPnl >= 0 ? "text-green-400" : "text-red-400"
                      }`}
                    >
                      {formatPnL(totalPnl)}
                    </div>
                  </div>
                  <div className="h-10 w-px bg-white/20" />
                  <div>
                    <div className="text-xs text-zinc-400 uppercase">
                      Active Agents
                    </div>
                    <div className="font-mono text-xl font-bold">
                      {playerState.agents.length}/3
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {playerState.agents.map((agent) => (
                    <div
                      key={agent.type}
                      className={`px-3 py-1 text-sm font-bold uppercase ${
                        agent.type === "BULL"
                          ? "bg-green-500 text-black"
                          : agent.type === "BEAR"
                          ? "bg-red-500 text-white"
                          : "bg-blue-500 text-white"
                      } ${agent.isBoosted ? "ring-2 ring-yellow-400" : ""}`}
                    >
                      {agent.name}
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {/* Agents Roster */}
          <div>
            <h2 className="text-xl font-bold uppercase mb-4 flex items-center gap-2">
              <Zap className="w-5 h-5 text-primary" />
              Hire Agents
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {AGENTS.map((agent) => {
                const isHired = hiredAgents.has(agent.type);
                const agentState = playerState?.agents.find(
                  (a) => a.type === agent.type
                );

                return (
                  <AgentCard
                    key={agent.type}
                    type={agent.type}
                    name={agent.name}
                    description={agent.description}
                    cost={agent.cost}
                    isHired={isHired}
                    agentState={agentState}
                    onHire={() => handleHireAgent(agent.type)}
                    onBoost={() => handleBoostAgent(agent.type)}
                    disabled={!isLoggedIn || !gameState?.isRoundActive}
                  />
                );
              })}
            </div>
          </div>
        </div>

        {/* Sidebar (1 col) */}
        <div className="space-y-6">
          {/* Leaderboard */}
          <div>
            <h2 className="text-xl font-bold uppercase mb-4 flex items-center gap-2">
              <Trophy className="w-5 h-5 text-yellow-400" />
              Leaderboard
            </h2>
            <Leaderboard currentPlayerAddress={playerAddress} />
          </div>

          {/* How to Play */}
          <div className="bg-card border-4 border-white p-4">
            <h3 className="text-lg font-bold uppercase mb-3 text-secondary">
              How to Play
            </h3>
            <ol className="space-y-2 text-sm text-zinc-400">
              <li className="flex gap-2">
                <span className="text-primary font-bold">1.</span>
                Connect your wallet
              </li>
              <li className="flex gap-2">
                <span className="text-primary font-bold">2.</span>
                Hire AI trading agents (0.001 MOVE each)
              </li>
              <li className="flex gap-2">
                <span className="text-primary font-bold">3.</span>
                Watch them battle on live BTC charts
              </li>
              <li className="flex gap-2">
                <span className="text-primary font-bold">4.</span>
                Boost agents mid-round for an edge
              </li>
              <li className="flex gap-2">
                <span className="text-primary font-bold">5.</span>
                Win points based on PnL!
              </li>
            </ol>
          </div>

          {/* Network info */}
          <div className="bg-black/50 border-2 border-white/20 p-3 text-center">
            <div className="text-xs text-zinc-500 uppercase">Network</div>
            <div className="text-sm font-mono text-secondary">
              Movement Mainnet
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="z-10 mt-8 text-center text-xs text-zinc-500">
        <p>
          AlgoArena - Built for Movement Encode M1 Hackathon
        </p>
        <p className="mt-1">
          Powered by x402 Protocol & Pyth Oracle
        </p>
      </footer>

      {/* Modals */}
      <WalletModal
        isOpen={showWalletModal}
        onClose={() => setShowWalletModal(false)}
      />

      <RoundResultModal
        result={showResult ? roundResult : null}
        currentPlayerAddress={playerAddress}
        onClose={() => setShowResult(false)}
      />
    </main>
  );
}
