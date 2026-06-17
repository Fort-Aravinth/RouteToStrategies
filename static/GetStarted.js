// ── Get Started ───────────────────────────────────────────────────────────────

// ── GS Toast System (isolated from Playground TT toasts) ─────────────────────
function GS_getToastContainer() {
  let c = document.getElementById('GS_ToastContainer');
  if (!c) {
    c = document.createElement('div');
    c.id = 'GS_ToastContainer';
    document.body.appendChild(c);
  }
  return c;
}

function GS_toast_card(id, title, body, tabLabel) {
  const lbl = tabLabel || title;
  return `
    <div class="gs-toast" id="${id}">
      <div class="gs-tab-strip" onclick="GS_toast_tabExpand('${id}')" title="Expand">
        <span class="gs-tab-arrow">›</span>
        <span class="gs-tab-label">${lbl}</span>
      </div>
      <div class="gs-toast-inner">
        <div class="gs-toast-header">
          <div class="gs-toast-title">${title}</div>
          <button class="gs-toast-btn-collapse" onclick="GS_toast_tabCollapse('${id}')" title="Collapse to tab">
            <svg viewBox="0 0 16 16" width="10" height="10" fill="none"><path d="M10 3H13V13H10M6 8H2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
        </div>
        <div class="gs-toast-body">${body}</div>
      </div>
    </div>`;
}

function GS_toast_tabCollapse(id) {
  const el = document.getElementById(id);
  if (!el) return;
  const rect = el.getBoundingClientRect();
  el.style.top    = '';
  el.style.bottom = (window.innerHeight - rect.bottom) + 'px';
  el.classList.add('gs-tabbed');
  const strip = el.querySelector('.gs-tab-strip');
  if (strip) strip.style.height = rect.height + 'px';
}

function GS_toast_tabExpand(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.style.top = el.style.bottom = '';
  el.classList.remove('gs-tabbed');
}

function GS_toast_dismiss() {
  const c = document.getElementById('GS_ToastContainer');
  if (c) c.innerHTML = '';
}

// ── Error badge ───────────────────────────────────────────────────────────────
function GS_showErrorBadge(msg) {
  let el = document.getElementById('GS_DataReadyBadge');
  if (!el) {
    el = document.createElement('div');
    el.id = 'GS_DataReadyBadge';
    el.className = 'App_badge';
    document.body.appendChild(el);
  }
  el.style.borderLeftColor = '#ef4444';
  el.innerHTML = `
    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" style="flex-shrink:0;color:#ef4444">
      <circle cx="8" cy="8" r="6.5" stroke="currentColor" stroke-width="1.5"/>
      <path d="M5.5 5.5l5 5M10.5 5.5l-5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    </svg>
    <span style="color:#ef4444">${msg}</span>
    <button onclick="document.getElementById('GS_DataReadyBadge').remove()">✕</button>`;
}

// ── Loading badge ─────────────────────────────────────────────────────────────
function GS_showLoadingBadge(msg) {
  let el = document.getElementById('GS_DataReadyBadge');
  if (!el) {
    el = document.createElement('div');
    el.id = 'GS_DataReadyBadge';
    el.className = 'App_badge';
    document.body.appendChild(el);
  }
  el.innerHTML = `
    <svg viewBox="0 0 16 16" width="14" height="14" style="flex-shrink:0;animation:GS_spin 1s linear infinite;color:var(--brand-pt,#0D9488)">
      <circle cx="8" cy="8" r="5.5" stroke="currentColor" stroke-width="1.5" stroke-dasharray="22" stroke-dashoffset="8" fill="none"/>
    </svg>
    <span>${msg}</span>`;
}

// ── Data-ready badge (persists across all pages) ─────────────────────────────
function GS_showDataReadyBadge(rows, cols, secs) {
  let el = document.getElementById('GS_DataReadyBadge');
  if (!el) {
    el = document.createElement('div');
    el.id = 'GS_DataReadyBadge';
    el.className = 'App_badge';
    document.body.appendChild(el);
  }
  el.innerHTML = `
    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" style="flex-shrink:0;color:var(--brand-pt,#0D9488)">
      <circle cx="8" cy="8" r="6.5" stroke="currentColor" stroke-width="1.5"/>
      <path d="M5 8l2 2 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
    <span><strong>Data ready</strong> &nbsp;·&nbsp; ${rows.toLocaleString()} rows &nbsp;·&nbsp; ${cols} cols &nbsp;·&nbsp; ${secs}s</span>
    <button onclick="document.getElementById('GS_DataReadyBadge').remove()">✕</button>`;
}

// ── Browser console logger ────────────────────────────────────────────────────
function GS_log(msg)        { console.log('[GS]', msg); }
function GS_logGroup(title) { console.groupCollapsed('[GS]', title); }
function GS_logGroupEnd()   { console.groupEnd(); }

let GS_ToastsEnabled = false;

function GS_enableToasts() { GS_ToastsEnabled = true; }

const _GS_TOUR_STEPS = [
  { title: 'Upload File',       body: 'Drop your CSV, TSV or TXT file onto the Upload File card — or click <strong>Choose File</strong> to browse.' },
  { title: 'Choose Delimiter',  body: 'Select how columns are separated in your file. Use <strong>Auto</strong> if you\'re not sure — it detects the format automatically.' },
  { title: 'Header Row',        body: 'Tell us if row 1 contains column names (<strong>Has Header</strong>) or if row 1 is already data (<strong>No Header</strong>).' },
  { title: 'Select Columns',    body: 'Choose which columns to keep. Rename them, change their type, and set formats using the buttons in <strong>Column Config</strong>.' },
  { title: 'Save Your Config',  body: 'Give your setup a name and click <strong>Save</strong> in Column Config. Load it anytime from the <strong>Saved Configs</strong> sidebar dropdown.' },
];
let _GS_tourStep = 0;

function GS_tourShow(step) {
  _GS_tourStep = step;
  const s     = _GS_TOUR_STEPS[step];
  if (!s) { GS_tourDismiss(); return; }
  const total = _GS_TOUR_STEPS.length;
  let el = document.getElementById('GS_TourCard');
  if (!el) {
    el = document.createElement('div');
    el.id = 'GS_TourCard';
    el.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:99998;';
    document.body.appendChild(el);
  }
  el.innerHTML = `
    <div class="gs-toast" id="GS_TourInner">
      <div class="gs-tab-strip" onclick="GS_tourTabExpand()" title="Expand">
        <span class="gs-tab-arrow">›</span>
        <span class="gs-tab-label">Step ${step+1} of ${total}</span>
      </div>
      <div class="gs-toast-inner">
        <div class="gs-toast-header">
          <div>
            <div class="gs-toast-step">Step ${step+1} of ${total}</div>
            <div class="gs-toast-title">${s.title}</div>
          </div>
          <button class="gs-toast-btn-collapse" onclick="GS_tourTabCollapse()" title="Collapse to tab">
            <svg viewBox="0 0 16 16" width="10" height="10" fill="none"><path d="M10 3H13V13H10M6 8H2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
        </div>
        <div class="gs-toast-body">${s.body}</div>
        <div class="gs-toast-actions">
          <button class="gs-toast-btn-back" onclick="GS_tourShow(_GS_tourStep - 1)" style="${step === 0 ? 'visibility:hidden;' : ''}">← Back</button>
          <button class="gs-toast-btn-next" onclick="GS_tourNext()">${step+1 < total ? 'Next →' : 'Finish ✓'}</button>
        </div>
      </div>
    </div>`;
}

function GS_tourTabCollapse() {
  const el = document.getElementById('GS_TourInner');
  if (!el) return;
  const rect = el.getBoundingClientRect();
  el.style.top    = '';
  el.style.bottom = (window.innerHeight - rect.bottom) + 'px';
  el.classList.add('gs-tabbed');
  const strip = el.querySelector('.gs-tab-strip');
  if (strip) strip.style.height = rect.height + 'px';
}

function GS_tourTabExpand() {
  const el = document.getElementById('GS_TourInner');
  if (!el) return;
  el.style.top = el.style.bottom = '';
  el.classList.remove('gs-tabbed');
}

function GS_tourNext() { GS_tourShow(_GS_tourStep + 1); }

function GS_tourDismiss() {
  document.getElementById('GS_TourCard')?.remove();
  _GS_tourMinimised = false;
}

function GS_StepToast(title, body) {
  GS_log(`Tour step → ${title}`, 'step');
  if (!GS_ToastsEnabled) return;
  const idx = _GS_TOUR_STEPS.findIndex(s => s.title === title || title.includes(s.title.split(' ')[0]));
  GS_tourShow(idx >= 0 ? idx : _GS_tourStep);
}

// ── GS Tutorial button ────────────────────────────────────────────────────────
function GS_HelpPrompt() {
  GS_ToastsEnabled = !GS_ToastsEnabled;
  const btn = document.getElementById('GS_HelpBtn');
  if (btn) btn.classList.toggle('tutorial-active', GS_ToastsEnabled);
  if (GS_ToastsEnabled) {
    GS_toast_dismiss();
    GS_log('Tutorial started', 'step');
    GS_tourShow(0);
  } else {
    GS_toast_dismiss();
    GS_tourDismiss();
    GS_log('Tutorial dismissed', 'info');
  }
}

