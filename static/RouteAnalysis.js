// ── Route Analysis ────────────────────────────────────────────────────────────

let ANRA_SelectedRoutes = new Set();
let _ANRA_LastResults   = {};   // stored for action buttons

const ANRA_ROUTES = {
  R5: { label: 'R5', desc: () => `Filter [Column] where FP < [Value]` },
  R6: { label: 'R6', desc: () => `Filter [Column] where FP < [Value] (excl. seen merchants)` },
  R7: { label: 'R7', desc: () => `Filter [Column] where FP < [Value] and score above [Score]` },
  R8: { label: 'R8', desc: () => `Filter [Column] where FP < [Value] (excl. seen merchants) and score above [Score]` },
};

function ANRA_toggleRoute(id) {
  if (ANRA_SelectedRoutes.has(id)) ANRA_SelectedRoutes.delete(id);
  else ANRA_SelectedRoutes.add(id);
  ANRA_RefreshRouteBtns();
  ANRA_RunAnalysis();
}

function ANRA_RefreshRouteBtns() {
  const hasCol   = (ANRA_MiniNav_GetSelectedCols?.() || []).length > 0;
  const hasScore = !!ANRA_SelectedScoreColumn;

  const canRun = { R5: hasCol, R6: hasCol, R7: hasCol && hasScore, R8: hasCol && hasScore };

  Object.keys(ANRA_ROUTES).forEach(id => {
    const btn = document.getElementById(`ANRA_RouteBtn_${id}`);
    if (!btn) return;
    const ok = canRun[id];
    btn.disabled = !ok;
    if (!ok && ANRA_SelectedRoutes.has(id)) ANRA_SelectedRoutes.delete(id);
    btn.classList.toggle('active', ANRA_SelectedRoutes.has(id));
  });

  const count = ANRA_SelectedRoutes.size;
  const badge = document.getElementById('ANRA_SelectedRoutesLabel');
  if (badge) badge.textContent = count ? `${count} selected` : '';
}

function ANRA_UpdateRouteDescriptions() {
  const col   = ANRA_SelectedScoreColumn || '[Column]';
  const fp    = document.getElementById('ANRA_MiniNav_VolumeFP')?.value || '[Value]';
  const score = document.getElementById('ANRA_MiniNav_ScoreVal')?.value || '[Score]';
  const descs = {
    R5: `Filter ${col} where FP < ${fp}`,
    R6: `Filter ${col} where FP < ${fp} (excl. seen merchants)`,
    R7: `Filter ${col} where FP < ${fp} and score above ${score}`,
    R8: `Filter ${col} where FP < ${fp} (excl. seen merchants) and score above ${score}`,
  };
  Object.entries(descs).forEach(([id, text]) => {
    const el = document.getElementById(`ANRA_${id}Desc`);
    if (el) el.textContent = text;
  });
}

// ── SQL operator map ──────────────────────────────────────────────────────────
const _ANRA_SQL_OPS = {
  equal:                 (col, val) => `CAST("${col}" AS DOUBLE) = ${val}`,
  greater_than:          (col, val) => `CAST("${col}" AS DOUBLE) > ${val}`,
  less_than:             (col, val) => `CAST("${col}" AS DOUBLE) < ${val}`,
  greater_than_or_equal: (col, val) => `CAST("${col}" AS DOUBLE) >= ${val}`,
  less_than_or_equal:    (col, val) => `CAST("${col}" AS DOUBLE) <= ${val}`,
  not_equal:             (col, val) => `CAST("${col}" AS DOUBLE) != ${val}`,
};
const _ANRA_OP_SYM = { equal: '=', greater_than: '>', less_than: '<', greater_than_or_equal: '>=', less_than_or_equal: '<=', not_equal: '!=' };

// ── Main entry point ──────────────────────────────────────────────────────────
let _ANRA_running = false;

