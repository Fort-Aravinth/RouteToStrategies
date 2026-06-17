// RouteAnalysis.js
// Ported from Analysis_RouteAnalysis.py (analyze_step3_routes) with DuckDB-WASM queries.
// Optimisations: parallel routes, parallel columns, merged COUNT DISTINCT, shared totals, parallel amountList for R5/R7.

// ── State ─────────────────────────────────────────────────────────────────────

let RA_SelectedRoutes = new Set();
let _RA_LastResults   = {};
let _RA_running       = false;
let _RA_SortMode      = null;
if (typeof window._APP_IdSeq === 'undefined') window._APP_IdSeq = 0;

const RA_ROUTES = {
  R5: { label: 'R5', desc: () => 'Filter [Column] where FP < [Value]' },
  R6: { label: 'R6', desc: () => 'Filter [Column] where FP < [Value] (excl. seen merchants)' },
  R7: { label: 'R7', desc: () => 'Filter [Column] where FP < [Value] and score above [Score]' },
  R8: { label: 'R8', desc: () => 'Filter [Column] where FP < [Value] (excl. seen merchants) and score above [Score]' },
};

const _RA_SQL_OPS = {
  equal:                 (col, val) => `CAST("${col}" AS DOUBLE) = ${val}`,
  greater_than:          (col, val) => `CAST("${col}" AS DOUBLE) > ${val}`,
  less_than:             (col, val) => `CAST("${col}" AS DOUBLE) < ${val}`,
  greater_than_or_equal: (col, val) => `CAST("${col}" AS DOUBLE) >= ${val}`,
  less_than_or_equal:    (col, val) => `CAST("${col}" AS DOUBLE) <= ${val}`,
  not_equal:             (col, val) => `CAST("${col}" AS DOUBLE) != ${val}`,
};

const _RA_OP_SYM = {
  equal: '=', greater_than: '>', less_than: '<',
  greater_than_or_equal: '>=', less_than_or_equal: '<=', not_equal: '!=',
};

// ── UI ────────────────────────────────────────────────────────────────────────

function RA_toggleRoute(routeId) {
  if (RA_SelectedRoutes.has(routeId)) RA_SelectedRoutes.delete(routeId);
  else RA_SelectedRoutes.add(routeId);
  RA_RefreshRouteBtns();
}

function RA_RefreshRouteBtns() {
  const hasColumns = (RA_MiniNav_GetSelectedCols?.() || []).length > 0;
  const hasScore   = !!RA_SelectedScoreColumn;
  const enabledMap = { R5: hasColumns, R6: hasColumns, R7: hasColumns && hasScore, R8: hasColumns && hasScore };
  Object.keys(RA_ROUTES).forEach(routeKey => {
    const btn = document.getElementById('RA_RouteBtn_' + routeKey);
    if (!btn) return;
    const enabled = enabledMap[routeKey];
    btn.disabled = !enabled;
    if (!enabled && RA_SelectedRoutes.has(routeKey)) RA_SelectedRoutes.delete(routeKey);
    btn.classList.toggle('active', RA_SelectedRoutes.has(routeKey));
  });
  const labelEl = document.getElementById('RA_SelectedRoutesLabel');
  if (labelEl) labelEl.textContent = '';
}

function RA_SetSort(mode) {
  _RA_SortMode = _RA_SortMode === mode ? null : mode;
  ['Trans', 'DistinctCard', 'Amount'].forEach(m => {
    const btn = document.getElementById('RA_SortBtn_' + m);
    if (btn) btn.classList.toggle('active', m === _RA_SortMode);
  });
  const resultsEl = document.getElementById('RA_ResultsArea');
  const routes = [...RA_SelectedRoutes];
  if (resultsEl && routes.length && Object.keys(_RA_LastResults).length)
    _RA_renderResults(resultsEl, _RA_LastResults, routes);
}

function RA_UpdateRouteDescriptions() {
  const scoreColLabel = RA_SelectedScoreColumn || '[Column]';
  const fpVal         = document.getElementById('RA_MiniNav_VolumeFP')?.value || '[Value]';
  const scoreVal      = document.getElementById('RA_MiniNav_ScoreVal')?.value || '[Score]';
  const descs = {
    R5: `Filter ${scoreColLabel} where FP < ${fpVal}`,
    R6: `Filter ${scoreColLabel} where FP < ${fpVal} (excl. seen merchants)`,
    R7: `Filter ${scoreColLabel} where FP < ${fpVal} and score above ${scoreVal}`,
    R8: `Filter ${scoreColLabel} where FP < ${fpVal} (excl. seen merchants) and score above ${scoreVal}`,
  };
  Object.entries(descs).forEach(([routeKey, desc]) => {
    const el = document.getElementById(`RA_${routeKey}Desc`);
    if (el) el.textContent = desc;
  });
}

