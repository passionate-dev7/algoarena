"use client";

import { useRef, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { type PriceCandle, type AgentInfo } from "@/hooks/use-game-socket";
import { cn } from "@/lib/utils";

interface ArenaProps {
  priceHistory: PriceCandle[];
  currentPrice: number;
  currentAsset?: string;
  assetIcon?: string;
  agents: AgentInfo[];
  isRoundActive: boolean;
  roundStartPrice?: number | null;
}

export function Arena({
  priceHistory,
  currentPrice,
  currentAsset = "BTC/USD",
  assetIcon = "₿",
  agents,
  isRoundActive,
  roundStartPrice,
}: ArenaProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Calculate price range for scaling (includes starting price so it stays visible)
  const { minPrice, maxPrice, priceRange } = useMemo(() => {
    if (priceHistory.length === 0) {
      return { minPrice: 0, maxPrice: 100, priceRange: 100 };
    }
    const prices = priceHistory.flatMap((c) => [c.high, c.low]);
    // Include starting price in range calculation so line always stays visible
    if (roundStartPrice) {
      prices.push(roundStartPrice);
    }
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const range = max - min || 1;
    const padding = range * 0.15; // Slightly more padding for breathing room
    return {
      minPrice: min - padding,
      maxPrice: max + padding,
      priceRange: range + padding * 2,
    };
  }, [priceHistory, roundStartPrice]);

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

    // Draw starting price reference line and PnL zones
    if (roundStartPrice && priceHistory.length > 0) {
      const startPrice = roundStartPrice;
      const startY =
        height - ((startPrice - minPrice) / priceRange) * height * 0.9 - height * 0.05;

      // Draw profit zone (above starting price)
      ctx.fillStyle = "rgba(34, 197, 94, 0.08)"; // Green tint
      ctx.fillRect(0, 0, width, startY);

      // Draw loss zone (below starting price)
      ctx.fillStyle = "rgba(239, 68, 68, 0.08)"; // Red tint
      ctx.fillRect(0, startY, width, height - startY);

      // Draw thick starting price line
      ctx.strokeStyle = "#FFD700"; // Gold color
      ctx.lineWidth = 3;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(0, startY);
      ctx.lineTo(width, startY);
      ctx.stroke();

      // Draw label
      ctx.fillStyle = "#FFD700";
      ctx.font = "bold 13px monospace";
      ctx.textAlign = "left";
      ctx.shadowColor = "#000";
      ctx.shadowBlur = 4;
      ctx.fillText(`START $${startPrice.toFixed(2)}`, 10, startY - 8);
      ctx.shadowBlur = 0;

      // Draw right-side label too
      ctx.textAlign = "right";
      ctx.shadowBlur = 4;
      ctx.fillText(`$${startPrice.toFixed(2)}`, width - 10, startY - 8);
      ctx.shadowBlur = 0;
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

    // Draw agent positions and PnL indicators
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

        // Calculate current PnL
        const currentPnL = agent.position.type === "LONG"
          ? ((currentPrice - agent.position.entryPrice) / agent.position.entryPrice) * 100
          : ((agent.position.entryPrice - currentPrice) / agent.position.entryPrice) * 100;

        // Draw PnL bubble at top-right (after ticker badge)
        const bubbleWidth = 110;
        const bubbleHeight = 45;
        const bubbleX = width - 20 - bubbleWidth - (idx * (bubbleWidth + 10));
        const bubbleY = 35; // Below the price display

        // Bubble background
        ctx.fillStyle = currentPnL >= 0 ? "rgba(34, 197, 94, 0.3)" : "rgba(239, 68, 68, 0.3)";
        ctx.fillRect(bubbleX, bubbleY, bubbleWidth, bubbleHeight);

        // Bubble border
        ctx.strokeStyle = currentPnL >= 0 ? "#22c55e" : "#ef4444";
        ctx.lineWidth = 2;
        ctx.strokeRect(bubbleX, bubbleY, bubbleWidth, bubbleHeight);

        // Agent icon/name
        const agentIcon = agent.type === "BULL" ? "🐂" : agent.type === "BEAR" ? "🐻" : "🦀";
        ctx.font = "16px Arial";
        ctx.textAlign = "left";
        ctx.fillText(agentIcon, bubbleX + 5, bubbleY + 20);

        ctx.fillStyle = "#fff";
        ctx.font = "bold 10px monospace";
        ctx.fillText(agent.type, bubbleX + 28, bubbleY + 15);

        // PnL value
        ctx.fillStyle = currentPnL >= 0 ? "#22c55e" : "#ef4444";
        ctx.font = "bold 16px monospace";
        ctx.textAlign = "center";
        ctx.shadowColor = "#000";
        ctx.shadowBlur = 3;
        ctx.fillText(
          `${currentPnL >= 0 ? "+" : ""}${currentPnL.toFixed(2)}%`,
          bubbleX + bubbleWidth / 2,
          bubbleY + 36
        );
        ctx.shadowBlur = 0;

        // Entry marker dot
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(width - 40, entryY, 6, 0, Math.PI * 2);
        ctx.fill();

        // White border on dot
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 2;
        ctx.stroke();

        // Entry price label
        ctx.fillStyle = "#fff";
        ctx.font = "bold 11px monospace";
        ctx.textAlign = "right";
        ctx.shadowBlur = 3;
        ctx.fillText(
          `$${agent.position.entryPrice.toFixed(2)}`,
          width - 50,
          entryY + 4
        );
        ctx.shadowBlur = 0;
      }
    });
  }, [priceHistory, currentPrice, agents, minPrice, maxPrice, priceRange, roundStartPrice]);

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

      {/* Asset Label - Prominent badge */}
      <div className="absolute top-3 left-3 z-30">
        <div className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-pink-600 px-4 py-2 border-2 border-white shadow-lg">
          <span className="text-2xl">{assetIcon}</span>
          <span className="font-mono text-lg text-white font-black tracking-wide">{currentAsset}</span>
        </div>
      </div>

      {/* Current price overlay */}
      <div className="absolute top-2 right-4 z-20">
        <motion.div
          key={currentPrice}
          initial={{ scale: 1.2, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="font-mono text-2xl text-white font-bold"
        >
          ${currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