async function ANRA_RunAnalysis() {
  const conn = window.LD_getConn?.();
  const src  = window.LD_getSource?.();
  const area = document.getElementById('ANRA_ResultsArea');
  if (!area) return;

  const selectedRoutes = [...ANRA_SelectedRoutes];
  if (!selectedRoutes.length) { area.innerHTML = ''; return; }

  if (!conn || !src) { _ANRA_showError(area, 'Load data first.'); return; }

  const sp = window.SP_getParams?.();
  if (!sp?.col1 || !sp?.values?.length || !sp?.numeric || !sp?.object) {
    _ANRA_showError(area, 'Apply parameters first (fraud column, values, amount column, card dimension).');
    return;
  }

  const selectCols = ANRA_MiniNav_GetSelectedCols?.() || [];
  if (!selectCols.length) { _ANRA_showError(area, 'Select at least one column in Available Columns.'); return; }
  if (!ANRA_AmountList.length) { _ANRA_showError(area, 'Add at least one amount filter.'); return; }

  const needsScore = [...ANRA_SelectedRoutes].some(r => r === 'R7' || r === 'R8');
  if (needsScore && !ANRA_SelectedScoreColumn) {
    _ANRA_showError(area, 'R7 / R8 require a score column — select one in the Score section.');
    return;
  }

  if (_ANRA_running) return;
  _ANRA_running = true;
  _ANRA_showLoading(area, selectedRoutes);

  const fpThreshold = parseFloat(document.getElementById('ANRA_MiniNav_VolumeFP')?.value) || 10.0;
  const scoreCol    = ANRA_SelectedScoreColumn;
  const scoreVal    = parseFloat(document.getElementById('ANRA_MiniNav_ScoreVal')?.value) || 0;

  try {
    const results = {};
    for (const route of selectedRoutes) {
      results[route] = await _ANRA_computeRoute(route, {
        conn, src,
        fraudCol: sp.col1, fraudVals: sp.values,
        amountCol: sp.numeric, cardCol: sp.object,
        selectCols, fpThreshold, amountList: ANRA_AmountList, scoreCol, scoreVal,
      });
    }
    _ANRA_LastResults = results;
    _ANRA_renderResults(area, results, selectedRoutes);
  } catch (err) {
    _ANRA_showError(area, `Analysis error: ${err.message}`);
  } finally {
    _ANRA_running = false;
  }
}