function GS_Open() {
  GS_log('Navigated to Get Started', 'step');
  document.body.classList.remove('gs-active');
  if (typeof App_HideAllViews === 'function') App_HideAllViews();
  if (typeof Sidebar_SetActive === 'function') Sidebar_SetActive('nav-get-started');
  const main = document.querySelector('main.main');
  if (main) { main.style.display = 'flex'; main.style.visibility = 'visible'; main.scrollTop = 0; }
  document.getElementById('GSView').style.removeProperty('display');
  GS_refreshSidebarConfigs();
  GS_toast_dismiss();
  document.body.classList.add('gs-active');
  if (typeof GS_ResumeToast === 'function') GS_ResumeToast();
}

function GS_refreshSidebarConfigs() {
  const cs = document.getElementById('GS_SidebarConfig');
  if (!cs) return;
  const optionsEl = cs.querySelector('.cs-options');
  const valueEl   = cs.querySelector('.cs-value');
  if (!optionsEl) return;
  try {
    const store = JSON.parse(localStorage.getItem(GS_STORAGE_KEY) || '{}');
    const names = Object.keys(store);
    optionsEl.innerHTML = names.map(n =>
      `<div class="cs-option" onclick="GS_sidebarConfigSelect('${n.replace(/'/g,"\\'")}',this)">${n}</div>`
    ).join('') || '<div class="cs-option" style="color:var(--dml-label);pointer-events:none;">No saved configs</div>';
    if (valueEl) valueEl.textContent = 'Saved Configs';
    cs.dataset.value = '';
  } catch(e) {}
}

function GS_sidebarConfigSelect(name, el) {
  GS_log(`Sidebar config selected: "${name}"`, 'step');
  const cs = document.getElementById('GS_SidebarConfig');
  if (cs) { cs.dataset.value = name; const v = cs.querySelector('.cs-value'); if (v) v.textContent = name; cs.classList.remove('open'); }
  const inp = document.getElementById('GS_SaveName');
  if (inp) inp.value = name;
  GS_startSidebarLoad();
}

// ── Lock helpers ─────────────────────────────────────────────────────────────
function GS_lock(id)   { const el = document.getElementById(id); if (el) el.classList.add('ld-locked'); }
function GS_unlock(id) { const el = document.getElementById(id); if (el) el.classList.remove('ld-locked'); }

document.addEventListener('DOMContentLoaded', () => {
  GS_logGroup('Get Started — page load');
  const hasConfigs = Object.keys(JSON.parse(localStorage.getItem('GS_Configs') || '{}')).length;
  GS_log(`Saved configs in localStorage: ${hasConfigs}`, hasConfigs ? 'success' : 'info');
  GS_log('Cards locked: DelimCard, HeaderCard, SaveCard, SelectorCard, PreviewCard', 'info');
  GS_logGroupEnd();

  GS_lock('GS_DelimCard');
  GS_lock('GS_HeaderCard');
  GS_lock('GS_SaveCard');
  GS_lock('GS_SelectorCard');
  GS_lock('GS_PreviewCard');
  GS_refreshSidebarConfigs();
});

// ── Upload File ───────────────────────────────────────────────────────────────
let GS_UploadedFile = null;

function GS_onFilePicked(event) {
  const file = event.target.files[0];
  if (!file) return;
  GS_UploadedFile = file;
  _GS_setFileLabel(file);
  event.target.value = '';
  GS_IsParquet = file.name.toLowerCase().endsWith('.parquet');
  GS_logGroup(`File uploaded: ${file.name} (${(file.size/1024).toFixed(1)} KB)`);
  if (GS_IsParquet) {
    GS_log('Parquet file — skipping delimiter/header', 'info');
    GS_logGroupEnd();
    GS_lock('GS_DelimCard');
    GS_lock('GS_HeaderCard');
    GS_unlock('GS_BtnLoad');
    GS_unlock('GS_BtnLoadLoad');
    GS_HasHeader = true;
    GS_HeaderSet = true;
    GS_loadFile();
  } else {
    GS_log('Unlocking: DelimCard', 'info');
    GS_logGroupEnd();
    GS_unlock('GS_DelimCard');
    GS_unlock('GS_BtnLoad');
    GS_unlock('GS_BtnLoadLoad');
    if (typeof GS_StepToast === 'function') GS_StepToast('📂 File loaded', 'Now choose how your columns are separated — try <strong>Auto</strong> if you\'re not sure.');
  }
}

function _GS_setFileLabel(file) {
  const nameEl = document.getElementById('GS_FileName');
  const sizeEl = document.getElementById('GS_FileSize');
  if (nameEl) nameEl.textContent = file.name + ' · ';
  if (sizeEl) sizeEl.textContent = (file.size / 1024).toFixed(1) + ' KB';
}

// ── DuckDB ────────────────────────────────────────────────────────────────────
let _GS_db   = null;
let _GS_conn = null;

async function GS_getDB() {
  if (_GS_db) return _GS_conn;
  GS_log('DuckDB — initialising WASM…', 'info');
  if (!window.duckdb) {
    const mod = await import('https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@1.32.0/+esm');
    window.duckdb = mod;
  }
  const duck = window.duckdb;
  const JSDELIVR = 'https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@1.32.0/dist/';
  const bundles = {
    mvp: { mainModule: JSDELIVR + 'duckdb-mvp.wasm', mainWorker: JSDELIVR + 'duckdb-browser-mvp.worker.js' },
    eh:  { mainModule: JSDELIVR + 'duckdb-eh.wasm',  mainWorker: JSDELIVR + 'duckdb-browser-eh.worker.js'  },
  };
  const bundle = await duck.selectBundle(bundles);
  const workerBlob = new Blob([`importScripts('${bundle.mainWorker}');`], { type: 'application/javascript' });
  const worker = new Worker(URL.createObjectURL(workerBlob));
  _GS_db = new duck.AsyncDuckDB(new duck.ConsoleLogger(), worker);
  await _GS_db.instantiate(bundle.mainModule);
  _GS_conn = await _GS_db.connect();
  GS_log('DuckDB ready', 'success');
  return _GS_conn;
}

// ── Column Separator ──────────────────────────────────────────────────────────
let GS_Delimiter      = null;
let GS_HasHeader      = true;
let GS_HeaderSet      = false;
let GS_IsParquet      = false;
let GS_RegisteredName = null;
let GS_AllColumns     = [];
let GS_PreviewRows    = [];

function GS_setDelim(val, btn) {
  GS_Delimiter = val;
  GS_log(`Delimiter selected: "${val || 'auto'}"`, 'info');
  document.querySelectorAll('#GS_DelimCard .pg-chip').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  GS_unlock('GS_HeaderCard');
  if (typeof GS_StepToast === 'function') GS_StepToast('⚙️ Delimiter set', 'Does your file have a header row? Select <strong>Has Header</strong> or <strong>No Header</strong> below.');
  if (GS_HeaderSet) GS_loadFile();
}

function GS_setHeader(val) {
  GS_HasHeader = val;
  GS_HeaderSet = true;
  GS_log(`Header row: ${val ? 'Yes — row 1 is headers' : 'No — row 1 is data'}`, 'info');
  document.getElementById('GS_BtnHeader').classList.toggle('active', val);
  document.getElementById('GS_BtnNoHeader').classList.toggle('active', !val);
  GS_loadFile();
}

async function GS_loadFile() {
  if (!GS_UploadedFile) return;
  const _gsLoadStart = performance.now();
  GS_showLoadingBadge('Reading file…');
  try {
    const conn  = await GS_getDB();
    const fname = 'dataRaw';
    if (fname !== GS_RegisteredName) {
      await _GS_db.registerFileHandle(fname, GS_UploadedFile, window.duckdb.DuckDBDataProtocol.BROWSER_FILEREADER, true);
      GS_RegisteredName = fname;
      GS_log('File registered as dataRaw', 'info');
    }
    let srcTypedFull, srcVarchar;
    if (GS_IsParquet) {
      srcTypedFull = `read_parquet('${fname}')`;
      srcVarchar   = `read_parquet('${fname}')`;
    } else {
      const delim  = (!GS_Delimiter || GS_Delimiter === 'auto') ? '' : `, delim='${GS_Delimiter}'`;
      const header = GS_HasHeader ? ', header=true' : ', header=false';
      srcTypedFull = `read_csv_auto('${fname}'${delim}${header}, ignore_errors=true)`;
      srcVarchar   = `read_csv_auto('${fname}'${delim}${header}, all_varchar=true, ignore_errors=true)`;
    }

    GS_showLoadingBadge('Loading data…');
    // Materialise as typed table so SP can query it
    await conn.query(`CREATE OR REPLACE TABLE data100 AS SELECT * FROM ${srcTypedFull} LIMIT 100`);
    GS_log('data100 created (100 rows, all columns)', 'success');

    // Schema + preview from data100 (already in memory — no second file scan)
    const desc = await conn.query(`DESCRIBE data100`);
    const descRows = desc.toArray();
    const cols = descRows.map(r => String(r.column_name ?? ''));
    GS_Types = {};
    descRows.forEach(r => {
      const typeStr = String(r.column_type ?? '').replace(/\(.*\)/, '').trim().toUpperCase();
      GS_Types[String(r.column_name ?? '')] = typeStr;
    });
    const castSel  = cols.map(c => `CAST("${c.replace(/"/g, '""')}" AS VARCHAR) AS "${c.replace(/"/g, '""')}"`).join(', ');
    const previewRes = await conn.query(`SELECT ${castSel} FROM data100 LIMIT 50`);
    const rows = previewRes.toArray().map(r => { const o = {}; cols.forEach(c => o[c] = r[c] ?? ''); return o; });

    GS_AllColumns  = cols;
    GS_PreviewRows = rows;

    GS_renderChips(); GS_refreshJsonIfOpen();
    GS_renderPreviewTable(cols, rows);
    GS_unlock('GS_SelectorCard');
    GS_unlock('GS_PreviewCard');
    GS_unlock('GS_SaveCard');
    GS_unlock('GS_BtnSave');
    window.LD_getConn   = () => _GS_conn;
    window.LD_getSource = () => 'data100';
    GS_log('Ready → data100 exposed', 'success');
    GS_log(`Upload took ${((performance.now() - _gsLoadStart) / 1000).toFixed(2)}s`);
    if (typeof GS_StepToast === 'function') GS_StepToast('✅ Data loaded', 'Select which columns to keep. You can rename them, change their type, and apply transforms before saving.');
  } catch(e) {
    GS_log(`Upload failed after ${((performance.now() - _gsLoadStart) / 1000).toFixed(2)}s`);
    GS_log('Error loading file: ' + e.message, 'error');
    console.error('[GS_loadFile]', e);
  }
}

