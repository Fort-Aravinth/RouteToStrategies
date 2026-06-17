'use strict';
/* ── Set Parameters (SP) ──────────────────────────────────────────────────── */

let _SP_cols = [];
let _SP_cachedSrc = null;
let _SP_objectNames = [];
let _SP_activePreset = '';
let _SP_params = {
  col1: '', values: [], numeric: '', currency: '', object: '',
  auth_date: '', auth_time: '', combined_datetime: '',
  decisionMode: { col: '', values: [], assigned: { successful: [], unsuccessful: [] } },
  ruleSignal: '',
};

const _SP_MERCHANT_KEYWORDS = /\bmer(chant|id|name|currency)|\bmcc|resp|\bmid\b|country|store|shop|vendor|retailer|business|outlet/i;

const SP_DM_Assigned = { successful: [], unsuccessful: [] };
let   SP_DT_MergeActive = false;
const SP_CB_Cards = {};
const _SP_CB_currentValues = {};
let   SP_CB_Counter = 0;
const _SP_CB_builder = { col: '', values: [], assigned: { a: [], b: [] } };
const _SP_CB_builderExpanded = new Set();

// ── Open ─────────────────────────────────────────────────────────────────────

const _SP_LOCKABLE_CARDS = ['SP_Card_Amount','SP_Card_Dimension','SP_Card_Date','SP_Card_Decision','SP_Card_RuleSignal','SP_CB_CardEl'];

function SP_LockCards() {
  _SP_LOCKABLE_CARDS.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.add('ld-locked');
  });
}

function SP_UnlockCards() {
  _SP_LOCKABLE_CARDS.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.remove('ld-locked');
  });
}

function SP_unlockCard(id) {
  document.getElementById(id)?.classList.remove('ld-locked');
}

async function SP_Open() {
  if (typeof App_HideAllViews === 'function') App_HideAllViews();
  document.getElementById('GS_DataReadyBadge')?.remove();
  document.getElementById('SP_ParamsBadge')?.remove();
  const view = document.getElementById('SPView');
  if (!view) return;
  view.style.removeProperty('display');
  document.body.classList.add('sp-active');
  if (typeof Sidebar_SetActive === 'function') Sidebar_SetActive('nav-parameters');
  const shell = document.querySelector('.shell');
  if (shell && !shell.classList.contains('sidebar-hidden')) shell.classList.add('sidebar-hidden');
  document.documentElement.style.setProperty('--toast-brand','var(--brand-param)');
  SP_LockCards();
  await SP_LoadColumns();
  SP_RenderPresetDropdowns();
  if (_SP_activePreset) {
    const params = SP_GetPresets()[_SP_activePreset];
    if (params) await SP_ApplyPresetParams(params);
  }
}

// ── Load columns from DuckDB ──────────────────────────────────────────────────

async function SP_refreshCols() {
  const conn = window.LD_getConn && window.LD_getConn();
  const src  = window.LD_getSampleSource ? window.LD_getSampleSource() : window.LD_getSource ? window.LD_getSource() : null;
  if (!conn || !src || src === _SP_cachedSrc) return;
  try {
    const res = await conn.query(`DESCRIBE ${src}`);
    _SP_cols      = res.toArray().map(r => ({ name: String(r.column_name), dtype: String(r.column_type) }));
    _SP_cachedSrc = src;
  } catch(e) {}
}

function SP_sanitizeParams() {
  const valid = new Set(_SP_cols.map(c => c.name));
  let dirty = false;
  if (_SP_params.col1      && !valid.has(_SP_params.col1))               { _SP_params.col1 = ''; _SP_params.values = []; dirty = true; }
  if (_SP_params.numeric   && !valid.has(_SP_params.numeric))            { _SP_params.numeric = ''; dirty = true; }
  if (_SP_params.object    && !valid.has(_SP_params.object))             { _SP_params.object = ''; dirty = true; }
  if (_SP_params.auth_date && !valid.has(_SP_params.auth_date))          { _SP_params.auth_date = ''; dirty = true; }
  if (_SP_params.auth_time && !valid.has(_SP_params.auth_time))          { _SP_params.auth_time = ''; dirty = true; }
  if (_SP_params.ruleSignal && !valid.has(_SP_params.ruleSignal))        { _SP_params.ruleSignal = ''; dirty = true; }
  const dm = _SP_params.decisionMode;
  if (dm?.col && !valid.has(dm.col)) {
    _SP_params.decisionMode = { col: '', values: [], assigned: { successful: [], unsuccessful: [] } };
    dirty = true;
  }
  if (_SP_params.customCards?.length) {
    const before = _SP_params.customCards.length;
    _SP_params.customCards = _SP_params.customCards.filter(c => !c.col || valid.has(c.col));
    if (_SP_params.customCards.length !== before) dirty = true;
  }
  if (dirty) {
    console.error('[SP] Stale parameters detected — some column references were cleared because they do not exist in the current dataset.', { params: _SP_params });
    SP_showErrorBadge('Some parameters cleared — columns not found in this dataset');
  }
  return dirty;
}

function SP_isObjectType(dtype) {
  const d = dtype.toUpperCase();
  return d.includes('VARCHAR') || d.includes('TEXT') || d.includes('STRING') || d.includes('CHAR') || d === 'BLOB';
}

function SP_refreshRuleSignalOptions() {
  const excluded = new Set([_SP_params.col1, _SP_params.object, _SP_params.numeric].filter(Boolean));
  const cols = _SP_objectNames.filter(n => !excluded.has(n) && !_SP_MERCHANT_KEYWORDS.test(n));
  SP_renderSegmented('SP_RuleSignalOptions', cols, n => { _SP_params.ruleSignal = n; SP_UpdateAppliedDisplay(); }, _SP_params.ruleSignal);
}

async function SP_LoadColumns() {
  const conn = window.LD_getConn && window.LD_getConn();
  const src  = window.LD_getSampleSource ? window.LD_getSampleSource() : window.LD_getSource ? window.LD_getSource() : null;
  if (!conn || !src) return;

  try {
    // Cache DESCRIBE — re-run only when data source changes
    if (!_SP_cols.length || _SP_cachedSrc !== src) {
      const res = await conn.query(`DESCRIBE ${src}`);
      _SP_cols      = res.toArray().map(r => ({ name: String(r.column_name), dtype: String(r.column_type) }));
      _SP_cachedSrc = src;
      SP_sanitizeParams();
    }

    const objectCols   = _SP_cols.filter(c => SP_isObjectType(c.dtype));
    const numericNames = _SP_cols.filter(c => {
      const d = c.dtype.toUpperCase();
      return d.includes('INT') || d.includes('FLOAT') || d.includes('DOUBLE') || d.includes('DECIMAL') || d.includes('NUMERIC') || d === 'REAL' || d === 'HUGEINT';
    }).map(c => c.name);

    const dateNames = _SP_cols.filter(c => {
      const d = c.dtype.toUpperCase(), n = c.name.toLowerCase();
      return d.includes('DATE') || d.includes('TIMESTAMP') || n.includes('date') || n.endsWith('_dt') || n === 'dt';
    }).map(c => c.name);

    const timeNames = _SP_cols.filter(c => {
      const d = c.dtype.toUpperCase(), n = c.name.toLowerCase();
      return (d.includes('TIME') && !d.includes('TIMESTAMP')) || (n.includes('time') && !n.includes('datetime') && !n.includes('timeout'));
    }).map(c => c.name);

    _SP_objectNames = objectCols.map(c => c.name);
    const nonMerchantNames = _SP_objectNames.filter(n => !_SP_MERCHANT_KEYWORDS.test(n));

    // Two parallel scans instead of three sequential ones:
    // Scan A (object cols) — derives both fraudFilter (< 20 unique) and cardCategory (> 10 unique)
    // Scan B (numeric cols) — derives numericFiltered (> 10 unique)
    const objSelects = _SP_objectNames.length ? _SP_objectNames.map(n => `COUNT(DISTINCT "${n}") AS "${n}"`).join(', ') : null;
    const numSelects = numericNames.length     ? numericNames.map(n => `COUNT(DISTINCT "${n}") AS "${n}"`).join(', ') : null;

    const [objRow, numRow] = await Promise.all([
      objSelects ? conn.query(`SELECT ${objSelects} FROM ${src}`).then(r => r.toArray()[0]) : Promise.resolve(null),
      numSelects ? conn.query(`SELECT ${numSelects} FROM ${src}`).then(r => r.toArray()[0]) : Promise.resolve(null),
    ]);

    const fraudFilterNames  = objRow ? _SP_objectNames.filter(n => Number(objRow[n]) < 20)  : [];
    const numericFiltered   = numRow ? numericNames.filter(n => Number(numRow[n]) > 10)      : [];
    const cardCategoryNames = objRow ? nonMerchantNames.filter(n => Number(objRow[n]) > 10)  : [];

    SP_renderSegmented('SP_Col1Options', fraudFilterNames, n => { _SP_params.col1 = n; SP_LoadFilterValues(n); SP_UpdateAppliedDisplay(); SP_refreshRuleSignalOptions(); }, _SP_params.col1);
    SP_renderSegmented('SP_NumericOptions', numericFiltered, n => {
      _SP_params.numeric = n;
      SP_UpdateAppliedDisplay();
      SP_refreshRuleSignalOptions();
    }, _SP_params.numeric);
    SP_renderSegmented('SP_ObjectOptions', cardCategoryNames, n => { _SP_params.object = n; SP_UpdateAppliedDisplay(); SP_unlockCard('SP_Card_Date'); SP_CB_RefreshColOptions(); SP_refreshRuleSignalOptions(); }, _SP_params.object);
    SP_renderSegmented('SP_DecisionModeColOptions', fraudFilterNames, n => { _SP_params.decisionMode.col = n; SP_LoadDecisionModeValues(n); SP_UpdateAppliedDisplay(); }, _SP_params.decisionMode?.col);
    SP_refreshRuleSignalOptions();
    SP_CB_RefreshColOptions();

    // Date & Time: only date/time columns, no "show all" toggle
    SP_renderSegmented('SP_DateOptions', dateNames, n => { _SP_params.auth_date = n; SP_UpdateAppliedDisplay(); }, _SP_params.auth_date);
    SP_renderSegmented('SP_TimeOptions', timeNames, n => { _SP_params.auth_time = n; SP_UpdateAppliedDisplay(); }, _SP_params.auth_time);

    SP_restoreSelections();
    SP_UpdateAppliedDisplay();

  } catch (e) {
    console.error('[SP] SP_LoadColumns error:', e);
    SP_showErrorBadge('Failed to load columns from dataset');
  }
}


