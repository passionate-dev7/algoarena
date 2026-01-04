"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Trophy, Medal, Award, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, formatPnL, formatAddress } from "@/lib/utils";
import type { RoundResult } from "@/hooks/use-game-socket";

interface RoundResultModalProps {
  result: RoundResult | null;
  currentPlayerAddress?: string;
  onClose: () => void;
}

export function RoundResultModal({
  result,
  currentPlayerAddress,
  onClose,
}: RoundResultModalProps) {
  if (!result) return null;

  const playerRank = result.rankings.findIndex(
    (r) => r.address === currentPlayerAddress
  );
  const isWinner = result.winner?.address === currentPlayerAddress;

  return (
    <AnimatePresence>
      {result && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/90 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ scale: 0.8, opacity: 0, y: 50 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.8, opacity: 0, y: 50 }}
            className="relative z-10 w-full max-w-lg bg-card border-4 border-primary p-6"
          >
            <button
              onClick={onClose}
              className="absolute top-4 right-4 text-zinc-400 hover:text-white"
            >
              <X className="w-6 h-6" />
            </button>

            {/* Header */}
            <div className="text-center mb-6">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
              >
                <Trophy className="w-16 h-16 mx-auto text-yellow-400 mb-4" />
              </motion.div>
              <h2 className="text-3xl font-bold text-primary uppercase">
                Round {result.roundId} Complete
              </h2>
              {isWinner && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.4 }}
                  className="mt-2 text-yellow-400 font-bold text-xl"
                >
                  YOU WON!
                </motion.div>
              )}
            </div>

            {/* Winner */}
            {result.winner && (
              <div className="bg-yellow-400/20 border-2 border-yellow-400 p-4 mb-6">
                <div className="text-center">
                  <div className="text-sm text-yellow-400 uppercase mb-1">
                    Champion
                  </div>
                  <div className="font-mono text-lg font-bold">
                    {formatAddress(result.winner.address)}
                  </div>
                  <div className="text-green-400 font-bold mt-1">
                    {formatPnL(result.winner.pnl)}
                  </div>
                </div>
              </div>
            )}

            {/* Rankings */}
            <div className="space-y-2 mb-6">
              <div className="text-sm text-zinc-400 uppercase mb-2">
                Rankings
              </div>
              {result.rankings.slice(0, 5).map((entry, idx) => (
                <motion.div
                  key={entry.address}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 + idx * 0.1 }}
                  className={cn(
                    "flex items-center gap-3 p-2 border-2",
                    entry.address === currentPlayerAddress
                      ? "border-primary bg-primary/10"
                      : "border-white/20"
                  )}
                >
                  <div className="w-8 flex justify-center">
                    {idx === 0 ? (
                      <Trophy className="w-5 h-5 text-yellow-400" />
                    ) : idx === 1 ? (
                      <Medal className="w-5 h-5 text-gray-300" />
                    ) : idx === 2 ? (
                      <Award className="w-5 h-5 text-amber-600" />
                    ) : (
                      <span className="text-zinc-500">{idx + 1}</span>
                    )}
                  </div>
                  <div className="flex-1 font-mono text-sm">
                    {formatAddress(entry.address)}
                    {entry.address === currentPlayerAddress && (
                      <span className="text-primary ml-2">(You)</span>
                    )}
                  </div>
                  <div
                    className={cn(
                      "font-mono font-bold",
                      entry.pnl >= 0 ? "text-green-400" : "text-red-400"
                    )}
                  >
                    {formatPnL(entry.pnl)}
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Player result */}
            {playerRank >= 0 && playerRank >= 5 && (
              <div className="text-center text-zinc-400 mb-6">
                Your rank: #{playerRank + 1}
              </div>
            )}

            {/* Next round */}
            <div className="text-center">
              <p className="text-sm text-zinc-400 mb-4">
                Next round starting soon...
              </p>
              <Button onClick={onClose} className="w-full">
                Ready for Next Round
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
