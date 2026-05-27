// ── Load Data — DuckDB-WASM (no server required) ──────────────────────────────

// ── Self-contained utilities ──────────────────────────────────────────────────
function LD_showToast(message, type = 'success') {
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

// ── DuckDB shared instance ────────────────────────────────────────────────────
// Reuses window.duckdb + window._LD_db so PD and LD share the same engine
let _LD_db   = null;
let _LD_conn = null;

async function LD_getDB() {
  if (_LD_db) return _LD_conn;
  if (!window.duckdb) {
    const mod = await import('https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm/+esm');
    window.duckdb = mod;
  }
  const duck = window.duckdb;
  const JSDELIVR = 'https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@latest/dist/';
  const bundles = {
    mvp: { mainModule: JSDELIVR + 'duckdb-mvp.wasm', mainWorker: JSDELIVR + 'duckdb-browser-mvp.worker.js' },
    eh:  { mainModule: JSDELIVR + 'duckdb-eh.wasm',  mainWorker: JSDELIVR + 'duckdb-browser-eh.worker.js'  },
  };
  const bundle = await duck.selectBundle(bundles);
  const workerBlob = new Blob([`importScripts('${bundle.mainWorker}');`], { type: 'application/javascript' });
  const worker = new Worker(URL.createObjectURL(workerBlob));
  const logger = new duck.ConsoleLogger();
  _LD_db = new duck.AsyncDuckDB(logger, worker);
  await _LD_db.instantiate(bundle.mainModule);
  _LD_conn = await _LD_db.connect();
  return _LD_conn;
}

// ── State ─────────────────────────────────────────────────────────────────────
let LD_UploadedFile   = null;
let LD_RegisteredName = null;
let LD_FileDelimiter  = 'auto';
let LD_FileHasHeader  = true;

// Expose globally so other views can query the loaded data
window.LD_getSource = function() {
  return LD_RegisteredName ? 'ld_raw' : null;
};
window.LD_getConn = () => _LD_conn;
window.LD_getDB_fn = LD_getDB;

// ── Open view ─────────────────────────────────────────────────────────────────
function LD_OpenPanel() {
  if (typeof App_HideAllViews === 'function') App_HideAllViews();
  else document.querySelectorAll('.pg-layout,[id$="View"]').forEach(el => el.style.display = 'none');
  if (typeof Sidebar_SetActive === 'function') Sidebar_SetActive('nav-load-data');
  else {
    document.querySelectorAll('.sidebar-item').forEach(el => el.classList.remove('active'));
    const el = document.getElementById('nav-load-data');
    if (el) el.classList.add('active');
  }
  const main = document.querySelector('main.main');
  if (main) { main.style.display = 'flex'; main.style.visibility = 'visible'; main.scrollTop = 0; }
  document.documentElement.style.setProperty('--toast-brand', 'var(--brand-sp)');
  document.getElementById('LDView').style.removeProperty('display');
  LD_SetLockState(LD_RegisteredName ? 'loaded' : 'empty');
  LD_LoadTemplates();
  LD_PopulateReviewedDropdown();
}

// ── Nav lock — enforce Load → CM → everything else flow ──────────────────────
// Unlocked by SP Apply Parameters
const _LD_NAV_LOCK_IDS = ['nav-overview'];
// Unlocked later (Score Analysis, Rule Management etc — not yet implemented)
const _LD_ANALYSIS_LOCK_IDS = [
  'nav-score-analysis','nav-route-analysis','nav-individual-analysis',
  'nav-policy-rules','nav-rmon-import',
];
// Unlocked when data loads (CM becomes accessible)
const _LD_CM_LOCK_IDS = ['nav-cm-template-row'];
// Unlocked only after CM Apply Changes
const _LD_SP_LOCK_IDS = ['nav-parameters', 'SP_SidebarPreset_Row'];

function LD_LockNavToColumnMgmt() {
  const cm = document.getElementById('nav-column-mgmt');
  if (cm) { cm.classList.add('ld-locked'); cm.setAttribute('data-nav-locked','1'); }
  _LD_NAV_LOCK_IDS.forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.classList.add('ld-locked'); el.setAttribute('data-nav-locked','1'); }
  });
}