// ── Column renames ────────────────────────────────────────────────────────────
let GS_Renames     = {};
let GS_Types       = {};
let GS_Formats     = {};
let GS_FormatMode  = false;
let GS_RenameMode  = false;
let GS_TypeMode    = false;
let GS_SelectMode      = false;
let GS_KeepCols        = new Set();
let GS_SelectApplied   = false;
let GS_SelectDates     = {};

let GS_ActiveTypeFilters = new Set();

const _GS_TYPE_PATTERNS = {
  'STRING':    t => /VARCHAR|TEXT|CHAR|STRING/.test(t),
  'INTEGER':   t => /INT/.test(t),
  'FLOAT':     t => /FLOAT|DOUBLE|DECIMAL|NUMERIC|REAL/.test(t),
  'DATE':      t => /^DATE/.test(t),
  'TIMESTAMP': t => /TIMESTAMP/.test(t),
  'TIME':      t => /^TIME$/.test(t),
  'BOOLEAN':   t => /BOOL/.test(t),
};

const _GS_TYPE_COLORS = {
  'STRING':    '#E8714A',
  'INTEGER':   '#7B2D8B',
  'FLOAT':     '#A82060',
  'DATE':      '#7B68C8',
  'TIMESTAMP': '#8BAEE0',
  'TIME':      '#0D9488',
  'BOOLEAN':   '#1A9474',
};

function GS_toggleTypeMode() {
  const turning_on = !GS_TypeMode;
  GS_log(`Type mode ${turning_on ? 'ON' : 'OFF'}`, 'info');
  GS_deactivateAllModes();
  if (!turning_on) { GS_renderChips(); GS_renderPreviewTable(GS_AllColumns, GS_PreviewRows); return; }
  GS_TypeMode = true;
  document.getElementById('GS_TypeBtn').classList.add('active');
  const row = document.getElementById('GS_TypeRow');
  if (row) {
    row.style.display = '';
    row.querySelectorAll('.gs-type-chip').forEach(btn => {
      const t = btn.getAttribute('onclick')?.match(/'([^']+)'/)?.[1];
      const c = t ? _GS_TYPE_COLORS[t] : null;
      if (c) { btn.style.borderColor = c; btn.style.background = c + '20'; btn.style.color = c; }
    });
  }
  GS_renderChips();
  GS_renderPreviewTable(GS_AllColumns, GS_PreviewRows);
}

function GS_showTypeContextMenu(col, e) {
  e.preventDefault();
  e.stopPropagation();
  document.getElementById('GS_TypeContextMenu')?.remove();
  const menu = document.createElement('div');
  menu.id = 'GS_TypeContextMenu';
  menu.style.cssText = `position:fixed;left:${Math.min(e.clientX, window.innerWidth-160)}px;top:${Math.min(e.clientY, window.innerHeight-220)}px;z-index:99999;background:var(--color-card-bg);border:1px solid var(--color-card-border);border-radius:8px;box-shadow:0 6px 24px rgba(0,0,0,0.14);padding:4px 0;min-width:150px;font-family:var(--font-base);`;
  const current = GS_Types[col] || '';
  menu.innerHTML = Object.entries(_GS_TYPE_COLORS).map(([type, color]) => {
    const isCurrent = current && _GS_TYPE_PATTERNS[type]?.(current);
    return `<div onclick="GS_assignType('${col.replace(/'/g,"\\'")}','${type}');document.getElementById('GS_TypeContextMenu')?.remove();"
      style="display:flex;align-items:center;gap:8px;padding:7px 12px;font-size:0.72rem;color:var(--color-text-muted);cursor:pointer;${isCurrent?`font-weight:700;color:${color};`:''}"
      onmouseover="this.style.background='var(--color-nav-hover)'" onmouseout="this.style.background=''">
      <span style="width:10px;height:10px;border-radius:50%;background:${color};flex-shrink:0;"></span>${type.charAt(0)+type.slice(1).toLowerCase()}
    </div>`;
  }).join('');
  document.body.appendChild(menu);
  setTimeout(() => document.addEventListener('click', function _c() {
    document.getElementById('GS_TypeContextMenu')?.remove();
    document.removeEventListener('click', _c);
  }), 0);
}

let _GS_dragType = null;

function GS_typeDragStart(type, e) {
  _GS_dragType = type;
  e.dataTransfer.effectAllowed = 'copy';
}

function GS_chipDragOver(e) {
  if (_GS_dragType) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }
}

function GS_chipDrop(col, e) {
  e.preventDefault();
  if (_GS_dragType) { GS_assignType(col, _GS_dragType); _GS_dragType = null; }
}

function GS_assignType(col, type) {
  GS_Types[col] = type;
  GS_log(`Type assigned: "${col}" → ${type}`, 'info');
  GS_renderChips(); GS_refreshJsonIfOpen();
  GS_renderPreviewTable(GS_AllColumns, GS_PreviewRows);
}

function GS_applyType(type) {
  if (GS_ActiveTypeFilters.has(type)) GS_ActiveTypeFilters.delete(type);
  else GS_ActiveTypeFilters.add(type);
  document.querySelectorAll('#GS_TypeRow .gs-type-chip').forEach(btn => {
    const t = btn.getAttribute('onclick')?.match(/'([^']+)'/)?.[1];
    const active = t && GS_ActiveTypeFilters.has(t);
    btn.style.background     = active ? _GS_TYPE_COLORS[t] : '';
    btn.style.borderColor    = active ? _GS_TYPE_COLORS[t] : '';
    btn.style.color          = active ? '#fff' : '';
  });
  GS_renderChips(); GS_refreshJsonIfOpen();
  GS_renderPreviewTable(GS_AllColumns, GS_PreviewRows);
}

const _GS_DATE_TYPES = new Set(['DATE','TIMESTAMP','TIMESTAMPTZ','TIME']);
const _GS_isDateType = t => _GS_DATE_TYPES.has((t||'').toUpperCase().replace(/\(.*\)/,'').trim());
const _GS_isIntType  = t => /INT/.test((t||'').toUpperCase());

const _GS_FMT_DATE = [
  { v: '%Y%m%d',   l: '%Y%m%d · 20250115' },
  { v: '%Y-%m-%d', l: '%Y-%m-%d · 2025-01-15' },
  { v: '%Y/%m/%d', l: '%Y/%m/%d · 2025/01/15' },
  { v: '%Y.%m.%d', l: '%Y.%m.%d · 2025.01.15' },
  { v: '%d%m%Y',   l: '%d%m%Y · 15012025' },
  { v: '%d-%m-%Y', l: '%d-%m-%Y · 15-01-2025' },
  { v: '%d/%m/%Y', l: '%d/%m/%Y · 15/01/2025' },
  { v: '%d.%m.%Y', l: '%d.%m.%Y · 15.01.2025' },
  { v: '%m%d%Y',   l: '%m%d%Y · 01152025' },
  { v: '%m-%d-%Y', l: '%m-%d-%Y · 01-15-2025' },
  { v: '%m/%d/%Y', l: '%m/%d/%Y · 01/15/2025' },
];
const _GS_FMT_TIME = [
  { v: '%H%M%S',   l: '%H%M%S · 143022' },
  { v: '%H:%M:%S', l: '%H:%M:%S · 14:30:22' },
  { v: '%H%M',     l: '%H%M · 1430' },
  { v: '%H:%M',    l: '%H:%M · 14:30' },
];
const _GS_FMT_DATETIME = [
  { v: '%Y-%m-%d %H:%M:%S',  l: '%Y-%m-%d %H:%M:%S · 2025-01-15 14:30:22' },
  { v: '%Y%m%d%H%M%S',       l: '%Y%m%d%H%M%S · 20250115143022' },
  { v: '%Y-%m-%dT%H:%M:%S',  l: '%Y-%m-%dT%H:%M:%S · ISO 8601' },
  { v: '%d/%m/%Y %H:%M:%S',  l: '%d/%m/%Y %H:%M:%S · 15/01/2025 14:30:22' },
  { v: '%m/%d/%Y %H:%M:%S',  l: '%m/%d/%Y %H:%M:%S · 01/15/2025 14:30:22' },
  { v: '%Y/%m/%d %H:%M:%S',  l: '%Y/%m/%d %H:%M:%S · 2025/01/15 14:30:22' },
  { v: '%d-%m-%Y %H:%M:%S',  l: '%d-%m-%Y %H:%M:%S · 15-01-2025 14:30:22' },
];

function _GS_normalizeFmt(fmt) {
  return fmt.replace(/YYYY/g,'%Y').replace(/MM/g,'%m').replace(/DD/g,'%d')
            .replace(/HH24/g,'%H').replace(/HH/g,'%H').replace(/MI/g,'%M').replace(/SS/g,'%S');
}

