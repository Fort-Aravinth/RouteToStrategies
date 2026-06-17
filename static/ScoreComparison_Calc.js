// ── SC_Calc — Score Comparison calculation layer ──────────────────────────────
// Pure functions + DuckDB query builder.
// Reads shared range state from ScoreComparison.js globals: _SC_Start, _SC_End,
// _SC_Step, _SC_Calc, _SC_Criteria.
// Unlike SA_Calc, the score column is always passed as a parameter.

// ── DuckDB query builder ──────────────────────────────────────────────────────
async function SC_queryBins(col, gFilters, extraWheres = [], start, end, step) {
  const conn = window.LD_getConn ? window.LD_getConn() : null;
  if (!conn || !col) return [];

  const params = window.SP_getParams ? window.SP_getParams() : {};
  const src    = window.LD_getSource ? window.LD_getSource() : 'cm_data';

  // Per-column range — fall back to shared globals for backward compat
  const s = start ?? _SC_Start;
  const e = end   ?? _SC_End;
  const t = step  ?? _SC_Step ?? 10;

  const wheres = [
    `"${col}" >= ${s} AND "${col}" <= ${e}`,
    ...extraWheres,
  ];

  // Amount filter
  if (gFilters?.amt) {
    const amtCol   = SC_getCSValue('SCAmountColCS');
    const opStart  = document.getElementById('SCAmountOpStart')?.value  || '>=';
    const valStart = document.getElementById('SCAmountValStart')?.value;
    const opEnd    = document.getElementById('SCAmountOpEnd')?.value    || '<=';
    const valEnd   = document.getElementById('SCAmountValEnd')?.value;
    if (amtCol && valStart) wheres.push(`"${amtCol}" ${opStart} ${valStart}`);
    if (amtCol && valEnd)   wheres.push(`"${amtCol}" ${opEnd} ${valEnd}`);
  }

  // Param card filters
  Object.entries(gFilters?.params || {}).forEach(([key, active]) => {
    if (!active) return;
    let pCol, vals;
    if (key === 'dm') {
      pCol = params.decisionMode?.col;
      const navVals = SC_getNavActiveVals('dm');
      vals = navVals !== null ? navVals :
        [...(params.decisionMode?.assigned?.successful || []), ...(params.decisionMode?.assigned?.unsuccessful || [])];
    } else if (key.startsWith('custom_')) {
      const card = (params.customCards || [])[parseInt(key.split('_')[1])];
      pCol = card?.col;
      const navVals = SC_getNavActiveVals(key);
      vals = navVals !== null ? navVals : [...(card?.assigned?.a || []), ...(card?.assigned?.b || [])];
    }
    if (pCol && vals?.length) {
      wheres.push(`"${pCol}" IN (${vals.map(v => `'${v.replace(/'/g, "''")}'`).join(',')})`);
    }
  });

  // Fraud expression — uses col1 + values from Set Parameters
  let fraudExpr = '0';
  if (params.col1 && params.values?.length) {
    const fVals = params.values.map(v => `'${v.replace(/'/g, "''")}'`).join(',');
    fraudExpr = `CASE WHEN "${params.col1}" IN (${fVals}) THEN 1 ELSE 0 END`;
  }

  const amtCol  = SC_getCSValue('SCAmountColCS');
  const amtExpr = amtCol ? `CAST("${amtCol}" AS DOUBLE)` : '0';

  const sql = `
    WITH binned AS (
      SELECT
        FLOOR("${col}" / ${t}) * ${t} AS bin_start,
        ${fraudExpr} AS is_fraud,
        ${amtExpr}   AS amt_val
      FROM ${src}
      WHERE ${wheres.join(' AND ')}
    )
    SELECT
      bin_start,
      COUNT(*)                                  AS total,
      SUM(is_fraud)                             AS fraud,
      SUM(is_fraud)*100.0 / NULLIF(COUNT(*),0)  AS rate,
      SUM(amt_val)                              AS value_total,
      SUM(is_fraud * amt_val)                   AS value_fraud
    FROM binned
    GROUP BY bin_start
    ORDER BY bin_start
  `;

  const rows = (await conn.query(sql)).toArray();
  return rows.map(r => ({
    bin:         Number(r.bin_start),
    label:       `${Number(r.bin_start).toFixed(0)}–${(Number(r.bin_start) + t).toFixed(0)}`,
    total:       Number(r.total),
    fraud:       Number(r.fraud),
    rate:        Number(r.rate  || 0),
    value_total: Number(r.value_total || 0),
    value_fraud: Number(r.value_fraud || 0),
  }));
}

