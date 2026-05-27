'use strict';
/* ── Set Parameters (SP) ──────────────────────────────────────────────────── */

let _SP_cols = [];
let _SP_activePreset = '';
let _SP_params = {
  col1: '', values: [], numeric: '', currency: '', object: '',
  auth_date: '', auth_time: '', combined_datetime: '',
  decisionMode: { col: '', values: [], assigned: { successful: [], unsuccessful: [] } },
};

const SP_DM_Assigned = { successful: [], unsuccessful: [] };
let   SP_DT_MergeActive = false;
const SP_CB_Cards = {};
let   SP_CB_Counter = 0;

// ── Open ─────────────────────────────────────────────────────────────────────

async function SP_Open() {
  if (typeof App_HideAllViews === 'function') App_HideAllViews();
  const view = document.getElementById('SPView');
  if (!view) return;
  view.style.removeProperty('display');
  document.querySelectorAll('.sidebar-item').forEach(el => el.classList.remove('active'));
  document.getElementById('nav-parameters')?.classList.add('active');
  document.documentElement.style.setProperty('--toast-brand','var(--brand-param)');
  await SP_LoadColumns();
  SP_RenderPresetDropdowns();
  if (_SP_activePreset) {
    const params = SP_GetPresets()[_SP_activePreset];
    if (params) await SP_ApplyPresetParams(params);
  }
}

// ── Load columns from DuckDB ──────────────────────────────────────────────────

function SP_isObjectType(dtype) {
  const d = dtype.toUpperCase();
  return d.includes('VARCHAR') || d.includes('TEXT') || d.includes('STRING') || d.includes('CHAR') || d === 'BLOB';
}

async function SP_LoadColumns() {
  const conn = window.LD_getConn && window.LD_getConn();
  const src  = window.LD_getSource ? window.LD_getSource() : null;
  if (!conn || !src) return;

  try {
    const res = await conn.query(`DESCRIBE ${src}`);
    _SP_cols = res.toArray().map(r => ({ name: String(r.column_name), dtype: String(r.column_type) }));

    const allNames     = _SP_cols.map(c => c.name);
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

    // Fraud Filter: object columns with < 20 unique values
    const fraudFilterNames = await SP_filterByUniqueness(conn, src, objectCols.map(c => c.name), 20);
    const objectNames      = objectCols.map(c => c.name);

    SP_renderChips('SP_Col1Options',            fraudFilterNames, false, n => { SP_selectSingle('SP_Col1Options', n);            _SP_params.col1             = n; SP_LoadFilterValues(n); SP_UpdateAppliedDisplay(); });
    SP_renderChips('SP_NumericOptions',          numericNames,     false, n => { SP_selectSingle('SP_NumericOptions', n);          _SP_params.numeric           = n; SP_UpdateAppliedDisplay(); });
    SP_renderChips('SP_ObjectOptions',           objectNames,      false, n => { SP_selectSingle('SP_ObjectOptions', n);           _SP_params.object            = n; SP_UpdateAppliedDisplay(); });
    SP_renderChips('SP_DecisionModeColOptions',  objectNames,      false, n => { SP_selectSingle('SP_DecisionModeColOptions', n);  _SP_params.decisionMode.col  = n; SP_LoadDecisionModeValues(n); SP_UpdateAppliedDisplay(); });

    // Date & Time: only date/time columns, no "show all" toggle
    SP_renderChips('SP_DateOptions', dateNames, false, n => { SP_selectSingle('SP_DateOptions', n); _SP_params.auth_date = n; SP_UpdateAppliedDisplay(); });
    SP_renderChips('SP_TimeOptions', timeNames, false, n => { SP_selectSingle('SP_TimeOptions', n); _SP_params.auth_time = n; SP_UpdateAppliedDisplay(); });

    SP_restoreSelections();
    SP_UpdateAppliedDisplay();

  } catch (e) {
    console.error('SP_LoadColumns error:', e);
  }
}

async function SP_filterByUniqueness(conn, src, colNames, maxUnique) {
  if (!colNames.length) return [];
  // Single query: COUNT(DISTINCT) for all candidate columns at once
  const selects = colNames.map(n => `COUNT(DISTINCT "${n}") AS "${n}"`).join(', ');
  try {
    const res  = await conn.query(`SELECT ${selects} FROM ${src}`);
    const row  = res.toArray()[0];
    return colNames.filter(n => Number(row[n]) < maxUnique);
  } catch (e) {
    console.error('SP_filterByUniqueness error:', e);
    return colNames;
  }
}

