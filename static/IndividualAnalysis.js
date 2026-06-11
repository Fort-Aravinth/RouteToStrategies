// ── Individual Analysis ───────────────────────────────────────────────────────

// ── Strategy Flow ─────────────────────────────────────────────────────────────
let IA_SF_DroppedColumns = [];

function IA_SF_DragStart(event, col) {
  event.dataTransfer.setData('text/plain', col);
}

function IA_SF_OnDrop(event) {
  event.preventDefault();
  const col = event.dataTransfer.getData('text/plain');
  if (!col) return;
  event.currentTarget.classList.remove('drag-over');
  if (IA_SF_DroppedColumns.includes(col)) return;
  IA_SF_DroppedColumns.push(col);
  IA_SF_RenderChain();
}

function IA_SF_RemoveCol(col) {
  IA_SF_DroppedColumns = IA_SF_DroppedColumns.filter(c => c !== col);
  IA_SF_RenderChain();
}

function IA_SF_RenderChain() {
  const chain = document.getElementById('IA_SF_Chain');
  if (!chain) return;
  chain.innerHTML = '';

  IA_SF_DroppedColumns.forEach((col, i) => {
    if (i > 0) {
      const arrow = document.createElement('div');
      arrow.className = 'ia-chain-arrow';
      arrow.textContent = '→';
      chain.appendChild(arrow);
    }
    const node = document.createElement('button');
    node.className = 'SA_StyleChip active';
    node.style.cssText = 'display:inline-flex;align-items:center;gap:6px;flex-shrink:0;border-color:var(--brand-ia-light);background:var(--brand-ia-dim);color:var(--brand-ia-light);';
    node.innerHTML = `<span>${col}</span><span onclick="event.stopPropagation();IA_SF_RemoveCol('${col}')" style="opacity:0.7;font-size:0.75rem;line-height:1;">✕</span>`;
    chain.appendChild(node);
  });

  if (IA_SF_DroppedColumns.length) {
    const arrow = document.createElement('div');
    arrow.className = 'ia-chain-arrow';
    arrow.textContent = '→';
    chain.appendChild(arrow);
  }

  const drop = document.createElement('div');
  drop.className = 'SA_StyleChip';
  drop.style.cssText = 'cursor:default;font-style:italic;color:var(--color-text-dim);min-width:120px;justify-content:center;';
  drop.innerHTML = `<span>${IA_SF_DroppedColumns.length ? '+ drop next' : 'Drag a column here…'}</span>`;
  drop.addEventListener('dragover',  e => { e.preventDefault(); drop.classList.add('drag-over'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('drag-over'));
  drop.addEventListener('drop', IA_SF_OnDrop);
  chain.appendChild(drop);
}

// ── Numeric Filters ───────────────────────────────────────────────────────────
const _IA_NUMERIC_TYPES_MAIN = /int|float|double|decimal|numeric|real|bigint|smallint|tinyint|hugeint|ubigint|uinteger|usmallint|utinyint/;

let IA_NumericColumns = [];
let IA_ActiveSliders  = {};

async function IA_LoadNumericColumns() {
  const conn = window.LD_getConn?.();
  const src  = window.LD_getSource?.();
  if (!conn || !src) return;

  try {
    const desc = await conn.query(`DESCRIBE "${src}"`);
    const numericCols = desc.toArray()
      .filter(r => _IA_NUMERIC_TYPES_MAIN.test((r.column_type || '').toLowerCase()))
      .map(r => r.column_name);

    if (!numericCols.length) { IA_NumericColumns = []; IA_RenderSliders(); return; }

    const sp   = window.SP_getParams?.() || {};
    const excl = new Set([sp.numeric].filter(Boolean));
    const cols = numericCols.filter(c => !excl.has(c));

    const stats = await Promise.all(cols.map(async c => {
      const res = await conn.query(`SELECT MIN("${c}") AS lo, MAX("${c}") AS hi FROM "${src}"`);
      const row = res.toArray()[0];
      return { name: c, min: Number(row.lo ?? 0), max: Number(row.hi ?? 1) };
    }));

    IA_NumericColumns = stats;
    IA_NumericColumns.forEach(col => {
      if (!(col.name in IA_ActiveSliders)) {
        IA_ActiveSliders[col.name] = { min: col.min, max: col.max };
      }
    });
    IA_RenderSliders();
  } catch(e) { console.error('IA numeric cols:', e); }
}

function IA_ToggleSlider(colName) {
  if (colName in IA_ActiveSliders) {
    delete IA_ActiveSliders[colName];
  } else {
    const col = IA_NumericColumns.find(c => c.name === colName);
    if (!col) return;
    IA_ActiveSliders[colName] = { min: col.min, max: col.max };
  }
  IA_RenderSliders();
}

function IA_RenderSliders() {
  const container = document.getElementById('IA_NumericSliders');
  if (!container) return;
  container.innerHTML = '';

  if (!IA_NumericColumns.length) {
    container.innerHTML = '<span style="font-size:0.65rem;color:var(--color-text-dim);font-style:italic;">— No numeric columns —</span>';
    return;
  }

  IA_NumericColumns.forEach(col => {
    const active = col.name in IA_ActiveSliders;
    const state  = active ? IA_ActiveSliders[col.name] : { min: col.min, max: col.max };
    const range  = col.max - col.min;
    const step   = range > 0 ? parseFloat((range / 200).toPrecision(2)) || 1 : 1;
    const id     = 'ias_' + col.name.replace(/[^a-z0-9]/gi, '_');

    const block = document.createElement('div');
    block.className = 'ia-slider-block' + (active ? ' active' : ' inactive');
    block.innerHTML = `
      <div class="ia-slider-header" onclick="IA_ToggleSlider('${col.name}')">
        <span class="ia-slider-name${active ? ' active' : ''}">${col.name}</span>
        <span class="ia-slider-badge${active ? ' active' : ''}">${active ? 'ON' : 'OFF'}</span>
      </div>
      <div style="pointer-events:${active ? 'auto' : 'none'};">
        <div class="ia-slider-row">
          <span class="ia-slider-lbl">Min</span>
          <input type="range" id="${id}_lo" min="${col.min}" max="${col.max}" step="${step}" value="${state.min}"
            oninput="IA_SliderInput('${col.name}','lo',this.value)">
          <input type="number" id="${id}_lo_num" value="${state.min}" step="${step}"
            oninput="IA_SliderInput('${col.name}','lo',this.value)">
        </div>
        <div class="ia-slider-row">
          <span class="ia-slider-lbl">Max</span>
          <input type="range" id="${id}_hi" min="${col.min}" max="${col.max}" step="${step}" value="${state.max}"
            oninput="IA_SliderInput('${col.name}','hi',this.value)">
          <input type="number" id="${id}_hi_num" value="${state.max}" step="${step}"
            oninput="IA_SliderInput('${col.name}','hi',this.value)">
        </div>
      </div>`;
    container.appendChild(block);
  });
}

let _IA_SliderDebounce = null;
function IA_SliderInput(colName, which, value) {
  const col = IA_NumericColumns.find(c => c.name === colName);
  if (!col) return;
  const state = IA_ActiveSliders[colName];
  if (!state) return;
  let v = parseFloat(value);
  if (isNaN(v)) return;
  v = Math.max(col.min, Math.min(col.max, v));
  if (which === 'lo') state.min = Math.min(v, state.max);
  else                state.max = Math.max(v, state.min);
  const id = 'ias_' + colName.replace(/[^a-z0-9]/gi, '_');
  const loSlider = document.getElementById(id + '_lo');
  const hiSlider = document.getElementById(id + '_hi');
  const loNum    = document.getElementById(id + '_lo_num');
  const hiNum    = document.getElementById(id + '_hi_num');
  if (loSlider) loSlider.value = state.min;
  if (hiSlider) hiSlider.value = state.max;
  if (loNum)    loNum.value    = state.min;
  if (hiNum)    hiNum.value    = state.max;
}

// ── Value Counts (Target section) ─────────────────────────────────────────────
let IA_VC_AllCounts   = [];
let IA_VC_SelectedSet = new Set();
let IA_VC_Operator    = 'OR';

function IA_VC_TableInputKeyDown(e) { if (e.key === 'Enter') IA_VC_AddTableInput(); }

function IA_VC_AddTableInput() {
  const inp = document.getElementById('IA_VC_TableInput');
  if (!inp) return;
  const raw = inp.value.trim();
  if (!raw) return;
  raw.split(',').map(v => v.trim()).filter(Boolean).forEach(v => IA_VC_SelectedSet.add(v));
  inp.value = '';
  IA_VC_RenderChips();
}

function IA_VC_ToggleAndOr() {
  IA_VC_Operator = IA_VC_Operator === 'OR' ? 'AND' : 'OR';
  const btn = document.getElementById('IA_VC_AndOrBtn');
  if (btn) btn.textContent = IA_VC_Operator.toLowerCase();
}

async function IA_LoadValueCounts() {
  const conn = window.LD_getConn?.();
  const src  = window.LD_getSource?.();
  const listEl = document.getElementById('IA_VC_List');
  const _msg = txt => { if (listEl) listEl.innerHTML = `<div style="padding:8px 10px;color:var(--color-text-dim);font-style:italic;font-size:0.65rem;">${txt}</div>`; };

  if (!conn || !src)              { _msg('— Load data first —'); return; }
  if (!IA_SF_DroppedColumns.length) { _msg('— Drop a column into the Column Chain first —'); return; }

  const sp  = window.SP_getParams?.() || {};
  const col = IA_SF_DroppedColumns[0];
  _msg('Loading…');

  try {
    let where = '';
    if (sp.col1 && (sp.values || []).length) {
      const vals = sp.values.map(v => `'${String(v).replace(/'/g, "''")}'`).join(',');
      where = `WHERE "${sp.col1}" IN (${vals})`;
    }
    const res = await conn.query(
      `SELECT "${col}" AS val, COUNT(*) AS cnt FROM "${src}" ${where} GROUP BY "${col}" ORDER BY cnt DESC LIMIT 200`
    );
    IA_VC_AllCounts = res.toArray().map(r => ({ val: String(r.val ?? ''), cnt: Number(r.cnt) }));
    IA_VC_FilterList();
  } catch(e) {
    _msg('Error: ' + e.message);
    console.error('IA value counts:', e);
  }
}

function IA_VC_FilterList() {
  const listEl = document.getElementById('IA_VC_List');
  if (!listEl) return;
  const q = (document.getElementById('IA_VC_SearchInput')?.value || '').toLowerCase();
  const filtered = q ? IA_VC_AllCounts.filter(r => r.val.toLowerCase().includes(q)) : IA_VC_AllCounts;

  if (!filtered.length) {
    listEl.innerHTML = '<div style="padding:8px 10px;color:var(--color-text-dim);font-style:italic;font-size:0.65rem;">— No values —</div>';
    return;
  }

  listEl.innerHTML = filtered.map(r => {
    const selected = IA_VC_SelectedSet.has(r.val);
    return `<div onclick="IA_VC_ToggleValue('${r.val.replace(/\\/g,'\\\\').replace(/'/g,"\\'")}', this)"
      style="display:flex;justify-content:space-between;align-items:center;padding:4px 10px;cursor:pointer;font-size:0.65rem;background:${selected ? 'var(--brand-ia-dim)' : 'transparent'};border-bottom:0.5px solid var(--color-card-border);">
      <span style="font-weight:${selected ? '600' : '400'};color:${selected ? 'var(--brand-ia-light)' : 'var(--color-header-title)'};">${r.val}</span>
      <span style="color:var(--color-text-dim);">${r.cnt.toLocaleString()}</span>
    </div>`;
  }).join('');
}

function IA_VC_ToggleValue(val) {
  if (IA_VC_SelectedSet.has(val)) IA_VC_SelectedSet.delete(val);
  else IA_VC_SelectedSet.add(val);
  IA_VC_FilterList();
  IA_VC_RenderChips();
}

function IA_VC_RenderChips() {
  const chips = document.getElementById('IA_VC_Chips');
  if (!chips) return;
  chips.innerHTML = [...IA_VC_SelectedSet].map(v =>
    `<div class="MN_chip MN_chip--a active" style="display:flex;align-items:center;gap:4px;">
      <span>${v}</span>
      <span onclick="IA_VC_RemoveChip('${v.replace(/\\/g,'\\\\').replace(/'/g,"\\'")}');" style="cursor:pointer;opacity:0.7;font-size:0.8rem;line-height:1;">✕</span>
    </div>`
  ).join('');
}

function IA_VC_RemoveChip(val) {
  IA_VC_SelectedSet.delete(val);
  IA_VC_FilterList();
  IA_VC_RenderChips();
}

// ── Run Analysis ──────────────────────────────────────────────────────────────
let IA_LastResults   = null;
let IA_SelectedStrats = new Set();

async function IA_RunAnalysis() {
  const sp   = window.SP_getParams?.() || {};
  const conn = window.LD_getConn?.();
  const src  = window.LD_getSource?.();
  const cols = IA_SF_DroppedColumns;
  const vals = [...IA_VC_SelectedSet];

  if (!conn || !src)  { alert('Load data first'); return; }
  if (!sp.col1)       { alert('Apply parameters first'); return; }
  if (!cols.length)   { alert('Drop at least one column into the Column Chain'); return; }
  if (!vals.length)   { alert('Select at least one value in Target Fraudulent Info'); return; }

  const out = document.getElementById('IA_ResultContainer');
  if (out) out.innerHTML = '<div style="color:var(--color-text-dim);font-size:0.75rem;">Running…</div>';

  try {
    const fraudVals = (sp.values || []).map(v => `'${String(v).replace(/'/g,"''")}'`).join(',');
    const fraudExpr = fraudVals ? `"${sp.col1}" IN (${fraudVals})` : 'FALSE';
    const col0 = cols[0];

    // ── Per-value strategies (primary column) ─────────────────────────────────
    const strategies = [];
    let stratNum = 0;
    for (const val of vals) {
      stratNum++;
      const safe = `'${String(val).replace(/'/g,"''")}'`;
      const res  = await conn.query(
        `SELECT COUNT(*) AS total, SUM(CASE WHEN ${fraudExpr} THEN 1 ELSE 0 END) AS fraud
         FROM "${src}" WHERE "${col0}" = ${safe}`
      );
      const row   = res.toArray()[0];
      const total = Number(row.total ?? 0);
      const fraud = Number(row.fraud ?? 0);
      strategies.push({
        id: 'S' + String(stratNum).padStart(3,'0'),
        col: col0, val, total, fraud,
        fp: fraud > 0 ? +(total / fraud).toFixed(4) : 0,
      });
    }

    // ── Summary across all selected values ────────────────────────────────────
    const allSafe = vals.map(v => `'${String(v).replace(/'/g,"''")}'`).join(',');
    const sumRes  = await conn.query(
      `SELECT COUNT(*) AS total, SUM(CASE WHEN ${fraudExpr} THEN 1 ELSE 0 END) AS fraud
       FROM "${src}" WHERE "${col0}" IN (${allSafe})`
    );
    const sumRow    = sumRes.toArray()[0];
    const sumTotal  = Number(sumRow.total ?? 0);
    const sumFraud  = Number(sumRow.fraud ?? 0);
    const summary   = { total: sumTotal, fraud: sumFraud, fp: sumFraud > 0 ? +(sumTotal / sumFraud).toFixed(4) : 0 };

    // ── Additional columns ────────────────────────────────────────────────────
    // Unique values come from within col1-filtered rows,
    // but counts are from the FULL table (no col1 filter) — matches May behaviour
    const additional = [];
    for (const col of cols.slice(1)) {
      const addRes = await conn.query(
        `SELECT "${col}" AS val,
                COUNT(*) AS total,
                SUM(CASE WHEN ${fraudExpr} THEN 1 ELSE 0 END) AS fraud
         FROM "${src}"
         WHERE "${col}" IN (
           SELECT DISTINCT "${col}" FROM "${src}" WHERE "${col0}" IN (${allSafe})
         )
         GROUP BY "${col}" ORDER BY fraud DESC LIMIT 100`
      );
      for (const r of addRes.toArray()) {
        stratNum++;
        const total = Number(r.total ?? 0);
        const fraud = Number(r.fraud ?? 0);
        additional.push({
          id: 'S' + String(stratNum).padStart(3,'0'),
          col, val: String(r.val ?? ''), total, fraud,
          fp: fraud > 0 ? +(total / fraud).toFixed(4) : 0,
        });
      }
    }

    IA_LastResults = { strategies, summary, additional, col0, cols };
    IA_SelectedStrats = new Set(strategies.map(s => s.id));
    IA_RenderResults();

  } catch(e) {
    if (out) out.innerHTML = `<div style="color:#ef4444;font-size:0.75rem;">Error: ${e.message}</div>`;
    console.error('IA run:', e);
  }
}

// ── Render Results ────────────────────────────────────────────────────────────
function IA_RenderResults() {
  const out = document.getElementById('IA_ResultContainer');
  if (!out || !IA_LastResults) return;
  const { strategies, summary, additional } = IA_LastResults;

  const metricBox = (label, val, origVal, accent) => {
    const strike = origVal != null
      ? `<span style="font-size:0.72rem;text-decoration:line-through;color:var(--color-text-dim);margin-right:4px;">${origVal}</span>`
      : '';
    return `
    <div style="flex:1;display:flex;flex-direction:column;align-items:center;background:var(--color-page-bg);border:0.5px solid var(--color-card-border);border-radius:6px;padding:6px 10px;">
      <span style="font-size:0.58rem;font-weight:700;letter-spacing:0.05em;text-transform:uppercase;color:var(--color-text-dim);">${label}</span>
      <div style="display:flex;align-items:baseline;gap:2px;margin-top:2px;">${strike}<span style="font-size:0.9rem;font-weight:700;color:${accent ? 'var(--brand-ia-light)' : 'var(--color-header-title)'};">${val ?? '—'}</span></div>
    </div>`;
  };

  // ── Card 1: Fraudulent Info to Strategy(ies) ─────────────────────────────
  const stratCards = strategies.map(s => {
    const orig      = s._original;
    const ruleLabel = (s._ruleItems || []).length
      ? s._ruleItems.map(i => i.type === 'block' ? `${IA_RB_Labels[i.calc] || i.calc} ≥ ${i.threshold}` : i.value).join(' ')
      : '';
    return `
    <div style="background:var(--color-page-bg);border:0.5px solid var(--color-card-border);border-radius:8px;padding:10px 12px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
        <div>
          <div style="font-size:0.7rem;font-weight:700;color:var(--color-header-title);">${s.val}</div>
          <div style="font-size:0.6rem;color:var(--color-text-dim);margin-top:1px;">${s.col} · ${s.id}</div>
          ${ruleLabel ? `<div style="font-size:0.62rem;color:#6366f1;font-weight:600;margin-top:3px;">${ruleLabel}</div>` : ''}
        </div>
        <div style="display:flex;gap:4px;flex-shrink:0;">
          <button onclick="IA_CopyStrategy('${s.col.replace(/'/g,"\\'")}',[' ${s.val.replace(/'/g,"\\'")}'.trim()])" class="pg-btn" style="height:24px;padding:0 8px;font-size:0.65rem;font-weight:600;">Copy</button>
          <button onclick="IA_AddStrategy('${s.col.replace(/'/g,"\\'")}',[' ${s.val.replace(/'/g,"\\'")}'.trim()])" class="pg-btn" style="height:24px;padding:0 8px;font-size:0.65rem;font-weight:600;border-color:var(--brand-ia-light);color:var(--brand-ia-light);">Add</button>
          <button onclick="IA_OpenInDepth('${s.id}')" class="pg-btn" style="height:24px;padding:0 8px;font-size:0.65rem;font-weight:600;border-color:#6366f1;color:#6366f1;">In-depth</button>
        </div>
      </div>
      <div style="display:flex;gap:6px;">
        ${metricBox('Total',    s.total.toLocaleString(), orig ? orig.total.toLocaleString() : null, false)}
        ${metricBox('Fraud',    s.fraud.toLocaleString(), orig ? orig.fraud.toLocaleString() : null, false)}
        ${metricBox('FP Ratio', s.fp,                    orig ? orig.fp                     : null, true)}
      </div>
    </div>`;
  }).join('');

  const hasOrig    = strategies.some(s => s._original);
  const origTotal  = strategies.reduce((a, s) => a + (s._original?.total ?? s.total), 0);
  const origFraud  = strategies.reduce((a, s) => a + (s._original?.fraud ?? s.fraud), 0);
  const origFp     = origFraud > 0 ? +(origTotal / origFraud).toFixed(4) : 0;

  const summaryRow = `
    <div style="background:var(--brand-ia-dim);border:0.5px solid var(--brand-ia-light);border-radius:8px;padding:10px 12px;">
      <div style="font-size:0.62rem;font-weight:700;letter-spacing:0.05em;text-transform:uppercase;color:var(--brand-ia-light);margin-bottom:8px;">Summary Report</div>
      <div style="display:flex;gap:6px;">
        ${metricBox('Total',    summary.total.toLocaleString(), hasOrig ? origTotal.toLocaleString() : null, false)}
        ${metricBox('Fraud',    summary.fraud.toLocaleString(), hasOrig ? origFraud.toLocaleString() : null, false)}
        ${metricBox('FP Ratio', summary.fp,                    hasOrig ? origFp                     : null, true)}
      </div>
    </div>`;

  // ── Card 2: Flow Table ────────────────────────────────────────────────────
  const allRows = [...strategies, ...additional];
  const thS = 'padding:6px 12px;font-size:0.6rem;font-weight:700;letter-spacing:0.05em;text-transform:uppercase;color:var(--color-text-dim);border-bottom:1.5px solid var(--brand-ia-light);white-space:nowrap;text-align:left;';
  const tdS = 'padding:5px 12px;font-size:0.72rem;color:var(--color-header-title);border-bottom:0.5px solid var(--color-card-border);white-space:nowrap;';
  const tdA = 'padding:5px 12px;font-size:0.72rem;color:var(--brand-ia-light);font-weight:700;border-bottom:0.5px solid var(--color-card-border);white-space:nowrap;';

  const flowRows = allRows.map((s, i) => `
    <tr style="background:${i % 2 === 0 ? 'transparent' : 'var(--color-page-bg)'};">
      <td style="${tdS}">${s.id}</td>
      <td style="${tdS}">${s.col}</td>
      <td style="${tdS}">${s.val}</td>
      <td style="${tdS}">${s.total.toLocaleString()}</td>
      <td style="${tdS}">${s.fraud.toLocaleString()}</td>
      <td style="${tdA}">${s.fp}</td>
    </tr>`).join('');

  out.innerHTML = `
    <div class="pg-card ia-card">
      <div class="pg-card-header">
        <span class="pg-card-title">Fraudulent Info to Strategy(ies)</span>
        <span class="pg-card-label">${strategies.length} strateg${strategies.length === 1 ? 'y' : 'ies'}</span>
      </div>
      <div class="pg-card-divider"></div>
      <div class="pg-card-body" style="display:flex;flex-direction:column;gap:8px;">
        ${stratCards}
        ${summaryRow}
      </div>
    </div>

    <div class="pg-card ia-card">
      <div class="pg-card-header">
        <span class="pg-card-title">Flow Table</span>
        <span class="pg-card-label">${allRows.length} rows</span>
      </div>
      <div class="pg-card-divider"></div>
      <div style="overflow-x:auto;">
        <table class="pg-table" style="width:100%;">
          <thead><tr>
            <th style="${thS}">Strategy</th>
            <th style="${thS}">Column</th>
            <th style="${thS}">Value</th>
            <th style="${thS}">Total</th>
            <th style="${thS}">Fraud</th>
            <th style="${thS}">FP Ratio</th>
          </tr></thead>
          <tbody>${flowRows}</tbody>
        </table>
      </div>
    </div>`;
}

// ── Copy / Add strategy payload ───────────────────────────────────────────────
let _IA_IdSeq = 0;
function _IA_buildPayload(col, values) {
  const sp = window.SP_getParams?.() || {};
  return {
    AmountInformation: { FilterByAmount: false, AmountMetric: sp.numeric || '', Conditions: [] },
    MerchantInformation: { SelectedColumn: '', ColumnOperator: 'isin', MerchantList: [] },
    ScoreInformation: [{ FilterByScore: false, ScoreMetric: null, Conditions: [] }],
    AdditionalColumns: [{ Column: col, Operator: 'isin', Values: values }],
    Source: 'Individual Analysis',
    ID: 'Individual_Analysis_' + Date.now() + '_' + (++_IA_IdSeq),
  };
}

function IA_CopyStrategy(col, values) {
  const payload = _IA_buildPayload(col, values);
  if (typeof APP_CopyText === 'function') APP_CopyText(JSON.stringify(payload, null, 2));
}

function IA_AddStrategy(col, values) {
  const payload = _IA_buildPayload(col, values);
  if (typeof APP_CopyText === 'function') APP_CopyText(JSON.stringify(payload, null, 2));
  if (typeof _RMON_Persist === 'function') _RMON_Persist(payload);
}

// ── In-depth Analysis ─────────────────────────────────────────────────────────
let IA_InDepthRow  = null;
let IA_InDepthStrat = null;

function IA_OpenInDepth(stratId) {
  const strat = (IA_LastResults?.strategies || []).find(s => s.id === stratId);
  if (!strat) return;
  IA_InDepthRow   = strat;
  IA_InDepthStrat = strat;
  document.getElementById('IA_InDepthModal').style.display = 'flex';
  document.getElementById('IA_InDepthTitle').textContent   = strat.id + ' — ' + strat.val;
  document.getElementById('IA_InDepthDistResult').innerHTML = '';
  document.getElementById('IA_RB_Result').innerHTML = '';

  const thS = 'padding:6px 12px;font-size:0.6rem;font-weight:700;letter-spacing:0.05em;text-transform:uppercase;color:var(--color-text-dim);border-bottom:1.5px solid var(--brand-ia-light);text-align:left;';
  const tdS = 'padding:5px 12px;font-size:0.72rem;color:var(--color-header-title);border-bottom:0.5px solid var(--color-card-border);';
  const tdA = 'padding:5px 12px;font-size:0.72rem;color:var(--brand-ia-light);font-weight:700;border-bottom:0.5px solid var(--color-card-border);';
  document.getElementById('IA_InDepthSummary').innerHTML = `
    <table class="pg-table" style="width:100%;">
      <thead><tr>
        <th style="${thS}">Column</th><th style="${thS}">Value</th>
        <th style="${thS}">Total</th><th style="${thS}">Fraud</th><th style="${thS}">FP Ratio</th>
      </tr></thead>
      <tbody><tr>
        <td style="${tdS}">${strat.col}</td>
        <td style="${tdS}">${strat.val}</td>
        <td style="${tdS}">${strat.total.toLocaleString()}</td>
        <td style="${tdS}">${strat.fraud.toLocaleString()}</td>
        <td style="${tdA}">${strat.fp}</td>
      </tr></tbody>
    </table>`;

  IA_RB_Items = JSON.parse(JSON.stringify(strat._ruleItems || []));
  IA_RB_Render();
  if (IA_RB_Items.length) IA_RB_LiveUpdate();
}

function IA_CloseInDepth() {
  document.getElementById('IA_InDepthModal').style.display = 'none';
}

// ── Distribution (Per Day / Hour / 30Min / 15Min) ─────────────────────────────
async function IA_InDepthRun(calcType, btn) {
  const body = document.getElementById('IA_InDepthDistResult');
  const sp   = window.SP_getParams?.() || {};
  const conn = window.LD_getConn?.();
  const src  = window.LD_getSource?.();
  const strat = IA_InDepthRow;
  if (!strat || !conn || !src) return;

  // Highlight button
  document.getElementById('IA_InDepthIntervalBtns').querySelectorAll('button').forEach(b => {
    b.style.borderColor = ''; b.style.color = '';
  });
  btn.style.borderColor = 'var(--brand-ia-light)';
  btn.style.color       = 'var(--brand-ia-light)';

  const dateCol     = sp.auth_date;
  const datetimeCol = sp.combined_datetime;
  const cardDim     = sp.object;
  const numeric     = sp.numeric;
  const fraudVals   = (sp.values || []).map(v => `'${String(v).replace(/'/g,"''")}'`).join(',');
  const fraudExpr   = fraudVals ? `"${sp.col1}" IN (${fraudVals})` : 'FALSE';
  const colSafe     = `'${String(strat.val).replace(/'/g,"''")}'`;

  if (calcType === 'PerDay' && !dateCol)     { body.innerHTML = '<div style="font-size:0.72rem;color:var(--color-text-dim);">Auth Date parameter not set.</div>'; return; }
  if (calcType !== 'PerDay' && !datetimeCol) { body.innerHTML = '<div style="font-size:0.72rem;color:var(--color-text-dim);">Combined Date &amp; Time parameter not set.</div>'; return; }
  if (!cardDim) { body.innerHTML = '<div style="font-size:0.72rem;color:var(--color-text-dim);">Card Dimension parameter not set.</div>'; return; }

  body.innerHTML = '<div style="font-size:0.72rem;color:var(--color-text-dim);">Loading…</div>';

  try {
    let bucketExpr;
    if (calcType === 'PerDay')   bucketExpr = `CAST("${dateCol}" AS VARCHAR)`;
    if (calcType === 'PerHour')  bucketExpr = `STRFTIME(DATE_TRUNC('hour', CAST("${datetimeCol}" AS TIMESTAMP)), '%Y-%m-%d %H:00')`;
    if (calcType === 'Per30Min') bucketExpr = `STRFTIME(DATE_TRUNC('hour', CAST("${datetimeCol}" AS TIMESTAMP)) + INTERVAL (EXTRACT(MINUTE FROM CAST("${datetimeCol}" AS TIMESTAMP))::INT / 30 * 30) MINUTE, '%Y-%m-%d %H:%M')`;
    if (calcType === 'Per15Min') bucketExpr = `STRFTIME(DATE_TRUNC('hour', CAST("${datetimeCol}" AS TIMESTAMP)) + INTERVAL (EXTRACT(MINUTE FROM CAST("${datetimeCol}" AS TIMESTAMP))::INT / 15 * 15) MINUTE, '%Y-%m-%d %H:%M')`;

    const amtExpr = numeric ? `"${numeric}"` : '0';

    const res = await conn.query(`
      WITH base AS (
        SELECT *,
          CASE WHEN ${fraudExpr} THEN 1 ELSE 0 END AS _is_fraud,
          ${bucketExpr} AS _bucket
        FROM "${src}" WHERE "${strat.col}" = ${colSafe}
      ),
      annotated AS (
        SELECT *,
          COUNT(*)        OVER (PARTITION BY "${cardDim}", _bucket) AS total_count,
          SUM(${amtExpr}) OVER (PARTITION BY "${cardDim}", _bucket) AS total_sum,
          COUNT(*) FILTER (WHERE _is_fraud = 1) OVER (PARTITION BY "${cardDim}", _bucket) AS fraud_count,
          SUM(${amtExpr}) FILTER (WHERE _is_fraud = 1) OVER (PARTITION BY "${cardDim}", _bucket) AS fraud_sum
        FROM base
      ),
      total_agg AS (
        SELECT total_count AS velocity, COUNT(*) AS cnt_total, SUM(total_sum) AS sum_total
        FROM annotated GROUP BY total_count
      ),
      fraud_agg AS (
        SELECT fraud_count AS velocity, COUNT(*) AS cnt_fraud, SUM(fraud_sum) AS sum_fraud
        FROM annotated WHERE _is_fraud = 1 GROUP BY fraud_count
      )
      SELECT COALESCE(t.velocity, f.velocity) AS velocity,
             COALESCE(t.cnt_total, 0) AS cnt_total,
             COALESCE(t.sum_total, 0) AS sum_total,
             COALESCE(f.cnt_fraud, 0) AS cnt_fraud,
             COALESCE(f.sum_fraud, 0) AS sum_fraud
      FROM total_agg t FULL JOIN fraud_agg f ON t.velocity = f.velocity
      ORDER BY velocity`);

    const rows = res.toArray();

    // May formula: Dist% = velocity / sum(all velocities), not count/total_count
    const sumVelTotal = rows.reduce((a, r) => a + Number(r.velocity), 0);
    const sumVelFraud = rows.filter(r => Number(r.cnt_fraud) > 0).reduce((a, r) => a + Number(r.velocity), 0);
    let cumT = 0, cumF = 0;

    const labels = { PerDay:'Day', PerHour:'Hour', Per30Min:'30 Min', Per15Min:'15 Min' };
    const thS = 'padding:5px 10px;font-size:0.6rem;font-weight:700;letter-spacing:0.05em;text-transform:uppercase;color:var(--color-text-dim);border-bottom:1.5px solid var(--brand-ia-light);text-align:left;white-space:nowrap;';
    const tdS = 'padding:4px 10px;font-size:0.7rem;color:var(--color-header-title);border-bottom:0.5px solid var(--color-card-border);white-space:nowrap;';
    const tdA = 'padding:4px 10px;font-size:0.7rem;color:var(--brand-ia-light);font-weight:700;border-bottom:0.5px solid var(--color-card-border);white-space:nowrap;';

    const bodyRows = rows.map((r, i) => {
      const vel  = Number(r.velocity);
      const cntT = Number(r.cnt_total), sumT = Number(r.sum_total);
      const cntF = Number(r.cnt_fraud), sumF = Number(r.sum_fraud);
      const hasFraud = cntF > 0;

      const tDist = sumVelTotal > 0 ? (vel / sumVelTotal * 100).toFixed(2) : '0.00';
      const fDist = hasFraud && sumVelFraud > 0 ? (vel / sumVelFraud * 100).toFixed(2) : '0.00';
      cumT += sumVelTotal > 0 ? vel / sumVelTotal * 100 : 0;
      if (hasFraud && sumVelFraud > 0) cumF += vel / sumVelFraud * 100;
      const tCum = cumT.toFixed(2);
      const fCum = hasFraud ? cumF.toFixed(2) : '0.00';

      const fmt2 = n => Number(n).toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2});
      return `<tr style="background:${i%2===0?'transparent':'var(--color-page-bg)'};">
        <td style="${tdS}">${vel}</td>
        <td style="${tdS}">${cntT.toLocaleString()}</td>
        <td style="${tdS}">${fmt2(sumT)}</td>
        <td style="${tdS}">${tDist}%</td>
        <td style="${tdA}">${tCum}%</td>
        <td style="${tdS}">${cntF.toLocaleString()}</td>
        <td style="${tdS}">${fmt2(sumF)}</td>
        <td style="${tdS}">${fDist}%</td>
        <td style="${tdA}">${fCum}%</td>
      </tr>`;
    }).join('');

    const label = labels[calcType] || calcType;
    body.innerHTML = `<div style="overflow-x:auto;"><table class="pg-table" style="width:100%;">
      <thead><tr>
        <th style="${thS}">${label}</th>
        <th style="${thS}">#Total</th><th style="${thS}">&#x3A3;Total</th>
        <th style="${thS}">T.Dist%</th><th style="${thS}">T.Cum%</th>
        <th style="${thS}">#Fraud</th><th style="${thS}">&#x3A3;Fraud</th>
        <th style="${thS}">F.Dist%</th><th style="${thS}">F.Cum%</th>
      </tr></thead>
      <tbody>${bodyRows}</tbody>
    </table></div>`;

  } catch(e) {
    body.innerHTML = `<div style="font-size:0.72rem;color:#ef4444;">Error: ${e.message}</div>`;
    console.error('IA indepth:', e);
  }
}

