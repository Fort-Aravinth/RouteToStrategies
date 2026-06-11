// ── Preview Data — DuckDB-WASM (no server required) ──────────────────────────
(function() {
  const s = document.createElement('style');
  s.textContent = `
/* ── Preview Data ── */
#PreDatView .pg-card::before        { background: var(--brand-dm); }
#PreDatView .pg-btn,
#PD_Modal .pg-btn                   { border-color: var(--brand-dm-dim); background: var(--brand-dm-dim); color: var(--brand-dm); }
#PreDatView .pg-btn:hover,
#PD_Modal .pg-btn:hover             { background: var(--brand-dm); border-color: var(--brand-dm); color: #fff; }
#PreDatView .pg-btn.active,
#PD_Modal .pg-btn.active            { background: var(--brand-dm); border-color: var(--brand-dm); color: #fff; }
#PD_Modal .popup-header             { border-bottom-color: rgba(232,113,74,0.25); }
#PD_Modal .popup-footer             { border-top-color: rgba(232,113,74,0.25); }
#PD_Modal .popup-close:hover        { color: var(--brand-dm); }
#PD_Modal .popup-title              { color: var(--brand-dm); }
#PreDatView .pg-chip.active             { background: var(--brand-dm); border-color: var(--brand-dm); }
#PreDatView .pg-chip:hover              { background: var(--brand-dm-dim); border-color: var(--brand-dm); }
#PreDatView .pg-chip-sq.active          { background: var(--brand-dm); border-color: var(--brand-dm); }
#PreDatView .pg-chip-sq:hover           { background: var(--brand-dm-dim); border-color: var(--brand-dm); }
#PreDatView .pg-table th.pg-col-selected   { background: rgba(232,113,74,0.15); color: #a84a28; border-bottom-color: rgba(232,113,74,0.4); }
#PreDatView .pg-table td.pg-col-selected   { background: rgba(232,113,74,0.07) !important; }
#PreDatView .pg-table th:hover             { background: #EDE8E4; color: #555; }
#PreDatView .cs-trigger:hover                   { border-color: var(--brand-dm); }
#PreDatView .custom-select.open .cs-trigger     { border-color: var(--brand-dm); box-shadow: 0 0 0 2px var(--brand-dm-dim); }
#PreDatView .cs-option:hover                    { background: var(--brand-dm-dim); }
#PreDatView .cs-option.cs-selected              { color: #fff; background: var(--brand-dm); }
#PreDatView .pg-chip-sq.pd-match { border-color: var(--brand-dm); box-shadow: 0 0 0 2px var(--brand-dm-dim); order: -1; }
#PreDatView .pg-chip-sq.pd-match.active { box-shadow: 0 0 0 2px rgba(232,113,74,0.4); }
#PD_PreviewCard .pg-table-wrap { margin: 0 2px 2px; }
#PreDatView .pg-table th, #GSView .pg-table th { text-transform: none; }
.pd-transform-chip { border-color: var(--color-card-border) !important; color: var(--color-text-muted) !important; background: var(--color-nav-hover) !important; }
.pd-transform-chip:hover { border-color: #6366f1 !important; background: rgba(99,102,241,0.08) !important; color: #6366f1 !important; }
.pg-chip-sq-input { border: 1px solid var(--brand-dm) !important; border-radius: 4px; padding: 2px 6px; font-size: 0.68rem; font-family: var(--font-base); outline: none; background: #fff; box-shadow: 0 0 0 2px var(--brand-dm-dim); }


`;
  document.head.appendChild(s);
})();

function PD_hideAllViews() {
  if (typeof App_HideAllViews === 'function') { App_HideAllViews(); return; }
  document.querySelectorAll('.pg-layout, [id$="View"]').forEach(el => el.style.display = 'none');
}

function PD_setSidebarActive(id) {
  if (typeof Sidebar_SetActive === 'function') { Sidebar_SetActive(id); return; }
  document.querySelectorAll('.sidebar-item').forEach(el => el.classList.remove('active'));
  const el = document.getElementById(id);
  if (el) el.classList.add('active');
}

// ── DuckDB init ──────────────────────────────────────────────────────────────
let _db = null;
let _conn = null;

