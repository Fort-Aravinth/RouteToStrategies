// ── Nav_ScoreComparison — SC mini-nav controls ────────────────────────────────

let _NAV_SC_AutoRunTimer = null;

// ── Column population ─────────────────────────────────────────────────────────
async function NAV_SC_PopulateColumns() {
  const conn = window.LD_getConn ? window.LD_getConn() : null;
  if (!conn) return;
  const src = window.LD_getSource ? window.LD_getSource() : 'cm_data';
  let cols = [];
  try {
    const res = await conn.query(`DESCRIBE ${src}`);
    cols = res.toArray().map(r => ({ name: r.column_name, type: (r.column_type || '').toUpperCase() }));
  } catch { return; }

  const numTypes = ['INTEGER','BIGINT','DOUBLE','FLOAT','DECIMAL','REAL','HUGEINT','UBIGINT','UINTEGER','SMALLINT','TINYINT'];
  window._NAV_SC_NumCols = cols.filter(c => numTypes.some(t => c.type.startsWith(t))).map(c => c.name);

  NAV_SC_FillSelect('SCAmountCol', window._NAV_SC_NumCols, '— Amount column —');

  const params = window.SP_getParams ? window.SP_getParams() : {};
  const amtEl  = document.getElementById('SCAmountCol');
  if (amtEl && !amtEl.value) {
    if (params.amountCol && window._NAV_SC_NumCols.includes(params.amountCol)) {
      amtEl.value = params.amountCol;
    } else {
      const guess = window._NAV_SC_NumCols.find(c => /amount|value|purchase|total|price|sum/i.test(c));
      if (guess) amtEl.value = guess;
    }
    if (amtEl.value) NAV_SC_OnAmountColChange();
  }

  // Seed one empty score row on first open
  if (!_SC_ScoreCols.length) {
    _SC_ScoreCols.push({ col: '', color: SC_PALETTE[0], start: undefined, end: undefined, step: 10 });
  }
  NAV_SC_RenderScoreRows();
}

function NAV_SC_FillSelect(id, options, placeholder) {
  const sel = document.getElementById(id);
  if (!sel) return;
  const cur = sel.value;
  sel.innerHTML = `<option value="">${placeholder}</option>` +
    options.map(o => `<option value="${o}"${o === cur ? ' selected' : ''}>${o}</option>`).join('');
}

// ── Score row list ─────────────────────────────────────────────────────────────
// Each row = colour dot + column dropdown + per-column Start/End/Step + remove
function NAV_SC_RenderScoreRows() {
  const container = document.getElementById('SC_ScoreRows');
  if (!container) return;
  const numCols = window._NAV_SC_NumCols || [];

  container.innerHTML = _SC_ScoreCols.map((s, i) => `
    <div class="SC_ScoreRow" id="SC_ScoreRow_${i}" style="margin-bottom:8px;">
      <div style="display:flex;gap:var(--MN_gap);align-items:center;margin-bottom:2px;">
        <select class="MN_ctrl SC_ScoreSelect" style="flex:1;min-width:0;border-color:${s.color} !important;" onchange="NAV_SC_OnScoreChange(${i}, this.value)">
          <option value="">— Select column —</option>
          ${numCols.map(c => `<option value="${c}"${c === s.col ? ' selected' : ''}>${c}</option>`).join('')}
        </select>
        ${_SC_ScoreCols.length > 1
          ? `<button class="MN_btn" onclick="NAV_SC_RemoveScore(${i})" title="Remove" style="width:28px !important;padding:0 !important;flex-shrink:0;">×</button>`
          : ''}
      </div>
      <div id="SC_MinMax_${i}" style="display:none;font-size:0.6rem;color:var(--color-text-dim);margin-bottom:3px;">Min: <strong id="SC_Min_${i}"></strong> / Max: <strong id="SC_Max_${i}"></strong></div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:var(--MN_gap);">
        <div class="MN_spinner" style="border-color:${s.color} !important;"><button onclick="NAV_SC_stepRow(${i},'start',-1)">−</button><input type="number" id="SC_Start_${i}" class="MN_ctrl" value="${s.start ?? ''}" placeholder="Start" oninput="NAV_SC_updateRange(${i},'start')"/><button onclick="NAV_SC_stepRow(${i},'start',1)">+</button></div>
        <div class="MN_spinner" style="border-color:${s.color} !important;"><button onclick="NAV_SC_stepRow(${i},'end',-1)">−</button><input type="number" id="SC_End_${i}" class="MN_ctrl" value="${s.end ?? ''}" placeholder="End" oninput="NAV_SC_updateRange(${i},'end')"/><button onclick="NAV_SC_stepRow(${i},'end',1)">+</button></div>
        <div class="MN_spinner" style="border-color:${s.color} !important;"><button onclick="NAV_SC_stepRow(${i},'step',-1,1)">−</button><input type="number" id="SC_Step_${i}" class="MN_ctrl" value="${s.step ?? 10}" min="1" title="Step" oninput="NAV_SC_updateRange(${i},'step')"/><button onclick="NAV_SC_stepRow(${i},'step',1,1)">+</button></div>
      </div>
    </div>
  `).join('');
}

