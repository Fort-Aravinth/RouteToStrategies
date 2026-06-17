// ── Project Unnamed ──────────────────────────────────────────────────────────

function PU_Open() {
  document.documentElement.style.setProperty('--toast-brand', '#0891B2');
  App_HideAllViews();
  document.querySelector('.shell').classList.add('pu-active');
  document.getElementById('PUView').style.removeProperty('display');
  document.getElementById('PU_MiniNav').style.display = 'flex';
  Sidebar_SetActive('nav-project-unnamed');
  NAV_PU_RenderParams();
  PU_PopulateRunBy();
  PU_RenderSavedRules();
}

async function PU_PopulateRunBy() {
  const conn = window.LD_getConn ? window.LD_getConn() : null;
  const cs   = document.getElementById('PU_RunByCS');
  if (!cs) return;
  const opts = cs.querySelector('.cs-options');
  if (!conn) { opts.innerHTML = '<div class="cs-option" style="color:var(--dml-label);">— No data loaded —</div>'; return; }
  const src = window.LD_getSource ? window.LD_getSource() : 'cm_data';
  let cols = [];
  try {
    const res = await conn.query(`DESCRIBE ${src}`);
    cols = res.toArray().map(r => r.column_name);
  } catch { opts.innerHTML = '<div class="cs-option" style="color:var(--dml-label);">— Could not load columns —</div>'; return; }
  opts.innerHTML = '<div class="cs-option" data-value="" onclick="PU_SelectRunBy(this,\'\')" style="color:var(--dml-label);">— None (no filter) —</div>' +
    cols.map(c => `<div class="cs-option" data-value="${c}" onclick="PU_SelectRunBy(this,'${c}')">${c}</div>`).join('');
}

function PU_SelectRunBy(el, val) {
  const cs = document.getElementById('PU_RunByCS');
  cs.querySelectorAll('.cs-option').forEach(o => o.classList.remove('cs-selected'));
  el.classList.add('cs-selected');
  cs.querySelector('.cs-value').textContent = val;
  cs.querySelector('.cs-value').style.color = '';
  cs.classList.remove('open');
  const show = val ? '' : 'none';
  document.getElementById('PU_RunByOp').style.display  = show;
  document.getElementById('PU_RunByVal').style.display = show;
}

// ── Params display ────────────────────────────────────────────────────────────

function NAV_PU_RenderParams() {
  if (typeof window.SP_RenderParamsTo === 'function') {
    window.SP_RenderParamsTo('NAV_PU_ParamsDisplay');
  }
  PU_RefreshParamButtons();
}

function PU_RefreshParamButtons() {
  let p = typeof window.SP_getParams === 'function' ? window.SP_getParams() : {};
  if (!p.col1 && !p.numeric && !p.object) {
    try {
      const c = JSON.parse(localStorage.getItem('SP_CachedParams') || '{}');
      p = {
        col1:              c.FraudFlag?.col              || '',
        numeric:           c.TransactionAmount?.numeric  || '',
        currency:          c.TransactionAmount?.currency || '',
        object:            c.CardDimension?.col          || '',
        auth_date:         c.DateTime?.date              || '',
        auth_time:         c.DateTime?.time              || '',
        combined_datetime: c.DateTime?.combined          || '',
        ruleSignal:        c.RuleSignal?.col             || '',
        decisionMode:      { col: c.DecisionMode?.col   || '' },
      };
    } catch(e) {}
  }
  // buttons show label only; live params used elsewhere (e.g. form prefill)
  void p;
}

// ── Auto-refresh param buttons whenever SP applies params ─────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const _orig = window.SP_UpdateAppliedDisplay;
  if (typeof _orig === 'function') {
    window.SP_UpdateAppliedDisplay = function(...args) {
      _orig.apply(this, args);
      PU_RefreshParamButtons();
    };
  }
});

// ── Actions ──────────────────────────────────────────────────────────────────

function PU_NewTypologyRule() {
  // TODO: open new typology rule form
}

