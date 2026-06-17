// ── Rule Declines ─────────────────────────────────────────────────────────────

// ── State ─────────────────────────────────────────────────────────────────────
let _RD_ScoreCol = '';
let _RD_Start    = 0;
let _RD_End      = 0;
let _RD_Step     = 10;

// ── Open ──────────────────────────────────────────────────────────────────────
function RD_Open() {
  App_HideAllViews();
  document.querySelector('.shell').classList.add('rd-active');
  document.getElementById('RDView').style.display = '';
  document.getElementById('RD_MiniNav').style.display = 'flex';
  Sidebar_SetActive('nav-rule-declines');
  const shell = document.querySelector('.shell');
  if (!shell.classList.contains('sidebar-hidden')) shell.classList.add('sidebar-hidden');
  RD_MiniNav_RenderParams();
  if (typeof NAV_RD_PopulateColumns === 'function') NAV_RD_PopulateColumns();
  RD_RunDetection();
  RD_RunRulePerformance();
}

// ── Detected vs Undetected Card ───────────────────────────────────────────────
async function RD_RunDetection() {
  const container = document.getElementById('RD_DetectionContainer');
  if (!container) return;

  const sp       = window.SP_getParams?.() || {};
  const ruleCol  = sp.ruleSignal || '';
  const fraudCol = sp.col1       || '';
  const fraudVals = sp.values    || [];

  if (!ruleCol || !fraudCol || !fraudVals.length) {
    container.innerHTML = `<div class="pg-card" style="padding:20px;color:var(--color-text-dim);font-size:0.72rem;">— Set Rule Signal and Fraud Label in Parameters to load —</div>`;
    return;
  }

  const conn = window.LD_getConn?.();
  const src  = window.LD_getSource?.();
  if (!conn || !src) {
    container.innerHTML = `<div class="pg-card" style="padding:20px;color:var(--color-text-dim);font-size:0.72rem;">— Load data first —</div>`;
    return;
  }

  container.innerHTML = `<div class="pg-card" style="padding:20px;color:var(--color-text-dim);font-size:0.72rem;">Running…</div>`;

  try {
    const declinedExpr = `("${ruleCol}" IS NOT NULL AND CAST("${ruleCol}" AS VARCHAR) != '')`;
    const fVals        = fraudVals.map(v => `'${v.replace(/'/g, "''")}'`).join(',');
    const fraudExpr    = `("${fraudCol}" IN (${fVals}))`;

    const sql = `
      SELECT
        COUNT(*)                                                        AS total,
        SUM(CASE WHEN ${fraudExpr}                         THEN 1 ELSE 0 END) AS total_fraud,
        SUM(CASE WHEN ${declinedExpr}                      THEN 1 ELSE 0 END) AS total_declined,
        SUM(CASE WHEN ${fraudExpr} AND ${declinedExpr}     THEN 1 ELSE 0 END) AS detected,
        SUM(CASE WHEN ${fraudExpr} AND NOT ${declinedExpr} THEN 1 ELSE 0 END) AS undetected
      FROM "${src}"
    `;
    const row = (await conn.query(sql)).toArray()[0];

    const total         = Number(row.total);
    const totalFraud    = Number(row.total_fraud);
    const totalDeclined = Number(row.total_declined);
    const detected      = Number(row.detected);
    const undetected    = Number(row.undetected);

    const pct = (n, d) => d ? ((n / d) * 100).toFixed(1) + '%' : '—';
    const fmt = n => n.toLocaleString();

    container.innerHTML = `
      <div class="pg-card">
        <div class="pg-card-header">
          <span class="pg-card-title">Detected vs Undetected Fraud</span>
          <span class="pg-card-label">${ruleCol}</span>
        </div>
        <div class="pg-card-divider"></div>
        <div class="pg-card-body" style="display:grid;grid-template-columns:1fr 1fr;gap:0;padding:0;">

          <div style="padding:16px 20px;border-right:0.5px solid var(--color-card-border);">
            <div style="display:flex;align-items:center;gap:6px;margin-bottom:10px;">
              <span style="font-size:0.65rem;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#22c55e;">✓ Detected</span>
            </div>
            <div style="font-size:0.6rem;color:var(--color-text-dim);margin-bottom:12px;">Fraud + Rule Declined</div>
            <div style="font-size:1.6rem;font-weight:700;color:var(--color-header-title);line-height:1;">${fmt(detected)}</div>
            <div style="margin-top:10px;display:flex;flex-direction:column;gap:4px;">
              <div style="font-size:0.65rem;color:var(--color-text-dim);">${pct(detected, totalFraud)} <span style="color:var(--color-text);">of total fraud</span></div>
              <div style="font-size:0.65rem;color:var(--color-text-dim);">${pct(detected, totalDeclined)} <span style="color:var(--color-text);">of all declines</span></div>
            </div>
          </div>

          <div style="padding:16px 20px;">
            <div style="display:flex;align-items:center;gap:6px;margin-bottom:10px;">
              <span style="font-size:0.65rem;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#ef4444;">✗ Undetected</span>
            </div>
            <div style="font-size:0.6rem;color:var(--color-text-dim);margin-bottom:12px;">Fraud not Declined</div>
            <div style="font-size:1.6rem;font-weight:700;color:var(--color-header-title);line-height:1;">${fmt(undetected)}</div>
            <div style="margin-top:10px;display:flex;flex-direction:column;gap:4px;">
              <div style="font-size:0.65rem;color:var(--color-text-dim);">${pct(undetected, totalFraud)} <span style="color:var(--color-text);">of total fraud</span></div>
            </div>
          </div>

        </div>
        <div class="pg-card-divider"></div>
        <div class="pg-card-body" style="display:grid;grid-template-columns:repeat(3,1fr);gap:0;padding:0;">
          <div style="padding:10px 20px;border-right:0.5px solid var(--color-card-border);">
            <div style="font-size:0.58rem;color:var(--color-text-dim);margin-bottom:4px;">Total Transactions</div>
            <div style="font-size:0.88rem;font-weight:600;">${fmt(total)}</div>
          </div>
          <div style="padding:10px 20px;border-right:0.5px solid var(--color-card-border);">
            <div style="font-size:0.58rem;color:var(--color-text-dim);margin-bottom:4px;">Total Fraud</div>
            <div style="font-size:0.88rem;font-weight:600;">${fmt(totalFraud)} <span style="font-size:0.62rem;color:var(--color-text-dim);">(${pct(totalFraud, total)})</span></div>
          </div>
          <div style="padding:10px 20px;">
            <div style="font-size:0.58rem;color:var(--color-text-dim);margin-bottom:4px;">Total Rule Declined</div>
            <div style="font-size:0.88rem;font-weight:600;">${fmt(totalDeclined)} <span style="font-size:0.62rem;color:var(--color-text-dim);">(${pct(totalDeclined, total)})</span></div>
          </div>
        </div>
      </div>`;
  } catch (e) {
    container.innerHTML = `<div class="pg-card" style="padding:20px;color:var(--color-text-dim);font-size:0.72rem;">Query error: ${e.message}</div>`;
  }
}

