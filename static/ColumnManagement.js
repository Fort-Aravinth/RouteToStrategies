'use strict';
/* ── Column Management (CM) ─────────────────────────────────────────────────
   Reads DuckDB connection from Load Data: window.LD_getConn() / window.LD_getSource()
   All modifications tracked in JS state → applied as DuckDB VIEW 'cm_view'
   Templates:  localStorage key CM_Templates
   Bin tpls:   localStorage key CM_BinTemplates
──────────────────────────────────────────────────────────────────────────── */

let _CM_cols       = [];   // [{ name, dtype }] from DESCRIBE
let _CM_state      = {};   // { original_name: { include, rename, dtype, fmt, zfill } }
let _CM_derived    = [];   // [{ name, sql_expr, dtype }] derived (binned) columns
let _CM_vcCache    = null; // last value-counts result for re-sort
let _CM_baseSrc    = null; // original source before any cm_view is created

const _CM_DATE_TYPES = new Set(['DATE','TIMESTAMP','TIMESTAMPTZ','TIMESTAMP WITH TIME ZONE','TIME','DATETIME']);
function _CM_isDateType(dtype) { return _CM_DATE_TYPES.has((dtype || '').toUpperCase()); }

// Normalise Oracle/SQL-style format codes (YYYYMMDD) to strptime codes (%Y%m%d)
function _CM_normalizeFmt(fmt) {
  return fmt
    .replace(/YYYY/g, '%Y').replace(/YY/g, '%y')
    .replace(/MM/g,   '%m').replace(/DD/g, '%d')
    .replace(/HH24/g, '%H').replace(/HH/g, '%H')
    .replace(/MI/g,   '%M').replace(/SS/g, '%S');
}

// ── Utilities ────────────────────────────────────────────────────────────────

function CM_showToast(msg, type = '') {
  const container = document.getElementById('LD_ToastContainer');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = 'LD_Toast' + (type ? ' ' + type : '');
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('hide');
    toast.addEventListener('animationend', () => toast.remove(), { once: true });
  }, 10000);
}

function CM_hideAllViews() {
  ['PreDatView', 'LDView', 'PlaygroundView', 'CMView'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.classList.remove('visible'); el.style.setProperty('display', 'none', 'important'); }
  });
}

function CM_setSidebarActive(navId) {
  document.querySelectorAll('.sidebar-item').forEach(el => el.classList.remove('active'));
  const active = document.getElementById(navId);
  if (active) active.classList.add('active');
}

// ── Open ─────────────────────────────────────────────────────────────────────

function CM_Open() {
  CM_hideAllViews();
  const view = document.getElementById('CMView');
  if (!view) return;
  view.style.removeProperty('display');
  CM_setSidebarActive('nav-column-mgmt');
  document.documentElement.style.setProperty('--toast-brand', 'var(--brand-cm)');
  // Set base source to ld_raw (created by Load Data)
  _CM_baseSrc = 'ld_raw';
  CM_LoadColumns();
  CM_TM_LoadList();
  CM_CO_LoadBinTemplates();
}

// ── Load Columns — fast: DESCRIBE first, preview sample async ────────────────