// ── Distinct values ───────────────────────────────────────────────────────────

async function SP_loadDistinctValues(colName, containerId, multiSelect, onToggle) {
  const conn = window.LD_getConn && window.LD_getConn();
  const src  = window.LD_getSampleSource ? window.LD_getSampleSource() : window.LD_getSource ? window.LD_getSource() : null;
  const container = document.getElementById(containerId);
  if (!conn || !src || !colName || !container) return;
  container.innerHTML = '<span style="font-size:0.7rem;color:var(--dml-muted);">loading…</span>';
  try {
    const res = await conn.query(`SELECT DISTINCT CAST("${colName}" AS VARCHAR) AS v FROM ${src} WHERE "${colName}" IS NOT NULL ORDER BY v LIMIT 100`);
    const values = res.toArray().map(r => String(r.v));
    SP_renderChips(containerId, values, multiSelect, onToggle);
  } catch (e) {
    container.innerHTML = '<span style="font-size:0.7rem;color:#ef4444;">Error loading values</span>';
  }
}

function SP_renderRadios(containerId, names, onSelect, groupName, checkedValue) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '';
  if (!names.length) { container.innerHTML = '<span style="font-size:0.7rem;color:var(--dml-muted);">None</span>'; return; }
  const rName   = groupName    || 'SP_Col1Radio';
  const checked = checkedValue !== undefined ? checkedValue : _SP_params.col1;
  names.forEach(name => {
    const label = document.createElement('label');
    label.className = 'sp-ff-row';
    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = rName;
    radio.value = name;
    if (checked === name) radio.checked = true;
    radio.onchange = () => onSelect(name);
    const span = document.createElement('span');
    span.textContent = name;
    span.title = name;
    label.appendChild(radio);
    label.appendChild(span);
    container.appendChild(label);
  });
}

function SP_renderSegmented(containerId, names, onSelect, activeValue, variant, multiSelect) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '';
  if (!names.length) { container.innerHTML = '<span style="font-size:0.7rem;color:var(--dml-muted);">None</span>'; return; }
  const ctrl = document.createElement('div');
  ctrl.className = variant === 'free' ? 'sp-seg-ctrl-free' : variant === 'h' ? 'sp-seg-ctrl-h' : 'sp-seg-ctrl';
  const activeSet = Array.isArray(activeValue) ? new Set(activeValue) : (activeValue ? new Set([activeValue]) : new Set());
  names.forEach(name => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'sp-seg-btn';
    btn.textContent = name;
    btn.title = name;
    btn.dataset.value = name;
    if (activeSet.has(name)) btn.classList.add('active');
    btn.onclick = () => {
      if (multiSelect) {
        btn.classList.toggle('active');
      } else {
        ctrl.querySelectorAll('.sp-seg-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      }
      onSelect(name);
    };
    ctrl.appendChild(btn);
  });
  container.appendChild(ctrl);
}

function SP_renderCheckboxes(containerId, names, selectedValues, onChange) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '';
  if (!names.length) { container.innerHTML = '<span style="font-size:0.7rem;color:var(--dml-muted);">None</span>'; return; }
  names.forEach(name => {
    const label = document.createElement('label');
    label.className = 'sp-ff-row';
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.value = name;
    if (selectedValues && selectedValues.includes(name)) cb.checked = true;
    cb.onchange = () => {
      _SP_params.values = Array.from(container.querySelectorAll('input[type="checkbox"]:checked')).map(c => c.value);
      SP_UpdateAppliedDisplay();
      if (onChange) onChange();
    };
    const span = document.createElement('span');
    span.textContent = name;
    span.title = name;
    label.appendChild(cb);
    label.appendChild(span);
    container.appendChild(label);
  });
}

async function SP_LoadFilterValues(colName) {
  const conn = window.LD_getConn && window.LD_getConn();
  const src  = window.LD_getSampleSource ? window.LD_getSampleSource() : window.LD_getSource ? window.LD_getSource() : null;
  const container = document.getElementById('SP_ValueOptions');
  if (!colName || !conn || !src || !container) { if (container) container.innerHTML = ''; return; }
  container.innerHTML = '<span style="font-size:0.7rem;color:var(--dml-muted);">loading…</span>';
  try {
    const res = await conn.query(`SELECT DISTINCT CAST("${colName}" AS VARCHAR) AS v FROM ${src} WHERE "${colName}" IS NOT NULL ORDER BY v LIMIT 100`);
    const values = res.toArray().map(r => String(r.v));
    SP_renderSegmented('SP_ValueOptions', values, () => {
      const hasValue = document.querySelector('#SP_ValueOptions .sp-seg-btn.active');
      if (hasValue) SP_unlockCard('SP_Card_Amount');
      SP_UpdateAppliedDisplay();
    }, _SP_params.values, null, true);
  } catch (e) {
    container.innerHTML = '<span style="font-size:0.7rem;color:#ef4444;">Error loading values</span>';
    console.error(`[SP] SP_LoadFilterValues error on column "${colName}":`, e);
    SP_showErrorBadge(`Column not found in dataset: ${colName}`);
  }
}

let _SP_DM_currentValues = [];
const _SP_DM_expanded = new Set();

function SP_LoadDecisionModeValues(colName, restoreAssigned) {
  SP_DM_Assigned.successful   = restoreAssigned?.successful   || [];
  SP_DM_Assigned.unsuccessful = restoreAssigned?.unsuccessful || [];
  _SP_DM_expanded.clear();
  _SP_DM_currentValues = [];
  const sEl = document.getElementById('SP_DM_SuccessfulList');
  const uEl = document.getElementById('SP_DM_UnsuccessfulList');
  const loading = '<span style="font-size:0.7rem;color:var(--dml-muted);">loading…</span>';
  if (sEl) sEl.innerHTML = loading;
  if (uEl) uEl.innerHTML = loading;
  if (!colName) { if (sEl) sEl.innerHTML = ''; if (uEl) uEl.innerHTML = ''; return; }
  const conn = window.LD_getConn && window.LD_getConn();
  const src  = window.LD_getSampleSource ? window.LD_getSampleSource() : window.LD_getSource ? window.LD_getSource() : null;
  if (!conn || !src) return;
  conn.query(`SELECT DISTINCT CAST("${colName}" AS VARCHAR) AS v FROM ${src} WHERE "${colName}" IS NOT NULL ORDER BY v LIMIT 100`)
    .then(res => {
      _SP_DM_currentValues = res.toArray().map(r => String(r.v));
      SP_DM_renderBuckets();
    })
    .catch(e => {
      const err = '<span style="font-size:0.7rem;color:#ef4444;">Error loading values</span>';
      if (sEl) sEl.innerHTML = err;
      if (uEl) uEl.innerHTML = err;
      console.error(`[SP] SP_LoadDecisionModeValues error on column "${colName}":`, e);
      SP_showErrorBadge(`Column not found in dataset: ${colName}`);
    });
}

