// ── Sidebar Unlocking ─────────────────────────────────────────────────────────
// Single source of truth for all sidebar nav locking / unlocking.

// ── Nav item ID groups ────────────────────────────────────────────────────────
const _NAV_LOCK_IDS = ['nav-overview', 'nav-score-analysis', 'nav-score-comparison', 'nav-route-analysis', 'nav-individual-analysis', 'nav-policy-rules', 'nav-rmon-import', 'nav-spike-report', 'nav-spike-merchant'];
const _SP_LOCK_IDS  = ['nav-parameters', 'SP_SidebarPreset_Row'];

// ── Lock on page load ─────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  [..._SP_LOCK_IDS, ..._NAV_LOCK_IDS].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.classList.add('ld-locked'); el.setAttribute('data-nav-locked', '1'); }
  });
});

// ── data101 ready → unlock Set Parameters ────────────────────────────────────
window.NAV_UnlockSP = function() {
  _SP_LOCK_IDS.forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.classList.remove('ld-locked'); el.removeAttribute('data-nav-locked'); }
  });
};

// ── Apply Parameters → unlock Overview ───────────────────────────────────────
window.NAV_UnlockNav = function() {
  _NAV_LOCK_IDS.forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.classList.remove('ld-locked', 'sidebar-item-disabled'); el.removeAttribute('data-nav-locked'); }
  });
};

// ── Enable / disable Parameters nav item ─────────────────────────────────────
function NAV_EnableParameters(enable) {
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
