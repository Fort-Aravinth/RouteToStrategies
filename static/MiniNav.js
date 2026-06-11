// ── MiniNav Info Popup — shared by all mini-navs ─────────────────────────────

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

// ── SP Params Renderer — renders Set Parameters state into any mini-nav panel ─

window.SP_RenderParamsTo = function(elementId, brand = 'sa') {
  const el = document.getElementById(elementId);
  if (!el) return;
  const p = typeof window.SP_getParams === 'function' ? window.SP_getParams() : null;
  if (!p || !p.col1) { el.innerHTML = '<div class="MN_hint">— Apply parameters to load —</div>'; return; }
  const row = (label, value) =>
    `<div class="MN_param_row">
      <div class="MN_param_label">${label}</div>
      <div class="MN_param_value">${value || '—'}</div>
    </div>`;
  const divider = `<div class="MN_param_divider"></div>`;
  const values = Array.isArray(p.values) ? p.values.join(', ') : (p.values || '—');
  let html = row('Fraud Filter Column', p.col1)
           + row('Filter Values', values)
           + row('Amount Metric Column', p.numeric)
           + (p.currency ? row('Currency', p.currency) : '')
           + row('Card Dimension Column', p.object);
  if (p.auth_date || p.auth_time) {
    html += divider;
    if (p.auth_date)         html += row('Authorisations Date',  p.auth_date);
    if (p.auth_time)         html += row('Authorisations Time',  p.auth_time);
    if (p.combined_datetime) html += row('Combined Date & Time', p.combined_datetime);
  }
  const dm = p.decisionMode;
  if (dm && dm.col) {
    html += divider + row('Decision Mode Column', dm.col);
    html += `<div class="MN_param_tags">
      <div class="MN_param_tag">✓ Successful: ${(dm.assigned?.successful||[]).join(', ')||'—'}</div>
      <div class="MN_param_tag secondary">✗ Unsuccessful: ${(dm.assigned?.unsuccessful||[]).join(', ')||'—'}</div>
    </div>`;
  }
  (p.customCards || []).forEach(card => {
    html += divider + row(card.name || 'Custom', card.col || '—');
    html += `<div class="MN_param_tags">
      <div class="MN_param_tag">✓ ${card.labelA||'A'}: ${(card.assigned?.a||[]).join(', ')||'—'}</div>
      <div class="MN_param_tag secondary">✗ ${card.labelB||'B'}: ${(card.assigned?.b||[]).join(', ')||'—'}</div>
    </div>`;
  });
  el.innerHTML = html;
};
