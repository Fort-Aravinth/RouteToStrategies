// ── Import Rules to Strategies (RMON) ────────────────────────────────────────

// ── State ─────────────────────────────────────────────────────────────────────
const _RMON_JsonStore    = {};  // { id: strategyObj }
const _RMON_ActiveChips  = [];  // ordered list of active IDs
let   _RMON_MatchResults = [];  // last run results
let   _RMON_DayCount     = 0;   // distinct days in loaded data

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

// ── Build SQL WHERE clause — base conditions, no velocity ────────────────────
function RMON_BuildWhereClause(s) {
  const esc    = v => String(v).replace(/'/g, "''");
  const escCol = c => String(c).replace(/"/g, '""');
  const parts  = [];

  // PolicyRuleInformation
  for (const cond of (s.PolicyRuleInformation?.Conditions || [])) {
    if (cond.Column && cond.Values?.length)
      parts.push(`"${escCol(cond.Column)}" IN (${cond.Values.map(v => `'${esc(v)}'`).join(', ')})`);
  }

  // ScoreInformation
  const sis = Array.isArray(s.ScoreInformation) ? s.ScoreInformation : [s.ScoreInformation].filter(Boolean);
  for (const si of sis) {
    if (si?.FilterByScore !== false && si?.Conditions?.length)
      for (const c of si.Conditions)
        parts.push(`"${escCol(si.ScoreMetric)}" ${c.OperatorDescription} ${c.ScoreValue}`);
  }

  // AmountInformation
  const ai = s.AmountInformation;
  if (ai?.FilterByAmount && ai.Conditions?.length)
    for (const c of ai.Conditions)
      parts.push(`"${escCol(ai.AmountMetric)}" ${c.OperatorDescription} ${c.AmountValue}`);

  // MerchantInformation
  const mi = s.MerchantInformation;
  if (mi?.SelectedColumn && mi.MerchantList?.length)
    parts.push(`"${escCol(mi.SelectedColumn)}" IN (${mi.MerchantList.map(v => `'${esc(v)}'`).join(', ')})`);

  // AdditionalColumns — handles Column/Values (JS) and ColumnName/Filters (Python export) formats
  for (const col of (s.AdditionalColumns || [])) {
    const colName = col.Column || col.ColumnName;
    if (!colName) continue;
    if (col.Values?.length) {
      parts.push(`"${escCol(colName)}" IN (${col.Values.map(v => `'${esc(v)}'`).join(', ')})`);
    } else if (col.Filters) {
      const vals = Object.values(col.Filters).flat().filter(Boolean);
      if (vals.length) parts.push(`"${escCol(colName)}" IN (${vals.map(v => `'${esc(v)}'`).join(', ')})`);
    } else if (col.Operator && col.Value !== undefined) {
      parts.push(`"${escCol(colName)}" ${col.Operator} ${col.Value}`);
    }
  }

  return parts.length ? parts.join(' AND ') : '1=1';
}

// ── Velocity helpers ──────────────────────────────────────────────────────────
function _rmon_hasVelocity(s) {
  return (s.RuleInformation?.Conditions || []).some(c => c.Value != null && c.Period && !c.Logic);
}

function _rmon_velParts(s) {
  const allRi = s.RuleInformation?.Conditions || [];
  const items = [];
  let pending = 'AND';
  for (const cond of allRi) {
    if (cond.Logic) { pending = cond.Logic.toUpperCase(); continue; }
    if (cond.Value != null && cond.Period && cond.CardDimension && cond.DateColumn) {
      items.push({ cond, logic: items.length === 0 ? null : pending });
      pending = 'AND';
    }
  }
  if (!items.length) return null;

  const periodFn = (cond) => {
    const dc = `"${cond.DateColumn}"`;
    switch (cond.Period) {
      case 'PerDay':   return `CAST(${dc} AS DATE)`;
      case 'PerHour':  return `DATE_TRUNC('hour', TRY_CAST(${dc} AS TIMESTAMP))`;
      case 'Per30Min': return `CAST(epoch(TRY_CAST(${dc} AS TIMESTAMP)) / 1800 AS BIGINT)`;
      case 'Per15Min': return `CAST(epoch(TRY_CAST(${dc} AS TIMESTAMP)) / 900 AS BIGINT)`;
      default:         return `CAST(${dc} AS DATE)`;
    }
  };

  const cols = items.map(({ cond }, i) =>
    `ROW_NUMBER() OVER (PARTITION BY "${cond.CardDimension}", ${periodFn(cond)} ORDER BY "${cond.SortColumn || cond.DateColumn}") AS _vel${i}`
  );

  const where = items.map(({ cond, logic }, i) => {
    const f = `_vel${i} ${cond.Operator} ${cond.Value}`;
    return i === 0 ? f : `${logic} ${f}`;
  }).join(' ');

  return { cols, where };
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
  _RMON_DayCount     = 0;

  const dateCol = params.auth_date || '';

  try {
    // Count distinct days in the dataset
    if (dateCol) {
      const dayRow = (await conn.query(`SELECT COUNT(DISTINCT CAST("${dateCol}" AS DATE)) AS days FROM "${src}"`)).toArray()[0];
      _RMON_DayCount = Number(dayRow?.days ?? 0);
    }

    // Waterfall table with stable row IDs so DELETE removes exactly the matched rows
    await conn.query(`CREATE OR REPLACE TABLE _rmon_wf AS SELECT ROW_NUMBER() OVER () AS _rmon_id, * FROM "${src}"`);

    for (let i = 0; i < strats.length; i++) {
      const s     = strats[i];
      const where = RMON_BuildWhereClause(s);
      const vel   = _rmon_hasVelocity(s) ? _rmon_velParts(s) : null;

      // All-rows query
      const allSql = vel
        ? `WITH _v AS (SELECT *, ${vel.cols.join(', ')} FROM "${src}" WHERE ${where}) SELECT COUNT(*) AS total, ${fraudExpr} AS fraud FROM _v WHERE ${vel.where}`
        : `SELECT COUNT(*) AS total, ${fraudExpr} AS fraud FROM "${src}" WHERE ${where}`;

      const allRow = (await conn.query(allSql)).toArray()[0];
      const total  = Number(allRow?.total ?? 0);
      const fraud  = Number(allRow?.fraud ?? 0);

      // Waterfall query against _rmon_wf
      const wfSql = vel
        ? `WITH _v AS (SELECT *, ${vel.cols.join(', ')} FROM _rmon_wf WHERE ${where}) SELECT COUNT(*) AS total, ${fraudExpr} AS fraud FROM _v WHERE ${vel.where}`
        : `SELECT COUNT(*) AS total, ${fraudExpr} AS fraud FROM _rmon_wf WHERE ${where}`;

      const wfRow  = (await conn.query(wfSql)).toArray()[0];
      const wfTotal = Number(wfRow?.total ?? 0);
      const wfFraud = Number(wfRow?.fraud ?? 0);

      // Delete matched rows from waterfall table — skip if action is 'allow' (rows pass through)
      if ((s._action || '') !== 'allow') {
        const delSql = vel
          ? `DELETE FROM _rmon_wf WHERE _rmon_id IN (SELECT _rmon_id FROM (SELECT _rmon_id, ${vel.cols.join(', ')} FROM _rmon_wf WHERE ${where}) WHERE ${vel.where})`
          : `DELETE FROM _rmon_wf WHERE ${where}`;
        await conn.query(delSql);
      }

      _RMON_MatchResults.push({
        id: s.ID, label: `${s.Source || 'Strategy'} · #${i + 1}`,
        total, fraud, wfTotal, wfFraud,
      });
    }
  } catch(e) {
    alert(`Query error: ${e.message}`);
  } finally {
    try { await conn.query(`DROP TABLE IF EXISTS _rmon_wf`); } catch(_) {}
    if (btn) { btn.textContent = 'Run Match'; btn.disabled = false; }
  }

  RMON_BuildResultsTable();
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

  const actionSel = (id) => {
    const saved = _RMON_JsonStore[id]?._action || '';
    return `<select class="rmon-action-sel" onchange="RMON_SetAction('${id}',this.value)">
      <option value="" ${saved===''?'selected':''}>—</option>
      <option value="alert"   ${saved==='alert'  ?'selected':''}>Alert</option>
      <option value="block"   ${saved==='block'  ?'selected':''}>Block</option>
      <option value="monitor" ${saved==='monitor'?'selected':''}>Monitor</option>
      <option value="allow"   ${saved==='allow'  ?'selected':''}>Allow</option>
    </select>`;
  };

  let rows = _RMON_MatchResults.map(r => `
    <tr>
      <td class="rmon-label">${r.label}</td>
      <td class="rmon-num">${fmt(r.total)}</td>
      <td class="rmon-num">${fmt(r.fraud)}</td>
      <td class="rmon-fp">${fp(r.total, r.fraud)}</td>
      <td class="rmon-num">${fmt(r.wfTotal)}</td>
      <td class="rmon-num">${fmt(r.wfFraud)}</td>
      <td class="rmon-fp">${fp(r.wfTotal, r.wfFraud)}</td>
      <td>${actionSel(r.id)}</td>
    </tr>`).join('');

  rows += `<tr class="rmon-total">
    <td class="rmon-label">Total</td>
    <td class="rmon-num">${fmt(totTotal)}</td>
    <td class="rmon-num">${fmt(totFraud)}</td>
    <td class="rmon-fp">${fp(totTotal, totFraud)}</td>
    <td class="rmon-num">${fmt(totWFT)}</td>
    <td class="rmon-num">${fmt(totWFF)}</td>
    <td class="rmon-fp">${fp(totWFT, totWFF)}</td>
    <td></td>
  </tr>`;

  // ── Action summary ──
  const ACTION_LABELS = { alert: 'Alert', block: 'Block', monitor: 'Monitor', allow: 'Allow', '': 'Unassigned' };
  const perDay = (n) => _RMON_DayCount > 0 ? (n / _RMON_DayCount).toFixed(1) : '—';
  const actionGroups = {};
  for (const r of _RMON_MatchResults) {
    const action = (_RMON_JsonStore[r.id]?._action || '');
    if (!actionGroups[action]) actionGroups[action] = { wfTotal: 0, wfFraud: 0 };
    actionGroups[action].wfTotal += r.wfTotal;
    actionGroups[action].wfFraud += r.wfFraud;
  }
  const summaryRows = Object.entries(actionGroups).map(([action, g]) => `
    <tr>
      <td class="rmon-label">${ACTION_LABELS[action] || action}</td>
      <td class="rmon-num">${fmt(g.wfTotal)}</td>
      <td class="rmon-num">${fmt(g.wfFraud)}</td>
      <td class="rmon-fp">${fp(g.wfTotal, g.wfFraud)}</td>
      <td class="rmon-num">${perDay(g.wfTotal)}</td>
    </tr>`).join('');

  wrap.innerHTML = `
  <div class="rmon-summary-wrap">
    <div class="pg-card-label" style="margin-bottom:6px;">Action Summary</div>
    <div class="pg-table-wrap"><table class="pg-table">
      <thead><tr>
        <th>Action</th>
        <th class="rmon-th-r">WF Matches</th>
        <th class="rmon-th-r">WF Fraud</th>
        <th class="rmon-th-r">WF F/P %</th>
        <th class="rmon-th-r">Per Day</th>
      </tr></thead>
      <tbody>${summaryRows}</tbody>
    </table></div>
  </div>
  <div class="pg-table-wrap"><table class="pg-table">
    <thead><tr>
      <th onclick="PG_toggleTableCol(this)">Strategy</th>
      <th onclick="PG_toggleTableCol(this)" class="rmon-th-r">Matches</th>
      <th onclick="PG_toggleTableCol(this)" class="rmon-th-r">Fraud</th>
      <th onclick="PG_toggleTableCol(this)" class="rmon-th-r">F/P %</th>
      <th onclick="PG_toggleTableCol(this)" class="rmon-th-r">WF Matches</th>
      <th onclick="PG_toggleTableCol(this)" class="rmon-th-r">WF Fraud</th>
      <th onclick="PG_toggleTableCol(this)" class="rmon-th-r">WF F/P %</th>
      <th>Action</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table></div>`;
}

// ── Action assignment ─────────────────────────────────────────────────────────
function RMON_SetAction(id, value) {
  if (_RMON_JsonStore[id]) _RMON_JsonStore[id]._action = value;
  if (_RMON_MatchResults.length) RMON_RunMatch();
}

// ── Config Manager ────────────────────────────────────────────────────────────
const _RMON_STORE_KEY = 'RMON_Configs';

function _rmon_configStore() {
  try { return JSON.parse(localStorage.getItem(_RMON_STORE_KEY) || '{}'); } catch(_) { return {}; }
}

function RMON_saveConfig() {
  const name = document.getElementById('RMON_ConfigName')?.value.trim();
  if (!name) { alert('Enter a name first.'); return; }
  const store = _rmon_configStore();
  store[name] = {
    Name:       name,
    savedAt:    new Date().toISOString(),
    strategies: JSON.parse(JSON.stringify(_RMON_JsonStore)),
    chips:      [..._RMON_ActiveChips],
  };
  localStorage.setItem(_RMON_STORE_KEY, JSON.stringify(store));
  document.getElementById('RMON_ConfigName').value = '';
  RMON_showConfigSuggestions('');
}

function RMON_loadConfig() {
  const name = document.getElementById('RMON_ConfigName')?.value.trim();
  if (!name) { alert('Enter a config name to load.'); return; }
  const store = _rmon_configStore();
  const cfg   = store[name];
  if (!cfg) { alert(`No config named "${name}".`); return; }
  Object.keys(_RMON_JsonStore).forEach(k => delete _RMON_JsonStore[k]);
  _RMON_ActiveChips.length = 0;
  Object.assign(_RMON_JsonStore, cfg.strategies || {});
  (cfg.chips || Object.keys(cfg.strategies || {})).forEach(id => {
    if (_RMON_JsonStore[id]) _RMON_ActiveChips.push(id);
  });
  document.getElementById('RMON_ConfigName').value = '';
  RMON_showConfigSuggestions('');
  RMON_RenderChips();
  RMON_RenderTable();
}

function RMON_deleteConfig() {
  const name = document.getElementById('RMON_ConfigName')?.value.trim();
  if (!name) { alert('Enter a config name to delete.'); return; }
  const store = _rmon_configStore();
  if (!store[name]) { alert(`No config named "${name}".`); return; }
  if (!confirm(`Delete config "${name}"?`)) return;
  delete store[name];
  localStorage.setItem(_RMON_STORE_KEY, JSON.stringify(store));
  document.getElementById('RMON_ConfigName').value = '';
  RMON_showConfigSuggestions('');
}

function RMON_exportConfig() {
  const name  = document.getElementById('RMON_ConfigName')?.value.trim();
  const store = _rmon_configStore();
  const data  = (name && store[name]) ? { [name]: store[name] } : store;
  const fname = (name && store[name]) ? `${name}.json` : 'rmon_configs.json';
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  a.download = fname;
  a.click();
  URL.revokeObjectURL(a.href);
}

function RMON_importConfig() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const incoming = JSON.parse(ev.target.result);
        const store    = _rmon_configStore();
        Object.entries(incoming).forEach(([k, v]) => { store[k] = v; });
        localStorage.setItem(_RMON_STORE_KEY, JSON.stringify(store));
      } catch(err) { alert('Import failed: ' + err.message); }
    };
    reader.readAsText(file);
  };
  input.click();
}

