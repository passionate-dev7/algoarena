import { Aptos, AptosConfig, Network } from "@aptos-labs/ts-sdk";

// Movement network configurations
export const MOVEMENT_CONFIGS = {
  mainnet: {
    chainId: 126,
    name: "Movement Mainnet",
    fullnode: "https://full.mainnet.movementinfra.xyz/v1",
    explorer: "mainnet",
  },
  testnet: {
    chainId: 250,
    name: "Movement Testnet (Bardock)",
    fullnode: "https://testnet.movementnetwork.xyz/v1",
    explorer: "testnet",
  },
};

// Current network - set to testnet for hackathon
export const CURRENT_NETWORK = "testnet" as keyof typeof MOVEMENT_CONFIGS;

// Initialize Aptos SDK with Movement network
export const aptos = new Aptos(
  new AptosConfig({
    network: Network.CUSTOM,
    fullnode: MOVEMENT_CONFIGS[CURRENT_NETWORK].fullnode,
  })
);

// Contract address (will be updated after deployment)
export const CONTRACT_ADDRESS = "0xBEEF";

// Server URL
export const SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:4402";

// Utility to convert Uint8Array to hex string
export const toHex = (buffer: Uint8Array): string => {
  return Array.from(buffer)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
};

// Get explorer URL based on current network
export const getExplorerUrl = (txHash: string): string => {
  const formattedHash = txHash.startsWith("0x") ? txHash : `0x${txHash}`;
  const network = MOVEMENT_CONFIGS[CURRENT_NETWORK].explorer;
  return `https://explorer.movementnetwork.xyz/txn/${formattedHash}?network=${network}`;
};

// Format address for display
export const formatAddress = (address: string): string => {
  if (!address) return "";
  if (address.length <= 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};