// patch App_HideAllViews to clean up rd-active
document.addEventListener('DOMContentLoaded', () => {
  const _orig = window.App_HideAllViews;
  window.App_HideAllViews = function () {
    if (_orig) _orig();
    document.body.classList.remove('rd-active');
    document.querySelector('.shell')?.classList.remove('rd-active');
  };
});

// ── Custom-select helpers ─────────────────────────────────────────────────────
function RD_toggleCS(id) {
  const el = document.getElementById(id);
  if (!el) return;
  const isOpen = el.classList.contains('open');
  document.querySelectorAll('#RDView .custom-select.open, #RD_MiniNav .custom-select.open').forEach(s => s.classList.remove('open'));
  if (!isOpen) {
    el.classList.add('open');
    setTimeout(() => {
      const opts = el.querySelector('.cs-options');
      if (!opts) return;
      const rect = el.getBoundingClientRect();
      const dropH = Math.min(200, opts.scrollHeight + 8);
      opts.style.left  = rect.left + 'px';
      opts.style.width = rect.width + 'px';
      opts.style.top   = (window.innerHeight - rect.bottom < dropH && rect.top > dropH)
        ? (rect.top - dropH - 2) + 'px'
        : (rect.bottom + 2) + 'px';
    }, 0);
  }
}