async function PD_getDB() {
  if (_db) return _conn;
  const JSDELIVR = 'https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@latest/dist/';
  if (!window.duckdb) {
    const mod = await import('https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm/+esm');
    window.duckdb = mod;
  }
  const duck = window.duckdb;
  const bundles = {
    mvp: { mainModule: JSDELIVR + 'duckdb-mvp.wasm', mainWorker: JSDELIVR + 'duckdb-browser-mvp.worker.js' },
    eh:  { mainModule: JSDELIVR + 'duckdb-eh.wasm',  mainWorker: JSDELIVR + 'duckdb-browser-eh.worker.js'  },
  };
  const bundle = await duck.selectBundle(bundles);
  const workerBlob = new Blob([`importScripts('${bundle.mainWorker}');`], { type: 'application/javascript' });
  const worker = new Worker(URL.createObjectURL(workerBlob));
  const logger = new duck.ConsoleLogger();
  _db = new duck.AsyncDuckDB(logger, worker);
  await _db.instantiate(bundle.mainModule);
  _conn = await _db.connect();
  return _conn;
}

// ── Close dropdown on outside click ──────────────────────────────────────────
document.addEventListener('click', e => {
  if (!e.target.closest('#PreDatView .custom-select')) {
    document.querySelectorAll('#PreDatView .custom-select.open').forEach(s => s.classList.remove('open'));
  }
});

// ── PD lock helpers ───────────────────────────────────────────────────────────
function PD_lock(id)   { const el = document.getElementById(id); if (el) el.classList.add('ld-locked'); }
function PD_unlock(id) { const el = document.getElementById(id); if (el) el.classList.remove('ld-locked'); }

function PD_toggleCustomSelect(id) {
  const el = document.getElementById(id);
  if (!el) return;
  const isOpen = el.classList.contains('open');
  // close all PD dropdowns
  document.querySelectorAll('#PreDatView .custom-select.open').forEach(s => s.classList.remove('open'));
  if (!isOpen) {
    el.classList.add('open');
    setTimeout(() => {
      const trigger = el.querySelector('.cs-trigger');
      const options = el.querySelector('.cs-options');
      if (!trigger || !options) return;
      const rect = el.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      const dropdownHeight = Math.min(200, options.scrollHeight + 8);
      options.style.left  = rect.left + 'px';
      options.style.width = rect.width + 'px';
      if (spaceBelow < dropdownHeight && spaceAbove > dropdownHeight) {
        options.style.top = (rect.top - dropdownHeight - 2) + 'px';
      } else {
        options.style.top = (rect.bottom + 2) + 'px';
        if (spaceBelow < 200) options.style.maxHeight = (spaceBelow - 20) + 'px';
      }
    }, 0);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  PD_lock('PD_DelimCard');
  PD_lock('PD_HeaderCard');
  PD_lock('PD_SelectorCard');
  PD_lock('PD_PreviewCard');
  PD_lock('PD_Tab_Save');
  PD_lock('PD_Tab_Delete');
  PD_lock('PD_Tab_Load');

});

// ── State ─────────────────────────────────────────────────────────────────────
let PD_AllColumns     = [];
let PD_Selected       = new Set();
let PD_PreviewData    = { columns: [], data: [] };
let PD_HasHeader      = false;
let PD_Aliases        = {};
let PD_UploadedFile   = null;
let PD_Delimiter      = null;
let PD_RegisteredName = null;

// ── Open view ─────────────────────────────────────────────────────────────────
function PD_Open() {
  PD_hideAllViews();
  PD_setSidebarActive('nav-preview-data');
  const main = document.querySelector('main.main');
  if (main) {
    main.style.display = 'flex';
    main.style.flexDirection = '';
    main.style.height = '';
    main.style.minHeight = '';
    main.style.visibility = 'visible';
    main.scrollTop = 0;
  }
  document.documentElement.style.setProperty('--toast-brand', 'var(--brand-dm)');
  document.getElementById('PreDatView').style.removeProperty('display');
  PD_refreshListDropdowns();
}

// ── File picked from disk ─────────────────────────────────────────────────────
function PD_onFilePicked(event) {
  const file = event.target.files[0];
  if (!file) return;
  PD_UploadedFile = file;
  PD_RegisteredName = null;
  PD_Aliases = {};
  _PD_setFileLabel(file);
  PD_unlock('PD_DelimCard');
  if (typeof GS_unlock === 'function') GS_unlock('GS_DelimCard');
  event.target.value = '';
  PD_loadFile();
}

