import { Request, Response, NextFunction } from 'express';
import { config } from '../config';
import { listAllModels } from '../services/registry';
import { supabase } from '../services/supabase';
import { verifyPayment } from '../utils/verifier';
import { logTransaction } from '../services/registry';

/**
 * x402 Payment-Required middleware.
 *
 * 1. Look up model in Supabase registry for pricing.
 * 2. If no payment proof header → 402 with USDC demand.
 * 3. If proof present → verify on-chain → next() or 402.
 *
 * For free models (price = 0), skip payment entirely.
 */
export async function x402Middleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const requestedModel = req.body?.model;
    if (!requestedModel) {
      res.status(400).json({
        error: { message: 'Missing required field: model', type: 'invalid_request_error' },
      });
      return;
    }

    // Look up model in DB for pricing
    const allModels = await listAllModels();
    const match = allModels.find(m => m.model_id === requestedModel);

    // Calculate cost
    let costPerRequest: number;
    let recipient: string;

    if (match) {
      costPerRequest =
        parseFloat(String(match.price_per_1k_input)) +
        parseFloat(String(match.price_per_1k_output));
      // Get the proxy's wallet and API credentials
      const { data: proxy } = await supabase
        .from('proxies')
        .select('wallet_address, api_key, api_endpoint')
        .eq('id', match.proxy_id)
        .single();
      recipient = proxy?.wallet_address || config.fallback.recipient;
      // Attach proxy credentials for the route handler
      (req as any)._proxyCreds = {
        api_key: proxy?.api_key || '',
        api_endpoint: proxy?.api_endpoint || '',
      };
    } else {
      // Model not in DB — use fallback pricing but still allow it
      costPerRequest =
        parseFloat(config.fallback.pricePer1kInput) +
        parseFloat(config.fallback.pricePer1kOutput);
      recipient = config.fallback.recipient;
    }

    // FREE models — skip payment entirely
    if (costPerRequest <= 0) {
      console.log(`[x402] Free model "${requestedModel}" — skipping payment.`);
      // Still attach creds for free models
      if (!(req as any)._proxyCreds && match) {
        const { data: px } = await supabase.from('proxies').select('api_key, api_endpoint').eq('id', match.proxy_id).single();
        (req as any)._proxyCreds = { api_key: px?.api_key || '', api_endpoint: px?.api_endpoint || '' };
      }
      next();
      return;
    }

    const paymentProof = req.headers['x-payment-proof'] as string | undefined;

    if (!paymentProof) {
      res
        .status(402)
        .set('X-Payment-Required', 'true')
        .json({
          error: 'Payment Required',
          x402: {
            version: '1',
            network: 'base-sepolia',
            chainId: config.baseSepolia.chainId,
            token: {
              symbol: 'USDC',
              address: config.baseSepolia.usdcAddress,
              decimals: 6,
            },
            payment: {
              recipient,
              amount: costPerRequest.toFixed(6),
              description: `Pay ${costPerRequest.toFixed(6)} USDC for 1 query to ${requestedModel}`,
            },
            instructions:
              'Send a USDC transfer on Base Sepolia to the recipient address, ' +
              'then retry this request with the header: x-payment-proof: <txHash>',
            blockExplorer: config.baseSepolia.blockExplorer,
          },
        });
      return;
    }

    // Check DB-based replay guard (survives restarts, works across instances)
    const { data: existingTx } = await supabase
      .from('transactions')
      .select('id')
      .eq('tx_hash', paymentProof.toLowerCase())
      .maybeSingle();

    if (existingTx) {
      console.warn(`[x402] Replay blocked (DB): ${paymentProof}`);
      res.status(402).json({
        error: 'Payment verification failed',
        message: 'This transaction has already been used. Please send a new payment.',
      });
      return;
    }

    // Verify on-chain
    console.log(`[x402] Verifying payment proof: ${paymentProof}`);
    const valid = await verifyPayment(paymentProof, recipient, costPerRequest);

    if (!valid) {
      res.status(402).json({
        error: 'Payment verification failed',
        message:
          'Transaction invalid, insufficient, already used, or not yet confirmed. Wait for confirmation and retry.',
      });
      return;
    }

    // Log the transaction
    await logTransaction({
      tx_hash: paymentProof,
      proxy_id: match?.proxy_id,
      model_id: requestedModel,
      amount_usdc: costPerRequest,
    }).catch(e => console.warn('[x402] Failed to log tx:', e.message));

    console.log(`[x402] ✅ Payment accepted for ${requestedModel}. Forwarding to AI.`);
    next();
  } catch (error: any) {
    console.error('[x402] Middleware error:', error);
    res.status(500).json({
      error: { message: 'Internal x402 payment error', details: error.message },
    });
  }
}