// ── Rule Builder ──────────────────────────────────────────────────────────────
const IA_RB_Labels = { PerDay:'Per Day', PerHour:'Per Hour', Per30Min:'Per 30 Min', Per15Min:'Per 15 Min' };
let IA_RB_Items      = [];
let IA_RB_DragSrc    = null;
let IA_RB_DragPayload = null;
let IA_RB_DropIdx    = null;
let _ia_rb_liveTimer = null;

function IA_RB_PaletteDrag(e, type, value) {
  IA_RB_DragSrc     = 'palette';
  IA_RB_DragPayload = { type, value };
  e.dataTransfer.effectAllowed = 'copy';
}

function IA_RB_ItemDragStart(e, idx) {
  IA_RB_DragSrc = idx;
  e.dataTransfer.effectAllowed = 'move';
  e.stopPropagation();
}

function IA_RB_DragOver(e) {
  e.preventDefault();
  const canvas = document.getElementById('IA_RB_Canvas');
  canvas.style.borderColor = '#6366f1';
  const items = [...canvas.querySelectorAll('.rb-item')];
  let insertIdx = IA_RB_Items.length;
  for (let i = 0; i < items.length; i++) {
    const rect = items[i].getBoundingClientRect();
    if (e.clientX < rect.left + rect.width / 2) { insertIdx = i; break; }
  }
  IA_RB_DropIdx = insertIdx;
  items.forEach((el, i) => el.style.borderLeft = i === insertIdx ? '2px solid #6366f1' : '');
}

