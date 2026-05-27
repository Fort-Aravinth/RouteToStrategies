// ── Main Content ─────────────────────────────────────────────────────────────

function App_HideAllViews() {
  document.querySelectorAll('.main > *').forEach(el => {
    el.classList.remove('visible');
    el.style.setProperty('display', 'none', 'important');
  });
  document.querySelector('.shell')?.classList.remove('anra-active', 'sa-active', 'ia-active', 'pr-active');
  ['IA_MiniNav', 'ANRA_MiniNav', 'SA_MiniNav', 'PR_MiniNav'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
}

function App_ShowLanding() {
  App_HideAllViews();
  const el = document.getElementById('main-placeholder');
  if (el) el.style.removeProperty('display');
}

document.addEventListener('DOMContentLoaded', () => App_HideAllViews());
