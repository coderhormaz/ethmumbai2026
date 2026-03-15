import { ethers } from 'ethers';
import { config } from '../config';

export interface ProxyMetadata {
  models: string[];
  pricePer1kInput: string;
  pricePer1kOutput: string;
  recipient: string;
  url?: string;
  status?: string;
  avatar?: string;
  description?: string;
}

let ensProvider: ethers.JsonRpcProvider | null = null;

/**
 * Get or create an ENS-enabled provider.
 * Per ENS docs: always specify the network to avoid resolution issues.
 */
function getEnsProvider(): ethers.JsonRpcProvider | null {
  if (!config.l1RpcUrl) {
    return null;
  }

  if (!ensProvider) {
    // Detect network from RPC URL to set correct chain for ENS resolution.
    // ENS docs: "Specify the chain ID to whichever ENS network you're using."
    const url = config.l1RpcUrl.toLowerCase();
    let network: ethers.Networkish | undefined;

    if (url.includes('sepolia')) {
      network = 'sepolia';
    } else if (url.includes('holesky')) {
      network = 'holesky';
    } else {
      // Default to mainnet for ENS resolution
      network = 'mainnet';
    }

    ensProvider = new ethers.JsonRpcProvider(config.l1RpcUrl, network);
  }

  return ensProvider;
}

export function normalizeEnsName(ensName: string): string {
  const candidate = ensName?.trim();

  if (!candidate) {
    throw new Error('ENS name is required.');
  }

  try {
    return ethers.ensNormalize(candidate);
  } catch {
    throw new Error(`Invalid ENS name: ${candidate}`);
  }
}

export function normalizeWalletAddress(address: string): string {
  try {
    return ethers.getAddress(address.trim());
  } catch {
    throw new Error('Invalid wallet address.');
  }
}

export function normalizeProxyUrl(proxyUrl: string): string {
  let parsed: URL;

  try {
    parsed = new URL(proxyUrl.trim());
  } catch {
    throw new Error('Invalid proxy URL.');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Proxy URL must start with http:// or https://');
  }

  return parsed.toString();
}

export async function verifyEnsWalletBinding(ensName: string, walletAddress: string): Promise<void> {
  const provider = getEnsProvider();

  if (!provider) {
    return;
  }

  const [resolvedAddress, primaryName] = await Promise.all([
    provider.resolveName(ensName),
    provider.lookupAddress(walletAddress).catch(() => null),
  ]);

  if (!resolvedAddress) {
    throw new Error(
      `ENS name ${ensName} does not resolve to an address. Set its address record to ${walletAddress} before registering.`
    );
  }

  if (ethers.getAddress(resolvedAddress) !== walletAddress) {
    throw new Error(
      `ENS name ${ensName} resolves to ${resolvedAddress}, not ${walletAddress}. Update the address record or submit the matching wallet.`
    );
  }

  if (primaryName) {
    const normalizedPrimaryName = normalizeEnsName(primaryName);
    if (normalizedPrimaryName !== ensName) {
      console.warn(`[ENS] Wallet ${walletAddress} has primary name ${normalizedPrimaryName}; continuing because forward resolution matches ${ensName}.`);
    }
  }
}

/**
 * Resolve proxy metadata from ENS text records.
 * Falls back to env-based config when ENS is unavailable (local dev / testnet).
 *
 * Reads standard ENS text records (url, avatar, description) plus custom
 * x402.* records for pricing and payment.
 */
export async function getProxyMetadata(ensName: string): Promise<ProxyMetadata> {
  const normalizedName = normalizeEnsName(ensName);

  // Try ENS resolution first
  const provider = getEnsProvider();
  if (provider) {
    try {
      const resolver = await provider.getResolver(normalizedName);

      if (resolver) {
        const [modelsRaw, priceInputRaw, priceOutputRaw, recipientRaw, urlRaw, statusRaw, avatarRaw, descriptionRaw] =
          await Promise.all([
            resolver.getText('x402.models'),
            resolver.getText('x402.pricePer1kInput'),
            resolver.getText('x402.pricePer1kOutput'),
            resolver.getText('x402.recipient'),
            resolver.getText('url'),
            resolver.getText('x402.status'),
            resolver.getText('avatar'),
            resolver.getText('description'),
          ]);

        if (recipientRaw) {
          console.log(`[ENS] Resolved metadata for ${normalizedName}`);
          return {
            models: modelsRaw ? modelsRaw.split(',').map((m) => m.trim()) : [],
            pricePer1kInput: priceInputRaw || '0',
            pricePer1kOutput: priceOutputRaw || '0',
            recipient: normalizeWalletAddress(recipientRaw),
            url: urlRaw || undefined,
            status: statusRaw || 'online',
            avatar: avatarRaw || undefined,
            description: descriptionRaw || undefined,
          };
        }
      }
    } catch (err: any) {
      console.warn(`[ENS] Resolution failed for ${normalizedName}: ${err.message}. Falling back to config.`);
    }
  }

  // Fallback to env-based config
  if (!config.fallback.recipient) {
    throw new Error(
      'No ENS resolution available and no FALLBACK_RECIPIENT set. ' +
      'Configure L1_RPC_URL + ENS records OR set FALLBACK_* env vars.'
    );
  }

  console.log(`[ENS] Using fallback metadata for ${normalizedName}`);
  return {
    models: config.fallback.models,
    pricePer1kInput: config.fallback.pricePer1kInput,
    pricePer1kOutput: config.fallback.pricePer1kOutput,
    recipient: normalizeWalletAddress(config.fallback.recipient),
    status: 'online',
  };
}

/**
 * Resolve an ENS name to a proxy URL from its text record.
 */
export async function resolveProxyUrl(ensName: string): Promise<string | null> {
  const provider = getEnsProvider();
  if (!provider) return null;

  const normalizedName = normalizeEnsName(ensName);

  try {
    const resolver = await provider.getResolver(normalizedName);
    if (!resolver) return null;

    const url = await resolver.getText('url');
    return url || null;
  } catch {
    return null;
  }
}

/**
 * Resolve an ENS avatar for display purposes.
 * Uses the `avatar` text record which can contain IPFS, HTTP, or NFT URIs.
 */
export async function resolveEnsAvatar(ensName: string): Promise<string | null> {
  const provider = getEnsProvider();
  if (!provider) return null;

  const normalizedName = normalizeEnsName(ensName);

  try {
    const avatar = await provider.getAvatar(normalizedName);
    return avatar || null;
  } catch {
    return null;
  }
}