function RD_selectCS(el, value, callback) {
  const cs = el.closest('.custom-select');
  if (!cs) return;
  const valEl = cs.querySelector('.cs-value');
  if (valEl) { valEl.textContent = value || '— select —'; valEl.style.color = value ? '' : 'var(--dml-label)'; }
  cs.querySelectorAll('.cs-option').forEach(o => o.classList.remove('cs-selected'));
  el.classList.add('cs-selected');
  cs.classList.remove('open');
  cs.dataset.value = value;
  if (callback && window[callback]) window[callback]();
}

function RD_getCSValue(id) {
  return document.getElementById(id)?.dataset.value || '';
}

// ── Rule Performance Card ─────────────────────────────────────────────────────
let _RD_RuleRows  = [];
let _RD_SortCol   = 'fraud_pct';
let _RD_SortAsc   = false;

async function RD_RunRulePerformance() {
  const container = document.getElementById('RD_RulesContainer');
  if (!container) return;

  const sp        = window.SP_getParams?.() || {};
  const ruleCol   = sp.ruleSignal || '';
  const fraudCol  = sp.col1       || '';
  const fraudVals = sp.values     || [];

  if (!ruleCol || !fraudCol || !fraudVals.length) return;

  const conn = window.LD_getConn?.();
  const src  = window.LD_getSource?.();
  if (!conn || !src) return;

  container.innerHTML = `<div class="pg-card" style="padding:20px;color:var(--color-text-dim);font-size:0.72rem;">Loading rules…</div>`;

  try {
    const fVals     = fraudVals.map(v => `'${v.replace(/'/g, "''")}'`).join(',');
    const fraudExpr = `"${fraudCol}" IN (${fVals})`;

    const sql = `
      SELECT
        CAST("${ruleCol}" AS VARCHAR)                            AS rule,
        COUNT(*)                                                  AS declines,
        SUM(CASE WHEN ${fraudExpr} THEN 1 ELSE 0 END)            AS fraud_caught
      FROM "${src}"
      WHERE "${ruleCol}" IS NOT NULL AND CAST("${ruleCol}" AS VARCHAR) != ''
      GROUP BY 1
      ORDER BY 3 DESC
    `;

    const rows = (await conn.query(sql)).toArray();
    _RD_RuleRows = rows.map(r => ({
      rule:         String(r.rule),
      declines:     Number(r.declines),
      fraud_caught: Number(r.fraud_caught),
      fraud_pct:    Number(r.declines) ? Number(r.fraud_caught) / Number(r.declines) * 100 : 0,
    }));
    _RD_SortCol = 'fraud_pct';
    _RD_SortAsc = false;
    RD_RenderRuleTable(container);
    RD_RunRuleSummary();
  } catch (e) {
    container.innerHTML = `<div class="pg-card" style="padding:20px;color:var(--color-text-dim);font-size:0.72rem;">Query error: ${e.message}</div>`;
  }
}

// ── Rule Summary — buckets ────────────────────────────────────────────────────
const _RD_BUCKETS = [
  { key: 'none',   label: 'No fraud detected',  test: r => r.fraud_pct === 0 },
  { key: 'low',    label: '< 10% fraud',         test: r => r.fraud_pct > 0 && r.fraud_pct < 10 },
  { key: 'mid',    label: '10 – 50% fraud',      test: r => r.fraud_pct >= 10 && r.fraud_pct <= 50 },
  { key: 'high',   label: '> 50% fraud',         test: r => r.fraud_pct > 50 },
];

