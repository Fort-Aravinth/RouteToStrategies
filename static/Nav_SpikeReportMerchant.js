// ── Nav_SpikeReportMerchant — Spike Report by Merchant mini-nav ───────────────

// ── Badge ─────────────────────────────────────────────────────────────────────
function SRM_showBadge(type, msg) {
  let el = document.getElementById('SRM_ReadyBadge');
  if (!el) { el = document.createElement('div'); el.id = 'SRM_ReadyBadge'; el.className = 'App_badge'; document.body.appendChild(el); }
  if (type === 'loading') {
    el.style.borderRightColor = '';
    el.innerHTML = `<svg viewBox="0 0 16 16" width="14" height="14" style="flex-shrink:0;animation:GS_spin 1s linear infinite;color:var(--brand-sp)"><circle cx="8" cy="8" r="5.5" stroke="currentColor" stroke-width="1.5" stroke-dasharray="22" stroke-dashoffset="8" fill="none"/></svg><span>${msg}</span>`;
  } else {
    el.style.borderRightColor = 'var(--brand-sp)';
    el.innerHTML = `<svg viewBox="0 0 16 16" width="14" height="14" fill="none" style="flex-shrink:0;color:var(--brand-sp)"><circle cx="8" cy="8" r="6.5" stroke="currentColor" stroke-width="1.5"/><path d="M5 8l2 2 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg><span>${msg}</span><button onclick="document.getElementById('SRM_ReadyBadge').remove();SP_stackBadges();">✕</button>`;
  }
  if (typeof SP_stackBadges === 'function') SP_stackBadges();
}

// ── SRM Scroll indicators ─────────────────────────────────────────────────────
(function () {
  function _inject() {
    const nav = document.getElementById('SRM_MiniNav');
    if (!nav || document.getElementById('SRM_ScrollerDown')) return;
    nav.insertAdjacentHTML('afterbegin', `
      <div id="SRM_ScrollerUp" onclick="SRM_ScrollUp()" title="Scroll up">
        <svg viewBox="0 0 16 8" width="14" height="7" fill="none">
          <polyline points="1 7 8 1 15 7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <div class="MN_ScrollBar"></div>
      </div>`);
    nav.insertAdjacentHTML('beforeend', `
      <div id="SRM_ScrollerDown" onclick="SRM_ScrollDown()" title="Scroll down">
        <div class="MN_ScrollBar"></div>
        <svg viewBox="0 0 16 8" width="14" height="7" fill="none">
          <polyline points="1 1 8 7 15 1" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>`);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', _inject);
  else _inject();
})();

function SRM_ScrollUp()   { document.getElementById('SRM_MiniNav')?.scrollBy({ top: -150, behavior: 'smooth' }); }
function SRM_ScrollDown() { document.getElementById('SRM_MiniNav')?.scrollBy({ top:  150, behavior: 'smooth' }); }

// ── SRM Info Popup ────────────────────────────────────────────────────────────
function SRM_infoOpen(btn, title, text) {
  const popup = document.getElementById('SRM_InfoPopup');
  if (!popup) return;
  document.getElementById('SRM_InfoTitle').textContent = title;
  document.getElementById('SRM_InfoBody').innerHTML    = text;
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
  setTimeout(() => document.addEventListener('click', _SRM_infoOutside), 0);
  window.addEventListener('scroll', SRM_infoClose, { once: true, capture: true });
}
function _SRM_infoOutside(e) {
  const popup = document.getElementById('SRM_InfoPopup');
  if (popup && !popup.contains(e.target) && !e.target.classList.contains('MN_info_btn'))
    SRM_infoClose();
}
function SRM_infoClose() {
  const popup = document.getElementById('SRM_InfoPopup');
  if (popup) popup.style.display = 'none';
  document.removeEventListener('click', _SRM_infoOutside);
}
