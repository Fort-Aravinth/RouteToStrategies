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
  };
})();

// ── Spike Report by Merchant ──────────────────────────────────────────────────

function SRM_OpenPanel() {
  if (typeof App_HideAllViews === 'function') App_HideAllViews();
  document.querySelector('.shell')?.classList.add('sr-active');
  const nav = document.getElementById('SRM_MiniNav');
  if (nav) { nav.style.removeProperty('display'); nav.style.display = 'flex'; }
  const view = document.getElementById('SRMView');
  if (view) view.style.removeProperty('display');
  Sidebar_SetActive('nav-spike-merchant');
  SRM_RenderEmpty();
  SRM_RenderParams();
  SRM_PopulateCols();
  SRM_RefreshExtraCards();
  MN_initScrollArrows('SRM_MiniNav');
}

function SRM_RenderEmpty() {
  const view = document.getElementById('SRMView');
  if (!view) return;
  view.innerHTML = `
    <div class="pg-layout-row">
      <div class="pg-card">
        <div class="pg-card-header">
          <span class="pg-card-title">Spike Report by Merchant</span>
          <span class="pg-card-label">select a column in Available Columns to begin</span>
        </div>
        <div class="pg-card-divider"></div>
        <div class="pg-card-body">
          <div class="SR_empty">Select one or more columns from <strong>Available Columns</strong> in the nav panel to run the breakdown.</div>
        </div>
      </div>
    </div>`;
}

async function SRM_RunAnalysis({ cols, winSize, offset = 0, metric }) {
  const conn = window.LD_getConn?.() || window._SR_demoConn;
  const src  = window.LD_getSource?.() || window._SR_demoSrc;
  const view = document.getElementById('SRMView');
  if (!conn || !src || !view) return;

  const params   = window.SP_getParams?.() || {};
  const dateCol  = params.auth_date || (window._SR_demoSrc ? 'transaction_date' : null);
  const fraudCol = params.col1      || (window._SR_demoSrc ? 'fraud_flag'       : '');
  const fraudVals= params.values    || (window._SR_demoSrc ? ['1']              : []);

  if (!dateCol) { SRM_RenderEmpty(); return; }
  if (!cols || !cols.length) { SRM_RenderEmpty(); return; }

  SR_DestroyCharts();

  const days = parseInt(winSize, 10);
  const fraudCase = (fraudCol && fraudVals.length)
    ? `SUM(CASE WHEN CAST("${fraudCol}" AS VARCHAR) IN (${fraudVals.map(v=>`'${v.replace(/'/g,"''")}'`).join(',')}) THEN 1 ELSE 0 END)`
    : '0';
  const fraudClause = '';

  const cards = [];
  for (const col of cols) {
    const safeCol = col.replace(/'/g, "''");
    // Summary table query
    const sql = `
      WITH _max AS (SELECT MAX(TRY_CAST("${dateCol}" AS DATE)) AS d FROM ${src})
      SELECT
        CAST("${safeCol}" AS VARCHAR)                              AS grp,
        COUNT(*)                                                   AS total,
        ${fraudCase}                                               AS fraud,
        ROUND(100.0 * ${fraudCase} / NULLIF(COUNT(*), 0), 1)      AS fraud_rate
      FROM ${src}, _max
      WHERE TRY_CAST("${dateCol}" AS DATE) >  d - INTERVAL '${days + offset} days'
        AND TRY_CAST("${dateCol}" AS DATE) <= d - INTERVAL '${offset} days'
      GROUP BY grp
      ORDER BY ${metric === 'fraud' ? 'fraud' : 'total'} DESC
      LIMIT 50`;
    try {
      const res  = await conn.query(sql);
      const rows = res.toArray().map(r => ({
        grp:        String(r.grp ?? '—'),
        total:      Number(r.total),
        fraud:      Number(r.fraud),
        fraud_rate: Number(r.fraud_rate),
      }));
      if (!rows.length) continue;
      // Time-series query (top 8 values, daily counts)
      const tsRows = await SR_QueryBreakdown({ conn, src, dateCol, col, winSize, offset, fraudClause, addClause: '' });
      cards.push({ col, rows, tsRows: tsRows || [] });
    } catch (e) { console.warn('SRM query failed for', col, e.message); }
  }

  // update window range display
  if (typeof SRM_UpdateWindowRange === 'function') {
    try {
      const rangeSql = `
        WITH _max AS (SELECT MAX(TRY_CAST("${dateCol}" AS DATE)) AS d FROM ${src})
        SELECT
          CAST((SELECT d FROM _max) - INTERVAL '${days + offset} days' AS VARCHAR) AS start_d,
          CAST((SELECT d FROM _max) - INTERVAL '${offset} days'        AS VARCHAR) AS end_d`;
      const rr = (await conn.query(rangeSql)).toArray()[0];
      SRM_UpdateWindowRange(String(rr.start_d), String(rr.end_d));
    } catch {}
  }

  if (!cards.length) { SRM_RenderEmpty(); return; }

  const winLabel    = winSize + 'd';
  const metricLabel = metric === 'fraud' ? 'Fraud' : 'Total';

  view.innerHTML = cards.map(({ col, rows, tsRows }, i) => {
    const chartGroups = new Set(tsRows.map(r => r.grp));
    const visibleRows = tsRows.length ? rows.filter(r => chartGroups.has(r.grp)) : rows;
    const tableRows = visibleRows.map((r, j) => `
      <tr>
        <td style="font-weight:500;">${j + 1}</td>
        <td>${r.grp}</td>
        <td>${r.total.toLocaleString()}</td>
        <td>${r.fraud.toLocaleString()}</td>
        <td>${r.fraud_rate > 0 ? r.fraud_rate.toFixed(1) + '%' : '—'}</td>
      </tr>`).join('');
    return `
      <div class="pg-layout-row">
        <div class="pg-card">
          <div class="pg-card-header">
            <span class="pg-card-title">By ${col}</span>
            <span class="pg-card-label">top 8 · ${winLabel} · ${metricLabel}</span>
          </div>
          <div class="pg-card-divider"></div>
          <div class="pg-card-body">
            <div class="SR_chart_wrap"><canvas id="SRM_Canvas_${i}"></canvas></div>
          </div>
          <div class="pg-card-divider"></div>
          <div class="pg-card-body">
            <div class="pg-table-wrap" style="max-height:360px;overflow-y:auto;">
              <table class="pg-table">
                <thead style="position:sticky;top:0;z-index:1;"><tr>
                  <th>#</th><th>Value</th><th>Total</th><th>Fraud</th><th>Fraud Rate</th>
                </tr></thead>
                <tbody>${tableRows}</tbody>
              </table>
            </div>
          </div>
        </div>
      </div>`;
  }).join('');

  cards.forEach(({ tsRows }, i) => {
    if (tsRows.length) SR_DrawBreakdownChart(`SRM_Canvas_${i}`, tsRows);
  });
}