// ── Normalised query — bins in 0–100% space so all scores share the same axis ─
async function SC_queryBinsNormalised(col, gFilters, extraWheres = [], start, end, normStep = 10) {
  const conn = window.LD_getConn ? window.LD_getConn() : null;
  if (!conn || !col) return [];

  const params = window.SP_getParams ? window.SP_getParams() : {};
  const src    = window.LD_getSource ? window.LD_getSource() : 'cm_data';
  const s = start ?? _SC_Start;
  const e = end   ?? _SC_End;

  const wheres = [`"${col}" >= ${s} AND "${col}" <= ${e}`, ...extraWheres];

  if (gFilters?.amt) {
    const amtCol   = SC_getCSValue('SCAmountColCS');
    const opStart  = document.getElementById('SCAmountOpStart')?.value  || '>=';
    const valStart = document.getElementById('SCAmountValStart')?.value;
    const opEnd    = document.getElementById('SCAmountOpEnd')?.value    || '<=';
    const valEnd   = document.getElementById('SCAmountValEnd')?.value;
    if (amtCol && valStart) wheres.push(`"${amtCol}" ${opStart} ${valStart}`);
    if (amtCol && valEnd)   wheres.push(`"${amtCol}" ${opEnd} ${valEnd}`);
  }

  Object.entries(gFilters?.params || {}).forEach(([key, active]) => {
    if (!active) return;
    let pCol, vals;
    if (key === 'dm') {
      pCol = params.decisionMode?.col;
      const navVals = SC_getNavActiveVals('dm');
      vals = navVals !== null ? navVals :
        [...(params.decisionMode?.assigned?.successful || []), ...(params.decisionMode?.assigned?.unsuccessful || [])];
    } else if (key.startsWith('custom_')) {
      const card = (params.customCards || [])[parseInt(key.split('_')[1])];
      pCol = card?.col;
      const navVals = SC_getNavActiveVals(key);
      vals = navVals !== null ? navVals : [...(card?.assigned?.a || []), ...(card?.assigned?.b || [])];
    }
    if (pCol && vals?.length) {
      wheres.push(`"${pCol}" IN (${vals.map(v => `'${v.replace(/'/g, "''")}'`).join(',')})`);
    }
  });

  let fraudExpr = '0';
  if (params.col1 && params.values?.length) {
    const fVals = params.values.map(v => `'${v.replace(/'/g, "''")}'`).join(',');
    fraudExpr = `CASE WHEN "${params.col1}" IN (${fVals}) THEN 1 ELSE 0 END`;
  }
  const amtCol  = SC_getCSValue('SCAmountColCS');
  const amtExpr = amtCol ? `CAST("${amtCol}" AS DOUBLE)` : '0';

  const sql = `
    WITH binned AS (
      SELECT
        FLOOR(("${col}" - ${s}) / NULLIF(${e} - ${s}, 0) * 100.0 / ${normStep}) * ${normStep} AS bin_start,
        ${fraudExpr} AS is_fraud,
        ${amtExpr}   AS amt_val
      FROM ${src}
      WHERE ${wheres.join(' AND ')}
    )
    SELECT
      bin_start,
      COUNT(*)                                  AS total,
      SUM(is_fraud)                             AS fraud,
      SUM(is_fraud)*100.0 / NULLIF(COUNT(*),0)  AS rate,
      SUM(amt_val)                              AS value_total,
      SUM(is_fraud * amt_val)                   AS value_fraud
    FROM binned
    GROUP BY bin_start
    ORDER BY bin_start
  `;

  const rows = (await conn.query(sql)).toArray();
  return rows.map(r => ({
    bin:         Number(r.bin_start),
    label:       `${Number(r.bin_start).toFixed(0)}–${(Number(r.bin_start) + normStep).toFixed(0)}%`,
    total:       Number(r.total),
    fraud:       Number(r.fraud),
    rate:        Number(r.rate  || 0),
    value_total: Number(r.value_total || 0),
    value_fraud: Number(r.value_fraud || 0),
  }));
}

