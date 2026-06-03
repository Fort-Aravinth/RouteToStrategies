/* ── Score Analysis ── */

// ── State ─────────────────────────────────────────────────────────────────────
let _SA_SharedStyle = 'bar';
let _SA_RunBy = { total: true, fraud: true };
let _SA_Criteria    = 'Volume';
let _SA_Calc        = 'Count';
let _SA_Charts      = { g001: null, g002: null, g003: null };
let _SA_Bins        = [];   // base bins (score range only, no extra filters)

// Score config — stored on SA_Run so reruns can rebuild queries
let _SA_ScoreCol = '';
let _SA_Start    = 0;
let _SA_End      = 0;
let _SA_Step     = 10;

// Per-graph filter toggles  { amt: bool, params: { dm: bool, custom_0: bool, … } }
let _SA_G001_Filters = { amt: false, params: {} };
let _SA_G002_Filters = { amt: false, params: {} };
let _SA_G003_Filters = { amt: false, params: {} };

let _SA_FilterConns = ['AND', 'AND'];

// Nav controls → Nav_ScoreAnalysis.js  /  Toggle functions → Nav.js

// ── Open ──────────────────────────────────────────────────────────────────────
function SA_OpenPanel() {
  App_HideAllViews();
  document.querySelector('.shell').classList.add('sa-active');
  document.getElementById('SAView').style.display = '';
  document.getElementById('SA_MiniNav').style.display = 'flex';
  Sidebar_SetActive('nav-score-analysis');
  SA_OnOpen();
}

function SA_OnOpen() {
  NAV_SA_PopulateColumns();
  NAV_SA_RenderParams();
  NAV_SA_RefreshExtraCards();
  NAV_SA_RefreshPresetDropdowns();
  _SA_Bins = [];
  document.getElementById('SA_TopBarRow').style.display    = 'none';
  document.getElementById('SA_ChapterPanel').style.display = 'none';
}

// SA_queryBins, SA_applyCalc, SA_getBinsData, SA_applyG002Filters → SA_Calc.js

// ── Run Analysis ──────────────────────────────────────────────────────────────
async function SA_Run() {
  const conn = window.LD_getConn ? window.LD_getConn() : null;
  if (!conn) { alert('No data loaded.'); return; }

  _SA_ScoreCol = SA_getCSValue('SAScoreColCS');
  if (!_SA_ScoreCol) { alert('Select a score column first.'); return; }

  _SA_Start = parseFloat(document.getElementById('SAStart')?.value);
  _SA_End   = parseFloat(document.getElementById('SAEnd')?.value);
  _SA_Step  = parseFloat(document.getElementById('SAStep')?.value) || 10;
  if (isNaN(_SA_Start) || isNaN(_SA_End)) { alert('Enter Start and End values.'); return; }

  // Base bins — no per-graph filters
  _SA_Bins = await SA_queryBins({});
  if (!_SA_Bins.length) { alert('No data in this score range.'); return; }

  // Populate G002 filter metric custom-selects
  const filterMetrics = ['total', 'fraud', 'rate', 'value_total', 'value_fraud'];
  [0, 1, 2].forEach(i => {
    const cs = document.getElementById(`SAG002_FilterColCS${i}`);
    if (!cs) return;
    const prev = cs.dataset.value;
    const opts = cs.querySelector('.cs-options');
    if (!opts) return;
    opts.innerHTML = filterMetrics.map(c =>
      `<div class="cs-option${c === prev ? ' cs-selected' : ''}" onclick="SA_selectCS(this,'${c}','SAG002_rerun')">${c}</div>`
    ).join('');
  });

  // Constrain SAMyScore to the selected score range
  const myScoreEl = document.getElementById('SAMyScore');
  if (myScoreEl) { myScoreEl.min = _SA_Start; myScoreEl.max = _SA_End; myScoreEl.value = ''; }

  document.getElementById('SA_TopBarRow').style.display    = 'grid';
  document.getElementById('SA_ChapterPanel').style.display = '';
  SA_SwitchTab(0);
  SAG001_rerun();
  SAG002_rerun();
  SAG003_rerun();
}

