// ── Shared helpers ────────────────────────────────────────────────────────────

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

// ── ANRA MiniNav ───────────────────────────────────────────────────────────────

function ANRA_MiniNav_RenderParams() { SP_RenderParamsTo('ANRA_MiniNav_ParamsDisplay', 'ra'); }

let _anraMiniParamsOpen = true;
function ANRA_MiniNav_ToggleParams() {
  _anraMiniParamsOpen = !_anraMiniParamsOpen;
  const body    = document.getElementById('ANRA_MiniNav_ParamsBody');
  const chevron = document.getElementById('ANRA_MiniNav_ParamsChevron');
  if (body)    body.style.display      = _anraMiniParamsOpen ? 'block' : 'none';
  if (chevron) chevron.style.transform = _anraMiniParamsOpen ? 'rotate(90deg)' : 'rotate(0deg)';
}

let _anraMiniColsOpen = true;
function ANRA_MiniNav_ToggleCols() {
  _anraMiniColsOpen = !_anraMiniColsOpen;
  const body    = document.getElementById('ANRA_MiniNav_ColBody');
  const chevron = document.getElementById('ANRA_MiniNav_ColChevron');
  if (body)    body.style.display      = _anraMiniColsOpen ? 'block' : 'none';
  if (chevron) chevron.style.transform = _anraMiniColsOpen ? 'rotate(90deg)' : 'rotate(0deg)';
  if (_anraMiniColsOpen) _navScrollOnExpand(document.getElementById('ANRA_MiniNav_ColSection'), document.getElementById('ANRA_MiniNav'));
}

let _anraMiniAmtOpen = true;
function ANRA_MiniNav_ToggleAmt() {
  _anraMiniAmtOpen = !_anraMiniAmtOpen;
  const body    = document.getElementById('ANRA_MiniNav_AmtBody');
  const chevron = document.getElementById('ANRA_MiniNav_AmtChevron');
  if (body)    body.style.display      = _anraMiniAmtOpen ? 'block' : 'none';
  if (chevron) chevron.style.transform = _anraMiniAmtOpen ? 'rotate(90deg)' : 'rotate(0deg)';
}

let _anraMiniScoreOpen = true;
function ANRA_MiniNav_ToggleScore() {
  _anraMiniScoreOpen = !_anraMiniScoreOpen;
  const body    = document.getElementById('ANRA_MiniNav_ScoreBody');
  const chevron = document.getElementById('ANRA_MiniNav_ScoreChevron');
  if (body)    body.style.display      = _anraMiniScoreOpen ? 'block' : 'none';
  if (chevron) chevron.style.transform = _anraMiniScoreOpen ? 'rotate(90deg)' : 'rotate(0deg)';
  if (_anraMiniScoreOpen) _navScrollOnExpand(document.getElementById('ANRA_MiniNav_ScoreSection'), document.getElementById('ANRA_MiniNav'));
}

let _anraMiniPresetsOpen = true;
function ANRA_MiniNav_TogglePresets() {
  _anraMiniPresetsOpen = !_anraMiniPresetsOpen;
  const body    = document.getElementById('ANRA_MiniNav_PresetsBody');
  const chevron = document.getElementById('ANRA_MiniNav_PresetsChevron');
  if (body)    body.style.display      = _anraMiniPresetsOpen ? 'block' : 'none';
  if (chevron) chevron.style.transform = _anraMiniPresetsOpen ? 'rotate(90deg)' : 'rotate(0deg)';
  if (_anraMiniPresetsOpen) _navScrollOnExpand(document.getElementById('ANRA_MiniNav_PresetsSection'), document.getElementById('ANRA_MiniNav'));
}

