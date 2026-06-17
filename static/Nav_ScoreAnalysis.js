// ── Nav_ScoreAnalysis — SA mini-nav controls ──────────────────────────────────

let _NAV_SA_AutoRunTimer = null;
let _NAV_SA_MinMaxCache  = {};

// ── Column population ─────────────────────────────────────────────────────────
async function NAV_SA_PopulateColumns() {
  const conn = window.LD_getConn ? window.LD_getConn() : null;
  if (!conn) return;
  const src    = window.LD_getSource ? window.LD_getSource() : 'cm_data';
  const params = window.SP_getParams ? window.SP_getParams() : {};
  let cols = [];
  try {
    const res = await conn.query(`DESCRIBE ${src}`);
    cols = res.toArray().map(r => ({ name: r.column_name, type: (r.column_type || '').toUpperCase() }));
  } catch { return; }

  const numTypes = ['INTEGER','BIGINT','DOUBLE','FLOAT','DECIMAL','REAL','HUGEINT','UBIGINT','UINTEGER','SMALLINT','TINYINT'];
  const numCols  = cols.filter(c => numTypes.some(t => c.type.startsWith(t))).map(c => c.name);

  // Query unique counts for all numeric cols in one pass
  let uniqueCounts = {};
  try {
    const countExprs = numCols.map(c => `COUNT(DISTINCT "${c}") AS "${c}"`).join(', ');
    const row = (await conn.query(`SELECT ${countExprs} FROM ${src}`)).toArray()[0];
    numCols.forEach(c => { uniqueCounts[c] = Number(row[c] ?? 0); });
  } catch { numCols.forEach(c => { uniqueCounts[c] = 999; }); }

  // Score cols: exclude the SP amount column and low-cardinality cols (< 10 unique)
  const amtMetricCol = params.numeric || '';
  const scoreCols = numCols.filter(c => c !== amtMetricCol && uniqueCounts[c] >= 10);

  NAV_SA_FillScoreCS(scoreCols);

  // Amount Filter dropdown — only the SP Amount Metric Column
  const amtCS = document.getElementById('SAAmountColCS');
  if (amtCS) {
    const amtInData = amtMetricCol && numCols.includes(amtMetricCol);
    amtCS.querySelector('.cs-options').innerHTML = amtInData
      ? `<div class="cs-option cs-selected" data-value="${amtMetricCol}" onclick="SA_selectCS(this,'${amtMetricCol}','NAV_SA_OnAmountColChange')">${amtMetricCol}</div>`
      : `<div class="cs-option" data-value="" style="color:var(--dml-label)">— No amount column set —</div>`;
    if (amtInData && !SA_getCSValue('SAAmountColCS')) {
      const opt = amtCS.querySelector(`.cs-option[data-value="${CSS.escape(amtMetricCol)}"]`);
      if (opt) SA_selectCS(opt, amtMetricCol, null);
      NAV_SA_OnAmountColChange();
    }
  }

  if (!SA_getCSValue('SAScoreColCS')) {
    const guess = scoreCols.find(c => /score/i.test(c));
    if (guess) NAV_SA_SetScoreCS(guess);
  }

  NAV_SA_OnScoreColChange();
}


function NAV_SA_FillScoreCS(options) {
  const cs = document.getElementById('SAScoreColCS');
  if (!cs) return;
  const cur = cs.dataset.value || '';
  const opts = cs.querySelector('.cs-options');
  if (!opts) return;
  opts.innerHTML = `<div class="cs-option${!cur ? ' cs-selected' : ''}" data-value="" onclick="SA_selectCS(this,'','NAV_SA_OnScoreColChange')" style="color:var(--dml-label)">— Select column —</div>` +
    options.map(o => `<div class="cs-option${o === cur ? ' cs-selected' : ''}" data-value="${o}" onclick="SA_selectCS(this,'${o}','NAV_SA_OnScoreColChange')">${o}</div>`).join('');
}

function NAV_SA_SetScoreCS(value) {
  const cs = document.getElementById('SAScoreColCS');
  if (!cs) return;
  const opt = cs.querySelector(`.cs-option[data-value="${CSS.escape(value)}"]`);
  if (opt) { SA_selectCS(opt, value, null); }
  else { cs.dataset.value = value; const v = cs.querySelector('.cs-value'); if (v) { v.textContent = value; v.style.color = ''; } }
  NAV_SA_OnScoreColChange();
}

