// ── Nav_PopupTable ────────────────────────────────────────────────────────────

// ── Amount Analysis Popup (Score Analysis) ────────────────────────────────────
let _SA_AmtPopupChart = null;
let _SA_AmtPopupBins  = null;
let _SA_AmtPopupStep  = 100;
let _SA_AmtPopupCol   = '';
let _SA_AmtPopupType  = 'bar';
let _SA_AmtPopupCrit  = 'Volume';
let _SA_AmtPopupCalc  = 'Count';

async function SA_RunAmountAnalysis() {
  const amtCol = document.getElementById('SAAmountCol')?.value;
  if (!amtCol) { alert('Select an Amount column first.'); return; }
  const conn = window.LD_getConn ? window.LD_getConn() : null;
  if (!conn)   { alert('No data loaded.'); return; }

  const src      = window.LD_getSource ? window.LD_getSource() : 'cm_data';
  const params   = window.SP_getParams ? window.SP_getParams() : {};
  const step     = parseFloat(document.getElementById('SAAmountStep')?.value) || 100;
  const valStart = document.getElementById('SAAmountValStart')?.value;
  const opStart  = document.getElementById('SAAmountOpStart')?.value  || '>=';
  const valEnd   = document.getElementById('SAAmountValEnd')?.value;
  const opEnd    = document.getElementById('SAAmountOpEnd')?.value    || '<=';

  _SA_AmtPopupCol  = amtCol;
  _SA_AmtPopupStep = step;

  let fraudExpr = '0';
  if (params.col1 && params.values?.length) {
    const vals = params.values.map(v => `'${v.replace(/'/g,"''")}'`).join(',');
    fraudExpr = `CASE WHEN "${params.col1}" IN (${vals}) THEN 1 ELSE 0 END`;
  }

  const wheres = [];
  if (valStart) wheres.push(`"${amtCol}" ${opStart} ${valStart}`);
  if (valEnd)   wheres.push(`"${amtCol}" ${opEnd} ${valEnd}`);
  const whereClause = wheres.length ? `WHERE ${wheres.join(' AND ')}` : '';
  const minVal = parseFloat(valStart) || 0;

  const sql = `
    WITH binned AS (
      SELECT
        FLOOR(("${amtCol}" - ${minVal}) / ${step}) * ${step} + ${minVal} AS bin_start,
        CAST("${amtCol}" AS DOUBLE) AS amt_val,
        ${fraudExpr} AS is_fraud
      FROM ${src} ${whereClause}
    )
    SELECT bin_start,
      COUNT(*)             AS total,
      SUM(is_fraud)        AS fraud,
      SUM(amt_val)         AS value_total,
      SUM(is_fraud*amt_val) AS value_fraud
    FROM binned GROUP BY bin_start ORDER BY bin_start`;

  try {
    const rows = (await conn.query(sql)).toArray().map(r => ({
      bin_start:   Number(r.bin_start),
      total:       Number(r.total),
      fraud:       Number(r.fraud),
      value_total: Number(r.value_total || 0),
      value_fraud: Number(r.value_fraud || 0),
    }));
    _SA_AmtPopupBins = rows;
    document.getElementById('SA_AmtPopupTitle').textContent =
      `Amount Analysis — ${amtCol} (${valStart||0} → ${valEnd||'max'}, step ${step})`;
    document.getElementById('SA_AmtPopup').style.display = 'flex';
    SA_AmtPopupRender();
  } catch(e) { alert('Amount Analysis error: ' + e.message); }
}