function _PD_setFileLabel(file) {
  const nameEl = document.getElementById('PD_FileName');
  const sizeEl = document.getElementById('PD_FileSize');
  if (nameEl) nameEl.textContent = file.name + ' · ';
  if (sizeEl) sizeEl.textContent = (file.size / 1024).toFixed(1) + ' KB';
}

function PD_HandleDragOver(e)  { e.preventDefault(); document.getElementById('PD_DropZone').classList.add('drag-over'); }
function PD_HandleDragLeave(e) { document.getElementById('PD_DropZone').classList.remove('drag-over'); }
function PD_HandleFileDrop(e) {
  e.preventDefault();
  document.getElementById('PD_DropZone').classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (!file) return;
  PD_UploadedFile = file;
  PD_RegisteredName = null;
  PD_Aliases = {};
  _PD_setFileLabel(file);
  PD_unlock('PD_DelimCard');
  if (typeof GS_unlock === 'function') GS_unlock('GS_DelimCard');
  PD_loadFile();
}

// ── Delimiter toggle ──────────────────────────────────────────────────────────
function PD_setDelim(val, btn) {
  PD_Delimiter = val;
  document.querySelectorAll('[id^="PD_Delim_"]').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  PD_unlock('PD_HeaderCard');
  if (typeof GS_unlock === 'function') GS_unlock('GS_HeaderCard');
  if (PD_UploadedFile) PD_loadFile();
}

// ── Header toggle ─────────────────────────────────────────────────────────────
function PD_setHeader(val) {
  PD_HasHeader = val;
  document.getElementById('PD_BtnHeader').classList.toggle('active', val);
  document.getElementById('PD_BtnNoHeader').classList.toggle('active', !val);
  PD_unlock('PD_SelectorCard');
  PD_unlock('PD_PreviewCard');
  PD_unlock('PD_Tab_Save');
  PD_unlock('PD_Tab_Delete');
  PD_unlock('PD_Tab_Load');
  if (PD_UploadedFile) PD_loadFile();
}