function PU_ToggleNewRuleForm() {
  const form = document.getElementById('PU_NewRuleForm');
  const visible = form.style.display !== 'none';
  form.style.display = visible ? 'none' : '';
  if (!visible) {
    const p = typeof window.SP_getParams === 'function' ? window.SP_getParams() : {};
    let numeric = p.numeric, object = p.object;
    if (!numeric || !object) {
      try {
        const c = JSON.parse(localStorage.getItem('SP_CachedParams') || '{}');
        if (!numeric) numeric = c.TransactionAmount?.numeric || '';
        if (!object)  object  = c.CardDimension?.col        || '';
      } catch(e) {}
    }
    document.getElementById('PU_CardDimension').value = object;
    document.getElementById('PU_AmountMetric').value  = numeric;
    document.getElementById('PU_RuleName').focus();
  }
}

// ── MiniNav section toggles ───────────────────────────────────────────────────

function NAV_PU_ToggleParams() {
  const body    = document.getElementById('NAV_PU_ParamsBody');
  const chevron = document.getElementById('NAV_PU_ParamsChevron');
  const open    = body.style.display !== 'none';
  body.style.display      = open ? 'none' : 'block';
  chevron.style.transform = open ? 'rotate(0deg)' : 'rotate(90deg)';
}

function NAV_PU_ToggleSaved() {
  const body    = document.getElementById('NAV_PU_SavedBody');
  const chevron = document.getElementById('NAV_PU_SavedChevron');
  if (!body) return;
  const open = body.style.display !== 'none';
  body.style.display      = open ? 'none' : 'block';
  if (chevron) chevron.style.transform = open ? 'rotate(0deg)' : 'rotate(90deg)';
}

function NAV_PU_ToggleAll() {
  const body    = document.getElementById('NAV_PU_ParamsBody');
  const chevron = document.getElementById('NAV_PU_ParamsChevron');
  const anyOpen = body?.style.display !== 'none';
  if (!body) return;
  body.style.display      = anyOpen ? 'none' : 'block';
  if (chevron) chevron.style.transform = anyOpen ? 'rotate(0deg)' : 'rotate(90deg)';
  const btn = document.getElementById('NAV_PU_ExpandBtn');
  if (btn) btn.title = anyOpen ? 'Expand all' : 'Collapse all';
}

// ── Run Analysis ──────────────────────────────────────────────────────────────

const PU_C_NORM = '#0891B2';
const PU_C_SUSP = '#DC2626';
const PU_C_N_BG = 'rgba(8,145,178,0.20)';
const PU_C_S_BG = 'rgba(220,38,38,0.20)';

let _PU_charts = [];

function _PU_destroyCharts() {
  _PU_charts.forEach(c => { try { c.destroy(); } catch(e) {} });
  _PU_charts = [];
}

function _PU_mkChart(id, cfg) {
  const el = document.getElementById(id);
  if (!el) return;
  const ch = new Chart(el, cfg);
  _PU_charts.push(ch);
  return ch;
}

function _PU_liveParams() {
  let p = typeof window.SP_getParams === 'function' ? window.SP_getParams() : {};
  if (!p.object && !p.numeric) {
    try {
      const c = JSON.parse(localStorage.getItem('SP_CachedParams') || '{}');
      p = {
        object:            c.CardDimension?.col        || '',
        numeric:           c.TransactionAmount?.numeric || '',
        auth_date:         c.DateTime?.date             || '',
        combined_datetime: c.DateTime?.combined         || '',
      };
    } catch(e) {}
  }
  return p;
}

