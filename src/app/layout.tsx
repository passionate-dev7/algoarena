import type { Metadata, Viewport } from "next";
import { Press_Start_2P, Courier_Prime } from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";

const pressStart = Press_Start_2P({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-pixel",
});

const courier = Courier_Prime({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "AlgoArena | AI Trading Auto-Battler",
  description:
    "Bet on AI trading agents battling on live crypto charts. Powered by Movement Network and x402 Protocol.",
  keywords: [
    "DeFi",
    "Gaming",
    "AI",
    "Trading",
    "Movement",
    "Blockchain",
    "x402",
  ],
  authors: [{ name: "AlgoArena Team" }],
  openGraph: {
    title: "AlgoArena | AI Trading Auto-Battler",
    description:
      "Bet on AI trading agents battling on live crypto charts.",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "AlgoArena | AI Trading Auto-Battler",
    description:
      "Bet on AI trading agents battling on live crypto charts.",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#FF00FF",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
      </head>
      <body
        className={`${pressStart.variable} ${courier.variable} antialiased`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
