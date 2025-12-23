"use client";

import { PrivyProvider } from "@privy-io/react-auth";
import { WalletProvider } from "@/components/wallet-provider";
import { Toaster } from "sonner";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WalletProvider>
      <PrivyProvider
        appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID || "clxxxxxxxxxxxxxx"}
        config={{
          loginMethods: ["email", "google", "twitter", "discord", "wallet"],
          appearance: {
            theme: "dark",
            accentColor: "#FF00FF",
            logo: "/logo.png",
          },
          embeddedWallets: {
            createOnLogin: "users-without-wallets",
          },
        }}
      >
        {children}
        <Toaster
          theme="dark"
          position="bottom-right"
          toastOptions={{
            style: {
              background: "hsl(260 50% 15%)",
              border: "2px solid white",
              color: "white",
              fontFamily: "monospace",
            },
          }}
        />
      </PrivyProvider>
    </WalletProvider>
  );
}