// ── Distinct values ───────────────────────────────────────────────────────────

async function SP_loadDistinctValues(colName, containerId, multiSelect, onToggle) {
  const conn = window.LD_getConn && window.LD_getConn();
  const src  = window.LD_getSource ? window.LD_getSource() : null;
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

function SP_LoadFilterValues(colName) {
  SP_loadDistinctValues(colName, 'SP_ValueOptions', true, name => {
    const container = document.getElementById('SP_ValueOptions');
    const chip = container?.querySelector(`.pg-chip-sq[data-value="${CSS.escape(name)}"]`);
    if (chip) chip.classList.toggle('active');
    _SP_params.values = Array.from(container?.querySelectorAll('.pg-chip-sq.active') || []).map(c => c.getAttribute('data-value'));
    SP_UpdateAppliedDisplay();
  });
}

function SP_LoadDecisionModeValues(colName) {
  SP_DM_Assigned.successful   = [];
  SP_DM_Assigned.unsuccessful = [];
  SP_DM_RenderTags();
  SP_loadDistinctValues(colName, 'SP_DecisionModeValueOptions', true, name => {
    const container = document.getElementById('SP_DecisionModeValueOptions');
    const chip = container?.querySelector(`.pg-chip-sq[data-value="${CSS.escape(name)}"]`);
    if (chip) chip.classList.toggle('active');
  });
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
  container.querySelectorAll('.pg-chip-sq').forEach(c => c.classList.remove('active'));
  container.querySelector(`.pg-chip-sq[data-value="${CSS.escape(value)}"]`)?.classList.add('active');
}

function SP_restoreSelections() {
  if (_SP_params.col1)    { SP_selectSingle('SP_Col1Options',    _SP_params.col1);    SP_LoadFilterValues(_SP_params.col1); }
  if (_SP_params.numeric)  SP_selectSingle('SP_NumericOptions',  _SP_params.numeric);
  if (_SP_params.object)   SP_selectSingle('SP_ObjectOptions',   _SP_params.object);
  if (_SP_params.auth_date) SP_selectSingle('SP_DateOptions',    _SP_params.auth_date);
  if (_SP_params.auth_time) SP_selectSingle('SP_TimeOptions',    _SP_params.auth_time);
  const curr = document.getElementById('SP_Currency');
  if (curr && _SP_params.currency) curr.value = _SP_params.currency;
}

// ── Date & Time card ──────────────────────────────────────────────────────────

function SP_DT_PopulateOptions(containerId, detected, allCols, onSelect) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '';

  const listWrap = document.createElement('div');
  listWrap.style.cssText = 'display:flex;flex-wrap:wrap;gap:4px;';
  let expanded = false;

  const renderList = names => {
    listWrap.innerHTML = '';
    names.forEach(name => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'pg-chip-sq';
      chip.setAttribute('data-value', name);
      chip.textContent = name;
      chip.onclick = () => {
        container.querySelectorAll('.pg-chip-sq').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        onSelect(name);
      };
      listWrap.appendChild(chip);
    });
  };

  const toggleLink = document.createElement('button');
  toggleLink.type = 'button';
  toggleLink.style.cssText = 'font-size:0.65rem;color:var(--brand-param);background:none;border:none;cursor:pointer;padding:2px 0;text-align:left;';

  if (detected.length) {
    renderList(detected);
    container.appendChild(listWrap);
    if (detected.length < allCols.length) {
      toggleLink.textContent = `Show all ${allCols.length}`;
      toggleLink.onclick = () => { expanded = !expanded; renderList(expanded ? allCols : detected); toggleLink.textContent = expanded ? 'Show detected only' : `Show all ${allCols.length}`; };
      container.appendChild(toggleLink);
    }
  } else {
    container.innerHTML = '<span style="font-size:0.7rem;color:var(--dml-muted);">None auto-detected</span>';
    toggleLink.textContent = `Show all ${allCols.length}`;
    toggleLink.onclick = () => {
      expanded = !expanded;
      if (expanded) { renderList(allCols); container.insertBefore(listWrap, toggleLink); } else { listWrap.remove(); }
      toggleLink.textContent = expanded ? 'Show detected only' : `Show all ${allCols.length}`;
    };
    container.appendChild(toggleLink);
  }
}

