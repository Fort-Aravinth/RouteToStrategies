// ── Score Comparison ──────────────────────────────────────────────────────────

// ── Score colour palette (one colour per score column) ────────────────────────
const SC_PALETTE = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

// ── State ─────────────────────────────────────────────────────────────────────
let _SC_ScoreCols  = [];   // [{ col: string, color: string }]
let _SC_SharedStyle = 'bar';
let _SC_RunBy      = { total: true, fraud: true };
let _SC_Criteria   = 'Volume';
let _SC_Calc       = 'Count';
let _SC_Charts     = { g001: null, g002: null, g003: null };
let _SC_BinsMap    = {};   // col → bins[] — base bins (no per-graph filters)

// Shared score range — applied identically across all score columns
let _SC_Start    = 0;
let _SC_End      = 0;
let _SC_Step     = 10;
window._SC_NormMode = false;

// Per-graph filter toggles  { amt: bool, params: { dm: bool, custom_0: bool, … } }
let _SC_G001_Filters = { amt: false, params: {} };
let _SC_G002_Filters = { amt: false, params: {} };
let _SC_G003_Filters = { amt: false, params: {} };

let _SC_FilterConns = ['AND', 'AND'];

// Nav controls → Nav_ScoreComparison.js
// DuckDB layer  → SC_Calc.js

// ── Open ──────────────────────────────────────────────────────────────────────
function SC_OpenPanel() {
  App_HideAllViews();
  document.querySelector('.shell').classList.add('sc-active');
  document.getElementById('SCView').style.display = '';
  document.getElementById('SC_MiniNav').style.display = 'flex';
  Sidebar_SetActive('nav-score-comparison');
  SC_OnOpen();
}

function SC_OnOpen() {
  NAV_SC_PopulateColumns();
  NAV_SC_RenderParams();
  NAV_SC_RefreshExtraCards();
  _SC_BinsMap = {};
  window._SC_NormMode = false;
  document.getElementById('SC_RunRawBtn')?.classList.add('active');
  document.getElementById('SC_RunNormBtn')?.classList.remove('active');
  document.getElementById('SC_TopBarRow').style.display    = 'none';
  document.getElementById('SC_ChapterPanel').style.display = 'none';
}

// ── Run Analysis ──────────────────────────────────────────────────────────────
async function SC_RunNormalised() {
  window._SC_NormMode = true;
  document.getElementById('SC_RunNormBtn')?.classList.add('active');
  document.getElementById('SC_RunRawBtn')?.classList.remove('active');
  await _SC_Execute();
}

async function SC_Run() {
  window._SC_NormMode = false;
  document.getElementById('SC_RunRawBtn')?.classList.add('active');
  document.getElementById('SC_RunNormBtn')?.classList.remove('active');
  await _SC_Execute();
}

async function _SC_Execute() {
  const conn = window.LD_getConn ? window.LD_getConn() : null;
  if (!conn) { alert('No data loaded.'); return; }

  const activeCols = _SC_ScoreCols.filter(s => s.col);
  if (!activeCols.length) { alert('Add at least one score column.'); return; }

  // Validate each active score has start/end defined
  const invalid = activeCols.find(s => s.start === undefined || s.end === undefined || isNaN(s.start) || isNaN(s.end));
  if (invalid) { alert(`Set Start and End values for "${invalid.col}".`); return; }

  // Keep shared globals for G003 threshold clamping — use first active col's range
  _SC_Start = activeCols[0].start;
  _SC_End   = activeCols[0].end;
  _SC_Step  = activeCols[0].step ?? 10;

  _SC_BinsMap = await SC_queryAllBins({});
  const anyData = Object.values(_SC_BinsMap).some(b => b.length > 0);
  if (!anyData) { alert('No data in this score range.'); return; }

  // Populate G002 filter metric custom-selects
  const filterMetrics = ['total', 'fraud', 'rate', 'value_total', 'value_fraud'];
  [0, 1, 2].forEach(i => {
    const cs = document.getElementById(`SCG002_FilterColCS${i}`);
    if (!cs) return;
    const prev = cs.dataset.value;
    const opts = cs.querySelector('.cs-options');
    if (!opts) return;
    opts.innerHTML = filterMetrics.map(c =>
      `<div class="cs-option${c === prev ? ' cs-selected' : ''}" onclick="SC_selectCS(this,'${c}','SCG002_rerun')">${c}</div>`
    ).join('');
  });

  // Constrain SCMyScore to the selected range
  const myScoreEl = document.getElementById('SCMyScore');
  if (myScoreEl) { myScoreEl.min = _SC_Start; myScoreEl.max = _SC_End; myScoreEl.value = ''; }

  document.getElementById('SC_TopBarRow').style.display    = 'grid';
  document.getElementById('SC_ChapterPanel').style.display = '';
  SC_SwitchTab(0);
  SCG001_rerun();
  SCG002_rerun();
  SCG003_rerun();
}