async function CM_LoadColumns() {
  const conn = window.LD_getConn && window.LD_getConn();
  const src  = _CM_baseSrc;
  const tbody = document.getElementById('CM_ColumnTableBody');
  if (!tbody) return;

  if (!conn || !src) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--dml-muted);padding:20px;">No data loaded — load a file in Load Data first.</td></tr>';
    return;
  }

  tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--dml-muted);padding:12px;">Loading…</td></tr>';

  try {
    // Step 1: DESCRIBE — no scan, instant
    const schemaRes = await conn.query(`DESCRIBE SELECT * FROM ${src} LIMIT 0`);
    _CM_cols = schemaRes.toArray().map(r => ({ name: r.column_name, dtype: r.column_type }));

    // Keep existing state; add entries for new columns; drop removed ones
    const seen = new Set(_CM_cols.map(c => c.name));
    Object.keys(_CM_state).forEach(k => { if (!seen.has(k)) delete _CM_state[k]; });
    _CM_cols.forEach(col => {
      if (!_CM_state[col.name]) {
        _CM_state[col.name] = { include: true, rename: col.name, dtype: col.dtype, fmt: '', zfill: 0 };
      }
    });

    // Render table immediately — no preview values yet
    CM_RenderColumnTable(null);
    CM_PopulateOperationDropdowns();

    // Step 2: preview values from LIMIT 100 — fast, non-blocking
    conn.query(`SELECT * FROM ${src} LIMIT 100`).then(res => {
      CM_UpdatePreviewValues(res.toArray());
    }).catch(() => {});

  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="7" style="color:var(--dml-muted);padding:12px;">Error: ${e.message}</td></tr>`;
  }
}

// ── Render Column Table ───────────────────────────────────────────────────────

function CM_RenderColumnTable(previewRows) {
  const tbody = document.getElementById('CM_ColumnTableBody');
  if (!tbody) return;
  tbody.innerHTML = '';

  const dtypes = ['VARCHAR','INTEGER','BIGINT','DOUBLE','FLOAT','BOOLEAN','DATE','TIMESTAMP','TIME'];

  _CM_cols.forEach(col => {
    const s = _CM_state[col.name] || { include: true, rename: col.name, dtype: col.dtype, zfill: 0 };
    const tr = document.createElement('tr');
    tr.setAttribute('data-col', col.name);
    if (!s.include) tr.classList.add('CM_ColExcluded');

    // Safe attribute value (escape quotes)
    const safeCol = col.name.replace(/"/g, '&quot;').replace(/'/g, '&#39;');

    const isDate = _CM_isDateType(s.dtype);
    tr.innerHTML = `
      <td style="text-align:center;">
        <input type="checkbox" data-field="include" data-col="${safeCol}"
          ${s.include ? 'checked' : ''}
          onchange="CM_onStateChange(this.getAttribute('data-col'),'include',this.checked)"/>
      </td>
      <td>
        <input type="text" data-field="rename" data-col="${safeCol}"
          value="${(s.rename || col.name).replace(/"/g, '&quot;')}"
          class="CM_NameInput"
          onchange="CM_onStateChange(this.getAttribute('data-col'),'rename',this.value)"/>
      </td>
      <td>
        <select data-field="dtype" data-col="${safeCol}" class="CM_DtypeSelect"
          onchange="CM_onStateChange(this.getAttribute('data-col'),'dtype',this.value)">
          ${dtypes.map(d => `<option value="${d}"${s.dtype === d ? ' selected' : ''}>${d}</option>`).join('')}
        </select>
      </td>
      <td id="CM_fmt_td_${CSS.escape(col.name)}" style="${isDate ? '' : 'opacity:0.25;'}">
        <input type="text" data-field="fmt" data-col="${safeCol}"
          value="${(s.fmt || '').replace(/"/g, '&quot;')}"
          class="CM_NameInput"
          placeholder="${isDate ? (s.dtype === 'TIME' ? '%H%M%S' : '%Y%m%d') : '—'}"
          ${isDate ? '' : 'disabled'}
          onchange="CM_onStateChange(this.getAttribute('data-col'),'fmt',this.value)"/>
      </td>
      <td style="text-align:center;">
        <input type="number" data-field="zfill" data-col="${safeCol}"
          value="${s.zfill || ''}" placeholder="0" min="0" max="30"
          style="width:44px;border:none;background:transparent;text-align:center;font-family:var(--font-base);font-size:inherit;color:inherit;"
          onchange="CM_onStateChange(this.getAttribute('data-col'),'zfill',parseInt(this.value)||0)"/>
      </td>
      <td style="text-align:right;font-size:0.72rem;" id="CM_nn_${CSS.escape(col.name)}">—</td>
      <td style="font-size:0.7rem;color:var(--dml-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:200px;"
          id="CM_pv_${CSS.escape(col.name)}">…</td>
    `;
    tbody.appendChild(tr);
  });

  // Derived columns (bin / zpad) — read-only rows with delete button
  _CM_derived.forEach(d => {
    const tr = document.createElement('tr');
    tr.setAttribute('data-derived', d.name);
    tr.innerHTML = `
      <td style="text-align:center;"><input type="checkbox" checked disabled/></td>
      <td>
        <span style="color:var(--brand-cm);font-style:italic;">${d.name}</span>
        <span style="font-size:0.68rem;color:var(--dml-muted);"> (derived)</span>
      </td>
      <td><span style="color:var(--dml-muted);font-size:0.72rem;">${d.dtype || 'VARCHAR'}</span></td>
      <td></td>
      <td></td>
      <td style="text-align:right;">
        <button onclick="CM_RemoveDerived('${d.name.replace(/'/g,"\\'")}')"
          style="background:none;border:none;cursor:pointer;color:var(--dml-muted);font-size:0.82rem;padding:0 4px;"
          title="Remove derived column">✕</button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  if (previewRows) CM_UpdatePreviewValues(previewRows);
}

