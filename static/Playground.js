// ── Playground ───────────────────────────────────────────────────────────────

function Playground_Open() {
  document.documentElement.style.setProperty('--toast-brand', 'var(--brand-sn)');
  App_HideAllViews();
  Sidebar_SetActive('nav-playground');
  document.getElementById('PlaygroundView').style.removeProperty('display');
}

function PG_toggleCustomSelect(id) {
  const el = document.getElementById(id);
  const isOpen = el.classList.contains('open');
  document.querySelectorAll('#PlaygroundView .custom-select.open').forEach(s => s.classList.remove('open'));
  if (!isOpen) {
    el.classList.add('open');
    setTimeout(() => {
      const trigger = el.querySelector('.cs-trigger');
      const options = el.querySelector('.cs-options');
      if (!trigger || !options) return;
      const rect = el.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      const dropdownHeight = Math.min(200, options.scrollHeight + 8);
      options.style.left = rect.left + 'px';
      options.style.width = rect.width + 'px';
      if (spaceBelow < dropdownHeight && spaceAbove > dropdownHeight) {
        options.style.top = (rect.top - dropdownHeight - 2) + 'px';
      } else {
        options.style.top = (rect.bottom + 2) + 'px';
        if (spaceBelow < 200) options.style.maxHeight = (spaceBelow - 20) + 'px';
      }
    }, 0);
  }
}

function PG_selectOption(el, value) {
  const cs = el.closest('.custom-select');
  cs.querySelector('.cs-value').textContent = value;
  cs.querySelectorAll('.cs-option').forEach(o => o.classList.remove('cs-selected'));
  el.classList.add('cs-selected');
  cs.classList.remove('open');
}

document.addEventListener('click', e => {
  if (!e.target.closest('#PlaygroundView .custom-select')) {
    document.querySelectorAll('#PlaygroundView .custom-select.open').forEach(s => s.classList.remove('open'));
  }
});

function PG_toggleChip(el) {
  el.classList.toggle('active');
}

function PG_toggleTableCol(th) {
  const table = th.closest('table');
  const index = Array.from(th.parentElement.children).indexOf(th);
  const isSelected = th.classList.contains('pg-col-selected');

  if (isSelected) {
    th.classList.remove('pg-col-selected');
    table.querySelectorAll(`tbody tr td:nth-child(${index + 1})`).forEach(td => td.classList.remove('pg-col-selected'));
  } else {
    th.classList.add('pg-col-selected');
    table.querySelectorAll(`tbody tr td:nth-child(${index + 1})`).forEach(td => td.classList.add('pg-col-selected'));
  }
}
