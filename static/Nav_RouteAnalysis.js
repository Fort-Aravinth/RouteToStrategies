// ── Route Analysis Mini-Nav ───────────────────────────────────────────────────

// ── Nav scroll indicators ─────────────────────────────────────────────────────
(function () {
  function _inject() {
    const nav = document.getElementById('ANRA_MiniNav');
    if (!nav || document.getElementById('ANRA_ScrollerDown')) return;
    nav.insertAdjacentHTML('afterbegin', `
      <div id="ANRA_ScrollerUp" onclick="ANRA_ScrollUp()" title="Scroll up">
        <svg viewBox="0 0 16 8" width="14" height="7" fill="none">
          <polyline points="1 7 8 1 15 7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <div class="MN_ScrollBar"></div>
      </div>`);
    nav.insertAdjacentHTML('beforeend', `
      <div id="ANRA_ScrollerDown" onclick="ANRA_ScrollDown()" title="Scroll down">
        <div class="MN_ScrollBar"></div>
        <svg viewBox="0 0 16 8" width="14" height="7" fill="none">
          <polyline points="1 1 8 7 15 1" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>`);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', _inject);
  else _inject();
})();

function ANRA_ScrollDown() {
  const nav = document.getElementById('ANRA_MiniNav');
  if (nav) nav.scrollBy({ top: 150, behavior: 'smooth' });
}
function ANRA_ScrollUp() {
  const nav = document.getElementById('ANRA_MiniNav');
  if (nav) nav.scrollBy({ top: -150, behavior: 'smooth' });
}

function ANRA_MiniNav_RenderParams() { SP_RenderParamsTo('ANRA_MiniNav_ParamsDisplay', 'ra'); }

let _anraMiniParamsOpen = false;
function ANRA_MiniNav_ToggleParams() {
  _anraMiniParamsOpen = !_anraMiniParamsOpen;
  const body    = document.getElementById('ANRA_MiniNav_ParamsBody');
  const chevron = document.getElementById('ANRA_MiniNav_ParamsChevron');
  if (body)    body.style.display      = _anraMiniParamsOpen ? 'block' : 'none';
  if (chevron) chevron.style.transform = _anraMiniParamsOpen ? 'rotate(90deg)' : 'rotate(0deg)';
}

// ── Available Columns ─────────────────────────────────────────────────────────
let _anraMiniColsOpen = true;
function ANRA_MiniNav_ToggleCols() {
  _anraMiniColsOpen = !_anraMiniColsOpen;
  const body    = document.getElementById('ANRA_MiniNav_ColBody');
  const chevron = document.getElementById('ANRA_MiniNav_ColChevron');
  if (body)    body.style.display      = _anraMiniColsOpen ? 'block' : 'none';
  if (chevron) chevron.style.transform = _anraMiniColsOpen ? 'rotate(90deg)' : 'rotate(0deg)';
}

async function ANRA_MiniNav_PopulateCols() {
  const list = document.getElementById('ANRA_MiniNav_ColumnsList');
  if (!list) return;
  const conn = window.LD_getConn?.();
  const src  = window.LD_getSource?.();
  if (!conn || !src) {
    list.innerHTML = '<span style="font-size:0.62rem;color:var(--color-text-dim);padding:2px 0;">— Load data first —</span>';
    return;
  }
  try {
    const res  = await conn.query(`DESCRIBE "${src}"`);
    const cols = res.toArray()
      .filter(r => !_ANRA_NUMERIC_TYPES.test((r.column_type || '').toLowerCase()))
      .map(r => r.column_name);
    list.innerHTML = cols.map(c => `
      <button class="MN_chip MN_chip--col MN_chip--a" onclick="this.classList.toggle('active');if(typeof ANRA_RefreshRouteBtns==='function')ANRA_RefreshRouteBtns();" title="${c}">${c}</button>
    `).join('');
  } catch { return; }
}
function ANRA_MiniNav_SelectAllCols()   { MN_SelectAllCols('ANRA_MiniNav_ColumnsList'); }
function ANRA_MiniNav_ClearCols()       { MN_ClearCols('ANRA_MiniNav_ColumnsList'); }
function ANRA_MiniNav_GetSelectedCols() { return MN_GetSelectedCols('ANRA_MiniNav_ColumnsList'); }

// ── Amount Filters ────────────────────────────────────────────────────────────
let ANRA_AmountList = [];
let _ANRA_ActiveTemplate = null;

// ── Seed built-in templates on first load ─────────────────────────────────────
(function () {
  const KEY = 'ANRA_AmountTemplates';
  const existing = (() => { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; } })();
  const defaults = {
    'Template 1': [
      { op: 'equal',        val: 0    },
      { op: 'greater_than', val: 0    },
      { op: 'greater_than', val: 1    },
      { op: 'greater_than', val: 10   },
      { op: 'greater_than', val: 30   },
      { op: 'greater_than', val: 100  },
      { op: 'greater_than', val: 250  },
      { op: 'greater_than', val: 1000 },
    ],
    'Template 2': [
      { op: 'equal',        val: 0    },
      { op: 'greater_than', val: 1000 },
      { op: 'greater_than', val: 250  },
      { op: 'greater_than', val: 100  },
      { op: 'greater_than', val: 30   },
      { op: 'greater_than', val: 10   },
      { op: 'greater_than', val: 1    },
      { op: 'greater_than', val: 0    },
    ],
  };
  let changed = false;
  for (const [name, filters] of Object.entries(defaults)) {
    existing[name] = filters; changed = true;
  }
  if (changed) localStorage.setItem(KEY, JSON.stringify(existing));
})();