// ── Update Non-null % and preview values from sample ─────────────────────────

// DuckDB-WASM returns DATE/TIMESTAMP as ms since epoch (number) or BigInt μs
function _CM_formatDateValue(v, dtype) {
  if (v === null || v === undefined) return null;
  let ms;
  if (typeof v === 'bigint') {
    const n = Number(v);
    ms = n > 1e15 ? n / 1000 : n; // >1e15 → microseconds, convert to ms
  } else if (typeof v === 'number') {
    ms = v;
  } else {
    return String(v);
  }
  try {
    const d   = new Date(ms);
    const dt  = dtype.toUpperCase();
    if (dt === 'DATE')                           return d.toISOString().slice(0, 10);
    if (dt === 'TIME')                           return d.toISOString().slice(11, 19);
    return d.toISOString().replace('T', ' ').slice(0, 19);
  } catch { return String(v); }
}

function CM_UpdatePreviewValues(rows) {
  if (!rows || rows.length === 0) return;
  _CM_cols.forEach(col => {
    // Use the source column's actual dtype for display — not the target dtype the user chose.
    // The transformation only lives in cm_view; the preview rows come from the raw source.
    const dtype  = col.dtype || '';
    const isDate = _CM_isDateType(dtype);
    const values = rows.map(r => r[col.name]).filter(v => v !== null && v !== undefined);
    const pct    = rows.length > 0 ? Math.round(values.length / rows.length * 100) : 0;
    const nnEl   = document.getElementById(`CM_nn_${CSS.escape(col.name)}`);
    if (nnEl) nnEl.textContent = pct + '%';
    const display = values.slice(0, 30).map(v => isDate ? (_CM_formatDateValue(v, dtype) ?? String(v)) : String(v));
    const uniq    = [...new Set(display)].slice(0, 3);
    const pvEl    = document.getElementById(`CM_pv_${CSS.escape(col.name)}`);
    if (pvEl) pvEl.textContent = uniq.join(', ');
  });
}

// ── State Change ──────────────────────────────────────────────────────────────

function CM_onStateChange(colName, field, value) {
  if (!_CM_state[colName]) return;
  _CM_state[colName][field] = value;
  if (field === 'include') {
    const tr = document.querySelector(`#CM_ColumnTableBody tr[data-col="${colName.replace(/"/g, '\\"')}"]`);
    if (tr) tr.classList.toggle('CM_ColExcluded', !value);
  }
  if (field === 'dtype') {
    const isDate = _CM_isDateType(value);
    const td  = document.getElementById(`CM_fmt_td_${CSS.escape(colName)}`);
    const inp = td?.querySelector('input[data-field="fmt"]');
    if (td)  td.style.opacity = isDate ? '' : '0.25';
    if (inp) {
      inp.disabled = !isDate;
      inp.placeholder = isDate ? (value === 'TIME' ? '%H%M%S' : '%Y%m%d') : '—';
      if (!isDate) {
        inp.value = '';
        _CM_state[colName].fmt = '';
      } else if (!inp.value) {
        // Auto-fill format only when converting from a non-date type (e.g. BIGINT → DATE)
        const origCol    = _CM_cols.find(c => c.name === colName);
        const origIsDate = origCol ? _CM_isDateType(origCol.dtype) : false;
        if (!origIsDate) {
          const suggested = value === 'TIME' ? '%H%M%S' : '%Y%m%d';
          inp.value = suggested;
          _CM_state[colName].fmt = suggested;
        }
      }
    }
  }
}

// ── Search ────────────────────────────────────────────────────────────────────

function CM_FilterColumns() {
  const search = (document.getElementById('CM_SearchInput')?.value || '').toLowerCase();
  document.querySelectorAll('#CM_ColumnTableBody tr').forEach(tr => {
    const name = tr.getAttribute('data-col') || tr.getAttribute('data-derived') || '';
    tr.style.display = name.toLowerCase().includes(search) ? '' : 'none';
  });
}