let _anraMiniAllExpanded = true;
function ANRA_MiniNav_ToggleAll() {
  _anraMiniAllExpanded = !_anraMiniAllExpanded;
  const sections = [
    { flag: '_anraMiniParamsOpen',   body: 'ANRA_MiniNav_ParamsBody',   chevron: 'ANRA_MiniNav_ParamsChevron' },
    { flag: '_anraMiniColsOpen',     body: 'ANRA_MiniNav_ColBody',      chevron: 'ANRA_MiniNav_ColChevron' },
    { flag: '_anraMiniAmtOpen',      body: 'ANRA_MiniNav_AmtBody',      chevron: 'ANRA_MiniNav_AmtChevron' },
    { flag: '_anraMiniScoreOpen',    body: 'ANRA_MiniNav_ScoreBody',    chevron: 'ANRA_MiniNav_ScoreChevron' },
    { flag: '_anraMiniPresetsOpen',  body: 'ANRA_MiniNav_PresetsBody',  chevron: 'ANRA_MiniNav_PresetsChevron' },
  ];
  sections.forEach(s => {
    if (s.flag === '_anraMiniParamsOpen')  _anraMiniParamsOpen  = _anraMiniAllExpanded;
    if (s.flag === '_anraMiniColsOpen')    _anraMiniColsOpen    = _anraMiniAllExpanded;
    if (s.flag === '_anraMiniAmtOpen')     _anraMiniAmtOpen     = _anraMiniAllExpanded;
    if (s.flag === '_anraMiniScoreOpen')   _anraMiniScoreOpen   = _anraMiniAllExpanded;
    if (s.flag === '_anraMiniPresetsOpen') _anraMiniPresetsOpen = _anraMiniAllExpanded;
    const body    = document.getElementById(s.body);
    const chevron = document.getElementById(s.chevron);
    if (body)    body.style.display      = _anraMiniAllExpanded ? 'block' : 'none';
    if (chevron) chevron.style.transform = _anraMiniAllExpanded ? 'rotate(90deg)' : 'rotate(0deg)';
  });
  const btn = document.getElementById('ANRA_MiniNav_ExpandBtn');
  if (btn) btn.title = _anraMiniAllExpanded ? 'Collapse all' : 'Expand all';
}

// ── SA MiniNav ────────────────────────────────────────────────────────────────

function SA_MiniNav_RenderParams() { SP_RenderParamsTo('SA_MiniNav_ParamsDisplay'); }

let _saMiniAmtOpen = true;
function SA_MiniNav_ToggleAmt() {
  _saMiniAmtOpen = !_saMiniAmtOpen;
  const body    = document.getElementById('SA_MiniNav_AmtBody');
  const chevron = document.getElementById('SA_MiniNav_AmtChevron');
  if (body)    body.style.display      = _saMiniAmtOpen ? 'block' : 'none';
  if (chevron) chevron.style.transform = _saMiniAmtOpen ? 'rotate(90deg)' : 'rotate(0deg)';
}

let _saMiniFiltersOpen = true;
function SA_MiniNav_ToggleFilters() {
  _saMiniFiltersOpen = !_saMiniFiltersOpen;
  const body    = document.getElementById('SA_MiniNav_FiltersBody');
  const chevron = document.getElementById('SA_MiniNav_FiltersChevron');
  if (body)    body.style.display      = _saMiniFiltersOpen ? 'block' : 'none';
  if (chevron) chevron.style.transform = _saMiniFiltersOpen ? 'rotate(90deg)' : 'rotate(0deg)';
}

let _saMiniMyScoreOpen = true;
function SA_MiniNav_ToggleMyScore() {
  _saMiniMyScoreOpen = !_saMiniMyScoreOpen;
  const body    = document.getElementById('SA_MiniNav_MyScoreBody');
  const chevron = document.getElementById('SA_MiniNav_MyScoreChevron');
  if (body)    body.style.display      = _saMiniMyScoreOpen ? 'block' : 'none';
  if (chevron) chevron.style.transform = _saMiniMyScoreOpen ? 'rotate(90deg)' : 'rotate(0deg)';
}

let _saMiniScoreOpen = true;
function SA_MiniNav_ToggleScore() {
  _saMiniScoreOpen = !_saMiniScoreOpen;
  const body    = document.getElementById('SA_MiniNav_ScoreBody');
  const chevron = document.getElementById('SA_MiniNav_ScoreChevron');
  if (body)    body.style.display      = _saMiniScoreOpen ? 'block' : 'none';
  if (chevron) chevron.style.transform = _saMiniScoreOpen ? 'rotate(90deg)' : 'rotate(0deg)';
  if (_saMiniScoreOpen) _navScrollOnExpand(document.getElementById('SA_MiniNav_ScoreSection'), document.getElementById('SA_MiniNav'));
}

let _saMiniParamsOpen = true;
function SA_MiniNav_ToggleParams() {
  _saMiniParamsOpen = !_saMiniParamsOpen;
  const body    = document.getElementById('SA_MiniNav_ParamsBody');
  const chevron = document.getElementById('SA_MiniNav_ParamsChevron');
  if (body)    body.style.display      = _saMiniParamsOpen ? 'block' : 'none';
  if (chevron) chevron.style.transform = _saMiniParamsOpen ? 'rotate(90deg)' : 'rotate(0deg)';
}

