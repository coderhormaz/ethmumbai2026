import dotenv from 'dotenv';
dotenv.config();

const fallbackModels = (process.env.FALLBACK_MODELS || 'claude-3.5-sonnet,gpt-4o,grok-beta,gemini-pro')
  .split(',')
  .map((model) => model.trim())
  .filter(Boolean);

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),

  // ENS-enabled Ethereum RPC (Sepolia for hackathon/testnet setups)
  l1RpcUrl: process.env.L1_RPC_URL || '',

  // Base Sepolia for x402 payments
  baseSepolia: {
    rpcUrl: process.env.BASE_SEPOLIA_RPC_URL || 'https://base-sepolia-rpc.publicnode.com',
    chainId: 84532,
    usdcAddress: process.env.USDC_ADDRESS_BASE_SEPOLIA || '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
    blockExplorer: 'https://base-sepolia.blockscout.com',
  },

  // AI provider
  aiProviderApiKey: process.env.AI_PROVIDER_API_KEY || '',
  aiProviderUrl: process.env.AI_PROVIDER_URL || 'https://openrouter.ai/api/v1/chat/completions',
  demoUpstreamModel: process.env.DEMO_UPSTREAM_MODEL || '',

  // Seller identity
  proxySellerEns: process.env.PROXY_SELLER_ENS || '',

  // Fallback metadata when ENS is unavailable (for local dev / testnet)
  fallback: {
    models: fallbackModels,
    pricePer1kInput: process.env.FALLBACK_PRICE_INPUT || '0.0008',
    pricePer1kOutput: process.env.FALLBACK_PRICE_OUTPUT || '0.0024',
    recipient: process.env.FALLBACK_RECIPIENT || '',
  },

  // Tester wallet (for client testing only)
  testerPrivateKey: process.env.TESTER_PRIVATE_KEY || '',
};