function SP_DT_ToggleMerge() {
  SP_DT_MergeActive = !SP_DT_MergeActive;
  const btn = document.getElementById('SP_DT_MergeBtn');
  if (btn) { btn.classList.toggle('active', SP_DT_MergeActive); btn.textContent = SP_DT_MergeActive ? 'Merging ✓' : 'Merge'; }
  SP_UpdateAppliedDisplay();
}

async function SP_DT_Preview() {
  const conn    = window.LD_getConn && window.LD_getConn();
  const src     = window.LD_getSource ? window.LD_getSource() : null;
  const dateCol = _SP_params.auth_date;
  const timeCol = _SP_params.auth_time;
  const previewEl = document.getElementById('SP_DT_PreviewArea');
  if (!previewEl) return;
  if (!conn || !src || (!dateCol && !timeCol)) { previewEl.textContent = 'Select at least a date or time column first.'; return; }

  const mergeName = document.getElementById('SP_DT_MergeName')?.value.trim() || 'Combined';
  const parts = [];
  if (dateCol) parts.push(`CAST("${dateCol}" AS VARCHAR)`);
  if (timeCol) parts.push(`CAST("${timeCol}" AS VARCHAR)`);
  const combined = parts.join(` || ' ' || `);

  const cols = [...(dateCol ? [`"${dateCol}"`] : []), ...(timeCol ? [`"${timeCol}"`] : []), `${combined} AS "${mergeName}"`].join(', ');
  try {
    const res  = await conn.query(`SELECT ${cols} FROM ${src} LIMIT 5`);
    const rows = res.toArray();
    if (!rows.length) { previewEl.textContent = 'No data.'; return; }
    const headers = Object.keys(rows[0]);
    previewEl.innerHTML = `<div class="pg-table-wrap" style="margin-top:4px;">
      <table class="pg-table">
        <thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
        <tbody>${rows.map(r => `<tr>${headers.map(h => `<td>${r[h] ?? '—'}</td>`).join('')}</tr>`).join('')}</tbody>
      </table></div>`;
  } catch (e) {
    previewEl.innerHTML = `<span style="font-size:0.7rem;color:#ef4444;">${e.message}</span>`;
  }
}

// ── Decision Mode Filter ──────────────────────────────────────────────────────

function SP_DM_Assign(category) {
  const container = document.getElementById('SP_DecisionModeValueOptions');
  const selected  = Array.from(container?.querySelectorAll('.pg-chip-sq.active') || []).map(c => c.getAttribute('data-value'));
  if (!selected.length) return;
  const other = category === 'successful' ? 'unsuccessful' : 'successful';
  selected.forEach(v => {
    SP_DM_Assigned[other] = SP_DM_Assigned[other].filter(x => x !== v);
    if (!SP_DM_Assigned[category].includes(v)) SP_DM_Assigned[category].push(v);
  });
  container?.querySelectorAll('.pg-chip-sq.active').forEach(c => c.classList.remove('active'));
  SP_DM_RenderTags();
  SP_UpdateAppliedDisplay();
}

function SP_DM_RenderTags() {
  ['successful','unsuccessful'].forEach(cat => {
    const container = document.getElementById(`SP_DM_${cat.charAt(0).toUpperCase()+cat.slice(1)}Tags`);
    if (!container) return;
    container.innerHTML = '';
    SP_DM_Assigned[cat].forEach(v => {
      const tag = document.createElement('button');
      tag.type = 'button';
      tag.className = 'pg-chip-sq active';
      tag.textContent = v + ' ✕';
      tag.title = 'Click to remove';
      tag.onclick = () => { SP_DM_Assigned[cat] = SP_DM_Assigned[cat].filter(x => x !== v); SP_DM_RenderTags(); };
      container.appendChild(tag);
    });
  });
  document.getElementById('SP_DM_BtnSuccessful')?.classList.toggle('active',   SP_DM_Assigned.successful.length   > 0);
  document.getElementById('SP_DM_BtnUnsuccessful')?.classList.toggle('active', SP_DM_Assigned.unsuccessful.length > 0);
}