// ── Tab switching ─────────────────────────────────────────────────────────────
const _SC_TabTitles = ['Score Comparison', 'Score trend with filters', 'Above threshold'];

function SC_SwitchTab(idx) {
  [0, 1, 2].forEach(i => {
    document.getElementById(`SCG00${i+1}_Container`)?.style.setProperty('display', i === idx ? '' : 'none');
    document.getElementById(`SC_Tab${i}`)?.classList.toggle('SC_TabPill--active', i === idx);
  });
  const titleEl = document.getElementById('SC_ChapterTitle');
  if (titleEl) titleEl.textContent = _SC_TabTitles[idx];

  const fc        = document.getElementById('SC_FiltersCard');
  const titleCard = document.getElementById('SC_FiltersCardTitle');
  const mainEl    = document.getElementById('SC_FiltersMain');
  const threshEl  = document.getElementById('SC_FiltersThreshold');
  if (!fc) return;

  if (idx === 1) {
    fc.style.opacity = '1'; fc.style.pointerEvents = 'auto';
    if (titleCard) titleCard.textContent = 'Filters';
    if (mainEl)    mainEl.style.display = 'flex';
    if (threshEl)  threshEl.style.display = 'none';
  } else if (idx === 2) {
    fc.style.opacity = '1'; fc.style.pointerEvents = 'auto';
    if (titleCard) titleCard.textContent = 'Score Threshold';
    if (mainEl)    mainEl.style.display = 'none';
    if (threshEl)  threshEl.style.display = 'flex';
  } else {
    fc.style.opacity = '0.4'; fc.style.pointerEvents = 'none';
    if (titleCard) titleCard.textContent = 'Filters';
    if (mainEl)    mainEl.style.display = 'flex';
    if (threshEl)  threshEl.style.display = 'none';
  }
}

// ── Shared chart style ────────────────────────────────────────────────────────
function SC_SetSharedStyle(style) {
  _SC_SharedStyle = style;
  document.querySelectorAll('[id^="SC_StyleBtn_"]').forEach(b => b.classList.remove('active'));
  document.getElementById(`SC_StyleBtn_${style}`)?.classList.add('active');
  SCG001_rerun(); SCG002_rerun(); SCG003_rerun();
}

function SC_SetRunBy(mode) {
  _SC_RunBy[mode] = !_SC_RunBy[mode];
  if (!_SC_RunBy.total && !_SC_RunBy.fraud) _SC_RunBy[mode] = true;
  document.getElementById(`SC_RunByBtn_total`)?.classList.toggle('active', _SC_RunBy.total);
  document.getElementById(`SC_RunByBtn_fraud`)?.classList.toggle('active', _SC_RunBy.fraud);
  SCG001_rerun(); SCG002_rerun(); SCG003_rerun();
}

// ── Criteria / Calculate ──────────────────────────────────────────────────────
function SC_setCriteria(c) {
  _SC_Criteria = c;
  document.querySelectorAll('[id^="SCCrit"]').forEach(b => b.classList.remove('active'));
  document.getElementById(`SCCrit${c}`)?.classList.add('active');
  SCG001_rerun(); SCG002_rerun(); SCG003_rerun();
}

function SC_setCalc(c) {
  _SC_Calc = c;
  document.querySelectorAll('[id^="SCCalc"]').forEach(b => b.classList.remove('active'));
  document.getElementById(`SCCalc${c}`)?.classList.add('active');
  SCG001_rerun(); SCG002_rerun(); SCG003_rerun();
}

// ── Per-graph filter toggles ──────────────────────────────────────────────────
function SC_toggleAmtFilter(gIdx) {
  const f = [_SC_G001_Filters, _SC_G002_Filters, _SC_G003_Filters][gIdx];
  f.amt = !f.amt;
  [SCG001_rerun, SCG002_rerun, SCG003_rerun][gIdx]();
}

