import axios from 'axios';
import { ethers } from 'ethers';
import dotenv from 'dotenv';
dotenv.config();

const PROXY_URL = process.env.PROXY_URL || 'http://localhost:3000';
const MODEL = process.env.TEST_MODEL || 'claude-3.5-sonnet';

const COLORS = {
  reset: '\x1b[0m',
  cyan:  '\x1b[36m',
  green: '\x1b[32m',
  yellow:'\x1b[33m',
  red:   '\x1b[31m',
  dim:   '\x1b[2m',
  bold:  '\x1b[1m',
};

function log(color: string, label: string, msg: string) {
  console.log(`${color}[${label}]${COLORS.reset} ${msg}`);
}

async function runTest() {
  console.log(`\n${COLORS.bold}═══  CreditFlow.eth Client Test  ═══${COLORS.reset}\n`);

  // ── Step 1: Send query without payment ───────────────────
  log(COLORS.cyan, 'STEP 1', `Sending query to ${PROXY_URL}/v1/chat/completions (model: ${MODEL})`);

  let paymentDetails: any;

  try {
    const res = await axios.post(`${PROXY_URL}/v1/chat/completions`, {
      model: MODEL,
      messages: [{ role: 'user', content: 'Explain x402 in one sentence.' }],
    });
    log(COLORS.red, 'UNEXPECTED', 'Got 200 without payment?! ' + JSON.stringify(res.data));
    return;
  } catch (err: any) {
    if (err.response?.status === 402) {
      log(COLORS.green, 'STEP 2', 'Received 402 Payment Required ✓');
      paymentDetails = err.response.data?.x402?.payment;
      const token = err.response.data?.x402?.token;
      console.log(`${COLORS.dim}  Recipient : ${paymentDetails?.recipient}`);
      console.log(`  Amount    : ${paymentDetails?.amount} ${token?.symbol}`);
      console.log(`  Token Addr: ${token?.address}`);
      console.log(`  Chain     : ${err.response.data?.x402?.chainId}${COLORS.reset}\n`);
    } else {
      log(COLORS.red, 'ERROR', `Unexpected: ${err.message}`);
      return;
    }
  }

  if (!paymentDetails) {
    log(COLORS.red, 'ERROR', 'No payment details received.');
    return;
  }

  // ── Step 3: On-chain USDC payment ────────────────────────
  const pk = process.env.TESTER_PRIVATE_KEY;
  if (!pk) {
    log(COLORS.yellow, 'SKIP', 'No TESTER_PRIVATE_KEY in .env — cannot perform on-chain payment.');
    log(COLORS.yellow, 'HINT', 'Fund a Base Sepolia wallet with test USDC, set TESTER_PRIVATE_KEY, and re-run.');
    return;
  }

  log(COLORS.cyan, 'STEP 3', 'Sending USDC on Base Sepolia…');
  const rpcUrl = process.env.BASE_SEPOLIA_RPC_URL || 'https://base-sepolia-rpc.publicnode.com';
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(pk, provider);

  const tokenAddr = process.env.USDC_ADDRESS_BASE_SEPOLIA || '0x036CbD53842c5426634e7929541eC2318f3dCF7e';
  const ERC20 = ['function transfer(address to, uint256 amount) returns (bool)'];
  const usdc = new ethers.Contract(tokenAddr, ERC20, wallet);

  const amount = ethers.parseUnits(paymentDetails.amount, 6);

  try {
    const tx = await usdc.transfer(paymentDetails.recipient, amount);
    log(COLORS.green, 'TX SENT', `Hash: ${tx.hash}`);
    console.log(`${COLORS.dim}  Explorer: https://base-sepolia.blockscout.com/tx/${tx.hash}${COLORS.reset}`);

    log(COLORS.cyan, 'WAITING', 'Waiting for confirmation…');
    const receipt = await tx.wait();
    log(COLORS.green, 'CONFIRMED', `Block #${receipt!.blockNumber}\n`);

    // ── Step 4: Retry with proof ───────────────────────────
    log(COLORS.cyan, 'STEP 4', 'Retrying request with x-payment-proof header…');
    const res2 = await axios.post(`${PROXY_URL}/v1/chat/completions`, {
      model: MODEL,
      messages: [{ role: 'user', content: 'Explain x402 in one sentence.' }],
    }, {
      headers: { 'x-payment-proof': tx.hash },
    });

    log(COLORS.green, 'STEP 5', '✅ AI Response received!\n');
    console.log(JSON.stringify(res2.data, null, 2));
  } catch (err: any) {
    log(COLORS.red, 'FAILED', err.message);
    if (err.response?.data) console.error(err.response.data);
  }

  console.log(`\n${COLORS.bold}═══  Test Complete  ═══${COLORS.reset}\n`);
}

runTest().catch(console.error);