function RD_RunRuleSummary() {
  const container = document.getElementById('RD_SummaryContainer');
  if (!container || !_RD_RuleRows.length) return;

  const buckets = _RD_BUCKETS.map(b => ({
    ...b,
    rules: _RD_RuleRows.filter(b.test),
  }));

  const rows = buckets.map(b => `
    <div class="rd-summary-row" onclick="RD_ToggleSummaryBucket('${b.key}')">
      <div style="display:flex;align-items:center;gap:8px;flex:1;">
        <svg id="rd-sum-chev-${b.key}" viewBox="0 0 16 16" width="10" height="10" fill="none" style="flex-shrink:0;transition:transform 0.18s;transform:rotate(0deg);">
          <polyline points="5 3 11 8 5 13" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <span class="rd-summary-label">${b.label}</span>
      </div>
      <span class="rd-summary-count">${b.rules.length} rule${b.rules.length !== 1 ? 's' : ''}</span>
    </div>
    <div id="rd-sum-body-${b.key}" class="rd-summary-body" style="display:none;">
      ${b.rules.length
        ? b.rules.map(r => `
            <div class="rd-summary-rule-row">
              <span class="rd-summary-rule-name">${r.rule}</span>
              <span class="rd-summary-rule-meta">${r.declines.toLocaleString()} declines · ${r.fraud_pct.toFixed(1)}% fraud</span>
            </div>`).join('')
        : '<div class="rd-summary-rule-row" style="color:var(--color-text-dim);font-style:italic;">— none —</div>'
      }
    </div>`).join('<div class="rd-summary-divider"></div>');

  container.innerHTML = `
    <div class="pg-card">
      <div class="pg-card-header">
        <span class="pg-card-title">Rules by Fraud Detection Rate</span>
        <span class="pg-card-label">${_RD_RuleRows.length} total</span>
      </div>
      <div class="pg-card-divider"></div>
      <div class="pg-card-body" style="padding:0;">
        <div class="rd-summary-table">${rows}</div>
      </div>
    </div>`;
}

function RD_ToggleSummaryBucket(key) {
  const body  = document.getElementById(`rd-sum-body-${key}`);
  const chev  = document.getElementById(`rd-sum-chev-${key}`);
  if (!body) return;
  const open = body.style.display === 'none';
  body.style.display      = open ? 'block' : 'none';
  if (chev) chev.style.transform = open ? 'rotate(90deg)' : 'rotate(0deg)';
}

function RD_SortRules(col) {
  if (_RD_SortCol === col) {
    _RD_SortAsc = !_RD_SortAsc;
  } else {
    _RD_SortCol = col;
    _RD_SortAsc = col === 'rule';
  }
  RD_RenderRuleTable(document.getElementById('RD_RulesContainer'));
}