// ── Available Columns ─────────────────────────────────────────────────────────
let _SRM_ColsOpen = true;
function SRM_ToggleCols() {
  _SRM_ColsOpen = !_SRM_ColsOpen;
  const body    = document.getElementById('SRM_ColsBody');
  const chevron = document.getElementById('SRM_ColsChevron');
  if (body)    body.style.display      = _SRM_ColsOpen ? 'block' : 'none';
  if (chevron) chevron.style.transform = _SRM_ColsOpen ? 'rotate(90deg)' : 'rotate(0deg)';
  if (_SRM_ColsOpen) _navScrollOnExpand(document.getElementById('SRM_ColsSection'), document.getElementById('SRM_MiniNav'));
}

async function SRM_PopulateCols() {
  const conn = window.LD_getConn?.() || window._SR_demoConn;
  const src  = window.LD_getSource?.() || window._SR_demoSrc;
  const list = document.getElementById('SRM_ColsList');
  if (!list) return;
  if (!conn || !src) { MN_PopulateCols('SRM_ColsList'); return; }
  try {
    const res  = await conn.query(`DESCRIBE ${src}`);
    const _strTypes = /^(VARCHAR|TEXT|CHAR|STRING|BLOB|JSON|ENUM|HUGEVARCHAR)/i;
    const cols = res.toArray()
      .filter(r => _strTypes.test(r.column_type))
      .map(r => r.column_name);
    list.innerHTML = cols.map(c => `
      <button class="MN_chip MN_chip--col MN_chip--a" onclick="this.classList.toggle('active');SRM_Run()" title="${c}">${c}</button>
    `).join('');
  } catch { MN_PopulateCols('SRM_ColsList'); }
}
function SRM_SelectAllCols() { MN_SelectAllCols('SRM_ColsList'); }
function SRM_ClearCols()     { MN_ClearCols('SRM_ColsList'); }
function SRM_GetSelectedCols() { return MN_GetSelectedCols('SRM_ColsList'); }