// ── Tab switching ─────────────────────────────────────────────────────────────
const _SA_TabTitles = ['Score Analysis', 'Score trend with filters', 'Above my score'];

function SA_SwitchTab(idx) {
  [0, 1, 2].forEach(i => {
    document.getElementById(`SAG00${i+1}_Container`)?.style.setProperty('display', i === idx ? '' : 'none');
    document.getElementById(`SA_Tab${i}`)?.classList.toggle('SA_TabPill--active', i === idx);
  });
  const titleEl = document.getElementById('SA_ChapterTitle');
  if (titleEl) titleEl.textContent = _SA_TabTitles[idx];

  const fc        = document.getElementById('SA_FiltersCard');
  const titleCard = document.getElementById('SA_FiltersCardTitle');
  const mainEl    = document.getElementById('SA_FiltersMain');
  const threshEl  = document.getElementById('SA_FiltersThreshold');
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
function SA_SetSharedStyle(style) {
  _SA_SharedStyle = style;
  document.querySelectorAll('[id^="SA_StyleBtn_"]').forEach(b => b.classList.remove('active'));
  document.getElementById(`SA_StyleBtn_${style}`)?.classList.add('active');
  SAG001_rerun(); SAG002_rerun(); SAG003_rerun();
}

function SA_SetRunBy(mode) {
  _SA_RunBy[mode] = !_SA_RunBy[mode];
  // Prevent both off — re-enable the one just toggled off
  if (!_SA_RunBy.total && !_SA_RunBy.fraud) _SA_RunBy[mode] = true;
  document.getElementById(`SA_RunByBtn_total`)?.classList.toggle('active', _SA_RunBy.total);
  document.getElementById(`SA_RunByBtn_fraud`)?.classList.toggle('active', _SA_RunBy.fraud);
  SAG001_rerun(); SAG002_rerun(); SAG003_rerun();
}

// ── Criteria / Calculate ──────────────────────────────────────────────────────
function SA_setCriteria(c) {
  _SA_Criteria = c;
  document.querySelectorAll('[id^="SACrit"]').forEach(b => b.classList.remove('active'));
  document.getElementById(`SACrit${c}`)?.classList.add('active');
  SAG001_rerun(); SAG002_rerun(); SAG003_rerun();
}

function SA_setCalc(c) {
  _SA_Calc = c;
  document.querySelectorAll('[id^="SACalc"]').forEach(b => b.classList.remove('active'));
  document.getElementById(`SACalc${c}`)?.classList.add('active');
  SAG001_rerun(); SAG002_rerun(); SAG003_rerun();
}

// ── Per-graph filter toggles ──────────────────────────────────────────────────
function SA_toggleAmtFilter(gIdx) {
  const f = [_SA_G001_Filters, _SA_G002_Filters, _SA_G003_Filters][gIdx];
  f.amt = !f.amt;
  [SAG001_rerun, SAG002_rerun, SAG003_rerun][gIdx]();
}

function SA_toggleParamFilter(gIdx, key) {
  const f = [_SA_G001_Filters, _SA_G002_Filters, _SA_G003_Filters][gIdx];
  f.params[key] = !f.params[key];
  [SAG001_rerun, SAG002_rerun, SAG003_rerun][gIdx]();
}


// ── Graph render ──────────────────────────────────────────────────────────────
function SA_RenderGraph(key, canvasId, bins) {
  if (!bins.length) return;
  const { labels, totalVals, fraudVals } = SA_getBinsData(bins);
  const style     = _SA_SharedStyle;
  const isArea    = style === 'area';
  const chartType = isArea ? 'line' : (style === 'scatter' ? 'scatter' : style);

  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  if (_SA_Charts[key]) { _SA_Charts[key].destroy(); _SA_Charts[key] = null; }

  const TC = 'rgba(123,104,200,', FC = 'rgba(239,68,68,';
  const scatterify = data => style === 'scatter' ? data.map((y, i) => ({ x: i, y })) : data;

  const datasets = [
    { label: 'Total', data: scatterify(totalVals),
      backgroundColor: TC + (isArea ? '0.15)' : '0.5)'), borderColor: TC + '1)',
      borderWidth: 1.5, fill: isArea, tension: 0.35,
      hidden: !_SA_RunBy.total },
    { label: 'Fraud', data: scatterify(fraudVals),
      backgroundColor: FC + (isArea ? '0.15)' : '0.65)'), borderColor: FC + '1)',
      borderWidth: 1.5, fill: isArea, tension: 0.35,
      hidden: !_SA_RunBy.fraud },
  ];

  const fmtN = v => v >= 1e6 ? (v/1e6).toFixed(1)+'M' : v >= 1e3 ? (v/1e3).toFixed(1)+'K' : Number.isInteger(v) ? v : v.toFixed(2);

  _SA_Charts[key] = new Chart(canvas, {
    type: chartType,
    data: {
      labels: style === 'scatter' ? undefined : labels,
      datasets,
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          mode: 'index', intersect: false,
          callbacks: {
            title: items => items[0]?.label ?? '',
            label: item => {
              const name = item.dataset.label;
              const val  = fmtN(item.raw?.y ?? item.raw);
              return `  ${name}: ${val}`;
            },
            afterBody: items => {
              const tot = datasets[0].data[items[0]?.dataIndex];
              const frd = datasets[1].data[items[0]?.dataIndex];
              const t = typeof tot === 'object' ? tot.y : tot;
              const f = typeof frd === 'object' ? frd.y : frd;
              if (t > 0) return [`  Rate: ${(f / t * 100).toFixed(1)}%`];
              return [];
            },
          },
        },
      },
      scales: {
        x: { ticks: { font: { size: 9 }, maxRotation: 45 } },
        y: { ticks: { font: { size: 9 } }, beginAtZero: true },
      },
    },
  });
}