// ── Query all active scores in parallel ───────────────────────────────────────
async function SC_queryAllBins(gFilters, extraWheresPerCol = {}) {
  const useNorm = !!window._SC_NormMode;
  const normStep = 10;
  const results = await Promise.all(
    _SC_ScoreCols.map(s => useNorm
      ? SC_queryBinsNormalised(s.col, gFilters, extraWheresPerCol[s.col] || [], s.start, s.end, normStep)
      : SC_queryBins(s.col, gFilters, extraWheresPerCol[s.col] || [], s.start, s.end, s.step ?? 10)
    )
  );
  const map = {};
  _SC_ScoreCols.forEach((s, i) => { map[s.col] = results[i]; });
  return map;
}

// ── Calculate transform ───────────────────────────────────────────────────────
function SC_applyCalc(arr, totArr) {
  const c = _SC_Calc;
  if (c === 'Count')        return arr;
  if (c === 'FraudRate')    return arr.map((v, i) => totArr[i] > 0 ? v / totArr[i] * 100 : 0);
  if (c === 'Cumulative') {
    let cum = 0;
    const s = arr.reduce((a, b) => a + b, 0);
    return arr.map(v => { cum += v; return s > 0 ? cum / s * 100 : 0; });
  }
  if (c === 'Distribution') {
    const s = arr.reduce((a, b) => a + b, 0);
    return arr.map(v => s > 0 ? v / s * 100 : 0);
  }
  if (c === 'FalsePositive') return arr.map((v, i) => v > 0 ? totArr[i] / v : 0);
  return arr;
}

// ── Bin → chart-ready data ────────────────────────────────────────────────────
function SC_getBinsData(bins) {
  const useValue = _SC_Criteria === 'Value';
  const totRaw   = bins.map(b => useValue ? b.value_total : b.total);
  const frdRaw   = bins.map(b => useValue ? b.value_fraud : b.fraud);
  return {
    labels:    bins.map(b => b.label),
    totalVals: totRaw,
    fraudVals: SC_applyCalc(frdRaw, totRaw),
    sumT:      totRaw.reduce((a, b) => a + b, 0),
    sumF:      frdRaw.reduce((a, b) => a + b, 0),
  };
}

// ── G002 bin-level post-filters (applied per score after query) ───────────────
function SC_applyG002Filters(bins) {
  const g   = id => document.getElementById(id)?.value || '';
  const gCS = id => SC_getCSValue(id);
  const filters = [0, 1, 2].map(i => {
    const col = gCS(`SCG002_FilterColCS${i}`);
    const op  = gCS(`SCG002_FilterOpCS${i}`) || '>';
    const val = parseFloat(g(`SCG002_FilterVal${i}`));
    return col && !isNaN(val) ? { col, op, val, conn: _SC_FilterConns[i - 1] || 'AND' } : null;
  }).filter(Boolean);
  if (!filters.length) return bins;

  const applyOp = (v, op, t) =>
    op === '>'  ? v > t  : op === '>=' ? v >= t :
    op === '<'  ? v < t  : op === '<=' ? v <= t : v === t;

  return bins.filter(b => {
    const results = filters.map(f => applyOp(b[f.col] ?? 0, f.op, f.val));
    return results.reduce((acc, res, i) =>
      i === 0 ? res : filters[i].conn === 'OR' ? acc || res : acc && res
    );
  });
}
