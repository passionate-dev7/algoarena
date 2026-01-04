"use client";

import { useWallet, WalletName } from "@aptos-labs/wallet-adapter-react";
import { usePrivy } from "@privy-io/react-auth";
import { Button } from "@/components/ui/button";
import { X, Wallet, Mail, Chrome, Smartphone } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface WalletModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function WalletModal({ isOpen, onClose }: WalletModalProps) {
  const { wallets, connect, connected } = useWallet();
  const { login, authenticated, ready } = usePrivy();

  const handleWalletConnect = async (walletName: WalletName) => {
    try {
      await connect(walletName);
      onClose();
    } catch (error) {
      console.error("Failed to connect wallet:", error);
    }
  };

  const handlePrivyLogin = async () => {
    try {
      await login();
      onClose();
    } catch (error) {
      console.error("Failed to login with Privy:", error);
    }
  };

  if (connected || authenticated) {
    onClose();
    return null;
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="relative z-10 w-full max-w-md bg-card border-4 border-white p-6"
          >
            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 text-zinc-400 hover:text-white"
            >
              <X className="w-6 h-6" />
            </button>

            <h2 className="text-2xl font-bold text-primary mb-6 uppercase">
              Connect Wallet
            </h2>

            {/* Privy login options */}
            <div className="space-y-3 mb-6">
              <p className="text-sm text-zinc-400 mb-3">Quick Login (Recommended)</p>
              <Button
                variant="outline"
                className="w-full justify-start gap-3"
                onClick={handlePrivyLogin}
                disabled={!ready}
              >
                <Mail className="w-5 h-5" />
                Email / Social Login
              </Button>
            </div>

            {/* Divider */}
            <div className="flex items-center gap-3 mb-6">
              <div className="flex-1 h-px bg-white/20" />
              <span className="text-xs text-zinc-500 uppercase">or</span>
              <div className="flex-1 h-px bg-white/20" />
            </div>

            {/* Native wallets */}
            <div className="space-y-3">
              <p className="text-sm text-zinc-400 mb-3">Native Wallets</p>
              {wallets.map((wallet) => (
                <Button
                  key={wallet.name}
                  variant="outline"
                  className="w-full justify-start gap-3"
                  onClick={() => handleWalletConnect(wallet.name)}
                >
                  {wallet.icon ? (
                    <img
                      src={wallet.icon}
                      alt={wallet.name}
                      className="w-5 h-5"
                    />
                  ) : (
                    <Wallet className="w-5 h-5" />
                  )}
                  {wallet.name}
                </Button>
              ))}

              {wallets.length === 0 && (
                <div className="text-center py-4">
                  <p className="text-sm text-zinc-500 mb-3">
                    No wallets detected
                  </p>
                  <a
                    href="https://nightly.app"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline text-sm"
                  >
                    Install Nightly Wallet
                  </a>
                </div>
              )}
            </div>

            <p className="text-xs text-zinc-500 text-center mt-6">
              By connecting, you agree to our Terms of Service
            </p>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