function SC_toggleParamFilter(gIdx, key) {
  const f = [_SC_G001_Filters, _SC_G002_Filters, _SC_G003_Filters][gIdx];
  f.params[key] = !f.params[key];
  [SCG001_rerun, SCG002_rerun, SCG003_rerun][gIdx]();
}

// ── Graph render ──────────────────────────────────────────────────────────────
// binsMap = { col: bins[] } — one entry per score column
function SC_RenderGraph(key, canvasId, binsMap) {
  const scores = _SC_ScoreCols.filter(s => s.col && (binsMap[s.col] || []).length > 0);
  if (!scores.length) return;

  const style     = _SC_SharedStyle;
  const isArea    = style === 'area';
  const chartType = isArea ? 'line' : (style === 'scatter' ? 'scatter' : style);

  // All scores share the same bin range so labels come from the first
  const firstBins = binsMap[scores[0].col] || [];
  const labels    = firstBins.map(b => b.label);

  const fmtN = v => v >= 1e6 ? (v/1e6).toFixed(1)+'M' : v >= 1e3 ? (v/1e3).toFixed(1)+'K' : Number.isInteger(v) ? v : v.toFixed(2);
  const scatterify = data => style === 'scatter' ? data.map((y, i) => ({ x: i, y })) : data;

  const datasets = [];
  scores.forEach(s => {
    const bins = binsMap[s.col] || [];
    const { totalVals, fraudVals } = SC_getBinsData(bins);
    const hex = s.color;

    if (_SC_RunBy.total) {
      datasets.push({
        label: `${s.col} — Total`,
        data: scatterify(totalVals),
        backgroundColor: isArea ? hex + '22' : hex + '55',
        borderColor: hex + 'aa',
        borderWidth: 1.5,
        borderDash: [4, 3],
        fill: isArea,
        tension: 0.35,
      });
    }
    if (_SC_RunBy.fraud) {
      datasets.push({
        label: `${s.col} — Fraud`,
        data: scatterify(fraudVals),
        backgroundColor: isArea ? hex + '33' : hex + 'cc',
        borderColor: hex,
        borderWidth: 2,
        fill: isArea,
        tension: 0.35,
      });
    }
  });

  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  if (_SC_Charts[key]) { _SC_Charts[key].destroy(); _SC_Charts[key] = null; }

  _SC_Charts[key] = new Chart(canvas, {
    type: chartType,
    data: { labels: style === 'scatter' ? undefined : labels, datasets },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: 'top',
          labels: { font: { size: 9 }, boxWidth: 10, padding: 8 },
        },
        tooltip: {
          mode: 'index', intersect: false,
          callbacks: {
            title: items => items[0]?.label ?? '',
            label: item => `  ${item.dataset.label}: ${fmtN(item.raw?.y ?? item.raw)}`,
          },
        },
      },
      scales: {
        x: { ticks: { font: { size: 9 }, maxRotation: 45 } },
        y: { ticks: { font: { size: 9 } }, beginAtZero: true },
      },
    },
  });

  SC_renderLegend(key, scores);
}

// ── Score legend dots (below chart) ──────────────────────────────────────────
function SC_renderLegend(key, scores) {
  const el = document.getElementById(`SC_Legend_${key}`);
  if (!el) return;
  el.innerHTML = scores.map(s =>
    `<span style="display:inline-flex;align-items:center;gap:5px;white-space:nowrap;">
      <span style="width:10px;height:10px;border-radius:50%;background:${s.color};flex-shrink:0;"></span>
      <span style="font-size:0.68rem;font-weight:600;color:var(--color-header-title);">${s.col}</span>
    </span>`
  ).join('');
}

// ── Individual graph reruns (async — re-query with per-graph filters) ──────────
async function SCG001_rerun() {
  const binsMap = await SC_queryAllBins(_SC_G001_Filters);
  SC_RenderGraph('g001', 'SCG001_Canvas', binsMap);
  SCG001_renderSummary();
}

async function SCG002_rerun() {
  const binsMap  = await SC_queryAllBins(_SC_G002_Filters);
  const filtered = {};
  Object.keys(binsMap).forEach(col => { filtered[col] = SC_applyG002Filters(binsMap[col]); });
  SC_RenderGraph('g002', 'SCG002_Canvas', filtered);
  SCG002_renderSummary();
}