// ── Core computation ──────────────────────────────────────────────────────────
async function _ANRA_computeRoute(route, p) {
  const { conn, src, fraudCol, fraudVals, amountCol, cardCol, selectCols, fpThreshold, amountList, scoreCol, scoreVal } = p;
  const useScore     = ['R7', 'R8'].includes(route);
  const useExclusion = ['R6', 'R8'].includes(route);

  const fraudValsSQL = fraudVals.map(v => `'${String(v).replace(/'/g, "''")}'`).join(',');
  const isFraud      = `CAST("${fraudCol}" AS VARCHAR) IN (${fraudValsSQL})`;

  const baseRow = (await conn.query(`
    SELECT
      COUNT(*) AS TotalVolume,
      SUM(CAST("${amountCol}" AS DOUBLE)) AS TotalValue,
      SUM(CASE WHEN ${isFraud} THEN 1 ELSE 0 END) AS FraudVolume,
      SUM(CASE WHEN ${isFraud} THEN CAST("${amountCol}" AS DOUBLE) ELSE 0 END) AS FraudValue
    FROM "${src}"
  `)).toArray()[0];

  const TotalVolume = Number(baseRow.TotalVolume);
  const TotalValue  = Number(baseRow.TotalValue);
  const FraudVolume = Number(baseRow.FraudVolume);
  const FraudValue  = Number(baseRow.FraudValue);

  const colResults    = {};
  const allTrigParts  = [];   // union across all cols → used for Final summary

  for (const col of selectCols) {
    const ec = col.replace(/"/g, '""');
    let excluded     = [];
    const filterSpecs = [];

    for (const { op, val } of amountList) {
      const sqlOp = _ANRA_SQL_OPS[op];
      if (!sqlOp) continue;
      const amtCond   = sqlOp(amountCol, val);
      const excCond   = (useExclusion && excluded.length)
        ? `AND CAST("${ec}" AS VARCHAR) NOT IN (${excluded.map(v => `'${String(v).replace(/'/g, "''")}'`).join(',')})`
        : '';
      const scoreCond = (useScore && scoreCol) ? `AND CAST("${scoreCol}" AS DOUBLE) >= ${scoreVal}` : '';

      const rows = (await conn.query(`
        WITH g AS (
          SELECT CAST("${ec}" AS VARCHAR) AS cv,
                 COUNT(*) AS vt,
                 SUM(CASE WHEN ${isFraud} THEN 1 ELSE 0 END) AS vf
          FROM "${src}"
          WHERE ${amtCond} ${excCond} ${scoreCond}
          GROUP BY "${ec}"
        )
        SELECT cv FROM g
        WHERE vf > 0 AND CAST(vt AS DOUBLE) / CAST(vf AS DOUBLE) < ${fpThreshold}
      `)).toArray();

      const qualified = rows.map(r => String(r.cv));
      filterSpecs.push({ op, val, qualified });

      if (useExclusion && !(op === 'equal' && Number(val) === 0))
        qualified.forEach(v => { if (!excluded.includes(v)) excluded.push(v); });
    }

    const parts = filterSpecs
      .filter(f => f.qualified.length > 0)
      .map(({ op, val, qualified }) => {
        const inList    = qualified.map(v => `'${v.replace(/'/g, "''")}'`).join(',');
        const scoreSnip = (useScore && scoreCol) ? ` AND CAST("${scoreCol}" AS DOUBLE) >= ${scoreVal}` : '';
        return `(${_ANRA_SQL_OPS[op](amountCol, val)} AND CAST("${ec}" AS VARCHAR) IN (${inList})${scoreSnip})`;
      });

    if (!parts.length) {
      colResults[col] = { ..._ANRA_zeroMetrics(useScore, scoreVal), filterSpecs };
      continue;
    }

    allTrigParts.push(...parts);

    const isTrig = `(${parts.join(' OR ')})`;

    const uFraud = Number((await conn.query(`
      SELECT COUNT(DISTINCT CAST("${ec}" AS VARCHAR)) AS n FROM "${src}" WHERE ${isFraud}
    `)).toArray()[0].n);

    const m = (await conn.query(`
      SELECT
        SUM(CASE WHEN ${isTrig} AND     (${isFraud}) THEN 1 ELSE 0 END) AS triggered,
        SUM(CASE WHEN ${isTrig} AND     (${isFraud}) THEN CAST("${amountCol}" AS DOUBLE) ELSE 0 END) AS tval,
        SUM(CASE WHEN ${isTrig} AND NOT (${isFraud}) THEN 1 ELSE 0 END) AS nonfrd,
        SUM(CASE WHEN ${isTrig} AND NOT (${isFraud}) THEN CAST("${amountCol}" AS DOUBLE) ELSE 0 END) AS nfval,
        COUNT(DISTINCT CASE WHEN ${isTrig} AND (${isFraud}) THEN CAST("${ec}" AS VARCHAR) END) AS utrg
      FROM "${src}"
    `)).toArray()[0];

    const triggered = Number(m.triggered), tval = Number(m.tval),
          nonfrd    = Number(m.nonfrd),    nfval = Number(m.nfval),
          utrg      = Number(m.utrg);

    colResults[col] = {
      triggered, value: tval,
      fp:  triggered > 0 ? `${Math.round(nonfrd / triggered)}:1` : 'N/A',
      unique: utrg,
      fv:  _r2(FraudVolume > 0 ? triggered / FraudVolume * 100 : 0),
      fvl: _r2(FraudValue  > 0 ? tval      / FraudValue  * 100 : 0),
      iv:  _r2(TotalVolume > 0 ? nonfrd    / TotalVolume  * 100 : 0),
      ivl: _r2(TotalValue  > 0 ? nfval     / TotalValue   * 100 : 0),
      aa:  _r2(uFraud      > 0 ? utrg      / uFraud       * 100 : 0),
      score: useScore ? String(scoreVal) : '0',
      filterSpecs,
    };
  }

  // ── Combined "Final" across all columns ───────────────────────────────────
  let finalResult = _ANRA_zeroMetrics(useScore, scoreVal);
  if (allTrigParts.length) {
    const isAny  = `(${allTrigParts.join(' OR ')})`;
    const lastEc = selectCols[selectCols.length - 1].replace(/"/g, '""');

    const uFraudFinal = Number((await conn.query(`
      SELECT COUNT(DISTINCT CAST("${lastEc}" AS VARCHAR)) AS n FROM "${src}" WHERE ${isFraud}
    `)).toArray()[0].n);

    const f = (await conn.query(`
      SELECT
        SUM(CASE WHEN ${isAny} AND     (${isFraud}) THEN 1 ELSE 0 END) AS triggered,
        SUM(CASE WHEN ${isAny} AND     (${isFraud}) THEN CAST("${amountCol}" AS DOUBLE) ELSE 0 END) AS tval,
        SUM(CASE WHEN ${isAny} AND NOT (${isFraud}) THEN 1 ELSE 0 END) AS nonfrd,
        SUM(CASE WHEN ${isAny} AND NOT (${isFraud}) THEN CAST("${amountCol}" AS DOUBLE) ELSE 0 END) AS nfval,
        COUNT(DISTINCT CASE WHEN ${isAny} AND (${isFraud}) THEN CAST("${lastEc}" AS VARCHAR) END) AS utrg
      FROM "${src}"
    `)).toArray()[0];

    const ft = Number(f.triggered), fv = Number(f.tval),
          fn = Number(f.nonfrd),    fnv = Number(f.nfval),
          fu = Number(f.utrg);

    finalResult = {
      triggered: ft, value: fv,
      fp:  ft > 0 ? `${Math.round(fn / ft)}:1` : 'N/A',
      unique: fu,
      fv:  _r2(FraudVolume > 0 ? ft  / FraudVolume * 100 : 0),
      fvl: _r2(FraudValue  > 0 ? fv  / FraudValue  * 100 : 0),
      iv:  _r2(TotalVolume > 0 ? fn  / TotalVolume  * 100 : 0),
      ivl: _r2(TotalValue  > 0 ? fnv / TotalValue   * 100 : 0),
      aa:  _r2(uFraudFinal > 0 ? fu  / uFraudFinal  * 100 : 0),
      score: useScore ? String(scoreVal) : '0',
    };
  }

  return { colResults, finalResult, TotalVolume, TotalValue, FraudVolume, FraudValue,
           routeMeta: { useScore, scoreCol, scoreVal } };
}