function LD_UnlockColumnMgmt() {
  ['nav-column-mgmt', ..._LD_CM_LOCK_IDS].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.classList.remove('ld-locked'); el.removeAttribute('data-nav-locked'); }
  });
}

window.LD_UnlockSP = function() {
  _LD_SP_LOCK_IDS.forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.classList.remove('ld-locked'); el.removeAttribute('data-nav-locked'); }
  });
};

window.LD_UnlockNav = function() {
  _LD_NAV_LOCK_IDS.forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.classList.remove('ld-locked', 'sidebar-item-disabled'); el.removeAttribute('data-nav-locked'); }
  });
};

// ── Lock state ────────────────────────────────────────────────────────────────
// empty   → only dropzone active
// selected → post-select controls unlock (chips, header, upload btn)
// loaded  → everything unlocks
function LD_SetLockState(state) {
  const lock   = el => el && el.classList.add('ld-locked');
  const unlock = el => el && el.classList.remove('ld-locked');
  const postSel    = document.getElementById('LD_PostSelectGroup');
  const postUpload = document.getElementById('LD_PostUploadGroup');
  const tplRow     = document.getElementById('LD_TemplatesRow');
  if (state === 'empty') {
    lock(postSel); lock(postUpload); lock(tplRow);
  } else if (state === 'selected') {
    unlock(postSel); lock(postUpload); lock(tplRow);
  } else {
    unlock(postSel); unlock(postUpload); unlock(tplRow);
  }
}

// ── File chooser / drag-drop ──────────────────────────────────────────────────
function LD_ChooseFile() {
  document.getElementById('LD_FileInput').click();
}

document.addEventListener('DOMContentLoaded', () => {
  // Lock CM + CM template row + SP + everything after it by default on page load
  ['nav-column-mgmt', ..._LD_CM_LOCK_IDS, ..._LD_SP_LOCK_IDS, ..._LD_NAV_LOCK_IDS, ..._LD_ANALYSIS_LOCK_IDS].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.classList.add('ld-locked'); el.setAttribute('data-nav-locked','1'); }
  });

  const input = document.getElementById('LD_FileInput');
  if (input) input.addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    LD_UploadedFile = file;
    const nameEl = document.getElementById('LD_FileName');
    const sizeEl = document.getElementById('LD_FileSize');
    if (nameEl) nameEl.textContent = file.name + ' · ';
    if (sizeEl) sizeEl.textContent = (file.size / 1024).toFixed(1) + ' KB';
    e.target.value = '';
    LD_SetLockState('selected');
  });
});

function LD_HandleDragOver(e)  { e.preventDefault(); document.getElementById('LD_DropZone').classList.add('drag-over'); }
function LD_HandleDragLeave(e) { document.getElementById('LD_DropZone').classList.remove('drag-over'); }
function LD_HandleFileDrop(e) {
  e.preventDefault();
  document.getElementById('LD_DropZone').classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (!file) return;
  LD_UploadedFile = file;
  const nameEl = document.getElementById('LD_FileName');
  const sizeEl = document.getElementById('LD_FileSize');
  if (nameEl) nameEl.textContent = file.name;
  if (sizeEl) sizeEl.textContent = (file.size / 1024).toFixed(1) + ' KB';
  LD_SetLockState('selected');
}

// ── Delimiter toggles ─────────────────────────────────────────────────────────
function LD_SetDelimiter3(btn, val) {
  LD_FileDelimiter = val;
  document.querySelectorAll('#LDView .pg-card:first-child .pg-chip').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const hidden = document.getElementById('LD_Delimiter');
  if (hidden) hidden.value = val;
}

function LD_SetDelimiter4(btn, val) {
  document.querySelectorAll('#LD_ReprocessCard .pg-chip').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const hidden = document.getElementById('LD_ReprocessDelimiter');
  if (hidden) hidden.value = val;
}

