"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Trophy, Medal, Award } from "lucide-react";
import { cn, formatPnL, formatAddress } from "@/lib/utils";
import { SERVER_URL } from "@/lib/aptos";

interface LeaderboardEntry {
  address: string;
  pnl: number;
  agentCount: number;
}

interface LeaderboardProps {
  currentPlayerAddress?: string;
}

export function Leaderboard({ currentPlayerAddress }: LeaderboardProps) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        const res = await fetch(`${SERVER_URL}/api/leaderboard`);
        if (res.ok) {
          const data = await res.json();
          setEntries(data.leaderboard || []);
        }
      } catch (error) {
        console.error("Failed to fetch leaderboard:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchLeaderboard();
    const interval = setInterval(fetchLeaderboard, 5000);
    return () => clearInterval(interval);
  }, []);

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Trophy className="w-5 h-5 text-yellow-400" />;
      case 2:
        return <Medal className="w-5 h-5 text-gray-300" />;
      case 3:
        return <Award className="w-5 h-5 text-amber-600" />;
      default:
        return <span className="w-5 text-center text-zinc-500">{rank}</span>;
    }
  };

  if (isLoading) {
    return (
      <div className="bg-card border-4 border-white p-4">
        <h3 className="text-lg font-bold uppercase mb-4 text-primary">
          Leaderboard
        </h3>
        <div className="text-center text-zinc-400 py-8">Loading...</div>
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="bg-card border-4 border-white p-4">
        <h3 className="text-lg font-bold uppercase mb-4 text-primary">
          Leaderboard
        </h3>
        <div className="text-center text-zinc-400 py-8">
          No players yet. Be the first!
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card border-4 border-white p-4">
      <h3 className="text-lg font-bold uppercase mb-4 text-primary">
        Leaderboard
      </h3>

      <div className="space-y-2">
        {entries.map((entry, idx) => (
          <motion.div
            key={entry.address}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.05 }}
            className={cn(
              "flex items-center gap-3 p-2 border-2",
              entry.address === currentPlayerAddress
                ? "border-primary bg-primary/10"
                : "border-white/20 bg-black/30"
            )}
          >
            {/* Rank */}
            <div className="w-8 flex justify-center">{getRankIcon(idx + 1)}</div>

            {/* Address */}
            <div className="flex-1 font-mono text-sm">
              {formatAddress(entry.address)}
              {entry.address === currentPlayerAddress && (
                <span className="text-primary ml-2">(You)</span>
              )}
            </div>

            {/* Agents */}
            <div className="text-xs text-zinc-400">
              {entry.agentCount} agent{entry.agentCount !== 1 ? "s" : ""}
            </div>

            {/* PnL */}
            <div
              className={cn(
                "font-mono font-bold text-sm min-w-[80px] text-right",
                entry.pnl >= 0 ? "text-green-400" : "text-red-400"
              )}
            >
              {formatPnL(entry.pnl)}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
