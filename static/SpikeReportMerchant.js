// ── Spike Report by Merchant ──────────────────────────────────────────────────

// ── Tutorial ──────────────────────────────────────────────────────────────────
const _SRM_TOUR_STEPS = [
  { title: 'Available Columns',  body: 'Select one or more <strong>string columns</strong> to group the analysis by — e.g. merchant ID, card type, channel. Use <strong>Select All</strong> to include every string column at once.' },
  { title: 'Analysis Window',    body: 'Choose a rolling window — <strong>7, 14, 21 or 28 days</strong>. Use the <strong>← →</strong> arrows to shift the window to earlier periods. Each column gets its own breakdown card.' },
  { title: 'Metric',             body: 'Switch between <strong>Total</strong> and <strong>Fraud</strong> to rank values differently. Fraud mode surfaces the merchant values with the highest fraud count in the selected window.' },
  { title: 'Reading the Results', body: 'Each card shows the <strong>top 50 values</strong> by volume or fraud, and a time-series chart of the <strong>top 8 values</strong> over the window so you can see which segments are trending.' },
];
let _SRM_tourStep    = 0;
let _SRM_tourEnabled = false;

function SRM_tourShow(step) {
  _SRM_tourStep = step;
  const s = _SRM_TOUR_STEPS[step];
  if (!s) { SRM_tourDismiss(); return; }
  const total = _SRM_TOUR_STEPS.length;
  let el = document.getElementById('SRM_TourCard');
  if (!el) {
    el = document.createElement('div');
    el.id = 'SRM_TourCard';
    el.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:99998;';
    document.body.appendChild(el);
  }
  el.innerHTML = `
    <div class="gs-toast" id="SRM_TourInner" style="border-left-color:var(--brand-sp);">
      <div class="gs-tab-strip" onclick="SRM_tourTabExpand()" title="Expand">
        <span class="gs-tab-arrow">›</span>
        <span class="gs-tab-label">Step ${step+1} of ${total}</span>
      </div>
      <div class="gs-toast-inner">
        <div class="gs-toast-header">
          <div>
            <div class="gs-toast-step" style="color:var(--brand-sp);">Step ${step+1} of ${total}</div>
            <div class="gs-toast-title">${s.title}</div>
          </div>
          <button class="gs-toast-btn-collapse" onclick="SRM_tourTabCollapse()" title="Collapse to tab" style="background:var(--brand-sp-dim);border-color:var(--brand-sp);color:var(--brand-sp);">
            <svg viewBox="0 0 16 16" width="10" height="10" fill="none"><path d="M10 3H13V13H10M6 8H2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
        </div>
        <div class="gs-toast-body">${s.body}</div>
        <div class="gs-toast-actions">
          <button class="gs-toast-btn-back" onclick="SRM_tourShow(_SRM_tourStep - 1)" style="${step === 0 ? 'visibility:hidden;' : ''}">← Back</button>
          <button class="gs-toast-btn-next" onclick="SRM_tourNext()" style="background:var(--brand-sp);">${step+1 < total ? 'Next →' : 'Finish ✓'}</button>
        </div>
      </div>
    </div>`;
}

function SRM_tourTabCollapse() {
  const el = document.getElementById('SRM_TourInner');
  if (!el) return;
  const rect = el.getBoundingClientRect();
  el.style.top    = '';
  el.style.bottom = (window.innerHeight - rect.bottom) + 'px';
  el.classList.add('gs-tabbed');
  const strip = el.querySelector('.gs-tab-strip');
  if (strip) strip.style.height = rect.height + 'px';
}

function SRM_tourTabExpand() {
  const el = document.getElementById('SRM_TourInner');
  if (!el) return;
  el.style.top = el.style.bottom = '';
  el.classList.remove('gs-tabbed');
}

function SRM_tourNext() { SRM_tourShow(_SRM_tourStep + 1); }

function SRM_tourDismiss() {
  document.getElementById('SRM_TourCard')?.remove();
  _SRM_tourEnabled = false;
  document.getElementById('SRM_HelpBtn')?.classList.remove('tutorial-active');
}