// ── Presets ───────────────────────────────────────────────────────────────────

function CM_ApplyPreset(preset) {
  _CM_cols.forEach(col => {
    const s = _CM_state[col.name];
    if (!s || !s.include) return;
    let n = s.rename || col.name;
    if      (preset === 'remove_spaces') n = n.replace(/\s+/g, '_');
    else if (preset === 'snake_case')    n = n.replace(/\s+/g, '_').replace(/([A-Z])/g, m => '_' + m.toLowerCase()).replace(/^_/, '');
    else if (preset === 'lowercase')     n = n.toLowerCase();
    else if (preset === 'uppercase')     n = n.toUpperCase();
    s.rename = n;
    const inp = document.querySelector(`#CM_ColumnTableBody input[data-field="rename"][data-col="${col.name.replace(/"/g, '\\"')}"]`);
    if (inp) inp.value = n;
  });
}

function CM_ExcludeEmpty() {
  _CM_cols.forEach(col => {
    const nnEl = document.getElementById(`CM_nn_${CSS.escape(col.name)}`);
    const pct  = nnEl ? parseInt(nnEl.textContent) : NaN;
    if (!isNaN(pct) && pct === 0) {
      if (_CM_state[col.name]) _CM_state[col.name].include = false;
      const tr = document.querySelector(`#CM_ColumnTableBody tr[data-col="${col.name.replace(/"/g, '\\"')}"]`);
      if (tr) {
        tr.classList.add('CM_ColExcluded');
        const cb = tr.querySelector('input[type="checkbox"]');
        if (cb) cb.checked = false;
      }
    }
  });
}

// ── Apply Changes — build DuckDB VIEW ────────────────────────────────────────