async function NAV_SA_OnScoreColChange() {
  const col = SA_getCSValue('SAScoreColCS');
  const minMaxEl = document.getElementById('SAMinMax');
  if (!col || !minMaxEl) { if (minMaxEl) minMaxEl.style.display = 'none'; return; }

  const conn = window.LD_getConn ? window.LD_getConn() : null;
  const src  = window.LD_getSource ? window.LD_getSource() : 'cm_data';
  if (!conn) return;
  try {
    const cacheKey = `${src}|${col}`;
    let mn, mx;
    if (_NAV_SA_MinMaxCache[cacheKey]) {
      ({ mn, mx } = _NAV_SA_MinMaxCache[cacheKey]);
    } else {
      const res = await conn.query(`SELECT MIN("${col}") AS mn, MAX("${col}") AS mx FROM ${src}`);
      const row = res.toArray()[0];
      mn = Number(row.mn); mx = Number(row.mx);
      _NAV_SA_MinMaxCache[cacheKey] = { mn, mx };
    }
    document.getElementById('SAMin').textContent = mn;
    document.getElementById('SAMax').textContent = mx;
    minMaxEl.style.display = 'block';
    if (!document.getElementById('SAStart').value) document.getElementById('SAStart').value = mn;
    if (!document.getElementById('SAEnd').value)   document.getElementById('SAEnd').value   = mx;
  } catch { minMaxEl.style.display = 'none'; }
}

async function NAV_SA_OnAmountColChange() {
  const col  = SA_getCSValue('SAAmountColCS');
  const conn = window.LD_getConn ? window.LD_getConn() : null;
  const src  = window.LD_getSource ? window.LD_getSource() : 'cm_data';
  if (col && conn) {
    try {
      const cacheKey = `${src}|${col}`;
      let mn, mx;
      if (_NAV_SA_MinMaxCache[cacheKey]) {
        ({ mn, mx } = _NAV_SA_MinMaxCache[cacheKey]);
      } else {
        const res = await conn.query(`SELECT MIN("${col}") AS mn, MAX("${col}") AS mx FROM ${src}`);
        const row = res.toArray()[0];
        mn = Number(row.mn); mx = Number(row.mx);
        _NAV_SA_MinMaxCache[cacheKey] = { mn, mx };
      }
      const startEl = document.getElementById('SAAmountValStart');
      const endEl   = document.getElementById('SAAmountValEnd');
      if (startEl) { startEl.placeholder = mn; startEl.value = ''; }
      if (endEl)   { endEl.placeholder   = mx; endEl.value   = ''; }
    } catch {}
  }
  NAV_SA_AutoRun();
}

// ── Params display ────────────────────────────────────────────────────────────
function NAV_SA_RenderParams() {
  if (typeof window.SP_RenderParamsTo === 'function') {
    window.SP_RenderParamsTo('NAV_SA_ParamsDisplay', 'sa');
  }
}