// ── Load file via DuckDB ──────────────────────────────────────────────────────
async function PD_loadFile() {
  if (!PD_UploadedFile) { return; }
  const tableEl = document.getElementById('PD_FullTable');
  if (tableEl) tableEl.innerHTML = '<p style="color:var(--color-text-muted);font-size:0.75rem;padding:10px;">Loading…</p>';

  try {
    const conn  = await PD_getDB();
    const fname = 'pd_' + PD_UploadedFile.name.replace(/[^a-zA-Z0-9._]/g, '_');
    if (fname !== PD_RegisteredName) {
      await _db.registerFileHandle(fname, PD_UploadedFile, window.duckdb.DuckDBDataProtocol.BROWSER_FILEREADER, true);
      PD_RegisteredName = fname;
    }

    const delim  = (!PD_Delimiter || PD_Delimiter === 'auto') ? '' : `, delim='${PD_Delimiter}'`;
    const header = PD_HasHeader ? '' : ', header=false';
    const srcVarchar = `read_csv_auto('${fname}'${delim}${header}, all_varchar=true, ignore_errors=true)`;

    const preview = await conn.query(`SELECT * FROM ${srcVarchar} LIMIT 25`);
    const cols    = preview.schema.fields.map(f => f.name);
    const rows    = preview.toArray().map(r => { const o = {}; cols.forEach(c => o[c] = r[c] ?? ''); return o; });

    PD_AllColumns  = cols;
    PD_PreviewData = { columns: cols, data: rows };

    // Show table immediately
    const statsRow = document.getElementById('PD_StatsRow');
    if (statsRow) statsRow.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:2px;">
        <span style="font-size:0.6rem;color:var(--color-text-muted);text-transform:uppercase;letter-spacing:.04em;">Rows</span>
        <span style="font-size:1rem;font-weight:700;color:var(--color-header-title);" id="PD_RowCount">…</span>
      </div>
      <div style="display:flex;flex-direction:column;gap:2px;">
        <span style="font-size:0.6rem;color:var(--color-text-muted);text-transform:uppercase;letter-spacing:.04em;">Columns</span>
        <span style="font-size:1rem;font-weight:700;color:var(--color-header-title);">${cols.length}</span>
      </div>`;

    PD_unlock('PD_PreviewCard');
    document.querySelectorAll('[id="PD_PreviewCard"]').forEach(el => el.classList.remove('ld-locked'));
    PD_Selected = new Set([...PD_Selected].filter(c => cols.includes(c)));
    PD_renderChips();
    PD_renderPreviewTable();

    // Step 2: count rows in background — doesn't block the UI
    conn.query(`SELECT COUNT(*) AS n FROM ${srcVarchar}`).then(res => {
      const rowCount = Number(res.toArray()[0].n);
      const el = document.getElementById('PD_RowCount');
      if (el) el.textContent = rowCount.toLocaleString();
    });

  } catch (e) {
    if (tableEl) tableEl.innerHTML = '';
  }
}

// ── Preview selected columns ──────────────────────────────────────────────────
async function PD_previewSelected() {
  const container = document.getElementById('PD_SelTable');
  if (!PD_Selected.size) {
    if (container) container.innerHTML = '<p style="color:#ef4444;font-size:0.75rem;padding:10px;">No columns selected.</p>';
    return;
  }
  if (!PD_RegisteredName) { return; }

  const nrows   = parseInt(document.getElementById('PD_NRows').value) || 10;
  const ordered = PD_AllColumns.filter(c => PD_Selected.has(c));
  if (container) container.innerHTML = '<p style="color:var(--color-text-muted);font-size:0.75rem;padding:10px;">Loading…</p>';

  try {
    const conn    = await PD_getDB();
    const delim   = (!PD_Delimiter || PD_Delimiter === 'auto') ? '' : `, delim='${PD_Delimiter}'`;
    const header  = PD_HasHeader ? '' : ', header=false';
    const colList = ordered.map(c => `"${c.replace(/"/g,'""')}"`).join(', ');
    const res     = await conn.query(
      `SELECT ${colList} FROM read_csv_auto('${PD_RegisteredName}'${delim}${header}, ignore_errors=true) LIMIT ${nrows}`
    );
    const rows = res.toArray().map(r => { const o = {}; ordered.forEach(c => o[c] = r[c] ?? ''); return o; });
    if (container) container.innerHTML = PD_buildTable(ordered, rows);
  } catch (e) {
    if (container) container.innerHTML = `<p style="color:#ef4444;font-size:0.75rem;padding:10px;">${e.message}</p>`;
  }
}

// ── Table rendering ───────────────────────────────────────────────────────────
function PD_renderPreviewTable() {
  const tableEl = document.getElementById('PD_FullTable');
  if (!tableEl || !PD_AllColumns.length) return;
  tableEl.innerHTML = PD_buildTable(PD_AllColumns, PD_PreviewData.data, PD_Selected);
}

function PD_buildTable(cols, rows, selected = new Set()) {
  if (!cols || !cols.length) return '<p style="color:var(--dml-muted);font-size:0.75rem;padding:10px;">No data.</p>';
  const ths = cols.map(c => {
    const safe  = c.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
    const label = PD_Aliases[c] || c;
    const badge = PD_Types[c] ? `<span class="pd-type-badge">${PD_Types[c]}</span>` : '';
    return `<th class="${selected.has(c) ? 'pg-col-selected' : ''}" onclick="PD_thClick('${safe}', this)" ondblclick="PD_thDblClick('${safe}', this)" title="${c}" style="cursor:pointer;">${label}${badge}</th>`;
  }).join('');
  const trs = rows.map(r => '<tr>' + cols.map(c =>
    `<td${selected.has(c) ? ' class="pg-col-selected"' : ''} title="${String(r[c]??'').replace(/"/g,'&quot;')}">${r[c]??''}</td>`
  ).join('') + '</tr>').join('');
  return `<table class="pg-table"><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table>`;
}

// ── Column selection ──────────────────────────────────────────────────────────
function PD_resetAliases() {
  PD_Aliases = {};
  PD_renderChips();
  PD_renderPreviewTable();
}