function GS_toggleFormatMode() {
  const turning_on = !GS_FormatMode;
  GS_log(`Format mode ${turning_on ? 'ON' : 'OFF'}`, 'info');
  GS_deactivateAllModes();
  if (!turning_on) { GS_renderChips(); return; }
  GS_FormatMode = true;
  document.getElementById('GS_FormatBtn').classList.add('active');
  GS_renderFormatPanel();
}

function GS_renderFormatPanel() {
  const grid = document.getElementById('GS_ChipGrid');
  if (!grid) return;
  const _GS_isStrType = t => /VARCHAR|TEXT|CHAR|STRING/.test((t||'').toUpperCase());
  const activeCols   = (GS_SelectApplied || GS_SelectMode) && GS_KeepCols.size > 0 ? GS_AllColumns.filter(c => GS_KeepCols.has(c)) : GS_AllColumns;
  const relevantCols = activeCols.filter(c => _GS_isDateType(GS_Types[c]) || _GS_isIntType(GS_Types[c]) || _GS_isStrType(GS_Types[c]));
  if (!relevantCols.length) { grid.innerHTML = '<span style="font-size:0.7rem;color:var(--color-text-dim);">No date/time/integer columns detected.</span>'; return; }
  const rows = relevantCols.map((col, colIdx) => {
    const type    = GS_Types[col] || '';
    const isDate  = _GS_isDateType(type);
    const fmt     = GS_Formats[col]?.fmt   || '';
    const zfill   = GS_Formats[col]?.zfill || '';
    const label   = GS_Renames[col] || col;
    const safe    = col.replace(/\\/g,'\\\\').replace(/'/g,"\\'");

    let fmtCell;
    if (!isDate) {
      fmtCell = `<input type="text" class="pg-input" disabled style="opacity:0.35;width:120px;height:26px;font-size:0.65rem;" />`;
    } else {
      const tu       = type.toUpperCase().replace(/\(.*\)/,'').trim();
      const presets  = tu === 'TIME' ? _GS_FMT_TIME : tu === 'DATE' ? _GS_FMT_DATE : _GS_FMT_DATETIME;
      const isCustom = !!(fmt && !presets.some(p => p.v === fmt));
      const selId    = `GS_FmtSel_${colIdx}`;
      const curLabel = isCustom ? 'Custom…' : (presets.find(p => p.v === fmt)?.l || '— pick format —');
      const allOpts  = [{ v: '', l: '— pick format —' }, ...presets, { v: '__custom__', l: 'Custom…' }];
      const optHtml  = allOpts.map(p => {
        const pv = p.v.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
        return `<div class="cs-option${fmt === p.v ? ' cs-selected' : ''}" onclick="GS_onFormatSelect('${safe}','${selId}','${pv}',this)">${p.l}</div>`;
      }).join('');
      fmtCell = `<div style="display:flex;flex-direction:column;gap:2px;">
        <div id="${selId}" class="custom-select">
          <button class="cs-trigger" onclick="toggleCustomSelect('${selId}')" style="height:26px;font-size:0.65rem;padding:0 8px;">
            <span class="cs-value" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${curLabel}</span>
            <svg viewBox="0 0 12 12" width="10" height="10" fill="none" style="flex-shrink:0;"><path d="M2 4l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
          <div class="cs-options">${optHtml}</div>
        </div>
        <input type="text" class="pg-input gs-fmt-custom" value="${isCustom ? fmt : ''}" placeholder="e.g. %Y%m%d" style="height:26px;font-size:0.65rem;${isCustom ? '' : 'display:none;'}" oninput="GS_setFormat('${safe}','fmt',this.value)" />
      </div>`;
    }

    return `<tr>
      <td style="padding:4px 8px 4px 0;font-size:0.72rem;color:var(--color-header-title);white-space:nowrap;">${label}</td>
      <td style="padding:4px 4px;">${fmtCell}</td>
      <td style="padding:4px 0 4px 4px;">
        <input type="number" class="pg-input" placeholder="0" value="${zfill}"
          style="width:60px;height:26px;font-size:0.65rem;" min="0" max="30"
          oninput="GS_setFormat('${safe}','zfill',parseInt(this.value)||0)"/>
      </td>
    </tr>`;
  }).join('');
  grid.innerHTML = `
    <table style="border-collapse:collapse;width:100%;">
      <thead>
        <tr>
          <th style="padding:4px 8px 6px 0;font-size:0.6rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--color-text-dim);text-align:left;">Column</th>
          <th style="padding:4px 4px 6px;font-size:0.6rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--color-text-dim);text-align:left;">Format</th>
          <th style="padding:4px 0 6px 4px;font-size:0.6rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--color-text-dim);text-align:left;">ZFill</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
}

function GS_setFormat(col, field, value) {
  if (!GS_Formats[col]) GS_Formats[col] = { fmt: '', zfill: 0 };
  GS_Formats[col][field] = value;
}

function GS_onFormatSelect(col, selId, v, optEl) {
  const selEl  = document.getElementById(selId);
  const custom = selEl?.closest('div[style]')?.querySelector('.gs-fmt-custom');
  if (selEl) {
    selEl.querySelectorAll('.cs-option').forEach(o => o.classList.remove('cs-selected'));
    if (optEl) optEl.classList.add('cs-selected');
    const lbl = selEl.querySelector('.cs-value');
    if (lbl) lbl.textContent = optEl?.textContent?.trim() || v;
    selEl.classList.remove('open');
  }
  if (v === '__custom__') {
    if (custom) { custom.style.display = ''; custom.focus(); }
    GS_setFormat(col, 'fmt', custom?.value || '');
  } else {
    if (custom) custom.style.display = 'none';
    GS_setFormat(col, 'fmt', v);
  }
}

function GS_deactivateAllModes() {
  if (GS_FormatMode) {
    GS_FormatMode = false;
    document.getElementById('GS_FormatBtn')?.classList.remove('active');
    GS_renderChips();
  }
  if (GS_SelectMode) {
    GS_SelectMode = false;
    GS_SelectApplied = true;
    document.getElementById('GS_SelectBtn').classList.remove('active');
    const c = document.getElementById('GS_SelectControls'); if (c) c.style.display = 'none';
  }
  if (GS_RenameMode) {
    GS_RenameMode = false;
    document.getElementById('GS_RenameBtn').classList.remove('active');
    const r = document.getElementById('GS_TransformRow'); if (r) r.style.display = 'none';
  }
  if (GS_TypeMode) {
    GS_TypeMode = false;
    document.getElementById('GS_TypeBtn').classList.remove('active');
    const t = document.getElementById('GS_TypeRow'); if (t) t.style.display = 'none';
    GS_ActiveTypeFilters.clear();
  }
}

function GS_toggleSelectMode() {
  const turning_on = !GS_SelectMode;
  GS_log(`Select mode ${turning_on ? 'ON' : 'OFF'}`, 'info');
  GS_deactivateAllModes();
  if (!turning_on) { GS_renderChips(); GS_renderPreviewTable(GS_AllColumns, GS_PreviewRows); return; }
  GS_SelectMode = true;
  document.getElementById('GS_SelectBtn').classList.add('active');
  if (GS_SelectMode) {
    if (!GS_SelectApplied) {
      GS_KeepCols = new Set();
      GS_SelectDates = {};
    }
    GS_SelectApplied = false;
  } else {
    GS_SelectApplied = true;
  }
  const controls = document.getElementById('GS_SelectControls');
  if (controls) controls.style.display = GS_SelectMode ? 'flex' : 'none';
  if (!GS_SelectMode) { const inp = document.getElementById('GS_ColSearch'); if (inp) inp.value = ''; GS_SearchFilter = ''; }
  GS_renderChips(); GS_refreshJsonIfOpen();
  GS_renderPreviewTable(GS_AllColumns, GS_PreviewRows);
}

let GS_SearchFilter = '';

function GS_filterChips(val) {
  GS_SearchFilter = val.trim().toLowerCase();
  GS_renderChips(); GS_refreshJsonIfOpen();
}

function GS_selectAll() {
  const now = new Date().toISOString();
  GS_AllColumns.forEach(col => { if (!GS_KeepCols.has(col)) { GS_KeepCols.add(col); GS_SelectDates[col] = now; } });
  GS_log(`Select all — ${GS_KeepCols.size} columns kept`, 'success');
  GS_renderChips(); GS_refreshJsonIfOpen();
  GS_renderPreviewTable(GS_AllColumns, GS_PreviewRows);
}

function GS_deselectAll() {
  GS_log('Deselect all — all columns cleared', 'warn');
  GS_KeepCols.clear();
  GS_SelectDates = {};
  GS_renderChips(); GS_refreshJsonIfOpen();
  GS_renderPreviewTable(GS_AllColumns, GS_PreviewRows);
}

function GS_toggleColKeep(col) {
  if (GS_KeepCols.has(col)) {
    GS_KeepCols.delete(col);
    delete GS_SelectDates[col];
  } else {
    GS_KeepCols.add(col);
    GS_SelectDates[col] = new Date().toISOString();
  }
  GS_renderChips(); GS_refreshJsonIfOpen();
  GS_renderPreviewTable(GS_AllColumns, GS_PreviewRows);
}

function GS_toggleRenameMode() {
  const turning_on = !GS_RenameMode;
  GS_log(`Rename mode ${turning_on ? 'ON' : 'OFF'}`, 'info');
  GS_deactivateAllModes();
  if (!turning_on) { GS_renderChips(); GS_refreshJsonIfOpen(); GS_renderPreviewTable(GS_AllColumns, GS_PreviewRows); return; }
  GS_RenameMode = true;
  document.getElementById('GS_RenameBtn').classList.add('active');
  const row = document.getElementById('GS_TransformRow');
  if (row) row.style.display = '';
  GS_renderChips(); GS_refreshJsonIfOpen();
  GS_renderPreviewTable(GS_AllColumns, GS_PreviewRows);
}

function GS_startHeaderEdit(col, th) {
  const current = GS_Renames[col] || col;
  const inp = document.createElement('input');
  inp.type = 'text';
  inp.value = current;
  inp.style.cssText = `width:${Math.max(60, current.length * 8)}px; outline:none; font-size:inherit; font-family:var(--font-base); border:1px solid var(--brand-dm); border-radius:3px; padding:1px 4px; background:var(--brand-dm-dim); color:var(--brand-dm); text-transform:none;`;
  const finish = () => {
    const val = inp.value.trim();
    if (val && val !== col) GS_Renames[col] = val; else delete GS_Renames[col];
    GS_renderChips(); GS_refreshJsonIfOpen();
    GS_renderPreviewTable(GS_AllColumns, GS_PreviewRows);
  };
  inp.addEventListener('blur', finish);
  inp.addEventListener('keydown', e => {
    if (e.key === 'Enter')  { e.preventDefault(); inp.blur(); }
    if (e.key === 'Escape') { GS_renderPreviewTable(GS_AllColumns, GS_PreviewRows); }
  });
  th.textContent = '';
  th.appendChild(inp);
  inp.focus(); inp.select();
}

function GS_startChipEdit(col, btn) {
  const current = GS_Renames[col] || col;
  const inp = document.createElement('input');
  inp.type = 'text';
  inp.value = current;
  inp.className = btn.className;
  inp.style.cssText = `width:${Math.max(60, current.length * 8)}px; outline:none; border-color: var(--brand-dm) !important; background: var(--brand-dm-dim) !important; color: var(--brand-dm) !important; box-shadow: 0 0 0 2px var(--brand-dm-dim);`;
  const finish = () => {
    const val = inp.value.trim();
    if (val && val !== col) GS_Renames[col] = val; else delete GS_Renames[col];
    if (inp.parentNode) inp.parentNode.replaceChild(btn, inp);
    GS_renderChips(); GS_refreshJsonIfOpen();
    GS_renderPreviewTable(GS_AllColumns, GS_PreviewRows);
  };
  inp.addEventListener('blur', finish);
  inp.addEventListener('keydown', e => {
    if (e.key === 'Enter')  { e.preventDefault(); inp.blur(); }
    if (e.key === 'Escape') { if (inp.parentNode) inp.parentNode.replaceChild(btn, inp); }
  });
  btn.parentNode.replaceChild(inp, btn);
  inp.focus(); inp.select();
}

function GS_resetRenames() {
  GS_Renames = {};
  GS_renderChips(); GS_refreshJsonIfOpen();
  GS_renderPreviewTable(GS_AllColumns, GS_PreviewRows);
}

function GS_applyPreset(preset) {
  GS_AllColumns.forEach(col => {
    let n = GS_Renames[col] || col;
    if      (preset === 'remove_spaces') n = n.replace(/\s+/g, '');
    else if (preset === 'snake_case')    n = n.replace(/\s+/g, '_').replace(/([A-Z])/g, m => '_' + m.toLowerCase()).replace(/^_/, '');
    else if (preset === 'lowercase')     n = n.toLowerCase();
    else if (preset === 'uppercase')     n = n.toUpperCase();
    if (n !== col) GS_Renames[col] = n; else delete GS_Renames[col];
  });
  GS_renderChips(); GS_refreshJsonIfOpen();
  GS_renderPreviewTable(GS_AllColumns, GS_PreviewRows);
}

function GS_renderChips() {
  const grid = document.getElementById('GS_ChipGrid');
  if (!grid) return;
  const filtered = GS_SearchFilter ? GS_AllColumns.filter(c => c.toLowerCase().includes(GS_SearchFilter) || (GS_Renames[c]||'').toLowerCase().includes(GS_SearchFilter)) : GS_AllColumns;
  grid.innerHTML = filtered.map(col => {
    const safe  = col.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
    const label = GS_Renames[col] || col;
    const dbl      = GS_RenameMode ? ` ondblclick="GS_startChipEdit('${safe}',this)"` : '';
    const ctx         = GS_TypeMode ? ` oncontextmenu="GS_showTypeContextMenu('${safe}',event)"` : '';
    const drop        = GS_TypeMode ? ` ondragover="GS_chipDragOver(event)" ondrop="GS_chipDrop('${safe}',event)"` : '';
    const selClick    = GS_SelectMode ? ` onclick="GS_toggleColKeep('${safe}')"` : '';
    const unselected  = GS_SelectMode && !GS_KeepCols.has(col);
    const selStyle    = GS_SelectMode ? (unselected ? 'border-color:var(--color-card-border);background:transparent;color:var(--color-header-title);' : 'border-color:var(--brand-dm);background:var(--brand-dm-dim);color:var(--brand-dm);') : '';
    const inferredKey = Object.keys(_GS_TYPE_PATTERNS).find(t => _GS_TYPE_PATTERNS[t]?.(GS_Types[col] || ''));
    const filterMatch = [...GS_ActiveTypeFilters].find(t => _GS_TYPE_PATTERNS[t]?.(GS_Types[col] || ''));
    const color       = GS_TypeMode && inferredKey ? _GS_TYPE_COLORS[inferredKey] : filterMatch ? _GS_TYPE_COLORS[filterMatch] : null;
    const dimmed      = GS_TypeMode && GS_ActiveTypeFilters.size > 0 && !filterMatch ? 'opacity:0.3;' : '';
    const deselected  = GS_SelectApplied && !GS_SelectMode && GS_KeepCols.size > 0 && !GS_KeepCols.has(col);
    const strikeStyle = deselected ? 'text-decoration:line-through;opacity:0.7;' : '';
    const combined    = strikeStyle || selStyle || (color ? `${dimmed}border-color:${color};background:${color}20;color:${color};` : dimmed);
    const style       = combined ? ` style="${combined}"` : '';
    return `<button type="button" class="pg-chip-sq" title="${col}"${dbl}${ctx}${drop}${selClick}${style}>${label}</button>`;
  }).join('');
  const badge = document.getElementById('GS_SelCount');
  if (badge) badge.textContent = `${GS_AllColumns.length} columns`;
}

let GS_PreviewView   = 'full';
let GS_ValuesMode    = false;

function GS_setPreviewView(view) {
  if (view === 'values') {
    GS_ValuesMode = !GS_ValuesMode;
  } else {
    GS_PreviewView = view;
  }
  document.getElementById('GS_PreviewFullBtn')?.classList.toggle('active', GS_PreviewView === 'full');
  document.getElementById('GS_PreviewSelBtn')?.classList.toggle('active', GS_PreviewView === 'selected');
  document.getElementById('GS_PreviewValBtn')?.classList.toggle('active', GS_ValuesMode);
  GS_renderPreviewTable(GS_AllColumns, GS_PreviewRows);
}

function GS_renderValuesView(cols, rows) {
  const tableEl = document.getElementById('GS_FullTable');
  if (!tableEl) return;
  if (!cols || !cols.length) { tableEl.innerHTML = ''; return; }
  const visibleCols = (GS_PreviewView === 'selected' && GS_KeepCols.size > 0) ? cols.filter(c => GS_KeepCols.has(c)) : cols;
  const rowsHtml = visibleCols.map(c => {
    const allVals    = rows.map(r => r[c] ?? '').filter(v => v !== '');
    const uniqueSet  = new Set(allVals);
    const samples    = [...uniqueSet].slice(0, 8);
    const total      = uniqueSet.size;
    const type       = GS_Types[c] || '';
    const inferredKey = Object.keys(_GS_TYPE_PATTERNS).find(t => _GS_TYPE_PATTERNS[t]?.(type));
    const color      = inferredKey ? _GS_TYPE_COLORS[inferredKey] : '#888';
    const chips      = samples.map(v => `<span style="display:inline-block;padding:1px 6px;border-radius:4px;font-size:0.6rem;background:${color}18;color:${color};border:0.5px solid ${color}44;margin:1px 2px;">${String(v).replace(/</g,'&lt;')}</span>`).join('');
    const more       = total > 8 ? `<span style="font-size:0.58rem;color:var(--color-text-dim);margin-left:3px;">+${total - 8} more</span>` : '';
    const label      = GS_Renames[c] || c;
    return `<tr>
      <td style="font-size:0.65rem;font-weight:600;color:var(--color-header-title);white-space:nowrap;padding:5px 8px;width:1%;">${label}</td>
      <td style="padding:5px 8px;width:1%;white-space:nowrap;"><span style="font-size:0.58rem;font-weight:700;padding:1px 5px;border-radius:3px;background:${color}18;color:${color};border:0.5px solid ${color}44;">${type || '—'}</span></td>
      <td style="padding:5px 8px;width:1%;white-space:nowrap;font-size:0.6rem;color:var(--color-text-dim);">${total} unique</td>
      <td style="padding:5px 8px;">${chips}${more}</td>
    </tr>`;
  }).join('');
  tableEl.innerHTML = `<table class="pg-table" style="table-layout:auto;"><thead><tr>
    <th style="text-transform:none;">Column</th><th style="text-transform:none;">Type</th><th style="text-transform:none;">Unique</th><th style="text-transform:none;">Sample Values</th>
  </tr></thead><tbody>${rowsHtml}</tbody></table>`;
}

function GS_renderPreviewTable(cols, rows) {
  if (GS_ValuesMode) { GS_renderValuesView(cols, rows); return; }
  const tableEl = document.getElementById('GS_FullTable');
  if (!tableEl) return;
  if (!cols || !cols.length) { tableEl.innerHTML = ''; return; }
  if (GS_PreviewView === 'selected' && GS_KeepCols.size > 0) {
    cols = cols.filter(c => GS_KeepCols.has(c));
  }
  const ths = cols.map(c => {
    const safe = c.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
    const dbl   = GS_RenameMode ? ` ondblclick="GS_startHeaderEdit('${safe}',this)" style="cursor:pointer;"` : '';
    const inferredKey = Object.keys(_GS_TYPE_PATTERNS).find(t => _GS_TYPE_PATTERNS[t]?.(GS_Types[c] || ''));
    const filterMatch = [...GS_ActiveTypeFilters].find(t => _GS_TYPE_PATTERNS[t]?.(GS_Types[c] || ''));
    const color       = GS_TypeMode && inferredKey ? _GS_TYPE_COLORS[inferredKey] : filterMatch ? _GS_TYPE_COLORS[filterMatch] : null;
    const selUnsel    = GS_SelectMode && !GS_KeepCols.has(c);
    const selSel      = GS_SelectMode && GS_KeepCols.has(c);
    const deselected  = GS_SelectApplied && !GS_SelectMode && GS_KeepCols.size > 0 && !GS_KeepCols.has(c);
    const selClick    = GS_SelectMode ? ` onclick="GS_toggleColKeep('${safe}')"` : '';
    const thStyle     = deselected ? ` style="opacity:0.5;text-decoration:line-through;"` : selUnsel ? ` style="opacity:0.35;cursor:pointer;"` : selSel ? ` style="cursor:pointer;background:var(--brand-dm-dim);color:var(--brand-dm);border-bottom-color:var(--brand-dm);"` : color ? ` style="background:${color}25;color:${color};border-bottom-color:${color};"` : '';
    return `<th title="${c}"${thStyle}${selClick}${dbl}>${GS_Renames[c] || c}</th>`;
  }).join('');
  const trs = rows.map(r => '<tr>' + cols.map(c => {
    const inferredKey = Object.keys(_GS_TYPE_PATTERNS).find(t => _GS_TYPE_PATTERNS[t]?.(GS_Types[c] || ''));
    const filterMatch = [...GS_ActiveTypeFilters].find(t => _GS_TYPE_PATTERNS[t]?.(GS_Types[c] || ''));
    const color       = GS_TypeMode && inferredKey ? _GS_TYPE_COLORS[inferredKey] : filterMatch ? _GS_TYPE_COLORS[filterMatch] : null;
    const selUnsel    = GS_SelectMode && !GS_KeepCols.has(c);
    const selSel      = GS_SelectMode && GS_KeepCols.has(c);
    const deselected  = GS_SelectApplied && !GS_SelectMode && GS_KeepCols.size > 0 && !GS_KeepCols.has(c);
    const tdStyle     = deselected ? ` style="opacity:0.4;"` : selUnsel ? ` style="opacity:0.35;"` : selSel ? ` style="background:var(--brand-dm-dim);"` : color ? ` style="background:${color}0d;"` : '';
    return `<td${tdStyle} title="${String(r[c]??'').replace(/"/g,'&quot;')}">${r[c]??''}</td>`;
  }).join('') + '</tr>').join('');
  tableEl.innerHTML = `<table class="pg-table"><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table>`;
}

