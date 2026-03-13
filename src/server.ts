import express from 'express';
import cors from 'cors';
import path from 'path';
import { config } from './config';
import { x402Middleware } from './middleware/x402';
import { proxyChatCompletion } from './services/ai';
import { getProxyMetadata, resolveProxyUrl } from './utils/ens';
import {
  listProxies,
  getProxy,
  registerProxy,
  updateProxyStatus,
  addModel,
  removeModel,
  listAllModels,
  getStats,
} from './services/registry';

const app = express();

app.use(cors());
app.use(express.json());

// ── Serve Frontend ──────────────────────────────────────────
app.use(express.static(path.join(__dirname, '..', 'public')));

// ── Health ──────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// ── Platform Stats ──────────────────────────────────────────
app.get('/api/stats', async (_req, res) => {
  try {
    const stats = await getStats();
    res.json(stats);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── Proxy Info ──────────────────────────────────────────────
app.get('/info', async (_req, res) => {
  try {
    const ensName = config.proxySellerEns || 'creditflow.eth';
    const metadata = await getProxyMetadata(ensName);
    res.json({
      name: 'CreditFlow.eth Proxy',
      ensName,
      chainId: config.baseSepolia.chainId,
      network: 'Base Sepolia',
      usdcAddress: config.baseSepolia.usdcAddress,
      ...metadata,
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── Models (from Supabase) ──────────────────────────────────
app.get('/v1/models', async (_req, res) => {
  try {
    const models = await listAllModels();
    const data = models.map(m => ({
      id: m.model_id,
      object: 'model',
      display_name: m.display_name,
      provider: m.provider,
      pricing: {
        per_1k_input_tokens: `${m.price_per_1k_input} USDC`,
        per_1k_output_tokens: `${m.price_per_1k_output} USDC`,
      },
      max_context_tokens: m.max_context_tokens,
    }));
    res.json({ object: 'list', data });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── ENS Resolver ────────────────────────────────────────────
app.get('/resolve/:ensName', async (req, res) => {
  try {
    const { ensName } = req.params;
    const [metadata, url] = await Promise.all([
      getProxyMetadata(ensName),
      resolveProxyUrl(ensName),
    ]);
    res.json({ ensName, url, ...metadata });
  } catch (e: any) {
    res.status(404).json({ error: e.message });
  }
});

// ── Registry (Supabase-backed) ──────────────────────────────
app.get('/api/proxies', async (_req, res) => {
  try {
    const proxies = await listProxies();
    res.json({ proxies });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/proxies/:ensName', async (req, res) => {
  try {
    const proxy = await getProxy(req.params.ensName);
    if (!proxy) { res.status(404).json({ error: 'Not found' }); return; }
    res.json(proxy);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/proxies', async (req, res) => {
  try {
    const { ens_name, proxy_url, wallet_address, description } = req.body;
    if (!ens_name || !proxy_url || !wallet_address) {
      res.status(400).json({ error: 'ens_name, proxy_url, and wallet_address are required' });
      return;
    }
    const proxy = await registerProxy({ ens_name, proxy_url, wallet_address, description });
    res.status(201).json(proxy);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.patch('/api/proxies/:id/status', async (req, res) => {
  try {
    await updateProxyStatus(req.params.id, req.body.status);
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── Model management ────────────────────────────────────────
app.post('/api/models', async (req, res) => {
  try {
    const model = await addModel(req.body);
    res.status(201).json(model);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/models/:id', async (req, res) => {
  try {
    await removeModel(req.params.id);
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── Legacy registry compat ──────────────────────────────────
app.get('/registry', async (_req, res) => {
  try {
    const proxies = await listProxies();
    res.json({ proxies });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── Core: x402-gated AI completions ─────────────────────────
app.post('/v1/chat/completions', x402Middleware, async (req, res) => {
  try {
    const result = await proxyChatCompletion(req.body);
    res.json(result);
  } catch (e: any) {
    console.error('[Server] AI proxy error:', e.message);
    res.status(502).json({
      error: { message: e.message || 'Upstream AI error', type: 'upstream_error' },
    });
  }
});

// ── Start ───────────────────────────────────────────────────
app.listen(config.port, () => {
  console.log('');
  console.log('  ╔══════════════════════════════════════════════╗');
  console.log('  ║        ⚡ CreditFlow.eth Proxy Server       ║');
  console.log('  ╠══════════════════════════════════════════════╣');
  console.log(`  ║  Port:      ${String(config.port).padEnd(33)}║`);
  console.log(`  ║  Network:   Base Sepolia (${config.baseSepolia.chainId})${' '.repeat(15)}║`);
  console.log(`  ║  ENS:       ${(config.proxySellerEns || 'fallback mode').padEnd(33)}║`);
  console.log(`  ║  Supabase:  connected                       ║`);
  console.log('  ╚══════════════════════════════════════════════╝');
  console.log('');
});

export default app;
