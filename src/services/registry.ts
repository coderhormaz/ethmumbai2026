import { supabase } from './supabase';

export interface ProxyEntry {
  id: string;
  ens_name: string;
  proxy_url: string;
  wallet_address: string;
  description: string;
  status: string;
  total_queries: number;
  total_earned_usdc: number;
  created_at: string;
  updated_at: string;
  models?: ModelEntry[];
}

export interface ModelEntry {
  id: string;
  proxy_id: string;
  model_id: string;
  display_name: string;
  provider: string;
  price_per_1k_input: number;
  price_per_1k_output: number;
  max_context_tokens: number;
  is_available: boolean;
}

// ── Proxies ─────────────────────────────────────────────────

export async function listProxies(): Promise<ProxyEntry[]> {
  const { data, error } = await supabase
    .from('proxies')
    .select('*, proxy_models(*)')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []).map(p => ({ ...p, models: p.proxy_models }));
}

export async function getProxy(ensName: string): Promise<ProxyEntry | null> {
  const { data, error } = await supabase
    .from('proxies')
    .select('*, proxy_models(*)')
    .eq('ens_name', ensName)
    .single();

  if (error) return null;
  return { ...data, models: data.proxy_models };
}

export async function getProxyById(id: string): Promise<ProxyEntry | null> {
  const { data, error } = await supabase
    .from('proxies')
    .select('*, proxy_models(*)')
    .eq('id', id)
    .single();

  if (error) return null;
  return { ...data, models: data.proxy_models };
}

export async function registerProxy(entry: {
  ens_name: string;
  proxy_url: string;
  wallet_address: string;
  description?: string;
}): Promise<ProxyEntry> {
  const { data, error } = await supabase
    .from('proxies')
    .insert({
      ens_name: entry.ens_name,
      proxy_url: entry.proxy_url,
      wallet_address: entry.wallet_address,
      description: entry.description || '',
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateProxyStatus(id: string, status: string): Promise<void> {
  const { error } = await supabase
    .from('proxies')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) throw error;
}

// ── Models ──────────────────────────────────────────────────

export async function addModel(model: {
  proxy_id: string;
  model_id: string;
  display_name: string;
  provider: string;
  price_per_1k_input: number;
  price_per_1k_output: number;
  max_context_tokens?: number;
}): Promise<ModelEntry> {
  const { data, error } = await supabase
    .from('proxy_models')
    .insert(model)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function removeModel(modelId: string): Promise<void> {
  const { error } = await supabase.from('proxy_models').delete().eq('id', modelId);
  if (error) throw error;
}

export async function listAllModels(): Promise<ModelEntry[]> {
  const { data, error } = await supabase
    .from('proxy_models')
    .select('*')
    .eq('is_available', true);

  if (error) throw error;
  return data || [];
}

// ── Transactions ────────────────────────────────────────────

export async function logTransaction(tx: {
  tx_hash: string;
  proxy_id?: string;
  model_id: string;
  amount_usdc: number;
  buyer_address?: string;
}): Promise<void> {
  await supabase.from('transactions').insert(tx);

  // Increment proxy counters
  if (tx.proxy_id) {
    const { data: proxy } = await supabase
      .from('proxies')
      .select('total_queries, total_earned_usdc')
      .eq('id', tx.proxy_id)
      .single();

    if (proxy) {
      await supabase
        .from('proxies')
        .update({
          total_queries: (proxy.total_queries || 0) + 1,
          total_earned_usdc: parseFloat(String(proxy.total_earned_usdc || 0)) + tx.amount_usdc,
          updated_at: new Date().toISOString(),
        })
        .eq('id', tx.proxy_id);
    }
  }
}

export async function getStats() {
  const { count: proxyCount } = await supabase
    .from('proxies')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'online');

  const { count: modelCount } = await supabase
    .from('proxy_models')
    .select('*', { count: 'exact', head: true })
    .eq('is_available', true);

  const { data: txStats } = await supabase
    .from('transactions')
    .select('amount_usdc');

  const totalVolume = (txStats || []).reduce((sum, t) => sum + parseFloat(String(t.amount_usdc)), 0);

  return {
    proxies_online: proxyCount || 0,
    models_available: modelCount || 0,
    total_volume_usdc: totalVolume,
    total_transactions: txStats?.length || 0,
  };
}