// ── Upload & Process ──────────────────────────────────────────────────────────
async function LD_UploadFile() {
  if (!LD_UploadedFile) { LD_showToast('No file selected', 'error'); return; }
  LD_showToast('Loading file…', 'info');
  try {
    const conn   = await LD_getDB();
    const fname  = 'ld_' + LD_UploadedFile.name.replace(/[^a-zA-Z0-9._]/g, '_');
    const hasHeader = document.getElementById('LD_HeaderCheckbox')?.checked ?? true;
    LD_FileHasHeader = hasHeader;
    await _LD_db.registerFileHandle(fname, LD_UploadedFile, window.duckdb.DuckDBDataProtocol.BROWSER_FILEREADER, true);
    LD_RegisteredName = fname;

    const delim  = LD_FileDelimiter === 'auto' ? '' : `, delim='${LD_FileDelimiter}'`;
    const header = hasHeader ? '' : ', header=false';
    const csvSrc = `read_csv_auto('${fname}'${delim}${header}, ignore_errors=true)`;

    // Step 1: get column count fast (no full scan)
    const schema = await conn.query(`DESCRIBE SELECT * FROM ${csvSrc} LIMIT 0`);
    const cols   = schema.toArray().length;

    document.getElementById('LD_Rows').textContent = '…';
    document.getElementById('LD_Rows').classList.remove('empty');
    document.getElementById('LD_Cols').textContent = cols;
    document.getElementById('LD_Cols').classList.remove('empty');

    const pathVal = document.getElementById('LD_PathValue');
    if (pathVal) pathVal.textContent = LD_UploadedFile.name;

    LD_showToast(`Building ld_raw table…`, 'info');

    // Step 2: materialise into ld_raw table (detaches from CSV file)
    await conn.query(`CREATE OR REPLACE TABLE ld_raw AS SELECT * FROM ${csvSrc}`);
    const countRes = await conn.query(`SELECT COUNT(*) AS n FROM ld_raw`);
    const rows = Number(countRes.toArray()[0].n);
    document.getElementById('LD_Rows').textContent = rows.toLocaleString();
    LD_SetLockState('loaded');
    LD_LockNavToColumnMgmt();
    LD_UnlockColumnMgmt();
    LD_showToast(`Ready: ${rows.toLocaleString()} rows · ${cols} cols`, 'success');
  } catch (e) {
    LD_showToast('Load failed: ' + e.message, 'error');
  }
}

// ── Re-process ────────────────────────────────────────────────────────────────
async function LD_ReprocessFile() {
  if (!LD_UploadedFile) { LD_showToast('No file loaded yet', 'error'); return; }
  const delVal   = document.getElementById('LD_ReprocessDelimiter')?.value || 'auto';
  const hasHeader = document.getElementById('LD_ReprocessHeader')?.checked ?? true;
  LD_FileDelimiter = delVal;
  LD_FileHasHeader = hasHeader;
  LD_showToast('Re-processing…', 'info');
  try {
    const conn   = await LD_getDB();
    const delim  = delVal === 'auto' ? '' : `, delim='${delVal}'`;
    const hdr    = hasHeader ? '' : ', header=false';
    const csvSrc = `read_csv_auto('${LD_RegisteredName}'${delim}${hdr}, ignore_errors=true)`;

    await conn.query(`CREATE OR REPLACE TABLE ld_raw AS SELECT * FROM ${csvSrc}`);
    const countRes = await conn.query(`SELECT COUNT(*) AS n FROM ld_raw`);
    const rows     = Number(countRes.toArray()[0].n);
    const schema   = await conn.query(`DESCRIBE SELECT * FROM ld_raw LIMIT 0`);
    const cols     = schema.toArray().length;

    document.getElementById('LD_Rows').textContent = rows.toLocaleString();
    document.getElementById('LD_Cols').textContent = cols;
    LD_showToast(`Re-processed: ${rows.toLocaleString()} rows · ${cols} cols`, 'success');
  } catch (e) {
    LD_showToast('Re-process failed: ' + e.message, 'error');
  }
}