function RD_RenderRuleTable(container) {
  if (!container || !_RD_RuleRows.length) return;

  const sorted = [..._RD_RuleRows].sort((a, b) => {
    const av = a[_RD_SortCol], bv = b[_RD_SortCol];
    if (typeof av === 'string') return _RD_SortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
    return _RD_SortAsc ? av - bv : bv - av;
  });

  const chevron = col => {
    if (_RD_SortCol !== col) return `<svg viewBox="0 0 16 16" width="9" height="9" fill="none" style="opacity:0.3;flex-shrink:0;"><path d="M8 3v10M4 7l4-4 4 4M4 9l4 4 4-4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    return _RD_SortAsc
      ? `<svg viewBox="0 0 16 16" width="9" height="9" fill="none" style="flex-shrink:0;"><path d="M4 10l4-4 4 4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`
      : `<svg viewBox="0 0 16 16" width="9" height="9" fill="none" style="flex-shrink:0;"><path d="M4 6l4 4 4-4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  };

  const thStyle = `style="cursor:pointer;user-select:none;white-space:nowrap;"`;
  const thInner = (label, col) => `<span style="display:inline-flex;align-items:center;gap:4px;">${label}${chevron(col)}</span>`;

  const pctColor = pct => pct >= 70 ? '#22c55e' : pct >= 40 ? '#f59e0b' : '#ef4444';

  const bodyRows = sorted.map(r => {
    const pct   = r.fraud_pct;
    const color = pctColor(pct);
    const bar   = `
      <div style="display:flex;align-items:center;gap:6px;min-width:80px;">
        <div style="flex:1;height:5px;border-radius:3px;background:var(--color-card-border);overflow:hidden;">
          <div style="width:${Math.min(pct,100).toFixed(1)}%;height:100%;background:${color};border-radius:3px;transition:width 0.3s;"></div>
        </div>
        <span style="font-size:0.65rem;font-weight:600;color:${color};min-width:36px;text-align:right;">${pct.toFixed(1)}%</span>
      </div>`;
    return `<tr>
      <td style="font-weight:500;">${r.rule}</td>
      <td style="text-align:right;">${r.declines.toLocaleString()}</td>
      <td style="text-align:right;">${r.fraud_caught.toLocaleString()}</td>
      <td>${bar}</td>
    </tr>`;
  }).join('');

  container.innerHTML = `
    <div class="pg-card">
      <div class="pg-card-header">
        <span class="pg-card-title">Rule Performance</span>
        <span class="pg-card-label">${_RD_RuleRows.length} rule${_RD_RuleRows.length !== 1 ? 's' : ''}</span>
      </div>
      <div class="pg-card-divider"></div>
      <div class="pg-card-body" style="padding:0;overflow:hidden;">
        <div class="pg-table-wrap rd-rule-table-wrap">
          <table class="pg-table" style="width:100%;">
            <thead>
              <tr>
                <th ${thStyle} onclick="RD_SortRules('rule')">${thInner('Rule', 'rule')}</th>
                <th ${thStyle} onclick="RD_SortRules('declines')" style="text-align:right;">${thInner('Declines', 'declines')}</th>
                <th ${thStyle} onclick="RD_SortRules('fraud_caught')" style="text-align:right;">${thInner('Fraud Caught', 'fraud_caught')}</th>
                <th ${thStyle} onclick="RD_SortRules('fraud_pct')" style="min-width:140px;">${thInner('Fraud %', 'fraud_pct')}</th>
              </tr>
            </thead>
            <tbody>${bodyRows}</tbody>
          </table>
        </div>
      </div>
    </div>`;
}

// ── Score Distribution Run ────────────────────────────────────────────────────
async function RD_Run() {
  const scoreCol = RD_getCSValue('RDScoreColCS');
  if (!scoreCol) { RD_showHint('Select a score column and click Run.'); return; }

  const startVal = parseFloat(document.getElementById('RDStart')?.value ?? 0);
  const endVal   = parseFloat(document.getElementById('RDEnd')?.value   ?? 100);
  const stepVal  = parseFloat(document.getElementById('RDStep')?.value  ?? 10) || 10;

  _RD_ScoreCol = scoreCol;
  _RD_Start    = startVal;
  _RD_End      = endVal;
  _RD_Step     = stepVal;

  const conn = window.LD_getConn?.();
  const src  = window.LD_getSource?.();
  if (!conn || !src) { RD_showHint('Load data first.'); return; }

  RD_setLoading(true);
  try {
    const sp        = window.SP_getParams?.() || {};
    const fraudCol  = sp.col1        || '';
    const fraudVals = sp.values      || [];
    const ruleCol   = sp.ruleSignal  || '';

    const bucketExpr = `FLOOR(("${scoreCol}" - ${startVal}) / ${stepVal}) * ${stepVal} + ${startVal}`;
    const ruleFilter = ruleCol ? `AND "${ruleCol}" IS NOT NULL AND CAST("${ruleCol}" AS VARCHAR) != ''` : '';

    let fraudExprInner = 'FALSE';
    if (fraudCol && fraudVals.length) {
      const fVals = fraudVals.map(v => `'${v.replace(/'/g, "''")}'`).join(',');
      fraudExprInner = `"${fraudCol}" IN (${fVals})`;
    }

    const sql = `
      SELECT
        ${bucketExpr} AS bucket,
        COUNT(*) AS total,
        SUM(CASE WHEN ${fraudExprInner} THEN 1 ELSE 0 END) AS fraud
      FROM "${src}"
      WHERE "${scoreCol}" >= ${startVal}
        AND "${scoreCol}" <= ${endVal}
        ${ruleFilter}
      GROUP BY 1
      ORDER BY 1
    `;

    const rows = (await conn.query(sql)).toArray();
    RD_renderScoreTable(rows, scoreCol);
  } catch (e) {
    RD_showHint('Query error: ' + e.message);
  } finally {
    RD_setLoading(false);
  }
}

