// ── Policy Rules ─────────────────────────────────────────────────────────────

// ── Logging ───────────────────────────────────────────────────────────────────
const _PR_LOG_STYLES = {
  info:    'background:#EFF6FF;color:#1D4ED8;padding:2px 6px;border-radius:3px;font-weight:600;',
  success: 'background:#DCFCE7;color:#15803D;padding:2px 6px;border-radius:3px;font-weight:600;',
  warn:    'background:#FEF9C3;color:#A16207;padding:2px 6px;border-radius:3px;font-weight:600;',
  error:   'background:#FEE2E2;color:#B91C1C;padding:2px 6px;border-radius:3px;font-weight:600;',
  step:    'background:#6366F1;color:#fff;padding:2px 8px;border-radius:3px;font-weight:700;',
};
function PR_log(msg, type = 'info') {
  const s = _PR_LOG_STYLES[type] || _PR_LOG_STYLES.info;
  console.log('%c PR ', s, msg);
}
function PR_logGroup(title) { console.group('%c PR ', _PR_LOG_STYLES.step, title); }
function PR_logGroupEnd()   { console.groupEnd(); }

// ── State ─────────────────────────────────────────────────────────────────────
let PR_DistResults      = [];
let _prDistViewRows     = [];
let _prSortCol          = null;
let _prSortDir          = 1;
window._prSumColOptions = [];   // result metric cols — shared with Nav_PolicyRules PR_AddSumCondition

const _prThS = 'padding:5px 10px;font-size:0.6rem;font-weight:700;letter-spacing:0.05em;text-transform:uppercase;color:var(--color-text-dim);border-bottom:1.5px solid var(--brand-pr-light);text-align:left;white-space:nowrap;vertical-align:top;cursor:pointer;';
const _prTdS = 'padding:4px 10px;font-size:0.7rem;color:var(--color-header-title);border-bottom:0.5px solid var(--color-card-border);white-space:nowrap;';

function _prIsNum(col) {
  if (!PR_DistResults.length) return false;
  const v = PR_DistResults[0][col];
  return typeof v === 'number' || (!isNaN(parseFloat(String(v))) && String(v).trim() !== '');
}