function RMON_showConfigSuggestions(val) {
  const box = document.getElementById('RMON_ConfigSuggestions');
  if (!box) return;
  const store = _rmon_configStore();
  const keys  = Object.keys(store).filter(k => !val || k.toLowerCase().includes(val.toLowerCase()));
  if (!keys.length) { box.style.display = 'none'; return; }
  box.innerHTML = keys.map(k =>
    `<div onclick="document.getElementById('RMON_ConfigName').value='${k.replace(/'/g,"\\'")}';document.getElementById('RMON_ConfigSuggestions').style.display='none';"
      style="padding:7px 12px;cursor:pointer;font-size:0.72rem;color:var(--color-header-title);border-bottom:0.5px solid var(--color-card-border);"
      onmouseover="this.style.background='var(--color-nav-hover)'" onmouseout="this.style.background=''">
      ${k}
    </div>`
  ).join('');
  const inp = document.getElementById('RMON_ConfigName');
  const r   = inp.getBoundingClientRect();
  box.style.left  = r.left + 'px';
  box.style.width = r.width + 'px';
  box.style.top   = r.bottom + 'px';
  box.style.display = '';
  setTimeout(() => document.addEventListener('click', _rmon_configSuggestOutside), 0);
}

function _rmon_configSuggestOutside(e) {
  const box = document.getElementById('RMON_ConfigSuggestions');
  const inp = document.getElementById('RMON_ConfigName');
  if (box && !box.contains(e.target) && e.target !== inp) {
    box.style.display = 'none';
    document.removeEventListener('click', _rmon_configSuggestOutside);
  }
}