function GS_HandleDragOver(e)  { e.preventDefault(); document.getElementById('GS_DropZone').classList.add('drag-over'); }
function GS_HandleDragLeave(e) { document.getElementById('GS_DropZone').classList.remove('drag-over'); }
function GS_HandleFileDrop(e) {
  e.preventDefault();
  document.getElementById('GS_DropZone').classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (!file) return;
  GS_UploadedFile = file;
  _GS_setFileLabel(file);
  GS_IsParquet = file.name.toLowerCase().endsWith('.parquet');
  if (GS_IsParquet) {
    GS_lock('GS_DelimCard');
    GS_lock('GS_HeaderCard');
    GS_unlock('GS_BtnLoad');
    GS_unlock('GS_BtnLoadLoad');
    GS_HasHeader = true;
    GS_HeaderSet = true;
    GS_loadFile();
  } else {
    GS_unlock('GS_DelimCard');
    GS_unlock('GS_BtnLoad');
    GS_unlock('GS_BtnLoadLoad');
  }
}

// ── Save Column Selection ─────────────────────────────────────────────────────
const _GS_DELIM_LABELS = { 'auto': 'Auto', ',': 'Comma', ';': 'Semicolon', '\t': 'Tab', '|': 'Pipe', '^': 'Caret', ':': 'Colon', ' ': 'Space', '~': 'Tilde', '#': 'Hash' };