function IA_RB_DragLeave(e) {
  const canvas = document.getElementById('IA_RB_Canvas');
  if (!canvas.contains(e.relatedTarget)) {
    canvas.style.borderColor = '';
    canvas.querySelectorAll('.rb-item').forEach(el => el.style.borderLeft = '');
  }
}

function IA_RB_Drop(e) {
  e.preventDefault();
  const canvas = document.getElementById('IA_RB_Canvas');
  canvas.style.borderColor = '';
  canvas.querySelectorAll('.rb-item').forEach(el => el.style.borderLeft = '');
  const idx = IA_RB_DropIdx ?? IA_RB_Items.length;
  if (IA_RB_DragSrc === 'palette') {
    const { type, value } = IA_RB_DragPayload;
    const id   = 'rb_' + Date.now() + '_' + Math.random().toString(36).slice(2,6);
    const item = type === 'block' ? { id, type, calc: value, threshold: 0 } : { id, type, value };
    IA_RB_Items.splice(idx, 0, item);
  } else {
    const srcIdx = IA_RB_DragSrc;
    const [item] = IA_RB_Items.splice(srcIdx, 1);
    IA_RB_Items.splice(idx > srcIdx ? idx - 1 : idx, 0, item);
  }
  IA_RB_Render();
  IA_RB_UpdatePreview();
  clearTimeout(_ia_rb_liveTimer);
  _ia_rb_liveTimer = setTimeout(IA_RB_LiveUpdate, 400);
}

