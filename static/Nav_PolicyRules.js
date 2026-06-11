// ── Policy Rules Mini-Nav ─────────────────────────────────────────────────────

(function () {
  function _inject() {
    const nav = document.getElementById('PR_MiniNav');
    if (!nav || document.getElementById('PR_ScrollerDown')) return;
    nav.insertAdjacentHTML('afterbegin', `
      <div id="PR_ScrollerUp" onclick="PR_ScrollUp()" title="Scroll up">
        <svg viewBox="0 0 16 8" width="14" height="7" fill="none">
          <polyline points="1 7 8 1 15 7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <div class="MN_ScrollBar"></div>
      </div>`);
    nav.insertAdjacentHTML('beforeend', `
      <div id="PR_ScrollerDown" onclick="PR_ScrollDown()" title="Scroll down">
        <div class="MN_ScrollBar"></div>
        <svg viewBox="0 0 16 8" width="14" height="7" fill="none">
          <polyline points="1 1 8 7 15 1" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>`);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', _inject);
  else _inject();
})();

function PR_ScrollDown() { document.getElementById('PR_MiniNav')?.scrollBy({ top:  150, behavior: 'smooth' }); }
function PR_ScrollUp()   { document.getElementById('PR_MiniNav')?.scrollBy({ top: -150, behavior: 'smooth' }); }

function PR_MiniNav_RenderParams() { SP_RenderParamsTo('PR_MiniNav_ParamsDisplay', 'pr'); }

// ── Section toggles ───────────────────────────────────────────────────────────
let _prMiniParamsOpen = false;
let _prMiniColsOpen   = true;
let _prMiniRunOpen    = true;
let _prMiniSumOpen    = false;

function PR_MiniNav_ToggleParams() {
  _prMiniParamsOpen = !_prMiniParamsOpen;
  _toggle('PR_MiniNav_ParamsBody', 'PR_MiniNav_ParamsChevron', _prMiniParamsOpen);
}
function PR_MiniNav_ToggleCols() {
  _prMiniColsOpen = !_prMiniColsOpen;
  _toggle('PR_MiniNav_ColBody', 'PR_MiniNav_ColChevron', _prMiniColsOpen);
}
function PR_MiniNav_ToggleRun() {
  _prMiniRunOpen = !_prMiniRunOpen;
  _toggle('PR_MiniNav_RunBody', 'PR_MiniNav_RunChevron', _prMiniRunOpen);
}
function PR_MiniNav_ToggleSum() {
  _prMiniSumOpen = !_prMiniSumOpen;
  _toggle('PR_MiniNav_SumBody', 'PR_MiniNav_SumChevron', _prMiniSumOpen);
}

function _toggle(bodyId, chevronId, open) {
  const body    = document.getElementById(bodyId);
  const chevron = document.getElementById(chevronId);
  if (body)    body.style.display      = open ? 'block' : 'none';
  if (chevron) chevron.style.transform = open ? 'rotate(90deg)' : 'rotate(0deg)';
}

let _prMiniAllExpanded = true;
function PR_MiniNav_ToggleAll() {
  _prMiniAllExpanded = !_prMiniAllExpanded;
  _prMiniParamsOpen  = _prMiniAllExpanded;
  _prMiniColsOpen    = _prMiniAllExpanded;
  _prMiniRunOpen     = _prMiniAllExpanded;
  _prMiniSumOpen     = _prMiniAllExpanded;
  [
    { body: 'PR_MiniNav_ParamsBody', chevron: 'PR_MiniNav_ParamsChevron' },
    { body: 'PR_MiniNav_ColBody',    chevron: 'PR_MiniNav_ColChevron'    },
    { body: 'PR_MiniNav_RunBody',    chevron: 'PR_MiniNav_RunChevron'    },
    { body: 'PR_MiniNav_SumBody',    chevron: 'PR_MiniNav_SumChevron'    },
  ].forEach(s => {
    const b = document.getElementById(s.body);
    const c = document.getElementById(s.chevron);
    if (b) b.style.display      = _prMiniAllExpanded ? 'block' : 'none';
    if (c) c.style.transform    = _prMiniAllExpanded ? 'rotate(90deg)' : 'rotate(0deg)';
  });
  const btn = document.getElementById('PR_MiniNav_ExpandBtn');
  if (btn) btn.title = _prMiniAllExpanded ? 'Collapse all' : 'Expand all';
}

// ── Column population ─────────────────────────────────────────────────────────
const _PR_NUMERIC_TYPES = /int|float|double|decimal|numeric|real|bigint|smallint|tinyint|hugeint|ubigint|uinteger|usmallint|utinyint|date|time|timestamp|interval/;

async function PR_MiniNav_PopulateCols() {
  const list = document.getElementById('PR_MiniNav_ColumnsList');
  if (!list) return;
  const conn = window.LD_getConn?.();
  const src  = window.LD_getSource?.();
  if (!conn || !src) {
    list.innerHTML = '<span style="font-size:0.62rem;color:var(--color-text-dim);padding:2px 0;">— Load data first —</span>';
    return;
  }
  try {
    const sp   = window.SP_getParams?.() || {};
    const excl = new Set([sp.object, sp.col1].filter(Boolean));
    const res  = await conn.query(`DESCRIBE "${src}"`);
    const cols = res.toArray()
      .filter(r => !_PR_NUMERIC_TYPES.test((r.column_type || '').toLowerCase()))
      .map(r => r.column_name)
      .filter(c => !excl.has(c));
    list.innerHTML = cols.map(c => `
      <button class="MN_chip MN_chip--col MN_chip--a" onclick="this.classList.toggle('active');" title="${c}">${c}</button>
    `).join('');
  } catch { return; }
}

function PR_SelectAll() { document.querySelectorAll('#PR_MiniNav_ColumnsList .MN_chip').forEach(b => b.classList.add('active')); }
function PR_ClearAll()  { document.querySelectorAll('#PR_MiniNav_ColumnsList .MN_chip').forEach(b => b.classList.remove('active')); }
function PR_MiniNav_GetSelectedCols() {
  return [...document.querySelectorAll('#PR_MiniNav_ColumnsList .MN_chip.active')].map(b => b.title);
}

// ── Run Options state ─────────────────────────────────────────────────────────
let _prType   = 'transaction';
let _prShow   = new Set(['total', 'fraud']);
let _prRunBy  = 'day';

function PR_SetType(t) {
  _prType = t;
  ['transaction','pan','amount'].forEach(x => {
    const btn = document.getElementById('PR_TypeBtn_' + x);
    if (btn) btn.classList.toggle('active', x === t);
  });
}

function PR_ToggleShow(key) {
  if (_prShow.has(key)) _prShow.delete(key); else _prShow.add(key);
  const btn = document.getElementById('PR_ShowBtn_' + key);
  if (btn) btn.classList.toggle('active', _prShow.has(key));
}

function PR_SetRunBy(mode) {
  _prRunBy = mode;
  ['day','hour','overall'].forEach(x => {
    const btn = document.getElementById('PR_RunByBtn_' + x);
    if (btn) btn.classList.toggle('active', x === mode);
  });
}

// ── Summary Filter ────────────────────────────────────────────────────────────
let _prSumConditions = [];
let _prSumConnector  = 'AND';
let _prSumCondSeq    = 0;

function PR_AddSumCondition() {
  const id   = 'prc_' + (++_prSumCondSeq);
  const cols = window._prSumColOptions?.length ? window._prSumColOptions : PR_MiniNav_GetSelectedCols();
  const colOpts = cols.map(c => `<option value="${c}">${c}</option>`).join('') ||
                  '<option value="">— run analysis first —</option>';
  _prSumConditions.push(id);
  const container = document.getElementById('PR_SumConditions');
  if (!container) return;

  if (_prSumConditions.length > 1) {
    const conn = document.createElement('div');
    conn.id = 'pr_conn_' + id;
    conn.style.cssText = 'display:flex;align-items:center;gap:6px;margin:3px 0;';
    conn.innerHTML = `
      <div style="flex:1;height:1px;background:var(--color-card-border);"></div>
      <button onclick="PR_ToggleSumConnector()" class="MN_btn" id="PR_SumConnBtn"
        style="border-color:var(--brand-pr-light);background:var(--brand-pr-dim);color:var(--brand-pr-light);font-weight:700;letter-spacing:0.08em;text-transform:uppercase;">${_prSumConnector.toLowerCase()}</button>
      <div style="flex:1;height:1px;background:var(--color-card-border);"></div>`;
    container.appendChild(conn);
  }

  const row = document.createElement('div');
  row.id = id;
  row.style.cssText = 'display:flex;gap:4px;align-items:center;';
  row.innerHTML = `
    <select class="MN_ctrl" style="flex:2;min-width:0;" id="${id}_col">${colOpts}</select>
    <select class="MN_ctrl" style="flex:1;min-width:0;" id="${id}_op">
      <option>≤</option><option>≥</option><option>&lt;</option><option>&gt;</option><option>=</option>
    </select>
    <input type="number" class="MN_ctrl" style="flex:1;min-width:0;" id="${id}_val" value="0">
    <span onclick="PR_RemoveSumCond('${id}')" style="cursor:pointer;color:var(--color-text-dim);font-size:0.8rem;padding:2px;">✕</span>`;
  container.appendChild(row);
}

function PR_ToggleSumConnector() {
  _prSumConnector = _prSumConnector === 'AND' ? 'OR' : 'AND';
  document.querySelectorAll('[id="PR_SumConnBtn"]').forEach(btn => {
    btn.textContent = _prSumConnector.toLowerCase();
  });
}

function PR_RemoveSumCond(id) {
  const idx = _prSumConditions.indexOf(id);
  if (idx !== -1) _prSumConditions.splice(idx, 1);
  document.getElementById(id)?.remove();
  document.getElementById('pr_conn_' + id)?.remove();
}

function PR_GetSumConditions() {
  return _prSumConditions.map(id => ({
    col: document.getElementById(id + '_col')?.value || '',
    op:  document.getElementById(id + '_op')?.value  || '≤',
    val: parseFloat(document.getElementById(id + '_val')?.value) || 0,
  })).filter(c => c.col);
}

// Stubs — wired by PolicyRules.js
function PR_RunSummary()    { if (typeof _PR_RunSummary    === 'function') _PR_RunSummary();    }

// ── PR Info Popup ─────────────────────────────────────────────────────────────
function PR_infoOpen(btn, title, text) {
  const popup = document.getElementById('PR_InfoPopup');
  if (!popup) return;
  document.getElementById('PR_InfoTitle').textContent = title;
  document.getElementById('PR_InfoBody').innerHTML    = text;
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
  setTimeout(() => document.addEventListener('click', _PR_infoOutside), 0);
  window.addEventListener('scroll', PR_infoClose, { once: true, capture: true });
}
function _PR_infoOutside(e) {
  const popup = document.getElementById('PR_InfoPopup');
  if (popup && !popup.contains(e.target) && !e.target.classList.contains('MN_info_btn'))
    PR_infoClose();
}
function PR_infoClose() {
  const popup = document.getElementById('PR_InfoPopup');
  if (popup) popup.style.display = 'none';
  document.removeEventListener('click', _PR_infoOutside);
}