function GS_buildJsonPayload(savedAt) {
  const useFilter = GS_SelectApplied || GS_SelectMode;
  const columns = {};
  GS_AllColumns.forEach(col => {
    const renamed  = GS_Renames[col];
    const type     = GS_Types[col];
    const fmtEntry = GS_Formats[col];
    const selected = useFilter ? GS_KeepCols.has(col) : null;

    const entry = {};

    // Select Columns
    if (useFilter)  entry['Select Columns'] = { Status: selected ? 'Selected' : 'Not Selected' };
    else            entry['Select Columns'] = { Status: 'Not Modified' };

    // Rename Column
    if (renamed)    entry['Rename Column']  = { Status: 'Renamed',      'New Name': renamed };
    else            entry['Rename Column']  = { Status: 'Not Modified' };

    // Modified Type
    if (type)       entry['Modified Type']  = { Status: 'Modified',     'New Type': type };
    else            entry['Modified Type']  = { Status: 'Not Modified' };

    // Changed Format
    if (fmtEntry?.fmt || fmtEntry?.zfill)
                    entry['Changed Format'] = { Status: 'Modified', Format: fmtEntry.fmt || '', ZFill: fmtEntry.zfill || 0 };
    else            entry['Changed Format'] = { Status: 'Not Modified' };

    // Last Updated
    if (savedAt)    entry['Last Updated']   = { Status: 'Updated', Date: savedAt };

    columns[col] = entry;
  });

  const payload = {
    ColumnSeparator: _GS_DELIM_LABELS[GS_Delimiter] || GS_Delimiter || 'Auto',
    HeaderRow:       GS_HasHeader ? 'Has Header' : 'No Header',
    Columns:         columns,
  };
  if (savedAt) payload['Last Updated'] = { Date: savedAt };
  return payload;
}

function GS_refreshJsonIfOpen() {
  const el = document.getElementById('GS_ModalContent');
  const modal = document.getElementById('GS_Modal');
  if (!el || !modal || modal.style.display === 'none') return;
  el.textContent = JSON.stringify(GS_buildJsonPayload(), null, 2);
}

function GS_viewJson() {
  const t = document.getElementById('GS_ModalTitle');
  if (t) t.textContent = 'JSON File';
  document.getElementById('GS_ModalContent').textContent = JSON.stringify(GS_buildJsonPayload(), null, 2);
  Popup_open('GS_Modal');
}

// ── Delete config ─────────────────────────────────────────────────────────────
function GS_deleteConfig() {
  const name = document.getElementById('GS_SaveName')?.value.trim();
  if (!name) { GS_log('Delete attempted — no config name entered', 'warn'); return; }
  try {
    const store = JSON.parse(localStorage.getItem(GS_STORAGE_KEY) || '{}');
    if (!store[name]) { GS_log(`Delete: "${name}" not found in storage`, 'warn'); return; }
    if (!confirm(`Delete config "${name}"?`)) return;
    delete store[name];
    localStorage.setItem(GS_STORAGE_KEY, JSON.stringify(store));
    document.getElementById('GS_SaveName').value = '';
    GS_refreshSidebarConfigs();
    GS_log(`Config deleted: "${name}" — ${Object.keys(store).length} remaining`, 'success');
  } catch(e) { console.error('[GS_deleteConfig]', e); }
}

// ── Console ───────────────────────────────────────────────────────────────────
const GS_STORAGE_KEY = 'GS_Configs';

function GS_saveConfig() {
  const name = document.getElementById('GS_SaveName')?.value.trim();
  if (!name) { alert('Enter a name first'); return; }
  try {
    const config   = GS_buildJsonPayload(new Date().toISOString());
    config.Name    = name;
    const store    = JSON.parse(localStorage.getItem(GS_STORAGE_KEY) || '{}');
    store[name]    = config;
    localStorage.setItem(GS_STORAGE_KEY, JSON.stringify(store));
    GS_logGroup(`Config saved: "${name}"`);
    GS_log(`Columns: ${(config.Columns ? Object.keys(config.Columns).length : 0)}`, 'success');
    GS_log(`Total configs in storage: ${Object.keys(store).length}`, 'info');
    GS_logGroupEnd();
    document.getElementById('GS_SaveName').value = '';
    GS_refreshSidebarConfigs();
  } catch(e) { console.error('[GS_saveConfig]', e); }
}