function SC_clampMyScore() {
  const el = document.getElementById('SCMyScore');
  if (!el || el.value === '') { SCG003_rerun(); return; }
  let v = parseFloat(el.value);
  if (v < _SC_Start) v = _SC_Start;
  if (v > _SC_End)   v = _SC_End;
  el.value = v;
  SCG003_rerun();
}

async function SCG003_rerun() {
  const threshold = parseFloat(document.getElementById('SCMyScore')?.value) || 0;
  // Shared threshold — applied as a per-column extra WHERE for each score
  const extraWheresPerCol = {};
  _SC_ScoreCols.forEach(s => {
    extraWheresPerCol[s.col] = threshold > 0 ? [`"${s.col}" >= ${threshold}`] : [];
  });
  const binsMap = await SC_queryAllBins(_SC_G003_Filters, extraWheresPerCol);
  SC_RenderGraph('g003', 'SCG003_Canvas', binsMap);
  SCG003_renderSummary();
}

function SC_setFilterConn(idx, type) {
  _SC_FilterConns[idx] = type;
  document.getElementById(`SCG002_FilterConn${idx}And`)?.classList.toggle('active', type === 'AND');
  document.getElementById(`SCG002_FilterConn${idx}Or`)?.classList.toggle('active',  type === 'OR');
  SCG002_rerun();
}

function SC_addFilter() {
  const row1 = document.getElementById('SCG002_FilterRow1');
  const row2 = document.getElementById('SCG002_FilterRow2');
  if (row1?.style.display === 'none') { row1.style.display = ''; return; }
  if (row2?.style.display === 'none') row2.style.display = '';
}

function SC_removeFilter(idx) {
  const row = document.getElementById(`SCG002_FilterRow${idx}`);
  if (row) row.style.display = 'none';
  const cs = document.getElementById(`SCG002_FilterColCS${idx}`);
  if (cs) {
    cs.dataset.value = '';
    const v = cs.querySelector('.cs-value');
    if (v) { v.textContent = '— select —'; v.style.color = 'var(--dml-label)'; }
    cs.querySelectorAll('.cs-option').forEach(o => o.classList.remove('cs-selected'));
  }
  const valEl = document.getElementById(`SCG002_FilterVal${idx}`);
  if (valEl) valEl.value = '';
  SCG002_rerun();
}

// ── Custom-select helpers ─────────────────────────────────────────────────────
function SC_toggleCS(id) {
  const el = document.getElementById(id);
  if (!el) return;
  const isOpen = el.classList.contains('open');
  document.querySelectorAll('#SCView .custom-select.open').forEach(s => s.classList.remove('open'));
  if (!isOpen) {
    el.classList.add('open');
    setTimeout(() => {
      const opts = el.querySelector('.cs-options');
      if (!opts) return;
      const rect = el.getBoundingClientRect();
      const dropH = Math.min(200, opts.scrollHeight + 8);
      opts.style.left  = rect.left + 'px';
      opts.style.width = rect.width + 'px';
      opts.style.top   = (window.innerHeight - rect.bottom < dropH && rect.top > dropH)
        ? (rect.top - dropH - 2) + 'px'
        : (rect.bottom + 2) + 'px';
    }, 0);
  }
}

function SC_selectCS(el, value, callback) {
  const cs = el.closest('.custom-select');
  if (!cs) return;
  const valEl = cs.querySelector('.cs-value');
  if (valEl) { valEl.textContent = value || '— select —'; valEl.style.color = value ? '' : 'var(--dml-label)'; }
  cs.querySelectorAll('.cs-option').forEach(o => o.classList.remove('cs-selected'));
  el.classList.add('cs-selected');
  cs.classList.remove('open');
  cs.dataset.value = value;
  if (callback && window[callback]) window[callback]();
}

function SC_getCSValue(id) {
  return document.getElementById(id)?.dataset.value ?? '';
}

document.addEventListener('click', e => {
  if (!e.target.closest('#SCView .custom-select')) {
    document.querySelectorAll('#SCView .custom-select.open').forEach(s => s.classList.remove('open'));
  }
});

// ── Nav active vals helper ────────────────────────────────────────────────────
function SC_getNavActiveVals(key) {
  const body = document.getElementById(`NAV_SC_ExtraBody_${key}`);
  if (!body) return null;
  const btns = [...body.querySelectorAll('.MN_paramVal')];
  if (!btns.length) return null;
  return btns.filter(b => b.classList.contains('active')).map(b => b.textContent.trim());
}