function SP_DM_renderBuckets() {
  const PAGE = 3;
  ['successful', 'unsuccessful'].forEach(bucket => {
    const other     = bucket === 'successful' ? 'unsuccessful' : 'successful';
    const searchId  = bucket === 'successful' ? 'SP_DM_SearchSuccessful' : 'SP_DM_SearchUnsuccessful';
    const listId    = bucket === 'successful' ? 'SP_DM_SuccessfulList'   : 'SP_DM_UnsuccessfulList';
    const container = document.getElementById(listId);
    if (!container) return;
    container.innerHTML = '';
    const search  = (document.getElementById(searchId)?.value || '').toLowerCase();
    const visible = _SP_DM_currentValues.filter(v =>
      !SP_DM_Assigned[other].includes(v) &&
      (!search || v.toLowerCase().includes(search))
    );
    if (!visible.length) { container.innerHTML = '<span style="font-size:0.7rem;color:var(--dml-muted);">–</span>'; return; }
    const expanded = _SP_DM_expanded.has(bucket) || search;
    const shown    = expanded ? visible : visible.slice(0, PAGE);
    const ctrl = document.createElement('div');
    ctrl.className = 'sp-seg-ctrl-free';
    shown.forEach(val => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'sp-seg-btn';
      btn.textContent = val;
      btn.title = val;
      btn.dataset.value = val;
      if (SP_DM_Assigned[bucket].includes(val)) btn.classList.add('active');
      btn.onclick = () => SP_DM_toggleAssign(bucket, val);
      ctrl.appendChild(btn);
    });
    if (!expanded && visible.length > PAGE) {
      const more = document.createElement('button');
      more.type = 'button';
      more.className = 'sp-seg-btn';
      more.style.cssText = 'color:var(--brand-param);font-weight:600;background:transparent;';
      more.textContent = `+ ${visible.length - PAGE} more`;
      more.onclick = () => { _SP_DM_expanded.add(bucket); SP_DM_renderBuckets(); };
      ctrl.appendChild(more);
    }
    container.appendChild(ctrl);
  });
}

function SP_DM_selectRemaining(bucket) {
  const other    = bucket === 'successful' ? 'unsuccessful' : 'successful';
  const searchId = bucket === 'successful' ? 'SP_DM_SearchSuccessful' : 'SP_DM_SearchUnsuccessful';
  const search   = (document.getElementById(searchId)?.value || '').toLowerCase();
  _SP_DM_currentValues
    .filter(v =>
      !SP_DM_Assigned[other].includes(v) &&
      !SP_DM_Assigned[bucket].includes(v) &&
      (!search || v.toLowerCase().includes(search))
    )
    .forEach(v => SP_DM_Assigned[bucket].push(v));
  SP_DM_renderBuckets();
  if (SP_DM_Assigned.unsuccessful.length > 0) SP_unlockCard('SP_CB_CardEl');
  SP_UpdateAppliedDisplay();
}

function SP_DM_toggleAssign(bucket, val) {
  const other = bucket === 'successful' ? 'unsuccessful' : 'successful';
  if (SP_DM_Assigned[bucket].includes(val)) {
    SP_DM_Assigned[bucket] = SP_DM_Assigned[bucket].filter(x => x !== val);
  } else {
    SP_DM_Assigned[other]  = SP_DM_Assigned[other].filter(x => x !== val);
    SP_DM_Assigned[bucket].push(val);
  }
  SP_DM_renderBuckets();
  if (SP_DM_Assigned.unsuccessful.length > 0) SP_unlockCard('SP_CB_CardEl');
  SP_UpdateAppliedDisplay();
}

// ── Chip helpers ──────────────────────────────────────────────────────────────

function SP_renderChips(containerId, names, multiSelect, onClick) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '';
  if (!names.length) { container.innerHTML = '<span style="font-size:0.7rem;color:var(--dml-muted);">None</span>'; return; }
  names.forEach(name => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'pg-chip-sq';
    chip.setAttribute('data-value', name);
    chip.textContent = name;
    chip.onclick = () => onClick(name);
    container.appendChild(chip);
  });
}

function SP_selectSingle(containerId, value) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.querySelectorAll('.pg-chip-sq, .sp-seg-btn').forEach(c => c.classList.remove('active'));
  container.querySelector(`.pg-chip-sq[data-value="${CSS.escape(value)}"], .sp-seg-btn[data-value="${CSS.escape(value)}"]`)?.classList.add('active');
}

function SP_restoreSelections() {
  if (_SP_params.col1) {
    const btn = document.querySelector(`#SP_Col1Options .sp-seg-btn[data-value="${CSS.escape(_SP_params.col1)}"]`);
    if (btn) btn.classList.add('active');
    SP_LoadFilterValues(_SP_params.col1);
  }
  if (_SP_params.numeric) {
    const r = document.querySelector(`#SP_NumericOptions .sp-seg-btn[data-value="${CSS.escape(_SP_params.numeric)}"]`);
    if (r) r.classList.add('active');
  }
  if (_SP_params.object) {
    const b = document.querySelector(`#SP_ObjectOptions .sp-seg-btn[data-value="${CSS.escape(_SP_params.object)}"]`);
    if (b) b.classList.add('active');
    SP_unlockCard('SP_Card_Date');
  }
  if (_SP_params.auth_date) SP_selectSingle('SP_DateOptions',    _SP_params.auth_date);
  if (_SP_params.auth_time) SP_selectSingle('SP_TimeOptions',    _SP_params.auth_time);
  const curr = document.getElementById('SP_Currency');
  if (curr && _SP_params.currency) {
    curr.value = _SP_params.currency;
    SP_unlockCard('SP_Card_Dimension');
  }
}

// ── Date & Time card ──────────────────────────────────────────────────────────



function SP_DT_ToggleMerge() {
  SP_DT_MergeActive = !SP_DT_MergeActive;
  const btn = document.getElementById('SP_DT_MergeBtn');
  if (btn) { btn.classList.toggle('active', SP_DT_MergeActive); btn.textContent = SP_DT_MergeActive ? 'Merging ✓' : 'Merge'; }
  SP_UpdateAppliedDisplay();
  if (SP_DT_MergeActive) SP_unlockCard('SP_Card_Decision');
}

async function SP_DT_Preview() {
  const conn    = window.LD_getConn && window.LD_getConn();
  const src     = window.LD_getSampleSource ? window.LD_getSampleSource() : window.LD_getSource ? window.LD_getSource() : null;
  const dateCol = _SP_params.auth_date;
  const timeCol = _SP_params.auth_time;
  if (!conn || !src || (!dateCol && !timeCol)) { SP_DT_PreviewPopup('<span style="font-size:0.75rem;color:var(--dml-muted);">Select at least a date or time column first.</span>'); return; }

  const mergeName = document.getElementById('SP_DT_MergeName')?.value.trim() || 'Combined';
  const parts = [];
  if (dateCol) parts.push(`CAST("${dateCol}" AS VARCHAR)`);
  if (timeCol) parts.push(`CAST("${timeCol}" AS VARCHAR)`);
  const combined = parts.join(` || ' ' || `);
  const cols = [...(dateCol ? [`"${dateCol}"`] : []), ...(timeCol ? [`"${timeCol}"`] : []), `${combined} AS "${mergeName}"`].join(', ');

  SP_DT_PreviewPopup('<span style="font-size:0.7rem;color:var(--dml-muted);">loading…</span>');
  try {
    const res  = await conn.query(`SELECT ${cols} FROM ${src} LIMIT 5`);
    const rows = res.toArray();
    if (!rows.length) { SP_DT_PreviewPopup('<span style="font-size:0.75rem;color:var(--dml-muted);">No data.</span>'); return; }
    const headers = Object.keys(rows[0]);
    const html = `<div class="pg-table-wrap"><table class="pg-table">
      <thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
      <tbody>${rows.map(r => `<tr>${headers.map(h => `<td>${r[h] ?? '—'}</td>`).join('')}</tr>`).join('')}</tbody>
      </table></div>`;
    SP_DT_PreviewPopup(html);
  } catch (e) {
    SP_DT_PreviewPopup(`<span style="font-size:0.7rem;color:#ef4444;">${e.message}</span>`);
  }
}

function SP_DT_PreviewPopup(bodyHtml) {
  document.getElementById('SP_DT_PreviewPopup')?.remove();
  const overlay = document.createElement('div');
  overlay.id = 'SP_DT_PreviewPopup';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.35);';
  overlay.onclick = e => { if (e.target === overlay) overlay.remove(); };
  overlay.innerHTML = `
    <div style="background:var(--color-card-bg);border:0.5px solid var(--color-card-border);border-radius:var(--dml-radius);box-shadow:0 8px 32px rgba(0,0,0,0.18);padding:20px;min-width:320px;max-width:90vw;max-height:80vh;overflow:auto;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
        <span style="font-size:0.8rem;font-weight:600;color:var(--color-header-title);">Date &amp; Time Preview</span>
        <button type="button" onclick="document.getElementById('SP_DT_PreviewPopup').remove()" style="background:none;border:none;cursor:pointer;font-size:1rem;color:var(--dml-muted);line-height:1;">✕</button>
      </div>
      <div id="SP_DT_PreviewBody">${bodyHtml}</div>
    </div>`;
  document.body.appendChild(overlay);
}