function _r2(n) { return Math.round(n * 100) / 100; }
function _ANRA_zeroMetrics(useScore, scoreVal) {
  return { triggered: 0, value: 0, fp: 'N/A', unique: 0, fv: 0, fvl: 0, iv: 0, ivl: 0, aa: 0, score: useScore ? String(scoreVal) : '0' };
}

// ── Render ────────────────────────────────────────────────────────────────────
const _ANRA_FMT_NUM = n => Number.isFinite(n) ? n.toLocaleString('en-GB') : '—';
const _ANRA_FMT_VAL = n => Number.isFinite(n) ? n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—';
const _ANRA_SUB   = { R5: 'No score · No excl.', R6: 'No score · Cumul. excl.', R7: 'Score · No excl.', R8: 'Score · Cumul. excl.' };
const _ANRA_TITLE = { R5: 'FP filter only', R6: 'FP filter only', R7: 'FP + score filter', R8: 'FP + score filter' };

function _ANRA_barRow(label, pct, cls) {
  const w = Math.min(Math.max(pct, 0), 100);
  return `<div class="anra-route-bar-row">
    <span class="anra-route-bar-label">${label}</span>
    <div class="anra-route-bar-track"><div class="anra-route-bar-fill ${cls}" style="width:${w}%"></div></div>
    <span class="anra-route-bar-pct">${pct}%</span>
  </div>`;
}

