// ── Shared helpers ────────────────────────────────────────────────────────────

// ── Available Columns — shared column picker ──────────────────────────────────
async function MN_PopulateCols(listId) {
  const list = document.getElementById(listId);
  if (!list) return;
  const conn = window.LD_getConn?.();
  const src  = window.LD_getSource?.();
  if (!conn || !src) {
    list.innerHTML = '<span style="font-size:0.62rem;color:var(--color-text-dim);padding:2px 0;">— Load data first —</span>';
    return;
  }
  let cols = [];
  try {
    const res = await conn.query(`DESCRIBE "${src}"`);
    cols = res.toArray().map(r => r.column_name);
  } catch { return; }
  list.innerHTML = cols.map(c => `
    <button class="MN_chip MN_chip--col MN_chip--a" onclick="this.classList.toggle('active')" title="${c}">${c}</button>
  `).join('');
}

function MN_SelectAllCols(listId) {
  document.querySelectorAll(`#${listId} .MN_chip`).forEach(b => b.classList.add('active'));
}

function MN_ClearCols(listId) {
  document.querySelectorAll(`#${listId} .MN_chip`).forEach(b => b.classList.remove('active'));
}

function MN_GetSelectedCols(listId) {
  return Array.from(document.querySelectorAll(`#${listId} .MN_chip.active`)).map(b => b.title);
}

function MN_initScrollArrows(navId) {
  const nav = document.getElementById(navId);
  if (!nav) return;
  const up = nav.querySelector('.MN_scroll_up');
  const dn = nav.querySelector('.MN_scroll_dn');
  if (!up || !dn) return;

  function update() {
    const atTop    = nav.scrollTop <= 4;
    const atBottom = nav.scrollTop + nav.clientHeight >= nav.scrollHeight - 4;
    up.classList.toggle('visible', !atTop);
    dn.classList.toggle('visible', !atBottom);
  }

  nav.addEventListener('scroll', update, { passive: true });
  // re-check whenever content changes height
  new ResizeObserver(update).observe(nav);
  update();

  up.addEventListener('click', () => nav.scrollBy({ top: -80, behavior: 'smooth' }));
  dn.addEventListener('click', () => nav.scrollBy({ top:  80, behavior: 'smooth' }));
}

function _navScrollOnExpand(sectionEl, navEl) {
  if (!sectionEl || !navEl) return;
  setTimeout(() => {
    const navRect = navEl.getBoundingClientRect();
    const secRect = sectionEl.getBoundingClientRect();
    if (secRect.top > navRect.top + navRect.height * 0.45) {
      navEl.scrollBy({ top: secRect.top - navRect.top - 8, behavior: 'smooth' });
    }
  }, 50);
}

// ── SA MiniNav ────────────────────────────────────────────────────────────────

function NAV_SA_RenderParams() { SP_RenderParamsTo('NAV_SA_ParamsDisplay'); }

let _NAV_SA_AmtOpen = true;
function NAV_SA_ToggleAmt() {
  _NAV_SA_AmtOpen = !_NAV_SA_AmtOpen;
  const body    = document.getElementById('NAV_SA_AmtBody');
  const chevron = document.getElementById('NAV_SA_AmtChevron');
  if (body)    body.style.display      = _NAV_SA_AmtOpen ? 'block' : 'none';
  if (chevron) chevron.style.transform = _NAV_SA_AmtOpen ? 'rotate(90deg)' : 'rotate(0deg)';
}

let _NAV_SA_FiltersOpen = true;
function NAV_SA_ToggleFilters() {
  _NAV_SA_FiltersOpen = !_NAV_SA_FiltersOpen;
  const body    = document.getElementById('NAV_SA_FiltersBody');
  const chevron = document.getElementById('NAV_SA_FiltersChevron');
  if (body)    body.style.display      = _NAV_SA_FiltersOpen ? 'block' : 'none';
  if (chevron) chevron.style.transform = _NAV_SA_FiltersOpen ? 'rotate(90deg)' : 'rotate(0deg)';
}

let _NAV_SA_MyScoreOpen = true;
function NAV_SA_ToggleMyScore() {
  _NAV_SA_MyScoreOpen = !_NAV_SA_MyScoreOpen;
  const body    = document.getElementById('NAV_SA_MyScoreBody');
  const chevron = document.getElementById('NAV_SA_MyScoreChevron');
  if (body)    body.style.display      = _NAV_SA_MyScoreOpen ? 'block' : 'none';
  if (chevron) chevron.style.transform = _NAV_SA_MyScoreOpen ? 'rotate(90deg)' : 'rotate(0deg)';
}