function RD_renderScoreTable(rows, scoreCol) {
  const container = document.getElementById('RD_ResultContainer');
  if (!container) return;

  if (!rows.length) {
    container.innerHTML = '<div class="pg-card" style="padding:20px;color:var(--color-text-dim);font-size:0.72rem;">No data in range.</div>';
    return;
  }

  const totalSum = rows.reduce((s, r) => s + Number(r.total), 0);
  const fraudSum = rows.reduce((s, r) => s + Number(r.fraud), 0);

  const headerRow = `<tr>
    <th>${scoreCol} bucket</th>
    <th>Total</th>
    <th>% Total</th>
    <th>Fraud</th>
    <th>Fraud %</th>
  </tr>`;

  const bodyRows = rows.map(r => {
    const total = Number(r.total);
    const fraud = Number(r.fraud);
    const pctTotal = totalSum ? ((total / totalSum) * 100).toFixed(1) : '—';
    const pctFraud = total    ? ((fraud / total)    * 100).toFixed(1) : '—';
    return `<tr>
      <td>${Number(r.bucket).toFixed(0)}</td>
      <td>${total.toLocaleString()}</td>
      <td>${pctTotal}%</td>
      <td>${fraud.toLocaleString()}</td>
      <td>${pctFraud}%</td>
    </tr>`;
  }).join('');

  const footRow = `<tr style="font-weight:600;border-top:1px solid var(--color-card-border);">
    <td>Total</td>
    <td>${totalSum.toLocaleString()}</td>
    <td>100%</td>
    <td>${fraudSum.toLocaleString()}</td>
    <td>${totalSum ? ((fraudSum / totalSum) * 100).toFixed(1) : '—'}%</td>
  </tr>`;

  container.innerHTML = `
    <div class="pg-card">
      <div class="pg-card-header">
        <span class="pg-card-title">Score Distribution — Rule Declines</span>
        <span class="pg-card-label">${scoreCol} · step ${_RD_Step}</span>
      </div>
      <div class="pg-card-divider"></div>
      <div class="pg-card-body" style="overflow-x:auto;">
        <table class="pg-table">
          <thead>${headerRow}</thead>
          <tbody>${bodyRows}</tbody>
          <tfoot>${footRow}</tfoot>
        </table>
      </div>
    </div>`;
}

