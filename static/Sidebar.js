// ── Sidebar ──────────────────────────────────────────────────────────────────

function Sidebar_Toggle() {
  const shell = document.querySelector('.shell');
  shell.classList.toggle('sidebar-hidden');
  ANRA_UpdateMiniNav();
}

function Sidebar_ToggleSection(h) {
  h.classList.toggle('open');
  h.nextElementSibling.classList.toggle('open');
}

function Sidebar_SetActive(id) {
  document.querySelectorAll('.sidebar-item.active').forEach(el => el.classList.remove('active'));
  const el = document.getElementById(id);
  if (el) el.classList.add('active');
  const accentMap = {
    'nav-load-data':           'var(--brand-sp)',
    'nav-preview-data':        'var(--brand-dm)',
    'nav-column-mgmt':         'var(--brand-cm)',
    'nav-parameters':          'var(--brand-pt)',
    'nav-overview':            'var(--brand-ov)',
    'nav-score-analysis':      'var(--brand-sa)',
    'nav-route-analysis':      'var(--brand-ra)',
    'nav-individual-analysis': 'var(--brand-ia-light)',
    'nav-policy-rules':        'var(--brand-pr-light)',
    'nav-rmon-import':         'var(--brand-irs-light)',
    'nav-playground':          'var(--brand-sn)',
  };
  const accent = accentMap[id] || 'var(--amber-500)';
  const btn = document.getElementById('devAgentBtn');
  if (btn) btn.style.background = accent;
  const icon = document.querySelector('.MN_brand_icon');
  if (icon) icon.style.background = accent;
}

function Sidebar_EnableParameters(enable) {
  const navParam = document.getElementById('nav-parameters');
  if (!navParam) return;
  if (enable) {
    navParam.style.opacity = '1';
    navParam.style.cursor = 'pointer';
    navParam.style.pointerEvents = 'auto';
  } else {
    navParam.style.opacity = '0.5';
    navParam.style.cursor = 'not-allowed';
    navParam.style.pointerEvents = 'none';
  }
}

