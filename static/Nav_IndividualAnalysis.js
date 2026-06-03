// ── Individual Analysis Mini-Nav ──────────────────────────────────────────────

(function () {
  function _inject() {
    const nav = document.getElementById('IA_MiniNav');
    if (!nav || document.getElementById('IA_ScrollerDown')) return;
    nav.insertAdjacentHTML('afterbegin', `
      <div id="IA_ScrollerUp" onclick="IA_ScrollUp()" title="Scroll up">
        <svg viewBox="0 0 16 8" width="14" height="7" fill="none">
          <polyline points="1 7 8 1 15 7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <div class="MN_ScrollBar"></div>
      </div>`);
    nav.insertAdjacentHTML('beforeend', `
      <div id="IA_ScrollerDown" onclick="IA_ScrollDown()" title="Scroll down">
        <div class="MN_ScrollBar"></div>
        <svg viewBox="0 0 16 8" width="14" height="7" fill="none">
          <polyline points="1 1 8 7 15 1" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>`);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', _inject);
  else _inject();
})();

function IA_ScrollDown() { document.getElementById('IA_MiniNav')?.scrollBy({ top:  150, behavior: 'smooth' }); }
function IA_ScrollUp()   { document.getElementById('IA_MiniNav')?.scrollBy({ top: -150, behavior: 'smooth' }); }

function IA_MiniNav_RenderParams() { SP_RenderParamsTo('IA_MiniNav_ParamsDisplay', 'ia'); }

let _iaMiniParamsOpen = true;
function IA_MiniNav_ToggleParams() {
  _iaMiniParamsOpen = !_iaMiniParamsOpen;
  const body    = document.getElementById('IA_MiniNav_ParamsBody');
  const chevron = document.getElementById('IA_MiniNav_ParamsChevron');
  if (body)    body.style.display      = _iaMiniParamsOpen ? 'block' : 'none';
  if (chevron) chevron.style.transform = _iaMiniParamsOpen ? 'rotate(90deg)' : 'rotate(0deg)';
}

let _iaMiniAllExpanded = true;
function IA_MiniNav_ToggleAll() {
  _iaMiniAllExpanded = !_iaMiniAllExpanded;
  _iaMiniParamsOpen = _iaMiniAllExpanded;
  const body    = document.getElementById('IA_MiniNav_ParamsBody');
  const chevron = document.getElementById('IA_MiniNav_ParamsChevron');
  if (body)    body.style.display      = _iaMiniAllExpanded ? 'block' : 'none';
  if (chevron) chevron.style.transform = _iaMiniAllExpanded ? 'rotate(90deg)' : 'rotate(0deg)';
  const btn = document.getElementById('IA_MiniNav_ExpandBtn');
  if (btn) btn.title = _iaMiniAllExpanded ? 'Collapse all' : 'Expand all';
}
