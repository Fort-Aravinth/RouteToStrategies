// ── Overview — DuckDB-WASM (no server required) ──────────────────────────────

function OV_showToast(message, type = 'success') {
  let container = document.getElementById('OV_ToastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'OV_ToastContainer';
    container.style.cssText = 'position:fixed;bottom:20px;right:20px;z-index:9999;display:flex;flex-direction:column;gap:8px;';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = 'LD_Toast ' + type;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => { toast.classList.add('hide'); setTimeout(() => toast.remove(), 300); }, 4000);
}

function OV_OpenPanel() {
  App_HideAllViews();
  Sidebar_SetActive('nav-overview');
  document.getElementById('OVView').style.setProperty('display', 'flex', 'important');

  // Unlock analysis nav items
  ['nav-rmon-import', 'nav-score-analysis', 'nav-score-comparison', 'nav-route-analysis'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.remove('ld-locked', 'sidebar-item-disabled');
  });

  OV_RunAnalysis();
}

async function OV_RunAnalysis() {
  const params = typeof window.SP_getParams === 'function' ? window.SP_getParams() : null;
  if (!params || !params.col1) {
    document.getElementById('OV_MetricGrid').innerHTML  = '<div class="ov-state">Apply Parameters first before viewing the overview.</div>';
    document.getElementById('OV_RateGrid').innerHTML    = '';
    return;
  }

  const conn = window.LD_getConn ? window.LD_getConn() : null;
  const src  = window.LD_getSource ? window.LD_getSource() : null;
  if (!conn || !src) {
    OV_showToast('No data loaded', 'error');
    return;
  }

  document.getElementById('OV_MetricGrid').innerHTML = '<div class="ov-state" style="grid-column:1/-1;">Loading…</div>';
  document.getElementById('OV_RateGrid').innerHTML   = '';

  try {
    const col1    = params.col1;
    const values  = (params.values || []).map(v => `'${v.replace(/'/g, "''")}'`).join(',');
    const numeric = params.numeric  || null;
    const object  = params.object   || null;

    const whereClause = values.length ? `WHERE "${col1}" IN (${values})` : 'WHERE 1=0';

    const totalVol  = Number((await conn.query(`SELECT COUNT(*) AS n FROM ${src}`)).toArray()[0].n);
    const fraudVol  = Number((await conn.query(`SELECT COUNT(*) AS n FROM ${src} ${whereClause}`)).toArray()[0].n);

    let totalCards = null, fraudCards = null;
    if (object) {
      totalCards = Number((await conn.query(`SELECT COUNT(DISTINCT "${object}") AS n FROM ${src}`)).toArray()[0].n);
      fraudCards = Number((await conn.query(`SELECT COUNT(DISTINCT "${object}") AS n FROM ${src} ${whereClause}`)).toArray()[0].n);
    }

    let totalValue = null, fraudValue = null;
    if (numeric) {
      totalValue = Number((await conn.query(`SELECT COALESCE(SUM("${numeric}"), 0) AS n FROM ${src}`)).toArray()[0].n);
      fraudValue = Number((await conn.query(`SELECT COALESCE(SUM("${numeric}"), 0) AS n FROM ${src} ${whereClause}`)).toArray()[0].n);
    }

    const volRate   = totalVol  > 0 ? (fraudVol  / totalVol  * 100) : 0;
    const valRate   = totalValue > 0 ? (fraudValue / totalValue * 100) : 0;

    OV_RenderMetrics({ totalVol, fraudVol, totalCards, fraudCards, totalValue, fraudValue });
    OV_RenderRates({ volRate, valRate, hasValue: numeric !== null });

    if (typeof window.LD_UnlockScoreAnalysis === 'function') window.LD_UnlockScoreAnalysis();
    OV_showToast('Overview updated', 'success');
  } catch (e) {
    console.error('OV_RunAnalysis error:', e);
    document.getElementById('OV_MetricGrid').innerHTML = `<div class="ov-state" style="grid-column:1/-1;">Error: ${e.message}</div>`;
    OV_showToast('Analysis error: ' + e.message, 'error');
  }
}

function OV_fmt(n) {
  if (n === null || n === undefined) return '—';
  if (typeof n !== 'number') return n;
  if (Number.isInteger(n)) return n.toLocaleString();
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function OV_RenderMetrics({ totalVol, fraudVol, totalCards, fraudCards, totalValue, fraudValue }) {
  const metrics = [
    { label: 'Total Volume',      value: OV_fmt(totalVol) },
    { label: 'Fraud Volume',      value: OV_fmt(fraudVol) },
    { label: 'Total Cards',       value: OV_fmt(totalCards) },
    { label: 'Fraud Cards',       value: OV_fmt(fraudCards) },
    { label: 'Total Value',       value: OV_fmt(totalValue) },
    { label: 'Value (Fraud)',     value: OV_fmt(fraudValue) },
  ];

  document.getElementById('OV_MetricGrid').innerHTML = metrics.map(m => `
    <div class="ov-metric-box">
      <div class="ov-metric-label">${m.label}</div>
      <div class="ov-metric-value">${m.value}</div>
    </div>
  `).join('');
}

function OV_RenderRates({ volRate, valRate, hasValue }) {
  const rateGrid = document.getElementById('OV_RateGrid');
  const rates = [
    { label: 'Fraud Rate (Volume)', value: volRate.toFixed(2) + '%' },
    ...(hasValue ? [{ label: 'Fraud Rate (Value)', value: valRate.toFixed(2) + '%' }] : []),
  ];
  rateGrid.style.gridTemplateColumns = `repeat(${rates.length}, 1fr)`;
  rateGrid.innerHTML = rates.map(r => `
    <div class="ov-rate-box">
      <div class="ov-rate-label">${r.label}</div>
      <div class="ov-rate-value">${r.value}</div>
    </div>
  `).join('');
}