// ── Analysis Window ───────────────────────────────────────────────────────────
let _SRM_WindowOpen = true;
function SRM_ToggleWindow() {
  _SRM_WindowOpen = !_SRM_WindowOpen;
  const body    = document.getElementById('SRM_WindowBody');
  const chevron = document.getElementById('SRM_WindowChevron');
  if (body)    body.style.display      = _SRM_WindowOpen ? 'block' : 'none';
  if (chevron) chevron.style.transform = _SRM_WindowOpen ? 'rotate(90deg)' : 'rotate(0deg)';
}

let _SRM_Window = '7';
let _SRM_Offset = 0;

function SRM_SetWindow(val, btn) {
  _SRM_Window = val;
  _SRM_Offset = 0;
  document.querySelectorAll('#SRM_WindowBtns .MN_btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  SRM_Run();
}

function SRM_ShiftWindow(dir) {
  _SRM_Offset = Math.max(0, _SRM_Offset - dir);
  const nextBtn = document.getElementById('SRM_WinNext');
  if (nextBtn) nextBtn.disabled = _SRM_Offset === 0;
  SRM_Run();
}

function SRM_UpdateWindowRange(start, end) {
  const el = document.getElementById('SRM_WinRange');
  if (el) el.textContent = start && end ? `${start} → ${end}` : '—';
  const nextBtn = document.getElementById('SRM_WinNext');
  if (nextBtn) nextBtn.disabled = _SRM_Offset === 0;
}

let _SRM_Metric = 'total';
function SRM_SetMetric(val, btn) {
  _SRM_Metric = val;
  document.querySelectorAll('#SRM_MetricBtns .MN_btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  SRM_Run();
}

function SRM_Run() {
  const cols    = SRM_GetSelectedCols();
  const winSize = _SRM_Window;
  const offset  = _SRM_Offset;
  const metric  = _SRM_Metric;
  if (typeof SRM_RunAnalysis === 'function') SRM_RunAnalysis({ cols, winSize, offset, metric });
}

let _SRM_ParamsOpen = false;
function SRM_ToggleParams() {
  _SRM_ParamsOpen = !_SRM_ParamsOpen;
  const body    = document.getElementById('SRM_ParamsBody');
  const chevron = document.getElementById('SRM_ParamsChevron');
  if (body)    body.style.display      = _SRM_ParamsOpen ? 'block' : 'none';
  if (chevron) chevron.style.transform = _SRM_ParamsOpen ? 'rotate(90deg)' : 'rotate(0deg)';
}

function SRM_RenderParams() {
  if (typeof SP_RenderParamsTo === 'function') SP_RenderParamsTo('SRM_ParamsDisplay', 'srm');
}

// ── Extra param cards (Decision Mode + custom cards) ─────────────────────────
function SRM_RefreshExtraCards() {
  const p  = window.SP_getParams ? window.SP_getParams() : {};
  const el = document.getElementById('SRM_ExtraCards');
  if (!el) return;

  const makeCard = (key, title, col, aVals, bVals, labelA, labelB) => {
    const btn = (v, group) =>
      `<button class="MN_btn MN_paramVal" onclick="SRM_ToggleParamVal('${key}','${group}','${v}',this)"
        style="flex:1;min-width:0;height:24px;padding:0 4px;font-size:0.62rem;border-radius:5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${v}</button>`;
    const aBtns = aVals.map(v => btn(v, 'a')).join('');
    const bBtns = bVals.map(v => btn(v, 'b')).join('');
    const none  = `<span style="font-size:0.62rem;color:var(--color-text-dim);">None</span>`;
    return `
      <div class="MN_divider"></div>
      <div id="SRM_ExtraSection_${key}">
        <div onclick="SRM_ToggleExtra('${key}')" class="MN_section_hdr">
          <span class="MN_title">${title}</span>
          <svg id="SRM_ExtraChevron_${key}" viewBox="0 0 16 16" width="11" height="11" fill="none" style="transition:transform 0.18s;transform:rotate(90deg);flex-shrink:0;">
            <polyline points="5 3 11 8 5 13" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="color:var(--color-text-dim);"/>
          </svg>
        </div>
        <div id="SRM_ExtraBody_${key}" style="display:block;">
          <div class="MN_section_body">
            <div style="font-size:0.62rem;font-weight:600;letter-spacing:0.05em;text-transform:uppercase;color:var(--color-text-dim);margin-bottom:5px;">Column</div>
            <div style="font-size:0.68rem;color:var(--color-text-dim);background:var(--color-card-bg);border:1px solid var(--color-card-border);border-radius:5px;padding:0 8px;height:28px;display:flex;align-items:center;">${col}</div>
          </div>
          <div class="MN_section_body">
            <div style="font-size:0.62rem;font-weight:600;letter-spacing:0.05em;text-transform:uppercase;color:var(--color-text-dim);margin-bottom:5px;">${labelA}</div>
            <div style="display:flex;gap:3px;">${aBtns || none}</div>
          </div>
          <div class="MN_section_body">
            <div style="font-size:0.62rem;font-weight:600;letter-spacing:0.05em;text-transform:uppercase;color:var(--color-text-dim);margin-bottom:5px;">${labelB}</div>
            <div style="display:flex;gap:3px;">${bBtns || none}</div>
          </div>
        </div>
      </div>`;
  };

  let html = '';
  const dm = p.decisionMode;
  if (dm?.col) {
    html += makeCard('dm', 'Decision Mode', dm.col,
      dm.assigned?.successful   || [],
      dm.assigned?.unsuccessful || [],
      'Successful', 'Unsuccessful');
  }
  (p.customCards || []).forEach((card, i) => {
    html += makeCard(`custom_${i}`, card.name || 'Custom', card.col || '—',
      card.assigned?.a || [], card.assigned?.b || [],
      card.labelA || 'A', card.labelB || 'B');
  });

  el.innerHTML = html;
}

function SRM_ToggleParamVal(key, group, val, btn) {
  btn.classList.toggle('active');
}

function SRM_ToggleExtra(key) {
  const body    = document.getElementById(`SRM_ExtraBody_${key}`);
  const chevron = document.getElementById(`SRM_ExtraChevron_${key}`);
  if (!body) return;
  const open = body.style.display !== 'none';
  body.style.display    = open ? 'none' : 'block';
  if (chevron) chevron.style.transform = open ? 'rotate(0deg)' : 'rotate(90deg)';
}

// ── Overview: Weekday Pattern console ────────────────────────────────────────
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
  const dateCol   = params.auth_date;
  if (!dateCol) return;

  const fraudCol  = params.col1   || '';
  const fraudVals = params.values || [];

  const dayQuery = (extra = '') => `
    SELECT DAYNAME(TRY_CAST("${dateCol}" AS DATE)) AS period,
           ISODOW(TRY_CAST("${dateCol}" AS DATE))  AS sort_key,
           COUNT(*) AS cnt
    FROM ${src}
    WHERE TRY_CAST("${dateCol}" AS DATE) IS NOT NULL ${extra}
    GROUP BY period, sort_key ORDER BY sort_key`;

  let totalRows = [], fraudRows = [];
  try {
    const res = await conn.query(dayQuery());
    totalRows = res.toArray().map(r => ({ period: String(r.period), count: Number(r.cnt) }));
  } catch { return; }
  if (!totalRows.length) return;

  if (fraudCol && fraudVals.length) {
    const escaped = fraudVals.map(v => `'${v.replace(/'/g, "''")}'`).join(', ');
    try {
      const res = await conn.query(dayQuery(`AND "${fraudCol}" IN (${escaped})`));
      fraudRows = res.toArray().map(r => ({ period: String(r.period), count: Number(r.cnt) }));
    } catch {}
  }

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

// Unlock SR alongside SA/SC — avoids touching the org LoadData.js
(function () {
  const _origUnlock = typeof window.LD_UnlockScoreAnalysis === 'function' ? window.LD_UnlockScoreAnalysis : null;
  window.LD_UnlockScoreAnalysis = function () {
    if (_origUnlock) _origUnlock();
    ['nav-spike-report', 'nav-spike-merchant'].forEach(id => {
      const el = document.getElementById(id);
      if (el) { el.classList.remove('ld-locked', 'sidebar-item-disabled'); el.removeAttribute('data-nav-locked'); }
    });
  };
})();

let _SR_Chart = null;
let _SR_BreakdownCharts = [];
const _SR_PALETTE = ['#3B82F6','#10B981','#F59E0B','#8B5CF6','#EC4899','#06B6D4','#84CC16','#F97316'];

// ── Open ──────────────────────────────────────────────────────────────────────
function SR_OpenPanel() {
  if (typeof App_HideAllViews === 'function') App_HideAllViews();
  document.documentElement.style.setProperty('--toast-brand', '#DC2626');
  document.querySelector('.shell')?.classList.add('sr-active');
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
  view.innerHTML = `
    <div class="pg-layout-row">
      <div class="pg-card">
        <div class="pg-card-header">
          <span class="pg-card-title">Spike Report</span>
          <span class="pg-card-label">select columns and hit Run</span>
        </div>
        <div class="pg-card-divider"></div>
        <div class="pg-card-body">
          <div class="SR_empty">Select columns in the nav panel and click <strong>Run Spike Report</strong> to begin.</div>
        </div>
      </div>
    </div>`;
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
  const dateCol = params.auth_date
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
