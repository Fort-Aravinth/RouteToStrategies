// ── Spike Report ──────────────────────────────────────────────────────────────

// Patch App_HideAllViews to include SR + SRM — avoids touching the org MainContent.js
(function () {
  const _orig = typeof App_HideAllViews === 'function' ? App_HideAllViews : null;
  window.App_HideAllViews = function () {
    if (_orig) _orig();
    document.querySelector('.shell')?.classList.remove('sr-active');
    ['SR_MiniNav', 'SRM_MiniNav'].forEach(id => {
      const nav = document.getElementById(id);
      if (nav) nav.style.display = 'none';
    });
    ['SRView', 'SRMView'].forEach(id => {
      const v = document.getElementById(id);
      if (v) v.style.display = 'none';
    });
    document.querySelector('.shell')?.classList.remove('sr-panel-active', 'srm-panel-active');
    SR_tourDismiss();
    SRM_tourDismiss();
  };
})();

// ── Tutorial ──────────────────────────────────────────────────────────────────
const _SR_TOUR_STEPS = [
  { title: 'Load Your Data',     body: 'Load a dataset from the sidebar, then set a <strong>date column</strong> in Set Parameters. The Spike Report uses that column to plot daily transaction volume.' },
  { title: 'Analysis Window',    body: 'Choose a rolling window — <strong>7, 14, 21 or 28 days</strong>. Use the <strong>← →</strong> arrows to shift the window to earlier periods and compare across time.' },
  { title: 'Metric',             body: 'Switch between <strong>Total</strong> (all transactions) and <strong>Fraud</strong> (flagged rows only) to see how each metric\'s daily pattern differs.' },
  { title: 'Reading the Chart',  body: 'Days with more than <strong>1.5× the average</strong> volume are flagged as spikes (⚠) in the table and highlighted in the chart. The peak day and spike count are shown in the summary cards.' },
];
let _SR_tourStep    = 0;
let _SR_tourEnabled = false;

function SR_tourShow(step) {
  _SR_tourStep = step;
  const s = _SR_TOUR_STEPS[step];
  if (!s) { SR_tourDismiss(); return; }
  const total = _SR_TOUR_STEPS.length;
  let el = document.getElementById('SR_TourCard');
  if (!el) {
    el = document.createElement('div');
    el.id = 'SR_TourCard';
    el.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:99998;';
    document.body.appendChild(el);
  }
  el.innerHTML = `
    <div class="gs-toast" id="SR_TourInner" style="border-left-color:var(--brand-dm);">
      <div class="gs-tab-strip" onclick="SR_tourTabExpand()" title="Expand">
        <span class="gs-tab-arrow">›</span>
        <span class="gs-tab-label">Step ${step+1} of ${total}</span>
      </div>
      <div class="gs-toast-inner">
        <div class="gs-toast-header">
          <div>
            <div class="gs-toast-step" style="color:var(--brand-dm);">Step ${step+1} of ${total}</div>
            <div class="gs-toast-title">${s.title}</div>
          </div>
          <button class="gs-toast-btn-collapse" onclick="SR_tourTabCollapse()" title="Collapse to tab" style="background:var(--brand-dm-dim);border-color:var(--brand-dm);color:var(--brand-dm);">
            <svg viewBox="0 0 16 16" width="10" height="10" fill="none"><path d="M10 3H13V13H10M6 8H2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
        </div>
        <div class="gs-toast-body">${s.body}</div>
        <div class="gs-toast-actions">
          <button class="gs-toast-btn-back" onclick="SR_tourShow(_SR_tourStep - 1)" style="${step === 0 ? 'visibility:hidden;' : ''}">← Back</button>
          <button class="gs-toast-btn-next" onclick="SR_tourNext()" style="background:var(--brand-dm);">${step+1 < total ? 'Next →' : 'Finish ✓'}</button>
        </div>
      </div>
    </div>`;
}

function SR_tourTabCollapse() {
  const el = document.getElementById('SR_TourInner');
  if (!el) return;
  const rect = el.getBoundingClientRect();
  el.style.top    = '';
  el.style.bottom = (window.innerHeight - rect.bottom) + 'px';
  el.classList.add('gs-tabbed');
  const strip = el.querySelector('.gs-tab-strip');
  if (strip) strip.style.height = rect.height + 'px';
}

function SR_tourTabExpand() {
  const el = document.getElementById('SR_TourInner');
  if (!el) return;
  el.style.top = el.style.bottom = '';
  el.classList.remove('gs-tabbed');
}

function SR_tourNext() { SR_tourShow(_SR_tourStep + 1); }