function PD_applyAliasPreset(preset) {
  PD_AllColumns.forEach(col => {
    let n = PD_Aliases[col] || col;
    if      (preset === 'remove_spaces') n = n.replace(/\s+/g, '')
    else if (preset === 'spaces_to_underscore') n = n.replace(/\s+/g, '_');
    else if (preset === 'snake_case')    n = n.replace(/\s+/g, '_').replace(/([A-Z])/g, m => '_' + m.toLowerCase()).replace(/^_/, '');
    else if (preset === 'lowercase')     n = n.toLowerCase();
    else if (preset === 'uppercase')     n = n.toUpperCase();
    if (n !== col) PD_Aliases[col] = n; else delete PD_Aliases[col];
  });
  PD_renderChips();
  PD_renderPreviewTable();
}

function PD_startAliasEdit(col, btn) {
  const current = PD_Aliases[col] || col;
  const inp = document.createElement('input');
  inp.type = 'text';
  inp.value = current;
  inp.className = btn.className + ' pg-chip-sq-input';
  inp.style.cssText = `width:${Math.max(60, current.length * 8)}px;`;
  const finish = () => {
    const val = inp.value.trim();
    if (val && val !== col) PD_Aliases[col] = val;
    else delete PD_Aliases[col];
    if (inp.parentNode) inp.parentNode.replaceChild(btn, inp);
    PD_renderChips();
    PD_renderPreviewTable();
  };
  inp.addEventListener('blur', finish);
  inp.addEventListener('keydown', e => {
    if (e.key === 'Enter')  { e.preventDefault(); inp.blur(); }
    if (e.key === 'Escape') { if (inp.parentNode) inp.parentNode.replaceChild(btn, inp); }
  });
  btn.parentNode.replaceChild(inp, btn);
  inp.focus(); inp.select();
}

let _PD_thClickTimer = null;
function PD_thClick(col, th) {
  if (_PD_thClickTimer) return;
  _PD_thClickTimer = setTimeout(() => { _PD_thClickTimer = null; PD_toggleColByName(col); }, 220);
}
function PD_thDblClick(col, th) {
  if (_PD_thClickTimer) { clearTimeout(_PD_thClickTimer); _PD_thClickTimer = null; }
  PD_startAliasEditFromTable(col, th);
}

function PD_startAliasEditFromTable(col, th) {
  const current = PD_Aliases[col] || col;
  const inp = document.createElement('input');
  inp.type = 'text';
  inp.value = current;
  inp.style.cssText = `width:${Math.max(60, current.length * 8)}px;font-size:inherit;font-family:var(--font-base);border:1px solid var(--brand-dm);border-radius:3px;padding:1px 4px;outline:none;background:#fff;color:var(--color-header-title);text-transform:none;`;
  const finish = () => {
    const val = inp.value.trim();
    if (val && val !== col) PD_Aliases[col] = val; else delete PD_Aliases[col];
    PD_renderChips();
    PD_renderPreviewTable();
  };
  inp.addEventListener('blur', finish);
  inp.addEventListener('keydown', e => {
    if (e.key === 'Enter')  { e.preventDefault(); inp.blur(); }
    if (e.key === 'Escape') { PD_renderPreviewTable(); }
  });
  th.textContent = '';
  th.appendChild(inp);
  inp.focus(); inp.select();
}

function PD_toggleColByName(col) {
  if (PD_Selected.has(col)) { PD_Selected.delete(col); } else { PD_Selected.add(col); }
  PD_renderChips();
  PD_renderPreviewTable();
}

function PD_toggleCol(col, el) {
  if (PD_Selected.has(col)) { PD_Selected.delete(col); el.classList.remove('active'); }
  else { PD_Selected.add(col); el.classList.add('active'); }
  const badge = document.getElementById('PD_SelCount');
  if (badge) badge.textContent = `${PD_Selected.size} selected`;
  PD_renderPreviewTable();
}

function PD_clearAll()   { PD_Selected = new Set(); PD_renderChips(); PD_renderPreviewTable(); }

let PD_SearchPattern = null; // compiled RegExp or null

function PD_searchColumns(raw) {
  const term = raw.trim();
  if (!term) {
    PD_SearchPattern = null;
  } else {
    // Convert glob wildcard (*) to regex .*; escape everything else
    const escaped = term.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
    try { PD_SearchPattern = new RegExp(escaped, 'i'); } catch { PD_SearchPattern = null; }
  }
  PD_renderChips();
}