// ── Summary chips ─────────────────────────────────────────────────────────────
function SC_chip(label, val, color) {
  return `<span style="display:inline-flex;align-items:center;gap:4px;height:36px;padding:0 12px;border-radius:20px;background:${color}15;border:1px solid ${color}40;white-space:nowrap;">
    <span style="font-size:0.65rem;font-weight:700;color:${color};text-transform:uppercase;letter-spacing:0.05em;">${label}</span>
    <span style="font-weight:600;color:var(--color-header-title);font-size:0.72rem;">${val}</span>
  </span>`;
}

function SC_toggleChip(label, val, color, isActive, onclick) {
  const bg  = isActive ? `${color}15` : 'transparent';
  const bdr = isActive ? `${color}40` : '#9ca3af40';
  const lc  = isActive ? color : '#9ca3af';
  const vc  = isActive ? 'var(--color-header-title)' : '#9ca3af';
  const tip = isActive ? 'Click to deactivate filter' : 'Click to activate filter';
  return `<span onclick="${onclick}" title="${tip}" style="display:inline-flex;align-items:center;gap:4px;height:36px;padding:0 12px;border-radius:20px;background:${bg};border:1px solid ${bdr};white-space:nowrap;cursor:pointer;transition:all 0.15s;">
    <span style="font-size:0.65rem;font-weight:700;color:${lc};text-transform:uppercase;letter-spacing:0.05em;">${label}</span>
    <span style="font-weight:600;color:${vc};font-size:0.72rem;">${val}</span>
  </span>`;
}

function SC_buildFilterChips(gIdx) {
  const g      = id => document.getElementById(id)?.value || '';
  const params = window.SP_getParams ? window.SP_getParams() : {};
  const fState = [_SC_G001_Filters, _SC_G002_Filters, _SC_G003_Filters][gIdx];
  const parts  = [];

  const C = { teal:'#00A99D', fusia:'#9C187D', peel:'#F47943',
               sky:'#84B1EC', lavender:'#8571F4', indigo:'#37189C' };
  const customPalette = [C.peel, C.sky, C.lavender, C.fusia, C.indigo];

  // One score chip per active column
  _SC_ScoreCols.filter(s => s.col).forEach(s => {
    let rangeLabel;
    if (window._SC_NormMode) {
      rangeLabel = '0% → 100%';
    } else if (gIdx === 2) {
      const thresh = parseFloat(g('SCMyScore')) || s.start;
      rangeLabel = `${thresh} → ${s.end}`;
    } else {
      rangeLabel = `${s.start} → ${s.end}`;
    }
    parts.push(SC_chip(s.col, rangeLabel, s.color));
  });

  // Amount filter chip
  const amtCol = g('SCAmountCol');
  if (amtCol) {
    const valStart = g('SCAmountValStart');
    const valEnd   = g('SCAmountValEnd');
    const amtParts = [];
    if (valStart) amtParts.push(`${g('SCAmountOpStart') || '>='} ${valStart}`);
    if (valEnd)   amtParts.push(`${g('SCAmountOpEnd')   || '<='} ${valEnd}`);
    const amtLabel = amtParts.length ? amtParts.join(' and ') : 'no filter';
    parts.push(SC_toggleChip(amtCol, amtLabel, C.teal, fState.amt, `SC_toggleAmtFilter(${gIdx})`));
  }

  // Decision Mode chip
  const dm = params.decisionMode;
  if (dm?.col) {
    const navVals = SC_getNavActiveVals('dm');
    const vals    = navVals !== null ? navVals :
      [...(dm.assigned?.successful || []), ...(dm.assigned?.unsuccessful || [])];
    if (vals.length) {
      parts.push(SC_toggleChip(dm.col, vals.join(', '), C.fusia,
        !!fState.params['dm'], `SC_toggleParamFilter(${gIdx},'dm')`));
    }
  }

  // Custom card chips
  (params.customCards || []).forEach((card, i) => {
    if (!card.col) return;
    const key     = `custom_${i}`;
    const navVals = SC_getNavActiveVals(key);
    const vals    = navVals !== null ? navVals :
      [...(card.assigned?.a || []), ...(card.assigned?.b || [])];
    if (!vals.length) return;
    parts.push(SC_toggleChip(card.col, vals.join(', '), customPalette[i % customPalette.length],
      !!fState.params[key], `SC_toggleParamFilter(${gIdx},'${key}')`));
  });

  return parts;
}

function SC_RefreshChips() {
  SCG001_renderSummary();
  SCG002_renderSummary();
  SCG003_renderSummary();
}