async function CM_ApplyChanges(navigate = true) {
  const conn = window.LD_getConn && window.LD_getConn();
  const src  = _CM_baseSrc;
  if (!conn || !src) { CM_showToast('No data loaded', 'error'); return; }

  const parts = [];
  _CM_cols.forEach(col => {
    const s = _CM_state[col.name];
    if (!s || !s.include) return;
    let expr = `"${col.name}"`;
    if (s.fmt && s.fmt.trim() && _CM_isDateType(s.dtype)) {
      // Parse raw value using user-supplied format (normalised to strptime codes), then cast
      const safeFmt = _CM_normalizeFmt(s.fmt.trim()).replace(/'/g, "''");
      expr = `TRY_CAST(strptime(CAST("${col.name}" AS VARCHAR), '${safeFmt}') AS ${s.dtype})`;
    } else if (s.dtype && s.dtype !== col.dtype) {
      expr = `TRY_CAST(${expr} AS ${s.dtype})`;
    }
    if (s.zfill && s.zfill > 0) expr = `LPAD(CAST(${expr} AS VARCHAR), ${s.zfill}, '0')`;
    parts.push(`${expr} AS "${s.rename || col.name}"`);
  });

  _CM_derived.forEach(d => parts.push(`(${d.sql_expr}) AS "${d.name}"`));

  if (parts.length === 0) { CM_showToast('No columns selected', 'error'); return; }

  try {
    CM_showToast('Building cm_data table…', 'info');
    await conn.query(`CREATE OR REPLACE TABLE cm_data AS SELECT\n  ${parts.join(',\n  ')}\nFROM ${src}`);
    window.LD_getSource = () => 'cm_data';
    const countRes = await conn.query(`SELECT COUNT(*) AS n FROM cm_data`);
    const rows = Number(countRes.toArray()[0].n);
    CM_showToast(`Applied — ${parts.length} cols · ${rows.toLocaleString()} rows in cm_data`, 'success');
    if (typeof window.LD_UnlockSP  === 'function') window.LD_UnlockSP();
    CM_LoadColumns();
    if (navigate && typeof SP_Open === 'function') SP_Open();
  } catch (e) {
    CM_showToast('Error applying changes: ' + e.message, 'error');
  }
}

// ── Remove Derived Column ─────────────────────────────────────────────────────

function CM_RemoveDerived(name) {
  _CM_derived = _CM_derived.filter(d => d.name !== name);
  CM_RenderColumnTable(null);
}

// ── Populate Operation Dropdowns ─────────────────────────────────────────────

function CM_PopulateOperationDropdowns() {
  // Value Counts queries cm_view (output) — use renamed column names
  const vcContainer = document.getElementById('CM_COValueCountsCol');
  if (vcContainer) {
    const opts  = vcContainer.querySelector('.cs-options');
    const valEl = vcContainer.querySelector('.cs-value');
    if (opts) {
      opts.innerHTML = '<div class="cs-option cs-selected" data-value="">— select column —</div>';
      if (valEl) valEl.textContent = '— select column —';
      _CM_cols.forEach(col => {
        const s       = _CM_state[col.name];
        if (s && !s.include) return;
        const outName = s?.rename || col.name;
        const opt = document.createElement('div');
        opt.className = 'cs-option';
        opt.setAttribute('data-value', outName);
        opt.textContent = outName;
        opt.onclick = () => CM_selectOption('CM_COValueCountsCol', opt);
        opts.appendChild(opt);
      });
      // Also add derived columns
      _CM_derived.forEach(d => {
        const opt = document.createElement('div');
        opt.className = 'cs-option';
        opt.setAttribute('data-value', d.name);
        opt.textContent = d.name + ' (derived)';
        opt.onclick = () => CM_selectOption('CM_COValueCountsCol', opt);
        opts.appendChild(opt);
      });
    }
  }

  // Bin — show output (renamed) names; store original name as data-value for SQL expr
  ['CM_COBinColumn'].forEach(id => {
    const container = document.getElementById(id);
    if (!container) return;
    const opts  = container.querySelector('.cs-options');
    if (!opts) return;
    opts.innerHTML = '<div class="cs-option cs-selected" data-value="">— select column —</div>';
    const valEl = container.querySelector('.cs-value');
    if (valEl) valEl.textContent = '— select column —';
    _CM_cols.forEach(col => {
      const s       = _CM_state[col.name];
      if (s && !s.include) return;
      const outName = s?.rename || col.name;
      const opt = document.createElement('div');
      opt.className = 'cs-option';
      opt.setAttribute('data-value', col.name); // original name used in SQL expr
      opt.textContent = outName;
      opt.onclick = () => CM_selectOption(id, opt);
      opts.appendChild(opt);
    });
  });
}

// ── Custom Select Helpers ─────────────────────────────────────────────────────

function CM_selectOption(containerId, optEl) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.querySelectorAll('.cs-option').forEach(o => o.classList.remove('cs-selected'));
  optEl.classList.add('cs-selected');
  const valEl = container.querySelector('.cs-value');
  if (valEl) valEl.textContent = optEl.textContent;
  container.classList.remove('open');
}

function CM_getDropdownValue(id) {
  return document.getElementById(id)?.querySelector('.cs-selected')?.getAttribute('data-value') || '';
}

// ── Value Counts — on demand ──────────────────────────────────────────────────

async function CM_RunValueCounts(limit) {
  const col = CM_getDropdownValue('CM_COValueCountsCol');
  if (!col) { CM_showToast('Select a column', 'error'); return; }
  const conn = window.LD_getConn && window.LD_getConn();
  const src  = window.LD_getSource && window.LD_getSource();
  if (!conn || !src) { CM_showToast('No data loaded', 'error'); return; }

  const resultEl = document.getElementById('CM_COValueCountsResult');
  if (resultEl) resultEl.innerHTML = '<p style="color:var(--dml-muted);padding:8px;">Running…</p>';

  // Look up the dtype of the output column from _CM_state
  const colState = Object.values(_CM_state).find(s => (s.rename || '') === col) ||
                   Object.values(_CM_state).find(s => s.rename === col);
  const colDtype = colState?.dtype || '';
  const isDate   = _CM_isDateType(colDtype);

  try {
    const res  = await conn.query(`SELECT "${col}" AS val, COUNT(*) AS cnt FROM ${src} GROUP BY "${col}" ORDER BY cnt DESC LIMIT ${limit}`);
    _CM_vcCache = res.toArray().map(r => {
      const raw = r.val;
      const display = (raw === null || raw === undefined) ? '(null)'
                    : isDate ? (_CM_formatDateValue(raw, colDtype) ?? String(raw))
                    : String(raw);
      return [display, Number(r.cnt)];
    });
    CM_RenderValueCountsTable(_CM_vcCache);
  } catch (e) {
    if (resultEl) resultEl.innerHTML = `<p style="color:var(--dml-muted);padding:8px;">Error: ${e.message}</p>`;
  }
}