function SA_AmtPopupRender() {
  if (!_SA_AmtPopupBins) return;
  const rows = _SA_AmtPopupBins;
  const step = _SA_AmtPopupStep;
  const crit = _SA_AmtPopupCrit;
  const calc = _SA_AmtPopupCalc;

  const labels = rows.map(r => `${r.bin_start}–${r.bin_start + step}`);
  const totRaw = rows.map(r => crit === 'Value' ? r.value_total : r.total);
  const frdRaw = rows.map(r => crit === 'Value' ? r.value_fraud : r.fraud);
  const sumT   = totRaw.reduce((a,b) => a+b, 0);
  const sumF   = frdRaw.reduce((a,b) => a+b, 0);

  const applyCalc = (arr, totArr) => {
    if (calc === 'Count')          return arr;
    if (calc === 'FraudRate')      return arr.map((v,i) => totArr[i] > 0 ? v/totArr[i]*100 : 0);
    if (calc === 'Cumulative')     { let c=0, s=arr.reduce((a,b)=>a+b,0); return arr.map(v=>{c+=v;return s>0?c/s*100:0;}); }
    if (calc === 'Distribution')   { const s=arr.reduce((a,b)=>a+b,0); return arr.map(v=>s>0?v/s*100:0); }
    if (calc === 'FalsePositive')  return arr.map((v,i) => v>0 ? totArr[i]/v : 0);
    return arr;
  };

  const totalVals = applyCalc(totRaw, totRaw);
  const fraudVals = applyCalc(frdRaw, totRaw);

  const TC = 'rgba(123,104,200,', FC = 'rgba(239,68,68,';
  const chartType = _SA_AmtPopupType === 'area' ? 'line' : _SA_AmtPopupType;
  const isArea = _SA_AmtPopupType === 'area';

  const canvas = document.getElementById('SA_AmtPopupCanvas');
  canvas.width  = canvas.parentElement.offsetWidth  || 800;
  canvas.height = canvas.parentElement.offsetHeight || 380;
  if (_SA_AmtPopupChart) { _SA_AmtPopupChart.destroy(); _SA_AmtPopupChart = null; }

  _SA_AmtPopupChart = new Chart(canvas.getContext('2d'), {
    type: chartType,
    data: {
      labels,
      datasets: [
        { label: `Total (${crit} ${calc})`, data: totalVals,
          backgroundColor: TC+(isArea?'0.15)':'0.7)'), borderColor: TC+'1)',
          fill: isArea, tension: 0.4 },
        { label: 'Fraud', data: fraudVals,
          backgroundColor: FC+(isArea?'0.15)':'0.8)'), borderColor: FC+'1)',
          fill: isArea, tension: 0.4 },
      ]
    },
    options: {
      responsive: false, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { x: { ticks: { maxRotation: 45 } }, y: { beginAtZero: true } }
    }
  });

  const fmt = n => Number.isInteger(n) ? n.toLocaleString() : n.toLocaleString(undefined, {maximumFractionDigits:2});
  const totalsEl = document.getElementById('SA_AmtPopupTotals');
  if (totalsEl) {
    totalsEl.classList.add('visible');
    totalsEl.innerHTML =
      `<span style="color:var(--color-text-dim);font-size:0.65rem;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;align-self:center;">Total</span>` +
      `<span style="color:rgba(123,104,200,1);font-weight:700;">${fmt(sumT)}</span>` +
      `<span style="color:var(--color-text-dim);font-size:0.65rem;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;align-self:center;margin-left:6px;">Fraud</span>` +
      `<span style="color:rgba(239,68,68,1);font-weight:700;">${fmt(sumF)}</span>`;
  }

  document.getElementById('SA_AmtPopupTitle').textContent =
    `Amount Analysis — ${_SA_AmtPopupCol} (step ${step}) · ${crit} ${calc}`;
}

function SA_AmtPopupSetType(type) {
  _SA_AmtPopupType = type;
  document.querySelectorAll('[id^="SA_AmtPopupType_"]').forEach(b => b.classList.remove('active'));
  document.getElementById(`SA_AmtPopupType_${type}`)?.classList.add('active');
  SA_AmtPopupRender();
}
function SA_AmtPopupSetCrit(crit) {
  _SA_AmtPopupCrit = crit;
  document.querySelectorAll('[id^="SA_AmtPopupCrit_"]').forEach(b => b.classList.remove('active'));
  document.getElementById(`SA_AmtPopupCrit_${crit}`)?.classList.add('active');
  SA_AmtPopupRender();
}
function SA_AmtPopupSetCalc(calc) {
  _SA_AmtPopupCalc = calc;
  document.querySelectorAll('[id^="SA_AmtPopupCalc_"]').forEach(b => b.classList.remove('active'));
  document.getElementById(`SA_AmtPopupCalc_${calc}`)?.classList.add('active');
  SA_AmtPopupRender();
}
function SA_AmtPopupClose() {
  document.getElementById('SA_AmtPopup').style.display = 'none';
  if (_SA_AmtPopupChart) { _SA_AmtPopupChart.destroy(); _SA_AmtPopupChart = null; }
}

// ── Column Analysis Popup (Score Analysis) ────────────────────────────────────
let _SA_ColPopupChart = null;
let _SA_ColPopupRows  = null;
let _SA_ColPopupCol   = '';
let _SA_ColPopupAVals = [];
let _SA_ColPopupBVals = [];
let _SA_ColPopupType  = 'bar';
let _SA_ColPopupCrit  = 'Volume';
let _SA_ColPopupCalc  = 'Count';

