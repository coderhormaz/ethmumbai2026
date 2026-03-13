/* ═══════════════════════════════════════════════════════════
   CreditFlow.eth — Frontend Logic (Precision Terminal)
   ═══════════════════════════════════════════════════════════ */

const API = window.location.origin;
const $ = id => document.getElementById(id);

const dom = {
  sProxies:    $('s-proxies'),
  sModels:     $('s-models'),
  sVolume:     $('s-volume'),
  sTxns:       $('s-txns'),
  proxyList:   $('proxy-list'),
  search:      $('search'),
  regEns:      $('reg-ens'),
  regUrl:      $('reg-url'),
  regWallet:   $('reg-wallet'),
  regDesc:     $('reg-desc'),
  btnRegister: $('btn-register'),
  regResult:   $('reg-result'),
  modProxy:    $('mod-proxy'),
  modId:       $('mod-id'),
  modName:     $('mod-name'),
  modProvider: $('mod-provider'),
  modInput:    $('mod-input'),
  modOutput:   $('mod-output'),
  modCtx:      $('mod-ctx'),
  btnAddModel: $('btn-add-model'),
  modResult:   $('mod-result'),
  tryModel:    $('try-model'),
  tryPrompt:   $('try-prompt'),
  btnSend:     $('btn-send'),
  card402:     $('card-402'),
  pre402:      $('pre-402'),
  tryTx:       $('try-tx'),
  btnRetry:    $('btn-retry'),
  cardOk:      $('card-ok'),
  preOk:       $('pre-ok'),
  cardErr:     $('card-err'),
  preErr:      $('pre-err'),
  tryEmpty:    $('try-empty'),
};

let lastPayload = null;
let allProxies = [];

/* ── Init ────────────────────────────────────────────────── */
(async () => {
  await Promise.all([loadStats(), loadProxies(), loadModels()]);
  initNav();
})();

/* ── Nav active state ────────────────────────────────────── */
function initNav() {
  document.querySelectorAll('.topnav-link').forEach(a => {
    a.addEventListener('click', () => {
      document.querySelectorAll('.topnav-link').forEach(l => l.classList.remove('active'));
      a.classList.add('active');
    });
  });
}

/* ── Stats ───────────────────────────────────────────────── */
async function loadStats() {
  try {
    const r = await fetch(`${API}/api/stats`);
    const d = await r.json();
    anim(dom.sProxies, d.proxies_online);
    anim(dom.sModels, d.models_available);
    dom.sVolume.textContent = `$${d.total_volume_usdc.toFixed(2)}`;
    anim(dom.sTxns, d.total_transactions);
  } catch {}
}
function anim(el, target) {
  const dur = 500, start = performance.now();
  const step = ts => {
    const p = Math.min((ts - start) / dur, 1);
    el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3)));
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/* ── Proxies ─────────────────────────────────────────────── */
async function loadProxies() {
  try {
    const r = await fetch(`${API}/api/proxies`);
    const d = await r.json();
    allProxies = d.proxies || [];
    renderProxies(allProxies);
    populateProxySelect(allProxies);
  } catch {
    dom.proxyList.innerHTML = '<div class="skel" style="animation:none;opacity:.2">Failed to load</div>';
  }
}