// ── Decision Mode Filter ──────────────────────────────────────────────────────

// ── Card Builder ──────────────────────────────────────────────────────────────

function SP_CB_RefreshColOptions() {
  const excluded = _SP_params.object ? [_SP_params.object] : [];
  const cols = _SP_objectNames.filter(n => !excluded.includes(n));
  const current = _SP_CB_builder.col;
  SP_renderSegmented('SP_CB_ColOptions', cols, n => { _SP_CB_builder.col = n; SP_CB_BuilderLoadValues(n); }, cols.includes(current) ? current : null);
  if (current && !cols.includes(current)) {
    _SP_CB_builder.col      = '';
    _SP_CB_builder.values   = [];
    _SP_CB_builder.assigned = { a: [], b: [] };
    const listA = document.getElementById('SP_CB_ListA');
    const listB = document.getElementById('SP_CB_ListB');
    if (listA) listA.innerHTML = '';
    if (listB) listB.innerHTML = '';
  }
}

function SP_CB_UpdateBucketLabels() {
  const a = document.getElementById('SP_CB_LabelA')?.value.trim() || 'Label A';
  const b = document.getElementById('SP_CB_LabelB')?.value.trim() || 'Label B';
  const dA = document.getElementById('SP_CB_LabelADisplay');
  const dB = document.getElementById('SP_CB_LabelBDisplay');
  if (dA) dA.textContent = a;
  if (dB) dB.textContent = b;
}

async function SP_CB_BuilderLoadValues(colName) {
  _SP_CB_builder.assigned = { a: [], b: [] };
  _SP_CB_builder.values   = [];
  _SP_CB_builderExpanded.clear();
  const loading = '<span style="font-size:0.7rem;color:var(--dml-muted);">loading…</span>';
  const listA = document.getElementById('SP_CB_ListA');
  const listB = document.getElementById('SP_CB_ListB');
  if (listA) listA.innerHTML = loading;
  if (listB) listB.innerHTML = loading;
  const conn = window.LD_getConn && window.LD_getConn();
  const src  = window.LD_getSampleSource ? window.LD_getSampleSource() : window.LD_getSource ? window.LD_getSource() : null;
  if (!conn || !src) return;
  try {
    const res = await conn.query(`SELECT DISTINCT CAST("${colName}" AS VARCHAR) AS v FROM ${src} WHERE "${colName}" IS NOT NULL ORDER BY v LIMIT 100`);
    _SP_CB_builder.values = res.toArray().map(r => String(r.v));
    SP_CB_BuilderRenderBuckets();
  } catch(e) {
    const err = '<span style="font-size:0.7rem;color:#ef4444;">Error</span>';
    if (listA) listA.innerHTML = err;
    if (listB) listB.innerHTML = err;
    console.error(`[SP] Builder load values error on column "${colName}":`, e);
    SP_showErrorBadge(`Column not found in dataset: ${colName}`);
  }
}

function SP_CB_BuilderRenderBuckets() {
  const PAGE = 3;
  ['a', 'b'].forEach(bucket => {
    const other     = bucket === 'a' ? 'b' : 'a';
    const container = document.getElementById(`SP_CB_List${bucket.toUpperCase()}`);
    if (!container) return;
    container.innerHTML = '';
    const search  = (document.getElementById(`SP_CB_Search${bucket.toUpperCase()}`)?.value || '').toLowerCase();
    const visible = _SP_CB_builder.values.filter(v =>
      !_SP_CB_builder.assigned[other].includes(v) &&
      (!search || v.toLowerCase().includes(search))
    );
    if (!visible.length) { container.innerHTML = '<span style="font-size:0.7rem;color:var(--dml-muted);">–</span>'; return; }
    const expanded = _SP_CB_builderExpanded.has(bucket) || search;
    const shown    = expanded ? visible : visible.slice(0, PAGE);
    const ctrl = document.createElement('div');
    ctrl.className = 'sp-seg-ctrl-free';
    shown.forEach(val => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'sp-seg-btn';
      btn.textContent = val;
      btn.title = val;
      btn.dataset.value = val;
      if (_SP_CB_builder.assigned[bucket].includes(val)) btn.classList.add('active');
      btn.onclick = () => SP_CB_BuilderToggleAssign(bucket, val);
      ctrl.appendChild(btn);
    });
    if (!expanded && visible.length > PAGE) {
      const more = document.createElement('button');
      more.type = 'button';
      more.className = 'sp-seg-btn';
      more.style.cssText = 'color:var(--brand-param);font-weight:600;background:transparent;';
      more.textContent = `+ ${visible.length - PAGE} more`;
      more.onclick = () => { _SP_CB_builderExpanded.add(bucket); SP_CB_BuilderRenderBuckets(); };
      ctrl.appendChild(more);
    }
    container.appendChild(ctrl);
  });
}

function SP_CB_BuilderSelectRemaining(bucket) {
  const other  = bucket === 'a' ? 'b' : 'a';
  const search = (document.getElementById(`SP_CB_Search${bucket.toUpperCase()}`)?.value || '').toLowerCase();
  _SP_CB_builder.values
    .filter(v =>
      !_SP_CB_builder.assigned[other].includes(v) &&
      !_SP_CB_builder.assigned[bucket].includes(v) &&
      (!search || v.toLowerCase().includes(search))
    )
    .forEach(v => _SP_CB_builder.assigned[bucket].push(v));
  SP_CB_BuilderRenderBuckets();
}

function SP_CB_BuilderToggleAssign(bucket, val) {
  const other = bucket === 'a' ? 'b' : 'a';
  if (_SP_CB_builder.assigned[bucket].includes(val)) {
    _SP_CB_builder.assigned[bucket] = _SP_CB_builder.assigned[bucket].filter(x => x !== val);
  } else {
    _SP_CB_builder.assigned[other]  = _SP_CB_builder.assigned[other].filter(x => x !== val);
    _SP_CB_builder.assigned[bucket].push(val);
  }
  SP_CB_BuilderRenderBuckets();
}

function SP_CB_CreateCard(name, labelA, labelB) {
  const id  = `SP_CB_Card_${++SP_CB_Counter}`;
  const uid = v => `${id}_${v}`;
  SP_CB_Cards[id] = { name, labelA, labelB, col: '', assigned: { a: [], b: [] } };
  _SP_CB_currentValues[id] = [];

  const card = document.createElement('div');
  card.className = 'pg-card';
  card.id = id;
  card.innerHTML = `
    <div class="pg-card-header" style="position:relative;">
      <span class="pg-card-title">${name}</span>
      <span class="pg-card-label">column · values</span>
      <button type="button" onclick="SP_CB_RemoveCard('${id}')" style="position:absolute;top:0;right:0;width:22px;height:22px;border-radius:50%;border:0.5px solid var(--dml-border);background:var(--dml-surface);font-size:0.65rem;color:var(--dml-muted);cursor:pointer;display:flex;align-items:center;justify-content:center;">✕</button>
    </div>
    <div class="pg-card-divider"></div>
    <div class="pg-card-body" style="flex-direction:column;gap:10px;">
      <div class="sp-ff-grid">
        <div class="sp-ff-col">
          <div class="pg-field-label">Available Columns</div>
          <div id="${uid('ColOptions')}"></div>
        </div>
        <div class="sp-ff-divider"></div>
        <div class="sp-ff-col sp-dm-right">
          <div class="pg-field-label" style="margin-bottom:2px;">Category</div>
          <div class="sp-dm-bucket">
            <div class="sp-dm-bucket-label">${labelA}</div>
            <div id="${uid('ListA')}" class="sp-dm-value-list"></div>
          </div>
          <div class="sp-dm-bucket">
            <div class="sp-dm-bucket-label">${labelB}</div>
            <div id="${uid('ListB')}" class="sp-dm-value-list"></div>
          </div>
        </div>
      </div>
    </div>`;

  const grid = document.getElementById('SP_CardGrid');
  grid.insertBefore(card, document.getElementById('SP_CB_CardEl'));

  SP_renderSegmented(uid('ColOptions'), _SP_cols.map(c => c.name), colName => {
    SP_CB_Cards[id].col = colName;
    SP_CB_LoadValues(id, colName);
  });

  return id;
}

function SP_CB_isValidLabel(v) { return /^[A-Za-z_][A-Za-z0-9_ ]*$/.test(v); }

