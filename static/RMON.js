// ── Import Rules to Strategies (RMON) ────────────────────────────────────────

// ── State ─────────────────────────────────────────────────────────────────────
const _RMON_JsonStore    = {};  // { id: strategyObj }
const _RMON_ActiveChips  = [];  // ordered list of active IDs
let   _RMON_MatchResults = [];  // last run results

// ── Open ──────────────────────────────────────────────────────────────────────
function RMON_OpenJsonImport() {
  App_HideAllViews();
  Sidebar_SetActive('nav-rmon-import');
  document.getElementById('RMONView').style.setProperty('display', 'flex', 'important');
  RMON_RenderChips();
  RMON_RenderTable();
}

// ── Persist — called by APP_LikeIt and SA Copy ───────────────────────────────
function _RMON_Persist(obj) {
  if (!obj?.ID) return;
  _RMON_JsonStore[obj.ID] = obj;
  if (!_RMON_ActiveChips.includes(obj.ID)) _RMON_ActiveChips.push(obj.ID);
  RMON_RenderChips();
  RMON_RenderTable();
}

// ── Chip toggle ───────────────────────────────────────────────────────────────
function RMON_LoadChip(id) {
  const idx = _RMON_ActiveChips.indexOf(id);
  if (idx !== -1) _RMON_ActiveChips.splice(idx, 1);
  else _RMON_ActiveChips.push(id);
  RMON_RenderChips();
  RMON_RenderTable();
}

function RMON_RemoveChip(id, e) {
  e?.stopPropagation();
  const ai = _RMON_ActiveChips.indexOf(id);
  if (ai !== -1) _RMON_ActiveChips.splice(ai, 1);
  delete _RMON_JsonStore[id];
  RMON_RenderChips();
  RMON_RenderTable();
}

function RMON_ClearAll() {
  Object.keys(_RMON_JsonStore).forEach(k => delete _RMON_JsonStore[k]);
  _RMON_ActiveChips.length = 0;
  RMON_RenderChips();
  RMON_RenderTable();
}

// ── Download JSON ─────────────────────────────────────────────────────────────
function RMON_DownloadJson() {
  const ids = Object.keys(_RMON_JsonStore);
  if (!ids.length) { alert('No strategies to download.'); return; }
  const data = ids.map(id => _RMON_JsonStore[id]);
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a    = document.createElement('a');
  a.href     = URL.createObjectURL(blob);
  a.download = `strategies_${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

// ── Render chips ──────────────────────────────────────────────────────────────
function RMON_RenderChips() {
  const wrap = document.getElementById('RMON_Chips');
  if (!wrap) return;
  const ids = Object.keys(_RMON_JsonStore);
  if (!ids.length) {
    wrap.className = '';
    wrap.innerHTML = '<span style="font-size:0.7rem;color:var(--color-text-dim);">No strategies loaded yet — use 👍 Like it from any analysis.</span>';
    return;
  }
  wrap.className = 'pg-chip-row';
  wrap.innerHTML = ids.map((id, i) => {
    const obj      = _RMON_JsonStore[id];
    const isActive = _RMON_ActiveChips.includes(id);
    const src      = (obj.Source || 'Unknown').replace('Score Analysis', 'SA');
    const label    = `${src} · #${i + 1}`;
    return `<button class="pg-chip${isActive ? ' active' : ''}" onclick="RMON_LoadChip('${id}')">${label}</button>
            <button class="pg-chip" onclick="RMON_RemoveChip('${id}',event)" style="padding:0 7px;opacity:0.5;">✕</button>`;
  }).join('');
}