function renderProxies(proxies) {
  if (!proxies.length) {
    dom.proxyList.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:48px 16px;color:var(--text3);border:1px dashed var(--border);border-radius:var(--r)">No proxies yet. <a href="#sell">Be the first →</a></div>`;
    return;
  }
  dom.proxyList.innerHTML = proxies.map(p => {
    const models = p.models || p.proxy_models || [];
    const badge = p.status === 'online' ? 'pc-badge-on' : 'pc-badge-off';
    const cheapest = models.length ? Math.min(...models.map(m => parseFloat(m.price_per_1k_input) + parseFloat(m.price_per_1k_output))) : null;
    return `
      <div class="proxy-card">
        <div class="pc-top">
          <span class="pc-ens">${esc(p.ens_name)}</span>
          <span class="pc-badge ${badge}">${p.status}</span>
        </div>
        <div class="pc-desc">${esc(p.description || 'No description.')}</div>
        <div class="pc-tags">${models.map(m => `<span class="pc-tag" title="${esc(m.provider)}">${esc(m.display_name)}</span>`).join('')}</div>
        <div class="pc-meta">
          <span>${cheapest !== null ? `From <span class="pc-price">${cheapest.toFixed(4)}</span> USDC` : ''} · ${models.length} model${models.length !== 1 ? 's' : ''}</span>
          <span class="pc-earned">Queries: ${p.total_queries || 0} · ${parseFloat(p.total_earned_usdc || 0).toFixed(2)} USDC</span>
        </div>
      </div>`;
  }).join('');
}

dom.search.addEventListener('input', () => {
  const q = dom.search.value.toLowerCase();
  if (!q) { renderProxies(allProxies); return; }
  renderProxies(allProxies.filter(p => {
    const hay = (p.ens_name + ' ' + (p.models || []).map(m => m.model_id + m.display_name + m.provider).join(' ')).toLowerCase();
    return hay.includes(q);
  }));
});

function populateProxySelect(proxies) {
  dom.modProxy.innerHTML = '<option value="">Select proxy…</option>' +
    proxies.map(p => `<option value="${p.id}">${esc(p.ens_name)}</option>`).join('');
}

/* ── Models ──────────────────────────────────────────────── */
async function loadModels() {
  try {
    const r = await fetch(`${API}/v1/models`);
    const d = await r.json();
    const models = d.data || [];
    const unique = [...new Map(models.map(m => [m.id, m])).values()];
    dom.tryModel.innerHTML = unique.map(m =>
      `<option value="${esc(m.id)}">${esc(m.display_name || m.id)} — ${m.pricing.per_1k_input_tokens} / ${m.pricing.per_1k_output_tokens} USDC</option>`
    ).join('');
  } catch {
    dom.tryModel.innerHTML = '<option>Error loading</option>';
  }
}

/* ── Register Proxy ──────────────────────────────────────── */
dom.btnRegister.addEventListener('click', async () => {
  const ens = dom.regEns.value.trim();
  const url = dom.regUrl.value.trim();
  const wallet = dom.regWallet.value.trim();
  const desc = dom.regDesc.value.trim();
  if (!ens || !url || !wallet) { showMsg(dom.regResult, 'error', 'ENS, URL, and Wallet are required.'); return; }

  dom.btnRegister.disabled = true;
  dom.btnRegister.innerHTML = '<span class="spin"></span>Registering…';
  try {
    const r = await fetch(`${API}/api/proxies`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ens_name: ens, proxy_url: url, wallet_address: wallet, description: desc }),
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || 'Failed');
    showMsg(dom.regResult, 'success', `Proxy "${ens}" registered!`);
    loadProxies(); loadStats();
  } catch (e) { showMsg(dom.regResult, 'error', e.message); }
  finally { dom.btnRegister.disabled = false; dom.btnRegister.textContent = 'Register Proxy'; }
});

/* ── Add Model ───────────────────────────────────────────── */
dom.btnAddModel.addEventListener('click', async () => {
  const proxy_id = dom.modProxy.value;
  const model_id = dom.modId.value.trim();
  const display_name = dom.modName.value.trim();
  const provider = dom.modProvider.value;
  const price_per_1k_input = parseFloat(dom.modInput.value);
  const price_per_1k_output = parseFloat(dom.modOutput.value);
  const max_context_tokens = parseInt(dom.modCtx.value) || 128000;
  if (!proxy_id || !model_id || !display_name) { showMsg(dom.modResult, 'error', 'Proxy, Model ID, and Name required.'); return; }

  dom.btnAddModel.disabled = true;
  dom.btnAddModel.innerHTML = '<span class="spin"></span>Adding…';
  try {
    const r = await fetch(`${API}/api/models`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ proxy_id, model_id, display_name, provider, price_per_1k_input, price_per_1k_output, max_context_tokens }),
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || 'Failed');
    showMsg(dom.modResult, 'success', `Model "${display_name}" added!`);
    loadProxies(); loadModels(); loadStats();
  } catch (e) { showMsg(dom.modResult, 'error', e.message); }
  finally { dom.btnAddModel.disabled = false; dom.btnAddModel.textContent = 'Add Model'; }
});

