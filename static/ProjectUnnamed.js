// ── Project Unnamed ──────────────────────────────────────────────────────────

function PU_Open() {
  document.documentElement.style.setProperty('--toast-brand', '#0891B2');
  App_HideAllViews();
  document.querySelector('.shell').classList.add('pu-active');
  document.getElementById('PUView').style.removeProperty('display');
  document.getElementById('PU_MiniNav').style.display = 'flex';
  Sidebar_SetActive('nav-project-unnamed');
  NAV_PU_RenderParams();
  PU_PopulateRunBy();
}

async function PU_PopulateRunBy() {
  const conn = window.LD_getConn ? window.LD_getConn() : null;
  const cs   = document.getElementById('PU_RunByCS');
  if (!cs) return;
  const opts = cs.querySelector('.cs-options');
  if (!conn) { opts.innerHTML = '<div class="cs-option" style="color:var(--dml-label);">— No data loaded —</div>'; return; }
  const src = window.LD_getSource ? window.LD_getSource() : 'cm_data';
  let cols = [];
  try {
    const res = await conn.query(`DESCRIBE ${src}`);
    cols = res.toArray().map(r => r.column_name);
  } catch { opts.innerHTML = '<div class="cs-option" style="color:var(--dml-label);">— Could not load columns —</div>'; return; }
  opts.innerHTML = '<div class="cs-option" data-value="" style="color:var(--dml-label);">— Select column —</div>' +
    cols.map(c => `<div class="cs-option" data-value="${c}" onclick="PU_SelectRunBy(this,'${c}')">${c}</div>`).join('');
}

function PU_SelectRunBy(el, val) {
  const cs = document.getElementById('PU_RunByCS');
  cs.querySelectorAll('.cs-option').forEach(o => o.classList.remove('cs-selected'));
  el.classList.add('cs-selected');
  cs.querySelector('.cs-value').textContent = val;
  cs.querySelector('.cs-value').style.color = '';
  cs.classList.remove('open');
  const show = val ? '' : 'none';
  document.getElementById('PU_RunByOp').style.display  = show;
  document.getElementById('PU_RunByVal').style.display = show;
}

// ── Params display ────────────────────────────────────────────────────────────

function NAV_PU_RenderParams() {
  if (typeof window.SP_RenderParamsTo === 'function') {
    window.SP_RenderParamsTo('NAV_PU_ParamsDisplay');
  }
  PU_RefreshParamButtons();
}

function PU_RefreshParamButtons() {
  let p = typeof window.SP_getParams === 'function' ? window.SP_getParams() : {};
  if (!p.col1 && !p.numeric && !p.object) {
    try {
      const c = JSON.parse(localStorage.getItem('SP_CachedParams') || '{}');
      p = {
        col1:              c.FraudFlag?.col              || '',
        numeric:           c.TransactionAmount?.numeric  || '',
        currency:          c.TransactionAmount?.currency || '',
        object:            c.CardDimension?.col          || '',
        auth_date:         c.DateTime?.date              || '',
        auth_time:         c.DateTime?.time              || '',
        combined_datetime: c.DateTime?.combined          || '',
        ruleSignal:        c.RuleSignal?.col             || '',
        decisionMode:      { col: c.DecisionMode?.col   || '' },
      };
    } catch(e) {}
  }
  // buttons show label only; live params used elsewhere (e.g. form prefill)
  void p;
}

// ── Auto-refresh param buttons whenever SP applies params ─────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const _orig = window.SP_UpdateAppliedDisplay;
  if (typeof _orig === 'function') {
    window.SP_UpdateAppliedDisplay = function(...args) {
      _orig.apply(this, args);
      PU_RefreshParamButtons();
    };
  }
});

// ── Actions ──────────────────────────────────────────────────────────────────

function PU_NewTypologyRule() {
  // TODO: open new typology rule form
}

function PU_ToggleNewRuleForm() {
  const form = document.getElementById('PU_NewRuleForm');
  const visible = form.style.display !== 'none';
  form.style.display = visible ? 'none' : '';
  if (!visible) {
    const p = typeof window.SP_getParams === 'function' ? window.SP_getParams() : {};
    let numeric = p.numeric, object = p.object;
    if (!numeric || !object) {
      try {
        const c = JSON.parse(localStorage.getItem('SP_CachedParams') || '{}');
        if (!numeric) numeric = c.TransactionAmount?.numeric || '';
        if (!object)  object  = c.CardDimension?.col        || '';
      } catch(e) {}
    }
    document.getElementById('PU_CardDimension').value = object;
    document.getElementById('PU_AmountMetric').value  = numeric;
    document.getElementById('PU_RuleName').focus();
  }
}

// ── MiniNav section toggles ───────────────────────────────────────────────────

function NAV_PU_ToggleParams() {
  const body    = document.getElementById('NAV_PU_ParamsBody');
  const chevron = document.getElementById('NAV_PU_ParamsChevron');
  const open    = body.style.display !== 'none';
  body.style.display      = open ? 'none' : 'block';
  chevron.style.transform = open ? 'rotate(0deg)' : 'rotate(90deg)';
}

function NAV_PU_ToggleAll() {
  const body    = document.getElementById('NAV_PU_ParamsBody');
  const chevron = document.getElementById('NAV_PU_ParamsChevron');
  const anyOpen = body?.style.display !== 'none';
  if (!body) return;
  body.style.display      = anyOpen ? 'none' : 'block';
  if (chevron) chevron.style.transform = anyOpen ? 'rotate(0deg)' : 'rotate(90deg)';
  const btn = document.getElementById('NAV_PU_ExpandBtn');
  if (btn) btn.title = anyOpen ? 'Expand all' : 'Collapse all';
}