function SR_tourDismiss() {
  document.getElementById('SR_TourCard')?.remove();
  _SR_tourEnabled = false;
  document.getElementById('SR_HelpBtn')?.classList.remove('tutorial-active');
}

function SR_HelpPrompt() {
  _SR_tourEnabled = !_SR_tourEnabled;
  document.getElementById('SR_HelpBtn')?.classList.toggle('tutorial-active', _SR_tourEnabled);
  if (_SR_tourEnabled) {
    SR_tourShow(0);
  } else {
    SR_tourDismiss();
  }
}

if (typeof App_RegisterTutorial === 'function') App_RegisterTutorial('sr-active', SR_HelpPrompt);


let _SR_Chart = null;
let _SR_BreakdownCharts = [];
const _SR_PALETTE = ['#3B82F6','#10B981','#F59E0B','#8B5CF6','#EC4899','#06B6D4','#84CC16','#F97316'];

// ── Open ──────────────────────────────────────────────────────────────────────
function SR_OpenPanel() {
  if (typeof App_HideAllViews === 'function') App_HideAllViews();
  document.documentElement.style.setProperty('--toast-brand', '#DC2626');
  document.querySelector('.shell')?.classList.add('sr-active', 'sr-panel-active');
  const view = document.getElementById('SRView');
  if (view) view.style.removeProperty('display');
  // Set after tick — App_HideAllViews hardcoded list doesn't include SR_MiniNav
  // but the shell class flip needs one frame to settle
  const nav = document.getElementById('SR_MiniNav');
  if (nav) { nav.style.removeProperty('display'); nav.style.display = 'flex'; }
  Sidebar_SetActive('nav-spike-report');
  SR_RenderEmpty();
  SR_RenderParams();
  SR_RefreshExtraCards();
  MN_initScrollArrows('SR_MiniNav');
}

// ── Empty state ───────────────────────────────────────────────────────────────
function SR_DestroyCharts() {
  if (_SR_Chart) { _SR_Chart.destroy(); _SR_Chart = null; }
  _SR_BreakdownCharts.forEach(c => c.destroy());
  _SR_BreakdownCharts = [];
}

function SR_RenderEmpty() {
  const view = document.getElementById('SRView');
  if (!view) return;
  SR_DestroyCharts();
  view.innerHTML = '';
}

// ── Run Analysis ──────────────────────────────────────────────────────────────
async function SR_RunAnalysis({ winSize, offset = 0, metric, addFilters = {} }) {
  const conn = window.LD_getConn?.() || window._SR_demoConn;
  const src  = window.LD_getSource?.() || window._SR_demoSrc;
  if (!conn || !src) {
    alert('No data loaded. Load a dataset first, or click Load Demo Data.');
    return;
  }

  const params  = window.SP_getParams?.() || {};
  const dateCol = params.auth_date || params.combined_datetime
               || (window._SR_demoSrc ? 'transaction_date' : null);
  if (!dateCol) {
    alert('No date column set. Configure a date column in Set Parameters first.');
    return;
  }

  const fraudCol  = params.col1   || (window._SR_demoSrc ? 'fraud_flag'  : '');
  const fraudVals = params.values || (window._SR_demoSrc ? ['1']          : []);

  // ── Build fraud filter clause ─────────────────────────────────────────────
  let fraudClause = '';
  if (metric === 'fraud' && fraudCol && fraudVals.length) {
    const escaped = fraudVals.map(v => `'${v.replace(/'/g, "''")}'`).join(', ');
    fraudClause = `AND "${fraudCol}" IN (${escaped})`;
  }

  // ── Build additional column filter clause ─────────────────────────────────
  let addClause = '';
  for (const [col, vals] of Object.entries(addFilters)) {
    if (!vals.length) continue;
    const escaped = vals.map(v => `'${v.replace(/'/g, "''")}'`).join(', ');
    addClause += ` AND "${col}" IN (${escaped})`;
  }

  // ── Build query ───────────────────────────────────────────────────────────
  if (typeof SR_showBadge === 'function') SR_showBadge('loading', 'Running spike analysis…');
  const _srStart = performance.now();
  const days = parseInt(winSize, 10);
  const sql = `
    WITH _max AS (SELECT MAX(TRY_CAST("${dateCol}" AS DATE)) AS d FROM ${src})
    SELECT
      CAST(TRY_CAST("${dateCol}" AS DATE) AS VARCHAR) AS period,
      COUNT(*) AS cnt
    FROM ${src}
    WHERE TRY_CAST("${dateCol}" AS DATE) >  (SELECT d FROM _max) - INTERVAL '${days + offset} days'
      AND TRY_CAST("${dateCol}" AS DATE) <= (SELECT d FROM _max) - INTERVAL '${offset} days'
      ${fraudClause}${addClause}
    GROUP BY period
    ORDER BY period
  `;

  let rows = [];
  try {
    const result = await conn.query(sql);
    rows = result.toArray().map(r => ({
      period: String(r.period),
      count:  Number(r.cnt),
    }));
  } catch (e) {
    alert('Query failed: ' + e.message);
    return;
  }

  if (!rows.length) {
    alert('No data returned for this selection.');
    return;
  }

  // ── Compute stats ─────────────────────────────────────────────────────────
  const total  = rows.reduce((s, r) => s + r.count, 0);
  const avg    = total / rows.length;
  const peak   = rows.reduce((p, r) => r.count > p.count ? r : p, rows[0]);
  const spikes = rows.filter(r => r.count > avg * 1.5);

  if (typeof SR_UpdateWindowRange === 'function') {
    SR_UpdateWindowRange(rows[0]?.period, rows[rows.length - 1]?.period);
  }

  SR_RenderResults({ rows, avg, peak, spikes, winSize, metric });

  if (typeof SR_showBadge === 'function') {
    const _srSecs = ((performance.now() - _srStart) / 1000).toFixed(2);
    SR_showBadge('ready', `<strong>Spike Report ready</strong> &nbsp;·&nbsp; ${total.toLocaleString()} txns &nbsp;·&nbsp; ${_srSecs}s`);
  }
}