async function SA_RunColAnalysis(col, key) {
  const conn = window.LD_getConn ? window.LD_getConn() : null;
  if (!conn) { alert('No data loaded.'); return; }

  const src    = window.LD_getSource ? window.LD_getSource() : 'cm_data';
  const params = window.SP_getParams ? window.SP_getParams() : {};

  // Resolve A/B value groups from key
  let aVals = [], bVals = [];
  if (key === 'dm') {
    aVals = params.decisionMode?.assigned?.successful   || [];
    bVals = params.decisionMode?.assigned?.unsuccessful || [];
  } else if (key.startsWith('custom_')) {
    const idx  = parseInt(key.split('_')[1], 10);
    const card = (params.customCards || [])[idx];
    aVals = card?.assigned?.a || [];
    bVals = card?.assigned?.b || [];
  }

  // Read active button selections to optionally filter rows
  const sectionEl = document.getElementById(`NAV_SA_ExtraBody_${key}`);
  const activeVals = sectionEl
    ? [...sectionEl.querySelectorAll('.MN_btn.active')].map(b => b.textContent.trim())
    : [];
  const filterVals = activeVals.filter(v => [...aVals, ...bVals].includes(v));

  // Fraud expression
  let fraudExpr = '0';
  if (params.fraudCol && params.fraudVals?.length) {
    const vals = params.fraudVals.map(v => `'${v.replace(/'/g,"''")}'`).join(',');
    fraudExpr = `CASE WHEN "${params.fraudCol}" IN (${vals}) THEN 1 ELSE 0 END`;
  }

  // Amount expression for Value criteria
  const amtCol = document.getElementById('SAAmountCol')?.value;
  const amtExpr = amtCol ? `CAST("${amtCol}" AS DOUBLE)` : '0';

  // Optional WHERE to restrict to selected values only
  const whereClause = filterVals.length
    ? `WHERE "${col}" IN (${filterVals.map(v => `'${v.replace(/'/g,"''")}'`).join(',')})`
    : '';

  const sql = `
    SELECT
      CAST("${col}" AS VARCHAR) AS grp,
      COUNT(*)                                     AS total,
      SUM(${fraudExpr})                            AS fraud,
      SUM(${amtExpr})                              AS value_total,
      SUM(${fraudExpr} * ${amtExpr})               AS value_fraud
    FROM ${src}
    ${whereClause}
    GROUP BY "${col}"
    ORDER BY total DESC
  `;

  try {
    const rows = (await conn.query(sql)).toArray().map(r => ({
      grp:         String(r.grp ?? ''),
      total:       Number(r.total),
      fraud:       Number(r.fraud),
      value_total: Number(r.value_total || 0),
      value_fraud: Number(r.value_fraud || 0),
    }));

    _SA_ColPopupRows  = rows;
    _SA_ColPopupCol   = col;
    _SA_ColPopupAVals = aVals;
    _SA_ColPopupBVals = bVals;

    document.getElementById('SA_ColPopupTitle').textContent =
      `Column Analysis — ${col}${filterVals.length ? ` (${filterVals.length} selected)` : ''}`;
    document.getElementById('SA_ColPopup').style.display = 'flex';
    SA_ColPopupRender();
  } catch(e) { alert('Column Analysis error: ' + e.message); }
}