// ── Render comparison table (strategies = rows, fields = columns) ─────────────
function RMON_RenderTable() {
  const wrap = document.getElementById('RMON_TableWrap');
  if (!wrap) return;
  if (!_RMON_ActiveChips.length) {
    wrap.innerHTML = '<div style="padding:32px;text-align:center;color:var(--color-text-dim);font-size:0.78rem;">Select strategies above to compare.</div>';
    return;
  }

  const strats = _RMON_ActiveChips.map(id => _RMON_JsonStore[id]).filter(Boolean);

  // ScoreInformation can be a single object (SA/RA) or an array (SC multi-score)
  const getSIs   = s => Array.isArray(s.ScoreInformation) ? s.ScoreInformation : [s.ScoreInformation].filter(Boolean);
  const fmtScore = arr => arr?.length ? arr.map(c => `${c.OperatorDescription} ${c.ScoreValue}`).join(' · ') : '—';
  const fmtAmt   = arr => arr?.length ? arr.map(c => `${c.OperatorDescription} ${c.AmountValue}`).join(' · ') : '—';
  const fmtAddCol = (cols, colName) => {
    const col = cols?.find(c => c.Column === colName);
    if (!col) return '—';
    if (col.Values?.length) return col.Values.join(', ');
    if (col.Operator !== undefined) return `${col.Operator} ${col.Value}`;
    return '—';
  };

  // Collect all unique score metric names across all strategies (preserves order)
  const scoreMetrics = [];
  strats.forEach(s => getSIs(s).forEach(si => {
    if (si?.ScoreMetric && !scoreMetrics.includes(si.ScoreMetric)) scoreMetrics.push(si.ScoreMetric);
  }));
  if (!scoreMetrics.length) scoreMetrics.push('Score');

  const amtMetric   = strats[0]?.AmountInformation?.AmountMetric || 'Amount';
  const addColNames = [];
  strats.forEach(s => (s.AdditionalColumns || []).forEach(c => {
    if (!addColNames.includes(c.Column)) addColNames.push(c.Column);
  }));

  const scoreHeaders = scoreMetrics.map(m => `<th onclick="PG_toggleTableCol(this)">${m}</th>`).join('');
  const addHeaders   = addColNames.map(n => `<th onclick="PG_toggleTableCol(this)">${n}</th>`).join('');

  let html = `<div class="pg-table-wrap"><table class="pg-table">
    <thead>
      <tr>
        <th onclick="PG_toggleTableCol(this)"></th>
        ${scoreHeaders}
        <th onclick="PG_toggleTableCol(this)">${amtMetric}</th>
        ${addHeaders}
      </tr>
    </thead>
    <tbody>`;

  strats.forEach((s, i) => {
    const siMap     = Object.fromEntries(getSIs(s).map(si => [si.ScoreMetric, si]));
    const amtActive = s.AmountInformation?.FilterByAmount;
    const scoreCells = scoreMetrics.map(m => `<td>${fmtScore(siMap[m]?.Conditions)}</td>`).join('');
    const addCells   = addColNames.map(n => `<td>${fmtAddCol(s.AdditionalColumns, n)}</td>`).join('');
    html += `<tr>
      <td class="rmon-label">${s.Source || 'Strategy'} · #${i + 1}</td>
      ${scoreCells}
      <td>${amtActive ? fmtAmt(s.AmountInformation?.Conditions) : '—'}</td>
      ${addCells}
    </tr>`;
  });

  html += `</tbody></table></div>`;
  wrap.innerHTML = html;
}

// ── Build SQL WHERE clause from strategy JSON ─────────────────────────────────
function RMON_BuildWhereClause(s) {
  const parts = [];

  const sis = Array.isArray(s.ScoreInformation) ? s.ScoreInformation : [s.ScoreInformation].filter(Boolean);
  sis.forEach(si => {
    if (si?.FilterByScore !== false && si?.Conditions?.length) {
      si.Conditions.forEach(c => parts.push(`"${si.ScoreMetric}" ${c.OperatorDescription} ${c.ScoreValue}`));
    }
  });

  const ai = s.AmountInformation;
  if (ai?.FilterByAmount && ai.Conditions?.length) {
    ai.Conditions.forEach(c => parts.push(`"${ai.AmountMetric}" ${c.OperatorDescription} ${c.AmountValue}`));
  }

  (s.AdditionalColumns || []).forEach(col => {
    if (col.Values?.length) {
      const vals = col.Values.map(v => `'${String(v).replace(/'/g, "''")}'`).join(', ');
      parts.push(`"${col.Column}" IN (${vals})`);
    } else if (col.Operator && col.Value !== undefined) {
      parts.push(`"${col.Column}" ${col.Operator} ${col.Value}`);
    }
  });

  return parts.length ? parts.join(' AND ') : '1=1';
}