function CM_RenderValueCountsTable(data) {
  const el = document.getElementById('CM_COValueCountsResult');
  if (!el) return;
  if (!data || data.length === 0) { el.innerHTML = '<p style="color:var(--dml-muted);padding:8px;">No data</p>'; return; }
  let html = '<table style="width:100%;border-collapse:collapse;"><thead><tr style="background:var(--color-page-bg);position:sticky;top:0;">'
           + '<th style="text-align:left;padding:6px 8px;font-weight:500;">Value</th>'
           + '<th style="text-align:right;padding:6px 8px;font-weight:500;">Count</th></tr></thead><tbody>';
  data.forEach(([val, cnt]) => {
    html += `<tr style="border-bottom:0.5px solid var(--dml-border);"><td style="padding:6px 8px;">${val}</td><td style="text-align:right;padding:6px 8px;">${cnt}</td></tr>`;
  });
  el.innerHTML = html + '</tbody></table>';
}

function CM_SortValueCounts(by) {
  if (!_CM_vcCache) { CM_showToast('No results to sort', 'error'); return; }
  const sorted = [..._CM_vcCache];
  sorted.sort(by === 'value' ? (a, b) => String(a[0]).localeCompare(String(b[0])) : (a, b) => b[1] - a[1]);
  CM_RenderValueCountsTable(sorted);
}

// ── Column Template Management ────────────────────────────────────────────────

const _CM_TM_KEY = 'CM_Templates';

function CM_TM_GetAll() {
  try { return JSON.parse(localStorage.getItem(_CM_TM_KEY) || '{}'); } catch { return {}; }
}

function CM_TM_LoadList() {
  const templates = CM_TM_GetAll();
  const names     = Object.keys(templates);
  const dropdowns = {
    CM_TMDropdown:       { placeholder: '— select template —', handler: (name, opt) => {} },
    CM_TMViewDropdown:   { placeholder: '— select template —', handler: () => {} },
    CM_TMRemoveDropdown: { placeholder: '— select template —', handler: () => {} },
  };

  // Sidebar quick-apply dropdown
  const sidebar = document.getElementById('CM_SidebarTemplate');
  if (sidebar) {
    const opts  = sidebar.querySelector('.cs-options');
    const valEl = sidebar.querySelector('.cs-value');
    if (opts) {
      if (names.length === 0) {
        opts.innerHTML = '<div class="cs-option" style="color:var(--dml-label);pointer-events:none;">No saved templates</div>';
        if (valEl) valEl.textContent = 'Column Templates';
      } else {
        opts.innerHTML = '';
        if (valEl) valEl.textContent = 'Column Templates';
        names.forEach(name => {
          const opt = document.createElement('div');
          opt.className = 'cs-option';
          opt.setAttribute('data-value', name);
          opt.textContent = name;
          opt.onclick = () => {
            CM_TM_QuickApply(name);
            sidebar.querySelector('.cs-value').textContent = name;
            sidebar.classList.remove('open');
          };
          opts.appendChild(opt);
        });
      }
    }
  }

  Object.entries(dropdowns).forEach(([id, cfg]) => {
    const container = document.getElementById(id);
    if (!container) return;
    const opts  = container.querySelector('.cs-options');
    const valEl = container.querySelector('.cs-value');
    if (!opts) return;

    if (names.length === 0) {
      opts.innerHTML = '<div class="cs-option cs-selected" data-value="">— no templates —</div>';
      if (valEl) valEl.textContent = '— no templates —';
    } else {
      opts.innerHTML = '';
      if (valEl) valEl.textContent = cfg.placeholder;
      names.forEach(name => {
        const opt = document.createElement('div');
        opt.className = 'cs-option';
        opt.setAttribute('data-value', name);
        opt.textContent = name;
        opt.onclick = () => { CM_selectOption(id, opt); cfg.handler(name, opt); };
        opts.appendChild(opt);
      });
    }
  });
}

function CM_TM_SwitchTab(tab) {
  ['Load', 'View', 'Remove', 'Save'].forEach(t => {
    const isActive = t.toLowerCase() === tab;
    document.getElementById(`CM_TMTab_${t}`)?.classList.toggle('active', isActive);
    const panel = document.getElementById(`CM_TMPanel_${t}`);
    if (panel) panel.style.display = isActive ? 'flex' : 'none';
  });
}

