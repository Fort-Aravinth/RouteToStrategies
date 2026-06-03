// ── Policy Rules Mini-Nav ─────────────────────────────────────────────────────

(function () {
  function _inject() {
    const nav = document.getElementById('PR_MiniNav');
    if (!nav || document.getElementById('PR_ScrollerDown')) return;
    nav.insertAdjacentHTML('afterbegin', `
      <div id="PR_ScrollerUp" onclick="PR_ScrollUp()" title="Scroll up">
        <svg viewBox="0 0 16 8" width="14" height="7" fill="none">
          <polyline points="1 7 8 1 15 7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <div class="MN_ScrollBar"></div>
      </div>`);
    nav.insertAdjacentHTML('beforeend', `
      <div id="PR_ScrollerDown" onclick="PR_ScrollDown()" title="Scroll down">
        <div class="MN_ScrollBar"></div>
        <svg viewBox="0 0 16 8" width="14" height="7" fill="none">
          <polyline points="1 1 8 7 15 1" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>`);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', _inject);
  else _inject();
})();

function PR_ScrollDown() { document.getElementById('PR_MiniNav')?.scrollBy({ top:  150, behavior: 'smooth' }); }
function PR_ScrollUp()   { document.getElementById('PR_MiniNav')?.scrollBy({ top: -150, behavior: 'smooth' }); }

function PR_MiniNav_RenderParams() { SP_RenderParamsTo('PR_MiniNav_ParamsDisplay', 'pr'); }

let _prMiniParamsOpen = true;
function PR_MiniNav_ToggleParams() {
  _prMiniParamsOpen = !_prMiniParamsOpen;
  const body    = document.getElementById('PR_MiniNav_ParamsBody');
  const chevron = document.getElementById('PR_MiniNav_ParamsChevron');
  if (body)    body.style.display      = _prMiniParamsOpen ? 'block' : 'none';
  if (chevron) chevron.style.transform = _prMiniParamsOpen ? 'rotate(90deg)' : 'rotate(0deg)';
}

let _prMiniAllExpanded = true;
function PR_MiniNav_ToggleAll() {
  _prMiniAllExpanded = !_prMiniAllExpanded;
  _prMiniParamsOpen = _prMiniAllExpanded;
  const body    = document.getElementById('PR_MiniNav_ParamsBody');
  const chevron = document.getElementById('PR_MiniNav_ParamsChevron');
  if (body)    body.style.display      = _prMiniAllExpanded ? 'block' : 'none';
  if (chevron) chevron.style.transform = _prMiniAllExpanded ? 'rotate(90deg)' : 'rotate(0deg)';
  const btn = document.getElementById('PR_MiniNav_ExpandBtn');
  if (btn) btn.title = _prMiniAllExpanded ? 'Collapse all' : 'Expand all';
}