// ── Templates — localStorage ──────────────────────────────────────────────────
const LD_TEMPLATES_KEY = 'DMTemplates';

function _LD_GetTemplates() {
  try { return JSON.parse(localStorage.getItem(LD_TEMPLATES_KEY) || '{}'); } catch { return {}; }
}

function LD_LoadTemplates() {
  const templates = _LD_GetTemplates();
  const names = Object.keys(templates);
  ['LD_LoadTemplate', 'LD_RemoveTemplate'].forEach(id => {
    const cs = document.getElementById(id);
    if (!cs) return;
    const optionsEl = cs.querySelector('.cs-options');
    const valueEl   = cs.querySelector('.cs-value');
    if (!optionsEl) return;
    optionsEl.innerHTML = names.map(n =>
      `<div class="cs-option" onclick="LD_csSelect('${id}','${n.replace(/'/g,"\\'")}',this)">${n}</div>`
    ).join('') || '<div class="cs-option" style="color:var(--dml-label);pointer-events:none;">No saved templates</div>';
    if (valueEl && !names.includes(cs.dataset.value || '')) {
      valueEl.textContent = id === 'LD_LoadTemplate' ? 'Select a saved template...' : 'Select a template to delete...';
      cs.dataset.value = '';
    }
  });

}

function LD_csSelect(id, value, el) {
  const cs = document.getElementById(id);
  if (!cs) return;
  cs.dataset.value = value;
  cs.querySelector('.cs-value').textContent = value;
  cs.querySelectorAll('.cs-option').forEach(o => o.classList.remove('cs-selected'));
  el.classList.add('cs-selected');
  cs.classList.remove('open');
}

function LD_SaveTemplate() {
  const name = document.getElementById('LD_SaveName')?.value.trim();
  if (!name) { LD_showToast('Enter a template name', 'error'); return; }
  const templates = _LD_GetTemplates();
  templates[name] = {
    name,
    file_name:  LD_UploadedFile?.name || '',
    delimiter:  LD_FileDelimiter,
    has_header: LD_FileHasHeader,
  };
  localStorage.setItem(LD_TEMPLATES_KEY, JSON.stringify(templates));
  document.getElementById('LD_SaveName').value = '';
  LD_showToast('Saved: ' + name, 'success');
  LD_LoadTemplates();
}

function LD_ApplyTemplate() {
  const name = document.getElementById('LD_LoadTemplate')?.dataset.value || '';
  if (!name) { LD_showToast('Select a template', 'error'); return; }
  const data = _LD_GetTemplates()[name];
  if (!data) { LD_showToast('Template not found', 'error'); return; }

  LD_FileDelimiter = data.delimiter || 'auto';
  LD_FileHasHeader = data.has_header !== false;

  const hdrBox = document.getElementById('LD_HeaderCheckbox');
  if (hdrBox) hdrBox.checked = LD_FileHasHeader;

  LD_showToast(`Template "${name}" applied — select the file then click Upload & Process`, 'info');
}

function LD_RemoveTemplate() {
  const name = document.getElementById('LD_RemoveTemplate')?.dataset.value || '';
  if (!name) { LD_showToast('Select a template', 'error'); return; }
  if (!confirm(`Delete template "${name}"?`)) return;
  const templates = _LD_GetTemplates();
  delete templates[name];
  localStorage.setItem(LD_TEMPLATES_KEY, JSON.stringify(templates));
  LD_showToast('Deleted: ' + name, 'success');
  LD_LoadTemplates();
}

// ── Upload Reviewed (with PD column filter) ───────────────────────────────────
function LD_PopulateReviewedDropdown() {
  const cs = document.getElementById('LD_ReviewedSelect');
  if (!cs) return;
  const optionsEl = cs.querySelector('.cs-options');
  if (!optionsEl) return;
  try {
    const lists = JSON.parse(localStorage.getItem('PD_ColumnLists') || '{}');
    const names = Object.keys(lists);
    optionsEl.innerHTML = names.map(n =>
      `<div class="cs-option" onclick="LD_csSelect('LD_ReviewedSelect','${n.replace(/'/g,"\\'")}',this)">${n}</div>`
    ).join('') || '<div class="cs-option" style="color:var(--dml-label);pointer-events:none;">No PD column lists saved</div>';
  } catch { optionsEl.innerHTML = ''; }
}