function NAV_SC_AddScore() {
  if (_SC_ScoreCols.length >= SC_PALETTE.length) return;
  _SC_ScoreCols.push({ col: '', color: SC_PALETTE[_SC_ScoreCols.length], start: undefined, end: undefined, step: 10 });
  NAV_SC_RenderScoreRows();
}

function NAV_SC_stepRow(i, field, delta, min) {
  const el = document.getElementById(`SC_${field.charAt(0).toUpperCase() + field.slice(1)}_${i}`);
  if (!el) return;
  const cur  = parseFloat(el.value) || 0;
  const step = field === 'step' ? 1 : (parseFloat(document.getElementById(`SC_Step_${i}`)?.value) || 1);
  let next   = cur + delta * step;
  if (min !== undefined) next = Math.max(min, next);
  el.value = next;
  _SC_ScoreCols[i][field] = next;
  NAV_SC_AutoRun();
}

function NAV_SC_updateRange(i, field) {
  const el = document.getElementById(`SC_${field.charAt(0).toUpperCase() + field.slice(1)}_${i}`);
  if (!el) return;
  const val = parseFloat(el.value);
  _SC_ScoreCols[i][field] = isNaN(val) ? undefined : val;
  NAV_SC_AutoRun();
}

function NAV_SC_RemoveScore(idx) {
  _SC_ScoreCols.splice(idx, 1);
  // Re-assign palette colours in order after removal
  _SC_ScoreCols.forEach((s, i) => { s.color = SC_PALETTE[i]; });
  NAV_SC_RenderScoreRows();
  NAV_SC_AutoRun();
}

async function NAV_SC_OnScoreChange(idx, col) {
  _SC_ScoreCols[idx].col = col;
  if (!col) { NAV_SC_AutoRun(); return; }

  // Auto-populate per-row Start / End from DB min/max whenever a column is chosen
  const conn = window.LD_getConn ? window.LD_getConn() : null;
  const src  = window.LD_getSource ? window.LD_getSource() : 'cm_data';
  if (conn) {
    try {
      const res = await conn.query(`SELECT MIN("${col}") AS mn, MAX("${col}") AS mx FROM ${src}`);
      const row = res.toArray()[0];
      const mn  = Number(row.mn), mx = Number(row.mx);

      const startEl  = document.getElementById(`SC_Start_${idx}`);
      const endEl    = document.getElementById(`SC_End_${idx}`);
      const minMaxEl = document.getElementById(`SC_MinMax_${idx}`);

      if (startEl) { startEl.value = mn; _SC_ScoreCols[idx].start = mn; }
      if (endEl)   { endEl.value   = mx; _SC_ScoreCols[idx].end   = mx; }

      // Always show min/max hint
      if (minMaxEl) {
        const minEl = document.getElementById(`SC_Min_${idx}`);
        const maxEl = document.getElementById(`SC_Max_${idx}`);
        if (minEl) minEl.textContent = mn;
        if (maxEl) maxEl.textContent = mx;
        minMaxEl.style.display = 'block';
      }
    } catch {}
  }
  NAV_SC_AutoRun();
}

async function NAV_SC_OnAmountColChange() {
  const col  = document.getElementById('SCAmountCol')?.value;
  const conn = window.LD_getConn ? window.LD_getConn() : null;
  const src  = window.LD_getSource ? window.LD_getSource() : 'cm_data';
  if (col && conn) {
    try {
      const res = await conn.query(`SELECT MIN("${col}") AS mn, MAX("${col}") AS mx FROM ${src}`);
      const row = res.toArray()[0];
      const mn  = Number(row.mn), mx = Number(row.mx);
      const startEl = document.getElementById('SCAmountValStart');
      const endEl   = document.getElementById('SCAmountValEnd');
      if (startEl) startEl.value = mn;
      if (endEl)   endEl.value   = mx;
    } catch {}
  }
  NAV_SC_AutoRun();
}

