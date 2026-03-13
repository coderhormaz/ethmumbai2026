import { ethers } from 'ethers';
import { config } from '../config';

export interface ProxyMetadata {
  models: string[];
  pricePer1kInput: string;
  pricePer1kOutput: string;
  recipient: string;
  url?: string;
  status?: string;
}

/**
 * Resolve proxy metadata from ENS text records.
 * Falls back to env-based config when ENS is unavailable (local dev / testnet).
 */
export async function getProxyMetadata(ensName: string): Promise<ProxyMetadata> {
  // Try ENS resolution first
  if (config.l1RpcUrl) {
    try {
      const provider = new ethers.JsonRpcProvider(config.l1RpcUrl);
      const resolver = await provider.getResolver(ensName);

      if (resolver) {
        const [modelsRaw, priceInputRaw, priceOutputRaw, recipientRaw, urlRaw, statusRaw] =
          await Promise.all([
            resolver.getText('x402.models'),
            resolver.getText('x402.pricePer1kInput'),
            resolver.getText('x402.pricePer1kOutput'),
            resolver.getText('x402.recipient'),
            resolver.getText('url'),
            resolver.getText('x402.status'),
          ]);

        if (recipientRaw) {
          console.log(`[ENS] Resolved metadata for ${ensName}`);
          return {
            models: modelsRaw ? modelsRaw.split(',').map((m) => m.trim()) : [],
            pricePer1kInput: priceInputRaw || '0',
            pricePer1kOutput: priceOutputRaw || '0',
            recipient: recipientRaw,
            url: urlRaw || undefined,
            status: statusRaw || 'online',
          };
        }
      }
    } catch (err: any) {
      console.warn(`[ENS] Resolution failed for ${ensName}: ${err.message}. Falling back to config.`);
    }
  }

  // Fallback to env-based config
  if (!config.fallback.recipient) {
    throw new Error(
      'No ENS resolution available and no FALLBACK_RECIPIENT set. ' +
      'Configure L1_RPC_URL + ENS records OR set FALLBACK_* env vars.'
    );
  }

  console.log(`[ENS] Using fallback metadata for ${ensName}`);
  return {
    models: config.fallback.models,
    pricePer1kInput: config.fallback.pricePer1kInput,
    pricePer1kOutput: config.fallback.pricePer1kOutput,
    recipient: config.fallback.recipient,
    status: 'online',
  };
}

/**
 * Resolve an ENS name to a proxy URL (from its text record or content hash).
 */
export async function resolveProxyUrl(ensName: string): Promise<string | null> {
  if (!config.l1RpcUrl) return null;

  try {
    const provider = new ethers.JsonRpcProvider(config.l1RpcUrl);
    const resolver = await provider.getResolver(ensName);
    if (!resolver) return null;

    const url = await resolver.getText('url');
    return url || null;
  } catch {
    return null;
  }
}