function SP_CB_AddCard() {
  const name   = document.getElementById('SP_CB_Name')?.value.trim();
  const labelA = document.getElementById('SP_CB_LabelA')?.value.trim();
  const labelB = document.getElementById('SP_CB_LabelB')?.value.trim();
  if (!name || !labelA || !labelB) { SP_showErrorBadge('Enter card name and both labels'); return; }
  if (!SP_CB_isValidLabel(labelA)) { SP_showErrorBadge('Label A must start with a letter or underscore'); return; }
  if (!SP_CB_isValidLabel(labelB)) { SP_showErrorBadge('Label B must start with a letter or underscore'); return; }
  if (labelA.toLowerCase() === labelB.toLowerCase()) { SP_showErrorBadge('Label A and Label B must be different'); return; }
  const existingNames = Object.values(SP_CB_Cards).map(c => c.name.toLowerCase());
  if (existingNames.includes(name.toLowerCase())) { SP_showErrorBadge(`Card "${name}" already exists`); return; }

  const id = SP_CB_CreateCard(name, labelA, labelB);
  if (_SP_CB_builder.col) {
    SP_CB_Cards[id].col = _SP_CB_builder.col;
    _SP_CB_currentValues[id] = _SP_CB_builder.values.slice();
    SP_CB_Cards[id].assigned  = { a: _SP_CB_builder.assigned.a.slice(), b: _SP_CB_builder.assigned.b.slice() };
    SP_selectSingle(`${id}_ColOptions`, _SP_CB_builder.col);
    SP_CB_renderBuckets(id);
  }

  document.getElementById('SP_CB_Name').value   = '';
  document.getElementById('SP_CB_LabelA').value = '';
  document.getElementById('SP_CB_LabelB').value = '';
  document.getElementById('SP_CB_LabelADisplay').textContent = 'Label A';
  document.getElementById('SP_CB_LabelBDisplay').textContent = 'Label B';
  _SP_CB_builder.col      = '';
  _SP_CB_builder.values   = [];
  _SP_CB_builder.assigned = { a: [], b: [] };
  document.querySelectorAll('#SP_CB_ColOptions .sp-seg-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('SP_CB_ListA').innerHTML = '';
  document.getElementById('SP_CB_ListB').innerHTML = '';
  const sA = document.getElementById('SP_CB_SearchA'); if (sA) sA.value = '';
  const sB = document.getElementById('SP_CB_SearchB'); if (sB) sB.value = '';
}

async function SP_CB_RestoreCard(cardData) {
  if (!cardData.col) return;
  if (!_SP_cols.some(c => c.name === cardData.col)) return;

  const id = SP_CB_CreateCard(cardData.name, cardData.labelA, cardData.labelB);
  SP_CB_Cards[id].col = cardData.col;
  SP_selectSingle(`${id}_ColOptions`, cardData.col);

  const conn = window.LD_getConn && window.LD_getConn();
  const src  = window.LD_getSampleSource ? window.LD_getSampleSource() : window.LD_getSource ? window.LD_getSource() : null;
  if (conn && src) {
    try {
      const res = await conn.query(`SELECT DISTINCT CAST("${cardData.col}" AS VARCHAR) AS v FROM ${src} WHERE "${cardData.col}" IS NOT NULL ORDER BY v LIMIT 100`);
      _SP_CB_currentValues[id] = res.toArray().map(r => String(r.v));
    } catch(e) {}
  }
  SP_CB_Cards[id].assigned = {
    a: (cardData.assigned?.a || []).slice(),
    b: (cardData.assigned?.b || []).slice(),
  };
  SP_CB_renderBuckets(id);
}

async function SP_CB_LoadValues(cardId, colName) {
  const uid = v => `${cardId}_${v}`;
  SP_CB_Cards[cardId].assigned = { a: [], b: [] };
  _SP_CB_currentValues[cardId] = [];
  const loading = '<span style="font-size:0.7rem;color:var(--dml-muted);">loading…</span>';
  const listA = document.getElementById(uid('ListA'));
  const listB = document.getElementById(uid('ListB'));
  if (listA) listA.innerHTML = loading;
  if (listB) listB.innerHTML = loading;
  const conn = window.LD_getConn && window.LD_getConn();
  const src  = window.LD_getSampleSource ? window.LD_getSampleSource() : window.LD_getSource ? window.LD_getSource() : null;
  if (!conn || !src) return;
  try {
    const res = await conn.query(`SELECT DISTINCT CAST("${colName}" AS VARCHAR) AS v FROM ${src} WHERE "${colName}" IS NOT NULL ORDER BY v LIMIT 100`);
    _SP_CB_currentValues[cardId] = res.toArray().map(r => String(r.v));
    SP_CB_renderBuckets(cardId);
  } catch(e) {
    const err = '<span style="font-size:0.7rem;color:#ef4444;">Error</span>';
    if (listA) listA.innerHTML = err;
    if (listB) listB.innerHTML = err;
    console.error(`[SP] Card load values error on column "${colName}":`, e);
    SP_showErrorBadge(`Column not found in dataset: ${colName}`);
  }
}

function SP_CB_renderBuckets(cardId) {
  const card = SP_CB_Cards[cardId];
  const uid  = v => `${cardId}_${v}`;
  if (!card) return;
  const vals = _SP_CB_currentValues[cardId] || [];
  ['a', 'b'].forEach(bucket => {
    const other     = bucket === 'a' ? 'b' : 'a';
    const container = document.getElementById(uid(`List${bucket.toUpperCase()}`));
    if (!container) return;
    container.innerHTML = '';
    const visible = vals.filter(v => !card.assigned[other].includes(v));
    if (!visible.length) { container.innerHTML = '<span style="font-size:0.7rem;color:var(--dml-muted);">–</span>'; return; }
    const ctrl = document.createElement('div');
    ctrl.className = 'sp-seg-ctrl-free';
    visible.forEach(val => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'sp-seg-btn';
      btn.textContent = val;
      btn.title = val;
      btn.dataset.value = val;
      if (card.assigned[bucket].includes(val)) btn.classList.add('active');
      btn.onclick = () => SP_CB_toggleAssign(cardId, bucket, val);
      ctrl.appendChild(btn);
    });
    container.appendChild(ctrl);
  });
}

function SP_CB_toggleAssign(cardId, bucket, val) {
  const other = bucket === 'a' ? 'b' : 'a';
  const card  = SP_CB_Cards[cardId];
  if (!card) return;
  if (card.assigned[bucket].includes(val)) {
    card.assigned[bucket] = card.assigned[bucket].filter(x => x !== val);
  } else {
    card.assigned[other]  = card.assigned[other].filter(x => x !== val);
    card.assigned[bucket].push(val);
  }
  SP_CB_renderBuckets(cardId);
  SP_UpdateAppliedDisplay();
}

function SP_CB_RemoveCard(cardId) {
  delete SP_CB_Cards[cardId];
  delete _SP_CB_currentValues[cardId];
  document.getElementById(cardId)?.remove();
}

// ── Parameters badge (persists across pages, mirrors GS_DataReadyBadge) ──────

function SP_showErrorBadge(msg) {
  let el = document.getElementById('SP_ParamsBadge');
  if (!el) {
    el = document.createElement('div');
    el.id = 'SP_ParamsBadge';
    el.className = 'App_badge';
    document.body.appendChild(el);
  }
  el.style.borderRightColor = '#DC2626';
  el.innerHTML = `
    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" style="flex-shrink:0;color:#DC2626">
      <circle cx="8" cy="8" r="6.5" stroke="currentColor" stroke-width="1.5"/>
      <path d="M5.5 5.5l5 5M10.5 5.5l-5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    </svg>
    <span style="color:#DC2626">${msg}</span>
    <button onclick="document.getElementById('SP_ParamsBadge').remove();SP_stackBadges();">✕</button>`;
  SP_stackBadges();
}

function SP_stackBadges() {
  const badges = ['OV_ReadyBadge', 'SR_ReadyBadge', 'SRM_ReadyBadge', 'SP_ParamsBadge', 'GS_DataReadyBadge']
    .map(id => document.getElementById(id)).filter(Boolean);
  let bottom = 18;
  badges.forEach(b => { b.style.bottom = bottom + 'px'; bottom += b.offsetHeight + 8; });
}

// ── Generic 10s auto-dismiss for all App_badge elements ──────────────────────
(function () {
  const _timers = new WeakMap();
  function _reset(el) {
    if (_timers.has(el)) clearTimeout(_timers.get(el));
    _timers.set(el, setTimeout(() => {
      el.remove();
      if (typeof SP_stackBadges === 'function') SP_stackBadges();
    }, 10000));
  }
  new MutationObserver(muts => {
    const seen = new Set();
    muts.forEach(m => {
      m.addedNodes.forEach(n => {
        if (n.nodeType === 1 && n.classList?.contains('App_badge') && !seen.has(n)) {
          seen.add(n); _reset(n);
        }
      });
      const badge = m.target?.nodeType === 1 ? m.target.closest?.('.App_badge') : null;
      if (badge && !seen.has(badge)) { seen.add(badge); _reset(badge); }
    });
  }).observe(document.body, { childList: true, subtree: true });
})();