// ── Card Builder ──────────────────────────────────────────────────────────────

function SP_CB_CreateCard(name, labelA, labelB) {
  const id  = `SP_CB_Card_${++SP_CB_Counter}`;
  const uid = v => `${id}_${v}`;
  SP_CB_Cards[id] = { name, labelA, labelB, col: '', assigned: { a: [], b: [] } };

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
      <div>
        <div class="pg-field-label">Filter Column</div>
        <div id="${uid('ColOptions')}" class="pg-chip-row"></div>
      </div>
      <div>
        <div class="pg-field-label">Filter Values</div>
        <div id="${uid('ValueOptions')}" class="pg-chip-row sp-scroll"></div>
      </div>
      <div>
        <div style="display:flex;gap:6px;">
          <button type="button" id="${uid('BtnA')}" class="pg-btn" style="flex:1;" onclick="SP_CB_Assign('${id}','a')">${labelA}</button>
          <button type="button" id="${uid('BtnB')}" class="pg-btn" style="flex:1;" onclick="SP_CB_Assign('${id}','b')">${labelB}</button>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:8px;">
          <div><div id="${uid('TagsA')}" class="pg-chip-row" style="min-height:20px;"></div></div>
          <div><div id="${uid('TagsB')}" class="pg-chip-row" style="min-height:20px;"></div></div>
        </div>
      </div>
    </div>`;

  const grid = document.getElementById('SP_CardGrid');
  grid.insertBefore(card, document.getElementById('SP_CB_CardEl'));

  const colContainer = document.getElementById(uid('ColOptions'));
  _SP_cols.map(c => c.name).forEach(colName => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'pg-chip-sq';
    chip.setAttribute('data-value', colName);
    chip.textContent = colName;
    chip.onclick = () => {
      colContainer.querySelectorAll('.pg-chip-sq').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      SP_CB_Cards[id].col = colName;
      SP_CB_LoadValues(id, colName);
    };
    colContainer.appendChild(chip);
  });

  return id;
}

function SP_CB_AddCard() {
  const name   = document.getElementById('SP_CB_Name')?.value.trim();
  const labelA = document.getElementById('SP_CB_LabelA')?.value.trim();
  const labelB = document.getElementById('SP_CB_LabelB')?.value.trim();
  if (!name || !labelA || !labelB) { SP_showToast('Enter card name and both labels'); return; }
  if (labelA.toLowerCase() === labelB.toLowerCase()) { SP_showToast('Label A and Label B must be different'); return; }
  const existingNames = Object.values(SP_CB_Cards).map(c => c.name.toLowerCase());
  if (existingNames.includes(name.toLowerCase())) { SP_showToast(`A card named "${name}" already exists`); return; }

  SP_CB_CreateCard(name, labelA, labelB);
  document.getElementById('SP_CB_Name').value   = '';
  document.getElementById('SP_CB_LabelA').value = '';
  document.getElementById('SP_CB_LabelB').value = '';
}

async function SP_CB_RestoreCard(cardData) {
  if (!cardData.col) return;
  const colExists = _SP_cols.some(c => c.name === cardData.col);
  if (!colExists) return;

  const id  = SP_CB_CreateCard(cardData.name, cardData.labelA, cardData.labelB);
  const uid = v => `${id}_${v}`;

  SP_CB_Cards[id].col = cardData.col;
  SP_selectSingle(uid('ColOptions'), cardData.col);

  await SP_CB_LoadValues(id, cardData.col);

  SP_CB_Cards[id].assigned = {
    a: (cardData.assigned?.a || []).slice(),
    b: (cardData.assigned?.b || []).slice(),
  };
  SP_CB_RenderTags(id);
}

async function SP_CB_LoadValues(cardId, colName) {
  const uid = v => `${cardId}_${v}`;
  SP_CB_Cards[cardId].assigned = { a: [], b: [] };
  SP_CB_RenderTags(cardId);
  await SP_loadDistinctValues(colName, uid('ValueOptions'), true, name => {
    const container = document.getElementById(uid('ValueOptions'));
    container?.querySelector(`.pg-chip-sq[data-value="${CSS.escape(name)}"]`)?.classList.toggle('active');
  });
}

function SP_CB_Assign(cardId, cat) {
  const uid      = v => `${cardId}_${v}`;
  const selected = Array.from(document.querySelectorAll(`#${uid('ValueOptions')} .pg-chip-sq.active`)).map(c => c.getAttribute('data-value'));
  if (!selected.length) return;
  const other = cat === 'a' ? 'b' : 'a';
  selected.forEach(v => {
    SP_CB_Cards[cardId].assigned[other] = SP_CB_Cards[cardId].assigned[other].filter(x => x !== v);
    if (!SP_CB_Cards[cardId].assigned[cat].includes(v)) SP_CB_Cards[cardId].assigned[cat].push(v);
  });
  document.querySelectorAll(`#${uid('ValueOptions')} .pg-chip-sq.active`).forEach(c => c.classList.remove('active'));
  SP_CB_RenderTags(cardId);
}

