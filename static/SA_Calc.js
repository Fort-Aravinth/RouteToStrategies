// ── SA_Calc — Score Analysis calculation layer ────────────────────────────────
// Pure functions + DuckDB query builder.
// Reads state from ScoreAnalysis.js globals: _SA_ScoreCol, _SA_Start, _SA_End,
// _SA_Step, _SA_Calc, _SA_Criteria.

// ── DuckDB query builder ──────────────────────────────────────────────────────
async function SA_queryBins(gFilters, extraWheres = []) {
  const conn = window.LD_getConn ? window.LD_getConn() : null;
  if (!conn || !_SA_ScoreCol) return [];

  const params = window.SP_getParams ? window.SP_getParams() : {};
  const src    = window.LD_getSource ? window.LD_getSource() : 'cm_data';

  const wheres = [
    `"${_SA_ScoreCol}" >= ${_SA_Start} AND "${_SA_ScoreCol}" <= ${_SA_End}`,
    ...extraWheres,
  ];

  // Amount filter (per-graph toggle)
  if (gFilters?.amt) {
    const amtCol   = document.getElementById('SAAmountCol')?.value;
    const opStart  = document.getElementById('SAAmountOpStart')?.value  || '>=';
    const valStart = document.getElementById('SAAmountValStart')?.value;
    const opEnd    = document.getElementById('SAAmountOpEnd')?.value    || '<=';
    const valEnd   = document.getElementById('SAAmountValEnd')?.value;
    if (amtCol && valStart) wheres.push(`"${amtCol}" ${opStart} ${valStart}`);
    if (amtCol && valEnd)   wheres.push(`"${amtCol}" ${opEnd} ${valEnd}`);
  }

  // Param card filters (per-graph toggle) — reads live nav button selection
  Object.entries(gFilters?.params || {}).forEach(([key, active]) => {
    if (!active) return;
    let col, vals;
    if (key === 'dm') {
      col = params.decisionMode?.col;
      const navVals = SA_getNavActiveVals('dm');
      vals = navVals !== null ? navVals :
        [...(params.decisionMode?.assigned?.successful || []), ...(params.decisionMode?.assigned?.unsuccessful || [])];
    } else if (key.startsWith('custom_')) {
      const card = (params.customCards || [])[parseInt(key.split('_')[1])];
      col = card?.col;
      const navVals = SA_getNavActiveVals(key);
      vals = navVals !== null ? navVals : [...(card?.assigned?.a || []), ...(card?.assigned?.b || [])];
    }
    if (col && vals?.length) {
      wheres.push(`"${col}" IN (${vals.map(v => `'${v.replace(/'/g, "''")}'`).join(',')})`);
    }
  });

  // Fraud expression — uses col1 + values from Set Parameters
  let fraudExpr = '0';
  if (params.col1 && params.values?.length) {
    const fVals = params.values.map(v => `'${v.replace(/'/g, "''")}'`).join(',');
    fraudExpr = `CASE WHEN "${params.col1}" IN (${fVals}) THEN 1 ELSE 0 END`;
  }

  const amtCol  = document.getElementById('SAAmountCol')?.value;
  const amtExpr = amtCol ? `CAST("${amtCol}" AS DOUBLE)` : '0';

  const sql = `
    WITH binned AS (
      SELECT
        FLOOR("${_SA_ScoreCol}" / ${_SA_Step}) * ${_SA_Step} AS bin_start,
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
    label:       `${Number(r.bin_start).toFixed(0)}–${(Number(r.bin_start) + _SA_Step).toFixed(0)}`,
    total:       Number(r.total),
    fraud:       Number(r.fraud),
    rate:        Number(r.rate  || 0),
    value_total: Number(r.value_total || 0),
    value_fraud: Number(r.value_fraud || 0),
  }));
}

// ── Calculate transform ───────────────────────────────────────────────────────
// arr = series values, totArr = total values (used as denominator for some modes)
function SA_applyCalc(arr, totArr) {
  const c = _SA_Calc;
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
// Total series always shows raw counts/values — only Fraud series gets the
// calc transform (FraudRate, Cumulative, etc. are fraud-relative metrics).
function SA_getBinsData(bins) {
  const useValue = _SA_Criteria === 'Value';
  const totRaw   = bins.map(b => useValue ? b.value_total : b.total);
  const frdRaw   = bins.map(b => useValue ? b.value_fraud : b.fraud);
  return {
    labels:    bins.map(b => b.label),
    totalVals: totRaw,
    fraudVals: SA_applyCalc(frdRaw, totRaw),
    sumT:      totRaw.reduce((a, b) => a + b, 0),
    sumF:      frdRaw.reduce((a, b) => a + b, 0),
  };
}

// ── G002 bin-level post-filters ───────────────────────────────────────────────
function SA_applyG002Filters(bins) {
  const g   = id => document.getElementById(id)?.value || '';
  const gCS = id => SA_getCSValue(id);
  const filters = [0, 1, 2].map(i => {
    const col = gCS(`SAG002_FilterColCS${i}`);
    const op  = gCS(`SAG002_FilterOpCS${i}`) || '>';
    const val = parseFloat(g(`SAG002_FilterVal${i}`));
    return col && !isNaN(val) ? { col, op, val, conn: _SA_FilterConns[i - 1] || 'AND' } : null;
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