function SP_showLoadingBadge(msg) {
  let el = document.getElementById('SP_ParamsBadge');
  if (!el) {
    el = document.createElement('div');
    el.id = 'SP_ParamsBadge';
    el.className = 'App_badge';
    document.body.appendChild(el);
  }
  el.style.borderRightColor = '';
  el.innerHTML = `
    <svg viewBox="0 0 16 16" width="14" height="14" style="flex-shrink:0;animation:GS_spin 1s linear infinite;color:var(--brand-param,#0D9488)">
      <circle cx="8" cy="8" r="5.5" stroke="currentColor" stroke-width="1.5" stroke-dasharray="22" stroke-dashoffset="8" fill="none"/>
    </svg>
    <span>${msg}</span>`;
  SP_stackBadges();
}

function SP_showParamsReadyBadge(secs) {
  const timeStr = secs != null ? ` &nbsp;·&nbsp; ${secs}s` : '';
  let el = document.getElementById('SP_ParamsBadge');
  if (!el) {
    el = document.createElement('div');
    el.id = 'SP_ParamsBadge';
    el.className = 'App_badge';
    document.body.appendChild(el);
  }
  el.style.borderRightColor = 'var(--brand-param,#0D9488)';
  el.innerHTML = `
    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" style="flex-shrink:0;color:var(--brand-param,#0D9488)">
      <circle cx="8" cy="8" r="6.5" stroke="currentColor" stroke-width="1.5"/>
      <path d="M5 8l2 2 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
    <span><strong>Parameters applied</strong>${timeStr}</span>
    <button onclick="document.getElementById('SP_ParamsBadge').remove();SP_stackBadges();">✕</button>`;
  SP_stackBadges();
}

// ── Apply / Reset ─────────────────────────────────────────────────────────────

function SP_presetToParams(p) {
  return {
    col1:              p.FraudFlag?.col || '',
    values:            p.FraudFlag?.values || [],
    numeric:           p.TransactionAmount?.numeric || '',
    currency:          p.TransactionAmount?.currency || '',
    object:            p.CardDimension?.col || '',
    auth_date:         p.DateTime?.date || '',
    auth_time:         p.DateTime?.time || '',
    combined_datetime: p.DateTime?.combined || '',
    decisionMode: {
      col:      p.DecisionMode?.col || '',
      values:   [...(p.DecisionMode?.successful || []), ...(p.DecisionMode?.unsuccessful || [])],
      assigned: { successful: p.DecisionMode?.successful || [], unsuccessful: p.DecisionMode?.unsuccessful || [] },
    },
    ruleSignal:  p.RuleSignal?.col || '',
    customCards: p.CustomCards || [],
  };
}

function SP_GetCurrentParams() {
  const dmCol = document.querySelector('#SP_DecisionModeColOptions .sp-seg-btn.active')?.dataset.value || '';
  const customCards = Object.values(SP_CB_Cards).map(card => ({
    name: card.name, labelA: card.labelA, labelB: card.labelB,
    col:  card.col || '',
    assigned: { a: card.assigned.a.slice(), b: card.assigned.b.slice() },
  }));
  return {
    FraudFlag:         { col: document.querySelector('#SP_Col1Options .sp-seg-btn.active')?.dataset.value || '', values: Array.from(document.querySelectorAll('#SP_ValueOptions .sp-seg-btn.active')).map(b => b.dataset.value) },
    TransactionAmount: { numeric: document.querySelector('#SP_NumericOptions .sp-seg-btn.active')?.dataset.value || '', currency: document.getElementById('SP_Currency')?.value || '' },
    CardDimension:     { col: document.querySelector('#SP_ObjectOptions .sp-seg-btn.active')?.dataset.value || '' },
    DateTime:          { date: document.querySelector('#SP_DateOptions .sp-seg-btn.active')?.dataset.value || '', time: document.querySelector('#SP_TimeOptions .sp-seg-btn.active')?.dataset.value || '', combined: SP_DT_MergeActive ? (document.getElementById('SP_DT_MergeName')?.value.trim() || 'Combined') : '' },
    DecisionMode:      { col: dmCol, successful: SP_DM_Assigned.successful.slice(), unsuccessful: SP_DM_Assigned.unsuccessful.slice() },
    RuleSignal:        { col: document.querySelector('#SP_RuleSignalOptions .sp-seg-btn.active')?.dataset.value || '' },
    CustomCards:       customCards,
  };
}

function SP_validateParams(g) {
  const missing = [];
  if (!g.FraudFlag?.col)                                            missing.push('Fraud Flag — select a column');
  if (!g.FraudFlag?.values?.length)                                 missing.push('Fraud Flag — select at least one value');
  if (!g.TransactionAmount?.numeric)                                missing.push('Transaction Amount — select a column');
  if (!g.CardDimension?.col)                                        missing.push('Card Category — select a column');
  if (!g.DateTime?.date && !g.DateTime?.combined)                   missing.push('Analysis Period — select a date column');
  if (!g.DecisionMode?.col)                                         missing.push('Decision Outcome — select a column');
  if (!g.DecisionMode?.successful?.length)                          missing.push('Decision Outcome — assign at least one Successful value');
  if (!g.DecisionMode?.unsuccessful?.length)                        missing.push('Decision Outcome — assign at least one Unsuccessful value');
  return missing;
}

function SP_ApplyParameters(overrideGrouped, _startMs) {
  const grouped = overrideGrouped || SP_GetCurrentParams();
  const missing = SP_validateParams(grouped);
  if (missing.length) {
    SP_showErrorBadge('Missing required parameters (' + missing.length + ')');
    console.warn('[SP] Required parameters missing:\n' + missing.map(m => '  • ' + m).join('\n'));
    return;
  }
  const t0 = _startMs ?? performance.now();
  _SP_params = SP_presetToParams(grouped);
  const dirty = _SP_cols.length ? SP_sanitizeParams() : false;
  try { localStorage.setItem('SP_CachedParams', JSON.stringify(grouped)); } catch(e) {}
  SP_UpdateAppliedDisplay(_SP_params);
  SP_UnlockCards();
  if (!dirty) {
    if (typeof window.NAV_UnlockNav === 'function') window.NAV_UnlockNav();
    SP_showParamsReadyBadge(((performance.now() - t0) / 1000).toFixed(2));
  }
}