// Load Template 1 as default (data only — DOM refreshed when section opens)
(function () {
  const saved = _ANRA_GetTemplates();
  if (saved['Template 1']) {
    ANRA_AmountList = JSON.parse(JSON.stringify(saved['Template 1']));
    _ANRA_ActiveTemplate = 'Template 1';
  }
})();

const _ANRA_OP_LABELS = { equal: '=', greater_than: '>', less_than: '<' };

let _anraMiniAmtOpen = false;
function ANRA_MiniNav_ToggleAmt() {
  _anraMiniAmtOpen = !_anraMiniAmtOpen;
  const body    = document.getElementById('ANRA_MiniNav_AmtBody');
  const chevron = document.getElementById('ANRA_MiniNav_AmtChevron');
  if (body)    body.style.display      = _anraMiniAmtOpen ? 'block' : 'none';
  if (chevron) chevron.style.transform = _anraMiniAmtOpen ? 'rotate(90deg)' : 'rotate(0deg)';
  if (_anraMiniAmtOpen) {
    ANRA_LoadSavedTemplatesList();
    ANRA_RefreshAmountFilters();
    _navScrollOnExpand(document.getElementById('ANRA_MiniNav_AmtSection'), document.getElementById('ANRA_MiniNav'));
  }
}

// Mini-nav proxies — read inputs from the nav then call core
function ANRA_MiniNav_AddFilter() {
  const op  = document.getElementById('ANRA_MiniNav_AmountOp')?.value;
  const val = parseFloat(document.getElementById('ANRA_MiniNav_AmountVal')?.value);
  if (!op || isNaN(val)) return;
  ANRA_AmountList.push({ op, val });
  _ANRA_ActiveTemplate = null;
  ANRA_RefreshAmountFilters();
  ANRA_LoadSavedTemplatesList();
  document.getElementById('ANRA_MiniNav_AmountVal').value = '';
}

function ANRA_MiniNav_SaveTemplate() {
  const input = document.getElementById('ANRA_MiniNav_TemplateNameInput');
  const name  = input?.value.trim();
  if (!name || !ANRA_AmountList.length) return;
  const saved = _ANRA_GetTemplates();
  saved[name] = JSON.parse(JSON.stringify(ANRA_AmountList));
  localStorage.setItem('ANRA_AmountTemplates', JSON.stringify(saved));
  if (input) input.value = '';
  ANRA_LoadSavedTemplatesList();
}

// Core filter operations
function ANRA_RemoveAmountFilter(index) {
  ANRA_AmountList.splice(index, 1);
  ANRA_RefreshAmountFilters();
}

function ANRA_ResetAmountFilters() {
  _ANRA_ActiveTemplate = null;
  ANRA_AmountList = [
    { op: 'equal',        val: 0.00 },
    { op: 'greater_than', val: 0.00 },
    { op: 'greater_than', val: 1.00 },
    { op: 'greater_than', val: 10.00 },
    { op: 'greater_than', val: 30.00 },
    { op: 'greater_than', val: 100.00 },
    { op: 'greater_than', val: 250.00 },
    { op: 'greater_than', val: 1000.00 },
  ];
  ANRA_RefreshAmountFilters();
}