function IA_RB_Remove(id) {
  IA_RB_Items = IA_RB_Items.filter(i => i.id !== id);
  IA_RB_Render();
  IA_RB_UpdatePreview();
  clearTimeout(_ia_rb_liveTimer);
  _ia_rb_liveTimer = setTimeout(IA_RB_LiveUpdate, 400);
}

function IA_RB_SetThreshold(id, val) {
  const item = IA_RB_Items.find(i => i.id === id);
  if (item) item.threshold = parseInt(val) || 0;
  IA_RB_UpdatePreview();
  clearTimeout(_ia_rb_liveTimer);
  _ia_rb_liveTimer = setTimeout(IA_RB_LiveUpdate, 400);
}

function IA_RB_Clear() {
  IA_RB_Items = [];
  IA_RB_Render();
  const r = document.getElementById('IA_RB_Result');
  if (r) r.innerHTML = '';
}

function IA_RB_Render() {
  const canvas = document.getElementById('IA_RB_Canvas');
  if (!canvas) return;
  if (!IA_RB_Items.length) {
    canvas.innerHTML = '<span id="IA_RB_Placeholder" style="font-size:0.72rem;color:var(--color-text-dim);">Drag items here to build your rule…</span>';
    IA_RB_UpdatePreview(); return;
  }
  canvas.innerHTML = IA_RB_Items.map((item, idx) => {
    const drag = `class="rb-item" draggable="true" ondragstart="IA_RB_ItemDragStart(event,${idx})"`;
    if (item.type === 'block') {
      return `<div ${drag} style="display:inline-flex;align-items:center;gap:4px;padding:4px 8px;border-radius:5px;border:1px solid var(--color-card-border);background:var(--color-card-bg);font-size:0.68rem;cursor:grab;">
        <span style="font-weight:600;color:var(--color-header-title);">${IA_RB_Labels[item.calc]||item.calc}</span>
        <span style="color:var(--color-text-dim);">≥</span>
        <input type="number" value="${item.threshold}" min="0" oninput="IA_RB_SetThreshold('${item.id}',this.value)" onclick="event.stopPropagation()"
          style="width:40px;height:20px;padding:0 4px;border:1px solid var(--color-card-border);border-radius:3px;font-size:0.68rem;background:var(--color-page-bg);color:var(--color-header-title);" />
        <span onclick="IA_RB_Remove('${item.id}')" style="cursor:pointer;color:var(--color-text-dim);font-size:0.75rem;line-height:1;margin-left:2px;">×</span>
      </div>`;
    } else if (item.type === 'operator') {
      const c = item.value === 'AND' ? '#6366f1' : '#0891b2';
      return `<div ${drag} style="display:inline-flex;align-items:center;gap:4px;padding:4px 8px;border-radius:5px;border:1px solid ${c};background:var(--color-page-bg);font-size:0.68rem;font-weight:700;color:${c};cursor:grab;">
        ${item.value}<span onclick="IA_RB_Remove('${item.id}')" style="cursor:pointer;opacity:0.6;font-size:0.75rem;line-height:1;margin-left:2px;">×</span>
      </div>`;
    } else {
      return `<div ${drag} style="display:inline-flex;align-items:center;gap:4px;padding:4px 8px;border-radius:5px;border:1px solid var(--brand-ia-light);background:var(--color-page-bg);font-size:0.78rem;font-weight:700;color:var(--brand-ia-light);cursor:grab;">
        ${item.value}<span onclick="IA_RB_Remove('${item.id}')" style="cursor:pointer;opacity:0.6;font-size:0.75rem;line-height:1;margin-left:2px;">×</span>
      </div>`;
    }
  }).join('');
  IA_RB_UpdatePreview();
}

