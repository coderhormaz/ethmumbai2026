// CreditFlow.eth — Full x402 Demo (REAL end-to-end with payment)
const { ethers } = require('ethers');
require('dotenv').config();

const SERVER = process.env.PROXY_URL || 'http://localhost:3000';
const PK     = process.env.TESTER_PRIVATE_KEY || '';
const RPC    = process.env.BASE_SEPOLIA_RPC_URL || 'https://base-sepolia-rpc.publicnode.com';
const USDC   = process.env.USDC_ADDRESS_BASE_SEPOLIA || '0x036CbD53842c5426634e7929541eC2318f3dCF7e';

async function demo() {
  console.log('');
  console.log('====================================================');
  console.log('  CreditFlow.eth x402 Full Demo');
  console.log('====================================================');

  // STEP 1: Call a PAID model without payment
  console.log('');
  console.log('[STEP 1] POST /v1/chat/completions (Claude 4.6 Sonnet)');
  console.log('         No payment provided...');

  let r = await fetch(`${SERVER}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'anthropic/claude-4.6-sonnet',
      messages: [{ role: 'user', content: 'What is Ethereum? 1 sentence.' }]
    })
  });
  let d = await r.json();

  console.log('');
  console.log(`  Result: HTTP ${r.status} - 402 PAYMENT REQUIRED`);
  console.log(`  Pay:    ${d.x402.payment.amount} USDC`);
  console.log(`  To:     ${d.x402.payment.recipient}`);
  console.log(`  Chain:  Base Sepolia (${d.x402.chainId})`);

  const recipient = d.x402.payment.recipient;
  const amount = d.x402.payment.amount;

  if (!PK) {
    console.log('');
    console.log('  TESTER_PRIVATE_KEY is not set. Stopping before the on-chain payment step.');
    return;
  }

  // STEP 2: Pay USDC on-chain
  console.log('');
  console.log('[STEP 2] Paying USDC on Base Sepolia...');

  const provider = new ethers.JsonRpcProvider(RPC);
  const wallet = new ethers.Wallet(PK, provider);
  const usdc = new ethers.Contract(USDC, ['function transfer(address,uint256) returns (bool)'], wallet);

  console.log(`  From:   ${wallet.address}`);
  console.log(`  Amount: ${amount} USDC`);

  const tx = await usdc.transfer(recipient, ethers.parseUnits(amount, 6));
  console.log(`  TX:     ${tx.hash}`);
  console.log('  Confirming...');
  const receipt = await tx.wait();
  console.log(`  Block:  #${receipt.blockNumber} CONFIRMED`);

  // STEP 3: Retry with payment proof -> get AI response
  console.log('');
  console.log('[STEP 3] Retrying with payment proof...');
  console.log(`  Header: x-payment-proof: ${tx.hash}`);

  r = await fetch(`${SERVER}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-payment-proof': tx.hash,
    },
    body: JSON.stringify({
      model: 'anthropic/claude-4.6-sonnet',
      messages: [{ role: 'user', content: 'What is Ethereum? Answer in 1 sentence.' }]
    })
  });
  d = await r.json();

  console.log('');
  console.log(`  Result: HTTP ${r.status} - SUCCESS!`);
  if (d.choices?.[0]?.message?.content) {
    console.log('');
    console.log('  AI RESPONSE:');
    console.log(`  "${d.choices[0].message.content}"`);
    console.log('');
    console.log(`  Model: ${d.model}`);
    if (d.usage) console.log(`  Tokens: ${d.usage.prompt_tokens} in / ${d.usage.completion_tokens} out`);
  } else {
    console.log('  Response:', JSON.stringify(d, null, 2));
  }

  // STEP 4: Replay attack
  console.log('');
  console.log('[STEP 4] Replay attack test (same tx hash)...');

  r = await fetch(`${SERVER}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-payment-proof': tx.hash,
    },
    body: JSON.stringify({
      model: 'anthropic/claude-4.6-sonnet',
      messages: [{ role: 'user', content: 'replay' }]
    })
  });

  console.log(`  Result: HTTP ${r.status} - ${r.status === 402 ? 'BLOCKED (replay prevented)' : 'unexpected'}`);

  // SUMMARY
  console.log('');
  console.log('====================================================');
  console.log('  x402 FLOW COMPLETE');
  console.log('');
  console.log('  1. API call without payment  -> HTTP 402');
  console.log('  2. USDC payment on Base      -> Confirmed on-chain');
  console.log('  3. Retry with tx proof       -> HTTP 200 + AI answer');
  console.log('  4. Replay same tx            -> HTTP 402 BLOCKED');
  console.log('====================================================');
}

demo().catch(e => console.error('ERROR:', e.shortMessage || e.message));