// ── Extra param cards (Decision Mode + custom cards) ──────────────────────────
function NAV_SA_RefreshExtraCards() {
  const p  = window.SP_getParams ? window.SP_getParams() : {};
  const el = document.getElementById('NAV_SA_ExtraCards');
  if (!el) return;

  const makeCard = (key, title, col, aVals, bVals, labelA, labelB) => {
    const btn = (v, group) =>
      `<button class="MN_btn MN_paramVal" onclick="NAV_SA_ToggleParamVal('${key}','${group}','${v}',this)"
        style="flex:0 0 auto;min-width:32px;height:24px;padding:0 4px;font-size:0.62rem;border-radius:5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${v}</button>`;
    const arrowBtn = (dir) =>
      `<button onmousedown="MN_scrollStart(this.${dir==='left'?'nextElementSibling':'previousElementSibling'},${dir==='left'?-80:80})" onmouseup="MN_scrollStop()" onmouseleave="MN_scrollStop()"
        style="flex-shrink:0;width:18px;height:24px;background:none;border:0.5px solid var(--color-card-border);border-radius:4px;cursor:pointer;display:flex;align-items:center;justify-content:center;color:var(--color-text-dim);padding:0;">
        <svg viewBox="0 0 10 10" width="7" height="7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="${dir==='left'?'7 2 3 5 7 8':'3 2 7 5 3 8'}"/>
        </svg>
      </button>`;
    const scrollRow = (btns) => btns
      ? `<div style="display:flex;align-items:center;gap:3px;">${arrowBtn('left')}<div class="MN_chip_row" style="flex:1;">${btns}</div>${arrowBtn('right')}</div>`
      : `<span style="font-size:0.62rem;color:var(--color-text-dim);">None</span>`;
    const aBtns = aVals.map(v => btn(v, 'a')).join('');
    const bBtns = bVals.map(v => btn(v, 'b')).join('');
    const none  = `<span style="font-size:0.62rem;color:var(--color-text-dim);">None</span>`;
    return `
      <div class="MN_divider"></div>
      <div id="NAV_SA_ExtraSection_${key}">
        <div onclick="NAV_SA_ToggleExtra('${key}')" class="MN_section_hdr">
          <span class="MN_title">${title}</span>
          <button class="MN_info_btn" onclick="event.stopPropagation();SA_infoOpen(this,'${title}','<ul class=&quot;pg-info-list&quot;><li>Column loaded from Set Parameters</li><li>Tag score buckets by selecting <strong>${labelA}</strong> or <strong>${labelB}</strong> values</li><li>Click <strong>Run Analysis</strong> to apply the filter</li></ul>')" title="About this section">?</button>
          <svg id="NAV_SA_ExtraChevron_${key}" viewBox="0 0 16 16" width="11" height="11" fill="none" style="transition:transform 0.18s;transform:rotate(90deg);flex-shrink:0;">
            <polyline points="5 3 11 8 5 13" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="color:var(--color-text-dim);"/>
          </svg>
        </div>
        <div id="NAV_SA_ExtraBody_${key}" style="display:block;">
          <div class="MN_section_body">
            <div style="font-size:0.62rem;font-weight:600;letter-spacing:0.05em;text-transform:uppercase;color:var(--color-text-dim);margin-bottom:5px;">Column</div>
            <div style="font-size:0.68rem;color:var(--color-text-dim);background:var(--color-card-bg);border:1px solid var(--color-card-border);border-radius:5px;padding:0 8px;height:28px;display:flex;align-items:center;">${col}</div>
          </div>
          <div class="MN_section_body">
            <div style="font-size:0.62rem;font-weight:600;letter-spacing:0.05em;text-transform:uppercase;color:var(--color-text-dim);margin-bottom:5px;">${labelA}</div>
            ${scrollRow(aBtns)}
          </div>
          <div class="MN_section_body">
            <div style="font-size:0.62rem;font-weight:600;letter-spacing:0.05em;text-transform:uppercase;color:var(--color-text-dim);margin-bottom:5px;">${labelB}</div>
            ${scrollRow(bBtns)}
          </div>
          <div class="MN_section_body">
            <button class="MN_btn active" style="width:100%;font-size:0.7rem;height:28px;" onclick="SA_RunColAnalysis('${col}','${key}')">Run Analysis</button>
          </div>
        </div>
      </div>`;
  };

  let html = '';

  const dm = p.decisionMode;
  if (dm?.col) {
    html += makeCard('dm', 'Decision Mode', dm.col,
      dm.assigned?.successful   || [],
      dm.assigned?.unsuccessful || [],
      'Successful', 'Unsuccessful');
  }

  (p.customCards || []).forEach((card, i) => {
    html += makeCard(`custom_${i}`, card.name || 'Custom', card.col || '—',
      card.assigned?.a || [],
      card.assigned?.b || [],
      card.labelA || 'A', card.labelB || 'B');
  });

  el.innerHTML = html;
  if (window.SA_RefreshChips) SA_RefreshChips();
}

let _NAV_SA_ParamTimer = null;
function NAV_SA_ToggleParamVal(key, group, val, btn) {
  btn.classList.toggle('active');
  if (window.SA_RefreshChips) SA_RefreshChips();
  if (!_SA_Bins?.length) return;
  clearTimeout(_NAV_SA_ParamTimer);
  _NAV_SA_ParamTimer = setTimeout(() => {
    if (_SA_G001_Filters?.params?.[key]) SAG001_rerun();
    if (_SA_G002_Filters?.params?.[key]) SAG002_rerun();
    if (_SA_G003_Filters?.params?.[key]) SAG003_rerun();
  }, 300);
}

function NAV_SA_ToggleParams() {
  const body    = document.getElementById('NAV_SA_ParamsBody');
  const chevron = document.getElementById('NAV_SA_ParamsChevron');
  if (!body) return;
  const open = body.style.display !== 'none';
  body.style.display    = open ? 'none' : 'block';
  if (chevron) chevron.style.transform = open ? 'rotate(0deg)' : 'rotate(90deg)';
}

function NAV_SA_ToggleExtra(key) {
  const body    = document.getElementById(`NAV_SA_ExtraBody_${key}`);
  const chevron = document.getElementById(`NAV_SA_ExtraChevron_${key}`);
  if (!body) return;
  const open = body.style.display !== 'none';
  body.style.display    = open ? 'none' : 'block';
  if (chevron) chevron.style.transform = open ? 'rotate(0deg)' : 'rotate(90deg)';
}

