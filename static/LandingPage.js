// ── Landing Page — Brand Colours, Tutorial Button & Tour ─────────────────────

const _LP_LOG_STYLES = {
  info:    'background:#FEF3C7;color:#92400E;padding:2px 6px;border-radius:3px;font-weight:600;',
  success: 'background:#DCFCE7;color:#15803D;padding:2px 6px;border-radius:3px;font-weight:600;',
  warn:    'background:#FEF9C3;color:#A16207;padding:2px 6px;border-radius:3px;font-weight:600;',
  error:   'background:#FEE2E2;color:#B91C1C;padding:2px 6px;border-radius:3px;font-weight:600;',
  step:    'background:#F0A500;color:#fff;padding:2px 8px;border-radius:3px;font-weight:700;',
};
function LP_log(msg, type = 'info') {
  const style = _LP_LOG_STYLES[type] || _LP_LOG_STYLES.info;
  const label = type === 'step' ? '▶ LP' : 'LP';
  console.log(`%c${label}%c ${msg}`, style, 'color:inherit;');
}
function LP_logGroup(title) {
  console.groupCollapsed(`%c▶ LP%c ${title}`, _LP_LOG_STYLES.step, 'color:inherit;font-weight:600;');
}
function LP_logGroupEnd() { console.groupEnd(); }

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