// ── Run Analysis ──────────────────────────────────────────────────────────────
window._PR_RunAnalysis = async function() {
  const out  = document.getElementById('PR_ResultContainer');
  const sp   = window.SP_getParams?.() || {};
  const conn = window.LD_getConn?.();
  const src  = window.LD_getSource?.();
  const cols = typeof PR_MiniNav_GetSelectedCols === 'function' ? PR_MiniNav_GetSelectedCols() : [];

  if (!out) return;
  if (!conn || !src)  { out.innerHTML = _prMsg('Load data first'); return; }
  if (!sp.col1)       { out.innerHTML = _prMsg('Apply parameters first'); return; }
  if (!cols.length)   { out.innerHTML = _prMsg('Select at least one Analysis Column'); return; }

  PR_logGroup('Run Analysis — ' + cols.length + ' col(s)  type=' + _prType + '  runBy=' + _prRunBy);
  out.innerHTML = _prMsg('Running…');

  try {
    const cardDim = sp.object;
    const dateCol = sp.auth_date;
    const dtCol   = sp.combined_datetime;
    const numeric = sp.numeric;

    // Fraud filter
    const fraudVals = (sp.values || []).map(v => `'${String(v).replace(/'/g,"''")}'`).join(',');
    const fraudExpr = fraudVals ? `"${sp.col1}" IN (${fraudVals})` : 'FALSE';

    // Decision mode — successful / unsuccessful (SP sets decision_col, successful_vals, unsuccessful_vals)
    const decisionCol   = sp.decision_col || null;
    const successVals   = decisionCol ? (sp.successful_vals   || []).map(v => `'${String(v).replace(/'/g,"''")}'`).join(',') : '';
    const unsuccessVals = decisionCol ? (sp.unsuccessful_vals || []).map(v => `'${String(v).replace(/'/g,"''")}'`).join(',') : '';
    const successExpr   = successVals   ? `"${decisionCol}" IN (${successVals})`   : 'FALSE';
    const unsuccessExpr = unsuccessVals ? `"${decisionCol}" IN (${unsuccessVals})` : 'FALSE';

    // Period expression
    let periodExpr;
    if (_prRunBy === 'overall') {
      periodExpr = "'overall'";
    } else if (_prRunBy === 'hour' && dtCol) {
      periodExpr = `STRFTIME(DATE_TRUNC('hour', CAST("${dtCol}" AS TIMESTAMP)), '%Y-%m-%d %H:00')`;
    } else if (dateCol) {
      periodExpr = `CAST("${dateCol}" AS VARCHAR)`;
    } else {
      periodExpr = "'overall'";
    }

    // Metric expression — transaction count / PAN count / amount sum
    const metricExpr = _prType === 'amount' && numeric
      ? `SUM("${numeric}")`
      : _prType === 'pan' && cardDim
        ? `COUNT(DISTINCT "${cardDim}")`
        : `COUNT(*)`;

    const results = [];

    for (const col of cols) {
      const colSafe = col.replace(/"/g, '""');
      PR_log('Column: ' + col, 'info');

      // Build one cumcount distribution block per WHERE clause
      const runBlock = async (whereClause) => {
        const filterSql = whereClause ? `WHERE ${whereClause}` : '';
        const res = await conn.query(`
          WITH base AS (
            SELECT *,
              ${periodExpr} AS _period,
              ROW_NUMBER() OVER (PARTITION BY "${cardDim}", "${colSafe}", ${periodExpr} ORDER BY (SELECT NULL)) AS _cumcount
            FROM "${src}" ${filterSql}
          ),
          agg AS (
            SELECT "${colSafe}" AS _grp, _cumcount AS _level, ${metricExpr} AS _count
            FROM base GROUP BY "${colSafe}", _cumcount
          ),
          total_sum AS (SELECT SUM(_count) AS s FROM agg)
          SELECT _grp, _level, _count,
                 ROUND(_count * 100.0 / NULLIF((SELECT s FROM total_sum), 0), 2) AS _pct,
                 ROUND(SUM(_count * 100.0 / NULLIF((SELECT s FROM total_sum), 0)) OVER (PARTITION BY _grp ORDER BY _level), 2) AS _accum
          FROM agg ORDER BY _grp, _level`);
        return res.toArray();
      };

      // Merge a block's rows into the shared results array
      const mergeBlock = (rows, countKey, pctKey, accumKey) => {
        for (const r of rows) {
          const key = String(r._grp ?? '');
          const lvl = Number(r._level);
          const existing = results.find(x => x[col] === key && x['Level'] === lvl);
          if (existing) {
            existing[countKey] = Number(r._count);
            existing[pctKey]   = Number(r._pct);
            existing[accumKey] = Number(r._accum);
          } else {
            results.push({ [col]: key, 'Level': lvl, [countKey]: Number(r._count), [pctKey]: Number(r._pct), [accumKey]: Number(r._accum) });
          }
        }
      };

      if (_prShow.has('total')) {
        const rows = await runBlock(null);
        for (const r of rows) {
          results.push({
            [col]:          String(r._grp ?? ''),
            'Level':        Number(r._level),
            'Count_Total':  Number(r._count),
            'Total_%':      Number(r._pct),
            'Total_Accum%': Number(r._accum),
          });
        }
      }

      if (_prShow.has('fraud')) {
        mergeBlock(await runBlock(fraudExpr), 'Count_Fraud', 'Fraud_%', 'Fraud_Accum%');
      }

      if (_prShow.has('successful') && successVals) {
        mergeBlock(await runBlock(successExpr), 'Count_Success', 'Success_%', 'Success_Accum%');
      }

      if (_prShow.has('unsuccessful') && unsuccessVals) {
        mergeBlock(await runBlock(unsuccessExpr), 'Count_Unsuccess', 'Unsuccess_%', 'Unsuccess_Accum%');
      }
    }

    PR_log('Done — ' + results.length + ' rows', 'success');
    PR_logGroupEnd();

    PR_DistResults        = results;
    _prDistViewRows       = results;
    window._prSumColOptions = results.length
      ? Object.keys(results[0]).filter(k => !cols.includes(k) && k !== 'Level')
      : [];

    // Group chips — one chip strip per selected column
    const groupChips = cols.map(c => {
      const vals = [...new Set(results.map(r => r[c]))].filter(Boolean);
      if (!vals.length) return '';
      return `<div style="display:flex;align-items:center;gap:4px;flex-wrap:wrap;">
        <span class="anra-section-label" style="padding:0;flex-shrink:0;">${c}:</span>
        ${vals.map(v => `<button class="MN_chip" data-col="${c}" data-val="${v}" data-active="0" onclick="PR_FilterByGroup(this)">${v}</button>`).join('')}
      </div>`;
    }).join('');

    out.innerHTML = `
      <div class="pg-card pr-card">
        <div class="pg-card-header" onclick="PR_ToggleSection('PR_DistSection','PR_DistChevron')" style="cursor:pointer;user-select:none;">
          <span class="pg-card-title">Distribution</span>
          <svg id="PR_DistChevron" class="MN_chevron" viewBox="0 0 16 16" width="11" height="11" fill="none" style="transform:rotate(90deg);">
            <polyline points="5 3 11 8 5 13" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <div class="pg-card-divider"></div>
        <div id="PR_DistSection">
          ${groupChips ? `<div id="PR_GroupChips" style="display:flex;flex-direction:column;gap:6px;padding:10px 12px;border-bottom:0.5px solid var(--color-card-border);">${groupChips}</div>` : ''}
          <div id="PR_DistTableWrap" style="max-height:360px;overflow-y:auto;">${PR_RenderDistTable(results)}</div>
        </div>
      </div>

      <div class="pg-card pr-card">
        <div class="pg-card-header" onclick="!event.target.closest('button') && PR_ToggleSection('PR_SumSection','PR_SumChevron')" style="cursor:pointer;user-select:none;">
          <span class="pg-card-title">Summary</span>
          <div style="display:flex;align-items:center;gap:8px;">
            <button onclick="event.stopPropagation();PR_AddSummaryCards()" class="pg-btn" style="height:26px;padding:0 10px;font-size:0.65rem;">+ Cards</button>
            <button onclick="event.stopPropagation();PR_LikeIt()" class="pg-btn" style="height:26px;padding:0 10px;font-size:0.65rem;">👍 Like it</button>
            <button onclick="event.stopPropagation();PR_CopySelected()" class="pg-btn" style="height:26px;padding:0 10px;font-size:0.65rem;">Copy</button>
            <svg id="PR_SumChevron" class="MN_chevron" viewBox="0 0 16 16" width="11" height="11" fill="none" style="transform:rotate(90deg);">
              <polyline points="5 3 11 8 5 13" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
        </div>
        <div class="pg-card-divider"></div>
        <div id="PR_SumSection">
          <div id="PR_SummaryTableWrap" style="padding:12px;color:var(--color-text-dim);font-size:0.72rem;">Run summary from the nav panel.</div>
        </div>
      </div>`;

  } catch(e) {
    PR_log('Error: ' + e.message, 'error');
    PR_logGroupEnd();
    out.innerHTML = _prMsg('Error: ' + e.message);
    console.error('PR run:', e);
  }
};

function _prMsg(txt) {
  return `<div style="padding:20px;color:var(--color-text-dim);font-size:0.72rem;">${txt}</div>`;
}

// ── Distribution Table ────────────────────────────────────────────────────────
function PR_RenderDistTable(rows) {
  _prDistViewRows = rows || [];
  _prSortCol = null; _prSortDir = 1;
  if (!_prDistViewRows.length) return _prMsg('No results.');
  const cols = Object.keys(_prDistViewRows[0]);

  const hdr = cols.map(c => {
    const id = 'PRCF_' + c.replace(/\W/g,'_');
    const filterInput = _prIsNum(c)
      ? `<div style="display:flex;gap:2px;margin-top:4px;">
          <select id="${id}_op" onchange="PR_ApplyColFilters()" style="height:20px;width:34px;padding:0 2px;border:1px solid var(--color-card-border);border-radius:3px;background:var(--color-card-bg);font-size:0.6rem;">
            <option value="any">—</option><option value="<=">≤</option><option value=">=">≥</option>
            <option value="<">&lt;</option><option value=">">&gt;</option><option value="=">=</option>
          </select>
          <input id="${id}_val" type="number" step="any" placeholder="…" oninput="PR_ApplyColFilters()"
            style="width:54px;height:20px;padding:0 4px;border:1px solid var(--color-card-border);border-radius:3px;background:var(--color-card-bg);font-size:0.6rem;" />
        </div>`
      : `<input id="${id}_txt" type="text" placeholder="search…" oninput="PR_ApplyColFilters()"
          style="width:100%;height:20px;padding:0 5px;margin-top:4px;border:1px solid var(--color-card-border);border-radius:3px;background:var(--color-card-bg);font-size:0.6rem;box-sizing:border-box;" />`;
    return `<th style="${_prThS}" onclick="PR_SortDist('${c}')">
      <div style="display:flex;align-items:center;gap:4px;">${c} <span data-sortarrow="${c}" style="opacity:0.35;font-weight:400;">⇅</span></div>
      ${filterInput}
    </th>`;
  }).join('');

  return `<div style="overflow-x:auto;"><table id="PR_DistTable" style="width:100%;border-collapse:collapse;">
    <thead><tr>${hdr}</tr></thead>
    <tbody id="PR_DistTbody">${_prBuildBody(_prDistViewRows, cols)}</tbody>
  </table></div>`;
}

function _prBuildBody(rows, cols) {
  if (!rows.length) return `<tr><td colspan="${cols.length}" style="${_prTdS}text-align:center;">No results.</td></tr>`;
  return rows.map((row, i) => {
    const bg = i % 2 === 0 ? 'transparent' : 'var(--color-page-bg)';
    return `<tr style="background:${bg};">${cols.map(c => `<td style="${_prTdS}">${row[c] ?? '—'}</td>`).join('')}</tr>`;
  }).join('');
}

function PR_SortDist(col) {
  if (_prSortCol === col) _prSortDir *= -1; else { _prSortCol = col; _prSortDir = 1; }
  PR_ApplyColFilters();
}

function PR_ApplyColFilters() {
  const cols = PR_DistResults.length ? Object.keys(PR_DistResults[0]) : [];
  if (!cols.length) return;
  const ops = { '<': (a,b)=>a<b, '<=': (a,b)=>a<=b, '>': (a,b)=>a>b, '>=': (a,b)=>a>=b, '=': (a,b)=>a===b };

  let rows = _prDistViewRows.filter(r => cols.every(c => {
    const id = 'PRCF_' + c.replace(/\W/g,'_');
    if (_prIsNum(c)) {
      const opEl = document.getElementById(`${id}_op`);
      const vEl  = document.getElementById(`${id}_val`);
      if (!opEl || opEl.value === 'any' || !vEl || vEl.value === '') return true;
      const v = parseFloat(String(r[c] ?? '').replace('%',''));
      return !isNaN(v) && ops[opEl.value](v, parseFloat(vEl.value));
    } else {
      const el = document.getElementById(`${id}_txt`);
      if (!el || !el.value.trim()) return true;
      return String(r[c] ?? '').toLowerCase().includes(el.value.trim().toLowerCase());
    }
  }));

  if (_prSortCol) {
    rows = [...rows].sort((a,b) => {
      const av = String(a[_prSortCol] ?? '').replace('%','');
      const bv = String(b[_prSortCol] ?? '').replace('%','');
      const an = parseFloat(av), bn = parseFloat(bv);
      return (!isNaN(an) && !isNaN(bn) ? an - bn : av.localeCompare(bv)) * _prSortDir;
    });
  }

  document.querySelectorAll('[data-sortarrow]').forEach(s => s.textContent = '⇅');
  if (_prSortCol) {
    const arr = document.querySelector(`[data-sortarrow="${_prSortCol}"]`);
    if (arr) arr.textContent = _prSortDir === 1 ? '↑' : '↓';
  }

  const tbody = document.getElementById('PR_DistTbody');
  if (tbody) tbody.innerHTML = _prBuildBody(rows, cols);
}

function PR_FilterByGroup(btn) {
  const active = btn.dataset.active === '1';
  btn.dataset.active = active ? '0' : '1';
  btn.classList.toggle('active', !active);

  const byCol = {};
  for (const b of document.querySelectorAll('#PR_GroupChips [data-active="1"]')) {
    const c = b.dataset.col;
    if (!byCol[c]) byCol[c] = [];
    byCol[c].push(b.dataset.val);
  }
  const activeCols = Object.keys(byCol);
  _prDistViewRows = activeCols.length
    ? PR_DistResults.filter(r => activeCols.every(c => byCol[c].includes(String(r[c]))))
    : PR_DistResults;
  PR_ApplyColFilters();
}

function PR_ToggleSection(sectionId, chevronId) {
  const el = document.getElementById(sectionId);
  const ch = document.getElementById(chevronId);
  if (!el) return;
  const collapsed = el.style.display === 'none';
  el.style.display = collapsed ? '' : 'none';
  if (ch) ch.style.transform = collapsed ? 'rotate(90deg)' : 'rotate(0deg)';
}

// ── Summary ───────────────────────────────────────────────────────────────────
window._PR_RunSummary = function() {
  const wrap     = document.getElementById('PR_SummaryTableWrap');
  const conds    = typeof PR_GetSumConditions === 'function' ? PR_GetSumConditions() : [];
  const defCount = parseFloat(document.getElementById('PR_SumDefaultCount')?.value) || 0;
  if (!wrap || !PR_DistResults.length) return;
  if (!conds.length) { wrap.innerHTML = _prMsg('Add at least one condition in Summary Filter.'); return; }

  const connector = typeof _prSumConnector !== 'undefined' ? _prSumConnector : 'AND';
  PR_log('Run Summary — ' + conds.length + ' condition(s), connector=' + connector, 'step');

  const ops = { '≤': (a,b)=>a<=b, '≥': (a,b)=>a>=b, '<': (a,b)=>a<b, '>': (a,b)=>a>b, '=': (a,b)=>a===b };

  const matches = row => {
    const rs = conds.map(c => {
      const v = parseFloat(String(row[c.col] ?? '').replace('%',''));
      return !isNaN(v) && (ops[c.op] || (() => true))(v, c.val);
    });
    return connector === 'AND' ? rs.every(Boolean) : rs.some(Boolean);
  };

  const cols    = PR_DistResults.length ? Object.keys(PR_DistResults[0]) : [];
  const matched = PR_DistResults.filter(r => matches(r));
  PR_log('Matched ' + matched.length + ' / ' + PR_DistResults.length + ' rows', 'info');

  const displayRows = matched.length ? matched : PR_DistResults.map(r => {
    const out = { ...r };
    if (!matches(r)) {
      cols.forEach(c => { if (typeof r[c] === 'number' && c !== 'Level') out[c] = defCount; });
    }
    return out;
  });

  wrap.innerHTML = PR_RenderSummaryTable(displayRows);
};

function PR_RenderSummaryTable(rows) {
  if (!rows.length) return _prMsg('No rows match the conditions.');
  const cols  = Object.keys(rows[0]);
  const selTh = `<th style="${_prThS};width:32px;text-align:center;">
    <input type="checkbox" style="width:13px;height:13px;accent-color:var(--brand-pr-light);cursor:pointer;"
      onchange="document.querySelectorAll('#PR_SumTable tbody input[type=checkbox]').forEach(cb=>{cb.checked=this.checked;cb.closest('tr').classList.toggle('pr-row-selected',this.checked)})">
  </th>`;
  const hdr = selTh + cols.map(c => `<th style="${_prThS};cursor:default;">${c}</th>`).join('');
  const bdy = rows.map((row, i) => {
    const bg    = i % 2 === 0 ? 'transparent' : 'var(--color-page-bg)';
    const selTd = `<td style="${_prTdS};text-align:center;padding:4px 6px;">
      <input type="checkbox" style="width:13px;height:13px;accent-color:var(--brand-pr-light);cursor:pointer;"
        onchange="this.closest('tr').classList.toggle('pr-row-selected',this.checked)">
    </td>`;
    return `<tr style="background:${bg};" data-bg="${bg}">${selTd}${cols.map(c => `<td style="${_prTdS}">${row[c] ?? '—'}</td>`).join('')}</tr>`;
  }).join('');
  return `<div style="overflow-x:auto;"><table id="PR_SumTable" style="width:100%;border-collapse:collapse;">
    <thead><tr>${hdr}</tr></thead><tbody>${bdy}</tbody>
  </table></div>`;
}

// ── Like it / Copy / Cards ────────────────────────────────────────────────────
function PR_LikeIt() {
  const payload = _prBuildPayload();
  if (!payload) { PR_log('Like it — no rows selected', 'warn'); return; }
  if (typeof APP_CopyText  === 'function') APP_CopyText(JSON.stringify(payload, null, 2));
  if (typeof _RMON_Persist === 'function') _RMON_Persist(payload);
  PR_log('Liked — payload saved', 'success');
}

function PR_CopySelected() {
  const payload = _prBuildPayload();
  if (!payload) { PR_log('Copy — no rows selected', 'warn'); return; }
  if (typeof APP_CopyText === 'function') APP_CopyText(JSON.stringify(payload, null, 2));
  PR_log('Copied ' + (payload.AdditionalColumns?.length || 0) + ' condition(s)', 'success');
}

function PR_AddSummaryCards() {
  const cards = _prBuildSummaryCards();
  if (!cards.length) { PR_log('Add Cards — no rows selected', 'warn'); return; }
  if (typeof _RMON_AddCards === 'function') _RMON_AddCards(cards);
  PR_log('Added ' + cards.length + ' card(s) to report', 'success');
}

function _prBuildPayload() {
  const table = document.getElementById('PR_SumTable');
  const sp    = window.SP_getParams?.() || {};
  if (!table) return null;

  const headers     = [...table.querySelectorAll('thead th')].slice(1).map(th => th.textContent.trim());
  const checkedRows = [...table.querySelectorAll('tbody tr')].filter(tr => tr.querySelector('input[type=checkbox]')?.checked);
  if (!checkedRows.length) return null;

  const cols      = typeof PR_MiniNav_GetSelectedCols === 'function' ? PR_MiniNav_GetSelectedCols() : [];
  const groupCols = cols.filter(c => headers.includes(c));
  const byCol     = {};
  for (const tr of checkedRows) {
    for (const col of groupCols) {
      const idx = headers.indexOf(col);
      const val = tr.querySelectorAll('td')[idx + 1]?.textContent?.trim();
      if (!byCol[col]) byCol[col] = [];
      if (val && !byCol[col].includes(val)) byCol[col].push(val);
    }
  }

  const conditions = Object.entries(byCol).map(([col, vals]) => ({ Column: col, Operator: 'isin', Values: vals }));
  const id = 'Policy_Rules_' + Date.now();
  return {
    AmountInformation:   { FilterByAmount: false, AmountMetric: sp.numeric || '', Conditions: [] },
    MerchantInformation: { SelectedColumn: '', ColumnOperator: 'isin', MerchantList: [] },
    ScoreInformation:    [{ FilterByScore: false, ScoreMetric: null, Conditions: [] }],
    AdditionalColumns:   conditions,
    Source: 'Policy Rules',
    ID: id,
  };
}

function _prBuildSummaryCards() {
  const table = document.getElementById('PR_SumTable');
  if (!table) return [];
  const headers     = [...table.querySelectorAll('thead th')].slice(1).map(th => th.textContent.trim());
  const checkedRows = [...table.querySelectorAll('tbody tr')].filter(tr => tr.querySelector('input[type=checkbox]')?.checked);
  return checkedRows.map(tr => {
    const cells = [...tr.querySelectorAll('td')].slice(1);
    const row   = {};
    headers.forEach((h, i) => { row[h] = cells[i]?.textContent?.trim() ?? ''; });
    return row;
  });
}

// ── Init ──────────────────────────────────────────────────────────────────────
window.PR_RunAnalysis = function() {
  if (typeof window._PR_RunAnalysis === 'function') window._PR_RunAnalysis();
};
