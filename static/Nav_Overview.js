// ── Nav_Overview — OV info popup + single-query OV_RunAnalysis override ───────

function OV_showLoadingBadge(msg) {
  let el = document.getElementById('OV_ReadyBadge');
  if (!el) { el = document.createElement('div'); el.id = 'OV_ReadyBadge'; el.className = 'App_badge'; document.body.appendChild(el); }
  el.style.borderRightColor = '';
  el.innerHTML = `<svg viewBox="0 0 16 16" width="14" height="14" style="flex-shrink:0;animation:GS_spin 1s linear infinite;color:var(--brand-ov,#be123c)"><circle cx="8" cy="8" r="5.5" stroke="currentColor" stroke-width="1.5" stroke-dasharray="22" stroke-dashoffset="8" fill="none"/></svg><span>${msg}</span>`;
  OV_stackBadges();
}

function OV_stackBadges() {
  if (typeof SP_stackBadges === 'function') { SP_stackBadges(); return; }
  const badges = ['OV_ReadyBadge', 'SR_ReadyBadge', 'SRM_ReadyBadge', 'SP_ParamsBadge', 'GS_DataReadyBadge']
    .map(id => document.getElementById(id)).filter(Boolean);
  let bottom = 18;
  badges.forEach(b => { b.style.bottom = bottom + 'px'; bottom += b.offsetHeight + 8; });
}

// Replaces the original OV_RunAnalysis (which runs 2–6 separate sequential scans)
// with one query using FILTER aggregates — one file scan for all metrics.
window.OV_RunAnalysis = async function() {
  const params = typeof window.SP_getParams === 'function' ? window.SP_getParams() : null;
  if (!params || !params.col1) {
    document.getElementById('OV_MetricGrid').innerHTML = '<div class="ov-state" style="grid-column:1/-1;">Set Parameters to run overview.</div>';
    document.getElementById('OV_RateGrid').innerHTML = '';
    return;
  }
  const conn = window.LD_getConn ? window.LD_getConn() : null;
  const src  = window.LD_getSource ? window.LD_getSource() : null;
  if (!conn || !src) { App_toast('No data loaded', 'error'); return; }

  document.getElementById('OV_MetricGrid').innerHTML = '<div class="ov-state" style="grid-column:1/-1;">Loading…</div>';
  document.getElementById('OV_RateGrid').innerHTML = '';
  OV_showLoadingBadge('Running key metrics…');

  try {
    const _ovStart = performance.now();

    const col1Q      = `"${params.col1.replace(/"/g,'""')}"`;
    const vals       = (params.values || []).map(v => `'${v.replace(/'/g,"''")}'`).join(',');
    const fraudWhere = vals.length ? `${col1Q} IN (${vals})` : '1=0';
    const amtQ       = params.numeric ? `"${params.numeric.replace(/"/g,'""')}"` : null;
    const cardQ      = params.object  ? `"${params.object.replace(/"/g,'""')}"` : null;

    const sel = [
      `COUNT(*) AS total_vol`,
      `COUNT(*) FILTER (WHERE ${fraudWhere}) AS fraud_vol`,
      cardQ ? `COUNT(DISTINCT ${cardQ}) AS total_cards`                                : `NULL AS total_cards`,
      cardQ ? `COUNT(DISTINCT ${cardQ}) FILTER (WHERE ${fraudWhere}) AS fraud_cards`   : `NULL AS fraud_cards`,
      amtQ  ? `COALESCE(SUM(${amtQ}), 0) AS total_value`                              : `NULL AS total_value`,
      amtQ  ? `COALESCE(SUM(${amtQ}) FILTER (WHERE ${fraudWhere}), 0) AS fraud_value` : `NULL AS fraud_value`,
    ].join(', ');

    const row = (await conn.query(`SELECT ${sel} FROM ${src}`)).toArray()[0];

    const totalVol   = Number(row.total_vol);
    const fraudVol   = Number(row.fraud_vol);
    const totalCards = row.total_cards !== null ? Number(row.total_cards) : null;
    const fraudCards = row.fraud_cards !== null ? Number(row.fraud_cards) : null;
    const totalValue = row.total_value !== null ? Number(row.total_value) : null;
    const fraudValue = row.fraud_value !== null ? Number(row.fraud_value) : null;

    OV_RenderMetrics({ totalVol, fraudVol, totalCards, fraudCards, totalValue, fraudValue });
    OV_RenderRates({
      volRate:  totalVol > 0 ? fraudVol / totalVol * 100 : 0,
      valRate:  totalValue  > 0 ? fraudValue / totalValue * 100 : 0,
      hasValue: amtQ !== null,
    });

    OV_showLoadingBadge('Running weekday pattern…');
    if (typeof window.OV_RunWeekdayChart === 'function') await window.OV_RunWeekdayChart();

    const _ovSecs = ((performance.now() - _ovStart) / 1000).toFixed(2);
    let _ovBadge = document.getElementById('OV_ReadyBadge');
    if (!_ovBadge) { _ovBadge = document.createElement('div'); _ovBadge.id = 'OV_ReadyBadge'; _ovBadge.className = 'App_badge'; document.body.appendChild(_ovBadge); }
    _ovBadge.style.borderRightColor = 'var(--brand-ov,#be123c)';
    _ovBadge.innerHTML = `<svg viewBox="0 0 16 16" width="14" height="14" fill="none" style="flex-shrink:0;color:var(--brand-ov,#be123c)"><circle cx="8" cy="8" r="6.5" stroke="currentColor" stroke-width="1.5"/><path d="M5 8l2 2 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg><span><strong>Overview ready</strong> &nbsp;·&nbsp; ${totalVol.toLocaleString()} rows &nbsp;·&nbsp; ${_ovSecs}s</span><button onclick="document.getElementById('OV_ReadyBadge').remove();SP_stackBadges();">✕</button>`;
    OV_stackBadges();
  } catch(e) {
    console.error('OV_RunAnalysis error:', e);
    document.getElementById('OV_MetricGrid').innerHTML = `<div class="ov-state" style="grid-column:1/-1;">Error: ${e.message}</div>`;
    OV_showLoadingBadge('Overview error');
    App_toast('Error: ' + e.message, 'error');
  }
};

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