function SP_CB_RenderTags(cardId) {
  const card = SP_CB_Cards[cardId];
  const uid  = v => `${cardId}_${v}`;
  ['a','b'].forEach(cat => {
    const container = document.getElementById(uid(`Tags${cat.toUpperCase()}`));
    if (!container) return;
    container.innerHTML = '';
    card.assigned[cat].forEach(v => {
      const tag = document.createElement('button');
      tag.type = 'button';
      tag.className = 'pg-chip-sq active';
      tag.textContent = v + ' ✕';
      tag.title = 'Click to remove';
      tag.onclick = () => { card.assigned[cat] = card.assigned[cat].filter(x => x !== v); SP_CB_RenderTags(cardId); };
      container.appendChild(tag);
    });
  });
  document.getElementById(uid('BtnA'))?.classList.toggle('active', card.assigned.a.length > 0);
  document.getElementById(uid('BtnB'))?.classList.toggle('active', card.assigned.b.length > 0);
}

function SP_CB_RemoveCard(cardId) {
  delete SP_CB_Cards[cardId];
  document.getElementById(cardId)?.remove();
}

// ── Apply / Reset ─────────────────────────────────────────────────────────────

function SP_GetCurrentParams() {
  const dmCol    = document.querySelector('#SP_DecisionModeColOptions .pg-chip-sq.active')?.getAttribute('data-value') || '';
  const dmValues = Array.from(document.querySelectorAll('#SP_DecisionModeValueOptions .pg-chip-sq.active')).map(c => c.getAttribute('data-value'));
  const customCards = Object.values(SP_CB_Cards).map(card => ({
    name: card.name, labelA: card.labelA, labelB: card.labelB,
    col:  card.col || '',
    assigned: { a: card.assigned.a.slice(), b: card.assigned.b.slice() },
  }));
  return {
    col1:              document.querySelector('#SP_Col1Options .pg-chip-sq.active')?.getAttribute('data-value') || '',
    values:            Array.from(document.querySelectorAll('#SP_ValueOptions .pg-chip-sq.active')).map(c => c.getAttribute('data-value')),
    numeric:           document.querySelector('#SP_NumericOptions .pg-chip-sq.active')?.getAttribute('data-value') || '',
    currency:          document.getElementById('SP_Currency')?.value || '',
    object:            document.querySelector('#SP_ObjectOptions .pg-chip-sq.active')?.getAttribute('data-value') || '',
    auth_date:         document.querySelector('#SP_DateOptions .pg-chip-sq.active')?.getAttribute('data-value') || '',
    auth_time:         document.querySelector('#SP_TimeOptions .pg-chip-sq.active')?.getAttribute('data-value') || '',
    combined_datetime: SP_DT_MergeActive ? (document.getElementById('SP_DT_MergeName')?.value.trim() || '') : '',
    decisionMode:      { col: dmCol, values: dmValues, assigned: { successful: SP_DM_Assigned.successful.slice(), unsuccessful: SP_DM_Assigned.unsuccessful.slice() } },
    customCards,
  };
}

function SP_ApplyParameters(overrideParams) {
  const params = overrideParams || SP_GetCurrentParams();
  _SP_params = { ...params };
  try { localStorage.setItem('SP_CachedParams', JSON.stringify(params)); } catch(e) {}
  SP_UpdateAppliedDisplay(overrideParams ? params : null);
  if (typeof window.LD_UnlockNav === 'function') window.LD_UnlockNav();
  SP_showToast('Parameters applied', 'success');
}

