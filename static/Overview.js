// ── Overview — DuckDB-WASM (no server required) ──────────────────────────────


function OV_OpenPanel() {
  App_HideAllViews();
  Sidebar_SetActive('nav-overview');
  document.getElementById('OVView').style.setProperty('display', 'flex', 'important');

  // Unlock analysis nav items
  ['nav-score-analysis', 'nav-score-comparison', 'nav-route-analysis'].forEach(id => {
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
    App_toast('No data loaded', 'error');
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

    App_toast('Overview updated', 'success');
  } catch (e) {
    console.error('OV_RunAnalysis error:', e);
    document.getElementById('OV_MetricGrid').innerHTML = `<div class="ov-state" style="grid-column:1/-1;">Error: ${e.message}</div>`;
    App_toast('Analysis error: ' + e.message, 'error');
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

// ── Weekday Pattern console ───────────────────────────────────────────────────
let _OV_WD_ChartType = 'bar';
let _OV_WD_Chart     = null;

;(function () {
  const _orig = typeof window.OV_OpenPanel === 'function' ? window.OV_OpenPanel : null;
  window.OV_OpenPanel = function () {
    if (_orig) _orig.apply(this, arguments);
    OV_WD_Run();
  };
})();

function OV_WD_SetType(val, btn) {
  _OV_WD_ChartType = val;
  document.querySelectorAll('#OV_WD_TypeBtns .pg-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  OV_WD_Run();
}

async function OV_WD_Run() {
  const conn = window.LD_getConn?.();
  const src  = window.LD_getSource?.();
  if (!conn || !src) return;

  const params    = window.SP_getParams?.() || {};
  const dateCol   = params.auth_date || params.combined_datetime;
  if (!dateCol) return;

  const fraudCol  = params.col1   || '';
  const fraudVals = params.values || [];

  const escaped    = fraudCol && fraudVals.length
    ? fraudVals.map(v => `'${v.replace(/'/g,"''")}'`).join(',') : '';
  const fraudFilter = escaped ? `FILTER (WHERE "${fraudCol}" IN (${escaped}))` : '';

  let totalRows = [], fraudRows = [];
  try {
    const res = await conn.query(`
      SELECT DAYNAME(TRY_CAST("${dateCol}" AS DATE)) AS period,
             ISODOW(TRY_CAST("${dateCol}" AS DATE))  AS sort_key,
             COUNT(*) AS total_cnt
             ${fraudFilter ? `, COUNT(*) ${fraudFilter} AS fraud_cnt` : ''}
      FROM ${src}
      WHERE TRY_CAST("${dateCol}" AS DATE) IS NOT NULL
      GROUP BY period, sort_key ORDER BY sort_key`);
    const rows = res.toArray();
    totalRows = rows.map(r => ({ period: String(r.period), count: Number(r.total_cnt) }));
    if (fraudFilter) fraudRows = rows.map(r => ({ period: String(r.period), count: Number(r.fraud_cnt) }));
  } catch { return; }
  if (!totalRows.length) return;

  if (_OV_WD_Chart) { _OV_WD_Chart.destroy(); _OV_WD_Chart = null; }
  const ctx = document.getElementById('OV_WD_Canvas')?.getContext('2d');
  if (!ctx) return;

  const labels = totalRows.map(r => r.period);
  const isBar  = _OV_WD_ChartType === 'bar';

  const mkDataset = (label, data, color) => isBar
    ? { label, data, backgroundColor: color, borderRadius: 4, borderWidth: 0 }
    : { label, data, borderColor: color, backgroundColor: 'transparent',
        borderWidth: 2, fill: false, tension: 0.35, pointRadius: 4, pointHoverRadius: 7 };

  const datasets = [
    mkDataset('Total', totalRows.map(r => r.count), isBar ? 'rgba(59,130,246,0.75)' : '#3B82F6'),
  ];

  if (fraudRows.length) {
    const fraudMap = {};
    fraudRows.forEach(r => { fraudMap[r.period] = r.count; });
    datasets.push(mkDataset('Fraud', labels.map(p => fraudMap[p] || 0), isBar ? 'rgba(220,38,38,0.75)' : '#DC2626'));
  }

  _OV_WD_Chart = new Chart(ctx, {
    type: _OV_WD_ChartType,
    data: { labels, datasets },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: true, position: 'bottom', labels: { boxWidth: 10, font: { size: 11, family: 'IBM Plex Sans' } } },
        tooltip: { callbacks: { label: c => `${c.dataset.label}: ${c.parsed.y.toLocaleString()}` } },
      },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 11, family: 'IBM Plex Sans' }, color: '#78716c' } },
        y: { grid: { color: 'rgba(0,0,0,0.05)' }, ticks: { font: { size: 11, family: 'IBM Plex Sans' }, color: '#78716c' } },
      },
    },
  });
}
