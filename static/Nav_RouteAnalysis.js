// ── Route Analysis Mini-Nav ───────────────────────────────────────────────────

// ── Nav scroll indicators ─────────────────────────────────────────────────────
(function () {
  function _inject() {
    const nav = document.getElementById('RA_MiniNav');
    if (!nav || document.getElementById('RA_ScrollerDown')) return;
    nav.insertAdjacentHTML('afterbegin', `
      <div id="RA_ScrollerUp" onclick="RA_ScrollUp()" title="Scroll up">
        <svg viewBox="0 0 16 8" width="14" height="7" fill="none">
          <polyline points="1 7 8 1 15 7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <div class="MN_ScrollBar"></div>
      </div>`);
    nav.insertAdjacentHTML('beforeend', `
      <div id="RA_ScrollerDown" onclick="RA_ScrollDown()" title="Scroll down">
        <div class="MN_ScrollBar"></div>
        <svg viewBox="0 0 16 8" width="14" height="7" fill="none">
          <polyline points="1 1 8 7 15 1" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>`);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', _inject);
  else _inject();
})();

function RA_ScrollDown() {
  const nav = document.getElementById('RA_MiniNav');
  if (nav) nav.scrollBy({ top: 150, behavior: 'smooth' });
}
function RA_ScrollUp() {
  const nav = document.getElementById('RA_MiniNav');
  if (nav) nav.scrollBy({ top: -150, behavior: 'smooth' });
}

function RA_MiniNav_RenderParams() { SP_RenderParamsTo('RA_MiniNav_ParamsDisplay', 'ra'); }

let _anraMiniParamsOpen = false;
function RA_MiniNav_ToggleParams() {
  _anraMiniParamsOpen = !_anraMiniParamsOpen;
  const body    = document.getElementById('RA_MiniNav_ParamsBody');
  const chevron = document.getElementById('RA_MiniNav_ParamsChevron');
  if (body)    body.style.display      = _anraMiniParamsOpen ? 'block' : 'none';
  if (chevron) chevron.style.transform = _anraMiniParamsOpen ? 'rotate(90deg)' : 'rotate(0deg)';
}

// ── Available Columns ─────────────────────────────────────────────────────────
let _anraMiniColsOpen = true;
function RA_MiniNav_ToggleCols() {
  _anraMiniColsOpen = !_anraMiniColsOpen;
  const body    = document.getElementById('RA_MiniNav_ColBody');
  const chevron = document.getElementById('RA_MiniNav_ColChevron');
  if (body)    body.style.display      = _anraMiniColsOpen ? 'block' : 'none';
  if (chevron) chevron.style.transform = _anraMiniColsOpen ? 'rotate(90deg)' : 'rotate(0deg)';
}

const _RA_DATETIME_TYPES = /date|time|timestamp|interval/;

async function RA_MiniNav_PopulateCols() {
  const list = document.getElementById('RA_MiniNav_ColumnsList');
  if (!list) return;
  const conn = window.LD_getConn?.();
  const src  = window.LD_getSource?.();
  if (!conn || !src) {
    list.innerHTML = '<span style="font-size:0.62rem;color:var(--color-text-dim);padding:2px 0;">— Load data first —</span>';
    return;
  }
  try {
    const res  = await conn.query(`DESCRIBE "${src}"`);
    const params = window.SP_getParams?.() || {};
    const excludeSet = new Set([params.col1, params.numeric, params.object, params.ruleSignal].filter(Boolean));

    const candidates = res.toArray()
      .filter(r => {
        const t = (r.column_type || '').toLowerCase();
        return !_RA_NUMERIC_TYPES.test(t) && !_RA_DATETIME_TYPES.test(t) && !excludeSet.has(r.column_name);
      })
      .map(r => r.column_name);

    // Filter out columns with fewer than 10 unique values in parallel
    const counts = await Promise.all(candidates.map(c =>
      conn.query(`SELECT COUNT(DISTINCT "${c}") AS n FROM "${src}"`)
          .then(r => Number(r.toArray()[0].n))
    ));
    const cols = candidates.filter((_, i) => counts[i] >= 10);

    list.innerHTML = cols.length
      ? cols.map(c => `
          <button class="MN_chip MN_chip--col MN_chip--a" onclick="this.classList.toggle('active');if(typeof RA_RefreshRouteBtns==='function')RA_RefreshRouteBtns();if(typeof RA_ClearResults==='function')RA_ClearResults();" title="${c}">${c}</button>
        `).join('')
      : '<span style="font-size:0.62rem;color:var(--color-text-dim);padding:2px 0;">— No suitable columns —</span>';
  } catch { return; }
}
function RA_MiniNav_SelectAllCols()   { MN_SelectAllCols('RA_MiniNav_ColumnsList'); }
function RA_MiniNav_ClearCols()       { MN_ClearCols('RA_MiniNav_ColumnsList'); }
function RA_MiniNav_GetSelectedCols() { return MN_GetSelectedCols('RA_MiniNav_ColumnsList'); }

// ── Amount Filters ────────────────────────────────────────────────────────────
let RA_AmountList = [];
let _RA_ActiveTemplate = null;

// ── Seed built-in templates on first load ─────────────────────────────────────
(function () {
  const KEY = 'RA_AmountTemplates';
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
  const saved = _RA_GetTemplates();
  if (saved['Template 1']) {
    RA_AmountList = JSON.parse(JSON.stringify(saved['Template 1']));
    _RA_ActiveTemplate = 'Template 1';
  }
})();

const _RA_OP_LABELS = { equal: '=', greater_than: '>', less_than: '<' };

let _anraMiniAmtOpen = false;
function RA_MiniNav_ToggleAmt() {
  _anraMiniAmtOpen = !_anraMiniAmtOpen;
  const body    = document.getElementById('RA_MiniNav_AmtBody');
  const chevron = document.getElementById('RA_MiniNav_AmtChevron');
  if (body)    body.style.display      = _anraMiniAmtOpen ? 'block' : 'none';
  if (chevron) chevron.style.transform = _anraMiniAmtOpen ? 'rotate(90deg)' : 'rotate(0deg)';
  if (_anraMiniAmtOpen) {
    RA_LoadSavedTemplatesList();
    RA_RefreshAmountFilters();
    _navScrollOnExpand(document.getElementById('RA_MiniNav_AmtSection'), document.getElementById('RA_MiniNav'));
  }
}

// Mini-nav proxies — read inputs from the nav then call core
function RA_MiniNav_AddFilter() {
  const op  = document.getElementById('RA_MiniNav_AmountOp')?.value;
  const val = parseFloat(document.getElementById('RA_MiniNav_AmountVal')?.value);
  if (!op || isNaN(val)) return;
  RA_AmountList.push({ op, val });
  _RA_ActiveTemplate = null;
  RA_RefreshAmountFilters();
  RA_LoadSavedTemplatesList();
  document.getElementById('RA_MiniNav_AmountVal').value = '';
}

function RA_MiniNav_SaveTemplate() {
  const input = document.getElementById('RA_MiniNav_TemplateNameInput');
  const name  = input?.value.trim();
  if (!name || !RA_AmountList.length) return;
  const saved = _RA_GetTemplates();
  saved[name] = JSON.parse(JSON.stringify(RA_AmountList));
  localStorage.setItem('RA_AmountTemplates', JSON.stringify(saved));
  if (input) input.value = '';
  RA_LoadSavedTemplatesList();
}

// Core filter operations
function RA_RemoveAmountFilter(index) {
  RA_AmountList.splice(index, 1);
  RA_RefreshAmountFilters();
}

function RA_ResetAmountFilters() {
  _RA_ActiveTemplate = null;
  RA_AmountList = [
    { op: 'equal',        val: 0.00 },
    { op: 'greater_than', val: 0.00 },
    { op: 'greater_than', val: 1.00 },
    { op: 'greater_than', val: 10.00 },
    { op: 'greater_than', val: 30.00 },
    { op: 'greater_than', val: 100.00 },
    { op: 'greater_than', val: 250.00 },
    { op: 'greater_than', val: 1000.00 },
  ];
  RA_RefreshAmountFilters();
}

function RA_RefreshAmountFilters() {
  const list = document.getElementById('RA_MiniNav_AmountFiltersList');
  if (!list) return;
  if (!RA_AmountList.length) {
    list.innerHTML = '<span style="font-size:0.65rem;color:var(--color-text-dim);">No filters added.</span>';
    return;
  }
  list.innerHTML = RA_AmountList.map((f, i) => `
    <div style="display:flex;align-items:center;gap:6px;padding:5px 8px;background:var(--color-page-bg);border:0.5px solid var(--dml-border);border-radius:5px;font-size:0.65rem;">
      <span style="font-weight:700;min-width:14px;color:var(--MN_brand);">${_RA_OP_LABELS[f.op] || f.op}</span>
      <span style="color:var(--color-header-title);">${f.val.toFixed(2)}</span>
      <button onclick="RA_RemoveAmountFilter(${i})" style="margin-left:auto;background:none;border:none;cursor:pointer;font-size:0.65rem;color:#ef4444;padding:0;line-height:1;">✕</button>
    </div>`).join('');
}

// Template storage
function _RA_GetTemplates() {
  try { return JSON.parse(localStorage.getItem('RA_AmountTemplates') || '{}'); } catch { return {}; }
}

function RA_LoadSavedTemplatesList() {
  const el   = document.getElementById('RA_MiniNav_AmtTemplates');
  if (!el) return;
  const saved = _RA_GetTemplates();
  const names = Object.keys(saved);
  if (!names.length) { el.innerHTML = ''; return; }
  const PROTECTED = ['Template 1', 'Template 2'];
  el.innerHTML = names.map(name => `
    <div style="position:relative;display:inline-flex;align-items:center;">
      <button class="MN_btn${_RA_ActiveTemplate === name ? ' active' : ''}" style="width:100%;${PROTECTED.includes(name) ? '' : 'padding-right:20px;'}overflow:hidden;text-overflow:ellipsis;" onclick="RA_LoadSavedAmountTemplate('${name}')">${name}</button>
      ${PROTECTED.includes(name) ? '' : `<button onclick="RA_DeleteSavedAmountTemplate('${name}')" title="Delete"
        style="position:absolute;right:6px;background:none;border:none;cursor:pointer;font-size:0.55rem;color:#ef4444;padding:0;line-height:1;">✕</button>`}
    </div>`).join('');
}

function RA_LoadSavedAmountTemplate(name) {
  const saved = _RA_GetTemplates();
  if (!saved[name]) return;
  RA_AmountList = JSON.parse(JSON.stringify(saved[name]));
  _RA_ActiveTemplate = name;
  RA_RefreshAmountFilters();
  RA_LoadSavedTemplatesList();
}

function RA_DeleteSavedAmountTemplate(name) {
  const saved = _RA_GetTemplates();
  delete saved[name];
  localStorage.setItem('RA_AmountTemplates', JSON.stringify(saved));
  RA_LoadSavedTemplatesList();
}

// ── Score Column ──────────────────────────────────────────────────────────────
let RA_SelectedScoreColumn = null;

const _RA_NUMERIC_TYPES = /int|float|double|decimal|numeric|real|bigint|smallint|tinyint|hugeint|ubigint|uinteger|usmallint|utinyint/;

async function RA_MiniNav_PopulateScoreCols() {
  const list = document.getElementById('RA_MiniNav_ScoreColumnsList');
  if (!list) return;
  const conn = window.LD_getConn?.();
  const src  = window.LD_getSource?.();
  if (!conn || !src) {
    list.innerHTML = '<span style="font-size:0.65rem;color:var(--color-text-dim);">— Load data first —</span>';
    return;
  }
  try {
    const params     = window.SP_getParams?.() || {};
    const amountCol  = params.numeric;

    const res        = await conn.query(`DESCRIBE "${src}"`);
    const candidates = res.toArray()
      .filter(r => _RA_NUMERIC_TYPES.test((r.column_type || '').toLowerCase()) && r.column_name !== amountCol)
      .map(r => r.column_name);

    const counts = await Promise.all(candidates.map(c =>
      conn.query(`SELECT COUNT(DISTINCT "${c}") AS n FROM "${src}"`)
          .then(r => Number(r.toArray()[0].n))
    ));
    const cols = candidates.filter((_, i) => counts[i] >= 10);

    list.innerHTML = cols.length
      ? cols.map(c => {
          const sel = RA_SelectedScoreColumn === c;
          return `<button onclick="RA_ToggleScoreColumn('${c}')" class="MN_chip MN_chip--col MN_chip--a${sel ? ' active' : ''}">${c}</button>`;
        }).join('')
      : '<span style="font-size:0.65rem;color:var(--color-text-dim);">— No score columns —</span>';
  } catch { return; }
}

function RA_ToggleScoreColumn(col) {
  RA_SelectedScoreColumn = RA_SelectedScoreColumn === col ? null : col;
  document.querySelectorAll('#RA_MiniNav_ScoreColumnsList .MN_chip').forEach(btn => {
    const active = btn.textContent === col && RA_SelectedScoreColumn === col;
    btn.classList.toggle('active', active);
  });
  if (typeof RA_RefreshRouteBtns === 'function') RA_RefreshRouteBtns();
}

let _anraMiniScoreOpen = false;
function RA_MiniNav_ToggleScore() {
  _anraMiniScoreOpen = !_anraMiniScoreOpen;
  const body    = document.getElementById('RA_MiniNav_ScoreBody');
  const chevron = document.getElementById('RA_MiniNav_ScoreChevron');
  if (body)    body.style.display      = _anraMiniScoreOpen ? 'block' : 'none';
  if (chevron) chevron.style.transform = _anraMiniScoreOpen ? 'rotate(90deg)' : 'rotate(0deg)';
  if (_anraMiniScoreOpen) {
    RA_MiniNav_PopulateScoreCols();
    _navScrollOnExpand(document.getElementById('RA_MiniNav_ScoreSection'), document.getElementById('RA_MiniNav'));
  }
}

function RA_MiniNav_OpenDefaults() {
  const openSilent = (bodyId, chevronId) => {
    const body    = document.getElementById(bodyId);
    const chevron = document.getElementById(chevronId);
    if (body)    body.style.display      = 'block';
    if (chevron) chevron.style.transform = 'rotate(90deg)';
  };
  if (!_anraMiniAmtOpen) {
    _anraMiniAmtOpen = true;
    openSilent('RA_MiniNav_AmtBody', 'RA_MiniNav_AmtChevron');
    RA_LoadSavedTemplatesList();
    RA_RefreshAmountFilters();
  }
  if (!_anraMiniScoreOpen) {
    _anraMiniScoreOpen = true;
    openSilent('RA_MiniNav_ScoreBody', 'RA_MiniNav_ScoreChevron');
    RA_MiniNav_PopulateScoreCols();
  }
}

// ── Toggle All ────────────────────────────────────────────────────────────────
let _anraMiniAllExpanded = true;
function RA_MiniNav_ToggleAll() {
  _anraMiniAllExpanded = !_anraMiniAllExpanded;
  _anraMiniParamsOpen = _anraMiniAllExpanded;
  _anraMiniColsOpen   = _anraMiniAllExpanded;
  _anraMiniAmtOpen    = _anraMiniAllExpanded;
  _anraMiniScoreOpen  = _anraMiniAllExpanded;
  [
    ['RA_MiniNav_ParamsBody', 'RA_MiniNav_ParamsChevron'],
    ['RA_MiniNav_ColBody',    'RA_MiniNav_ColChevron'],
    ['RA_MiniNav_AmtBody',    'RA_MiniNav_AmtChevron'],
    ['RA_MiniNav_ScoreBody',  'RA_MiniNav_ScoreChevron'],
  ].forEach(([b, c]) => {
    const body    = document.getElementById(b);
    const chevron = document.getElementById(c);
    if (body)    body.style.display      = _anraMiniAllExpanded ? 'block' : 'none';
    if (chevron) chevron.style.transform = _anraMiniAllExpanded ? 'rotate(90deg)' : 'rotate(0deg)';
  });
  if (_anraMiniAllExpanded) {
    RA_LoadSavedTemplatesList();
    RA_RefreshAmountFilters();
    RA_MiniNav_PopulateScoreCols();
  }
  const btn = document.getElementById('RA_MiniNav_ExpandBtn');
  if (btn) btn.title = _anraMiniAllExpanded ? 'Collapse all' : 'Expand all';
}

// ── RA Info Popup ─────────────────────────────────────────────────────────────
function RA_infoOpen(btn, title, text) {
  const popup = document.getElementById('RA_InfoPopup');
  if (!popup) return;
  document.getElementById('RA_InfoTitle').textContent = title;
  document.getElementById('RA_InfoBody').innerHTML    = text;
  popup.style.visibility = 'hidden';
  popup.style.display    = 'block';
  popup.style.top = popup.style.bottom = popup.style.left = popup.style.right = '';
  const pH = popup.offsetHeight;
  const pW = popup.offsetWidth;
  popup.style.visibility = '';
  const r   = btn.getBoundingClientRect();
  const gap = 8;
  const spaceBelow = window.innerHeight - r.bottom - gap;
  const spaceAbove = r.top - gap;
  const spaceRight = window.innerWidth - r.left;
  const spaceLeft  = r.right;
  if (spaceBelow >= pH || spaceBelow >= spaceAbove) {
    popup.style.top = (r.bottom + gap) + 'px'; popup.style.bottom = '';
  } else {
    popup.style.bottom = (window.innerHeight - r.top + gap) + 'px'; popup.style.top = '';
  }
  if (spaceRight >= pW || spaceRight >= spaceLeft) {
    popup.style.left = r.left + 'px'; popup.style.right = '';
  } else {
    popup.style.right = (window.innerWidth - r.right) + 'px'; popup.style.left = '';
  }
  setTimeout(() => document.addEventListener('click', _RA_infoOutside), 0);
  window.addEventListener('scroll', RA_infoClose, { once: true, capture: true });
}
function _RA_infoOutside(e) {
  const popup = document.getElementById('RA_InfoPopup');
  if (popup && !popup.contains(e.target) && !e.target.classList.contains('MN_info_btn'))
    RA_infoClose();
}
function RA_infoClose() {
  const popup = document.getElementById('RA_InfoPopup');
  if (popup) popup.style.display = 'none';
  document.removeEventListener('click', _RA_infoOutside);
}