// ── Params display ────────────────────────────────────────────────────────────
function NAV_SC_RenderParams() {
  if (typeof window.SP_RenderParamsTo === 'function') {
    window.SP_RenderParamsTo('NAV_SC_ParamsDisplay', 'sc');
  }
}

// ── Extra param cards (Decision Mode + custom cards) ──────────────────────────
function NAV_SC_RefreshExtraCards() {
  const p  = window.SP_getParams ? window.SP_getParams() : {};
  const el = document.getElementById('NAV_SC_ExtraCards');
  if (!el) return;

  const makeCard = (key, title, col, aVals, bVals, labelA, labelB) => {
    const btn = (v, group) =>
      `<button class="MN_btn MN_paramVal" onclick="NAV_SC_ToggleParamVal('${key}','${group}','${v}',this)"
        style="flex:1;min-width:0;height:24px;padding:0 4px;font-size:0.62rem;border-radius:5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${v}</button>`;
    const aBtns = aVals.map(v => btn(v, 'a')).join('');
    const bBtns = bVals.map(v => btn(v, 'b')).join('');
    const none  = `<span style="font-size:0.62rem;color:var(--color-text-dim);">None</span>`;
    return `
      <div class="MN_divider"></div>
      <div id="NAV_SC_ExtraSection_${key}">
        <div onclick="NAV_SC_ToggleExtra('${key}')" class="MN_section_hdr">
          <span class="MN_title">${title}</span>
          <svg id="NAV_SC_ExtraChevron_${key}" viewBox="0 0 16 16" width="11" height="11" fill="none" style="transition:transform 0.18s;transform:rotate(90deg);flex-shrink:0;">
            <polyline points="5 3 11 8 5 13" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="color:var(--color-text-dim);"/>
          </svg>
        </div>
        <div id="NAV_SC_ExtraBody_${key}" style="display:block;">
          <div class="MN_section_body">
            <div style="font-size:0.62rem;font-weight:600;letter-spacing:0.05em;text-transform:uppercase;color:var(--color-text-dim);margin-bottom:5px;">Column</div>
            <div style="font-size:0.68rem;color:var(--color-text-dim);background:var(--color-card-bg);border:1px solid var(--color-card-border);border-radius:5px;padding:0 8px;height:28px;display:flex;align-items:center;">${col}</div>
          </div>
          <div class="MN_section_body">
            <div style="font-size:0.62rem;font-weight:600;letter-spacing:0.05em;text-transform:uppercase;color:var(--color-text-dim);margin-bottom:5px;">${labelA}</div>
            <div style="display:flex;gap:3px;">${aBtns || none}</div>
          </div>
          <div class="MN_section_body">
            <div style="font-size:0.62rem;font-weight:600;letter-spacing:0.05em;text-transform:uppercase;color:var(--color-text-dim);margin-bottom:5px;">${labelB}</div>
            <div style="display:flex;gap:3px;">${bBtns || none}</div>
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
      card.assigned?.a || [], card.assigned?.b || [],
      card.labelA || 'A', card.labelB || 'B');
  });

  el.innerHTML = html;
  if (window.SC_RefreshChips) SC_RefreshChips();
}

function NAV_SC_ToggleParamVal(key, group, val, btn) {
  btn.classList.toggle('active');
  if (window.SC_RefreshChips) SC_RefreshChips();
}

function NAV_SC_ToggleExtra(key) {
  const body    = document.getElementById(`NAV_SC_ExtraBody_${key}`);
  const chevron = document.getElementById(`NAV_SC_ExtraChevron_${key}`);
  if (!body) return;
  const open = body.style.display !== 'none';
  body.style.display    = open ? 'none' : 'block';
  if (chevron) chevron.style.transform = open ? 'rotate(0deg)' : 'rotate(90deg)';
}


// ── Nav scroll indicators ─────────────────────────────────────────────────────
(function () {
  function _inject() {
    const nav = document.getElementById('SC_MiniNav');
    if (!nav || document.getElementById('NAV_SC_ScrollerDown')) return;
    nav.insertAdjacentHTML('afterbegin', `
      <div id="NAV_SC_ScrollerUp" onclick="NAV_SC_ScrollUp()" title="Scroll up">
        <svg viewBox="0 0 16 8" width="14" height="7" fill="none">
          <polyline points="1 7 8 1 15 7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <div class="MN_ScrollBar"></div>
      </div>`);
    nav.insertAdjacentHTML('beforeend', `
      <div id="NAV_SC_ScrollerDown" onclick="NAV_SC_ScrollDown()" title="Scroll down">
        <div class="MN_ScrollBar"></div>
        <svg viewBox="0 0 16 8" width="14" height="7" fill="none">
          <polyline points="1 1 8 7 15 1" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>`);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', _inject);
  else _inject();
})();

function NAV_SC_ScrollDown() {
  const nav = document.getElementById('SC_MiniNav');
  if (nav) nav.scrollBy({ top: 150, behavior: 'smooth' });
}

function NAV_SC_ScrollUp() {
  const nav = document.getElementById('SC_MiniNav');
  if (nav) nav.scrollBy({ top: -150, behavior: 'smooth' });
}

// ── Spinner helper ────────────────────────────────────────────────────────────
function SC_MN_step(id, delta, callbackName, min) {
  const el = document.getElementById(id);
  if (!el) return;
  const cur  = parseFloat(el.value) || 0;
  const step = parseFloat(el.step) || 1;
  let next   = cur + delta * step;
  if (min !== undefined) next = Math.max(min, next);
  el.value = next;
  el.dispatchEvent(new Event('input'));
  if (callbackName && window[callbackName]) window[callbackName]();
}

// ── Section toggles ──────────────────────────────────────────────────────────
function NAV_SC_ToggleParams() {
  const body    = document.getElementById('NAV_SC_ParamsBody');
  const chevron = document.getElementById('NAV_SC_ParamsChevron');
  if (!body) return;
  const open = body.style.display !== 'none';
  body.style.display    = open ? 'none' : 'block';
  if (chevron) chevron.style.transform = open ? 'rotate(0deg)' : 'rotate(90deg)';
}

function NAV_SC_ToggleScore() {
  const body    = document.getElementById('NAV_SC_ScoreBody');
  const chevron = document.getElementById('NAV_SC_ScoreChevron');
  if (!body) return;
  const open = body.style.display !== 'none';
  body.style.display    = open ? 'none' : 'block';
  if (chevron) chevron.style.transform = open ? 'rotate(0deg)' : 'rotate(90deg)';
}

function NAV_SC_ToggleAmt() {
  const body    = document.getElementById('NAV_SC_AmtBody');
  const chevron = document.getElementById('NAV_SC_AmtChevron');
  if (!body) return;
  const open = body.style.display !== 'none';
  body.style.display    = open ? 'none' : 'block';
  if (chevron) chevron.style.transform = open ? 'rotate(0deg)' : 'rotate(90deg)';
}


// ── SC Info Popup ─────────────────────────────────────────────────────────────
function SC_infoOpen(btn, title, text) {
  const popup = document.getElementById('SC_InfoPopup');
  if (!popup) return;
  document.getElementById('SC_InfoTitle').textContent = title;
  document.getElementById('SC_InfoBody').innerHTML    = text;
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
  setTimeout(() => document.addEventListener('click', _SC_infoOutside), 0);
  window.addEventListener('scroll', SC_infoClose, { once: true, capture: true });
}
function _SC_infoOutside(e) {
  const popup = document.getElementById('SC_InfoPopup');
  if (popup && !popup.contains(e.target) && !e.target.classList.contains('MN_info_btn'))
    SC_infoClose();
}
function SC_infoClose() {
  const popup = document.getElementById('SC_InfoPopup');
  if (popup) popup.style.display = 'none';
  document.removeEventListener('click', _SC_infoOutside);
}

// ── Auto-run debounce ─────────────────────────────────────────────────────────
function NAV_SC_AutoRun() {
  if (window.SC_RefreshChips) SC_RefreshChips();
  const hasAnyScore = _SC_ScoreCols.some(s => s.col);
  if (!Object.keys(_SC_BinsMap).length || !hasAnyScore) return;
  clearTimeout(_NAV_SC_AutoRunTimer);
  _NAV_SC_AutoRunTimer = setTimeout(() => {
    if (_SC_ScoreCols.some(s => s.col)) SC_Run();
  }, 800);
}