function SCG001_renderSummary() {
  const el = document.getElementById('SCG001_Summary');
  if (!el) return;
  el.innerHTML = SC_buildFilterChips(0).join('') ||
    '<span style="color:var(--color-text-dim);font-style:italic;">No active filters</span>';
}

function SCG002_renderSummary() {
  const el = document.getElementById('SCG002_Summary');
  if (!el) return;
  const g     = id => document.getElementById(id)?.value || '';
  const parts = SC_buildFilterChips(1);
  [0, 1, 2].forEach(i => {
    const col = SC_getCSValue(`SCG002_FilterColCS${i}`);
    const op  = SC_getCSValue(`SCG002_FilterOpCS${i}`) || '>';
    const val = g(`SCG002_FilterVal${i}`);
    if (col && val !== '') parts.push(SC_chip(col, `${op} ${val}`, '#84B1EC'));
  });
  el.innerHTML = parts.join('') ||
    '<span style="color:var(--color-text-dim);font-style:italic;">No active filters</span>';
}

function SCG003_renderSummary() {
  const el = document.getElementById('SCG003_Summary');
  if (!el) return;
  el.innerHTML = SC_buildFilterChips(2).join('') ||
    '<span style="color:var(--color-text-dim);font-style:italic;">No active filters</span>';
}

// ── View Strategies / Copy / Like ─────────────────────────────────────────────
const _SC_TabTitles_modal = ['Score Comparison', 'Score trend with filters', 'Above threshold'];
let _SC_CurrentStrategy = null;

function SC_BuildStrategyJSON(graphIdx) {
  const g      = id => document.getElementById(id)?.value || '';
  const params = window.SP_getParams ? window.SP_getParams() : {};
  const fState = [_SC_G001_Filters, _SC_G002_Filters, _SC_G003_Filters][graphIdx];

  // Per-score conditions (mirrors SA_BuildStrategyJSON per column)
  const scoreEntries = _SC_ScoreCols.filter(s => s.col).map(s => {
    const conditions = graphIdx === 2
      ? [{ op: '>=', value: parseFloat(g('SCMyScore')) || s.start }]
      : [{ op: '>=', value: s.start }, { op: '<=', value: s.end }];
    return { col: s.col, conditions };
  });

  // Amount filter
  const amtCol    = g('SCAmountCol');
  const amtStart  = g('SCAmountValStart');
  const amtEnd    = g('SCAmountValEnd');
  const amtActive = fState.amt && !!amtCol;
  const amtConditions = [];
  if (amtStart) amtConditions.push({ op: g('SCAmountOpStart') || '>=', value: parseFloat(amtStart) });
  if (amtEnd)   amtConditions.push({ op: g('SCAmountOpEnd')   || '<=', value: parseFloat(amtEnd)   });

  // Bin-level post-filters (G002 only)
  const binFilters = [];
  if (graphIdx === 1) {
    [0, 1, 2].forEach(i => {
      const col = SC_getCSValue(`SCG002_FilterColCS${i}`);
      const op  = SC_getCSValue(`SCG002_FilterOpCS${i}`) || '>';
      const val = g(`SCG002_FilterVal${i}`);
      if (col && val !== '') binFilters.push({ col, op, value: parseFloat(val) });
    });
  }

  // Param filters — only if per-graph toggle is active (mirrors SA)
  const paramFilters = [];
  if (params.decisionMode?.col && fState.params['dm']) {
    const vals = SC_getNavActiveVals('dm') ??
      [...(params.decisionMode.assigned?.successful || []), ...(params.decisionMode.assigned?.unsuccessful || [])];
    if (vals.length) paramFilters.push({ col: params.decisionMode.col, values: vals });
  }
  (params.customCards || []).forEach((card, i) => {
    if (!card.col || !fState.params[`custom_${i}`]) return;
    const vals = SC_getNavActiveVals(`custom_${i}`) ??
      [...(card.assigned?.a || []), ...(card.assigned?.b || [])];
    if (vals.length) paramFilters.push({ col: card.col, values: vals });
  });

  return {
    ScoreEntries:      scoreEntries,
    AmountInformation: { active: amtActive, col: amtCol, conditions: amtConditions },
    BinFilters:        binFilters,
    ParamFilters:      paramFilters,
    Criteria:          _SC_Criteria,
    Calculate:         _SC_Calc,
    Style:             _SC_SharedStyle,
  };
}