function SP_ResetParameters() {
  document.querySelectorAll('#SP_Col1Options .sp-seg-btn, #SP_NumericOptions .sp-seg-btn, #SP_ObjectOptions .sp-seg-btn, #SP_ValueOptions .sp-seg-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('SP_ValueOptions').innerHTML = '';
  ['SP_ObjectOptions','SP_DateOptions','SP_TimeOptions','SP_DecisionModeColOptions']
    .forEach(id => document.getElementById(id)?.querySelectorAll('.sp-seg-btn.active,.pg-chip-sq.active').forEach(c => c.classList.remove('active')));
  const curr = document.getElementById('SP_Currency');
  if (curr) curr.value = '';
  SP_DM_Assigned.successful   = [];
  SP_DM_Assigned.unsuccessful = [];
  _SP_DM_currentValues = [];
  SP_DM_renderBuckets();
  SP_DT_MergeActive = false;
  const btn = document.getElementById('SP_DT_MergeBtn');
  if (btn) { btn.classList.remove('active'); btn.textContent = 'Merge'; }
  document.getElementById('SP_DT_PreviewPopup')?.remove();
  _SP_params = { col1:'', values:[], numeric:'', currency:'', object:'', auth_date:'', auth_time:'', combined_datetime:'', decisionMode:{ col:'', values:[], assigned:{ successful:[], unsuccessful:[] } } };
  SP_UpdateAppliedDisplay();
  document.getElementById('SP_ParamsBadge')?.remove();
}

// ── Applied display ───────────────────────────────────────────────────────────

function SP_BuildParamLines(params) {
  const lines = [];
  if (params.col1)              lines.push(`Fraud Filter Column: ${params.col1}`);
  if (params.values?.length)    lines.push(`Filter Values: ${params.values.join(', ')}`);
  if (params.numeric)           lines.push(`Amount Metric: ${params.numeric}`);
  if (params.currency)          lines.push(`Currency: ${params.currency}`);
  if (params.object)            lines.push(`Card Dimension: ${params.object}`);
  if (params.auth_date)         lines.push(`Date Column: ${params.auth_date}`);
  if (params.auth_time)         lines.push(`Time Column: ${params.auth_time}`);
  if (params.combined_datetime) lines.push(`Combined DateTime: ${params.combined_datetime}`);
  if (params.ruleSignal)        lines.push(`Rule Signal: ${params.ruleSignal}`);
  const dm = params.decisionMode;
  if (dm?.col) {
    lines.push(`Decision Mode Column: ${dm.col}`);
    if (dm.assigned?.successful?.length)   lines.push(`  Successful: ${dm.assigned.successful.join(', ')}`);
    if (dm.assigned?.unsuccessful?.length) lines.push(`  Unsuccessful: ${dm.assigned.unsuccessful.join(', ')}`);
  }
  (params.customCards || []).forEach(card => {
    lines.push(`${card.name} — Column: ${card.col || '—'}`);
    if (card.assigned?.a?.length) lines.push(`  ${card.labelA}: ${card.assigned.a.join(', ')}`);
    if (card.assigned?.b?.length) lines.push(`  ${card.labelB}: ${card.assigned.b.join(', ')}`);
  });
  return lines;
}

function SP_UpdateAppliedDisplay(params) {
  if (!params) {
    // keep currency in sync with live input, then use _SP_params as source
    _SP_params.currency = document.getElementById('SP_Currency')?.value || '';
    params = _SP_params;
  }
  const lines   = SP_BuildParamLines(params);
  const display = document.getElementById('SP_AppliedParamsDisplay');
  if (display) display.textContent = lines.length ? lines.join('\n') : '—';
  document.querySelectorAll('[data-sp-params]').forEach(el => { if (el.id) SP_RenderParamsTo(el.id); });
}

// ── Presets (localStorage) ────────────────────────────────────────────────────

const _SP_PRESET_KEY = 'SP_Presets';
function SP_GetPresets() { try { return JSON.parse(localStorage.getItem(_SP_PRESET_KEY) || '{}'); } catch { return {}; } }
function SP_SetPresets(p) { localStorage.setItem(_SP_PRESET_KEY, JSON.stringify(p)); }

function SP_RenderPresetDropdowns() {
  const names = Object.keys(SP_GetPresets());

  // Update datalist for the single input
  const dl = document.getElementById('SP_SetupsList');
  if (dl) {
    dl.innerHTML = '';
    names.forEach(n => {
      const opt = document.createElement('option');
      opt.value = n;
      dl.appendChild(opt);
    });
  }

  // Sidebar preset dropdown — auto-applies on selection
  const sidebar = document.getElementById('SP_SidebarPreset');
  if (sidebar) {
    const opts  = sidebar.querySelector('.cs-options');
    const valEl = sidebar.querySelector('.cs-value');
    if (opts) {
      opts.innerHTML = `<div class="cs-option${_SP_activePreset ? '' : ' cs-selected'}" data-value="">Load Saved Parameters</div>`;
      if (valEl) valEl.textContent = _SP_activePreset || 'Load Saved Parameters';
      names.forEach(name => {
        const opt = document.createElement('div');
        opt.className = 'cs-option' + (name === _SP_activePreset ? ' cs-selected' : '');
        opt.setAttribute('data-value', name);
        opt.textContent = name;
        opt.onclick = async () => {
          sidebar.querySelectorAll('.cs-option').forEach(o => o.classList.remove('cs-selected'));
          opt.classList.add('cs-selected');
          if (valEl) valEl.textContent = name;
          sidebar.classList.remove('open');
          _SP_activePreset = name;
          const params = SP_GetPresets()[name];
          if (params) {
            const _t0 = performance.now();
            _SP_params = SP_presetToParams(params);
            const spView = document.getElementById('SPView');
            if (spView && spView.style.display !== 'none') {
              SP_ApplyPresetParams(params);
            } else {
              await SP_refreshCols();
              const stale = _SP_cols.length ? SP_sanitizeParams() : false;
              if (!stale) {
                SP_showParamsReadyBadge(((performance.now() - _t0) / 1000).toFixed(2));
                if (typeof window.NAV_UnlockNav === 'function') window.NAV_UnlockNav();
              }
            }
          }
        };
        opts.appendChild(opt);
      });
    }
  }
}

function SP_getDropdownValue(id) {
  return document.getElementById(id)?.querySelector('.cs-option.cs-selected')?.getAttribute('data-value') || '';
}

function SP_SwitchTab(tab) {
  ['View', 'Save', 'Remove', 'Load', 'Export', 'Import'].forEach(t => {
    const isActive = t.toLowerCase() === tab;
    document.getElementById(`SP_Tab_${t}`)?.classList.toggle('active', isActive);
    const panel = document.getElementById(`SP_Panel_${t}`);
    if (!panel) return;
    const isColumn = t === 'Export' || t === 'Import';
    panel.style.display = isActive ? (isColumn ? 'flex' : 'flex') : 'none';
  });
}

function SP_ExportPresets() {
  const presets = SP_GetPresets();
  if (!Object.keys(presets).length) return;
  const blob = new Blob([JSON.stringify(presets, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = 'SP_Setups.json';
  a.click();
  URL.revokeObjectURL(url);
}

function SP_ImportPresets() {
  const file = document.getElementById('SP_ImportFile')?.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const imported = JSON.parse(e.target.result);
      if (typeof imported !== 'object' || Array.isArray(imported)) throw new Error('Invalid format');
      const existing = SP_GetPresets();
      const merged   = { ...existing, ...imported };
      SP_SetPresets(merged);
      SP_RenderPresetDropdowns();
      document.getElementById('SP_ImportFile').value = '';
    } catch {
    }
  };
  reader.readAsText(file);
}

function SP_getSetupName() { return document.getElementById('SP_SaveName')?.value.trim() || ''; }

function SP_ViewPreset() {
  const name = SP_getSetupName();
  if (!name) return;
  const preset = SP_GetPresets()[name];
  if (!preset) return;
  const lines = SP_BuildParamLines(SP_presetToParams(preset));
  const el = document.getElementById('SP_AppliedParamsDisplay');
  if (el) el.textContent = lines.length ? lines.join('\n') : '(empty setup)';
}

function SP_SavePreset() {
  const name = SP_getSetupName();
  if (!name) return;
  const presets = SP_GetPresets();
  presets[name] = SP_GetCurrentParams();
  SP_SetPresets(presets);
  document.getElementById('SP_SaveName').value = '';
  SP_RenderPresetDropdowns();
}

function SP_DeletePreset() {
  const name = SP_getSetupName();
  if (!name) return;
  if (!confirm(`Delete setup "${name}"?`)) return;
  const presets = SP_GetPresets();
  delete presets[name];
  SP_SetPresets(presets);
  document.getElementById('SP_SaveName').value = '';
  SP_RenderPresetDropdowns();
}

async function SP_LoadPreset() {
  const name = SP_getSetupName();
  if (!name) return;
  const params = SP_GetPresets()[name];
  if (!params) return;
  _SP_activePreset = name;
  await SP_ApplyPresetParams(params);
}

async function SP_ApplyPresetParams(grouped) {
  if (!grouped) return;
  const _t0 = performance.now();
  _SP_params = SP_presetToParams(grouped);
  const dirty = _SP_cols.length ? SP_sanitizeParams() : false;
  const p = _SP_params;

  // Restore simple chip selections
  if (p.numeric) {
    const r = document.querySelector(`#SP_NumericOptions .sp-seg-btn[data-value="${CSS.escape(p.numeric)}"]`);
    if (r) r.classList.add('active');
  }
  if (p.object) {
    const b = document.querySelector(`#SP_ObjectOptions .sp-seg-btn[data-value="${CSS.escape(p.object)}"]`);
    if (b) b.classList.add('active');
  }
  if (p.auth_date) SP_selectSingle('SP_DateOptions', p.auth_date);
  if (p.auth_time) SP_selectSingle('SP_TimeOptions', p.auth_time);
  if (p.currency)  { const el = document.getElementById('SP_Currency'); if (el) { el.value = p.currency; SP_unlockCard('SP_Card_Dimension'); } }
  if (p.combined_datetime) {
    const el = document.getElementById('SP_DT_MergeName');
    if (el) el.value = p.combined_datetime;
    SP_DT_MergeActive = true;
    document.getElementById('SP_DT_MergeBtn')?.classList.add('active');
  }

  // Restore fraud filter col + values (async — values load after col selected)
  if (p.col1) {
    const btn = document.querySelector(`#SP_Col1Options .sp-seg-btn[data-value="${CSS.escape(p.col1)}"]`);
    if (btn) btn.classList.add('active');
    await SP_LoadFilterValues(p.col1);
    if (p.values?.length) {
      p.values.forEach(val => {
        const btn = document.querySelector(`#SP_ValueOptions .sp-seg-btn[data-value="${CSS.escape(val)}"]`);
        if (btn) btn.classList.add('active');
      });
      SP_unlockCard('SP_Card_Amount');
    }
  }

  // Restore decision mode col + assigned buckets
  if (p.decisionMode?.col) {
    const dmColBtn = document.querySelector(`#SP_DecisionModeColOptions .sp-seg-btn[data-value="${CSS.escape(p.decisionMode.col)}"]`);
    if (dmColBtn) { document.querySelectorAll('#SP_DecisionModeColOptions .sp-seg-btn').forEach(b => b.classList.remove('active')); dmColBtn.classList.add('active'); }
    SP_LoadDecisionModeValues(p.decisionMode.col, p.decisionMode.assigned);
  }

  // Restore custom cards — remove any existing first
  Object.keys(SP_CB_Cards).forEach(id => { delete SP_CB_Cards[id]; document.getElementById(id)?.remove(); });
  if (p.customCards?.length) {
    for (const cardData of p.customCards) {
      await SP_CB_RestoreCard(cardData);
    }
  }

  try { localStorage.setItem('SP_CachedParams', JSON.stringify(grouped)); } catch(e) {}
  SP_UpdateAppliedDisplay(_SP_params);
  SP_UnlockCards();
  if (!dirty) {
    if (typeof window.NAV_UnlockNav === 'function') window.NAV_UnlockNav();
    SP_showParamsReadyBadge(((performance.now() - _t0) / 1000).toFixed(2));
  }
}


// ── Restore cached params on load ─────────────────────────────────────────────

window.SP_getParams = () => _SP_params;



// Populate sidebar dropdown on page load
document.addEventListener('DOMContentLoaded', () => SP_RenderPresetDropdowns());

// Restore cached params from a previous session

// ── Set Parameters Tutorial ───────────────────────────────────────────────────

const _SP_TOUR_STEPS = [
  {
    title: 'Fraud Filter',
    body:  'Start here. Pick the column that identifies fraud in your data — then check one or more values that represent a fraudulent transaction (e.g. <strong>Y</strong>, <strong>1</strong>, <strong>fraud</strong>).',
  },
  {
    title: 'Amount Metric',
    body:  'Select the numeric column that holds transaction amounts (e.g. <strong>PurchaseAmount</strong>). Optionally enter your currency code so reports label values correctly.',
  },
  {
    title: 'Card Dimension',
    body:  'Choose an object column used as the primary grouping dimension across analysis pages — for example <strong>CardBrand</strong> or <strong>Channel</strong>.',
  },
  {
    title: 'Date & Time',
    body:  'Pick a date column and/or a time column. Use <strong>Merge</strong> to combine them into a single datetime column — useful for per-hour or per-minute analysis.',
  },
  {
    title: 'Decision Mode',
    body:  'Pick a column whose values indicate whether a transaction was authorised. Assign values to <strong>Successful</strong> and <strong>Unsuccessful</strong> buckets.',
  },
  {
    title: 'Custom Cards',
    body:  'Add your own binary-split dimensions — give the card a name, define two labels (e.g. <strong>Online / In-Store</strong>), then assign column values to each side.',
  },
  {
    title: 'Apply Parameters',
    body:  'When all parameters are set, click <strong>Apply Parameters</strong>. The nav unlocks and every analysis page will use these settings. Save as a preset to reload later.',
  },
];

let _SP_tourStep      = 0;
let _SP_tourEnabled   = false;

function SP_tourShow(step) {
  _SP_tourStep = step;
  const s     = _SP_TOUR_STEPS[step];
  if (!s) { SP_tourDismiss(); return; }
  const total = _SP_TOUR_STEPS.length;
  let el = document.getElementById('SP_TourCard');
  if (!el) {
    el = document.createElement('div');
    el.id = 'SP_TourCard';
    el.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:99998;';
    document.body.appendChild(el);
  }
  el.innerHTML = `
    <div class="gs-toast" id="SP_TourInner">
      <div class="gs-tab-strip" onclick="SP_tourTabExpand()" title="Expand">
        <span class="gs-tab-arrow">›</span>
        <span class="gs-tab-label">Step ${step+1} of ${total}</span>
      </div>
      <div class="gs-toast-inner">
        <div class="gs-toast-header">
          <div>
            <div class="gs-toast-step">Step ${step+1} of ${total}</div>
            <div class="gs-toast-title">${s.title}</div>
          </div>
          <button class="gs-toast-btn-collapse" onclick="SP_tourTabCollapse()" title="Collapse to tab">
            <svg viewBox="0 0 16 16" width="10" height="10" fill="none"><path d="M10 3H13V13H10M6 8H2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
        </div>
        <div class="gs-toast-body">${s.body}</div>
        <div class="gs-toast-actions">
          <button class="gs-toast-btn-back" onclick="SP_tourShow(_SP_tourStep - 1)" style="${step === 0 ? 'visibility:hidden;' : ''}">← Back</button>
          <button class="gs-toast-btn-next" onclick="SP_tourNext()">${step + 1 < total ? 'Next →' : 'Finish ✓'}</button>
        </div>
      </div>
    </div>`;
}

function SP_tourTabCollapse() {
  const el = document.getElementById('SP_TourInner');
  if (!el) return;
  const rect = el.getBoundingClientRect();
  el.style.top    = '';
  el.style.bottom = (window.innerHeight - rect.bottom) + 'px';
  el.classList.add('gs-tabbed');
  const strip = el.querySelector('.gs-tab-strip');
  if (strip) strip.style.height = rect.height + 'px';
}

function SP_tourTabExpand() {
  const el = document.getElementById('SP_TourInner');
  if (!el) return;
  el.style.top = el.style.bottom = '';
  el.classList.remove('gs-tabbed');
}

function SP_tourNext() { SP_tourShow(_SP_tourStep + 1); }

function SP_tourDismiss() {
  document.getElementById('SP_TourCard')?.remove();
  _SP_tourEnabled = false;
  document.getElementById('SP_HelpBtn')?.classList.remove('tutorial-active');
}

function SP_HelpPrompt() {
  _SP_tourEnabled = !_SP_tourEnabled;
  document.getElementById('SP_HelpBtn')?.classList.toggle('tutorial-active', _SP_tourEnabled);
  if (_SP_tourEnabled) {
    SP_tourShow(0);
  } else {
    SP_tourDismiss();
  }
}

if (typeof App_RegisterTutorial === 'function') App_RegisterTutorial('sp-active', SP_HelpPrompt);

// ── Info popup ────────────────────────────────────────────────────────────────

function SP_infoOpen(btn, title, text) {
  const popup = document.getElementById('SP_InfoPopup');
  if (!popup) return;
  document.getElementById('SP_InfoTitle').textContent = title;
  document.getElementById('SP_InfoBody').innerHTML    = text;
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
  setTimeout(() => document.addEventListener('click', _SP_infoOutside), 0);
  window.addEventListener('scroll', SP_infoClose, { once: true, capture: true });
}

function _SP_infoOutside(e) {
  const popup = document.getElementById('SP_InfoPopup');
  if (popup && !popup.contains(e.target) && !e.target.classList.contains('pg-card-info-btn'))
    SP_infoClose();
}

function SP_infoClose() {
  const popup = document.getElementById('SP_InfoPopup');
  if (popup) popup.style.display = 'none';
  document.removeEventListener('click', _SP_infoOutside);
}

// ── SP Params Renderer — renders Set Parameters state into any mini-nav panel ─

window.SP_RenderParamsTo = function(elementId, brand = 'sa') {
  const el = document.getElementById(elementId);
  if (!el) return;
  const p = typeof window.SP_getParams === 'function' ? window.SP_getParams() : null;
  if (!p || !p.col1) { el.innerHTML = '<div class="MN_hint">— Apply parameters to load —</div>'; return; }
  const row = (label, value) =>
    `<div class="MN_param_row">
      <div class="MN_param_label">${label}</div>
      <div class="MN_param_value">${value || '—'}</div>
    </div>`;
  const divider = `<div class="MN_param_divider"></div>`;
  const values = Array.isArray(p.values) ? p.values.join(', ') : (p.values || '—');
  let html = row('Fraud Filter Column', p.col1)
           + row('Filter Values', values)
           + row('Amount Metric Column', p.numeric)
           + (p.currency ? row('Currency', p.currency) : '')
           + row('Card Dimension Column', p.object);
  if (p.auth_date || p.auth_time) {
    html += divider;
    if (p.auth_date)         html += row('Authorisations Date',  p.auth_date);
    if (p.auth_time)         html += row('Authorisations Time',  p.auth_time);
    if (p.combined_datetime) html += row('Combined Date & Time', p.combined_datetime);
  }
  const dm = p.decisionMode;
  if (dm && dm.col) {
    html += divider + row('Decision Mode Column', dm.col);
    html += `<div class="MN_param_tags">
      <div class="MN_param_tag">✓ Successful: ${(dm.assigned?.successful||[]).join(', ')||'—'}</div>
      <div class="MN_param_tag secondary">✗ Unsuccessful: ${(dm.assigned?.unsuccessful||[]).join(', ')||'—'}</div>
    </div>`;
  }
  if (p.ruleSignal) html += divider + row('Rule Signal Column', p.ruleSignal);
  (p.customCards || []).forEach(card => {
    html += divider + row(card.name || 'Custom', card.col || '—');
    html += `<div class="MN_param_tags">
      <div class="MN_param_tag">✓ ${card.labelA||'A'}: ${(card.assigned?.a||[]).join(', ')||'—'}</div>
      <div class="MN_param_tag secondary">✗ ${card.labelB||'B'}: ${(card.assigned?.b||[]).join(', ')||'—'}</div>
    </div>`;
  });
  el.innerHTML = html;
};