function _ANRA_metrics(d) {
  return `<div class="anra-route-metrics">
    <div class="anra-route-metric"><span class="anra-route-metric-label">Triggered</span><span class="anra-route-metric-val">${_ANRA_FMT_NUM(d.triggered)}</span></div>
    <div class="anra-route-metric"><span class="anra-route-metric-label">Value det.</span><span class="anra-route-metric-val">${_ANRA_FMT_VAL(d.value)}</span></div>
    <div class="anra-route-metric"><span class="anra-route-metric-label">False pos.</span><span class="anra-route-metric-val">${d.fp}</span></div>
    <div class="anra-route-metric"><span class="anra-route-metric-label">Score ≥</span><span class="anra-route-metric-val">${d.score}</span></div>
  </div>`;
}

function _ANRA_cardShell(titleHtml, subtitleHtml, subLabel, actionsHtml, bodyHtml) {
  return `<div class="pg-card anra-card">
    <div class="pg-card-header" style="padding:12px 14px 10px;margin-bottom:0;align-items:flex-start;">
      <div>
        <div class="pg-card-title" style="font-size:0.88rem;">${titleHtml}</div>
        <div class="pg-card-label" style="margin-top:3px;">${subtitleHtml}</div>
      </div>
      <span class="anra-route-card-sub">${subLabel}</span>
    </div>
    <div class="pg-card-divider"></div>
    <div class="anra-route-card-actions">${actionsHtml}</div>
    ${bodyHtml}
  </div>`;
}

function _ANRA_makeSummaryCard(route, d) {
  return _ANRA_cardShell(
    _ANRA_TITLE[route] || route, 'Final', _ANRA_SUB[route] || '',
    `<button class="pg-btn" onclick="ANRA_ShowStrategies('${route}','Final')">View Strategies</button>
     <button class="pg-btn" onclick="ANRA_CopyCard('${route}','Final')">Copy</button>
     <button class="pg-btn anra-like-btn" onclick="ANRA_AddCard('${route}','Final')">👍 Like it</button>`,
    `${_ANRA_metrics(d)}
     <div class="anra-route-bars">
       ${_ANRA_barRow('Fraud volume', d.fv,  'anra-route-bar-fill-amber')}
       ${_ANRA_barRow('Fraud value',  d.fvl, 'anra-route-bar-fill-amber')}
       <div class="anra-route-bar-divider"></div>
       ${_ANRA_barRow('Impact volume', d.iv,  'anra-route-bar-fill-blue')}
       ${_ANRA_barRow('Impact value',  d.ivl, 'anra-route-bar-fill-blue')}
       <div class="anra-route-bar-divider"></div>
       ${_ANRA_barRow('Coverage', d.aa, 'anra-route-bar-fill-blue')}
     </div>`
  );
}

