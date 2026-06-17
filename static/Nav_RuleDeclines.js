// ── Nav_RuleDeclines — RD mini-nav controls ───────────────────────────────────

(function () {
  function _inject() {
    const nav = document.getElementById('RD_MiniNav');
    if (!nav || document.getElementById('RD_ScrollerDown')) return;
    nav.insertAdjacentHTML('afterbegin', `
      <div id="RD_ScrollerUp" onclick="RD_ScrollUp()" title="Scroll up">
        <svg viewBox="0 0 16 8" width="14" height="7" fill="none">
          <polyline points="1 7 8 1 15 7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <div class="MN_ScrollBar"></div>
      </div>`);
    nav.insertAdjacentHTML('beforeend', `
      <div id="RD_ScrollerDown" onclick="RD_ScrollDown()" title="Scroll down">
        <div class="MN_ScrollBar"></div>
        <svg viewBox="0 0 16 8" width="14" height="7" fill="none">
          <polyline points="1 1 8 7 15 1" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>`);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', _inject);
  else _inject();
})();

function RD_ScrollDown() { document.getElementById('RD_MiniNav')?.scrollBy({ top:  150, behavior: 'smooth' }); }
function RD_ScrollUp()   { document.getElementById('RD_MiniNav')?.scrollBy({ top: -150, behavior: 'smooth' }); }

function RD_MiniNav_RenderParams() { SP_RenderParamsTo('RD_MiniNav_ParamsDisplay', 'rd'); }

// ── Section toggles ───────────────────────────────────────────────────────────

let _rdMiniParamsOpen = false;
function RD_MiniNav_ToggleParams() {
  _rdMiniParamsOpen = !_rdMiniParamsOpen;
  const body    = document.getElementById('RD_MiniNav_ParamsBody');
  const chevron = document.getElementById('RD_MiniNav_ParamsChevron');
  if (body)    body.style.display      = _rdMiniParamsOpen ? 'block' : 'none';
  if (chevron) chevron.style.transform = _rdMiniParamsOpen ? 'rotate(90deg)' : 'rotate(0deg)';
}

let _rdMiniColsOpen = true;
function RD_MiniNav_ToggleCols() {
  _rdMiniColsOpen = !_rdMiniColsOpen;
  const body    = document.getElementById('RD_MiniNav_ColBody');
  const chevron = document.getElementById('RD_MiniNav_ColChevron');
  if (body)    body.style.display      = _rdMiniColsOpen ? 'block' : 'none';
  if (chevron) chevron.style.transform = _rdMiniColsOpen ? 'rotate(90deg)' : 'rotate(0deg)';
}

let _rdMiniScoreOpen = true;
function RD_MiniNav_ToggleScore() {
  _rdMiniScoreOpen = !_rdMiniScoreOpen;
  const body    = document.getElementById('RD_MiniNav_ScoreBody');
  const chevron = document.getElementById('RD_MiniNav_ScoreChevron');
  if (body)    body.style.display      = _rdMiniScoreOpen ? 'block' : 'none';
  if (chevron) chevron.style.transform = _rdMiniScoreOpen ? 'rotate(90deg)' : 'rotate(0deg)';
  if (_rdMiniScoreOpen) _navScrollOnExpand(document.getElementById('RD_MiniNav_ScoreSection'), document.getElementById('RD_MiniNav'));
}

let _rdMiniAmtOpen = true;
function RD_MiniNav_ToggleAmt() {
  _rdMiniAmtOpen = !_rdMiniAmtOpen;
  const body    = document.getElementById('RD_MiniNav_AmtBody');
  const chevron = document.getElementById('RD_MiniNav_AmtChevron');
  if (body)    body.style.display      = _rdMiniAmtOpen ? 'block' : 'none';
  if (chevron) chevron.style.transform = _rdMiniAmtOpen ? 'rotate(90deg)' : 'rotate(0deg)';
}

let _rdMiniAllExpanded = true;
function RD_MiniNav_ToggleAll() {
  _rdMiniAllExpanded = !_rdMiniAllExpanded;
  _rdMiniParamsOpen  = _rdMiniAllExpanded;
  _rdMiniColsOpen    = _rdMiniAllExpanded;
  _rdMiniScoreOpen   = _rdMiniAllExpanded;
  _rdMiniAmtOpen     = _rdMiniAllExpanded;
  [
    { body: 'RD_MiniNav_ParamsBody', chevron: 'RD_MiniNav_ParamsChevron' },
    { body: 'RD_MiniNav_ColBody',    chevron: 'RD_MiniNav_ColChevron'    },
    { body: 'RD_MiniNav_ScoreBody',  chevron: 'RD_MiniNav_ScoreChevron'  },
    { body: 'RD_MiniNav_AmtBody',    chevron: 'RD_MiniNav_AmtChevron'    },
  ].forEach(s => {
    const b = document.getElementById(s.body);
    const c = document.getElementById(s.chevron);
    if (b) b.style.display      = _rdMiniAllExpanded ? 'block' : 'none';
    if (c) c.style.transform    = _rdMiniAllExpanded ? 'rotate(90deg)' : 'rotate(0deg)';
  });
  document.querySelectorAll('[id^="NAV_RD_ExtraBody_"]').forEach(b => { b.style.display = _rdMiniAllExpanded ? 'block' : 'none'; });
  document.querySelectorAll('[id^="NAV_RD_ExtraChevron_"]').forEach(c => { c.style.transform = _rdMiniAllExpanded ? 'rotate(90deg)' : 'rotate(0deg)'; });
  const btn = document.getElementById('RD_MiniNav_ExpandBtn');
  if (btn) btn.title = _rdMiniAllExpanded ? 'Collapse all' : 'Expand all';
}

// ── Available Columns — shows only the Rule Signal column from params ─────────
function RD_MiniNav_PopulateCols() {
  const list = document.getElementById('RD_MiniNav_ColumnsList');
  if (!list) return;
  const sp       = window.SP_getParams?.() || {};
  const ruleCol  = sp.ruleSignal || '';
  list.innerHTML = ruleCol
    ? `<button class="MN_chip MN_chip--col MN_chip--a active" title="${ruleCol}" style="grid-column:1/-1;">${ruleCol}</button>`
    : '<span style="font-size:0.62rem;color:var(--color-text-dim);padding:2px 0;">— No Rule Signal column set —</span>';
}

// ── Score Config ──────────────────────────────────────────────────────────────
let _NAV_RD_AutoRunTimer = null;
let _NAV_RD_MinMaxCache  = {};

async function NAV_RD_PopulateColumns() {
  const conn = window.LD_getConn?.();
  if (!conn) return;
  const src    = window.LD_getSource?.() || 'cm_data';
  const params = window.SP_getParams?.() || {};
  let cols = [];
  try {
    const res = await conn.query(`DESCRIBE "${src}"`);
    cols = res.toArray().map(r => ({ name: r.column_name, type: (r.column_type || '').toUpperCase() }));
  } catch { return; }

  const numTypes = ['INTEGER','BIGINT','DOUBLE','FLOAT','DECIMAL','REAL','HUGEINT','UBIGINT','UINTEGER','SMALLINT','TINYINT'];
  const numCols  = cols.filter(c => numTypes.some(t => c.type.startsWith(t))).map(c => c.name);

  let uniqueCounts = {};
  try {
    const countExprs = numCols.map(c => `COUNT(DISTINCT "${c}") AS "${c}"`).join(', ');
    if (countExprs) {
      const row = (await conn.query(`SELECT ${countExprs} FROM "${src}"`)).toArray()[0];
      numCols.forEach(c => { uniqueCounts[c] = Number(row[c] ?? 0); });
    }
  } catch { numCols.forEach(c => { uniqueCounts[c] = 999; }); }

  const amtMetricCol = params.numeric || '';
  const scoreCols = numCols.filter(c => c !== amtMetricCol && (uniqueCounts[c] ?? 0) >= 10);

  NAV_RD_FillScoreCS(scoreCols);

  const amtCS = document.getElementById('RDAmountColCS');
  if (amtCS) {
    const amtInData = amtMetricCol && numCols.includes(amtMetricCol);
    amtCS.querySelector('.cs-options').innerHTML = amtInData
      ? `<div class="cs-option cs-selected" data-value="${amtMetricCol}" onclick="RD_selectCS(this,'${amtMetricCol}','NAV_RD_OnAmountColChange')">${amtMetricCol}</div>`
      : `<div class="cs-option" data-value="" style="color:var(--dml-label)">— No amount column set —</div>`;
    if (amtInData && !RD_getCSValue('RDAmountColCS')) {
      const opt = amtCS.querySelector(`.cs-option[data-value="${CSS.escape(amtMetricCol)}"]`);
      if (opt) RD_selectCS(opt, amtMetricCol, null);
    }
  }

  if (!RD_getCSValue('RDScoreColCS')) {
    const guess = scoreCols.find(c => /score/i.test(c));
    if (guess) NAV_RD_SetScoreCS(guess);
  }

  NAV_RD_OnScoreColChange();
  RD_MiniNav_PopulateCols();
}

function NAV_RD_FillScoreCS(options) {
  const cs = document.getElementById('RDScoreColCS');
  if (!cs) return;
  const currentVal = RD_getCSValue('RDScoreColCS');
  cs.querySelector('.cs-options').innerHTML = options.length
    ? options.map(c => `<div class="cs-option${c === currentVal ? ' cs-selected' : ''}" data-value="${c}" onclick="RD_selectCS(this,'${c}','NAV_RD_OnScoreColChange')">${c}</div>`).join('')
    : `<div class="cs-option" data-value="" style="color:var(--dml-label)">— No score columns —</div>`;
}

function NAV_RD_SetScoreCS(col) {
  const cs = document.getElementById('RDScoreColCS');
  if (!cs) return;
  const opt = cs.querySelector(`.cs-option[data-value="${CSS.escape(col)}"]`);
  if (opt) RD_selectCS(opt, col, null);
}

async function NAV_RD_OnScoreColChange() {
  const col = RD_getCSValue('RDScoreColCS');
  const mmEl = document.getElementById('RDMinMax');
  if (!col || !mmEl) return;
  if (_NAV_RD_MinMaxCache[col]) {
    const { mn, mx } = _NAV_RD_MinMaxCache[col];
    document.getElementById('RDMin').textContent = mn;
    document.getElementById('RDMax').textContent = mx;
    mmEl.style.display = 'block';
    const endEl = document.getElementById('RDEnd');
    if (endEl && !endEl.value) endEl.value = mx;
    return;
  }
  const conn = window.LD_getConn?.();
  const src  = window.LD_getSource?.();
  if (!conn || !src) return;
  try {
    const row = (await conn.query(`SELECT MIN("${col}") AS mn, MAX("${col}") AS mx FROM "${src}"`)).toArray()[0];
    const mn  = Number(row.mn ?? 0);
    const mx  = Number(row.mx ?? 100);
    _NAV_RD_MinMaxCache[col] = { mn, mx };
    document.getElementById('RDMin').textContent = mn;
    document.getElementById('RDMax').textContent = mx;
    mmEl.style.display = 'block';
    const endEl = document.getElementById('RDEnd');
    if (endEl && !endEl.value) endEl.value = mx;
  } catch { return; }
}

function NAV_RD_OnAmountColChange() { NAV_RD_AmountChanged(); }

function NAV_RD_AutoRun() {
  clearTimeout(_NAV_RD_AutoRunTimer);
  _NAV_RD_AutoRunTimer = setTimeout(() => {
    if (typeof RD_Run === 'function' && RD_getCSValue('RDScoreColCS')) RD_Run();
  }, 600);
}

let _NAV_RD_AmtTimer = null;
function NAV_RD_AmountChanged() {
  clearTimeout(_NAV_RD_AmtTimer);
  _NAV_RD_AmtTimer = setTimeout(() => {
    if (typeof RD_RunAmountAnalysis === 'function') RD_RunAmountAnalysis();
  }, 600);
}