function SA_ColPopupRender() {
  if (!_SA_ColPopupRows) return;
  const rows  = _SA_ColPopupRows;
  const crit  = _SA_ColPopupCrit;
  const calc  = _SA_ColPopupCalc;
  const aVals = _SA_ColPopupAVals;
  const bVals = _SA_ColPopupBVals;

  const labels = rows.map(r => r.grp);
  const totRaw = rows.map(r => crit === 'Value' ? r.value_total : r.total);
  const frdRaw = rows.map(r => crit === 'Value' ? r.value_fraud : r.fraud);
  const sumT   = totRaw.reduce((a, b) => a + b, 0);
  const sumF   = frdRaw.reduce((a, b) => a + b, 0);

  const applyCalc = (arr, totArr) => {
    if (calc === 'Count')         return arr;
    if (calc === 'FraudRate')     return arr.map((v, i) => totArr[i] > 0 ? v / totArr[i] * 100 : 0);
    if (calc === 'Cumulative')    { let c = 0, s = arr.reduce((a, b) => a + b, 0); return arr.map(v => { c += v; return s > 0 ? c / s * 100 : 0; }); }
    if (calc === 'Distribution')  { const s = arr.reduce((a, b) => a + b, 0); return arr.map(v => s > 0 ? v / s * 100 : 0); }
    if (calc === 'FalsePositive') return arr.map((v, i) => v > 0 ? totArr[i] / v : 0);
    return arr;
  };

  const totalVals = applyCalc(totRaw, totRaw);
  const fraudVals = applyCalc(frdRaw, totRaw);

  // Per-bar colours: A = green, B = red, other = purple
  const totalBg = labels.map(l =>
    aVals.includes(l) ? 'rgba(16,185,129,0.55)' :
    bVals.includes(l) ? 'rgba(239,68,68,0.55)'  : 'rgba(123,104,200,0.45)');
  const totalBdr = labels.map(l =>
    aVals.includes(l) ? 'rgba(16,185,129,1)'  :
    bVals.includes(l) ? 'rgba(239,68,68,1)'   : 'rgba(123,104,200,1)');
  const fraudBg  = labels.map(() => 'rgba(239,68,68,0.75)');
  const fraudBdr = labels.map(() => 'rgba(239,68,68,1)');

  const chartType = _SA_ColPopupType === 'area' ? 'line' : _SA_ColPopupType;
  const isArea    = _SA_ColPopupType === 'area';

  const canvas = document.getElementById('SA_ColPopupCanvas');
  if (!canvas) return;
  canvas.width  = canvas.parentElement.offsetWidth  || 800;
  canvas.height = canvas.parentElement.offsetHeight || 380;
  if (_SA_ColPopupChart) { _SA_ColPopupChart.destroy(); _SA_ColPopupChart = null; }

  _SA_ColPopupChart = new Chart(canvas.getContext('2d'), {
    type: chartType,
    data: {
      labels,
      datasets: [
        { label: `Total (${crit} ${calc})`, data: totalVals,
          backgroundColor: isArea ? 'rgba(123,104,200,0.15)' : totalBg,
          borderColor: totalBdr, borderWidth: 1.5, fill: isArea, tension: 0.4 },
        { label: 'Fraud', data: fraudVals,
          backgroundColor: isArea ? 'rgba(239,68,68,0.15)' : fraudBg,
          borderColor: fraudBdr, borderWidth: 1.5, fill: isArea, tension: 0.4 },
      ]
    },
    options: {
      responsive: false, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { x: { ticks: { maxRotation: 45 } }, y: { beginAtZero: true } }
    }
  });

  const fmt = n => Number.isInteger(n) ? n.toLocaleString() : n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  const totalsEl = document.getElementById('SA_ColPopupTotals');
  if (totalsEl) {
    totalsEl.classList.add('visible');
    totalsEl.innerHTML =
      `<span style="color:var(--color-text-dim);font-size:0.65rem;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;align-self:center;">Total</span>` +
      `<span style="color:rgba(123,104,200,1);font-weight:700;">${fmt(sumT)}</span>` +
      `<span style="color:var(--color-text-dim);font-size:0.65rem;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;align-self:center;margin-left:6px;">Fraud</span>` +
      `<span style="color:rgba(239,68,68,1);font-weight:700;">${fmt(sumF)}</span>` +
      `<span style="color:var(--color-text-dim);font-size:0.65rem;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;align-self:center;margin-left:6px;">${rows.length} values</span>`;
  }

  document.getElementById('SA_ColPopupTitle').textContent =
    `Column Analysis — ${_SA_ColPopupCol} · ${crit} ${calc}`;
}

function SA_ColPopupSetType(type) {
  _SA_ColPopupType = type;
  document.querySelectorAll('[id^="SA_ColPopupType_"]').forEach(b => b.classList.remove('active'));
  document.getElementById(`SA_ColPopupType_${type}`)?.classList.add('active');
  SA_ColPopupRender();
}
function SA_ColPopupSetCrit(crit) {
  _SA_ColPopupCrit = crit;
  document.querySelectorAll('[id^="SA_ColPopupCrit_"]').forEach(b => b.classList.remove('active'));
  document.getElementById(`SA_ColPopupCrit_${crit}`)?.classList.add('active');
  SA_ColPopupRender();
}
function SA_ColPopupSetCalc(calc) {
  _SA_ColPopupCalc = calc;
  document.querySelectorAll('[id^="SA_ColPopupCalc_"]').forEach(b => b.classList.remove('active'));
  document.getElementById(`SA_ColPopupCalc_${calc}`)?.classList.add('active');
  SA_ColPopupRender();
}
function SA_ColPopupClose() {
  document.getElementById('SA_ColPopup').style.display = 'none';
  if (_SA_ColPopupChart) { _SA_ColPopupChart.destroy(); _SA_ColPopupChart = null; }
}
