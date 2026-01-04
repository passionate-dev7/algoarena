"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  Zap,
  TrendingUp,
  TrendingDown,
  Shield,
  Loader2,
  Sparkles,
} from "lucide-react";
import { cn, formatPnL } from "@/lib/utils";
import type { AgentInfo } from "@/hooks/use-game-socket";

interface AgentCardProps {
  type: "BULL" | "BEAR" | "CRAB";
  name: string;
  description: string;
  cost: number;
  isHired: boolean;
  agentState?: AgentInfo;
  onHire: () => Promise<void>;
  onBoost?: () => Promise<void>;
  disabled?: boolean;
}

const agentIcons = {
  BULL: TrendingUp,
  BEAR: TrendingDown,
  CRAB: Shield,
};

const agentColors = {
  BULL: {
    bg: "bg-green-500",
    border: "border-green-500",
    text: "text-green-500",
  },
  BEAR: {
    bg: "bg-red-500",
    border: "border-red-500",
    text: "text-red-500",
  },
  CRAB: {
    bg: "bg-blue-500",
    border: "border-blue-500",
    text: "text-blue-500",
  },
};

export function AgentCard({
  type,
  name,
  description,
  cost,
  isHired,
  agentState,
  onHire,
  onBoost,
  disabled,
}: AgentCardProps) {
  const [isHiring, setIsHiring] = useState(false);
  const [isBoosting, setIsBoosting] = useState(false);

  const Icon = agentIcons[type];
  const colors = agentColors[type];

  const handleHire = async () => {
    setIsHiring(true);
    try {
      await onHire();
    } finally {
      setIsHiring(false);
    }
  };

  const handleBoost = async () => {
    if (!onBoost) return;
    setIsBoosting(true);
    try {
      await onBoost();
    } finally {
      setIsBoosting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4 }}
      className={cn(
        "relative bg-card p-4 border-4 transition-all",
        isHired ? colors.border : "border-white opacity-90"
      )}
    >
      {/* Boosted indicator */}
      {agentState?.isBoosted && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="absolute -top-2 -right-2 bg-yellow-400 text-black px-2 py-1 text-xs font-bold"
        >
          BOOSTED
        </motion.div>
      )}

      {/* Header */}
      <div className="flex justify-between items-start mb-4">
        <div
          className={cn(
            "w-12 h-12 border-2 border-white flex items-center justify-center",
            colors.bg
          )}
        >
          <Icon className="text-white w-8 h-8" />
        </div>
        <div className="text-right">
          <span className="bg-black text-white px-2 py-1 text-xs font-mono block">
            PWR {agentState?.power || 100}
          </span>
          {agentState?.tradeCount !== undefined && (
            <span className="text-xs text-zinc-400 mt-1 block">
              {agentState.tradeCount} trades
            </span>
          )}
        </div>
      </div>

      {/* Name and description */}
      <h3 className="text-xl font-bold uppercase mb-1">{name}</h3>
      <p className="text-xs text-zinc-400 mb-4 font-mono">{description}</p>

      {/* Position info when hired */}
      {isHired && agentState?.position && (
        <div className="bg-black/50 p-2 mb-4 border border-white/20">
          <div className="flex justify-between text-xs">
            <span className="text-zinc-400">Position:</span>
            <span
              className={cn(
                "font-bold",
                agentState.position.type === "LONG" ? "text-green-400" : "text-red-400"
              )}
            >
              {agentState.position.type}
            </span>
          </div>
          <div className="flex justify-between text-xs mt-1">
            <span className="text-zinc-400">Entry:</span>
            <span className="font-mono">
              ${agentState.position.entryPrice.toFixed(2)}
            </span>
          </div>
        </div>
      )}

      {/* PnL display */}
      {isHired && agentState && (
        <div className="mb-4">
          <div className="flex justify-between items-center">
            <span className="text-xs text-zinc-400">Total PnL:</span>
            <span
              className={cn(
                "font-mono font-bold",
                agentState.totalPnl >= 0 ? "text-green-400" : "text-red-400"
              )}
            >
              {formatPnL(agentState.totalPnl)}
            </span>
          </div>
        </div>
      )}

      {/* Actions */}
      {isHired ? (
        <div className="space-y-2">
          <div className="w-full bg-green-500/20 text-green-400 font-bold text-center py-2 uppercase border-2 border-green-500/50">
            Active in Arena
          </div>
          {onBoost && !agentState?.isBoosted && (
            <Button
              variant="secondary"
              className="w-full"
              onClick={handleBoost}
              disabled={isBoosting || disabled}
            >
              {isBoosting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Boosting...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Boost (0.05 M)
                </>
              )}
            </Button>
          )}
        </div>
      ) : (
        <Button
          className="w-full"
          onClick={handleHire}
          disabled={isHiring || disabled}
        >
          {isHiring ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Signing...
            </>
          ) : (
            <>
              <Zap className="w-4 h-4 fill-current" />
              Hire ({cost} M)
            </>
          )}
        </Button>
      )}
    </motion.div>
  );
}