// ── Individual graph reruns (async — re-query with per-graph filters) ──────────
async function SAG001_rerun() {
  const bins = await SA_queryBins(_SA_G001_Filters);
  SA_RenderGraph('g001', 'SAG001_Canvas', bins);
  SAG001_renderSummary(bins);
}

async function SAG002_rerun() {
  const bins     = await SA_queryBins(_SA_G002_Filters);
  const filtered = SA_applyG002Filters(bins);
  SA_RenderGraph('g002', 'SAG002_Canvas', filtered);
  SAG002_renderSummary();
}

function SA_clampMyScore() {
  const el = document.getElementById('SAMyScore');
  if (!el || el.value === '') { SAG003_rerun(); return; }
  let v = parseFloat(el.value);
  if (v < _SA_Start) v = _SA_Start;
  if (v > _SA_End)   v = _SA_End;
  el.value = v;
  SAG003_rerun();
}

async function SAG003_rerun() {
  const threshold = parseFloat(document.getElementById('SAMyScore')?.value) || 0;
  const extra     = threshold > 0 ? [`"${_SA_ScoreCol}" >= ${threshold}`] : [];
  const bins      = await SA_queryBins(_SA_G003_Filters, extra);
  SA_RenderGraph('g003', 'SAG003_Canvas', bins);
  SAG003_renderSummary(bins);
}


function SA_setFilterConn(idx, type) {
  _SA_FilterConns[idx] = type;
  document.getElementById(`SAG002_FilterConn${idx}And`)?.classList.toggle('active', type === 'AND');
  document.getElementById(`SAG002_FilterConn${idx}Or`)?.classList.toggle('active',  type === 'OR');
  SAG002_rerun();
}