function ANRA_RefreshAmountFilters() {
  const list = document.getElementById('ANRA_MiniNav_AmountFiltersList');
  if (!list) return;
  if (!ANRA_AmountList.length) {
    list.innerHTML = '<span style="font-size:0.65rem;color:var(--color-text-dim);">No filters added.</span>';
    return;
  }
  list.innerHTML = ANRA_AmountList.map((f, i) => `
    <div style="display:flex;align-items:center;gap:6px;padding:5px 8px;background:var(--color-page-bg);border:0.5px solid var(--dml-border);border-radius:5px;font-size:0.65rem;">
      <span style="font-weight:700;min-width:14px;color:var(--MN_brand);">${_ANRA_OP_LABELS[f.op] || f.op}</span>
      <span style="color:var(--color-header-title);">${f.val.toFixed(2)}</span>
      <button onclick="ANRA_RemoveAmountFilter(${i})" style="margin-left:auto;background:none;border:none;cursor:pointer;font-size:0.65rem;color:#ef4444;padding:0;line-height:1;">✕</button>
    </div>`).join('');
}

// Template storage
function _ANRA_GetTemplates() {
  try { return JSON.parse(localStorage.getItem('ANRA_AmountTemplates') || '{}'); } catch { return {}; }
}

function ANRA_LoadSavedTemplatesList() {
  const el   = document.getElementById('ANRA_MiniNav_AmtTemplates');
  if (!el) return;
  const saved = _ANRA_GetTemplates();
  const names = Object.keys(saved);
  if (!names.length) { el.innerHTML = ''; return; }
  const PROTECTED = ['Template 1', 'Template 2'];
  el.innerHTML = names.map(name => `
    <div style="position:relative;display:inline-flex;align-items:center;">
      <button class="MN_btn${_ANRA_ActiveTemplate === name ? ' active' : ''}" style="width:100%;${PROTECTED.includes(name) ? '' : 'padding-right:20px;'}overflow:hidden;text-overflow:ellipsis;" onclick="ANRA_LoadSavedAmountTemplate('${name}')">${name}</button>
      ${PROTECTED.includes(name) ? '' : `<button onclick="ANRA_DeleteSavedAmountTemplate('${name}')" title="Delete"
        style="position:absolute;right:6px;background:none;border:none;cursor:pointer;font-size:0.55rem;color:#ef4444;padding:0;line-height:1;">✕</button>`}
    </div>`).join('');
}

function ANRA_LoadSavedAmountTemplate(name) {
  const saved = _ANRA_GetTemplates();
  if (!saved[name]) return;
  ANRA_AmountList = JSON.parse(JSON.stringify(saved[name]));
  _ANRA_ActiveTemplate = name;
  ANRA_RefreshAmountFilters();
  ANRA_LoadSavedTemplatesList();
}

function ANRA_DeleteSavedAmountTemplate(name) {
  const saved = _ANRA_GetTemplates();
  delete saved[name];
  localStorage.setItem('ANRA_AmountTemplates', JSON.stringify(saved));
  ANRA_LoadSavedTemplatesList();
}

// ── Score Column ──────────────────────────────────────────────────────────────
let ANRA_SelectedScoreColumn = null;

const _ANRA_NUMERIC_TYPES = /int|float|double|decimal|numeric|real|bigint|smallint|tinyint|hugeint|ubigint|uinteger|usmallint|utinyint/;

async function ANRA_MiniNav_PopulateScoreCols() {
  const list = document.getElementById('ANRA_MiniNav_ScoreColumnsList');
  if (!list) return;
  const conn = window.LD_getConn?.();
  const src  = window.LD_getSource?.();
  if (!conn || !src) {
    list.innerHTML = '<span style="font-size:0.65rem;color:var(--color-text-dim);">— Load data first —</span>';
    return;
  }
  try {
    const res  = await conn.query(`DESCRIBE "${src}"`);
    const cols = res.toArray()
      .filter(r => _ANRA_NUMERIC_TYPES.test((r.column_type || '').toLowerCase()))
      .map(r => r.column_name);
    list.innerHTML = cols.map(c => {
      const sel = ANRA_SelectedScoreColumn === c;
      return `<button onclick="ANRA_ToggleScoreColumn('${c}')" class="MN_chip MN_chip--col MN_chip--a${sel ? ' active' : ''}">${c}</button>`;
    }).join('');
  } catch { return; }
}