// ── RMON Info Popup ───────────────────────────────────────────────────────────
function RMON_infoOpen(btn, title, text) {
  const popup = document.getElementById('RMON_InfoPopup');
  if (!popup) return;
  document.getElementById('RMON_InfoTitle').textContent = title;
  document.getElementById('RMON_InfoBody').innerHTML    = text;
  popup.style.visibility = 'hidden';
  popup.style.display    = 'block';
  popup.style.top = popup.style.bottom = popup.style.left = popup.style.right = '';
  const pH = popup.offsetHeight, pW = popup.offsetWidth;
  popup.style.visibility = '';
  const r = btn.getBoundingClientRect(), gap = 8;
  const spaceBelow = window.innerHeight - r.bottom - gap, spaceAbove = r.top - gap;
  const spaceRight = window.innerWidth - r.left,           spaceLeft  = r.right;
  popup.style.top    = spaceBelow >= pH || spaceBelow >= spaceAbove ? (r.bottom + gap) + 'px' : '';
  popup.style.bottom = spaceBelow >= pH || spaceBelow >= spaceAbove ? '' : (window.innerHeight - r.top + gap) + 'px';
  popup.style.left   = spaceRight >= pW || spaceRight >= spaceLeft  ? r.left + 'px' : '';
  popup.style.right  = spaceRight >= pW || spaceRight >= spaceLeft  ? '' : (window.innerWidth - r.right) + 'px';
  setTimeout(() => document.addEventListener('click', _RMON_infoOutside), 0);
  window.addEventListener('scroll', RMON_infoClose, { once: true, capture: true });
}
function _RMON_infoOutside(e) {
  const popup = document.getElementById('RMON_InfoPopup');
  if (popup && !popup.contains(e.target) && !e.target.classList.contains('pg-card-info-btn')) RMON_infoClose();
}
function RMON_infoClose() {
  const popup = document.getElementById('RMON_InfoPopup');
  if (popup) popup.style.display = 'none';
  document.removeEventListener('click', _RMON_infoOutside);
}

