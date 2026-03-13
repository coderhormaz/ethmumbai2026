import { ethers } from 'ethers';
import { config } from '../config';

/**
 * In-memory set of already-consumed tx hashes to prevent replay attacks.
 * In production, replace with a persistent store (Redis / DB).
 */
const usedPaymentProofs = new Set<string>();

const ERC20_TRANSFER_EVENT = 'event Transfer(address indexed from, address indexed to, uint256 value)';

/**
 * Verify that a transaction on Base Sepolia transferred the required USDC
 * to the expected recipient, and that it hasn't been replayed.
 */
export async function verifyPayment(
  txHash: string,
  expectedRecipient: string,
  expectedAmountUSDC: number
): Promise<boolean> {
  // Replay guard
  if (usedPaymentProofs.has(txHash.toLowerCase())) {
    console.warn(`[Verifier] Replay attempt: ${txHash}`);
    return false;
  }

  const provider = new ethers.JsonRpcProvider(config.baseSepolia.rpcUrl);
  const usdcAddress = config.baseSepolia.usdcAddress;

  try {
    const receipt = await provider.getTransactionReceipt(txHash);

    if (!receipt) {
      console.warn(`[Verifier] Tx ${txHash} not found — may still be pending.`);
      return false;
    }
    if (receipt.status !== 1) {
      console.warn(`[Verifier] Tx ${txHash} reverted.`);
      return false;
    }

    // Check the tx landed on the right chain
    // receipt doesn't expose chainId directly but we trust the provider is Base Sepolia

    const expectedWei = ethers.parseUnits(expectedAmountUSDC.toFixed(6), 6);
    const iface = new ethers.Interface([ERC20_TRANSFER_EVENT]);

    for (const log of receipt.logs) {
      if (log.address.toLowerCase() !== usdcAddress.toLowerCase()) continue;

      try {
        const parsed = iface.parseLog({ data: log.data, topics: [...log.topics] });
        if (!parsed || parsed.name !== 'Transfer') continue;

        const to: string = parsed.args[1];
        const value: bigint = parsed.args[2];

        if (
          to.toLowerCase() === expectedRecipient.toLowerCase() &&
          value >= expectedWei
        ) {
          usedPaymentProofs.add(txHash.toLowerCase());
          console.log(`[Verifier] ✅ Payment verified: ${txHash}`);
          return true;
        }
      } catch {
        // Not a Transfer event from this contract — skip
      }
    }

    console.warn(`[Verifier] No matching USDC transfer in tx ${txHash}`);
    return false;
  } catch (error: any) {
    console.error(`[Verifier] Error verifying ${txHash}:`, error.message);
    return false;
  }
}

/** Utility: check if a tx hash has already been consumed */
export function isProofUsed(txHash: string): boolean {
  return usedPaymentProofs.has(txHash.toLowerCase());
}
