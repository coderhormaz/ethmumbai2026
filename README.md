# CreditFlow.eth ⚡

> **Decentralised AI Credit Marketplace** — Resell unused AI API credits for instant USDC on Base using ENS discovery and x402 micropayments.

## What is this?

Sellers run a proxy server backed by their AI API keys (OpenRouter, Anthropic, OpenAI, etc.). Buyers pay micro-USDC per query on Base Sepolia — no accounts, no KYC, no wasted subscriptions. Discovery happens via ENS subnames like `claude-proxy.abdul.eth`.

## Architecture

```
Buyer / Agent                    CreditFlow Proxy                    AI Provider
─────────────                    ────────────────                    ───────────
POST /v1/chat/completions  →→→  [x402 Middleware]
                                 ├─ No payment? → 402 + USDC demand
                                 └─ Has x-payment-proof header?
                                      ├─ Verify tx on Base Sepolia
                                      └─ ✅ Forward to AI Provider →→→  OpenRouter / etc.
                                                                        ←←← Response
                              ←←←  Return AI Response
```

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env with your keys

# 3. Run dev server
npm run dev

# 4. Open http://localhost:3000
```

## Environment Variables

| Variable | Description |
|---|---|
| `L1_RPC_URL` | Ethereum Sepolia RPC for ENS resolution |
| `BASE_SEPOLIA_RPC_URL` | Base Sepolia RPC for payment verification |
| `USDC_ADDRESS_BASE_SEPOLIA` | USDC contract on Base Sepolia |
| `AI_PROVIDER_API_KEY` | Your OpenRouter (or other) API key |
| `PROXY_SELLER_ENS` | Your ENS subname |
| `FALLBACK_*` | Fallback config when ENS isn't available |

## API Endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/v1/chat/completions` | OpenAI-compatible (x402-gated) |
| `GET` | `/v1/models` | List available models & pricing |
| `GET` | `/resolve/:ensName` | Resolve ENS name → proxy metadata |
| `GET` | `/registry` | List registered proxies |
| `POST` | `/registry` | Register a proxy `{ ensName, url }` |
| `GET` | `/info` | Proxy server info |
| `GET` | `/health` | Health check |

## x402 Flow

1. Client sends `POST /v1/chat/completions` without payment
2. Server responds `402` with `x402` object containing USDC payment details
3. Client sends USDC on Base Sepolia to the specified recipient
4. Client retries with `x-payment-proof: <txHash>` header
5. Server verifies on-chain, proxies to AI provider, returns response

## ENS Text Records

Sellers set these text records on their `.eth` subname:

| Key | Example Value |
|---|---|
| `x402.models` | `claude-3.5-sonnet,gpt-4o,grok-beta` |
| `x402.pricePer1kInput` | `0.0008` |
| `x402.pricePer1kOutput` | `0.0024` |
| `x402.recipient` | `0xYourWallet` |
| `x402.status` | `online` |
| `url` | `https://your-proxy.com` |

## Testing

```bash
# Run the end-to-end client test
npm run test:client
```

## Stack

- **Runtime**: Node.js + TypeScript + Express
- **Blockchain**: ethers.js v6, Base Sepolia (Chain 84532)
- **Identity**: ENS (Ethereum Name Service)
- **Payments**: x402 protocol (HTTP 402 + on-chain USDC)
- **AI**: OpenRouter (supports Claude, GPT, Gemini, Grok, etc.)

## License

MIT — Built for ETHMumbai 🇮🇳