async function PU_Run() {
  const conn = window.LD_getConn ? window.LD_getConn() : null;
  if (!conn) { alert('No data loaded. Please load a dataset first.'); return; }
  const src = window.LD_getSource ? window.LD_getSource() : 'cm_data';

  const p       = _PU_liveParams();
  const cardDim = (document.getElementById('PU_CardDimension')?.value.trim() || p.object  || '').trim();
  const amtCol  = (document.getElementById('PU_AmountMetric')?.value.trim()  || p.numeric || '').trim();
  const dateCol = (p.combined_datetime || p.auth_date || '').trim();

  if (!cardDim) { alert('Card Dimension is required. Set it in Parameters or fill in the field.'); return; }
  if (!amtCol)  { alert('Amount Metric is required. Set it in Parameters or fill in the field.');  return; }

  const runByCol = document.getElementById('PU_RunByCS')?.querySelector('.cs-option.cs-selected')?.dataset?.value || '';
  const runByOp  = document.getElementById('PU_RunByOp')?.value || '=';
  const runByRaw = (document.getElementById('PU_RunByVal')?.value || '').trim();

  let where = '1=1';
  if (runByCol && runByRaw) {
    const nv = Number(runByRaw);
    const qv = (!isNaN(nv) && runByRaw !== '') ? runByRaw : `'${runByRaw.replace(/'/g, "''")}'`;
    where = `"${runByCol}" ${runByOp} ${qv}`;
  }

  const runBtn = document.getElementById('PU_RunBtn');
  if (runBtn) { runBtn.disabled = true; runBtn.textContent = 'Running…'; }

  _PU_destroyCharts();
  const resultsEl = document.getElementById('PU_Results');
  if (resultsEl) resultsEl.style.display = 'none';

  try {
    // Verify date column actually exists in the table
    let validDateCol = '';
    if (dateCol) {
      try {
        const descRes = await conn.query(`DESCRIBE ${src}`);
        const cols = descRes.toArray().map(r => String(r.column_name));
        if (cols.includes(dateCol)) validDateCol = dateCol;
        else console.warn(`[PU] Date column "${dateCol}" not found in ${src} — time charts skipped.`);
      } catch(e) {}
    }

    const _safe = async (fn) => { try { return await fn(); } catch(e) { console.warn('[PU query]', e.message); return []; } };

    const summary = await _PU_querySummary(conn, src, cardDim, amtCol, where);
    const tagged  = _PU_flagSuspicious(summary);

    const weekly  = validDateCol ? await _safe(() => _PU_queryWeekly(conn, src, validDateCol, where))              : [];
    const burst   = validDateCol ? await _safe(() => _PU_queryBurst(conn, src, cardDim, validDateCol, where))      : [];
    const gaps    = validDateCol ? await _safe(() => _PU_queryGaps(conn, src, cardDim, validDateCol, where))       : [];
    const hist    =                await _safe(() => _PU_queryValueHist(conn, src, amtCol, where));
    const dow     = validDateCol ? await _safe(() => _PU_queryDOW(conn, src, validDateCol, where))                 : [];
    const avgTime = validDateCol ? await _safe(() => _PU_queryAvgTime(conn, src, amtCol, validDateCol, where))     : [];

    if (resultsEl) {
      _PU_buildGrid(resultsEl);
      resultsEl.style.display = '';
      resultsEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    _PU_chartScatterCountAvg(tagged);
    _PU_chartRanked(tagged);
    _PU_chartWeekly(weekly);
    _PU_chartCumulative(weekly);
    _PU_chartBurst(burst, tagged);
    _PU_chartGaps(gaps);
    _PU_chartValueHist(hist);
    _PU_chartScatterCountTotal(tagged);
    _PU_chartDOW(dow);
    _PU_chartAvgTime(avgTime);

  } catch(e) {
    console.error('[PU_Run]', e);
    alert('Analysis failed: ' + e.message);
  } finally {
    if (runBtn) { runBtn.disabled = false; runBtn.textContent = 'Run'; }
  }
}

// ── Queries ───────────────────────────────────────────────────────────────────

async function _PU_querySummary(conn, src, cardDim, amtCol, where) {
  const res = await conn.query(`
    SELECT
      "${cardDim}" AS customer,
      COUNT(*) AS event_count,
      AVG(TRY_CAST("${amtCol}" AS DOUBLE)) AS avg_value,
      SUM(TRY_CAST("${amtCol}" AS DOUBLE)) AS total_value
    FROM ${src}
    WHERE ${where}
    GROUP BY "${cardDim}"
    ORDER BY event_count DESC
  `);
  return res.toArray().map(r => ({
    customer:    String(r.customer   ?? ''),
    event_count: Number(r.event_count ?? 0),
    avg_value:   Number(r.avg_value   ?? 0),
    total_value: Number(r.total_value ?? 0),
  }));
}

function _PU_flagSuspicious(rows) {
  if (!rows.length) return rows;
  const counts = rows.map(r => r.event_count).sort((a, b) => a - b);
  const avgs   = rows.map(r => r.avg_value).sort((a, b) => a - b);
  const p75c   = counts[Math.floor(counts.length * 0.75)];
  const p25a   = avgs[Math.floor(avgs.length * 0.25)];
  return rows.map(r => ({ ...r, suspicious: r.event_count > p75c && r.avg_value < p25a }));
}

async function _PU_queryWeekly(conn, src, dateCol, where) {
  const res = await conn.query(`
    SELECT
      STRFTIME('%Y-%m-%d', DATE_TRUNC('week', TRY_CAST("${dateCol}" AS TIMESTAMP))) AS week,
      COUNT(*) AS event_count
    FROM ${src}
    WHERE ${where} AND TRY_CAST("${dateCol}" AS TIMESTAMP) IS NOT NULL
    GROUP BY week
    ORDER BY week
  `);
  return res.toArray()
    .map(r => ({ week: String(r.week ?? ''), event_count: Number(r.event_count ?? 0) }))
    .filter(r => r.week);
}

async function _PU_queryBurst(conn, src, cardDim, dateCol, where) {
  const res = await conn.query(`
    SELECT customer, MAX(daily_count) AS max_burst
    FROM (
      SELECT
        "${cardDim}" AS customer,
        DATE_TRUNC('day', TRY_CAST("${dateCol}" AS TIMESTAMP)) AS day,
        COUNT(*) AS daily_count
      FROM ${src}
      WHERE ${where} AND TRY_CAST("${dateCol}" AS TIMESTAMP) IS NOT NULL
      GROUP BY customer, day
    )
    GROUP BY customer
    ORDER BY max_burst DESC
    LIMIT 25
  `);
  return res.toArray().map(r => ({
    customer:  String(r.customer  ?? ''),
    max_burst: Number(r.max_burst ?? 0),
  }));
}

async function _PU_queryGaps(conn, src, cardDim, dateCol, where) {
  const res = await conn.query(`
    WITH sampled AS (
      SELECT
        "${cardDim}" AS customer,
        TRY_CAST("${dateCol}" AS TIMESTAMP) AS ts
      FROM ${src}
      WHERE ${where} AND TRY_CAST("${dateCol}" AS TIMESTAMP) IS NOT NULL
      USING SAMPLE 300000 ROWS
    ),
    lagged AS (
      SELECT
        DATEDIFF('hour', LAG(ts) OVER (PARTITION BY customer ORDER BY ts), ts) AS gap_hours
      FROM sampled
    )
    SELECT
      FLOOR(gap_hours / 24.0)::INTEGER AS gap_days,
      COUNT(*) AS cnt
    FROM lagged
    WHERE gap_hours IS NOT NULL AND gap_hours >= 0 AND gap_hours <= 8760
    GROUP BY gap_days
    ORDER BY gap_days
    LIMIT 30
  `);
  return res.toArray().map(r => ({ gap_days: Number(r.gap_days ?? 0), cnt: Number(r.cnt ?? 0) }));
}

async function _PU_queryValueHist(conn, src, amtCol, where) {
  const sr = await conn.query(`
    SELECT
      MIN(TRY_CAST("${amtCol}" AS DOUBLE)) AS mn,
      MAX(TRY_CAST("${amtCol}" AS DOUBLE)) AS mx
    FROM ${src} WHERE ${where}
  `);
  const st = sr.toArray()[0];
  const mn = Number(st?.mn ?? 0), mx = Number(st?.mx ?? 0);
  if (mx <= mn) return [];
  const bucket = (mx - mn) / 25;
  const res = await conn.query(`
    SELECT
      FLOOR((TRY_CAST("${amtCol}" AS DOUBLE) - ${mn}) / ${bucket}) * ${bucket} + ${mn} AS bucket,
      COUNT(*) AS cnt
    FROM ${src}
    WHERE ${where} AND TRY_CAST("${amtCol}" AS DOUBLE) IS NOT NULL
    GROUP BY bucket
    ORDER BY bucket
    LIMIT 30
  `);
  return res.toArray().map(r => ({ bucket: Number(r.bucket ?? 0), cnt: Number(r.cnt ?? 0) }));
}

async function _PU_queryDOW(conn, src, dateCol, where) {
  const res = await conn.query(`
    SELECT
      DAYOFWEEK(TRY_CAST("${dateCol}" AS TIMESTAMP)) AS dow,
      COUNT(*) AS event_count
    FROM ${src}
    WHERE ${where} AND TRY_CAST("${dateCol}" AS TIMESTAMP) IS NOT NULL
    GROUP BY dow
    ORDER BY dow
  `);
  return res.toArray().map(r => ({ dow: Number(r.dow ?? 0), event_count: Number(r.event_count ?? 0) }));
}

async function _PU_queryAvgTime(conn, src, amtCol, dateCol, where) {
  const res = await conn.query(`
    SELECT
      STRFTIME('%Y-%m-%d', DATE_TRUNC('week', TRY_CAST("${dateCol}" AS TIMESTAMP))) AS week,
      AVG(TRY_CAST("${amtCol}" AS DOUBLE)) AS avg_value
    FROM ${src}
    WHERE ${where} AND TRY_CAST("${dateCol}" AS TIMESTAMP) IS NOT NULL
    GROUP BY week
    ORDER BY week
  `);
  return res.toArray()
    .map(r => ({ week: String(r.week ?? ''), avg_value: Number(r.avg_value ?? 0) }))
    .filter(r => r.week);
}

// ── Results Grid ──────────────────────────────────────────────────────────────

function _PU_buildGrid(container) {
  const pairs = [
    [['PU_C1','Event Count vs Avg Value'],      ['PU_C4','Top Customers by Event Count']],
    [['PU_C2','Weekly Event Frequency'],         ['PU_C3','Cumulative Events Over Time']],
    [['PU_C5','Max Events in a Single Day'],     ['PU_C6','Gap Between Events (days)']],
    [['PU_C7','Event Value Distribution'],       ['PU_C8','Event Count vs Total Value']],
    [['PU_C9','Events by Day of Week'],          ['PU_C10','Avg Event Value Over Time']],
  ];
  container.innerHTML = pairs.map(row => `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px;">
      ${row.map(([id, title]) => `
        <div class="pg-card">
          <div class="pg-card-header"><span class="pg-card-title">${title}</span></div>
          <div class="pg-card-body" style="padding:8px 12px;">
            <canvas id="${id}" style="max-height:220px;"></canvas>
          </div>
        </div>`).join('')}
    </div>`).join('');
}

// ── Chart Options ─────────────────────────────────────────────────────────────

function _PU_opts(xLabel, yLabel) {
  return {
    responsive: true,
    maintainAspectRatio: true,
    plugins: {
      legend: { display: true, labels: { font: { size: 10 }, boxWidth: 10, padding: 6 } },
    },
    scales: {
      x: {
        title: { display: !!xLabel, text: xLabel, font: { size: 9 } },
        ticks: { font: { size: 9 }, maxRotation: 40, maxTicksLimit: 14,
          callback(v, i, vals) {
            const lbl = this.getLabelForValue ? this.getLabelForValue(v) : String(v);
            return lbl && lbl.length > 11 ? lbl.slice(0, 11) + '…' : lbl;
          }
        },
        grid: { color: 'rgba(128,128,128,0.08)' },
      },
      y: {
        title: { display: !!yLabel, text: yLabel, font: { size: 9 } },
        ticks: { font: { size: 9 } },
        grid: { color: 'rgba(128,128,128,0.08)' },
      },
    },
  };
}

// ── Charts ────────────────────────────────────────────────────────────────────

function _PU_chartScatterCountAvg(rows) {
  const norm = rows.filter(r => !r.suspicious);
  const susp = rows.filter(r =>  r.suspicious);
  _PU_mkChart('PU_C1', {
    type: 'scatter',
    data: { datasets: [
      { label: 'Normal',     data: norm.map(r => ({ x: r.event_count, y: r.avg_value })), backgroundColor: PU_C_N_BG, borderColor: PU_C_NORM, pointRadius: 4 },
      { label: 'Suspicious', data: susp.map(r => ({ x: r.event_count, y: r.avg_value })), backgroundColor: PU_C_S_BG, borderColor: PU_C_SUSP, pointRadius: 4 },
    ]},
    options: _PU_opts('Event Count', 'Avg Value'),
  });
}

function _PU_chartRanked(rows) {
  const top = rows.slice(0, 20);
  _PU_mkChart('PU_C4', {
    type: 'bar',
    data: {
      labels: top.map(r => r.customer),
      datasets: [{ label: 'Event Count', data: top.map(r => r.event_count),
        backgroundColor: top.map(r => r.suspicious ? PU_C_S_BG : PU_C_N_BG),
        borderColor:     top.map(r => r.suspicious ? PU_C_SUSP  : PU_C_NORM),
        borderWidth: 1 }],
    },
    options: _PU_opts('Customer', 'Events'),
  });
}

function _PU_chartWeekly(rows) {
  _PU_mkChart('PU_C2', {
    type: 'line',
    data: {
      labels: rows.map(r => r.week),
      datasets: [{ label: 'Events', data: rows.map(r => r.event_count),
        borderColor: PU_C_NORM, backgroundColor: PU_C_N_BG, fill: true, tension: 0.3, pointRadius: 2 }],
    },
    options: _PU_opts('Week', 'Events'),
  });
}

function _PU_chartCumulative(rows) {
  let cum = 0;
  const cumData = rows.map(r => { cum += r.event_count; return cum; });
  _PU_mkChart('PU_C3', {
    type: 'line',
    data: {
      labels: rows.map(r => r.week),
      datasets: [{ label: 'Cumulative Events', data: cumData,
        borderColor: PU_C_NORM, backgroundColor: PU_C_N_BG, fill: true, tension: 0.3, pointRadius: 2 }],
    },
    options: _PU_opts('Week', 'Total Events'),
  });
}

function _PU_chartBurst(burst, summary) {
  const suspSet = new Set(summary.filter(r => r.suspicious).map(r => r.customer));
  const top = burst.slice(0, 20);
  _PU_mkChart('PU_C5', {
    type: 'bar',
    data: {
      labels: top.map(r => r.customer),
      datasets: [{ label: 'Max Events/Day', data: top.map(r => r.max_burst),
        backgroundColor: top.map(r => suspSet.has(r.customer) ? PU_C_S_BG : PU_C_N_BG),
        borderColor:     top.map(r => suspSet.has(r.customer) ? PU_C_SUSP  : PU_C_NORM),
        borderWidth: 1 }],
    },
    options: _PU_opts('Customer', 'Max Events/Day'),
  });
}

function _PU_chartGaps(gaps) {
  _PU_mkChart('PU_C6', {
    type: 'bar',
    data: {
      labels: gaps.map(r => r.gap_days + 'd'),
      datasets: [{ label: 'Pairs', data: gaps.map(r => r.cnt),
        backgroundColor: PU_C_N_BG, borderColor: PU_C_NORM, borderWidth: 1 }],
    },
    options: _PU_opts('Gap (days)', 'Event Pairs'),
  });
}

function _PU_chartValueHist(hist) {
  _PU_mkChart('PU_C7', {
    type: 'bar',
    data: {
      labels: hist.map(r => r.bucket.toFixed(2)),
      datasets: [{ label: 'Count', data: hist.map(r => r.cnt),
        backgroundColor: PU_C_N_BG, borderColor: PU_C_NORM, borderWidth: 1 }],
    },
    options: _PU_opts('Value', 'Count'),
  });
}

function _PU_chartScatterCountTotal(rows) {
  const norm = rows.filter(r => !r.suspicious);
  const susp = rows.filter(r =>  r.suspicious);
  _PU_mkChart('PU_C8', {
    type: 'scatter',
    data: { datasets: [
      { label: 'Normal',     data: norm.map(r => ({ x: r.event_count, y: r.total_value })), backgroundColor: PU_C_N_BG, borderColor: PU_C_NORM, pointRadius: 4 },
      { label: 'Suspicious', data: susp.map(r => ({ x: r.event_count, y: r.total_value })), backgroundColor: PU_C_S_BG, borderColor: PU_C_SUSP, pointRadius: 4 },
    ]},
    options: _PU_opts('Event Count', 'Total Value'),
  });
}

function _PU_chartDOW(dowRows) {
  const labels = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const data = labels.map((_, i) => {
    const found = dowRows.find(r => r.dow === i);
    return found ? found.event_count : 0;
  });
  _PU_mkChart('PU_C9', {
    type: 'bar',
    data: {
      labels,
      datasets: [{ label: 'Events', data,
        backgroundColor: PU_C_N_BG, borderColor: PU_C_NORM, borderWidth: 1 }],
    },
    options: _PU_opts('Day of Week', 'Events'),
  });
}

// ── Save / Load Rules ─────────────────────────────────────────────────────────

function PU_SaveRule() {
  const name = (document.getElementById('PU_RuleName')?.value || '').trim();
  if (!name) { alert('Enter a Rule Name before saving.'); return; }

  const rule = {
    name,
    typology: (document.getElementById('PU_TypologyType')?.value  || '').trim(),
    cardDim:  (document.getElementById('PU_CardDimension')?.value || '').trim(),
    amtCol:   (document.getElementById('PU_AmountMetric')?.value  || '').trim(),
    runByCol: document.getElementById('PU_RunByCS')?.querySelector('.cs-option.cs-selected')?.dataset?.value || '',
    runByOp:  document.getElementById('PU_RunByOp')?.value  || '=',
    runByVal: (document.getElementById('PU_RunByVal')?.value || '').trim(),
  };

  const saved = JSON.parse(localStorage.getItem('PU_SavedRules') || '[]');
  const idx   = saved.findIndex(r => r.name === name);
  if (idx >= 0) saved[idx] = rule; else saved.push(rule);
  localStorage.setItem('PU_SavedRules', JSON.stringify(saved));

  PU_RenderSavedRules();

  const btn = document.getElementById('PU_SaveBtn');
  if (btn) { const orig = btn.textContent; btn.textContent = 'Saved ✓'; setTimeout(() => btn.textContent = orig, 1400); }
}

function PU_LoadAndRun(idx) {
  const saved = JSON.parse(localStorage.getItem('PU_SavedRules') || '[]');
  const rule  = saved[idx];
  if (!rule) return;

  // Open form if hidden
  const form = document.getElementById('PU_NewRuleForm');
  if (form && form.style.display === 'none') form.style.display = '';

  document.getElementById('PU_RuleName').value     = rule.name;
  document.getElementById('PU_TypologyType').value = rule.typology || '';
  document.getElementById('PU_CardDimension').value = rule.cardDim || '';
  document.getElementById('PU_AmountMetric').value  = rule.amtCol  || '';

  // Set Run by
  if (rule.runByCol) {
    const opt = document.querySelector(`#PU_RunByCS .cs-option[data-value="${rule.runByCol.replace(/"/g, '\\"')}"]`);
    if (opt) {
      PU_SelectRunBy(opt, rule.runByCol);
    } else {
      const cs = document.getElementById('PU_RunByCS');
      if (cs) { cs.querySelector('.cs-value').textContent = rule.runByCol; cs.querySelector('.cs-value').style.color = ''; }
      document.getElementById('PU_RunByOp').style.display  = '';
      document.getElementById('PU_RunByVal').style.display = '';
    }
    document.getElementById('PU_RunByOp').value  = rule.runByOp  || '=';
    document.getElementById('PU_RunByVal').value = rule.runByVal || '';
  }

  PU_Run();
}

function PU_RenderSavedRules() {
  const container = document.getElementById('NAV_PU_SavedRules');
  if (!container) return;
  const saved = JSON.parse(localStorage.getItem('PU_SavedRules') || '[]');
  if (!saved.length) {
    container.innerHTML = '<div class="MN_hint" style="padding:4px 12px 8px;font-size:9px;">No saved rules yet</div>';
    return;
  }
  container.innerHTML = saved.map((r, i) => `
    <div style="display:flex;gap:4px;padding:2px 12px;align-items:center;">
      <button class="MN_btn" onclick="PU_LoadAndRun(${i})" title="${r.name}" style="flex:1;text-align:left;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${r.name}</button>
    </div>`).join('');
}

function _PU_chartAvgTime(rows) {
  _PU_mkChart('PU_C10', {
    type: 'line',
    data: {
      labels: rows.map(r => r.week),
      datasets: [{ label: 'Avg Value', data: rows.map(r => r.avg_value),
        borderColor: PU_C_NORM, backgroundColor: PU_C_N_BG, fill: true, tension: 0.3, pointRadius: 2 }],
    },
    options: _PU_opts('Week', 'Avg Value'),
  });
}
