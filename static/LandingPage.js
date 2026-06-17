// ── Landing Page — Brand Colours, Tutorial Button & Tour ─────────────────────
console.log('%c[LP] script loaded', 'color:#0D9488;font-weight:600;');

function LP_log(msg)        { console.log('[LP]', msg); }
function LP_logGroup(title) { console.groupCollapsed('[LP]', title); }
function LP_logGroupEnd()   { console.groupEnd(); }

const _LP_BRAND_COLORS = {
  'nav-get-started':         { color: '#E8714A', dim: 'rgba(232,113,74,0.12)', border: 'rgba(232,113,74,0.3)' },
  'nav-load-data':           { color: '#7B2D8B', dim: 'rgba(123,45,139,0.12)', border: 'rgba(123,45,139,0.3)' },
  'nav-column-mgmt':         { color: '#A82060', dim: 'rgba(168,32,96,0.12)',  border: 'rgba(168,32,96,0.3)'  },
  'nav-parameters':          { color: '#0D9488', dim: 'rgba(13,148,136,0.12)', border: 'rgba(13,148,136,0.3)' },
  'nav-overview':            { color: '#9B2050', dim: 'rgba(155,32,80,0.12)',  border: 'rgba(155,32,80,0.3)'  },
  'nav-score-analysis':      { color: '#7B68C8', dim: 'rgba(123,104,200,0.12)',border: 'rgba(123,104,200,0.3)'},
  'nav-score-comparison':    { color: '#0ea5e9', dim: 'rgba(14,165,233,0.12)', border: 'rgba(14,165,233,0.3)' },
  'nav-route-analysis':      { color: '#3DAB8E', dim: 'rgba(61,171,142,0.12)', border: 'rgba(61,171,142,0.3)' },
  'nav-individual-analysis': { color: '#1A9474', dim: 'rgba(26,148,116,0.12)', border: 'rgba(26,148,116,0.3)' },
  'nav-policy-rules':        { color: '#6254C8', dim: 'rgba(98,84,200,0.12)',  border: 'rgba(98,84,200,0.3)'  },
  'nav-spike-report':        { color: '#E8714A', dim: 'rgba(232,113,74,0.12)', border: 'rgba(232,113,74,0.3)' },
  'nav-spike-merchant':      { color: '#7B2D8B', dim: 'rgba(123,45,139,0.12)', border: 'rgba(123,45,139,0.3)' },
  'nav-playground':          { color: '#F0A500', dim: 'rgba(240,165,0,0.12)',  border: 'rgba(240,165,0,0.3)'  },
};
const _LP_BRAND_DEFAULT = { color: '#F0A500', dim: 'rgba(240,165,0,0.12)', border: 'rgba(240,165,0,0.3)' };

function LP_setBrandColor(navId) {
  const b = _LP_BRAND_COLORS[navId] || _LP_BRAND_DEFAULT;
  const icon = document.querySelector('.lp-brand-icon');
  if (icon) icon.style.background = b.color;
  document.body.classList.toggle('lp-active', !navId);
  LP_log(`Brand icon → ${navId || 'landing'} (${b.color})`, navId ? 'info' : 'step');
}

LP_setBrandColor(null);

window.addEventListener('load', function() {
  const _LP_MODULES = [
    { name: 'Sidebar',            fn: 'Sidebar_SetActive' },
    { name: 'LoadData',           fn: 'LD_getConn' },
    { name: 'GetStarted',         fn: 'GS_Open' },
    { name: 'ColumnManagement',   fn: 'CM_Open' },
    { name: 'SetParameters',      fn: 'SP_Open' },
    { name: 'Overview',           fn: 'OV_Open' },
    { name: 'ScoreAnalysis',      fn: 'SA_Open' },
    { name: 'ScoreComparison',    fn: 'SC_Open' },
    { name: 'IndividualAnalysis', fn: 'IA_Open' },
    { name: 'RouteAnalysis',      fn: 'RA_Open' },
    { name: 'PolicyRules',        fn: 'PR_Open' },
    { name: 'SpikeReport',        fn: 'SR_Open' },
    { name: 'Playground',         fn: 'PG_Open' },
    { name: 'Chart.js',           fn: 'Chart' },
    { name: 'MiniNav',            fn: 'MN_Open' },
  ];
  const results = _LP_MODULES.map(m => ({ ...m, ok: typeof window[m.fn] !== 'undefined' }));
  const pass = results.filter(r => r.ok).length;
  const fail = results.filter(r => !r.ok).length;
  console.group(
    `%c Fraud Strategy %c v2 June 2026 %c ${pass}/${results.length} ready${fail ? ' · ' + fail + ' missing' : ''}`,
    'background:#0D9488;color:#fff;padding:2px 8px;border-radius:3px 0 0 3px;font-weight:700;font-size:11px;',
    'background:#E8714A;color:#fff;padding:2px 8px;font-weight:600;font-size:11px;',
    fail ? 'color:#ef4444;font-weight:600;font-size:11px;' : 'color:#22c55e;font-weight:600;font-size:11px;'
  );
  results.forEach(r => console.log(
    '%c ' + (r.ok ? '✓' : '✗') + ' %c ' + r.name,
    r.ok ? 'color:#22c55e;font-weight:700;' : 'color:#ef4444;font-weight:700;',
    'color:inherit;'
  ));
  console.groupEnd();
});