function IA_RB_UpdatePreview() {
  const el = document.getElementById('IA_RB_Preview');
  if (!el) return;
  el.textContent = IA_RB_Items.length
    ? IA_RB_Items.map(i => i.type === 'block' ? `${IA_RB_Labels[i.calc]||i.calc} ≥ ${i.threshold}` : i.value).join(' ')
    : '';
}

async function IA_RB_LiveUpdate() {
  const result = document.getElementById('IA_RB_Result');
  const sp     = window.SP_getParams?.() || {};
  const conn   = window.LD_getConn?.();
  const src    = window.LD_getSource?.();
  const strat  = IA_InDepthRow;
  if (!result || !strat || !conn || !src) return;

  const blocks = IA_RB_Items.filter(i => i.type === 'block');
  if (!blocks.length) { result.innerHTML = ''; return; }

  result.innerHTML = '<div style="font-size:0.72rem;color:var(--color-text-dim);">Calculating…</div>';

  try {
    const dateCol     = sp.auth_date;
    const datetimeCol = sp.combined_datetime;
    const cardDim     = sp.object;
    const fraudVals   = (sp.values || []).map(v => `'${String(v).replace(/'/g,"''")}'`).join(',');
    const fraudExpr   = fraudVals ? `"${sp.col1}" IN (${fraudVals})` : 'FALSE';
    const colSafe     = `'${String(strat.val).replace(/'/g,"''")}'`;

    // Build velocity sub-selects for each unique block type
    const blockTypes = [...new Set(blocks.map(b => b.calc))];
    const thresholds = {};
    blocks.forEach(b => { thresholds[b.calc] = (thresholds[b.calc] || 0) + b.threshold; });

    const _bucketExpr = calcType => {
      if (calcType === 'PerDay')   return dateCol     ? `CAST("${dateCol}" AS VARCHAR)`                                                                    : null;
      if (calcType === 'PerHour')  return datetimeCol ? `STRFTIME(DATE_TRUNC('hour', CAST("${datetimeCol}" AS TIMESTAMP)), '%Y-%m-%d %H:00')`              : null;
      if (calcType === 'Per30Min') return datetimeCol ? `STRFTIME(DATE_TRUNC('hour', CAST("${datetimeCol}" AS TIMESTAMP)) + INTERVAL (EXTRACT(MINUTE FROM CAST("${datetimeCol}" AS TIMESTAMP))::INT / 30 * 30) MINUTE, '%Y-%m-%d %H:%M')` : null;
      if (calcType === 'Per15Min') return datetimeCol ? `STRFTIME(DATE_TRUNC('hour', CAST("${datetimeCol}" AS TIMESTAMP)) + INTERVAL (EXTRACT(MINUTE FROM CAST("${datetimeCol}" AS TIMESTAMP))::INT / 15 * 15) MINUTE, '%Y-%m-%d %H:%M')` : null;
    };

    // Build a CTE that flags rows meeting ALL block conditions
    let cteSQL = `WITH base AS (
      SELECT *, ${fraudExpr ? `CASE WHEN ${fraudExpr} THEN 1 ELSE 0 END` : '0'} AS _is_fraud
      FROM "${src}" WHERE "${strat.col}" = ${colSafe}
    )`;

    const conditions = [];
    for (const calcType of blockTypes) {
      const bExpr = _bucketExpr(calcType);
      if (!bExpr || !cardDim) continue;
      const threshold = thresholds[calcType];
      cteSQL += `, vel_${calcType} AS (
        SELECT "${cardDim}", ${bExpr} AS bucket, COUNT(*) AS cnt
        FROM base GROUP BY "${cardDim}", bucket
      ), pass_${calcType} AS (
        SELECT DISTINCT "${cardDim}" FROM vel_${calcType} WHERE cnt >= ${threshold}
      )`;
      conditions.push(`base."${cardDim}" IN (SELECT "${cardDim}" FROM pass_${calcType})`);
    }

    if (!conditions.length) { result.innerHTML = ''; return; }

    const finalWhere = conditions.join(' AND ');
    const res = await conn.query(`${cteSQL}
      SELECT COUNT(*) AS total, SUM(_is_fraud) AS fraud FROM base WHERE ${finalWhere}`);

    const row   = res.toArray()[0];
    const total = Number(row.total ?? 0);
    const fraud = Number(row.fraud ?? 0);
    const fp    = fraud > 0 ? +(total / fraud).toFixed(4) : 0;

    const thS = 'padding:5px 10px;font-size:0.6rem;font-weight:700;letter-spacing:0.05em;text-transform:uppercase;color:var(--color-text-dim);border-bottom:1.5px solid var(--brand-ia-light);text-align:left;';
    const tdS = 'padding:4px 10px;font-size:0.72rem;color:var(--color-header-title);border-bottom:0.5px solid var(--color-card-border);';
    const tdA = 'padding:4px 10px;font-size:0.72rem;color:var(--brand-ia-light);font-weight:700;border-bottom:0.5px solid var(--color-card-border);';
    result.innerHTML = `<table class="pg-table" style="width:100%;"><thead><tr>
      <th style="${thS}">Total</th><th style="${thS}">Fraud</th><th style="${thS}">FP Ratio</th>
    </tr></thead><tbody><tr>
      <td style="${tdS}">${total.toLocaleString()}</td>
      <td style="${tdS}">${fraud.toLocaleString()}</td>
      <td style="${tdA}">${fp}</td>
    </tr></tbody></table>`;

    // Store for Apply
    IA_InDepthRow._pendingRule = { total, fraud, fp, ruleItems: JSON.parse(JSON.stringify(IA_RB_Items)) };
  } catch(e) {
    result.innerHTML = `<div style="font-size:0.72rem;color:#ef4444;">Error: ${e.message}</div>`;
    console.error('IA rule:', e);
  }
}

function IA_ApplyRuleToStrategy() {
  if (!IA_InDepthRow?._pendingRule || !IA_LastResults) return;
  const strat = IA_LastResults.strategies.find(s => s.id === IA_InDepthRow.id);
  if (!strat) return;
  const { total, fraud, fp, ruleItems } = IA_InDepthRow._pendingRule;
  strat._original  = strat._original || { total: strat.total, fraud: strat.fraud, fp: strat.fp };
  strat.total      = total;
  strat.fraud      = fraud;
  strat.fp         = fp;
  strat._ruleItems = ruleItems;
  IA_CloseInDepth();
  IA_RenderResults();
}

// ── Init on open ──────────────────────────────────────────────────────────────
window.IA_InitView = function() {
  IA_SF_RenderChain();
  IA_LoadNumericColumns();
};