let _NAV_SA_ScoreOpen = true;
function NAV_SA_ToggleScore() {
  _NAV_SA_ScoreOpen = !_NAV_SA_ScoreOpen;
  const body    = document.getElementById('NAV_SA_ScoreBody');
  const chevron = document.getElementById('NAV_SA_ScoreChevron');
  if (body)    body.style.display      = _NAV_SA_ScoreOpen ? 'block' : 'none';
  if (chevron) chevron.style.transform = _NAV_SA_ScoreOpen ? 'rotate(90deg)' : 'rotate(0deg)';
  if (_NAV_SA_ScoreOpen) _navScrollOnExpand(document.getElementById('NAV_SA_ScoreSection'), document.getElementById('SA_MiniNav'));
}

let _NAV_SA_ParamsOpen = true;
function NAV_SA_ToggleParams() {
  _NAV_SA_ParamsOpen = !_NAV_SA_ParamsOpen;
  const body    = document.getElementById('NAV_SA_ParamsBody');
  const chevron = document.getElementById('NAV_SA_ParamsChevron');
  if (body)    body.style.display      = _NAV_SA_ParamsOpen ? 'block' : 'none';
  if (chevron) chevron.style.transform = _NAV_SA_ParamsOpen ? 'rotate(90deg)' : 'rotate(0deg)';
}

function NAV_SA_ToggleExtra(key) {
  const body    = document.getElementById(`NAV_SA_ExtraBody_${key}`);
  const chevron = document.getElementById(`NAV_SA_ExtraChevron_${key}`);
  if (!body) return;
  const open = body.style.display === 'none';
  body.style.display      = open ? 'block' : 'none';
  if (chevron) chevron.style.transform = open ? 'rotate(90deg)' : 'rotate(0deg)';
}

let _NAV_SA_ActionOpen = true;
function NAV_SA_ToggleAction() {
  _NAV_SA_ActionOpen = !_NAV_SA_ActionOpen;
  const body    = document.getElementById('NAV_SA_ActionBody');
  const chevron = document.getElementById('NAV_SA_ActionChevron');
  if (body)    body.style.display      = _NAV_SA_ActionOpen ? 'block' : 'none';
  if (chevron) chevron.style.transform = _NAV_SA_ActionOpen ? 'rotate(90deg)' : 'rotate(0deg)';
}

let _NAV_SA_PresetsOpen = true;
function NAV_SA_TogglePresets() {
  _NAV_SA_PresetsOpen = !_NAV_SA_PresetsOpen;
  const body    = document.getElementById('NAV_SA_PresetsBody');
  const chevron = document.getElementById('NAV_SA_PresetsChevron');
  if (body)    body.style.display      = _NAV_SA_PresetsOpen ? 'block' : 'none';
  if (chevron) chevron.style.transform = _NAV_SA_PresetsOpen ? 'rotate(90deg)' : 'rotate(0deg)';
}

let _NAV_SA_AllExpanded = true;
function NAV_SA_ToggleAll() {
  _NAV_SA_AllExpanded = !_NAV_SA_AllExpanded;
  const sections = [
    { flag: '_NAV_SA_ParamsOpen',   body: 'NAV_SA_ParamsBody',   chevron: 'NAV_SA_ParamsChevron' },
    { flag: '_NAV_SA_ScoreOpen',    body: 'NAV_SA_ScoreBody',    chevron: 'NAV_SA_ScoreChevron' },
    { flag: '_NAV_SA_AmtOpen',      body: 'NAV_SA_AmtBody',      chevron: 'NAV_SA_AmtChevron' },
    { flag: '_NAV_SA_FiltersOpen',  body: 'NAV_SA_FiltersBody',  chevron: 'NAV_SA_FiltersChevron' },
    { flag: '_NAV_SA_MyScoreOpen',  body: 'NAV_SA_MyScoreBody',  chevron: 'NAV_SA_MyScoreChevron' },
    { flag: '_NAV_SA_ActionOpen',   body: 'NAV_SA_ActionBody',   chevron: 'NAV_SA_ActionChevron' },
    { flag: '_NAV_SA_PresetsOpen',  body: 'NAV_SA_PresetsBody',  chevron: 'NAV_SA_PresetsChevron' },
  ];
  const flagMap = {
    '_NAV_SA_ParamsOpen':  () => { _NAV_SA_ParamsOpen  = _NAV_SA_AllExpanded; },
    '_NAV_SA_ScoreOpen':   () => { _NAV_SA_ScoreOpen   = _NAV_SA_AllExpanded; },
    '_NAV_SA_AmtOpen':     () => { _NAV_SA_AmtOpen     = _NAV_SA_AllExpanded; },
    '_NAV_SA_FiltersOpen': () => { _NAV_SA_FiltersOpen = _NAV_SA_AllExpanded; },
    '_NAV_SA_MyScoreOpen': () => { _NAV_SA_MyScoreOpen = _NAV_SA_AllExpanded; },
    '_NAV_SA_ActionOpen':  () => { _NAV_SA_ActionOpen  = _NAV_SA_AllExpanded; },
    '_NAV_SA_PresetsOpen': () => { _NAV_SA_PresetsOpen = _NAV_SA_AllExpanded; },
  };
  sections.forEach(s => {
    flagMap[s.flag]();
    const body    = document.getElementById(s.body);
    const chevron = document.getElementById(s.chevron);
    if (body)    body.style.display      = _NAV_SA_AllExpanded ? 'block' : 'none';
    if (chevron) chevron.style.transform = _NAV_SA_AllExpanded ? 'rotate(90deg)' : 'rotate(0deg)';
  });
  document.querySelectorAll('[id^="NAV_SA_ExtraBody_"]').forEach(body => {
    body.style.display = _NAV_SA_AllExpanded ? 'block' : 'none';
  });
  document.querySelectorAll('[id^="NAV_SA_ExtraChevron_"]').forEach(chevron => {
    chevron.style.transform = _NAV_SA_AllExpanded ? 'rotate(90deg)' : 'rotate(0deg)';
  });
  const btn = document.getElementById('NAV_SA_ExpandBtn');
  if (btn) btn.title = _NAV_SA_AllExpanded ? 'Collapse all' : 'Expand all';
}