function SP_ResetParameters() {
  ['SP_Col1Options','SP_ValueOptions','SP_NumericOptions','SP_ObjectOptions','SP_DateOptions','SP_TimeOptions','SP_DecisionModeColOptions','SP_DecisionModeValueOptions']
    .forEach(id => document.getElementById(id)?.querySelectorAll('.pg-chip-sq.active').forEach(c => c.classList.remove('active')));
  const curr = document.getElementById('SP_Currency');
  if (curr) curr.value = '';
  SP_DM_Assigned.successful   = [];
  SP_DM_Assigned.unsuccessful = [];
  SP_DM_RenderTags();
  SP_DT_MergeActive = false;
  const btn = document.getElementById('SP_DT_MergeBtn');
  if (btn) { btn.classList.remove('active'); btn.textContent = 'Merge'; }
  document.getElementById('SP_ValueOptions').innerHTML  = '';
  document.getElementById('SP_DT_PreviewArea').innerHTML = '';
  _SP_params = { col1:'', values:[], numeric:'', currency:'', object:'', auth_date:'', auth_time:'', combined_datetime:'', decisionMode:{ col:'', values:[], assigned:{ successful:[], unsuccessful:[] } } };
  SP_UpdateAppliedDisplay();
  SP_showToast('Parameters reset', 'success');
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
}

// ── Presets (localStorage) ────────────────────────────────────────────────────

const _SP_PRESET_KEY = 'SP_Presets';
function SP_GetPresets() { try { return JSON.parse(localStorage.getItem(_SP_PRESET_KEY) || '{}'); } catch { return {}; } }
function SP_SetPresets(p) { localStorage.setItem(_SP_PRESET_KEY, JSON.stringify(p)); }