function ANRA_ToggleScoreColumn(col) {
  ANRA_SelectedScoreColumn = ANRA_SelectedScoreColumn === col ? null : col;
  document.querySelectorAll('#ANRA_MiniNav_ScoreColumnsList .MN_chip').forEach(btn => {
    const active = btn.textContent === col && ANRA_SelectedScoreColumn === col;
    btn.classList.toggle('active', active);
  });
  if (typeof ANRA_RefreshRouteBtns === 'function') ANRA_RefreshRouteBtns();
}

let _anraMiniScoreOpen = false;
function ANRA_MiniNav_ToggleScore() {
  _anraMiniScoreOpen = !_anraMiniScoreOpen;
  const body    = document.getElementById('ANRA_MiniNav_ScoreBody');
  const chevron = document.getElementById('ANRA_MiniNav_ScoreChevron');
  if (body)    body.style.display      = _anraMiniScoreOpen ? 'block' : 'none';
  if (chevron) chevron.style.transform = _anraMiniScoreOpen ? 'rotate(90deg)' : 'rotate(0deg)';
  if (_anraMiniScoreOpen) {
    ANRA_MiniNav_PopulateScoreCols();
    _navScrollOnExpand(document.getElementById('ANRA_MiniNav_ScoreSection'), document.getElementById('ANRA_MiniNav'));
  }
}

function ANRA_MiniNav_OpenDefaults() {
  const openSilent = (bodyId, chevronId) => {
    const body    = document.getElementById(bodyId);
    const chevron = document.getElementById(chevronId);
    if (body)    body.style.display      = 'block';
    if (chevron) chevron.style.transform = 'rotate(90deg)';
  };
  if (!_anraMiniAmtOpen) {
    _anraMiniAmtOpen = true;
    openSilent('ANRA_MiniNav_AmtBody', 'ANRA_MiniNav_AmtChevron');
    ANRA_LoadSavedTemplatesList();
    ANRA_RefreshAmountFilters();
  }
  if (!_anraMiniScoreOpen) {
    _anraMiniScoreOpen = true;
    openSilent('ANRA_MiniNav_ScoreBody', 'ANRA_MiniNav_ScoreChevron');
    ANRA_MiniNav_PopulateScoreCols();
  }
}

// ── Toggle All ────────────────────────────────────────────────────────────────
let _anraMiniAllExpanded = true;
function ANRA_MiniNav_ToggleAll() {
  _anraMiniAllExpanded = !_anraMiniAllExpanded;
  _anraMiniParamsOpen = _anraMiniAllExpanded;
  _anraMiniColsOpen   = _anraMiniAllExpanded;
  _anraMiniAmtOpen    = _anraMiniAllExpanded;
  _anraMiniScoreOpen  = _anraMiniAllExpanded;
  [
    ['ANRA_MiniNav_ParamsBody', 'ANRA_MiniNav_ParamsChevron'],
    ['ANRA_MiniNav_ColBody',    'ANRA_MiniNav_ColChevron'],
    ['ANRA_MiniNav_AmtBody',    'ANRA_MiniNav_AmtChevron'],
    ['ANRA_MiniNav_ScoreBody',  'ANRA_MiniNav_ScoreChevron'],
  ].forEach(([b, c]) => {
    const body    = document.getElementById(b);
    const chevron = document.getElementById(c);
    if (body)    body.style.display      = _anraMiniAllExpanded ? 'block' : 'none';
    if (chevron) chevron.style.transform = _anraMiniAllExpanded ? 'rotate(90deg)' : 'rotate(0deg)';
  });
  if (_anraMiniAllExpanded) {
    ANRA_LoadSavedTemplatesList();
    ANRA_RefreshAmountFilters();
    ANRA_MiniNav_PopulateScoreCols();
  }
  const btn = document.getElementById('ANRA_MiniNav_ExpandBtn');
  if (btn) btn.title = _anraMiniAllExpanded ? 'Collapse all' : 'Expand all';
}