function SA_addFilter() {
  const row1 = document.getElementById('SAG002_FilterRow1');
  const row2 = document.getElementById('SAG002_FilterRow2');
  if (row1?.style.display === 'none') { row1.style.display = ''; return; }
  if (row2?.style.display === 'none') row2.style.display = '';
}

function SA_removeFilter(idx) {
  const row = document.getElementById(`SAG002_FilterRow${idx}`);
  if (row) row.style.display = 'none';
  const cs = document.getElementById(`SAG002_FilterColCS${idx}`);
  if (cs) {
    cs.dataset.value = '';
    const v = cs.querySelector('.cs-value');
    if (v) { v.textContent = '— select —'; v.style.color = 'var(--dml-label)'; }
    cs.querySelectorAll('.cs-option').forEach(o => o.classList.remove('cs-selected'));
  }
  const valEl = document.getElementById(`SAG002_FilterVal${idx}`);
  if (valEl) valEl.value = '';
  SAG002_rerun();
}

// ── Custom-select helpers (Filters card) ─────────────────────────────────────
function SA_toggleCS(id) {
  const el = document.getElementById(id);
  if (!el) return;
  const isOpen = el.classList.contains('open');
  document.querySelectorAll('#SAView .custom-select.open, #SA_MiniNav .custom-select.open').forEach(s => s.classList.remove('open'));
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

function SA_selectCS(el, value, callback) {
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

function SA_getCSValue(id) {
  return document.getElementById(id)?.dataset.value ?? '';
}

document.addEventListener('click', e => {
  if (!e.target.closest('#SAView .custom-select') && !e.target.closest('#SA_MiniNav .custom-select')) {
    document.querySelectorAll('#SAView .custom-select.open, #SA_MiniNav .custom-select.open').forEach(s => s.classList.remove('open'));
  }
});

// ── Summary chips ─────────────────────────────────────────────────────────────
function SA_chip(label, val, color) {
  return `<span style="display:inline-flex;align-items:center;gap:4px;height:36px;padding:0 12px;border-radius:20px;background:${color}15;border:1px solid ${color}40;white-space:nowrap;">
    <span style="font-size:0.65rem;font-weight:700;color:${color};text-transform:uppercase;letter-spacing:0.05em;">${label}</span>
    <span style="font-weight:600;color:var(--color-header-title);font-size:0.72rem;">${val}</span>
  </span>`;
}

function SA_toggleChip(label, val, color, isActive, onclick) {
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

// Read which values are currently active (toggled on) in a nav extra card
function SA_getNavActiveVals(key) {
  const body = document.getElementById(`NAV_SA_ExtraBody_${key}`);
  if (!body) return null;
  const btns = [...body.querySelectorAll('.MN_paramVal')];
  if (!btns.length) return null;
  const active = btns.filter(b => b.classList.contains('active')).map(b => b.textContent.trim());
  return active; // empty array = card exists but nothing selected
}

function SA_buildFilterChips(gIdx) {
  const g      = id => document.getElementById(id)?.value || '';
  const params = window.SP_getParams ? window.SP_getParams() : {};
  const fState = [_SA_G001_Filters, _SA_G002_Filters, _SA_G003_Filters][gIdx];
  const parts  = [];

  // Brand palette
  const C = { purple:'#79189C', teal:'#00A99D', fusia:'#9C187D', peel:'#F47943',
               sky:'#84B1EC', lavender:'#8571F4', indigo:'#37189C' };
  // Custom card colours cycle
  const customPalette = [C.peel, C.sky, C.lavender, C.fusia, C.indigo];

  // Score chip — for G003 use the threshold as the lower bound
  if (_SA_ScoreCol) {
    const scoreStart = gIdx === 2
      ? (parseFloat(document.getElementById('SAMyScore')?.value) || _SA_Start)
      : _SA_Start;
    parts.push(SA_chip('Score', `${scoreStart} → ${_SA_End}`, C.purple));
  }

  // Amount filter chip (clickable toggle)
  const amtCol = g('SAAmountCol');
  if (amtCol) {
    const valStart = g('SAAmountValStart');
    const valEnd   = g('SAAmountValEnd');
    const amtParts = [];
    if (valStart) amtParts.push(`${g('SAAmountOpStart') || '>='} ${valStart}`);
    if (valEnd)   amtParts.push(`${g('SAAmountOpEnd')   || '<='} ${valEnd}`);
    const amtLabel = amtParts.length ? amtParts.join(' and ') : 'no filter';
    parts.push(SA_toggleChip(amtCol, amtLabel, C.teal,
      fState.amt, `SA_toggleAmtFilter(${gIdx})`));
  }

  // Decision Mode chip — reads live nav button state
  const dm = params.decisionMode;
  if (dm?.col) {
    const navVals = SA_getNavActiveVals('dm');
    const vals    = navVals !== null ? navVals :
      [...(dm.assigned?.successful || []), ...(dm.assigned?.unsuccessful || [])];
    if (vals.length) {
      const active = !!fState.params['dm'];
      parts.push(SA_toggleChip(dm.col, vals.join(', '), C.fusia,
        active, `SA_toggleParamFilter(${gIdx},'dm')`));
    }
  }

  // Custom card chips — reads live nav button state
  (params.customCards || []).forEach((card, i) => {
    if (!card.col) return;
    const key     = `custom_${i}`;
    const navVals = SA_getNavActiveVals(key);
    const vals    = navVals !== null ? navVals :
      [...(card.assigned?.a || []), ...(card.assigned?.b || [])];
    if (!vals.length) return;
    const active = !!fState.params[key];
    parts.push(SA_toggleChip(card.col, vals.join(', '), customPalette[i % customPalette.length],
      active, `SA_toggleParamFilter(${gIdx},'${key}')`));
  });

  return parts;
}

// Rebuild chips across all graphs without re-querying DuckDB
function SA_RefreshChips() {
  SAG001_renderSummary();
  SAG002_renderSummary();
  SAG003_renderSummary();
}

function SAG001_renderSummary() {
  const el = document.getElementById('SAG001_Summary');
  if (!el) return;
  const parts = SA_buildFilterChips(0);
  el.innerHTML = parts.join('') || '<span style="color:var(--color-text-dim);font-style:italic;">No active filters</span>';
}

function SAG002_renderSummary() {
  const el = document.getElementById('SAG002_Summary');
  if (!el) return;
  const g     = id => document.getElementById(id)?.value || '';
  const parts = SA_buildFilterChips(1);

  [0, 1, 2].forEach(i => {
    const col = SA_getCSValue(`SAG002_FilterColCS${i}`);
    const op  = SA_getCSValue(`SAG002_FilterOpCS${i}`) || '>';
    const val = g(`SAG002_FilterVal${i}`);
    if (col && val !== '') parts.push(SA_chip(col, `${op} ${val}`, '#84B1EC'));
  });

  el.innerHTML = parts.join('') || '<span style="color:var(--color-text-dim);font-style:italic;">No active filters</span>';
}

function SAG003_renderSummary() {
  const el = document.getElementById('SAG003_Summary');
  if (!el) return;
  const parts = SA_buildFilterChips(2);
  el.innerHTML = parts.join('') || '<span style="color:var(--color-text-dim);font-style:italic;">No active filters</span>';
}

// ── View Strategies ───────────────────────────────────────────────────────────
function SA_BuildStrategyJSON(graphIdx) {
  const g      = id => document.getElementById(id)?.value || '';
  const params = window.SP_getParams ? window.SP_getParams() : {};

  // Score conditions
  let scoreConditions;
  if (graphIdx === 2) {
    const myScore = parseFloat(g('SAMyScore')) || 0;
    scoreConditions = [{ op: '>=', value: myScore }];
  } else {
    scoreConditions = [
      { op: '>=', value: _SA_Start },
      { op: '<=', value: _SA_End   },
    ];
  }

  // Amount filter
  const amtCol    = g('SAAmountCol');
  const amtStart  = g('SAAmountValStart');
  const amtEnd    = g('SAAmountValEnd');
  const fState    = [_SA_G001_Filters, _SA_G002_Filters, _SA_G003_Filters][graphIdx];
  const amtActive = fState.amt && !!amtCol;
  const amtConditions = [];
  if (amtStart) amtConditions.push({ op: g('SAAmountOpStart') || '>=', value: parseFloat(amtStart) });
  if (amtEnd)   amtConditions.push({ op: g('SAAmountOpEnd')   || '<=', value: parseFloat(amtEnd)   });

  // Bin-level post-filters (G002 only)
  const binFilters = [];
  if (graphIdx === 1) {
    [0, 1, 2].forEach(i => {
      const col = SA_getCSValue(`SAG002_FilterColCS${i}`);
      const op  = SA_getCSValue(`SAG002_FilterOpCS${i}`) || '>';
      const val = g(`SAG002_FilterVal${i}`);
      if (col && val !== '') binFilters.push({ col, op, value: parseFloat(val) });
    });
  }

  // Param filters — only include if the per-graph toggle is active
  const paramFilters = [];
  if (params.decisionMode?.col && fState.params['dm']) {
    const vals = SA_getNavActiveVals('dm') ??
      [...(params.decisionMode.assigned?.successful || []), ...(params.decisionMode.assigned?.unsuccessful || [])];
    if (vals.length) paramFilters.push({ col: params.decisionMode.col, values: vals });
  }
  (params.customCards || []).forEach((card, i) => {
    if (!card.col) return;
    if (!fState.params[`custom_${i}`]) return;
    const vals = SA_getNavActiveVals(`custom_${i}`) ??
      [...(card.assigned?.a || []), ...(card.assigned?.b || [])];
    if (vals.length) paramFilters.push({ col: card.col, values: vals });
  });

  return {
    ScoreInformation:  { col: _SA_ScoreCol, conditions: scoreConditions },
    AmountInformation: { active: amtActive, col: amtCol, conditions: amtConditions },
    BinFilters:   binFilters,
    ParamFilters: paramFilters,
    Criteria:  _SA_Criteria,
    Calculate: _SA_Calc,
  };
}

let _SA_CurrentStrategy = null;

function SA_ViewStrategies(graphIdx) {
  if (!_SA_Bins.length) { alert('Run analysis first.'); return; }
  const s = SA_BuildStrategyJSON(graphIdx);
  _SA_CurrentStrategy = s;
  const graphLabel = `Graph${String(graphIdx + 1).padStart(3, '0')}`;

  const condVal = v => Number.isInteger(v) ? v : parseFloat(v.toFixed(2));
  const lbl = t => `<div style="font-size:0.65rem;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;color:var(--dml-label);margin-bottom:2px;margin-top:10px;">${t}</div>`;
  const row = v => `<div style="font-size:0.82rem;font-weight:600;color:var(--dml-text);margin-bottom:2px;">${v}</div>`;
  const dim = t => `<div style="font-size:0.8rem;color:var(--dml-label);font-style:italic;">${t}</div>`;
  const badge = (t, bg, color) => `<span style="display:inline-block;padding:2px 8px;border-radius:4px;font-size:0.72rem;font-weight:600;background:${bg};color:${color};margin-bottom:2px;">${t}</span>`;
  const condRows = arr => arr.length
    ? arr.map(c => row(`${c.op} ${condVal(c.value)}`)).join('')
    : dim('—');

  // Score column
  const scoreCell =
    lbl('Metric') + row(s.ScoreInformation.col || '—') +
    lbl('Conditions') + condRows(s.ScoreInformation.conditions);

  // Amount column
  const amtCell = s.AmountInformation.active
    ? lbl('Metric') + row(s.AmountInformation.col || '—') +
      lbl('Conditions') + condRows(s.AmountInformation.conditions)
    : dim('None');

  // Additional Information column
  const filterEntries = [
    ...s.ParamFilters.map(f => ({ col: f.col, cond: f.values.join(', ') })),
    ...s.BinFilters.map(f => ({ col: f.col, cond: `${f.op} ${f.value}` })),
  ];
  const filtersCell = filterEntries.length
    ? filterEntries.map(f => lbl('Metric') + row(f.col) + lbl('Conditions') + row(f.cond)).join('')
    : dim('None');

  const thStyle = `padding:10px 14px;font-size:0.62rem;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;border-bottom:1px solid var(--color-card-border);text-align:left;white-space:nowrap;`;
  const tdStyle = `padding:10px 14px;vertical-align:top;border-right:1px solid var(--color-card-border);`;

  const cardHtml = `
    <table style="width:100%;border-collapse:collapse;table-layout:fixed;">
      <thead>
        <tr style="background:var(--color-page-bg);">
          <th style="${thStyle}color:#f59e0b;">Score Information</th>
          <th style="${thStyle}color:#3b82f6;">Amount Information</th>
          <th style="${thStyle}color:#6366f1;border-right:none;">Additional Information</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td style="${tdStyle}">${scoreCell}</td>
          <td style="${tdStyle}">${amtCell}</td>
          <td style="${tdStyle.replace('border-right:1px solid var(--color-card-border);','')}">${filtersCell}</td>
        </tr>
      </tbody>
    </table>`;

  document.getElementById('SA_StrategyModalTitle').textContent = _SA_TabTitles[graphIdx];
  document.getElementById('SA_StrategyModalSub').textContent = '';
  document.getElementById('SA_StrategyModalBody').innerHTML = cardHtml;
  document.getElementById('SA_StrategyModal').dataset.graphIdx = graphIdx;
  Popup_open('SA_StrategyModal');
}

function SA_CopyStrategy() {
  if (!_SA_CurrentStrategy) return;
  const output = APP_ApplyTemplate('Score Analysis', _SA_CurrentStrategy);
  APP_CopyText(JSON.stringify(output, null, 2));
}

function SA_LikeGraph(graphIdx) {
  if (!_SA_Bins.length) { alert('Run analysis first.'); return; }
  const s = SA_BuildStrategyJSON(graphIdx);
  const additionalColumns = [
    ...s.ParamFilters.map(f => ({ Column: f.col, Values: f.values })),
    ...s.BinFilters.map(f  => ({ Column: f.col, Operator: f.op, Value: f.value })),
  ];
  APP_LikeIt('Score Analysis', {
    amount: s.AmountInformation,
    score:  s.ScoreInformation,
    additionalColumns,
  });
}

function SA_CopyGraph(graphIdx) {
  if (!_SA_Bins.length) { alert('Run analysis first.'); return; }
  const s = SA_BuildStrategyJSON(graphIdx);

  const additionalColumns = [
    ...s.ParamFilters.map(f => ({ Column: f.col, Values: f.values })),
    ...s.BinFilters.map(f  => ({ Column: f.col, Operator: f.op, Value: f.value })),
  ];

  const output = APP_FormatStrategyPayload('Score Analysis', {
    amount: s.AmountInformation,
    score:  s.ScoreInformation,
    additionalColumns,
  });
  APP_CopyText(JSON.stringify(output, null, 2));
}

function SA_LikeStrategy() {
  if (!_SA_CurrentStrategy) return;
  const s = _SA_CurrentStrategy;
  const additionalColumns = [
    ...s.ParamFilters.map(f => ({ Column: f.col, Values: f.values })),
    ...s.BinFilters.map(f  => ({ Column: f.col, Operator: f.op, Value: f.value })),
  ];
  APP_LikeIt('Score Analysis', {
    amount: s.AmountInformation,
    score:  s.ScoreInformation,
    additionalColumns,
  });
  Popup_close('SA_StrategyModal');
}
