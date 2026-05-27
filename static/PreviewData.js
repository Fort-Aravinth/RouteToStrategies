// ── Preview Data — DuckDB-WASM (no server required) ──────────────────────────

// ── Self-contained utilities (no Version01.js dependency) ────────────────────
function PD_showToast(message, type = 'success') {
  let container = document.getElementById('LD_ToastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'LD_ToastContainer';
    container.style.cssText = 'position:fixed;bottom:20px;right:20px;z-index:9999;display:flex;flex-direction:column;gap:8px;';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = 'LD_Toast ' + type;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => { toast.classList.add('hide'); setTimeout(() => toast.remove(), 300); }, 10000);
}

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

// ── State ─────────────────────────────────────────────────────────────────────
let PD_AllColumns     = [];
let PD_Selected       = new Set();
let PD_PreviewData    = { columns: [], data: [] };
let PD_HasHeader      = true;
let PD_UploadedFile   = null;
let PD_Delimiter      = 'auto';
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
  document.getElementById('PD_FilePath').value = file.name;
  event.target.value = '';
}

// ── Delimiter toggle ──────────────────────────────────────────────────────────
function PD_setDelim(val, btn) {
  PD_Delimiter = val;
  document.querySelectorAll('[id^="PD_Delim_"]').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const badge = document.getElementById('PD_DelimBadge');
  if (badge) badge.textContent = btn.textContent;
  if (PD_UploadedFile) PD_loadFile();
}

// ── Header toggle ─────────────────────────────────────────────────────────────
function PD_setHeader(val) {
  PD_HasHeader = val;
  document.getElementById('PD_BtnHeader').classList.toggle('active', val);
  document.getElementById('PD_BtnNoHeader').classList.toggle('active', !val);
  const badge = document.getElementById('PD_HeaderBadge');
  if (badge) badge.textContent = val ? 'Has Header' : 'No Header';
  if (PD_UploadedFile) PD_loadFile();
}

