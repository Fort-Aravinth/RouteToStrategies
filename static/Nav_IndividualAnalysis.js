// ── Individual Analysis Mini-Nav ──────────────────────────────────────────────

(function () {
  function _inject() {
    const nav = document.getElementById('IA_MiniNav');
    if (!nav || document.getElementById('IA_ScrollerDown')) return;
    nav.insertAdjacentHTML('afterbegin', `
      <div id="IA_ScrollerUp" onclick="IA_ScrollUp()" title="Scroll up">
        <svg viewBox="0 0 16 8" width="14" height="7" fill="none">
          <polyline points="1 7 8 1 15 7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <div class="MN_ScrollBar"></div>
      </div>`);
    nav.insertAdjacentHTML('beforeend', `
      <div id="IA_ScrollerDown" onclick="IA_ScrollDown()" title="Scroll down">
        <div class="MN_ScrollBar"></div>
        <svg viewBox="0 0 16 8" width="14" height="7" fill="none">
          <polyline points="1 1 8 7 15 1" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>`);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', _inject);
  else _inject();
})();

function IA_ScrollDown() { document.getElementById('IA_MiniNav')?.scrollBy({ top:  150, behavior: 'smooth' }); }
function IA_ScrollUp()   { document.getElementById('IA_MiniNav')?.scrollBy({ top: -150, behavior: 'smooth' }); }

function IA_MiniNav_RenderParams() { SP_RenderParamsTo('IA_MiniNav_ParamsDisplay', 'ia'); }

let _iaMiniParamsOpen = false;
function IA_MiniNav_ToggleParams() {
  _iaMiniParamsOpen = !_iaMiniParamsOpen;
  const body    = document.getElementById('IA_MiniNav_ParamsBody');
  const chevron = document.getElementById('IA_MiniNav_ParamsChevron');
  if (body)    body.style.display      = _iaMiniParamsOpen ? 'block' : 'none';
  if (chevron) chevron.style.transform = _iaMiniParamsOpen ? 'rotate(90deg)' : 'rotate(0deg)';
}

let _iaMiniColsOpen = true;
function IA_MiniNav_ToggleCols() {
  _iaMiniColsOpen = !_iaMiniColsOpen;
  const body    = document.getElementById('IA_MiniNav_ColBody');
  const chevron = document.getElementById('IA_MiniNav_ColChevron');
  if (body)    body.style.display      = _iaMiniColsOpen ? 'block' : 'none';
  if (chevron) chevron.style.transform = _iaMiniColsOpen ? 'rotate(90deg)' : 'rotate(0deg)';
}

let _iaMiniTargetOpen = true;
function IA_MiniNav_ToggleTarget() {
  _iaMiniTargetOpen = !_iaMiniTargetOpen;
  const body    = document.getElementById('IA_MiniNav_TargetBody');
  const chevron = document.getElementById('IA_MiniNav_TargetChevron');
  if (body)    body.style.display      = _iaMiniTargetOpen ? 'block' : 'none';
  if (chevron) chevron.style.transform = _iaMiniTargetOpen ? 'rotate(90deg)' : 'rotate(0deg)';
}

let _iaMiniAllExpanded = true;
function IA_MiniNav_ToggleAll() {
  _iaMiniAllExpanded = !_iaMiniAllExpanded;
  _iaMiniParamsOpen  = _iaMiniAllExpanded;
  _iaMiniColsOpen    = _iaMiniAllExpanded;
  _iaMiniTargetOpen  = _iaMiniAllExpanded;
  [
    { body: 'IA_MiniNav_ParamsBody',  chevron: 'IA_MiniNav_ParamsChevron'  },
    { body: 'IA_MiniNav_ColBody',     chevron: 'IA_MiniNav_ColChevron'     },
    { body: 'IA_MiniNav_TargetBody',  chevron: 'IA_MiniNav_TargetChevron'  },
  ].forEach(s => {
    const b = document.getElementById(s.body);
    const c = document.getElementById(s.chevron);
    if (b) b.style.display      = _iaMiniAllExpanded ? 'block' : 'none';
    if (c) c.style.transform    = _iaMiniAllExpanded ? 'rotate(90deg)' : 'rotate(0deg)';
  });
  const btn = document.getElementById('IA_MiniNav_ExpandBtn');
  if (btn) btn.title = _iaMiniAllExpanded ? 'Collapse all' : 'Expand all';
}

// ── Column population ─────────────────────────────────────────────────────────
const _IA_NUMERIC_TYPES = /int|float|double|decimal|numeric|real|bigint|smallint|tinyint|hugeint|ubigint|uinteger|usmallint|utinyint|date|time|timestamp|interval/;

async function IA_MiniNav_PopulateCols() {
  const list = document.getElementById('IA_MiniNav_ColumnsList');
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
      .filter(r => !_IA_NUMERIC_TYPES.test((r.column_type || '').toLowerCase()))
      .map(r => r.column_name)
      .filter(c => !excl.has(c));
    list.innerHTML = cols.map(c => `
      <button class="MN_chip MN_chip--col MN_chip--a" draggable="true" ondragstart="IA_SF_DragStart(event,'${c}')" title="${c}" style="cursor:grab;">${c}</button>
    `).join('');
  } catch { return; }
}

// ── Column selection ──────────────────────────────────────────────────────────
function IA_SelectAll() { document.querySelectorAll('#IA_MiniNav_ColumnsList .MN_chip').forEach(b => b.classList.add('active')); }
function IA_ClearAll()  { document.querySelectorAll('#IA_MiniNav_ColumnsList .MN_chip').forEach(b => b.classList.remove('active')); }
function IA_MiniNav_GetSelectedCols() {
  return [...document.querySelectorAll('#IA_MiniNav_ColumnsList .MN_chip.active')].map(b => b.title);
}

// Target / value count and run functions are defined in IndividualAnalysis.js

// ── IA Info Popup ─────────────────────────────────────────────────────────────
function IA_infoOpen(btn, title, text) {
  const popup = document.getElementById('IA_InfoPopup');
  if (!popup) return;
  document.getElementById('IA_InfoTitle').textContent = title;
  document.getElementById('IA_InfoBody').innerHTML    = text;
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
  setTimeout(() => document.addEventListener('click', _IA_infoOutside), 0);
  window.addEventListener('scroll', IA_infoClose, { once: true, capture: true });
}
function _IA_infoOutside(e) {
  const popup = document.getElementById('IA_InfoPopup');
  if (popup && !popup.contains(e.target) && !e.target.classList.contains('MN_info_btn'))
    IA_infoClose();
}
function IA_infoClose() {
  const popup = document.getElementById('IA_InfoPopup');
  if (popup) popup.style.display = 'none';
  document.removeEventListener('click', _IA_infoOutside);
}
