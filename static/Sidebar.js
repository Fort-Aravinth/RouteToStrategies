// ── Sidebar ──────────────────────────────────────────────────────────────────

function Sidebar_Toggle() {
  const shell = document.querySelector('.shell');
  shell.classList.toggle('sidebar-hidden');
  if (typeof RA_UpdateMiniNav === 'function') RA_UpdateMiniNav();
}

function Nav_Toggle() {
  document.querySelector('.shell').classList.toggle('nav-hidden');
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
    'nav-get-started':         'var(--brand-dm)',
    'nav-load-data':           'var(--brand-sp)',
    'nav-preview-data':        'var(--brand-dm)',
    'nav-column-mgmt':         'var(--brand-cm)',
    'nav-parameters':          'var(--brand-pt)',
    'nav-overview':            'var(--brand-ov)',
    'nav-score-analysis':      'var(--brand-sa)',
    'nav-score-comparison':    '#0ea5e9',
    'nav-route-analysis':      'var(--brand-ra)',
    'nav-individual-analysis': 'var(--brand-ia-light)',
    'nav-policy-rules':        'var(--brand-pr-light)',
    'nav-rmon-import':         'var(--brand-irs-light)',
    'nav-playground':          'var(--brand-sn)',
    'nav-spike-report':        '#DC2626',
    'nav-project-unnamed':     '#0891B2',
    'nav-rule-declines':       '#f97316',
  };
  const accent = accentMap[id] || 'var(--amber-500)';
  const btn = document.getElementById('devAgentBtn');
  if (btn) btn.style.background = accent;
  const icon = document.querySelector('.lp-brand-icon');
  if (icon) icon.style.background = accent;
}