function GS_showNameSuggestions(val) {
  const box = document.getElementById('GS_NameSuggestions');
  if (!box) return;
  try {
    const store = JSON.parse(localStorage.getItem(GS_STORAGE_KEY) || '{}');
    const keys  = Object.keys(store).filter(k => !val || k.toLowerCase().includes(val.toLowerCase()));
    if (!keys.length) { box.style.display = 'none'; return; }
    box.innerHTML = keys.map(k =>
      `<div onclick="document.getElementById('GS_SaveName').value='${k.replace(/'/g,"\\'")}';document.getElementById('GS_NameSuggestions').style.display='none';if(_GS_loadSelectActive){_GS_loadSelectActive=false;document.getElementById('GS_LoadFileInput').click();}"
        style="padding:7px 12px;cursor:pointer;font-size:0.72rem;color:var(--color-header-title);border-bottom:0.5px solid var(--color-card-border);"
        onmouseover="this.style.background='var(--color-nav-hover)'" onmouseout="this.style.background=''">
        ${k}
      </div>`
    ).join('');
    function _pos() {
      const inp = document.getElementById('GS_SaveName');
      if (!inp || box.style.display === 'none') return;
      const r      = inp.getBoundingClientRect();
      const dropH  = Math.min(160, box.scrollHeight || 160);
      const below  = window.innerHeight - r.bottom;
      box.style.left  = r.left + 'px';
      box.style.width = r.width + 'px';
      if (below < dropH && r.top > dropH) {
        box.style.top           = '';
        box.style.bottom        = (window.innerHeight - r.top) + 'px';
        box.style.borderTop     = '1px solid var(--brand-dm)';
        box.style.borderBottom  = 'none';
        box.style.borderRadius  = 'var(--dml-radius) var(--dml-radius) 0 0';
      } else {
        box.style.bottom        = '';
        box.style.top           = r.bottom + 'px';
        box.style.borderTop     = 'none';
        box.style.borderBottom  = '1px solid var(--brand-dm)';
        box.style.borderRadius  = '0 0 var(--dml-radius) var(--dml-radius)';
      }
    }
    _pos();
    box.style.display = '';
    _pos(); // re-run after display so scrollHeight is accurate
    window.addEventListener('scroll', _pos, { capture: true, passive: true });
    setTimeout(() => document.addEventListener('click', function _c(e) {
      if (!e.target.closest('#GS_NameSuggestions') && !e.target.closest('#GS_SaveName')) {
        box.style.display = 'none';
        document.removeEventListener('click', _c);
        window.removeEventListener('scroll', _pos, { capture: true });
      }
    }), 0);
  } catch(e) {}
}

let _GS_popupConfig   = null;
let _GS_popupFiltered = false;

function GS_viewFromInput() {
  try {
    const store = JSON.parse(localStorage.getItem(GS_STORAGE_KEY) || '{}');
    const name  = document.getElementById('GS_SaveName')?.value.trim();
    const t     = document.getElementById('GS_ModalTitle');
    const el    = document.getElementById('GS_ModalContent');
    const btn   = document.getElementById('GS_ModalFilterBtn');
    _GS_popupFiltered = false;
    if (!name || !store[name]) { GS_showNameSuggestions(''); return; }
    _GS_popupConfig = store[name];
    if (t) t.textContent = name;
    if (btn) { btn.classList.remove('active'); btn.style.removeProperty('display'); }
    el.textContent = JSON.stringify(store[name], null, 2);
    Popup_open('GS_Modal');
  } catch(e) { console.error(e); }
}

function GS_togglePopupFilter() {
  if (!_GS_popupConfig) return;
  _GS_popupFiltered = !_GS_popupFiltered;
  const btn = document.getElementById('GS_ModalFilterBtn');
  const el  = document.getElementById('GS_ModalContent');
  if (btn) btn.classList.toggle('active', _GS_popupFiltered);
  if (!_GS_popupFiltered) {
    el.textContent = JSON.stringify(_GS_popupConfig, null, 2);
    return;
  }
  const cols = _GS_popupConfig.Columns || {};
  const filtered = {};
  Object.entries(cols).forEach(([col, entry]) => {
    if (entry['Select Columns']?.Status === 'Selected') filtered[col] = entry;
  });
  const view = { ..._GS_popupConfig, Columns: filtered };
  el.textContent = JSON.stringify(view, null, 2);
}

let _GS_loadMode         = 'console';
let _GS_loadSelectActive = false;

function GS_startLoadAndLoad() {
  _GS_loadSelectActive = true;
  const inp = document.getElementById('GS_SaveName');
  if (inp) { inp.focus(); GS_showNameSuggestions(inp.value); }
}

function GS_startSidebarLoad() {
  document.getElementById('GS_LoadFileInput').click();
}
async function GS_onLoadFilePicked(event) {
  const file = event.target.files[0];
  if (!file) return;
  event.target.value = '';
  GS_UploadedFile = file;
  GS_RegisteredName = null;
  _GS_setFileLabel(file);
  GS_IsParquet = file.name.toLowerCase().endsWith('.parquet');
  GS_log('File selected: ' + file.name + ' (' + (file.size/1024).toFixed(1) + ' KB)', 'info');
  if (GS_IsParquet) {
    GS_lock('GS_DelimCard');
    GS_lock('GS_HeaderCard');
    GS_HasHeader = true;
    GS_HeaderSet = true;
  } else {
    GS_unlock('GS_DelimCard');
  }
  GS_unlock('GS_BtnLoad');
  GS_unlock('GS_BtnLoadLoad');
  await GS_loadConfig();
}
async function GS_loadConfig() {
  const inp  = document.getElementById('GS_SaveName');
  const name = inp?.value.trim();

  if (!name) {
    GS_log('Load attempted — no config name entered', 'warn');
    if (inp) { inp.style.borderColor = '#ef4444'; inp.style.boxShadow = '0 0 0 2px rgba(239,68,68,0.25)'; inp.focus(); setTimeout(() => { inp.style.borderColor = ''; inp.style.boxShadow = ''; }, 2000); }
    return;
  }

  GS_logGroup(`Loading config: "${name}"`);
  const store  = JSON.parse(localStorage.getItem(GS_STORAGE_KEY) || '{}');
  const config = store[name];
  if (!config) { GS_log(`Config "${name}" not found in storage`, 'error'); GS_logGroupEnd(); if (inp) { inp.style.borderColor = '#ef4444'; inp.style.boxShadow = '0 0 0 2px rgba(239,68,68,0.25)'; setTimeout(() => { inp.style.borderColor = ''; inp.style.boxShadow = ''; }, 2000); } return; }

  if (!GS_UploadedFile) {
    document.getElementById('GS_FileInput').click();
    return;
  }

  const sep = config.ColumnSeparator || 'Auto';
  const delimMap = { 'Auto':null, 'Comma':',', 'Semicolon':';', 'Tab':'\t', 'Pipe':'|', 'Caret':'^', 'Colon':':', 'Space':' ', 'Tilde':'~', 'Hash':'#' };
  GS_Delimiter = delimMap[sep] ?? null;
  document.querySelectorAll('#GS_DelimCard .pg-chip').forEach(btn => {
    btn.classList.toggle('active', btn.textContent.trim() === sep);
  });
  GS_unlock('GS_DelimCard');

  const hasHeader = config.HeaderRow === 'Has Header';
  GS_HasHeader = hasHeader;
  GS_HeaderSet = true;
  document.getElementById('GS_BtnHeader')?.classList.toggle('active', hasHeader);
  document.getElementById('GS_BtnNoHeader')?.classList.toggle('active', !hasHeader);
  GS_unlock('GS_HeaderCard');
  GS_log(`Delimiter: ${sep}, Header: ${hasHeader ? 'Yes' : 'No'}`, 'info');
  await GS_loadFile();

  // Column mismatch check — selected config cols must exist in the file
  const _selectedCols = Object.entries(config.Columns || {})
    .filter(([, e]) => e['Select Columns']?.Status === 'Selected')
    .map(([col]) => col);
  const _missingCols = _selectedCols.filter(col => !GS_AllColumns.includes(col));
  if (_missingCols.length) {
    GS_showErrorBadge(`Column mismatch — not in file: ${_missingCols.join(', ')}`);
    GS_log(`Column mismatch: ${_missingCols.join(', ')}`, 'error');
    GS_logGroupEnd();
    return;
  }

  GS_applyConfig(config);
  await GS_buildConfigTables(config);
  GS_logGroupEnd();
}

function GS_applyConfig(config) {
  const cols = config.Columns || {};

  // 1. Select Columns
  GS_KeepCols.clear();
  GS_SelectDates = {};
  const hasSelection = Object.values(cols).some(e => e['Select Columns']?.Status === 'Selected' || e['Select Columns']?.Status === 'Not Selected');
  if (hasSelection) {
    Object.entries(cols).forEach(([col, entry]) => {
      if (entry['Select Columns']?.Status === 'Selected') {
        GS_KeepCols.add(col);
        if (entry['Last Updated']?.Date) GS_SelectDates[col] = entry['Last Updated'].Date;
      }
    });
    GS_SelectApplied = true;
  }

  // 2. Rename Column
  GS_Renames = {};
  Object.entries(cols).forEach(([col, entry]) => {
    if (entry['Rename Column']?.Status === 'Renamed') {
      GS_Renames[col] = entry['Rename Column']['New Name'];
    }
  });

  // 3. Modified Type
  GS_Types = {};
  Object.entries(cols).forEach(([col, entry]) => {
    if (entry['Modified Type']?.Status === 'Modified') {
      GS_Types[col] = entry['Modified Type']['New Type'];
    }
  });

  // 4. Changed Format
  GS_Formats = {};
  Object.entries(cols).forEach(([col, entry]) => {
    if (entry['Changed Format']?.Status === 'Modified') {
      GS_Formats[col] = {
        fmt:   entry['Changed Format'].Format  || '',
        zfill: entry['Changed Format'].ZFill   || 0,
      };
    }
  });

  const selCount    = GS_KeepCols.size;
  const renameCount = Object.keys(GS_Renames).length;
  const typeCount   = Object.keys(GS_Types).length;
  const fmtCount    = Object.keys(GS_Formats).length;
  GS_log(`Config applied — ${selCount} selected, ${renameCount} renamed, ${typeCount} typed, ${fmtCount} formatted`, 'success');
  GS_renderChips();
  GS_renderPreviewTable(GS_AllColumns, GS_PreviewRows);
  GS_refreshJsonIfOpen();
}