function SC_ViewStrategies(graphIdx) {
  if (!Object.keys(_SC_BinsMap).length) { alert('Run comparison first.'); return; }
  const s = SC_BuildStrategyJSON(graphIdx);
  _SC_CurrentStrategy = s;

  const lbl = t => `<div style="font-size:0.65rem;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;color:var(--dml-label);margin-bottom:2px;margin-top:10px;">${t}</div>`;
  const row = v => `<div style="font-size:0.82rem;font-weight:600;color:var(--dml-text);margin-bottom:2px;">${v}</div>`;
  const dim = t => `<div style="font-size:0.8rem;color:var(--dml-label);font-style:italic;">${t}</div>`;
  const condRows = arr => arr.length ? arr.map(c => row(`${c.op} ${Number.isInteger(c.value) ? c.value : c.value?.toFixed(2)}`)).join('') : dim('—');
  const thStyle = `padding:10px 14px;font-size:0.62rem;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;border-bottom:1px solid var(--color-card-border);text-align:left;white-space:nowrap;`;
  const tdStyle = `padding:10px 14px;vertical-align:top;border-right:1px solid var(--color-card-border);`;

  const scoresCell = s.ScoreEntries.length
    ? s.ScoreEntries.map(se => lbl('Metric') + row(se.col) + lbl('Conditions') + condRows(se.conditions)).join('')
    : dim('None');
  const amtCell = s.AmountInformation.active
    ? lbl('Metric') + row(s.AmountInformation.col) + lbl('Conditions') + condRows(s.AmountInformation.conditions)
    : dim('None');
  const filterEntries = [
    ...s.ParamFilters.map(f => ({ col: f.col, cond: f.values.join(', ') })),
    ...s.BinFilters.map(f   => ({ col: f.col, cond: `${f.op} ${f.value}` })),
  ];
  const filtersCell = filterEntries.length
    ? filterEntries.map(f => lbl('Metric') + row(f.col) + lbl('Conditions') + row(f.cond)).join('')
    : dim('None');

  const cardHtml = `
    <table style="width:100%;border-collapse:collapse;table-layout:fixed;">
      <thead>
        <tr style="background:var(--color-page-bg);">
          <th style="${thStyle}color:#0ea5e9;">Score Information</th>
          <th style="${thStyle}color:#3b82f6;">Amount Information</th>
          <th style="${thStyle}color:#6366f1;border-right:none;">Additional Information</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td style="${tdStyle}">${scoresCell}</td>
          <td style="${tdStyle}">${amtCell}</td>
          <td style="${tdStyle.replace('border-right:1px solid var(--color-card-border);','')}">${filtersCell}</td>
        </tr>
      </tbody>
    </table>`;

  document.getElementById('SA_StrategyModalTitle').textContent = _SC_TabTitles_modal[graphIdx];
  document.getElementById('SA_StrategyModalSub').textContent = '';
  document.getElementById('SA_StrategyModalBody').innerHTML = cardHtml;
  document.getElementById('SA_StrategyModal').dataset.graphIdx = graphIdx;
  Popup_open('SA_StrategyModal');
}

function SC_CopyGraph(graphIdx) {
  if (!Object.keys(_SC_BinsMap).length) { alert('Run comparison first.'); return; }
  const s = SC_BuildStrategyJSON(graphIdx);
  const additionalColumns = [
    ...s.ParamFilters.map(f => ({ Column: f.col, Values: f.values })),
    ...s.BinFilters.map(f   => ({ Column: f.col, Operator: f.op, Value: f.value })),
  ];
  const output = APP_FormatStrategyPayload('Score Comparison', {
    amount: s.AmountInformation,
    scores: s.ScoreEntries,
    additionalColumns,
  });
  APP_CopyText(JSON.stringify(output, null, 2));
}

function SC_LikeGraph(graphIdx) {
  if (!Object.keys(_SC_BinsMap).length) { alert('Run comparison first.'); return; }
  const s = SC_BuildStrategyJSON(graphIdx);
  const additionalColumns = [
    ...s.ParamFilters.map(f => ({ Column: f.col, Values: f.values })),
    ...s.BinFilters.map(f   => ({ Column: f.col, Operator: f.op, Value: f.value })),
  ];
  APP_LikeIt('Score Comparison', {
    amount: s.AmountInformation,
    scores: s.ScoreEntries,
    additionalColumns,
  });
}
