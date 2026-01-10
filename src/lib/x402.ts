// This file is kept for backwards compatibility but the main x402 logic
// is now in hooks/use-x402-payment.ts which uses the x402plus library

export type PaymentRequest = {
  realm: string;
  amount: number;
  currency: string;
  recipient: string;
};

export type PaymentStatus = "pending" | "paid" | "failed";

// Legacy mock functions - kept for reference
// The real implementation is in hooks/use-x402-payment.ts
export async function requestX402Payment(
  resourceId: string
): Promise<{ status: number; headers: any; paymentDetails?: PaymentRequest }> {
  console.warn("Using legacy x402 mock - use useX402Payment hook instead");

  return {
    status: 402,
    headers: {
      "www-authenticate": `x402 realm="AlgoArena Agent Service", amount="0.1", currency="MOVE", recipient="0xAgentPool"`,
    },
    paymentDetails: {
      realm: "AlgoArena Agent Service",
      amount: 0.1,
      currency: "MOVE",
      recipient: "0xAgentPool",
    },
  };
}

export async function submitPaymentProof(
  paymentHash: string
): Promise<{ success: boolean; token: string }> {
  console.warn("Using legacy x402 mock - use useX402Payment hook instead");

  return {
    success: true,
    token: "access_token_" + Math.random().toString(36).substring(7),
  };
}