// ── Entry point ───────────────────────────────────────────────────────────────

async function RA_RunAnalysis() {
  const conn      = window.LD_getConn?.();
  const src       = window.LD_getSource?.();
  const resultsEl = document.getElementById('RA_ResultsArea');
  if (!resultsEl) return;

  const routes = [...RA_SelectedRoutes];
  if (!routes.length) { resultsEl.innerHTML = ''; return; }
  if (!conn || !src) { _RA_showError(resultsEl, 'Load data first.'); RA_showErrorBadge('Load data first.'); return; }

  const params = window.SP_getParams?.();
  if (!params?.col1 || !params?.values?.length || !params?.numeric || !params?.object) {
    const msg = 'Apply parameters first.';
    _RA_showError(resultsEl, msg); RA_showErrorBadge(msg); return;
  }

  const selectedCols = RA_MiniNav_GetSelectedCols?.() || [];
  if (!selectedCols.length) { const msg = 'Select at least one column.'; _RA_showError(resultsEl, msg); RA_showErrorBadge(msg); return; }
  if (!RA_AmountList.length) { const msg = 'Add at least one amount filter.'; _RA_showError(resultsEl, msg); RA_showErrorBadge(msg); return; }

  const needsScore = routes.some(r => r === 'R7' || r === 'R8');
  if (needsScore && !RA_SelectedScoreColumn) {
    const msg = 'Score routes require a score column.';
    _RA_showError(resultsEl, msg); RA_showErrorBadge(msg); return;
  }

  if (_RA_running) return;
  _RA_running = true;

  const fpThreshold = parseFloat(document.getElementById('RA_MiniNav_VolumeFP')?.value) || 10;
  const scoreCol    = RA_SelectedScoreColumn;
  const scoreVal    = parseFloat(document.getElementById('RA_MiniNav_ScoreVal')?.value) || 0;

  try {
    RA_showLoadingBadge('Computing totals…');
    const _fraudValsSQL = params.values.map(v => "'" + String(v).replace(/'/g, "''") + "'").join(',');
    const _isFraudBase  = `CAST("${params.col1}" AS VARCHAR) IN (${_fraudValsSQL})`;
    const _totalsRow = (await conn.query(`
      SELECT
        COUNT(*) AS TotalVolume,
        SUM(CAST("${params.numeric}" AS DOUBLE)) AS TotalValue,
        SUM(CASE WHEN ${_isFraudBase} THEN 1 ELSE 0 END) AS FraudVolume,
        SUM(CASE WHEN ${_isFraudBase} THEN CAST("${params.numeric}" AS DOUBLE) ELSE 0 END) AS FraudValue
      FROM "${src}"
    `)).toArray()[0];
    const sharedTotals = {
      totalVolume: Number(_totalsRow.TotalVolume),
      totalValue:  Number(_totalsRow.TotalValue),
      fraudVolume: Number(_totalsRow.FraudVolume),
      fraudValue:  Number(_totalsRow.FraudValue),
    };
    const routeArgs = {
      conn, src,
      fraudCol:   params.col1,
      fraudVals:  params.values,
      amountCol:  params.numeric,
      cardCol:    params.object,
      selectCols: selectedCols,
      fpThreshold,
      amountList: RA_AmountList,
      scoreCol,
      scoreVal,
      totals: sharedTotals,
    };
    RA_showLoadingBadge(`Running ${routes.length} route${routes.length > 1 ? 's' : ''}…`);
    const arr = await Promise.all(routes.map(route => _RA_computeRoute(route, routeArgs)));
    const results = {};
    routes.forEach((route, i) => { results[route] = arr[i]; });
    _RA_LastResults = results;
    _RA_renderResults(resultsEl, results, routes);
    RA_hideBadge();
  } catch (err) {
    const msg = 'Analysis error: ' + err.message;
    _RA_showError(resultsEl, msg);
    RA_showErrorBadge(msg);
  } finally {
    _RA_running = false;
  }
}

// ── Core computation (ported from analyze_step3_routes) ───────────────────────

async function _RA_computeRoute(routeType, opts) {
  const { conn, src, fraudCol, fraudVals, amountCol, cardCol, selectCols, fpThreshold, amountList, scoreCol, scoreVal, totals } = opts;
  const useScore     = ['R7', 'R8'].includes(routeType);
  const useCumulExcl = ['R6', 'R8'].includes(routeType);

  const fraudValsSQL = fraudVals.map(v => "'" + String(v).replace(/'/g, "''") + "'").join(',');
  const isFraudExpr  = `CAST("${fraudCol}" AS VARCHAR) IN (${fraudValsSQL})`;

  // Totals provided by caller — computed once, shared across all parallel routes
  const { totalVolume, totalValue, fraudVolume, fraudValue } = totals;

  // Optimisation 2: columns are independent — fan out in parallel.
  // Inner amountList loop stays sequential (R6/R8 cumulative exclusion reads its own seenMerchants).
  const colResultsArr = await Promise.all(selectCols.map(async colName => {
    const colEsc = colName.replace(/"/g, '""');

    const filterSpecs = [];

    if (!useCumulExcl) {
      // R5/R7: amount iterations are fully independent — fan out in parallel
      const validItems = amountList.filter(({ op }) => _RA_SQL_OPS[op]);
      const scoreWhere = useScore && scoreCol ? `AND CAST("${scoreCol}" AS DOUBLE) >= ${scoreVal}` : '';
      const qualResults = await Promise.all(validItems.map(async ({ op, val }) => {
        const qualRows = (await conn.query(`
          WITH g AS (
            SELECT CAST("${colEsc}" AS VARCHAR) AS cv,
                   COUNT(*) AS vt,
                   SUM(CASE WHEN ${isFraudExpr} THEN 1 ELSE 0 END) AS vf
            FROM "${src}"
            WHERE ${_RA_SQL_OPS[op](amountCol, val)} ${scoreWhere}
            GROUP BY "${colEsc}"
          )
          SELECT cv FROM g
          WHERE vf > 0 AND CAST(vt AS DOUBLE) / CAST(vf AS DOUBLE) < ${fpThreshold}
        `)).toArray();
        return { op, val, qualified: qualRows.map(r => String(r.cv)) };
      }));
      filterSpecs.push(...qualResults);
    } else {
      // R6/R8: sequential — each iteration excludes merchants qualified by previous iterations
      let seenMerchants = [];
      for (const { op, val } of amountList) {
        const sqlOpFn = _RA_SQL_OPS[op];
        if (!sqlOpFn) continue;
        const amtWhere   = sqlOpFn(amountCol, val);
        const seenExcl   = seenMerchants.length
          ? `AND CAST("${colEsc}" AS VARCHAR) NOT IN (${seenMerchants.map(v => "'" + String(v).replace(/'/g, "''") + "'").join(',')})`
          : '';
        const scoreWhere = useScore && scoreCol ? `AND CAST("${scoreCol}" AS DOUBLE) >= ${scoreVal}` : '';
        const qualRows = (await conn.query(`
          WITH g AS (
            SELECT CAST("${colEsc}" AS VARCHAR) AS cv,
                   COUNT(*) AS vt,
                   SUM(CASE WHEN ${isFraudExpr} THEN 1 ELSE 0 END) AS vf
            FROM "${src}"
            WHERE ${amtWhere} ${seenExcl} ${scoreWhere}
            GROUP BY "${colEsc}"
          )
          SELECT cv FROM g
          WHERE vf > 0 AND CAST(vt AS DOUBLE) / CAST(vf AS DOUBLE) < ${fpThreshold}
        `)).toArray();
        const qualified = qualRows.map(r => String(r.cv));
        filterSpecs.push({ op, val, qualified });
        if (!(op === 'equal' && Number(val) === 0)) {
          qualified.forEach(mer => { if (!seenMerchants.includes(mer)) seenMerchants.push(mer); });
        }
      }
    }

    const colWheres = filterSpecs
      .filter(fs => fs.qualified.length > 0)
      .map(({ op, val, qualified }) => {
        const qualValsSQL = qualified.map(v => "'" + v.replace(/'/g, "''") + "'").join(',');
        const scoreFilter = useScore && scoreCol ? ` AND CAST("${scoreCol}" AS DOUBLE) >= ${scoreVal}` : '';
        return `(${_RA_SQL_OPS[op](amountCol, val)} AND CAST("${colEsc}" AS VARCHAR) IN (${qualValsSQL})${scoreFilter})`;
      });

    if (!colWheres.length) {
      return { colName, result: { ..._RA_zeroMetrics(useScore, scoreVal), filterSpecs }, colWheres: [] };
    }

    const colFilter = '(' + colWheres.join(' OR ') + ')';

    // Optimisation 3: uniqueFraud merged into metrics query — 1 scan instead of 2
    const cardColEsc = cardCol.replace(/"/g, '""');
    const row = (await conn.query(`
      SELECT
        SUM(CASE WHEN ${colFilter} AND     (${isFraudExpr}) THEN 1 ELSE 0 END) AS triggered,
        SUM(CASE WHEN ${colFilter} AND     (${isFraudExpr}) THEN CAST("${amountCol}" AS DOUBLE) ELSE 0 END) AS tval,
        SUM(CASE WHEN ${colFilter} AND NOT (${isFraudExpr}) THEN 1 ELSE 0 END) AS nonfrd,
        SUM(CASE WHEN ${colFilter} AND NOT (${isFraudExpr}) THEN CAST("${amountCol}" AS DOUBLE) ELSE 0 END) AS nfval,
        COUNT(DISTINCT CASE WHEN ${colFilter} AND (${isFraudExpr}) THEN CAST("${colEsc}" AS VARCHAR) END) AS utrg,
        COUNT(DISTINCT CASE WHEN (${isFraudExpr}) THEN CAST("${colEsc}" AS VARCHAR) END) AS uniqueFraud,
        COUNT(DISTINCT CASE WHEN ${colFilter} THEN CAST("${cardColEsc}" AS VARCHAR) END) AS distinctCards
      FROM "${src}"
    `)).toArray()[0];

    const triggered     = Number(row.triggered);
    const value         = Number(row.tval);
    const nonfrd        = Number(row.nonfrd);
    const nfval         = Number(row.nfval);
    const utrg          = Number(row.utrg);
    const uniqueFraud   = Number(row.uniqueFraud);
    const distinctCards = Number(row.distinctCards);

    return {
      colName,
      colWheres,
      result: {
        triggered, value, distinctCards,
        fp:     triggered   > 0 ? Math.round(nonfrd / triggered) + ':1' : 'N/A',
        unique: utrg,
        fv:     _r2(fraudVolume > 0 ? triggered / fraudVolume * 100 : 0),
        fvl:    _r2(fraudValue  > 0 ? value     / fraudValue  * 100 : 0),
        iv:     _r2(totalVolume > 0 ? nonfrd    / totalVolume * 100 : 0),
        ivl:    _r2(totalValue  > 0 ? nfval     / totalValue  * 100 : 0),
        aa:     _r2(uniqueFraud > 0 ? utrg      / uniqueFraud * 100 : 0),
        score:  useScore ? String(scoreVal) : '0',
        filterSpecs,
      },
    };
  }));

  // Merge per-column results
  const colResults = {};
  const allWheres  = [];
  for (const { colName, result, colWheres } of colResultsArr) {
    colResults[colName] = result;
    allWheres.push(...colWheres);
  }

  // Final combined metrics across all columns
  let finalResult = _RA_zeroMetrics(useScore, scoreVal);
  if (allWheres.length) {
    const finalFilter = '(' + allWheres.join(' OR ') + ')';
    const lastColEsc  = selectCols[selectCols.length - 1].replace(/"/g, '""');
    const cardColEscF = cardCol.replace(/"/g, '""');
    const row = (await conn.query(`
      SELECT
        SUM(CASE WHEN ${finalFilter} AND     (${isFraudExpr}) THEN 1 ELSE 0 END) AS triggered,
        SUM(CASE WHEN ${finalFilter} AND     (${isFraudExpr}) THEN CAST("${amountCol}" AS DOUBLE) ELSE 0 END) AS tval,
        SUM(CASE WHEN ${finalFilter} AND NOT (${isFraudExpr}) THEN 1 ELSE 0 END) AS nonfrd,
        SUM(CASE WHEN ${finalFilter} AND NOT (${isFraudExpr}) THEN CAST("${amountCol}" AS DOUBLE) ELSE 0 END) AS nfval,
        COUNT(DISTINCT CASE WHEN ${finalFilter} AND (${isFraudExpr}) THEN CAST("${lastColEsc}" AS VARCHAR) END) AS utrg,
        COUNT(DISTINCT CASE WHEN (${isFraudExpr}) THEN CAST("${lastColEsc}" AS VARCHAR) END) AS uniqueFraud,
        COUNT(DISTINCT CASE WHEN ${finalFilter} THEN CAST("${cardColEscF}" AS VARCHAR) END) AS distinctCards
      FROM "${src}"
    `)).toArray()[0];
    const triggered     = Number(row.triggered);
    const value         = Number(row.tval);
    const nonfrd        = Number(row.nonfrd);
    const nfval         = Number(row.nfval);
    const utrg          = Number(row.utrg);
    const uniqueFraud   = Number(row.uniqueFraud);
    const distinctCards = Number(row.distinctCards);
    finalResult = {
      triggered, value, distinctCards,
      fp:     triggered   > 0 ? Math.round(nonfrd / triggered) + ':1' : 'N/A',
      unique: utrg,
      fv:     _r2(fraudVolume > 0 ? triggered / fraudVolume * 100 : 0),
      fvl:    _r2(fraudValue  > 0 ? value     / fraudValue  * 100 : 0),
      iv:     _r2(totalVolume > 0 ? nonfrd    / totalVolume * 100 : 0),
      ivl:    _r2(totalValue  > 0 ? nfval     / totalValue  * 100 : 0),
      aa:     _r2(uniqueFraud > 0 ? utrg      / uniqueFraud * 100 : 0),
      score:  useScore ? String(scoreVal) : '0',
    };
  }

  return {
    colResults, finalResult,
    TotalVolume: totalVolume, TotalValue: totalValue,
    FraudVolume: fraudVolume, FraudValue: fraudValue,
    routeMeta: { useScore, scoreCol, scoreVal },
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function _r2(n) { return Math.round(n * 100) / 100; }

function _RA_zeroMetrics(useScore, scoreVal) {
  return { triggered: 0, value: 0, distinctCards: 0, fp: 'N/A', unique: 0, fv: 0, fvl: 0, iv: 0, ivl: 0, aa: 0, score: useScore ? String(scoreVal) : '0' };
}

const _RA_FMT_NUM = n => Number.isFinite(n) ? n.toLocaleString('en-GB') : '—';
const _RA_FMT_VAL = n => Number.isFinite(n) ? n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—';

const _RA_SUB = { R5: '', R6: '', R7: '', R8: '' };
const _RA_TITLE = {
  R5: 'Standard', R6: 'Progressive',
  R7: 'Score Filter', R8: 'Score + Progressive',
};

// ── Render ────────────────────────────────────────────────────────────────────

function _RA_barRow(label, pct, fillClass) {
  const clamped = Math.min(Math.max(pct, 0), 100);
  return `<div class="ra-route-bar-row"><span class="ra-route-bar-label">${label}</span><div class="ra-route-bar-track"><div class="ra-route-bar-fill ${fillClass}" style="width:${clamped}%"></div></div><span class="ra-route-bar-pct">${pct}%</span></div>`;
}

function _RA_metrics(r) {
  return `<div class="ra-route-metrics"><div class="ra-route-metric"><span class="ra-route-metric-label">Triggered</span><span class="ra-route-metric-val">${_RA_FMT_NUM(r.triggered)}</span></div><div class="ra-route-metric"><span class="ra-route-metric-label">Value det.</span><span class="ra-route-metric-val">${_RA_FMT_VAL(r.value)}</span></div><div class="ra-route-metric"><span class="ra-route-metric-label">False pos.</span><span class="ra-route-metric-val">${r.fp}</span></div><div class="ra-route-metric"><span class="ra-route-metric-label">Score ≥</span><span class="ra-route-metric-val">${r.score}</span></div></div>`;
}

function _RA_cardShell(title, subtitle, badge, actions, metricsHtml) {
  return `<div class="pg-card ra-card"><div class="pg-card-header" style="padding:12px 14px 10px;margin-bottom:0;align-items:flex-start;"><div><div class="pg-card-title" style="font-size:0.88rem;">${title}</div><div class="pg-card-label" style="margin-top:3px;">${subtitle}</div></div><span class="ra-route-card-sub">${badge}</span></div><div class="pg-card-divider"></div><div class="ra-route-card-actions">${actions}</div>${metricsHtml}</div>`;
}

function _RA_makeSummaryCard(routeKey, result) {
  const actions = `<button class="pg-btn" onclick="RA_ShowStrategies('${routeKey}','Final')">View Strategies</button>\n     <button class="pg-btn" onclick="RA_CopyCard('${routeKey}','Final')">Copy</button>\n     <button class="pg-btn ra-like-btn" onclick="RA_AddCard('${routeKey}','Final')">👍 Like it</button>`;
  const bars = `\n     <div class="ra-route-bars">\n       ${_RA_barRow('Fraud volume', result.fv, 'ra-route-bar-fill-amber')}\n       ${_RA_barRow('Fraud value', result.fvl, 'ra-route-bar-fill-amber')}\n       <div class="ra-route-bar-divider"></div>\n       ${_RA_barRow('Impact volume', result.iv, 'ra-route-bar-fill-blue')}\n       ${_RA_barRow('Impact value', result.ivl, 'ra-route-bar-fill-blue')}\n       <div class="ra-route-bar-divider"></div>\n       ${_RA_barRow('Coverage', result.aa, 'ra-route-bar-fill-blue')}\n     </div>`;
  return _RA_cardShell(_RA_TITLE[routeKey] || routeKey, '', '', actions, _RA_metrics(result) + bars);
}

function _RA_makeRouteCard(routeKey, colName, metrics) {
  const colNameEsc = colName.replace(/'/g, "\\'");
  const actions = `<button class="pg-btn" onclick="RA_ShowStrategies('${routeKey}','${colNameEsc}')">View Strategies</button>\n     <button class="pg-btn" onclick="RA_CopyCard('${routeKey}','${colNameEsc}')">Copy</button>\n     <button class="pg-btn ra-like-btn" onclick="RA_AddCard('${routeKey}','${colNameEsc}')">👍 Like it</button>`;
  const bars = `\n     <div class="ra-route-bars">\n       ${_RA_barRow('Fraud volume', metrics.fv, 'ra-route-bar-fill-amber')}\n       ${_RA_barRow('Fraud value', metrics.fvl, 'ra-route-bar-fill-amber')}\n       <div class="ra-route-bar-divider"></div>\n       ${_RA_barRow('Impact volume', metrics.iv, 'ra-route-bar-fill-blue')}\n       ${_RA_barRow('Impact value', metrics.ivl, 'ra-route-bar-fill-blue')}\n     </div>`;
  return _RA_cardShell(colName, _RA_TITLE[routeKey] || routeKey, _RA_SUB[routeKey] || '', actions, _RA_metrics(metrics) + bars);
}

function _RA_sortKey(metrics) {
  if (_RA_SortMode === 'Amount')       return -(metrics.value    || 0);
  if (_RA_SortMode === 'DistinctCard') return -(metrics.unique   || 0);
  if (_RA_SortMode === 'Trans')        return -(metrics.triggered|| 0);
  return 0;
}

function _RA_renderResults(container, results, routes) {
  const summaryCards = routes.map(rk => _RA_makeSummaryCard(rk, results[rk].finalResult)).join('');
  const routeCards   = [];
  for (const rk of routes)
    for (const col of Object.keys(results[rk].colResults))
      routeCards.push({ rk, col, metrics: results[rk].colResults[col] });

  routeCards.sort((a, b) => _RA_sortKey(a.metrics) - _RA_sortKey(b.metrics));

  const routeHtml = routeCards.map(({ rk, col, metrics }) => _RA_makeRouteCard(rk, col, metrics)).join('');
  container.innerHTML = `\n    <div class="ra-routes-grid ra-summary-grid">${summaryCards}</div>\n    <div class="ra-routes-grid" style="margin-top:20px;">${routeHtml}</div>`;
}

function _RA_showError(container, msg) {
  container.innerHTML = `<div style="padding:16px;font-size:0.72rem;color:#ef4444;">${msg}</div>`;
}

function RA_ClearResults() {
  _RA_LastResults = {};
  const el = document.getElementById('RA_ResultsArea');
  if (el) el.innerHTML = '';
  RA_hideBadge();
}

// ── Badge (loading / error) ───────────────────────────────────────────────────

function RA_showLoadingBadge(msg) {
  let el = document.getElementById('RA_Badge');
  if (!el) {
    el = document.createElement('div');
    el.id = 'RA_Badge';
    el.className = 'App_badge';
    el.style.setProperty('--toast-brand', 'var(--brand-ra)');
    document.body.appendChild(el);
  }
  el.style.setProperty('--toast-brand', 'var(--brand-ra)');
  el.innerHTML = `
    <svg viewBox="0 0 16 16" width="14" height="14" style="flex-shrink:0;animation:RA_spin 1s linear infinite;color:var(--brand-ra)">
      <circle cx="8" cy="8" r="5.5" stroke="currentColor" stroke-width="1.5" stroke-dasharray="22" stroke-dashoffset="8" fill="none"/>
    </svg>
    <span>${msg}</span>`;
}

function RA_showErrorBadge(msg) {
  let el = document.getElementById('RA_Badge');
  if (!el) {
    el = document.createElement('div');
    el.id = 'RA_Badge';
    el.className = 'App_badge';
    document.body.appendChild(el);
  }
  el.style.setProperty('--toast-brand', '#ef4444');
  el.innerHTML = `
    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" style="flex-shrink:0;color:#ef4444;">
      <circle cx="8" cy="8" r="6.5" stroke="currentColor" stroke-width="1.5"/>
      <path d="M8 5v3.5M8 10.5v.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    </svg>
    <span>${msg}</span>
    <button onclick="document.getElementById('RA_Badge')?.remove()">✕</button>`;
}

function RA_hideBadge() {
  document.getElementById('RA_Badge')?.remove();
}


// ── Strategy view / export ────────────────────────────────────────────────────

function RA_ShowStrategies(routeKey, colOrAll) {
  const spParams    = window.SP_getParams?.();
  const amtCol      = spParams?.numeric || 'Amount';
  const routeResult = _RA_LastResults[routeKey];
  if (!routeResult) return;

  const { useScore, scoreCol, scoreVal } = routeResult.routeMeta || {};
  const thStyle = 'padding:10px 14px;font-size:0.62rem;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;border-bottom:1px solid var(--color-card-border);text-align:left;white-space:nowrap;';
  const tdStyle = 'padding:9px 14px;vertical-align:top;border-bottom:1px solid var(--color-card-border);border-right:1px solid var(--color-card-border);font-size:0.75rem;';
  const scoreCell = useScore && scoreCol
    ? `<strong style="display:block;font-size:0.78rem;color:var(--dml-text);">${scoreCol}</strong><span style="font-size:0.72rem;color:var(--dml-label);">≥ ${scoreVal}</span>`
    : `<span style="color:var(--dml-label);font-style:italic;">None</span>`;

  const makeTable = (filterSpecs, colLabel) => {
    const rowCount  = filterSpecs.length;
    const tableRows = filterSpecs.map(({ op, val, qualified }, i) => {
      const opSym     = _RA_OP_SYM[op] || op;
      const qualLabel = qualified.length
        ? qualified.slice(0, 10).join(', ') + (qualified.length > 10 ? ` … +${qualified.length - 10} more` : '')
        : '—';
      const scoreTd = i === 0 ? `<td style="${tdStyle}" rowspan="${rowCount}">${scoreCell}</td>` : '';
      return `<tr>${scoreTd}<td style="${tdStyle}font-weight:600;color:var(--dml-text);">${opSym} ${val}</td><td style="${tdStyle.replace('border-right:1px solid var(--color-card-border);', '')}color:var(--dml-text);">${qualLabel}</td></tr>`;
    }).join('');
    return `<table style="width:100%;border-collapse:collapse;table-layout:auto;"><thead><tr><th style="${thStyle}">Score Information</th><th style="${thStyle}">${amtCol}</th><th style="${thStyle}border-right:none;">${colLabel || 'Merchant Information'}</th></tr></thead><tbody>${tableRows}</tbody></table>`;
  };

  let tableHtml = '';
  if (colOrAll === 'Final') {
    for (const [colName, colResult] of Object.entries(routeResult.colResults)) {
      if (colResult?.filterSpecs?.length) tableHtml += makeTable(colResult.filterSpecs, colName);
    }
  } else {
    const colResult = routeResult.colResults?.[colOrAll];
    if (colResult?.filterSpecs?.length) tableHtml = makeTable(colResult.filterSpecs, null);
  }

  if (!tableHtml) return;
  const modalTitle = (_RA_TITLE[routeKey] || routeKey) + ' · ' + (_RA_SUB[routeKey] || '') + (colOrAll !== 'Final' ? ' · ' + colOrAll : '');
  _RA_openModal(modalTitle, tableHtml);
}

function _RA_buildPayloads(routeKey, colOrAll) {
  const routeResult = _RA_LastResults[routeKey];
  if (!routeResult) return null;

  const { useScore, scoreCol, scoreVal } = routeResult.routeMeta || {};
  const spParams  = window.SP_getParams?.() || {};
  const scoreInfo = {
    FilterByScore: !!useScore,
    ScoreMetric:   useScore ? scoreCol || null : null,
    Conditions:    useScore ? [{ OperatorDescription: '>=', ScoreValue: scoreVal }] : [],
  };

  const makePayload = (colName, spec) => ({
    AmountInformation: {
      FilterByAmount: true,
      AmountMetric:   spParams.numeric || '',
      Conditions:     [{ OperatorDescription: _RA_OP_SYM[spec.op] || spec.op, AmountValue: spec.val }],
    },
    MerchantInformation: { SelectedColumn: '', ColumnOperator: 'isin', MerchantList: [] },
    ScoreInformation:    [scoreInfo],
    AdditionalColumns:   [{ Column: colName, Operator: 'isin', Values: spec.qualified }],
    Source: 'Route Analysis',
    ID:     'Route_Analysis_' + Date.now() + '_' + (++window._APP_IdSeq),
  });

  const targetCols = colOrAll === 'Final' ? Object.keys(routeResult.colResults || {}) : [colOrAll];
  const payloads   = [];
  for (const colName of targetCols)
    for (const spec of (routeResult.colResults?.[colName]?.filterSpecs || []))
      if (spec.qualified?.length) payloads.push(makePayload(colName, spec));
  return payloads;
}

function RA_CopyCard(routeKey, colOrAll) {
  const payloads = _RA_buildPayloads(routeKey, colOrAll);
  if (!payloads) return;
  APP_CopyText(JSON.stringify(payloads, null, 2));
}

function RA_AddCard(routeKey, colOrAll) {
  const payloads = _RA_buildPayloads(routeKey, colOrAll);
  if (!payloads) return;
  APP_CopyText(JSON.stringify(payloads, null, 2));
  if (typeof _RMON_Persist === 'function') payloads.forEach(p => _RMON_Persist(p));
}

function _RA_openModal(title, bodyHtml) {
  const titleEl = document.getElementById('RA_StrategyModalTitle');
  const bodyEl  = document.getElementById('RA_StrategyModalBody');
  if (!titleEl || !bodyEl) return;
  titleEl.textContent = title;
  bodyEl.innerHTML    = bodyHtml;
  Popup_open('RA_StrategyModal');
}

// ── Tutorial ──────────────────────────────────────────────────────────────────

const _RA_TOUR_STEPS = [
  {
    title: 'Select Routes',
    body:  'Choose one or more analysis types. <strong>FP filter only</strong> qualifies merchants purely by false-positive ratio. Add <strong>cumulative exclusion</strong> to remove previously qualified merchants from each tier. Add a <strong>score threshold</strong> to restrict analysis to high-score transactions. The score routes require a score column to be selected.',
  },
  {
    title: 'Amount Filters',
    body:  'Add one or more amount conditions (e.g. <strong>> 100</strong>, <strong>= 0</strong>). Each condition defines a transaction tier used to qualify merchants. The analysis runs all tiers and combines results.',
  },
  {
    title: 'Available Columns',
    body:  'Select the categorical columns to test as blocking dimensions — for example <strong>MerchantID</strong>, <strong>CardBin</strong>, or <strong>Channel</strong>. Each column gets its own result card.',
  },
  {
    title: 'FP Threshold',
    body:  'Set the maximum <strong>false-positive ratio</strong> a merchant group must meet to be included. For example, a threshold of <strong>10</strong> means the route only blocks groups where at least 1 in 10 transactions is fraud.',
  },
  {
    title: 'Score Column',
    body:  'For score-based routes, select a <strong>score column</strong> and a minimum score value. Only transactions at or above that score are considered when qualifying merchant groups.',
  },
  {
    title: 'Reading Results',
    body:  'Each result card shows <strong>Triggered</strong> (fraud caught), <strong>Value</strong> (amount detected), <strong>False positives</strong>, and bar charts for fraud coverage and good-transaction impact. The <strong>Final</strong> card combines all columns.',
  },
  {
    title: 'Like it / Copy / Strategies',
    body:  '<strong>View Strategies</strong> shows the exact merchant lists and amount conditions per column. <strong>Copy</strong> exports the rule as JSON. <strong>👍 Like it</strong> persists the rule to the Rules Monitor.',
  },
];

let _RA_tourStep    = 0;
let _RA_tourEnabled = false;

function RA_tourShow(step) {
  _RA_tourStep = step;
  const s     = _RA_TOUR_STEPS[step];
  if (!s) { RA_tourDismiss(); return; }
  const total = _RA_TOUR_STEPS.length;
  let el = document.getElementById('RA_TourCard');
  if (!el) {
    el = document.createElement('div');
    el.id = 'RA_TourCard';
    el.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:99998;';
    document.body.appendChild(el);
  }
  el.innerHTML = `
    <div class="gs-toast" id="RA_TourInner" style="border-left-color:var(--brand-ra);">
      <div class="gs-tab-strip" onclick="RA_tourTabExpand()" title="Expand">
        <span class="gs-tab-arrow">›</span>
        <span class="gs-tab-label">Step ${step+1} of ${total}</span>
      </div>
      <div class="gs-toast-inner">
        <div class="gs-toast-header">
          <div>
            <div class="gs-toast-step" style="color:var(--brand-ra);">Step ${step+1} of ${total}</div>
            <div class="gs-toast-title">${s.title}</div>
          </div>
          <button class="gs-toast-btn-collapse" onclick="RA_tourTabCollapse()" title="Collapse to tab" style="background:var(--brand-ra-dim);border-color:var(--brand-ra);color:var(--brand-ra);">
            <svg viewBox="0 0 16 16" width="10" height="10" fill="none"><path d="M10 3H13V13H10M6 8H2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
        </div>
        <div class="gs-toast-body">${s.body}</div>
        <div class="gs-toast-actions">
          <button class="gs-toast-btn-back" onclick="RA_tourShow(_RA_tourStep - 1)" style="${step === 0 ? 'visibility:hidden;' : ''}">← Back</button>
          <button class="gs-toast-btn-next" onclick="RA_tourNext()" style="background:var(--brand-ra);">${step+1 < total ? 'Next →' : 'Finish ✓'}</button>
        </div>
      </div>
    </div>`;
}

function RA_tourTabCollapse() {
  const el = document.getElementById('RA_TourInner');
  if (!el) return;
  const rect = el.getBoundingClientRect();
  el.style.top    = '';
  el.style.bottom = (window.innerHeight - rect.bottom) + 'px';
  el.classList.add('gs-tabbed');
  const strip = el.querySelector('.gs-tab-strip');
  if (strip) strip.style.height = rect.height + 'px';
}

function RA_tourTabExpand() {
  const el = document.getElementById('RA_TourInner');
  if (!el) return;
  el.style.top = el.style.bottom = '';
  el.classList.remove('gs-tabbed');
}

function RA_tourNext() { RA_tourShow(_RA_tourStep + 1); }

function RA_tourDismiss() {
  document.getElementById('RA_TourCard')?.remove();
  _RA_tourEnabled = false;
  document.getElementById('RA_HelpBtn')?.classList.remove('tutorial-active');
}

function RA_HelpPrompt() {
  _RA_tourEnabled = !_RA_tourEnabled;
  document.getElementById('RA_HelpBtn')?.classList.toggle('tutorial-active', _RA_tourEnabled);
  if (_RA_tourEnabled) {
    RA_tourShow(0);
  } else {
    RA_tourDismiss();
  }
}

if (typeof App_RegisterTutorial === 'function') App_RegisterTutorial('ra-active', RA_HelpPrompt);
