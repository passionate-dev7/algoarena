import { useWallet } from "@aptos-labs/wallet-adapter-react";
import {
  Aptos,
  AptosConfig,
  Network,
  AccountAuthenticatorEd25519,
  Ed25519PublicKey,
  Ed25519Signature,
} from "@aptos-labs/ts-sdk";
import { buildAptosLikePaymentHeader } from "x402plus";
import { MOVEMENT_CONFIGS, CURRENT_NETWORK, SERVER_URL } from "@/lib/aptos";

// Convert wallet's {0: byte, 1: byte, ...} object to Uint8Array
const toBytes = (obj: Record<string, number>) =>
  new Uint8Array(
    Object.keys(obj)
      .map(Number)
      .sort((a, b) => a - b)
      .map((k) => obj[k])
  );

export interface PaymentRequirements {
  payTo: string;
  maxAmountRequired: string;
  network: string;
  asset: string;
  description: string;
}

export function useX402Payment() {
  const { account, signTransaction } = useWallet();

  const payForAccess = async (
    paymentRequirements: PaymentRequirements
  ): Promise<string> => {
    if (!account) throw new Error("Wallet not connected");

    // Build transfer transaction
    const aptos = new Aptos(
      new AptosConfig({
        network: Network.CUSTOM,
        fullnode: MOVEMENT_CONFIGS[CURRENT_NETWORK].fullnode,
      })
    );

    const tx = await aptos.transaction.build.simple({
      sender: account.address,
      data: {
        function: "0x1::aptos_account::transfer",
        functionArguments: [
          paymentRequirements.payTo,
          paymentRequirements.maxAmountRequired,
        ],
      },
    });

    // Sign with wallet
    const signed = await signTransaction({ transactionOrPayload: tx });

    // Extract bytes from wallet's nested response
    const pubKeyBytes = toBytes((signed.authenticator as any).public_key.key.data);
    const sigBytes = toBytes((signed.authenticator as any).signature.data.data);

    const authenticator = new AccountAuthenticatorEd25519(
      new Ed25519PublicKey(pubKeyBytes),
      new Ed25519Signature(sigBytes)
    );

    return buildAptosLikePaymentHeader(paymentRequirements as any, {
      signatureBcsBase64: Buffer.from(authenticator.bcsToBytes()).toString("base64"),
      transactionBcsBase64: Buffer.from(tx.bcsToBytes()).toString("base64"),
    });
  };

  const hireAgent = async (
    agentType: "bull" | "bear" | "crab"
  ): Promise<{ success: boolean; accessToken?: string; error?: string }> => {
    if (!account) {
      return { success: false, error: "Wallet not connected" };
    }

    try {
      // Step 1: Request the resource (will get 402)
      const res = await fetch(`${SERVER_URL}/api/hire/${agentType}`, {
        headers: {
          "X-PLAYER-ADDRESS": account.address.toString(),
        },
      });

      // If already paid or free, return success
      if (res.ok) {
        const data = await res.json();
        return { success: true, accessToken: data.accessToken };
      }

      // Step 2: Get payment requirements from 402 response
      if (res.status !== 402) {
        return { success: false, error: `Unexpected status: ${res.status}` };
      }

      const { accepts } = await res.json();
      if (!accepts?.[0]) {
        return { success: false, error: "No payment requirements received" };
      }

      // Step 3: Sign payment
      const xPayment = await payForAccess(accepts[0]);

      // Step 4: Submit payment
      const paidRes = await fetch(`${SERVER_URL}/api/hire/${agentType}`, {
        headers: {
          "X-PAYMENT": xPayment,
          "X-PLAYER-ADDRESS": account.address.toString(),
        },
      });

      if (paidRes.ok) {
        const data = await paidRes.json();
        return { success: true, accessToken: data.accessToken };
      }

      const errorData = await paidRes.json().catch(() => ({}));
      return { success: false, error: errorData.error || "Payment failed" };
    } catch (error: any) {
      console.error("x402 payment error:", error);
      return { success: false, error: error.message || "Payment failed" };
    }
  };

  const boostAgent = async (
    agentType: string
  ): Promise<{ success: boolean; error?: string }> => {
    if (!account) {
      return { success: false, error: "Wallet not connected" };
    }

    try {
      const res = await fetch(`${SERVER_URL}/api/boost?agent=${agentType}`, {
        headers: {
          "X-PLAYER-ADDRESS": account.address.toString(),
        },
      });

      if (res.status !== 402) {
        if (res.ok) {
          return { success: true };
        }
        return { success: false, error: "Boost failed" };
      }

      const { accepts } = await res.json();
      if (!accepts?.[0]) {
        return { success: false, error: "No payment requirements" };
      }

      const xPayment = await payForAccess(accepts[0]);

      const paidRes = await fetch(`${SERVER_URL}/api/boost?agent=${agentType}`, {
        headers: {
          "X-PAYMENT": xPayment,
          "X-PLAYER-ADDRESS": account.address.toString(),
        },
      });

      if (paidRes.ok) {
        return { success: true };
      }

      return { success: false, error: "Boost payment failed" };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  };

  return {
    hireAgent,
    boostAgent,
    payForAccess,
    isConnected: !!account,
    address: account?.address?.toString(),
  };
}