// ── Amount Analysis Run ───────────────────────────────────────────────────────
async function RD_RunAmountAnalysis() {
  const amtCol   = RD_getCSValue('RDAmountColCS');
  if (!amtCol) return;

  const opStart  = document.getElementById('RDAmountOpStart')?.value  ?? '>=';
  const valStart = document.getElementById('RDAmountValStart')?.value;
  const opEnd    = document.getElementById('RDAmountOpEnd')?.value    ?? '<=';
  const valEnd   = document.getElementById('RDAmountValEnd')?.value;
  const step     = parseFloat(document.getElementById('RDAmountStep')?.value ?? 100) || 100;

  const conn = window.LD_getConn?.();
  const src  = window.LD_getSource?.();
  if (!conn || !src) return;

  const conditions = [];
  if (valStart !== '' && valStart != null) conditions.push(`"${amtCol}" ${opStart} ${valStart}`);
  if (valEnd   !== '' && valEnd   != null) conditions.push(`"${amtCol}" ${opEnd} ${valEnd}`);

  const sp      = window.SP_getParams?.() || {};
  const ruleCol = sp.ruleSignal || '';
  if (ruleCol) conditions.push(`"${ruleCol}" IS NOT NULL AND CAST("${ruleCol}" AS VARCHAR) != ''`);

  const whereClause = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

  try {
    const sql = `
      SELECT
        FLOOR("${amtCol}" / ${step}) * ${step} AS bucket,
        COUNT(*) AS total
      FROM "${src}"
      ${whereClause}
      GROUP BY 1
      ORDER BY 1
    `;
    const rows = (await conn.query(sql)).toArray();
    RD_renderAmountTable(rows, amtCol, step);
  } catch (e) {
    console.warn('[RD] amount analysis error:', e);
  }
}

function RD_renderAmountTable(rows, amtCol, step) {
  const container = document.getElementById('RD_AmtResultContainer');
  if (!container) return;
  if (!rows.length) {
    container.innerHTML = '<div style="padding:8px;color:var(--color-text-dim);font-size:0.72rem;">No data.</div>';
    return;
  }
  const totalSum = rows.reduce((s, r) => s + Number(r.total), 0);
  const bodyRows = rows.map(r => {
    const total = Number(r.total);
    const pct   = totalSum ? ((total / totalSum) * 100).toFixed(1) : '—';
    return `<tr><td>${Number(r.bucket).toFixed(0)}</td><td>${total.toLocaleString()}</td><td>${pct}%</td></tr>`;
  }).join('');

  container.innerHTML = `
    <div class="pg-card" style="margin-top:14px;">
      <div class="pg-card-header">
        <span class="pg-card-title">Amount Distribution — Rule Declines</span>
        <span class="pg-card-label">${amtCol} · step ${step}</span>
      </div>
      <div class="pg-card-divider"></div>
      <div class="pg-card-body" style="overflow-x:auto;">
        <table class="pg-table">
          <thead><tr><th>${amtCol} bucket</th><th>Count</th><th>%</th></tr></thead>
          <tbody>${bodyRows}</tbody>
        </table>
      </div>
    </div>`;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function RD_showHint(msg) {
  const c = document.getElementById('RD_ResultContainer');
  if (c) c.innerHTML = `<div class="pg-card" style="padding:20px;color:var(--color-text-dim);font-size:0.72rem;">${msg}</div>`;
}

function RD_setLoading(on) {
  const btn = document.querySelector('#RD_MiniNav .MN_run_btn');
  if (btn) btn.textContent = on ? 'Running…' : 'Run';
}

// ── Nav Info Popup ────────────────────────────────────────────────────────────
function RD_infoOpen(btn, title, text) {
  const popup = document.getElementById('RD_InfoPopup');
  if (!popup) return;
  document.getElementById('RD_InfoTitle').textContent = title;
  document.getElementById('RD_InfoBody').innerHTML    = text;
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
  setTimeout(() => document.addEventListener('click', _RD_infoOutside), 0);
  window.addEventListener('scroll', RD_infoClose, { once: true, capture: true });
}
function _RD_infoOutside(e) {
  const popup = document.getElementById('RD_InfoPopup');
  if (popup && !popup.contains(e.target) && !e.target.classList.contains('MN_info_btn'))
    RD_infoClose();
}
function RD_infoClose() {
  const popup = document.getElementById('RD_InfoPopup');
  if (popup) popup.style.display = 'none';
  document.removeEventListener('click', _RD_infoOutside);
}