function CM_TM_ViewSelected() {
  const name = CM_getDropdownValue('CM_TMViewDropdown');
  if (!name) { CM_showToast('Select a template', 'error'); return; }
  const templates = CM_TM_GetAll();
  const data = templates[name];
  if (!data) { CM_showToast('Template not found', 'error'); return; }

  const display = {
    name,
    columns: Object.entries(data.state || {}).map(([col, s]) => ({
      column:  col,
      rename:  s.rename || '',
      dtype:   s.dtype  || '',
      zfill:   s.zfill  || 0,
      include: s.include !== false,
    })),
    derived: (data.derived || []).map(d => ({
      name:     d.name,
      dtype:    d.dtype    || '',
      sql_expr: d.sql_expr || '',
    })),
  };

  const titleEl   = document.getElementById('PD_ModalTitle');
  const contentEl = document.getElementById('PD_ModalContent');
  const applyBtn  = document.getElementById('PD_ModalApplyBtn');
  const numBtn    = document.getElementById('PD_ModalApplyByNumBtn');
  if (titleEl)   titleEl.textContent   = name;
  if (contentEl) contentEl.textContent = JSON.stringify(display, null, 2);
  if (applyBtn)  applyBtn.style.display  = 'none';
  if (numBtn)    numBtn.style.display    = 'none';
  document.getElementById('PD_Modal')?.classList.add('cm-context');
  Popup_open('PD_Modal');
}

function CM_TM_Save() {
  const name = document.getElementById('CM_TMName')?.value.trim();
  if (!name) { CM_showToast('Enter a template name', 'error'); return; }
  const templates = CM_TM_GetAll();
  templates[name] = {
    state:   Object.fromEntries(Object.entries(_CM_state).map(([k, v]) => [k, { ...v }])),
    derived: _CM_derived.map(d => ({ ...d })),
  };
  localStorage.setItem(_CM_TM_KEY, JSON.stringify(templates));
  CM_showToast('Template saved: ' + name, 'success');
  const inp = document.getElementById('CM_TMName');
  if (inp) inp.value = '';
  CM_TM_LoadList();
}

function CM_TM_ApplySelected() {
  const name = CM_getDropdownValue('CM_TMDropdown');
  if (!name) { CM_showToast('Select a template', 'error'); return; }
  CM_TM_QuickApply(name);
}

async function CM_TM_QuickApply(name) {
  const tpl = CM_TM_GetAll()[name];
  if (!tpl) { CM_showToast('Template not found: ' + name, 'error'); return; }
  _CM_baseSrc = 'ld_raw';
  await CM_LoadColumns();
  Object.keys(tpl.state || {}).forEach(k => {
    if (_CM_state[k]) _CM_state[k] = { ..._CM_state[k], ...tpl.state[k] };
  });
  _CM_derived = (tpl.derived || []).map(d => ({ ...d }));
  CM_RenderColumnTable(null);
  CM_showToast('Template applied: ' + name, 'success');
  CM_ApplyChanges(false);
}

function CM_TM_Delete() {
  const name = CM_getDropdownValue('CM_TMRemoveDropdown');
  if (!name) { CM_showToast('Select a template', 'error'); return; }
  if (!confirm(`Delete template "${name}"?`)) return;
  const templates = CM_TM_GetAll();
  delete templates[name];
  localStorage.setItem(_CM_TM_KEY, JSON.stringify(templates));
  CM_showToast('Deleted: ' + name, 'success');
  CM_TM_LoadList();
}


// ── Bin Templates ─────────────────────────────────────────────────────────────

const _CM_BIN_KEY  = 'CM_BinTemplates';

function CM_CO_GetBinTemplates()  { try { return JSON.parse(localStorage.getItem(_CM_BIN_KEY)  || '{}'); } catch { return {}; } }