// ── Breakdown query ───────────────────────────────────────────────────────────
async function SR_QueryBreakdown({ conn, src, dateCol, col, winSize, offset = 0, fraudClause, addClause = '' }) {
  const safeCol = col.replace(/'/g, "''");
  const days    = parseInt(winSize, 10);
  const sql = `
    WITH _max AS (SELECT MAX(TRY_CAST("${dateCol}" AS DATE)) AS d FROM ${src}),
    top_vals AS (
      SELECT CAST("${safeCol}" AS VARCHAR) AS grp
      FROM ${src} WHERE TRY_CAST("${dateCol}" AS DATE) IS NOT NULL ${fraudClause}${addClause}
      GROUP BY grp ORDER BY COUNT(*) DESC LIMIT 8
    )
    SELECT CAST(TRY_CAST("${dateCol}" AS DATE) AS VARCHAR) AS period,
           CAST("${safeCol}" AS VARCHAR) AS grp, COUNT(*) AS cnt
    FROM ${src}
    WHERE TRY_CAST("${dateCol}" AS DATE) >  (SELECT d FROM _max) - INTERVAL '${days + offset} days'
      AND TRY_CAST("${dateCol}" AS DATE) <= (SELECT d FROM _max) - INTERVAL '${offset} days'
      ${fraudClause}${addClause}
      AND CAST("${safeCol}" AS VARCHAR) IN (SELECT grp FROM top_vals)
    GROUP BY period, grp ORDER BY period, grp`;
  try {
    const res = await conn.query(sql);
    return res.toArray().map(r => ({
      period: String(r.period),
      grp:    String(r.grp),
      count:  Number(r.cnt),
    }));
  } catch { return null; }
}

// ── Render ────────────────────────────────────────────────────────────────────
function SR_RenderResults({ rows, avg, peak, spikes, winSize, metric }) {
  const view = document.getElementById('SRView');
  if (!view) return;

  SR_DestroyCharts();

  const winLabel    = winSize === 'wd' ? 'Weekdays' : winSize + ' days';
  const metricLabel = metric  === 'fraud' ? 'Fraud' : 'Total';

  const tableRows = rows.map(r => {
    const delta   = avg > 0 ? ((r.count - avg) / avg * 100) : 0;
    const isSpike = r.count > avg * 1.5;
    const sign    = delta >= 0 ? '+' : '';
    const deltaClass = delta > 20 ? 'SR_delta--up' : delta < -20 ? 'SR_delta--dn' : '';
    return `
      <tr class="${isSpike ? 'SR_row--spike' : ''}">
        <td>${r.period}</td>
        <td>${r.count.toLocaleString()}</td>
        <td class="${deltaClass}">${avg > 0 ? sign + Math.round(delta) + '%' : '—'}</td>
        <td>${isSpike ? '<span class="SR_spike_badge">⚠ spike</span>' : ''}</td>
      </tr>`;
  }).join('');

  view.innerHTML = `
    <div class="pg-layout-row">
      <div class="pg-card">
        <div class="pg-card-header">
          <span class="pg-card-title">Transaction Volume</span>
          <span class="pg-card-label">${winLabel} · ${metricLabel}</span>
        </div>
        <div class="pg-card-divider"></div>
        <div class="pg-card-body">
          <div class="SR_chart_wrap"><canvas id="SR_ChartCanvas"></canvas></div>
        </div>
      </div>
    </div>

    <div class="pg-layout-row pg-cols-3">
      <div class="pg-card">
        <div class="pg-card-header"><span class="pg-card-title">Peak Day</span></div>
        <div class="pg-card-divider"></div>
        <div class="pg-card-body"><div class="SR_stat">${peak.period}</div></div>
      </div>
      <div class="pg-card">
        <div class="pg-card-header"><span class="pg-card-title">Peak Value</span></div>
        <div class="pg-card-divider"></div>
        <div class="pg-card-body"><div class="SR_stat">${peak.count.toLocaleString()}</div></div>
      </div>
      <div class="pg-card">
        <div class="pg-card-header"><span class="pg-card-title">Spikes</span></div>
        <div class="pg-card-divider"></div>
        <div class="pg-card-body">
          <div class="SR_stat ${spikes.length > 0 ? 'SR_stat--spike' : ''}">${spikes.length}</div>
        </div>
      </div>
    </div>

    <div class="pg-layout-row">
      <div class="pg-card">
        <div class="pg-card-header">
          <span class="pg-card-title">Daily Breakdown</span>
          <span class="pg-card-label">avg ${Math.round(avg).toLocaleString()} · ⚠ = &gt;1.5× avg</span>
        </div>
        <div class="pg-card-divider"></div>
        <div class="pg-card-body">
          <div class="pg-table-wrap" style="max-height:640px;overflow-y:auto;">
            <table class="pg-table">
              <thead style="position:sticky;top:0;z-index:1;"><tr>
                <th>Period</th>
                <th>Transactions</th>
                <th>vs Avg</th>
                <th>Flag</th>
              </tr></thead>
              <tbody>${tableRows}</tbody>
            </table>
          </div>
        </div>
      </div>
    </div>

  `;

  SR_DrawChart(rows, avg);
}

// ── Breakdown chart ───────────────────────────────────────────────────────────
function SR_DrawBreakdownChart(canvasId, rows) {
  const ctx = document.getElementById(canvasId)?.getContext('2d');
  if (!ctx) return;

  const periods = [...new Set(rows.map(r => r.period))];
  const groups  = [...new Set(rows.map(r => r.grp))];
  const lookup  = {};
  rows.forEach(r => { lookup[`${r.period}||${r.grp}`] = r.count; });

  const datasets = groups.map((grp, i) => {
    const color = _SR_PALETTE[i % _SR_PALETTE.length];
    return {
      label: grp,
      data:  periods.map(p => lookup[`${p}||${grp}`] || 0),
      borderColor:     color,
      backgroundColor: color + '18',
      borderWidth: 1.8,
      fill: false,
      tension: 0.3,
      pointRadius: 3,
      pointHoverRadius: 6,
    };
  });

  const chart = new Chart(ctx, {
    type: 'line',
    data: { labels: periods, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
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
  _SR_BreakdownCharts.push(chart);
}

// ── Chart ─────────────────────────────────────────────────────────────────────
function SR_DrawChart(rows, avg) {
  const ctx = document.getElementById('SR_ChartCanvas')?.getContext('2d');
  if (!ctx) return;

  const labels       = rows.map(r => r.period);
  const data         = rows.map(r => r.count);
  const pointColors  = rows.map(r => r.count > avg * 1.5 ? '#DC2626' : 'rgba(220,38,38,0.5)');
  const pointSizes   = rows.map(r => r.count > avg * 1.5 ? 7 : 4);

  _SR_Chart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        data,
        borderColor: '#DC2626',
        backgroundColor: 'rgba(220,38,38,0.07)',
        borderWidth: 2,
        fill: true,
        tension: 0.3,
        pointBackgroundColor: pointColors,
        pointBorderColor:     pointColors,
        pointRadius:          pointSizes,
        pointHoverRadius:     8,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: c => c.parsed.y.toLocaleString() + ' transactions',
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { font: { size: 11, family: 'IBM Plex Sans' }, color: '#78716c' },
        },
        y: {
          grid: { color: 'rgba(0,0,0,0.05)' },
          ticks: { font: { size: 11, family: 'IBM Plex Sans' }, color: '#78716c' },
        },
      },
    },
  });
}
