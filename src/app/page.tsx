"use client";

import { useState, useEffect, useRef } from "react";
import { requestX402Payment, submitPaymentProof, PaymentRequest } from "@/lib/x402";
import { Coins, Skull, Zap, TrendingUp, TrendingDown, Shield } from "lucide-react";
import { clsx } from "clsx";
import { motion } from "framer-motion";

type Agent = {
  id: string;
  name: string;
  type: "BULL" | "BEAR" | "CRAB";
  cost: number;
  active: boolean;
  color: string;
};

export default function Home() {
  // Game State
  const [balance, setBalance] = useState(10.0);
  const [agents, setAgents] = useState<Agent[]>([
    { id: "1", name: "Bullish Bob", type: "BULL", cost: 0.1, active: false, color: "bg-green-500" },
    { id: "2", name: "Bearish Ben", type: "BEAR", cost: 0.1, active: false, color: "bg-red-500" },
    { id: "3", name: "Crab Carol", type: "CRAB", cost: 0.05, active: false, color: "bg-blue-500" },
  ]);
  const [priceHistory, setPriceHistory] = useState<number[]>([]);
  const [currentPrice, setCurrentPrice] = useState(100);

  // x402 State
  const [paymentReq, setPaymentReq] = useState<PaymentRequest | null>(null);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);

  // Market Simulation Loop
  useEffect(() => {
    const intervals = 50; // points
    // Init history
    setPriceHistory(Array(intervals).fill(100));

    const interval = setInterval(() => {
      setCurrentPrice((prev) => {
        const change = (Math.random() - 0.48) * 2; // Slight upward bias
        const newPrice = prev + change;
        setPriceHistory(h => [...h.slice(1), newPrice]);
        return newPrice;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const handleHireAgent = async (id: string) => {
    setSelectedAgentId(id);
    const agent = agents.find(a => a.id === id);
    if (!agent) return;

    // 1. Request Resuorce (Agent Service)
    const response = await requestX402Payment(id);
    if (response.status === 402 && response.paymentDetails) {
      setPaymentReq(response.paymentDetails);
    }
  };

  const payX402 = async () => {
    if (!paymentReq || !selectedAgentId) return;
    setProcessingPayment(true);

    // Simulate User Signing and Sending TX
    await new Promise(r => setTimeout(r, 1500));

    // 2. Submit Proof
    const result = await submitPaymentProof("0xmocktxhash");

    if (result.success) {
      // Unlock Agent
      setAgents(prev => prev.map(a => a.id === selectedAgentId ? { ...a, active: true } : a));
      setBalance(b => b - paymentReq.amount);
      setPaymentReq(null);
      setSelectedAgentId(null);
    }
    setProcessingPayment(false);
  };

  return (
    <main className="min-h-screen bg-background text-foreground flex flex-col items-center p-4 overflow-hidden relative">
      {/* Background Grid */}
      <div className="absolute inset-0 z-0 opacity-20 pointer-events-none"
        style={{ backgroundImage: "radial-gradient(#fff 1px, transparent 1px)", backgroundSize: "20px 20px" }} />

      {/* Header */}
      <header className="z-10 w-full max-w-4xl flex justify-between items-center mb-8 border-b-4 border-white pb-4">
        <h1 className="text-4xl font-black uppercase italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary drop-shadow-[2px_2px_0_#fff]">
          AlgoArena
        </h1>
        <div className="flex items-center gap-4 bg-card p-2 px-4 border-2 border-white">
          <Coins className="text-accent w-6 h-6 animate-pulse" />
          <span className="font-mono text-xl font-bold">{balance.toFixed(2)} MOVE</span>
        </div>
      </header>

      {/* The Arena (Chart) */}
      <div className="z-10 w-full max-w-4xl h-64 bg-black border-4 border-white mb-8 relative overflow-hidden pixel-border">
        {/* Simple visualization of price history */}
        <div className="absolute inset-0 flex items-end gap-[2px] px-2 pb-2 opacity-80">
          {priceHistory.map((p, i) => {
            const height = Math.max(5, Math.min(100, (p - 90) * 5)); // Scaling
            const isUp = i > 0 && p > priceHistory[i - 1];
            return (
              <div
                key={i}
                className={clsx("flex-1", isUp ? "bg-green-500" : "bg-red-600")}
                style={{ height: `${height}%` }}
              />
            )
          })}
        </div>
        <div className="absolute top-2 right-4 font-mono text-2xl text-white">
          {currentPrice.toFixed(2)}
        </div>
      </div>

      {/* Agents Roster */}
      <div className="z-10 w-full max-w-4xl grid grid-cols-1 md:grid-cols-3 gap-6">
        {agents.map((agent) => (
          <div key={agent.id} className={clsx(
            "relative bg-card p-4 border-4 transition-all hover:-translate-y-1",
            agent.active ? "border-primary" : "border-white opacity-90"
          )}>
            <div className="flex justify-between items-start mb-4">
              <div className={clsx("w-12 h-12 border-2 border-white flex items-center justify-center", agent.color)}>
                {agent.type === "BULL" && <TrendingUp className="text-white w-8 h-8" />}
                {agent.type === "BEAR" && <TrendingDown className="text-white w-8 h-8" />}
                {agent.type === "CRAB" && <Shield className="text-white w-8 h-8" />}
              </div>
              <span className="bg-black text-white px-2 py-1 text-xs font-mono">
                LVL 1
              </span>
            </div>
            <h3 className="text-xl font-bold uppercase mb-1">{agent.name}</h3>
            <p className="text-xs text-zinc-400 mb-4 font-mono">
              {agent.type === "BULL" ? "Longs momentum." : agent.type === "BEAR" ? "Shorts pumps." : "Farms chop."}
            </p>

            {agent.active ? (
              <div className="w-full bg-green-500 text-black font-bold text-center py-2 uppercase border-2 border-black animate-pulse">
                Active in Arena
              </div>
            ) : (
              <button
                onClick={() => handleHireAgent(agent.id)}
                className="w-full bg-white text-black font-bold py-2 uppercase border-b-4 border-zinc-400 active:border-b-0 active:translate-y-1 hover:bg-zinc-200 transition-colors flex items-center justify-center gap-2"
              >
                <Zap className="w-4 h-4 fill-black" />
                Hire ({agent.cost} M)
              </button>
            )}
          </div>
        ))}
      </div>

      {/* x402 Payment Modal */}
      {paymentReq && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-card w-full max-w-md border-4 border-primary p-6 relative pixel-border"
          >
            <button
              onClick={() => setPaymentReq(null)}
              className="absolute top-2 right-2 text-zinc-500 hover:text-white"
            >
              <Skull className="w-6 h-6" />
            </button>

            <h2 className="text-2xl font-bold text-primary mb-4 uppercase">
              402 Payment Required
            </h2>

            <div className="bg-black/50 p-4 border-2 border-white/20 mb-6 font-mono text-sm space-y-2">
              <div className="flex justify-between">
                <span className="text-zinc-400">Realm:</span>
                <span>{paymentReq.realm}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Recipient:</span>
                <span className="text-xs">{paymentReq.recipient}</span>
              </div>
              <div className="flex justify-between text-lg font-bold border-t border-white/20 pt-2 mt-2">
                <span>Total:</span>
                <span className="text-primary">{paymentReq.amount} {paymentReq.currency}</span>
              </div>
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => setPaymentReq(null)}
                className="flex-1 py-3 text-center border-2 border-white/20 hover:bg-white/10 font-bold uppercase"
              >
                Cancel
              </button>
              <button
                onClick={payX402}
                disabled={processingPayment}
                className="flex-1 py-3 bg-primary text-black font-bold uppercase hover:bg-primary/90 flex items-center justify-center gap-2"
              >
                {processingPayment ? "Signing..." : "Pay Now"}
              </button>
            </div>
          </motion.div>
        </div>
      )}

    </main>
  );
}