function SRM_HelpPrompt() {
  _SRM_tourEnabled = !_SRM_tourEnabled;
  document.getElementById('SRM_HelpBtn')?.classList.toggle('tutorial-active', _SRM_tourEnabled);
  if (_SRM_tourEnabled) {
    SRM_tourShow(0);
  } else {
    SRM_tourDismiss();
  }
}

if (typeof App_RegisterTutorial === 'function') App_RegisterTutorial('srm-active', SRM_HelpPrompt);

function SRM_OpenPanel() {
  if (typeof App_HideAllViews === 'function') App_HideAllViews();
  document.querySelector('.shell')?.classList.add('sr-active', 'srm-panel-active');
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
  view.innerHTML = '';
}

async function SRM_RunAnalysis({ cols, winSize, offset = 0, metric }) {
  const conn = window.LD_getConn?.() || window._SR_demoConn;
  const src  = window.LD_getSource?.() || window._SR_demoSrc;
  const view = document.getElementById('SRMView');
  if (!conn || !src || !view) return;

  const params   = window.SP_getParams?.() || {};
  const dateCol  = params.auth_date || params.combined_datetime || (window._SR_demoSrc ? 'transaction_date' : null);
  const fraudCol = params.col1      || (window._SR_demoSrc ? 'fraud_flag' : '');
  const fraudVals= params.values    || (window._SR_demoSrc ? ['1'] : []);

  if (!dateCol) { SRM_RenderEmpty(); return; }
  if (!cols || !cols.length) { SRM_RenderEmpty(); return; }

  SR_DestroyCharts();

  const days = parseInt(winSize, 10);
  const fraudCase = (fraudCol && fraudVals.length)
    ? `SUM(CASE WHEN CAST("${fraudCol}" AS VARCHAR) IN (${fraudVals.map(v => `'${v.replace(/'/g, "''")}'`).join(',')}) THEN 1 ELSE 0 END)`
    : '0';

  // Only project the columns we actually need — avoids materialising all 100+ cols
  const neededCols = [...new Set([dateCol, ...(fraudCol ? [fraudCol] : []), ...cols])];
  const colList    = neededCols.map(c => `"${c.replace(/"/g, '""')}"`).join(', ');

  const unionBranches = (fn) => cols.map((col, i) =>
    (i > 0 ? 'UNION ALL\n      ' : '') + fn(col.replace(/'/g, "''"), col.replace(/"/g, '""'))
  ).join('\n      ');

  // ── Summary: 1 scan, all columns, ranked top-50 per column ───────────────
  const summarySql = `
    WITH
    _max AS (SELECT MAX(TRY_CAST("${dateCol}" AS DATE)) AS d FROM ${src}),
    _f AS MATERIALIZED (
      SELECT ${colList}
      FROM ${src}, _max
      WHERE TRY_CAST("${dateCol}" AS DATE) >  d - INTERVAL '${days + offset} days'
        AND TRY_CAST("${dateCol}" AS DATE) <= d - INTERVAL '${offset} days'
    ),
    _agg AS (
      ${unionBranches((safe, id) => `
      SELECT '${safe}' AS _col,
             CAST("${id}" AS VARCHAR) AS grp,
             COUNT(*) AS total,
             ${fraudCase} AS fraud,
             ROUND(100.0 * ${fraudCase} / NULLIF(COUNT(*), 0), 1) AS fraud_rate
      FROM _f GROUP BY grp`)}
    ),
    _ranked AS (
      SELECT *, ROW_NUMBER() OVER (
        PARTITION BY _col ORDER BY ${metric === 'fraud' ? 'fraud' : 'total'} DESC
      ) AS rn FROM _agg
    )
    SELECT _col, grp, total, fraud, fraud_rate
    FROM _ranked WHERE rn <= 50
    ORDER BY _col`;

  // ── Time-series: 1 scan, top-8 groups per column, daily counts ───────────
  const tsSql = `
    WITH
    _max AS (SELECT MAX(TRY_CAST("${dateCol}" AS DATE)) AS d FROM ${src}),
    _f AS MATERIALIZED (
      SELECT ${colList},
             CAST(TRY_CAST("${dateCol}" AS DATE) AS VARCHAR) AS _period
      FROM ${src}, _max
      WHERE TRY_CAST("${dateCol}" AS DATE) >  d - INTERVAL '${days + offset} days'
        AND TRY_CAST("${dateCol}" AS DATE) <= d - INTERVAL '${offset} days'
    ),
    _ts AS MATERIALIZED (
      ${unionBranches((safe, id) => `
      SELECT '${safe}' AS _col, _period AS period,
             CAST("${id}" AS VARCHAR) AS grp, COUNT(*) AS cnt
      FROM _f GROUP BY _period, grp`)}
    ),
    _top AS (
      SELECT _col, grp FROM (
        SELECT _col, grp,
               ROW_NUMBER() OVER (PARTITION BY _col ORDER BY SUM(cnt) DESC) AS rn
        FROM _ts GROUP BY _col, grp
      ) WHERE rn <= 8
    )
    SELECT t._col, t.period, t.grp, t.cnt
    FROM _ts t JOIN _top tp ON t._col = tp._col AND t.grp = tp.grp
    ORDER BY t._col, t.period, t.grp`;

  // ── Window range ──────────────────────────────────────────────────────────
  const rangeSql = `
    WITH _max AS (SELECT MAX(TRY_CAST("${dateCol}" AS DATE)) AS d FROM ${src})
    SELECT
      CAST((SELECT d FROM _max) - INTERVAL '${days + offset} days' AS VARCHAR) AS start_d,
      CAST((SELECT d FROM _max) - INTERVAL '${offset} days'        AS VARCHAR) AS end_d`;

  if (typeof SRM_showBadge === 'function') SRM_showBadge('loading', 'Running breakdown…');
  const _srmStart = performance.now();

  let summaryRows, tsRows, rangeRow;
  try {
    [summaryRows, tsRows, rangeRow] = await Promise.all([
      conn.query(summarySql).then(r => r.toArray()),
      conn.query(tsSql).then(r => r.toArray()),
      conn.query(rangeSql).then(r => r.toArray()[0]),
    ]);
  } catch (e) {
    console.warn('SRM analysis failed:', e.message);
    SRM_RenderEmpty();
    if (typeof App_toast === 'function') App_toast('SRM error: ' + e.message, 'error');
    return;
  }



  if (typeof SRM_UpdateWindowRange === 'function' && rangeRow) {
    SRM_UpdateWindowRange(String(rangeRow.start_d), String(rangeRow.end_d));
  }

  // ── Group results by column ───────────────────────────────────────────────
  const summaryByCol = {};
  for (const r of summaryRows) {
    const col = String(r._col);
    (summaryByCol[col] ??= []).push({
      grp:        String(r.grp ?? '—'),
      total:      Number(r.total),
      fraud:      Number(r.fraud),
      fraud_rate: Number(r.fraud_rate),
    });
  }

  const tsByCol = {};
  for (const r of tsRows) {
    const col = String(r._col);
    (tsByCol[col] ??= []).push({ period: String(r.period), grp: String(r.grp), count: Number(r.cnt) });
  }

  const cards = cols
    .filter(col => summaryByCol[col]?.length)
    .map(col => ({ col, rows: summaryByCol[col], tsRows: tsByCol[col] || [] }));

  if (!cards.length) { SRM_RenderEmpty(); return; }

  // ── Render ────────────────────────────────────────────────────────────────
  const winLabel    = winSize + 'd';
  const metricLabel = metric === 'fraud' ? 'Fraud' : 'Total';

  view.innerHTML = cards.map(({ col, rows, tsRows }, i) => {
    const tableRows = rows.map((r, j) => `
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
            <span class="pg-card-label">top 50 · ${winLabel} · ${metricLabel}</span>
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

  if (typeof SRM_showBadge === 'function') {
    const _srmSecs = ((performance.now() - _srmStart) / 1000).toFixed(2);
    SRM_showBadge('ready', `<strong>Spike by Merchant ready</strong> &nbsp;·&nbsp; ${cards.length} column${cards.length !== 1 ? 's' : ''} &nbsp;·&nbsp; ${_srmSecs}s`);
  }
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
function SRM_SelectAllCols() { MN_SelectAllCols('SRM_ColsList'); SRM_Run(); }
function SRM_ClearCols()     { MN_ClearCols('SRM_ColsList'); SRM_RenderEmpty(); }
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
