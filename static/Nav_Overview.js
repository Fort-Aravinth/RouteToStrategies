// ── Nav_Overview — OV info popup ──────────────────────────────────────────────

function OV_infoOpen(btn, title, text) {
  const popup = document.getElementById('OV_InfoPopup');
  if (!popup) return;
  document.getElementById('OV_InfoTitle').textContent = title;
  document.getElementById('OV_InfoBody').innerHTML    = text;
  popup.style.visibility = 'hidden';
  popup.style.display    = 'block';
  popup.style.top = popup.style.bottom = popup.style.left = popup.style.right = '';
  const pH = popup.offsetHeight, pW = popup.offsetWidth;
  popup.style.visibility = '';
  const r = btn.getBoundingClientRect(), gap = 8;
  const spaceBelow = window.innerHeight - r.bottom - gap, spaceAbove = r.top - gap;
  const spaceRight = window.innerWidth - r.left,           spaceLeft  = r.right;
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
  setTimeout(() => document.addEventListener('click', _OV_infoOutside), 0);
  window.addEventListener('scroll', OV_infoClose, { once: true, capture: true });
}
function _OV_infoOutside(e) {
  const popup = document.getElementById('OV_InfoPopup');
  if (popup && !popup.contains(e.target) && !e.target.classList.contains('pg-card-info-btn'))
    OV_infoClose();
}
function OV_infoClose() {
  const popup = document.getElementById('OV_InfoPopup');
  if (popup) popup.style.display = 'none';
  document.removeEventListener('click', _OV_infoOutside);
}
