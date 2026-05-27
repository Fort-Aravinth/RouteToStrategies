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

document.addEventListener('DOMContentLoaded', () => {
  App_HideAllViews();

  // Global pg-table column selection — click a th to highlight its column.
  // Skips th elements that already have an inline onclick (they manage their own state).
  document.addEventListener('click', e => {
    const th = e.target.closest('.pg-table th');
    if (!th || th.hasAttribute('onclick')) return;
    const table = th.closest('.pg-table');
    if (!table) return;
    const idx = Array.from(th.parentElement.children).indexOf(th);
    const isSelected = th.classList.contains('pg-col-selected');

    // Clear all selections in this table
    table.querySelectorAll('th.pg-col-selected, td.pg-col-selected')
         .forEach(el => el.classList.remove('pg-col-selected'));

    // Toggle on if it wasn't already selected
    if (!isSelected) {
      th.classList.add('pg-col-selected');
      table.querySelectorAll('tbody tr').forEach(row => {
        const td = row.children[idx];
        if (td) td.classList.add('pg-col-selected');
      });
    }
  });
});
