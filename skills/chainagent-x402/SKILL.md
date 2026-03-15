---
name: chainagent-x402
description: >
  Use ChainAgent to query AI models (Claude, GPT, Gemini, Grok, etc.) via x402 micropayments
  on Base Sepolia. Prefers free models to save USDC. Handles the full x402 lifecycle: discover
  models, send queries, handle 402 responses, pay USDC on-chain, and retry with tx proof.
  Use when the user wants to query AI models through a decentralized proxy or pay-per-query in USDC.
metadata: {"version": "1.0.0", "author": "chainagent.eth", "tags": ["web3", "ens", "x402", "ai", "usdc", "base"]}
---

# ChainAgent — x402 AI Query Skill

Query any AI model through the ChainAgent decentralized proxy using x402 micropayments in USDC on Base Sepolia.

**Live endpoint**: `https://ethmumbai-brown.vercel.app`

---

## ⚠️ BEFORE YOU START — Wallet Setup

Before using paid models, you MUST have a funded wallet on Base Sepolia.

**Ask the user:**
> "To use paid AI models through ChainAgent, your wallet needs USDC on Base Sepolia (testnet). Do you have a funded wallet? If not, here's how to get set up:"

### How to fund a Base Sepolia wallet:
1. Get a wallet address on Base Sepolia (chain ID: `84532`)
2. Get testnet ETH from [Base Sepolia Faucet](https://www.alchemy.com/faucets/base-sepolia)
3. Get testnet USDC — the USDC contract is `0x036CbD53842c5426634e7929541eC2318f3dCF7e`
4. You can bridge or mint testnet USDC via Base Sepolia faucets

**Required environment variables for on-chain payments:**
```
TESTER_PRIVATE_KEY=<your-base-sepolia-private-key>
BASE_SEPOLIA_RPC_URL=https://base-sepolia-rpc.publicnode.com
```

> **If the user does not have funds, suggest using FREE models instead (no wallet needed).**

---

## Step 1: Discover Available Models (ALWAYS DO THIS FIRST)

```http
GET https://ethmumbai-brown.vercel.app/v1/models
```

This returns all available models with pricing. **Always prefer FREE models** (where both input and output pricing are `0 USDC`).

```json
{
  "object": "list",
  "data": [
    {
      "id": "nvidia/nemotron-3-super-120b-a12b:free",
      "display_name": "Nemotron 3 Super 120B (Free)",
      "pricing": {
        "per_1k_input_tokens": "0 USDC",
        "per_1k_output_tokens": "0 USDC"
      }
    },
    {
      "id": "anthropic/claude-4.6-sonnet",
      "display_name": "Claude 4.6 Sonnet",
      "pricing": {
        "per_1k_input_tokens": "0.003 USDC",
        "per_1k_output_tokens": "0.015 USDC"
      }
    }
  ]
}
```

### Model Selection Priority:
1. **FREE models first** — pricing shows `0 USDC` → no payment needed, skip to Step 2B
2. **Paid models** — only if user explicitly requests or no free model available → follow full x402 flow

---

## Step 2A: Query a FREE Model (No Payment Needed!)

For free models, just send the request directly — no USDC, no wallet, no payment proof needed.

```http
POST https://ethmumbai-brown.vercel.app/v1/chat/completions
Content-Type: application/json

{
  "model": "nvidia/nemotron-3-super-120b-a12b:free",
  "messages": [
    {"role": "user", "content": "What is Ethereum? Explain briefly."}
  ]
}
```

**Response** (HTTP 200 — immediate AI answer):
```json
{
  "choices": [
    {
      "message": {
        "role": "assistant",
        "content": "Ethereum is a decentralized blockchain platform that enables smart contracts and decentralized applications..."
      }
    }
  ],
  "model": "nvidia/nemotron-3-super-120b-a12b:free",
  "usage": {"prompt_tokens": 12, "completion_tokens": 85}
}
```

**This is the preferred path. Use free models whenever possible.**

---

## Step 2B: Query a PAID Model (Triggers 402 Payment Flow)

Only do this if the user specifically asks for a paid model.

```http
POST https://ethmumbai-brown.vercel.app/v1/chat/completions
Content-Type: application/json

{
  "model": "anthropic/claude-4.6-sonnet",
  "messages": [
    {"role": "user", "content": "What is Ethereum?"}
  ]
}
```

**Response** (HTTP 402 — Payment Required):
```json
{
  "error": "Payment Required",
  "x402": {
    "version": "1",
    "network": "base-sepolia",
    "chainId": 84532,
    "token": {
      "symbol": "USDC",
      "address": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
      "decimals": 6
    },
    "payment": {
      "recipient": "0xBbCc7718DA046086F3C487c100Acd95ade70f2E3",
      "amount": "0.018000",
      "description": "Pay 0.018000 USDC for 1 query"
    }
  }
}
```

**Extract these from the response:**
- `recipient` = `x402.payment.recipient`
- `amount` = `x402.payment.amount`

---

## Step 3: Pay USDC On-Chain (Only for Paid Models)

**Before sending payment, ask the user:**
> "This query costs {amount} USDC on Base Sepolia. Shall I proceed with the payment from your wallet?"

Send a USDC ERC-20 `transfer` to the recipient on Base Sepolia:

```javascript
const { ethers } = require('ethers');

const provider = new ethers.JsonRpcProvider('https://base-sepolia-rpc.publicnode.com');
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

const USDC_ADDRESS = '0x036CbD53842c5426634e7929541eC2318f3dCF7e';
const usdc = new ethers.Contract(
  USDC_ADDRESS,
  ['function transfer(address to, uint256 amount) returns (bool)'],
  wallet
);

// amount from the 402 response, e.g. "0.018000"
const tx = await usdc.transfer(recipient, ethers.parseUnits(amount, 6));
console.log('TX Hash:', tx.hash);

// IMPORTANT: Wait for on-chain confirmation before retrying!
const receipt = await tx.wait();
console.log('Confirmed in block:', receipt.blockNumber);
```

**Critical**: You MUST wait for `tx.wait()` to complete before proceeding. The server verifies the transaction on-chain.

Save the `tx.hash` — you need it in Step 4.

---

## Step 4: Retry with Payment Proof

Re-send the exact same request with the `x-payment-proof` header:

```http
POST https://ethmumbai-brown.vercel.app/v1/chat/completions
Content-Type: application/json
x-payment-proof: 0x<YOUR_TX_HASH>

{
  "model": "anthropic/claude-4.6-sonnet",
  "messages": [
    {"role": "user", "content": "What is Ethereum?"}
  ]
}
```

**Response** (HTTP 200 — AI answer):
```json
{
  "choices": [
    {
      "message": {
        "role": "assistant",
        "content": "Ethereum is a decentralized blockchain platform..."
      }
    }
  ],
  "model": "anthropic/claude-4.6-sonnet",
  "usage": {"prompt_tokens": 12, "completion_tokens": 45}
}
```

---

## Other Useful Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Health check — returns `{"status":"ok"}` |
| `GET` | `/api/stats` | Platform stats (proxies online, models, volume) |
| `GET` | `/api/proxies` | List all registered proxy sellers |
| `GET` | `/resolve/{ensName}` | Resolve ENS name → metadata, avatar, models |
| `GET` | `/info` | Server info (network, ENS name, payment details) |

---

## Error Handling

| HTTP Code | Meaning | What To Do |
|---|---|---|
| `200` | Success | Parse `choices[0].message.content` for the AI answer |
| `400` | Missing `model` field | Add required `model` field to request body |
| `402` | Payment required OR payment verification failed | Either send USDC payment, or check if tx is confirmed |
| `401` | Seller's upstream API key is invalid | Try a different proxy or model |
| `429` | Rate limited by AI provider | Wait 30 seconds, then retry |
| `502` | Upstream AI error | Try a different model |
| `503` | Cannot connect to AI provider | Try later |

---

## Important Rules

1. **Always prefer free models** — check pricing in `/v1/models` first
2. **Each tx hash can only be used ONCE** — replay attacks are blocked
3. **Wait for tx confirmation** before retrying with proof
4. **Always ask before spending** — confirm with user before on-chain payments
5. **If user has no wallet/funds** — use free models only, suggest they set up a wallet for paid models
6. **All payments are testnet** — Base Sepolia USDC, not real money