function SA_MiniNav_ToggleExtra(key) {
  const body    = document.getElementById(`SA_MiniNav_ExtraBody_${key}`);
  const chevron = document.getElementById(`SA_MiniNav_ExtraChevron_${key}`);
  if (!body) return;
  const open = body.style.display === 'none';
  body.style.display      = open ? 'block' : 'none';
  if (chevron) chevron.style.transform = open ? 'rotate(90deg)' : 'rotate(0deg)';
}

let _saMiniActionOpen = true;
function SA_MiniNav_ToggleAction() {
  _saMiniActionOpen = !_saMiniActionOpen;
  const body    = document.getElementById('SA_MiniNav_ActionBody');
  const chevron = document.getElementById('SA_MiniNav_ActionChevron');
  if (body)    body.style.display      = _saMiniActionOpen ? 'block' : 'none';
  if (chevron) chevron.style.transform = _saMiniActionOpen ? 'rotate(90deg)' : 'rotate(0deg)';
}

let _saMiniPresetsOpen = true;
function SA_MiniNav_TogglePresets() {
  _saMiniPresetsOpen = !_saMiniPresetsOpen;
  const body    = document.getElementById('SA_MiniNav_PresetsBody');
  const chevron = document.getElementById('SA_MiniNav_PresetsChevron');
  if (body)    body.style.display      = _saMiniPresetsOpen ? 'block' : 'none';
  if (chevron) chevron.style.transform = _saMiniPresetsOpen ? 'rotate(90deg)' : 'rotate(0deg)';
}

let _saMiniAllExpanded = true;
function SA_MiniNav_ToggleAll() {
  _saMiniAllExpanded = !_saMiniAllExpanded;
  const sections = [
    { flag: '_saMiniParamsOpen',   body: 'SA_MiniNav_ParamsBody',   chevron: 'SA_MiniNav_ParamsChevron' },
    { flag: '_saMiniScoreOpen',    body: 'SA_MiniNav_ScoreBody',    chevron: 'SA_MiniNav_ScoreChevron' },
    { flag: '_saMiniAmtOpen',      body: 'SA_MiniNav_AmtBody',      chevron: 'SA_MiniNav_AmtChevron' },
    { flag: '_saMiniFiltersOpen',  body: 'SA_MiniNav_FiltersBody',  chevron: 'SA_MiniNav_FiltersChevron' },
    { flag: '_saMiniMyScoreOpen',  body: 'SA_MiniNav_MyScoreBody',  chevron: 'SA_MiniNav_MyScoreChevron' },
    { flag: '_saMiniActionOpen',   body: 'SA_MiniNav_ActionBody',   chevron: 'SA_MiniNav_ActionChevron' },
    { flag: '_saMiniPresetsOpen',  body: 'SA_MiniNav_PresetsBody',  chevron: 'SA_MiniNav_PresetsChevron' },
  ];
  const flagMap = {
    '_saMiniParamsOpen':  () => { _saMiniParamsOpen  = _saMiniAllExpanded; },
    '_saMiniScoreOpen':   () => { _saMiniScoreOpen   = _saMiniAllExpanded; },
    '_saMiniAmtOpen':     () => { _saMiniAmtOpen     = _saMiniAllExpanded; },
    '_saMiniFiltersOpen': () => { _saMiniFiltersOpen = _saMiniAllExpanded; },
    '_saMiniMyScoreOpen': () => { _saMiniMyScoreOpen = _saMiniAllExpanded; },
    '_saMiniActionOpen':  () => { _saMiniActionOpen  = _saMiniAllExpanded; },
    '_saMiniPresetsOpen': () => { _saMiniPresetsOpen = _saMiniAllExpanded; },
  };
  sections.forEach(s => {
    flagMap[s.flag]();
    const body    = document.getElementById(s.body);
    const chevron = document.getElementById(s.chevron);
    if (body)    body.style.display      = _saMiniAllExpanded ? 'block' : 'none';
    if (chevron) chevron.style.transform = _saMiniAllExpanded ? 'rotate(90deg)' : 'rotate(0deg)';
  });
  document.querySelectorAll('[id^="SA_MiniNav_ExtraBody_"]').forEach(body => {
    body.style.display = _saMiniAllExpanded ? 'block' : 'none';
  });
  document.querySelectorAll('[id^="SA_MiniNav_ExtraChevron_"]').forEach(chevron => {
    chevron.style.transform = _saMiniAllExpanded ? 'rotate(90deg)' : 'rotate(0deg)';
  });
  const btn = document.getElementById('SA_MiniNav_ExpandBtn');
  if (btn) btn.title = _saMiniAllExpanded ? 'Collapse all' : 'Expand all';
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