document.addEventListener('DOMContentLoaded', () => {
  LP_log('DOMContentLoaded — patching Sidebar_SetActive', 'info');
  const _orig_SetActive = window.Sidebar_SetActive;
  window.Sidebar_SetActive = function(id) {
    if (_orig_SetActive) _orig_SetActive(id);
    LP_setBrandColor(id);
    if (id) {
      LP_log(`Nav activated: ${id} — LP tutorial disabled`, 'info');
      _LP_toastsEnabled = false;
      const btn = document.getElementById('LP_HelpBtn');
      if (btn) btn.classList.remove('tutorial-active');
      LP_tourDismiss();
    }
  };
  LP_setBrandColor(null);
});

// ── Tutorial Toggle ───────────────────────────────────────────────────────────
let _LP_toastsEnabled = false;

function LP_HelpPrompt() {
  if (document.querySelector('.sidebar-item.active')) {
    LP_log('Tutorial blocked — a nav page is active', 'warn');
    return;
  }
  _LP_toastsEnabled = !_LP_toastsEnabled;
  const btn = document.getElementById('LP_HelpBtn');
  if (btn) {
    btn.classList.toggle('tutorial-active', _LP_toastsEnabled);
    btn.style.removeProperty('background');
    btn.style.removeProperty('border-color');
    btn.style.removeProperty('color');
    btn.style.removeProperty('box-shadow');
    btn.style.removeProperty('opacity');
  }
  if (_LP_toastsEnabled) {
    LP_log('Tutorial ON', 'step');
    LP_tourShow(0);
  } else {
    LP_log('Tutorial OFF', 'info');
    LP_tourDismiss();
  }
}
// Shim for MainContent.js (org script — cannot modify)
window.APP_HelpPrompt = LP_HelpPrompt;

// ── Landing Tour ──────────────────────────────────────────────────────────────
const _LP_STEPS = [
  { title: 'Get Started',   body: 'Head to <strong>Get Started</strong> in the sidebar to upload your data and set up your column configuration.' },
  { title: 'Saved Configs', body: 'Select a saved config from the <strong>Saved Configs</strong> dropdown in the sidebar to load your previous setup instantly.' },
];
let _LP_step = 0;

function LP_tourShow(step) {
  _LP_step = step;
  const s = _LP_STEPS[step];
  if (!s) { LP_tourDismiss(); return; }
  LP_log(`Tour step ${step + 1}/${_LP_STEPS.length}: ${s.title}`, 'info');
  const total = _LP_STEPS.length;
  let wrap = document.getElementById('LP_TourWrap');
  if (!wrap) {
    wrap = document.createElement('div');
    wrap.id = 'LP_TourWrap';
    wrap.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:99998;';
    document.body.appendChild(wrap);
  }
  wrap.innerHTML = `
    <div class="lp-toast" id="LP_TourInner">
      <div class="lp-tab-strip" onclick="LP_tourTabExpand()" title="Expand">
        <span class="lp-tab-arrow">›</span>
        <span class="lp-tab-label">Step ${step+1} of ${total}</span>
      </div>
      <div class="lp-toast-inner">
        <div class="lp-toast-header">
          <div>
            <div class="lp-toast-step">Step ${step+1} of ${total}</div>
            <div class="lp-toast-title">${s.title}</div>
          </div>
          <button class="lp-toast-btn-collapse" onclick="LP_tourTabCollapse()" title="Collapse to tab">
            <svg viewBox="0 0 16 16" width="10" height="10" fill="none"><path d="M10 3H13V13H10M6 8H2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
        </div>
        <div class="lp-toast-body">${s.body}</div>
        <div class="lp-toast-actions">
          <button class="lp-toast-btn-back" onclick="LP_tourShow(_LP_step - 1)" style="${step === 0 ? 'visibility:hidden;' : ''}">← Back</button>
          <button class="lp-toast-btn-next" onclick="LP_tourNext()">${step+1 < total ? 'Next →' : 'Finish ✓'}</button>
        </div>
      </div>
    </div>`;
}

function LP_tourTabCollapse() {
  LP_log('Tour collapsed to tab', 'info');
  const el = document.getElementById('LP_TourInner');
  if (!el) return;
  const rect = el.getBoundingClientRect();
  el.style.top    = '';
  el.style.bottom = (window.innerHeight - rect.bottom) + 'px';
  el.classList.add('lp-tabbed');
  const strip = el.querySelector('.lp-tab-strip');
  if (strip) strip.style.height = rect.height + 'px';
}

function LP_tourTabExpand() {
  LP_log('Tour expanded from tab', 'info');
  const el = document.getElementById('LP_TourInner');
  if (!el) return;
  el.style.top = el.style.bottom = '';
  el.classList.remove('lp-tabbed');
}

function LP_tourNext() { LP_tourShow(_LP_step + 1); }

function LP_tourDismiss() {
  const wrap = document.getElementById('LP_TourWrap');
  if (wrap) { wrap.remove(); LP_log('Tour dismissed', 'info'); }
}