function SP_RenderPresetDropdowns() {
  const names = Object.keys(SP_GetPresets());
  const placeholder = '— no presets —';

  ['SP_ViewSelect', 'SP_RemoveSelect', 'SP_LoadSelect'].forEach(id => {
    const container = document.getElementById(id);
    if (!container) return;
    const opts  = container.querySelector('.cs-options');
    const valEl = container.querySelector('.cs-value');
    if (!opts) return;
    opts.innerHTML = `<div class="cs-option cs-selected" data-value="">${placeholder}</div>`;
    if (valEl) valEl.textContent = placeholder;
    names.forEach(name => {
      const opt = document.createElement('div');
      opt.className = 'cs-option';
      opt.setAttribute('data-value', name);
      opt.textContent = name;
      opt.onclick = () => {
        container.querySelectorAll('.cs-option').forEach(o => o.classList.remove('cs-selected'));
        opt.classList.add('cs-selected');
        if (valEl) valEl.textContent = name;
        container.classList.remove('open');
      };
      opts.appendChild(opt);
    });
  });

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
        opt.onclick = () => {
          sidebar.querySelectorAll('.cs-option').forEach(o => o.classList.remove('cs-selected'));
          opt.classList.add('cs-selected');
          if (valEl) valEl.textContent = name;
          sidebar.classList.remove('open');
          _SP_activePreset = name;
          const params = SP_GetPresets()[name];
          if (params) {
            _SP_params = { ...params };
            try { localStorage.setItem('SP_CachedParams', JSON.stringify(params)); } catch(e) {}
            const spView = document.getElementById('SPView');
            if (spView && spView.style.display !== 'none') SP_ApplyPresetParams(params);
          }
          if (typeof window.LD_UnlockNav === 'function') window.LD_UnlockNav();
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
  ['View', 'Save', 'Remove', 'Load'].forEach(t => {
    const isActive = t.toLowerCase() === tab;
    document.getElementById(`SP_Tab_${t}`)?.classList.toggle('active', isActive);
    const panel = document.getElementById(`SP_Panel_${t}`);
    if (panel) panel.style.display = isActive ? 'flex' : 'none';
  });
}

function SP_ViewPreset() {
  const name = SP_getDropdownValue('SP_ViewSelect');
  if (!name) { SP_showToast('Select a preset', 'error'); return; }
  const params = SP_GetPresets()[name];
  if (!params) { SP_showToast('Preset not found', 'error'); return; }
  const lines = SP_BuildParamLines(params);
  const el = document.getElementById('SP_AppliedParamsDisplay');
  if (el) el.textContent = lines.length ? lines.join('\n') : '(empty preset)';
}

function SP_SavePreset() {
  const name = document.getElementById('SP_SaveName')?.value.trim();
  if (!name) { SP_showToast('Enter a preset name', 'error'); return; }
  const presets = SP_GetPresets();
  presets[name] = SP_GetCurrentParams();
  SP_SetPresets(presets);
  document.getElementById('SP_SaveName').value = '';
  SP_showToast('Preset saved: ' + name, 'success');
  SP_RenderPresetDropdowns();
}

function SP_DeletePreset() {
  const name = SP_getDropdownValue('SP_RemoveSelect');
  if (!name) { SP_showToast('Select a preset', 'error'); return; }
  if (!confirm(`Delete preset "${name}"?`)) return;
  const presets = SP_GetPresets();
  delete presets[name];
  SP_SetPresets(presets);
  SP_showToast('Deleted: ' + name, 'success');
  SP_RenderPresetDropdowns();
}

async function SP_LoadPreset() {
  const name = SP_getDropdownValue('SP_LoadSelect');
  if (!name) { SP_showToast('Select a preset', 'error'); return; }
  const params = SP_GetPresets()[name];
  if (!params) { SP_showToast('Preset not found', 'error'); return; }
  _SP_activePreset = name;
  await SP_ApplyPresetParams(params);
}

async function SP_ApplyPresetParams(params) {
  if (!params) return;

  // Restore simple chip selections
  if (params.numeric)   SP_selectSingle('SP_NumericOptions', params.numeric);
  if (params.object)    SP_selectSingle('SP_ObjectOptions',  params.object);
  if (params.auth_date) SP_selectSingle('SP_DateOptions',    params.auth_date);
  if (params.auth_time) SP_selectSingle('SP_TimeOptions',    params.auth_time);
  if (params.currency)  { const el = document.getElementById('SP_Currency'); if (el) el.value = params.currency; }
  if (params.combined_datetime) {
    const el = document.getElementById('SP_DT_MergeName');
    if (el) el.value = params.combined_datetime;
    SP_DT_MergeActive = true;
    document.getElementById('SP_DT_MergeBtn')?.classList.add('active');
  }

  // Restore fraud filter col + values (async — values load after col selected)
  if (params.col1) {
    SP_selectSingle('SP_Col1Options', params.col1);
    SP_LoadFilterValues(params.col1);
    if (params.values?.length) {
      setTimeout(() => {
        params.values.forEach(val => {
          document.querySelector(`#SP_ValueOptions .pg-chip-sq[data-value="${CSS.escape(val)}"]`)?.classList.add('active');
        });
      }, 300);
    }
  }

  // Restore decision mode col + assigned buckets
  if (params.decisionMode?.col) {
    SP_selectSingle('SP_DecisionModeColOptions', params.decisionMode.col);
    SP_LoadDecisionModeValues(params.decisionMode.col);
    SP_DM_Assigned.successful   = (params.decisionMode.assigned?.successful   || []).slice();
    SP_DM_Assigned.unsuccessful = (params.decisionMode.assigned?.unsuccessful || []).slice();
    setTimeout(() => SP_DM_RenderTags(), 300);
  }

  // Restore custom cards — remove any existing first
  Object.keys(SP_CB_Cards).forEach(id => { delete SP_CB_Cards[id]; document.getElementById(id)?.remove(); });
  if (params.customCards?.length) {
    for (const cardData of params.customCards) {
      await SP_CB_RestoreCard(cardData);
    }
  }

  // Apply with the known-good params object — bypasses DOM read
  SP_ApplyParameters(params);
}

// ── Toast ─────────────────────────────────────────────────────────────────────

function SP_showToast(msg, type = '') {
  const container = document.getElementById('LD_ToastContainer');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = 'LD_Toast' + (type ? ' ' + type : '');
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(() => { toast.classList.add('hide'); toast.addEventListener('animationend', () => toast.remove(), { once: true }); }, 10000);
}

// ── Restore cached params on load ─────────────────────────────────────────────

window.SP_getParams = () => _SP_params;

// Populate sidebar dropdown on page load
document.addEventListener('DOMContentLoaded', () => SP_RenderPresetDropdowns());

// Restore cached params from a previous session