function CM_CO_LoadBinTemplates() {
  const names = Object.keys(CM_CO_GetBinTemplates());
  const container = document.getElementById('CM_COBinTemplate');
  if (!container) return;
  const opts  = container.querySelector('.cs-options');
  const valEl = container.querySelector('.cs-value');
  opts.innerHTML = '<div class="cs-option cs-selected" data-value="">— new —</div>';
  if (valEl) valEl.textContent = '— new —';
  names.forEach(name => {
    const opt = document.createElement('div');
    opt.className = 'cs-option';
    opt.setAttribute('data-value', name);
    opt.textContent = name;
    opt.onclick = () => { CM_selectOption('CM_COBinTemplate', opt); CM_CO_LoadBinTemplate(name); };
    opts.appendChild(opt);
  });
}

function CM_CO_LoadBinTemplate(name) {
  const tpl = CM_CO_GetBinTemplates()[name];
  if (!tpl) return;
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val ?? ''; };
  set('CM_COBinStep',  tpl.step_size);
  set('CM_COBinMax',   tpl.max_value);
  set('CM_COBinZfill', tpl.zfill);
  set('CM_COBinName',  tpl.target_column);
  if (tpl.source_column) {
    const optEl = document.querySelector(`#CM_COBinColumn .cs-option[data-value="${tpl.source_column}"]`);
    if (optEl) CM_selectOption('CM_COBinColumn', optEl);
  }
}

function CM_CO_DeleteBinTemplate() {
  const name = CM_getDropdownValue('CM_COBinTemplate');
  if (!name) { CM_showToast('Select a template', 'error'); return; }
  if (!confirm(`Delete bin template "${name}"?`)) return;
  const tpls = CM_CO_GetBinTemplates();
  delete tpls[name];
  localStorage.setItem(_CM_BIN_KEY, JSON.stringify(tpls));
  CM_showToast('Deleted: ' + name, 'success');
  CM_CO_LoadBinTemplates();
}

function CM_CO_BuildBinExpr(col, step, max, zfill) {
  const cases = [];
  for (let lo = 0; lo < max; lo += step) {
    const hi  = lo + step;
    const lbl = zfill > 0
      ? `'${String(lo).padStart(zfill, '0')}-${String(hi).padStart(zfill, '0')}'`
      : `'${lo}-${hi}'`;
    cases.push(`  WHEN "${col}" >= ${lo} AND "${col}" < ${hi} THEN ${lbl}`);
  }
  const maxLbl = zfill > 0 ? `'${String(max).padStart(zfill, '0')}+'` : `'${max}+'`;
  cases.push(`  WHEN "${col}" >= ${max} THEN ${maxLbl}`);
  return `CASE\n${cases.join('\n')}\n  ELSE NULL\nEND`;
}

function CM_CO_CreateBinned(andSave = false) {
  const col  = CM_getDropdownValue('CM_COBinColumn');
  if (!col) { CM_showToast('Select source column', 'error'); return; }
  const step = parseFloat(document.getElementById('CM_COBinStep')?.value);
  const max  = parseFloat(document.getElementById('CM_COBinMax')?.value);
  if (!step || !max) { CM_showToast('Enter step size and max value', 'error'); return; }
  const zfill   = parseInt(document.getElementById('CM_COBinZfill')?.value) || 0;
  const newName = document.getElementById('CM_COBinName')?.value.trim() || ('Binned_' + col);

  _CM_derived = _CM_derived.filter(d => d.name !== newName);
  _CM_derived.push({ name: newName, sql_expr: CM_CO_BuildBinExpr(col, step, max, zfill), dtype: 'VARCHAR' });

  if (andSave) {
    const tpls = CM_CO_GetBinTemplates();
    tpls[newName] = { source_column: col, step_size: step, max_value: max, zfill, target_column: newName };
    localStorage.setItem(_CM_BIN_KEY, JSON.stringify(tpls));
    CM_CO_LoadBinTemplates();
    CM_showToast('Binned column added & template saved: ' + newName, 'success');
  } else {
    CM_showToast('Binned column added: ' + newName, 'success');
  }
  CM_RenderColumnTable(null);
}

function CM_CO_SwitchTool(tool) {
  document.getElementById('CM_COBinTab')?.style.setProperty('display', 'block');
  document.getElementById('CM_COTabBinBtn')?.classList.add('active');
}

// ── Expose source / connection for downstream modules ─────────────────────────
window.CM_getConn   = () => window.LD_getConn && window.LD_getConn();
window.CM_getSource = () => window.LD_getSource && window.LD_getSource();

document.addEventListener('DOMContentLoaded', () => CM_TM_LoadList());