// ── Presets ───────────────────────────────────────────────────────────────────
function NAV_SA_PresetsTab(tab) {
  ['Load','Delete','Save','Rename'].forEach(t => {
    const btn = document.getElementById(`SA_LDSR_${t}`);
    if (btn) btn.classList.toggle('active', t === tab);
  });
  const selectRow = document.getElementById('SA_LDSR_SelectRow');
  const saveRow   = document.getElementById('SA_LDSR_SaveRow');
  const renameRow = document.getElementById('SA_LDSR_RenameRow');
  const applyBtn  = document.getElementById('SA_LDSR_ApplyBtn');
  if (selectRow) selectRow.style.display = (tab === 'Load' || tab === 'Delete') ? 'flex' : 'none';
  if (saveRow)   saveRow.style.display   = tab === 'Save'   ? 'flex' : 'none';
  if (renameRow) renameRow.style.display = tab === 'Rename' ? 'flex' : 'none';
  if (applyBtn)  applyBtn.textContent    = tab === 'Delete' ? 'Delete' : 'Load';
  if (tab === 'Delete') {
    const ls = document.getElementById('SA_LDSR_LoadSelect');
    const rs = document.getElementById('SA_LDSR_RemoveSelect');
    if (ls && rs) rs.innerHTML = ls.innerHTML;
  }
}

function NAV_SA_RefreshPresetDropdowns() {
  const presets = NAV_SA_GetPresets();
  const names   = Object.keys(presets);
  const opts    = names.map(n => `<option value="${n}">${n}</option>`).join('') || '<option value="">— no presets —</option>';
  ['SA_LDSR_LoadSelect','SA_LDSR_RenameSelect','SA_LDSR_RemoveSelect'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = opts;
  });
}

function NAV_SA_GetPresets() {
  try { return JSON.parse(localStorage.getItem('SA_Presets') || '{}'); } catch { return {}; }
}

function NAV_SA_SavePreset() {
  const name = (document.getElementById('SA_LDSR_SaveName')?.value || '').trim();
  if (!name) return;
  const preset = {
    scoreCol:    SA_getCSValue('SAScoreColCS'),
    start:       document.getElementById('SAStart')?.value,
    end:         document.getElementById('SAEnd')?.value,
    step:        document.getElementById('SAStep')?.value,
    amtCol:      SA_getCSValue('SAAmountColCS'),
    amtOpStart:  document.getElementById('SAAmountOpStart')?.value,
    amtValStart: document.getElementById('SAAmountValStart')?.value,
    amtOpEnd:    document.getElementById('SAAmountOpEnd')?.value,
    amtValEnd:   document.getElementById('SAAmountValEnd')?.value,
  };
  const all = NAV_SA_GetPresets();
  all[name] = preset;
  try { localStorage.setItem('SA_Presets', JSON.stringify(all)); } catch {}
  NAV_SA_RefreshPresetDropdowns();
}

function NAV_SA_PresetsApply() {
  const activeTab = ['Load','Delete','Save','Rename'].find(t =>
    document.getElementById(`SA_LDSR_${t}`)?.classList.contains('active')) || 'Load';
  if (activeTab === 'Load') {
    const name = document.getElementById('SA_LDSR_LoadSelect')?.value;
    const p    = NAV_SA_GetPresets()[name];
    if (!p) return;
    if (p.scoreCol)    NAV_SA_SetScoreCS(p.scoreCol);
    if (p.start)       document.getElementById('SAStart').value          = p.start;
    if (p.end)         document.getElementById('SAEnd').value            = p.end;
    if (p.step)        document.getElementById('SAStep').value           = p.step;
    if (p.amtCol) {
      const amtCS = document.getElementById('SAAmountColCS');
      if (amtCS) {
        const opt = amtCS.querySelector(`.cs-option[data-value="${CSS.escape(p.amtCol)}"]`);
        if (opt) SA_selectCS(opt, p.amtCol, null);
      }
    }
    if (p.amtOpStart)  document.getElementById('SAAmountOpStart').value  = p.amtOpStart;
    if (p.amtValStart) document.getElementById('SAAmountValStart').value = p.amtValStart;
    if (p.amtOpEnd)    document.getElementById('SAAmountOpEnd').value    = p.amtOpEnd;
    if (p.amtValEnd)   document.getElementById('SAAmountValEnd').value   = p.amtValEnd;
    NAV_SA_OnScoreColChange();
  } else if (activeTab === 'Delete') {
    const name = document.getElementById('SA_LDSR_LoadSelect')?.value;
    if (!name) return;
    const all = NAV_SA_GetPresets();
    delete all[name];
    try { localStorage.setItem('SA_Presets', JSON.stringify(all)); } catch {}
    NAV_SA_RefreshPresetDropdowns();
  } else if (activeTab === 'Rename') {
    const oldName = document.getElementById('SA_LDSR_RenameSelect')?.value;
    const newName = (document.getElementById('SA_LDSR_RenameName')?.value || '').trim();
    if (!oldName || !newName || oldName === newName) return;
    const all = NAV_SA_GetPresets();
    all[newName] = all[oldName];
    delete all[oldName];
    try { localStorage.setItem('SA_Presets', JSON.stringify(all)); } catch {}
    NAV_SA_RefreshPresetDropdowns();
  }
}