async function GS_buildConfigTables(config) {
  if (!config?.Columns) return;
  try {
    const _gsBuildStart = performance.now();
    const conn    = await GS_getDB();
    const typeMap = { 'STRING':'VARCHAR','INTEGER':'BIGINT','INT':'BIGINT','BIGINT':'BIGINT','FLOAT':'DOUBLE','DOUBLE':'DOUBLE','DECIMAL':'DOUBLE','DATE':'DATE','TIMESTAMP':'TIMESTAMP','TIME':'TIME','BOOLEAN':'BOOLEAN','BOOL':'BOOLEAN','VARCHAR':'VARCHAR' };

    // Get actual columns in dataRaw
    let rawSrc;
    if (GS_IsParquet) {
      rawSrc = `read_parquet('dataRaw')`;
    } else {
      const delim  = (!GS_Delimiter || GS_Delimiter === 'auto') ? '' : `, delim='${GS_Delimiter}'`;
      const header = GS_HasHeader ? ', header=true' : ', header=false';
      rawSrc = `read_csv_auto('dataRaw'${delim}${header}, ignore_errors=true)`;
    }
    const schema = await conn.query(`DESCRIBE data100`);
    const fileCols = new Set(schema.toArray().map(r => String(r.column_name ?? '')));

    const exprs = [];
    Object.entries(config.Columns || {}).forEach(([col, entry]) => {
      if (entry['Select Columns']?.Status !== 'Selected') return;
      if (!fileCols.has(col)) return;
      const castType = typeMap[entry['Modified Type']?.['New Type']] || 'VARCHAR';
      const renamed  = entry['Rename Column']?.Status === 'Renamed' ? entry['Rename Column']['New Name'] : col;
      const fmt      = entry['Changed Format']?.Status === 'Modified' ? entry['Changed Format'].Format  || '' : '';
      const zfill    = entry['Changed Format']?.Status === 'Modified' ? entry['Changed Format'].ZFill   || 0  : 0;
      const origQ    = `"${col.replace(/"/g,'""')}"`;
      const aliasQ   = `"${renamed.replace(/"/g,'""')}"`;
      let expr;
      if (fmt && _GS_isDateType(castType)) {
        const safeFmt = _GS_normalizeFmt(fmt).replace(/'/g,"''");
        expr = `TRY_CAST(strptime(CAST(${origQ} AS VARCHAR), '${safeFmt}') AS ${castType})`;
      } else {
        expr = `TRY_CAST(${origQ} AS ${castType})`;
      }
      if (zfill > 0) expr = `LPAD(CAST(${expr} AS VARCHAR), ${zfill}, '0')`;
      exprs.push(`${expr} AS ${aliasQ}`);
    });

    if (!exprs.length) return;
    const sel = exprs.join(', ');
    GS_log('Building data100 (100 rows, config columns)…', 'info');
    GS_showLoadingBadge('Applying column config…');
    await conn.query(`CREATE OR REPLACE TABLE data100 AS SELECT ${sel} FROM ${rawSrc} LIMIT 100`);
    GS_log('data100 ready', 'success');
    GS_log('Building data_sample (100K rows, config columns)…', 'info');
    GS_showLoadingBadge('Building sample dataset…');
    await conn.query(`CREATE OR REPLACE TABLE data_sample AS SELECT ${sel} FROM ${rawSrc} LIMIT 100000`);
    GS_log('data_sample ready (100K rows in RAM — used by Set Parameters)', 'success');
    GS_log('Building data101 (full data, config columns)…', 'info');
    GS_showLoadingBadge('Creating dataset view…');
    await conn.query(`CREATE OR REPLACE VIEW data101 AS SELECT ${sel} FROM ${rawSrc}`);
    GS_log('data101 view ready (lazy — reads on query)', 'success');
    const _gsRowRes  = await conn.query(`SELECT COUNT(*) AS n FROM ${rawSrc}`);
    const _gsRows    = Number(_gsRowRes.toArray()[0].n);
    const _gsCols    = exprs.length;
    const _gsBuildMs = ((performance.now() - _gsBuildStart) / 1000).toFixed(2);
    GS_log(`data101 — ${_gsRows.toLocaleString()} rows · ${_gsCols} cols · ${_gsBuildMs}s`);
    GS_showDataReadyBadge(_gsRows, _gsCols, _gsBuildMs);
    window.LD_getConn         = () => _GS_conn;
    window.LD_getSource       = () => 'data101';
    window.LD_getSampleSource = () => 'data_sample';
    if (typeof window.NAV_UnlockSP === 'function') window.NAV_UnlockSP();
    GS_log('data100 + data_sample + data101 ready', 'success');
  } catch(e) { GS_log('Error building tables: ' + e.message, 'error'); console.error('[GS_buildConfigTables]', e); }
}

// ── GS Info Popup ─────────────────────────────────────────────────────────────
function GS_infoOpen(btn, title, text) {
  const popup = document.getElementById('GS_InfoPopup');
  if (!popup) return;
  document.getElementById('GS_InfoTitle').textContent = title;
  document.getElementById('GS_InfoBody').innerHTML    = text;
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
  setTimeout(() => document.addEventListener('click', _GS_infoOutside), 0);
  window.addEventListener('scroll', GS_infoClose, { once: true, capture: true });
}
function _GS_infoOutside(e) {
  const popup = document.getElementById('GS_InfoPopup');
  if (popup && !popup.contains(e.target) && !e.target.classList.contains('pg-card-info-btn'))
    GS_infoClose();
}
function GS_infoClose() {
  const popup = document.getElementById('GS_InfoPopup');
  if (popup) popup.style.display = 'none';
  document.removeEventListener('click', _GS_infoOutside);
}

// ── GS Comment Popup ──────────────────────────────────────────────────────────
const _GS_Comments = {};
let _GS_CommentTarget = null;

function GS_commentOpen(btnId, cardTitle) {
  _GS_CommentTarget = btnId;
  const popup    = document.getElementById('GS_CommentPopup');
  const textarea = document.getElementById('GS_CommentText');
  const titleEl  = document.getElementById('GS_CommentTitle');
  if (!popup) return;
  if (titleEl)   titleEl.textContent  = cardTitle;
  if (textarea)  textarea.value       = _GS_Comments[btnId] || '';
  const btn  = document.getElementById(btnId);
  const rect = btn ? btn.getBoundingClientRect() : { bottom: 100, right: 100 };
  popup.style.display = 'block';
  popup.style.top   = (rect.bottom + 6) + 'px';
  popup.style.right = (window.innerWidth - rect.right) + 'px';
  setTimeout(() => document.addEventListener('click', _GS_commentOutside), 0);
}
function _GS_commentOutside(e) {
  const popup = document.getElementById('GS_CommentPopup');
  if (popup && !popup.contains(e.target) && e.target.id !== _GS_CommentTarget)
    GS_commentClose();
}
function GS_commentClose() {
  const popup = document.getElementById('GS_CommentPopup');
  if (popup) popup.style.display = 'none';
  document.removeEventListener('click', _GS_commentOutside);
  _GS_CommentTarget = null;
}
function GS_commentSave() {
  const textarea = document.getElementById('GS_CommentText');
  const val = textarea ? textarea.value.trim() : '';
  if (_GS_CommentTarget) {
    _GS_Comments[_GS_CommentTarget] = val;
    const btn = document.getElementById(_GS_CommentTarget);
    if (btn) btn.classList.toggle('has-comment', val.length > 0);
  }
  GS_commentClose();
}

// ── GS Export Config ──────────────────────────────────────────────────────────
function GS_exportConfig() {
  const name = document.getElementById('GS_SaveName')?.value.trim();
  try {
    const store = JSON.parse(localStorage.getItem(GS_STORAGE_KEY) || '{}');
    if (name && store[name]) {
      _GS_downloadJson(JSON.stringify({ [name]: store[name] }, null, 2), `${name}.json`);
    } else {
      _GS_downloadJson(JSON.stringify(store, null, 2), 'gs_configs.json');
    }
  } catch(e) { GS_log('Export failed: ' + e.message, 'error'); }
}

function _GS_downloadJson(data, filename) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([data], { type: 'application/json' }));
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
  GS_log(`Exported: ${filename}`, 'success');
}

// ── GS Import Config ──────────────────────────────────────────────────────────
function GS_importConfig() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const incoming = JSON.parse(ev.target.result);
        const store    = JSON.parse(localStorage.getItem(GS_STORAGE_KEY) || '{}');
        let count = 0;
        Object.entries(incoming).forEach(([k, v]) => { store[k] = v; count++; });
        localStorage.setItem(GS_STORAGE_KEY, JSON.stringify(store));
        GS_log(`Imported ${count} config(s) from ${file.name}`, 'success');
        GS_refreshSidebarConfigs();
      } catch(e) { GS_log('Import failed: ' + e.message, 'error'); }
    };
    reader.readAsText(file);
  };
  input.click();
}