// ── Load file via DuckDB ──────────────────────────────────────────────────────
async function PD_loadFile() {
  if (!PD_UploadedFile) { PD_showToast('Select a file first', 'error'); return; }
  const tableEl = document.getElementById('PD_FullTable');
  if (tableEl) tableEl.innerHTML = '<p style="color:var(--color-text-muted);font-size:0.75rem;padding:10px;">Loading…</p>';

  try {
    const conn  = await PD_getDB();
    const fname = 'pd_' + PD_UploadedFile.name.replace(/[^a-zA-Z0-9._]/g, '_');
    await _db.registerFileHandle(fname, PD_UploadedFile, window.duckdb.DuckDBDataProtocol.BROWSER_FILEREADER, true);
    PD_RegisteredName = fname;

    const delim  = PD_Delimiter === 'auto' ? '' : `, delim='${PD_Delimiter}'`;
    const header = PD_HasHeader ? '' : ', header=false';
    const src    = `read_csv_auto('${fname}'${delim}${header})`;

    // Step 1: get columns + preview rows fast (no full scan)
    const schema  = await conn.query(`DESCRIBE SELECT * FROM ${src} LIMIT 0`);
    const cols    = schema.toArray().map(r => r.column_name);
    const preview = await conn.query(`SELECT * FROM ${src} LIMIT 5`);
    const rows    = preview.toArray().map(r => { const o = {}; cols.forEach(c => o[c] = r[c] ?? ''); return o; });

    PD_AllColumns  = cols;
    PD_PreviewData = { columns: cols, data: rows };

    // Show table immediately
    const badge = document.getElementById('PD_StatsBadge');
    if (badge) badge.textContent = `${cols.length} cols · counting…`;
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

    PD_Selected = new Set([...PD_Selected].filter(c => cols.includes(c)));
    PD_renderChips();
    PD_renderPreviewTable();

    // Step 2: count rows in background — doesn't block the UI
    conn.query(`SELECT COUNT(*) AS n FROM ${src}`).then(res => {
      const rowCount = Number(res.toArray()[0].n);
      if (badge) badge.textContent = `${rowCount.toLocaleString()} rows · ${cols.length} cols`;
      const el = document.getElementById('PD_RowCount');
      if (el) el.textContent = rowCount.toLocaleString();
    });

  } catch (e) {
    PD_showToast('Load failed: ' + e.message, 'error');
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
  if (!PD_RegisteredName) { PD_showToast('Load a file first', 'error'); return; }

  const nrows   = parseInt(document.getElementById('PD_NRows').value) || 10;
  const ordered = PD_AllColumns.filter(c => PD_Selected.has(c));
  if (container) container.innerHTML = '<p style="color:var(--color-text-muted);font-size:0.75rem;padding:10px;">Loading…</p>';

  try {
    const conn    = await PD_getDB();
    const delim   = PD_Delimiter === 'auto' ? '' : `, delim='${PD_Delimiter}'`;
    const header  = PD_HasHeader ? '' : ', header=false';
    const colList = ordered.map(c => `"${c.replace(/"/g,'""')}"`).join(', ');
    const res     = await conn.query(
      `SELECT ${colList} FROM read_csv_auto('${PD_RegisteredName}'${delim}${header}) LIMIT ${nrows}`
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
  if (!tableEl || !PD_PreviewData.columns.length) return;
  tableEl.innerHTML = PD_buildTable(PD_PreviewData.columns, PD_PreviewData.data, PD_Selected);
}

function PD_buildTable(cols, rows, selected = new Set()) {
  if (!cols || !cols.length) return '<p style="color:var(--dml-muted);font-size:0.75rem;padding:10px;">No data.</p>';
  const ths = cols.map(c => {
    const safe = c.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
    return `<th class="${selected.has(c) ? 'pg-col-selected' : ''}" onclick="PD_toggleColByName('${safe}')">${c}</th>`;
  }).join('');
  const trs = rows.map(r => '<tr>' + cols.map(c =>
    `<td${selected.has(c) ? ' class="pg-col-selected"' : ''} title="${String(r[c]??'').replace(/"/g,'&quot;')}">${r[c]??''}</td>`
  ).join('') + '</tr>').join('');
  return `<table class="pg-table"><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table>`;
}

// ── Column selection ──────────────────────────────────────────────────────────
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

function PD_selectAll() { PD_Selected = new Set(PD_AllColumns); PD_renderChips(); PD_renderPreviewTable(); }
function PD_clearAll()   { PD_Selected = new Set(); PD_renderChips(); PD_renderPreviewTable(); }

function PD_renderChips() {
  const grid = document.getElementById('PD_ChipGrid');
  if (!grid) return;
  grid.innerHTML = PD_AllColumns.map(col => {
    const active  = PD_Selected.has(col);
    const safeCol = col.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
    return `<button type="button" class="pg-chip-sq${active?' active':''}" onclick="PD_toggleCol('${safeCol}',this)">${col}</button>`;
  }).join('');
  const badge = document.getElementById('PD_SelCount');
  if (badge) badge.textContent = `${PD_Selected.size} selected`;
}

// ── Column lists — localStorage ───────────────────────────────────────────────
const PD_STORAGE_KEY = 'PD_ColumnLists';

function PD_getLists() {
  try { return JSON.parse(localStorage.getItem(PD_STORAGE_KEY) || '{}'); } catch { return {}; }
}

function PD_refreshListDropdowns() {
  const lists = PD_getLists();
  const names = Object.keys(lists);
  ['PD_LoadSelect','PD_RemoveSelect'].forEach(id => {
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
  if (!name)                 { PD_showToast('Enter a name', 'error'); return; }
  if (!PD_Selected.size) { PD_showToast('No columns selected', 'error'); return; }
  const colIndices = PD_AllColumns
    .map((c, i) => PD_Selected.has(c) ? i + 1 : null)
    .filter(n => n !== null);
  const lists = PD_getLists();
  lists[name] = { name, file_header: PD_HasHeader, delimiter: PD_Delimiter, columns: colIndices };
  localStorage.setItem(PD_STORAGE_KEY, JSON.stringify(lists));
  document.getElementById('PD_SaveName').value = '';
  PD_showToast('Saved: ' + name, 'success');
  PD_refreshListDropdowns();
}

let PD_PendingLoad = null;

function PD_loadColumns() {
  const name = document.getElementById('PD_LoadSelect').dataset.value || '';
  if (!name) { PD_showToast('Select a list', 'error'); return; }
  const data = PD_getLists()[name];
  if (!data) { PD_showToast('List not found', 'error'); return; }
  PD_PendingLoad = data;
  const display = {
    name:        data.name || name,
    file_header: data.file_header !== false ? 'yes' : 'no',
    delimiter:   data.delimiter || 'auto',
    columns:     data.columns || []
  };
  document.getElementById('PD_ModalTitle').textContent   = name;
  document.getElementById('PD_ModalContent').textContent = JSON.stringify(display, null, 2);
  document.getElementById('PD_Modal').style.display      = 'flex';
}

function PD_applyLoadedColumns() {
  if (!PD_PendingLoad) return;
  const resolved = (PD_PendingLoad.columns || []).map(i => PD_AllColumns[i - 1]).filter(c => c !== undefined);
  PD_Selected = new Set(resolved);
  PD_renderChips();
  PD_renderPreviewTable();
  PD_closeModal();
  PD_showToast('Loaded: ' + PD_Selected.size + ' cols matched', 'success');
}

function PD_closeModal() {
  document.getElementById('PD_Modal').style.display = 'none';
  PD_PendingLoad = null;
}

function PD_deleteColumns() {
  const name = document.getElementById('PD_RemoveSelect').dataset.value || '';
  if (!name) { PD_showToast('Select a list', 'error'); return; }
  if (!confirm('Delete column list "' + name + '"?')) return;
  const lists = PD_getLists();
  delete lists[name];
  localStorage.setItem(PD_STORAGE_KEY, JSON.stringify(lists));
  const cs = document.getElementById('PD_RemoveSelect');
  cs.dataset.value = '';
  cs.querySelector('.cs-value').textContent = '— select —';
  PD_showToast('Deleted: ' + name, 'success');
  PD_refreshListDropdowns();
}
