// ── Playground ───────────────────────────────────────────────────────────────

// ── Info popup (Playground-only) ─────────────────────────────────────────────
function MN_infoOpen(btn, title, text) {
  const popup = document.getElementById('MN_InfoPopup');
  if (!popup) return;
  document.getElementById('MN_InfoTitle').textContent = title;
  document.getElementById('MN_InfoBody').innerHTML    = text;
  const color = getComputedStyle(btn).color;
  const inner = popup.querySelector('.mn-info-popup');
  if (inner) inner.style.borderTopColor = color;
  const titleEl = document.getElementById('MN_InfoTitle');
  if (titleEl) titleEl.style.color = color;
  popup.style.visibility = 'hidden';
  popup.style.display    = 'block';
  popup.style.top = popup.style.bottom = popup.style.left = popup.style.right = '';
  const pH = popup.offsetHeight, pW = popup.offsetWidth;
  popup.style.visibility = '';
  const r = btn.getBoundingClientRect(), gap = 8;
  const spaceBelow = window.innerHeight - r.bottom - gap, spaceAbove = r.top - gap;
  const spaceRight = window.innerWidth - r.left,          spaceLeft  = r.right;
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
  setTimeout(() => document.addEventListener('click', _MN_infoOutside), 0);
  window.addEventListener('scroll', MN_infoClose, { once: true, capture: true });
}
function _MN_infoOutside(e) {
  const popup = document.getElementById('MN_InfoPopup');
  if (popup && !popup.contains(e.target) && !e.target.classList.contains('MN_info_btn'))
    MN_infoClose();
}
function MN_infoClose() {
  const popup = document.getElementById('MN_InfoPopup');
  if (popup) popup.style.display = 'none';
  document.removeEventListener('click', _MN_infoOutside);
}

// ── Nav scroll indicators ─────────────────────────────────────────────────────
(function () {
  function _inject() {
    const nav = document.getElementById('PG_MiniNav');
    if (!nav || document.getElementById('PG_ScrollerDown')) return;
    nav.insertAdjacentHTML('afterbegin', `
      <div id="PG_ScrollerUp" onclick="PG_ScrollUp()" title="Scroll up">
        <svg viewBox="0 0 16 8" width="14" height="7" fill="none">
          <polyline points="1 7 8 1 15 7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <div class="MN_ScrollBar"></div>
      </div>`);
    nav.insertAdjacentHTML('beforeend', `
      <div id="PG_ScrollerDown" onclick="PG_ScrollDown()" title="Scroll down">
        <div class="MN_ScrollBar"></div>
        <svg viewBox="0 0 16 8" width="14" height="7" fill="none">
          <polyline points="1 1 8 7 15 1" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>`);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', _inject);
  else _inject();
})();

function PG_ScrollDown() {
  const nav = document.getElementById('PG_MiniNav');
  if (nav) nav.scrollBy({ top: 150, behavior: 'smooth' });
}
function PG_ScrollUp() {
  const nav = document.getElementById('PG_MiniNav');
  if (nav) nav.scrollBy({ top: -150, behavior: 'smooth' });
}

function Playground_Open() {
  document.documentElement.style.setProperty('--toast-brand', 'var(--brand-sn)');
  App_HideAllViews();
  Sidebar_SetActive('nav-playground');
  document.getElementById('PlaygroundView').style.removeProperty('display');
  document.querySelector('.shell').classList.add('pg-active');
  document.getElementById('PG_MiniNav').style.display = 'flex';
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

// ── Extended component handlers ───────────────────────────────────────────────

function PG_stepperAdj(btn, delta) {
  const input = btn.parentElement.querySelector('.pg-stepper-input');
  if (input) input.value = (parseInt(input.value) || 0) + delta;
}

function PG_togglePwd(id, btn) {
  const el = document.getElementById(id);
  if (!el) return;
  el.type = el.type === 'password' ? 'text' : 'password';
  btn.style.opacity = el.type === 'text' ? '1' : '0.5';
}

function PG_colorSync(inputId, valId) {
  const v = document.getElementById(inputId)?.value;
  const el = document.getElementById(valId);
  if (el && v) el.textContent = v.toUpperCase();
}

function PG_sliderSync(input, valId) {
  const el = document.getElementById(valId);
  if (el) el.textContent = input.value;
}

function PG_multiPick(option, selectId) {
  option.classList.toggle('cs-selected');
  const selected = document.querySelectorAll(`#${selectId} .cs-option.cs-selected`);
  const val = document.getElementById(selectId + '-val');
  if (val) val.textContent = selected.length ? Array.from(selected).map(o => o.textContent.replace('✓ ','')).join(', ') : 'Choose options…';
}

function PG_segSwitch(groupId, btn) {
  document.querySelectorAll(`#${groupId} .pg-seg-btn`).forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

function PG_splitToggle(btn) {
  btn.closest('.pg-split-btn').classList.toggle('open');
}

function PG_splitClose(option) {
  option.closest('.pg-split-btn').classList.remove('open');
}

function PG_loadBtn(btn) {
  btn.classList.add('loading');
  btn.disabled = true;
  setTimeout(() => { btn.classList.remove('loading'); btn.disabled = false; }, 2000);
}

function PG_progressSync(input, barId, valId) {
  const bar = document.getElementById(barId);
  const val = document.getElementById(valId);
  if (bar) bar.style.width = input.value + '%';
  if (val) val.textContent = input.value + '%';
}

function PG_starRate(id, n) {
  const stars = document.querySelectorAll(`#${id} span`);
  stars.forEach((s, i) => s.classList.toggle('lit', i < n));
  stars.forEach((s, i) => s.textContent = i < n ? '★' : '☆');
}

function PG_tabSwitch(barId, btn) {
  const bar = document.getElementById(barId);
  if (!bar) return;
  bar.querySelectorAll('.pg-tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  const idx = Array.from(bar.querySelectorAll('.pg-tab')).indexOf(btn);
  document.querySelectorAll(`[id^="${barId}-"]`).forEach((p, i) => p.classList.toggle('active', i === idx));
}

function PG_pagePick(groupId, btn) {
  document.querySelectorAll(`#${groupId} .pg-page-btn`).forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const pages = document.querySelectorAll(`#${groupId} .pg-page-btn:not(:first-child):not(:last-child)`);
  const prev = document.querySelector(`#${groupId} .pg-page-btn:first-child`);
  const next = document.querySelector(`#${groupId} .pg-page-btn:last-child`);
  const idx = Array.from(pages).indexOf(btn);
  if (prev) prev.disabled = idx === 0;
  if (next) next.disabled = idx === pages.length - 1;
}

function PG_pagePrev(groupId) {
  const active = document.querySelector(`#${groupId} .pg-page-btn.active`);
  if (active?.previousElementSibling && !active.previousElementSibling.classList.contains('pg-page-btn') === false) {
    const prev = active.previousElementSibling;
    if (prev && !prev.disabled) PG_pagePick(groupId, prev);
  }
}

function PG_pageNext(groupId) {
  const active = document.querySelector(`#${groupId} .pg-page-btn.active`);
  if (active?.nextElementSibling) {
    const next = active.nextElementSibling;
    if (next && !next.disabled) PG_pagePick(groupId, next);
  }
}

function PG_accordionToggle(trigger) {
  trigger.classList.toggle('open');
}

// Close split menus on outside click
document.addEventListener('click', e => {
  if (!e.target.closest('.pg-split-btn')) document.querySelectorAll('.pg-split-btn.open').forEach(b => b.classList.remove('open'));
});

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