function _ANRA_makeRouteCard(route, col, d) {
  const rCol = col.replace(/'/g, "\\'");
  return _ANRA_cardShell(
    col, _ANRA_TITLE[route] || route, _ANRA_SUB[route] || '',
    `<button class="pg-btn" onclick="ANRA_ShowStrategies('${route}','${rCol}')">View Strategies</button>
     <button class="pg-btn" onclick="ANRA_CopyCard('${route}','${rCol}')">Copy</button>
     <button class="pg-btn anra-like-btn" onclick="ANRA_AddCard('${route}','${rCol}')">👍 Like it</button>`,
    `${_ANRA_metrics(d)}
     <div class="anra-route-bars">
       ${_ANRA_barRow('Fraud volume', d.fv,  'anra-route-bar-fill-amber')}
       ${_ANRA_barRow('Fraud value',  d.fvl, 'anra-route-bar-fill-amber')}
       <div class="anra-route-bar-divider"></div>
       ${_ANRA_barRow('Impact volume', d.iv,  'anra-route-bar-fill-blue')}
       ${_ANRA_barRow('Impact value',  d.ivl, 'anra-route-bar-fill-blue')}
     </div>`
  );
}

function _ANRA_renderResults(area, results, routes) {
  const summaryCards = routes.map(r => _ANRA_makeSummaryCard(r, results[r].finalResult)).join('');

  const routeCards = [];
  for (const route of routes)
    for (const col of Object.keys(results[route].colResults))
      routeCards.push(_ANRA_makeRouteCard(route, col, results[route].colResults[col]));

  area.innerHTML = `
    <div class="anra-routes-grid anra-summary-grid">${summaryCards}</div>
    <div class="anra-routes-grid" style="margin-top:20px;">${routeCards.join('')}</div>`;
}

// ── Loading / error ───────────────────────────────────────────────────────────
function _ANRA_showError(area, msg) {
  area.innerHTML = `<div style="padding:16px;font-size:0.72rem;color:#ef4444;">${msg}</div>`;
}
function _ANRA_showLoading(area, routes) {
  area.innerHTML = `
    <div class="anra-routes-grid anra-summary-grid">
      ${routes.map(r => `<div class="pg-card anra-card" style="min-height:120px;">
        <div class="pg-card-header" style="padding:12px 14px 10px;margin-bottom:0;">
          <div class="pg-card-title" style="font-size:0.88rem;">${r}</div>
          <div class="pg-card-label" style="margin-top:3px;">Final</div>
        </div>
        <div class="pg-card-divider"></div>
        <div style="padding:16px;font-size:0.68rem;color:var(--color-text-dim);">Computing…</div>
      </div>`).join('')}
    </div>`;
}

// ── Action buttons ────────────────────────────────────────────────────────────
function ANRA_ShowStrategies(route, col) {
  const sp        = window.SP_getParams?.();
  const amountCol = sp?.numeric || 'Amount';
  const routeData = _ANRA_LastResults[route];
  if (!routeData) return;

  const { useScore, scoreCol, scoreVal } = routeData.routeMeta || {};

  const thStyle = `padding:10px 14px;font-size:0.62rem;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;border-bottom:1px solid var(--color-card-border);text-align:left;white-space:nowrap;`;
  const td      = `padding:9px 14px;vertical-align:top;border-bottom:1px solid var(--color-card-border);border-right:1px solid var(--color-card-border);font-size:0.75rem;`;
  const dim     = t => `<span style="color:var(--dml-label);font-style:italic;">${t}</span>`;

  const scoreContent = useScore && scoreCol
    ? `<strong style="display:block;font-size:0.78rem;color:var(--dml-text);">${scoreCol}</strong><span style="font-size:0.72rem;color:var(--dml-label);">≥ ${scoreVal}</span>`
    : dim('None');

  const buildTable = (filterSpecs, colLabel) => {
    const n = filterSpecs.length;
    const dataRows = filterSpecs.map(({ op, val, qualified }, i) => {
      const sym   = _ANRA_OP_SYM[op] || op;
      const list  = qualified.length
        ? qualified.slice(0, 10).join(', ') + (qualified.length > 10 ? ` … +${qualified.length - 10} more` : '')
        : '—';
      const scoreCell = i === 0
        ? `<td style="${td}" rowspan="${n}">${scoreContent}</td>`
        : '';
      return `<tr>
        ${scoreCell}
        <td style="${td}font-weight:600;color:var(--dml-text);">${sym} ${val}</td>
        <td style="${td.replace('border-right:1px solid var(--color-card-border);','')}color:var(--dml-text);">${list}</td>
      </tr>`;
    }).join('');

    return `
      <table style="width:100%;border-collapse:collapse;table-layout:auto;">
        <thead>
          <tr style="background:var(--color-page-bg);">
            <th style="${thStyle}color:#f59e0b;">Score Information</th>
            <th style="${thStyle}color:#3b82f6;">${amountCol}</th>
            <th style="${thStyle}color:#6366f1;border-right:none;">${colLabel || 'Merchant Information'}</th>
          </tr>
        </thead>
        <tbody>${dataRows}</tbody>
      </table>`;
  };

  let html = '';
  if (col === 'Final') {
    for (const [colName, colData] of Object.entries(routeData.colResults)) {
      if (colData?.filterSpecs?.length)
        html += buildTable(colData.filterSpecs, colName);
    }
  } else {
    const colData = routeData.colResults?.[col];
    if (colData?.filterSpecs?.length)
      html = buildTable(colData.filterSpecs, null);
  }

  if (!html) return;
  _ANRA_openModal(`${route} · ${col}`, html);
}

function _ANRA_buildPayloads(route, col) {
  const routeData = _ANRA_LastResults[route];
  if (!routeData) return null;
  const { useScore, scoreCol, scoreVal } = routeData.routeMeta || {};
  const sp = window.SP_getParams?.() || {};

  const scoreInfo = {
    FilterByScore: !!useScore,
    ScoreMetric:   useScore ? (scoreCol || null) : null,
    Conditions:    useScore ? [{ OperatorDescription: '>=', ScoreValue: scoreVal }] : [],
  };

  const _makeEntry = (colName, spec) => {
    const id = 'Route_Analysis_' + Date.now() + '_' + (++_APP_IdSeq);
    return {
      AmountInformation: {
        FilterByAmount: true,
        AmountMetric: sp.numeric || '',
        Conditions: [{ OperatorDescription: _ANRA_OP_SYM[spec.op] || spec.op, AmountValue: spec.val }],
      },
      MerchantInformation: {
        SelectedColumn: '',
        ColumnOperator: 'isin',
        MerchantList:   [],
      },
      ScoreInformation: [scoreInfo],
      AdditionalColumns: [{ Column: colName, Operator: 'isin', Values: spec.qualified }],
      Source: 'Route Analysis',
      ID: id,
    };
  };

  const cols = col === 'Final' ? Object.keys(routeData.colResults || {}) : [col];
  const entries = [];
  for (const colName of cols) {
    const specs = routeData.colResults?.[colName]?.filterSpecs || [];
    for (const spec of specs) {
      if ((spec.qualified || []).length) entries.push(_makeEntry(colName, spec));
    }
  }
  return entries;
}

function ANRA_CopyCard(route, col) {
  const output = _ANRA_buildPayloads(route, col);
  if (!output) return;
  APP_CopyText(JSON.stringify(output, null, 2));
}

function ANRA_AddCard(route, col) {
  const payloads = _ANRA_buildPayloads(route, col);
  if (!payloads) return;
  APP_CopyText(JSON.stringify(payloads, null, 2));
  if (typeof _RMON_Persist === 'function') payloads.forEach(p => _RMON_Persist(p));
}

// ── Modal — uses shared Popup system ─────────────────────────────────────────
function _ANRA_openModal(title, bodyHtml) {
  const titleEl = document.getElementById('ANRA_StrategyModalTitle');
  const bodyEl  = document.getElementById('ANRA_StrategyModalBody');
  if (!titleEl || !bodyEl) return;
  titleEl.textContent = title;
  bodyEl.innerHTML    = bodyHtml;
  Popup_open('ANRA_StrategyModal');
}
