
export type PaymentRequest = {
    realm: string;
    amount: number; // in USDC/MOVE
    currency: string;
    recipient: string;
};

export type PaymentStatus = "pending" | "paid" | "failed";

export async function requestX402Payment(
    resourceId: string
): Promise<{ status: number; headers: any; paymentDetails?: PaymentRequest }> {
    // Simulate an HTTP 402 response from an agent service provider
    console.log(`Requesting resource: ${resourceId}`);

    // Mock delay
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Return a 402 Payment Required
    return {
        status: 402,
        headers: {
            "www-authenticate": 'x402 realm="AlgoArena Agent Service", amount="0.1", currency="MOVE", recipient="0xAgentPool"',
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
    // Simulate verifying the payment on-chain
    console.log(`Verifying payment tx: ${paymentHash}`);
    await new Promise((resolve) => setTimeout(resolve, 1000));

    return {
        success: true,
        token: "access_token_" + Math.random().toString(36).substring(7),
    };
}