async function LD_UploadReviewedFile() {
  if (!LD_UploadedFile) { LD_showToast('No file selected', 'error'); return; }
  const name = document.getElementById('LD_ReviewedSelect')?.dataset.value || '';
  if (!name) { LD_showToast('Select a column list first', 'error'); return; }

  let colIndices;
  try {
    const lists = JSON.parse(localStorage.getItem('PD_ColumnLists') || '{}');
    colIndices = lists[name]?.columns || [];
  } catch { colIndices = []; }
  if (!colIndices.length) { LD_showToast('Column list is empty', 'error'); return; }

  LD_showToast('Loading with column filter…', 'info');
  try {
    const conn   = await LD_getDB();
    const fname  = 'ld_' + LD_UploadedFile.name.replace(/[^a-zA-Z0-9._]/g, '_');
    const hasHeader = document.getElementById('LD_HeaderCheckbox')?.checked ?? true;
    LD_FileHasHeader = hasHeader;
    await _LD_db.registerFileHandle(fname, LD_UploadedFile, window.duckdb.DuckDBDataProtocol.BROWSER_FILEREADER, true);

    const delim   = LD_FileDelimiter === 'auto' ? '' : `, delim='${LD_FileDelimiter}'`;
    const hdr     = hasHeader ? '' : ', header=false';
    const csvSrc  = `read_csv_auto('${fname}'${delim}${hdr}, ignore_errors=true)`;

    // Get all column names first
    const schema = await conn.query(`DESCRIBE SELECT * FROM ${csvSrc} LIMIT 0`);
    const allCols = schema.toArray().map(r => r.column_name);

    // Map 1-based indices to column names
    const selectedCols = colIndices.map(i => allCols[i - 1]).filter(c => c !== undefined);
    if (!selectedCols.length) { LD_showToast('No matching columns found', 'error'); return; }

    const colList = selectedCols.map(c => `"${c.replace(/"/g,'""')}"`).join(', ');

    // Materialise filtered columns into ld_raw table
    await conn.query(`CREATE OR REPLACE TABLE ld_raw AS SELECT ${colList} FROM ${csvSrc}`);
    LD_RegisteredName = fname;

    const countRes = await conn.query(`SELECT COUNT(*) AS n FROM ld_raw`);
    const rows = Number(countRes.toArray()[0].n);

    document.getElementById('LD_Rows').textContent = rows.toLocaleString();
    document.getElementById('LD_Rows').classList.remove('empty');
    document.getElementById('LD_Cols').textContent = selectedCols.length;
    document.getElementById('LD_Cols').classList.remove('empty');

    const pathVal = document.getElementById('LD_PathValue');
    if (pathVal) pathVal.textContent = LD_UploadedFile.name + ' [' + name + ']';

    LD_SetLockState('loaded');
    LD_LockNavToColumnMgmt();
    LD_UnlockColumnMgmt();
    LD_showToast(`Loaded: ${rows.toLocaleString()} rows · ${selectedCols.length} cols (filtered)`, 'success');
  } catch (e) {
    LD_showToast('Load failed: ' + e.message, 'error');
  }
}

// ── Tab switcher ──────────────────────────────────────────────────────────────
function LD_switchTab(tab) {
  ['load', 'remove', 'saverename'].forEach(t => {
    const cap   = t.charAt(0).toUpperCase() + t.slice(1);
    const btn   = document.getElementById('LD_Tab_' + cap);
    const panel = document.getElementById('LD_Panel_' + cap);
    if (btn)   btn.classList.toggle('active', t === tab);
    if (panel) panel.classList.toggle('active', t === tab);
  });
}