function PD_clearSearch() {
  const inp = document.getElementById('PD_ColSearch');
  if (inp) inp.value = '';
  PD_SearchPattern = null;
  PD_renderChips();
}

function PD_renderChips() {
  const grid = document.getElementById('PD_ChipGrid');
  if (!grid) return;
  grid.innerHTML = PD_AllColumns.map(col => {
    const active    = PD_Selected.has(col);
    const safeCol   = col.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
    const highlight = PD_SearchPattern && PD_SearchPattern.test(col);
    const cls = ['pg-chip-sq', active ? 'active' : '', highlight ? 'pd-match' : ''].filter(Boolean).join(' ');
    const label = PD_Aliases[col] || col;
    const title = PD_Aliases[col] ? `${PD_Aliases[col]} (${col})` : col;
    return `<button type="button" class="${cls}" title="${title}" onclick="PD_toggleCol('${safeCol}',this)" ondblclick="PD_startAliasEdit('${safeCol}',this)">${label}</button>`;
  }).join('');
  const badge = document.getElementById('PD_SelCount');
  if (badge) badge.textContent = `${PD_Selected.size} selected`;
}

// ── Column lists — localStorage ───────────────────────────────────────────────
const PD_STORAGE_KEY = 'PD_ColumnLists';

function PD_getLists() {
  try { return JSON.parse(localStorage.getItem(PD_STORAGE_KEY) || '{}'); } catch { return {}; }
}

function PD_switchTab(tab) {
  ['view','save','delete','load'].forEach(t => {
    const btn   = document.getElementById('PD_Tab_' + t.charAt(0).toUpperCase() + t.slice(1));
    const panel = document.getElementById('PD_Panel_' + t.charAt(0).toUpperCase() + t.slice(1));
    if (btn)   btn.classList.toggle('active', t === tab);
    if (panel) panel.style.display = t === tab ? 'flex' : 'none';
  });
}

function PD_applyTemplate() {
  const name = document.getElementById('PD_ApplySelect')?.dataset.value || '';
  if (!name) { return; }
  const data = PD_getLists()[name];
  if (!data) { return; }
  PD_PendingLoad = data;

  const savedNames = data.column_names || [];
  if (!savedNames.length) {
    // No names saved — fall straight to number-based apply
    PD_applyByNumber();
    return;
  }

  const matched = savedNames.filter(c => PD_AllColumns.includes(c));
  const missing = savedNames.filter(c => !PD_AllColumns.includes(c));

  if (!missing.length) {
    // All matched — apply immediately
    PD_Selected = new Set(matched);
    PD_renderChips();
    PD_renderPreviewTable();
    ;
    return;
  }

  // Some missing — show report in modal
  const applyBtn    = document.getElementById('PD_ModalApplyBtn');
  const applyNumBtn = document.getElementById('PD_ModalApplyByNumBtn');
  if (applyBtn)    { applyBtn.textContent = `Apply Matched (${matched.length})`; applyBtn.style.display = ''; }
  if (applyNumBtn) applyNumBtn.style.display = '';

  const report = missing.map(c => `  ${c}`).join('\n');

  document.getElementById('PD_ModalTitle').textContent   = `Missing in current file (${missing.length})`;
  document.getElementById('PD_ModalContent').textContent = report;
  Popup_open('PD_Modal');

  // Store matched for apply
  PD_PendingLoad._matchedNames = matched;
}

function PD_applyByNumber() {
  if (!PD_PendingLoad) return;
  const resolved = (PD_PendingLoad.columns || []).map(i => PD_AllColumns[i - 1]).filter(c => c !== undefined);
  PD_Selected = new Set(resolved);
  PD_renderChips();
  PD_renderPreviewTable();
  PD_closeModal();
}


