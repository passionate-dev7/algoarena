"use client";

import { motion } from "framer-motion";
import { Timer, AlertCircle } from "lucide-react";
import { formatTime, cn } from "@/lib/utils";

interface RoundTimerProps {
  roundId: number;
  timeRemaining: number;
  isActive: boolean;
}

export function RoundTimer({ roundId, timeRemaining, isActive }: RoundTimerProps) {
  const isUrgent = timeRemaining <= 30;

  return (
    <div
      className={cn(
        "bg-card border-4 p-4 flex items-center justify-between",
        isActive
          ? isUrgent
            ? "border-red-500"
            : "border-primary"
          : "border-zinc-600"
      )}
    >
      <div className="flex items-center gap-3">
        {isActive ? (
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          >
            <Timer
              className={cn(
                "w-6 h-6",
                isUrgent ? "text-red-500" : "text-primary"
              )}
            />
          </motion.div>
        ) : (
          <AlertCircle className="w-6 h-6 text-zinc-500" />
        )}
        <div>
          <div className="text-xs text-zinc-400 uppercase">
            Round {roundId || "—"}
          </div>
          <div className="text-sm font-bold">
            {isActive ? "In Progress" : "Waiting..."}
          </div>
        </div>
      </div>

      <div className="text-right">
        <div className="text-xs text-zinc-400 uppercase">Time Left</div>
        <motion.div
          key={timeRemaining}
          initial={{ scale: 1.1 }}
          animate={{ scale: 1 }}
          className={cn(
            "font-mono text-2xl font-bold",
            isUrgent ? "text-red-500" : "text-white"
          )}
        >
          {isActive ? formatTime(timeRemaining) : "--:--"}
        </motion.div>
      </div>
    </div>
  );
}
