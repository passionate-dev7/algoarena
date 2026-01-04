"use client";

import { useRef, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { type PriceCandle, type AgentInfo } from "@/hooks/use-game-socket";
import { cn } from "@/lib/utils";

interface ArenaProps {
  priceHistory: PriceCandle[];
  currentPrice: number;
  agents: AgentInfo[];
  isRoundActive: boolean;
}

export function Arena({
  priceHistory,
  currentPrice,
  agents,
  isRoundActive,
}: ArenaProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Calculate price range for scaling
  const { minPrice, maxPrice, priceRange } = useMemo(() => {
    if (priceHistory.length === 0) {
      return { minPrice: 0, maxPrice: 100, priceRange: 100 };
    }
    const prices = priceHistory.flatMap((c) => [c.high, c.low]);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const range = max - min || 1;
    const padding = range * 0.1;
    return {
      minPrice: min - padding,
      maxPrice: max + padding,
      priceRange: range + padding * 2,
    };
  }, [priceHistory]);

  // Draw candlestick chart
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;

    // Clear canvas
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, width, height);

    // Draw grid
    ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
    ctx.lineWidth = 1;

    // Horizontal grid lines
    for (let i = 0; i <= 4; i++) {
      const y = (height / 4) * i;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Draw candles
    if (priceHistory.length > 0) {
      const candleWidth = (width - 20) / priceHistory.length;
      const wickWidth = Math.max(1, candleWidth * 0.1);

      priceHistory.forEach((candle, i) => {
        const x = 10 + i * candleWidth;
        const isGreen = candle.close >= candle.open;

        // Calculate Y positions
        const openY =
          height - ((candle.open - minPrice) / priceRange) * height * 0.9 - height * 0.05;
        const closeY =
          height - ((candle.close - minPrice) / priceRange) * height * 0.9 - height * 0.05;
        const highY =
          height - ((candle.high - minPrice) / priceRange) * height * 0.9 - height * 0.05;
        const lowY =
          height - ((candle.low - minPrice) / priceRange) * height * 0.9 - height * 0.05;

        // Draw wick
        ctx.strokeStyle = isGreen ? "#22c55e" : "#ef4444";
        ctx.lineWidth = wickWidth;
        ctx.beginPath();
        ctx.moveTo(x + candleWidth / 2, highY);
        ctx.lineTo(x + candleWidth / 2, lowY);
        ctx.stroke();

        // Draw body
        ctx.fillStyle = isGreen ? "#22c55e" : "#ef4444";
        const bodyTop = Math.min(openY, closeY);
        const bodyHeight = Math.abs(closeY - openY) || 1;
        ctx.fillRect(x + 2, bodyTop, candleWidth - 4, bodyHeight);
      });
    }

    // Draw current price line
    const currentY =
      height - ((currentPrice - minPrice) / priceRange) * height * 0.9 - height * 0.05;
    ctx.strokeStyle = "#ff00ff";
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(0, currentY);
    ctx.lineTo(width, currentY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw agent positions
    agents.forEach((agent, idx) => {
      if (agent.position) {
        const entryY =
          height -
          ((agent.position.entryPrice - minPrice) / priceRange) * height * 0.9 -
          height * 0.05;

        // Entry line
        const color =
          agent.type === "BULL" ? "#22c55e" : agent.type === "BEAR" ? "#ef4444" : "#3b82f6";
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(0, entryY);
        ctx.lineTo(width, entryY);
        ctx.stroke();
        ctx.setLineDash([]);

        // Agent indicator
        ctx.fillStyle = color;
        ctx.font = "bold 12px monospace";
        ctx.fillText(
          `${agent.type[0]}${agent.position.type === "LONG" ? "L" : "S"}`,
          width - 30,
          entryY - 5
        );
      }
    });
  }, [priceHistory, currentPrice, agents, minPrice, maxPrice, priceRange]);

  return (
    <div className="relative w-full h-64 bg-black border-4 border-white overflow-hidden">
      {/* Scanline effect */}
      <div
        className="absolute inset-0 pointer-events-none z-10 opacity-10"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.5) 2px, rgba(0,0,0,0.5) 4px)",
        }}
      />

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        style={{ imageRendering: "pixelated" }}
      />

      {/* Current price overlay */}
      <div className="absolute top-2 right-4 z-20">
        <motion.div
          key={currentPrice}
          initial={{ scale: 1.2, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="font-mono text-2xl text-white font-bold"
        >
          ${currentPrice.toFixed(2)}
        </motion.div>
      </div>

      {/* Round status */}
      {!isRoundActive && (
        <div className="absolute inset-0 flex items-center justify-center z-20 bg-black/70">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-center"
          >
            <div className="text-3xl font-bold text-primary mb-2">
              ROUND ENDED
            </div>
            <div className="text-zinc-400">Next round starting soon...</div>
          </motion.div>
        </div>
      )}

      {/* Active agents indicator */}
      {agents.length > 0 && (
        <div className="absolute bottom-2 left-2 z-20 flex gap-2">
          {agents.map((agent) => (
            <motion.div
              key={agent.type}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className={cn(
                "px-2 py-1 text-xs font-bold uppercase",
                agent.type === "BULL" && "bg-green-500 text-black",
                agent.type === "BEAR" && "bg-red-500 text-white",
                agent.type === "CRAB" && "bg-blue-500 text-white",
                agent.isBoosted && "ring-2 ring-yellow-400"
              )}
            >
              {agent.type[0]} {agent.position?.type?.[0] || "~"}
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