function PD_refreshListDropdowns() {
  const lists = PD_getLists();
  const names = Object.keys(lists);
  ['PD_LoadSelect','PD_ApplySelect','PD_RemoveSelect'].forEach(id => {
    const cs = document.getElementById(id);
    if (!cs) return;
    const optionsEl = cs.querySelector('.cs-options');
    const valueEl   = cs.querySelector('.cs-value');
    if (!optionsEl) return;
    const prev = cs.dataset.value || '';
    optionsEl.innerHTML = names.map(n =>
      `<div class="cs-option${n===prev?' cs-selected':''}" onclick="PD_csSelect('${id}','${n.replace(/'/g,"\\'")}',this)">${n}</div>`
    ).join('') || '<div class="cs-option" style="color:var(--dml-label);pointer-events:none;">No saved lists</div>';
    if (names.includes(prev) && valueEl) valueEl.textContent = prev;
    else if (valueEl) { valueEl.textContent = '— select —'; cs.dataset.value = ''; }
  });
}

function PD_csSelect(id, value, el) {
  const cs = document.getElementById(id);
  cs.dataset.value = value;
  cs.querySelector('.cs-value').textContent = value;
  cs.querySelectorAll('.cs-option').forEach(o => o.classList.remove('cs-selected'));
  el.classList.add('cs-selected');
  cs.classList.remove('open');
}

function PD_saveColumns() {
  const name = document.getElementById('PD_SaveName').value.trim();
  if (!name)                 { return; }
  if (!PD_Selected.size) { return; }
  const colIndices = PD_AllColumns
    .map((c, i) => PD_Selected.has(c) ? i + 1 : null)
    .filter(n => n !== null);
  const colNames = PD_AllColumns.filter(c => PD_Selected.has(c));
  const lists = PD_getLists();
  lists[name] = { name, file_header: PD_HasHeader, delimiter: PD_Delimiter, columns: colIndices, column_names: colNames };
  localStorage.setItem(PD_STORAGE_KEY, JSON.stringify(lists));
  document.getElementById('PD_SaveName').value = '';
  PD_refreshListDropdowns();
}

let PD_PendingLoad = null;

function PD_loadColumns() {
  const name = document.getElementById('PD_LoadSelect').dataset.value || '';
  if (!name) { return; }
  const data = PD_getLists()[name];
  if (!data) { return; }

  // View-only — just show the stored template data, no apply logic
  PD_PendingLoad = null;
  const display = {
    name:         data.name || name,
    file_header:  data.file_header !== false ? 'yes' : 'no',
    delimiter:    data.delimiter || 'auto',
    column_names: data.column_names || [],
    columns:      data.columns || []
  };
  const applyBtn    = document.getElementById('PD_ModalApplyBtn');
  const applyNumBtn = document.getElementById('PD_ModalApplyByNumBtn');
  if (applyBtn)    applyBtn.style.display    = 'none';
  if (applyNumBtn) applyNumBtn.style.display = 'none';

  document.getElementById('PD_ModalTitle').textContent   = name;
  document.getElementById('PD_ModalContent').textContent = JSON.stringify(display, null, 2);
  Popup_open('PD_Modal');
}

function PD_applyLoadedColumns() {
  if (!PD_PendingLoad) return;
  // Use matched names if available, otherwise fall back to column indices
  const cols = PD_PendingLoad._matchedNames
    ? PD_PendingLoad._matchedNames
    : (PD_PendingLoad.columns || []).map(i => PD_AllColumns[i - 1]).filter(c => c !== undefined);
  PD_Selected = new Set(cols);
  PD_renderChips();
  PD_renderPreviewTable();
  PD_closeModal();
}

function PD_closeModal() {
  Popup_close('PD_Modal');
  document.getElementById('PD_Modal')?.classList.remove('cm-context');
  PD_PendingLoad = null;
  const applyBtn    = document.getElementById('PD_ModalApplyBtn');
  const applyNumBtn = document.getElementById('PD_ModalApplyByNumBtn');
  if (applyBtn)    { applyBtn.textContent = 'Apply'; applyBtn.style.display = ''; }
  if (applyNumBtn) applyNumBtn.style.display = 'none';
}

function PD_deleteColumns() {
  const name = document.getElementById('PD_RemoveSelect').dataset.value || '';
  if (!name) { return; }
  if (!confirm('Delete column list "' + name + '"?')) return;
  const lists = PD_getLists();
  delete lists[name];
  localStorage.setItem(PD_STORAGE_KEY, JSON.stringify(lists));
  const cs = document.getElementById('PD_RemoveSelect');
  cs.dataset.value = '';
  cs.querySelector('.cs-value').textContent = '— select —';
  PD_refreshListDropdowns();
}