// ── Nav scroll indicator ──────────────────────────────────────────────────────
(function () {
  function _inject() {
    const nav = document.getElementById('SA_MiniNav');
    if (!nav || document.getElementById('NAV_SA_ScrollerDown')) return;
    nav.insertAdjacentHTML('afterbegin', `
      <div id="NAV_SA_ScrollerUp" onclick="NAV_SA_ScrollUp()" title="Scroll up">
        <svg viewBox="0 0 16 8" width="14" height="7" fill="none">
          <polyline points="1 7 8 1 15 7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <div class="MN_ScrollBar"></div>
      </div>`);
    nav.insertAdjacentHTML('beforeend', `
      <div id="NAV_SA_ScrollerDown" onclick="NAV_SA_ScrollDown()" title="Scroll down">
        <div class="MN_ScrollBar"></div>
        <svg viewBox="0 0 16 8" width="14" height="7" fill="none">
          <polyline points="1 1 8 7 15 1" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>`);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', _inject);
  else _inject();
})();

function NAV_SA_ScrollDown() {
  const nav = document.getElementById('SA_MiniNav');
  if (nav) nav.scrollBy({ top: 150, behavior: 'smooth' });
}

function NAV_SA_ScrollUp() {
  const nav = document.getElementById('SA_MiniNav');
  if (nav) nav.scrollBy({ top: -150, behavior: 'smooth' });
}


// ── Spinner helper (shared across all SA number inputs) ───────────────────────
function MN_step(id, delta, callbackName, min) {
  const el = document.getElementById(id);
  if (!el) return;
  const cur = parseFloat(el.value) || 0;
  const step = parseFloat(el.step) || 1;
  let next = cur + delta * step;
  if (min !== undefined) next = Math.max(min, next);
  el.value = next;
  el.dispatchEvent(new Event('input'));
  if (callbackName && window[callbackName]) window[callbackName]();
}

// ── Auto-run debounce ─────────────────────────────────────────────────────────
function NAV_SA_AutoRun() {
  // Refresh chips immediately so labels stay in sync with inputs
  if (window.SA_RefreshChips) SA_RefreshChips();
  // Only re-run graph query if a previous run has already produced results
  if (!_SA_Bins?.length) return;
  clearTimeout(_NAV_SA_AutoRunTimer);
  _NAV_SA_AutoRunTimer = setTimeout(() => {
    if (SA_getCSValue('SAScoreColCS')) SA_Run();
  }, 800);
}

// ── Amount filter value changed — only re-query graphs where chip is ON ───────
let _NAV_SA_AmtTimer = null;
function NAV_SA_AmountChanged() {
  if (window.SA_RefreshChips) SA_RefreshChips();
  if (!_SA_Bins?.length) return;
  clearTimeout(_NAV_SA_AmtTimer);
  _NAV_SA_AmtTimer = setTimeout(() => {
    if (_SA_G001_Filters?.amt) SAG001_rerun();
    if (_SA_G002_Filters?.amt) SAG002_rerun();
    if (_SA_G003_Filters?.amt) SAG003_rerun();
  }, 300);
}

// ── SA Nav Info Popup ─────────────────────────────────────────────────────────
function SA_infoOpen(btn, title, text) {
  const popup = document.getElementById('SA_InfoPopup');
  if (!popup) return;
  document.getElementById('SA_InfoTitle').textContent = title;
  document.getElementById('SA_InfoBody').innerHTML    = text;
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
  setTimeout(() => document.addEventListener('click', _SA_infoOutside), 0);
  window.addEventListener('scroll', SA_infoClose, { once: true, capture: true });
}
function _SA_infoOutside(e) {
  const popup = document.getElementById('SA_InfoPopup');
  if (popup && !popup.contains(e.target) && !e.target.classList.contains('MN_info_btn'))
    SA_infoClose();
}
function SA_infoClose() {
  const popup = document.getElementById('SA_InfoPopup');
  if (popup) popup.style.display = 'none';
  document.removeEventListener('click', _SA_infoOutside);
}