/* ── Try It ──────────────────────────────────────────────── */
dom.btnSend.addEventListener('click', async () => {
  hideCards();
  if (dom.tryEmpty) dom.tryEmpty.style.display = 'none';
  const model = dom.tryModel.value;
  const prompt = dom.tryPrompt.value.trim() || 'Hello';
  lastPayload = { model, messages: [{ role: 'user', content: prompt }] };

  dom.btnSend.disabled = true;
  dom.btnSend.innerHTML = '<span class="spin"></span>Sending…';
  try {
    const r = await fetch(`${API}/v1/chat/completions`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(lastPayload),
    });
    const body = await r.json();
    if (r.status === 402) {
      dom.pre402.textContent = JSON.stringify(body, null, 2);
      dom.card402.style.display = 'block';
    } else if (r.ok) {
      showAiResponse(body);
      dom.cardOk.style.display = 'block';
    } else {
      throw new Error(JSON.stringify(body));
    }
  } catch (e) { showErr(e.message); }
  finally { dom.btnSend.disabled = false; dom.btnSend.textContent = 'Send Query →'; }
});

dom.btnRetry.addEventListener('click', async () => {
  const tx = dom.tryTx.value.trim();
  if (!tx || !lastPayload) return;
  dom.btnRetry.disabled = true;
  dom.btnRetry.innerHTML = '<span class="spin"></span>Verifying…';
  try {
    const r = await fetch(`${API}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-payment-proof': tx },
      body: JSON.stringify(lastPayload),
    });
    const body = await r.json();
    if (r.ok) {
      dom.card402.style.display = 'none';
      showAiResponse(body);
      dom.cardOk.style.display = 'block';
    } else { throw new Error(JSON.stringify(body)); }
  } catch (e) { showErr(e.message); }
  finally { dom.btnRetry.disabled = false; dom.btnRetry.textContent = 'Verify & Retry →'; }
});

/* ── Helpers ─────────────────────────────────────────────── */
function showAiResponse(body) {
  const text = body.choices?.[0]?.message?.content || 'No content in response';
  const model = body.model || 'unknown';
  const usage = body.usage;
  let html = `<div class="ai-text">${esc(text)}</div>`;
  html += `<div class="ai-meta">`;
  html += `<span>Model: <strong>${esc(model)}</strong></span>`;
  if (usage) html += `<span>Tokens: ${usage.prompt_tokens || 0} in / ${usage.completion_tokens || 0} out</span>`;
  html += `</div>`;
  html += `<details class="ai-raw"><summary>View raw JSON</summary><pre class="codeblock">${esc(JSON.stringify(body, null, 2))}</pre></details>`;
  dom.preOk.innerHTML = html;
}

function hideCards() {
  dom.card402.style.display = 'none';
  dom.cardOk.style.display = 'none';
  dom.cardErr.style.display = 'none';
}

function showErr(msg) {
  try { msg = JSON.stringify(JSON.parse(msg), null, 2); } catch {}
  dom.preErr.textContent = msg;
  dom.cardErr.style.display = 'block';
}

function showMsg(el, type, msg) {
  el.className = 'form-msg ' + type;
  el.textContent = msg;
  el.style.display = 'block';
  setTimeout(() => { el.style.display = 'none'; }, 6000);
}

function esc(s) {
  const d = document.createElement('div');
  d.textContent = s || '';
  return d.innerHTML;
}