// ── Run Match ─────────────────────────────────────────────────────────────────
async function RMON_RunMatch() {
  const conn = window.LD_getConn?.();
  const src  = window.LD_getSource?.();
  if (!conn || !src) { alert('No data loaded.'); return; }

  const params    = window.SP_getParams?.() || {};
  const fraudCol  = params.col1 || '';
  const fraudVals = Array.isArray(params.values) ? params.values : [];
  if (!fraudCol) { alert('Apply parameters first.'); return; }

  const strats = _RMON_ActiveChips.map(id => _RMON_JsonStore[id]).filter(Boolean);
  if (!strats.length) { alert('No strategies selected.'); return; }

  const btn = document.getElementById('RMON_RunBtn');
  if (btn) { btn.textContent = 'Running…'; btn.disabled = true; }

  const fVals     = fraudVals.map(v => `'${String(v).replace(/'/g, "''")}'`).join(', ');
  const fraudExpr = fVals.length
    ? `SUM(CASE WHEN "${fraudCol}" IN (${fVals}) THEN 1 ELSE 0 END)`
    : `0`;

  _RMON_MatchResults = [];
  const wfExcl = [];

  try {
    for (let i = 0; i < strats.length; i++) {
      const s     = strats[i];
      const where = RMON_BuildWhereClause(s);

      // All-transactions match
      const allRow = (await conn.query(
        `SELECT COUNT(*) AS total, ${fraudExpr} AS fraud FROM "${src}" WHERE ${where}`
      )).toArray()[0];
      const total = Number(allRow?.total ?? 0);
      const fraud = Number(allRow?.fraud ?? 0);

      // Waterfall match — exclude rows already caught by earlier strategies
      let wfTotal = total, wfFraud = fraud;
      if (wfExcl.length) {
        const exclude = wfExcl.map(w => `(${w})`).join(' OR ');
        const wfRow = (await conn.query(
          `SELECT COUNT(*) AS total, ${fraudExpr} AS fraud FROM "${src}" WHERE (${where}) AND NOT (${exclude})`
        )).toArray()[0];
        wfTotal = Number(wfRow?.total ?? 0);
        wfFraud = Number(wfRow?.fraud ?? 0);
      }

      wfExcl.push(where);
      _RMON_MatchResults.push({
        id: s.ID, label: `${s.Source || 'Strategy'} · #${i + 1}`,
        total, fraud,
        wfTotal, wfFraud,
      });
    }
  } catch(e) {
    alert(`Query error: ${e.message}`);
  }

  RMON_BuildResultsTable();
  if (btn) { btn.textContent = 'Run Match'; btn.disabled = false; }
}

// ── Results table ─────────────────────────────────────────────────────────────
function RMON_BuildResultsTable() {
  const wrap = document.getElementById('RMON_ResultsWrap');
  const card = document.getElementById('RMON_ResultsCard');
  if (!wrap) return;
  if (!_RMON_MatchResults.length) { wrap.innerHTML = ''; if (card) card.style.display = 'none'; return; }
  if (card) card.style.display = '';

  const fmt = n => n >= 1e6 ? (n/1e6).toFixed(1)+'M' : n >= 1e3 ? (n/1e3).toFixed(1)+'K' : n.toLocaleString();
  const pct = (a, b) => b > 0 ? ((a / b) * 100).toFixed(1) + '%' : '—';
  const fp  = (total, fraud) => pct(total - fraud, total);

  const totTotal = _RMON_MatchResults.reduce((a, r) => a + r.total,   0);
  const totFraud = _RMON_MatchResults.reduce((a, r) => a + r.fraud,   0);
  const totWFT   = _RMON_MatchResults.reduce((a, r) => a + r.wfTotal, 0);
  const totWFF   = _RMON_MatchResults.reduce((a, r) => a + r.wfFraud, 0);

  let rows = _RMON_MatchResults.map(r => `
    <tr>
      <td class="rmon-label">${r.label}</td>
      <td class="rmon-num">${fmt(r.total)}</td>
      <td class="rmon-num">${fmt(r.fraud)}</td>
      <td class="rmon-fp">${fp(r.total, r.fraud)}</td>
      <td class="rmon-num">${fmt(r.wfTotal)}</td>
      <td class="rmon-num">${fmt(r.wfFraud)}</td>
      <td class="rmon-fp">${fp(r.wfTotal, r.wfFraud)}</td>
    </tr>`).join('');

  rows += `<tr class="rmon-total">
    <td class="rmon-label">Total</td>
    <td class="rmon-num">${fmt(totTotal)}</td>
    <td class="rmon-num">${fmt(totFraud)}</td>
    <td class="rmon-fp">${fp(totTotal, totFraud)}</td>
    <td class="rmon-num">${fmt(totWFT)}</td>
    <td class="rmon-num">${fmt(totWFF)}</td>
    <td class="rmon-fp">${fp(totWFT, totWFF)}</td>
  </tr>`;

  wrap.innerHTML = `<div class="pg-table-wrap"><table class="pg-table">
    <thead><tr>
      <th onclick="PG_toggleTableCol(this)">Strategy</th>
      <th onclick="PG_toggleTableCol(this)" class="rmon-th-r">Matches</th>
      <th onclick="PG_toggleTableCol(this)" class="rmon-th-r">Fraud</th>
      <th onclick="PG_toggleTableCol(this)" class="rmon-th-r">F/P %</th>
      <th onclick="PG_toggleTableCol(this)" class="rmon-th-r">WF Matches</th>
      <th onclick="PG_toggleTableCol(this)" class="rmon-th-r">WF Fraud</th>
      <th onclick="PG_toggleTableCol(this)" class="rmon-th-r">WF F/P %</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table></div>`;
}