// ── PG MiniNav ────────────────────────────────────────────────────────────────

let _pgMiniInputsOpen  = true;
let _pgMiniDropdownOpen = true;
let _pgMiniChipsOpen   = true;
let _pgMiniTableOpen   = true;
let _pgMiniAllExpanded = true;

function _PG_toggle(bodyId, chevronId, open) {
  const body    = document.getElementById(bodyId);
  const chevron = document.getElementById(chevronId);
  if (body)    body.style.display      = open ? 'block' : 'none';
  if (chevron) chevron.style.transform = open ? 'rotate(90deg)' : 'rotate(0deg)';
}
function PG_MiniNav_ToggleInputs() {
  _pgMiniInputsOpen = !_pgMiniInputsOpen;
  _PG_toggle('PG_MiniNav_InputsBody', 'PG_MiniNav_InputsChevron', _pgMiniInputsOpen);
}
function PG_MiniNav_ToggleDropdown() {
  _pgMiniDropdownOpen = !_pgMiniDropdownOpen;
  _PG_toggle('PG_MiniNav_DropdownBody', 'PG_MiniNav_DropdownChevron', _pgMiniDropdownOpen);
}
function PG_MiniNav_ToggleChips() {
  _pgMiniChipsOpen = !_pgMiniChipsOpen;
  _PG_toggle('PG_MiniNav_ChipsBody', 'PG_MiniNav_ChipsChevron', _pgMiniChipsOpen);
}
function PG_MiniNav_ToggleTable() {
  _pgMiniTableOpen = !_pgMiniTableOpen;
  _PG_toggle('PG_MiniNav_TableBody', 'PG_MiniNav_TableChevron', _pgMiniTableOpen);
}
function PG_MiniNav_ToggleAll() {
  _pgMiniAllExpanded = !_pgMiniAllExpanded;
  _pgMiniInputsOpen   = _pgMiniAllExpanded;
  _pgMiniDropdownOpen = _pgMiniAllExpanded;
  _pgMiniChipsOpen    = _pgMiniAllExpanded;
  _pgMiniTableOpen    = _pgMiniAllExpanded;
  [
    ['PG_MiniNav_InputsBody',   'PG_MiniNav_InputsChevron'],
    ['PG_MiniNav_DropdownBody', 'PG_MiniNav_DropdownChevron'],
    ['PG_MiniNav_ChipsBody',    'PG_MiniNav_ChipsChevron'],
    ['PG_MiniNav_TableBody',    'PG_MiniNav_TableChevron'],
  ].forEach(([b, c]) => _PG_toggle(b, c, _pgMiniAllExpanded));
  const btn = document.getElementById('PG_MiniNav_ExpandBtn');
  if (btn) btn.title = _pgMiniAllExpanded ? 'Collapse all' : 'Expand all';
}

// ── IA MiniNav ────────────────────────────────────────────────────────────────

let _iaMiniPresetsOpen = true;
function IA_MiniNav_TogglePresets() {
  _iaMiniPresetsOpen = !_iaMiniPresetsOpen;
  const body    = document.getElementById('IA_MiniNav_PresetsBody');
  const chevron = document.getElementById('IA_MiniNav_PresetsChevron');
  if (body)    body.style.display      = _iaMiniPresetsOpen ? 'block' : 'none';
  if (chevron) chevron.style.transform = _iaMiniPresetsOpen ? 'rotate(90deg)' : 'rotate(0deg)';
  if (_iaMiniPresetsOpen) _navScrollOnExpand(document.getElementById('IA_MiniNav_PresetsSection'), document.getElementById('IA_MiniNav'));
}
