// ── Policy Rules Mini-Nav ─────────────────────────────────────────────────────

// ── PR Badges (App_badge style, mirrors SP_showParamsReadyBadge) ──────────────
function _PR_getBadge() {
  let el = document.getElementById('PR_Badge');
  if (!el) {
    el = document.createElement('div');
    el.id = 'PR_Badge';
    el.className = 'App_badge';
    document.body.appendChild(el);
  }
  return el;
}

function PR_toast(msg, type) {
  const el = _PR_getBadge();
  const isErr  = type === 'error';
  const isWarn = type === 'warning';
  const color  = isErr ? '#ef4444' : isWarn ? '#f59e0b' : 'var(--brand-pr-light)';
  el.style.borderRightColor = color;
  const icon = isErr
    ? `<svg viewBox="0 0 16 16" width="14" height="14" fill="none" style="flex-shrink:0;color:${color}"><circle cx="8" cy="8" r="6.5" stroke="currentColor" stroke-width="1.5"/><path d="M5.5 5.5l5 5M10.5 5.5l-5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`
    : isWarn
    ? `<svg viewBox="0 0 16 16" width="14" height="14" fill="none" style="flex-shrink:0;color:${color}"><path d="M8 2L14 14H2L8 2z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M8 7v3M8 11.5v.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`
    : `<svg viewBox="0 0 16 16" width="14" height="14" fill="none" style="flex-shrink:0;color:${color}"><circle cx="8" cy="8" r="6.5" stroke="currentColor" stroke-width="1.5"/><path d="M5 8l2 2 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  el.innerHTML = `${icon}<span style="flex:1;color:${isErr||isWarn ? color : ''}">${msg}</span><button onclick="document.getElementById('PR_Badge')?.remove()">✕</button>`;
  if (typeof SP_stackBadges === 'function') SP_stackBadges();
}

function PR_showRunningBadge() {
  const el = _PR_getBadge();
  el.style.borderRightColor = '';
  el.innerHTML = `
    <svg viewBox="0 0 16 16" width="14" height="14" style="flex-shrink:0;animation:GS_spin 1s linear infinite;color:var(--brand-pr-light)">
      <circle cx="8" cy="8" r="5.5" stroke="currentColor" stroke-width="1.5" stroke-dasharray="22" stroke-dashoffset="8" fill="none"/>
    </svg>
    <span>Running…</span>`;
  if (typeof SP_stackBadges === 'function') SP_stackBadges();
}

function PR_showDoneBadge(secs) {
  const el = _PR_getBadge();
  const timeStr = secs != null ? ` &nbsp;·&nbsp; ${secs}s` : '';
  el.style.borderRightColor = 'var(--brand-pr-light)';
  el.innerHTML = `
    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" style="flex-shrink:0;color:var(--brand-pr-light)">
      <circle cx="8" cy="8" r="6.5" stroke="currentColor" stroke-width="1.5"/>
      <path d="M5 8l2 2 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
    <span><strong>Analysis complete</strong>${timeStr}</span>
    <button onclick="document.getElementById('PR_Badge')?.remove()">✕</button>`;
  if (typeof SP_stackBadges === 'function') SP_stackBadges();
}

(function () {
  function _inject() {
    const nav = document.getElementById('PR_MiniNav');
    if (!nav || document.getElementById('PR_ScrollerDown')) return;
    nav.insertAdjacentHTML('afterbegin', `
      <div id="PR_ScrollerUp" onclick="PR_ScrollUp()" title="Scroll up">
        <svg viewBox="0 0 16 8" width="14" height="7" fill="none">
          <polyline points="1 7 8 1 15 7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <div class="MN_ScrollBar"></div>
      </div>`);
    nav.insertAdjacentHTML('beforeend', `
      <div id="PR_ScrollerDown" onclick="PR_ScrollDown()" title="Scroll down">
        <div class="MN_ScrollBar"></div>
        <svg viewBox="0 0 16 8" width="14" height="7" fill="none">
          <polyline points="1 1 8 7 15 1" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>`);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', _inject);
  else _inject();
})();

function PR_ScrollDown() { document.getElementById('PR_MiniNav')?.scrollBy({ top:  150, behavior: 'smooth' }); }
function PR_ScrollUp()   { document.getElementById('PR_MiniNav')?.scrollBy({ top: -150, behavior: 'smooth' }); }

function PR_MiniNav_RenderParams() { SP_RenderParamsTo('PR_MiniNav_ParamsDisplay', 'pr'); }

// ── Section toggles ───────────────────────────────────────────────────────────
let _prMiniParamsOpen = false;
let _prMiniColsOpen   = true;
let _prMiniRunOpen    = true;
let _prMiniSumOpen    = false;

function PR_MiniNav_ToggleParams() {
  _prMiniParamsOpen = !_prMiniParamsOpen;
  _toggle('PR_MiniNav_ParamsBody', 'PR_MiniNav_ParamsChevron', _prMiniParamsOpen);
}
function PR_MiniNav_ToggleCols() {
  _prMiniColsOpen = !_prMiniColsOpen;
  _toggle('PR_MiniNav_ColBody', 'PR_MiniNav_ColChevron', _prMiniColsOpen);
}
function PR_MiniNav_ToggleRun() {
  _prMiniRunOpen = !_prMiniRunOpen;
  _toggle('PR_MiniNav_RunBody', 'PR_MiniNav_RunChevron', _prMiniRunOpen);
}
function PR_MiniNav_ToggleSum() {
  _prMiniSumOpen = !_prMiniSumOpen;
  _toggle('PR_MiniNav_SumBody', 'PR_MiniNav_SumChevron', _prMiniSumOpen);
}

function _toggle(bodyId, chevronId, open) {
  const body    = document.getElementById(bodyId);
  const chevron = document.getElementById(chevronId);
  if (body)    body.style.display      = open ? 'block' : 'none';
  if (chevron) chevron.style.transform = open ? 'rotate(90deg)' : 'rotate(0deg)';
}

let _prMiniAllExpanded = true;
function PR_MiniNav_ToggleAll() {
  _prMiniAllExpanded = !_prMiniAllExpanded;
  _prMiniParamsOpen  = _prMiniAllExpanded;
  _prMiniColsOpen    = _prMiniAllExpanded;
  _prMiniRunOpen     = _prMiniAllExpanded;
  _prMiniSumOpen     = _prMiniAllExpanded;
  [
    { body: 'PR_MiniNav_ParamsBody', chevron: 'PR_MiniNav_ParamsChevron' },
    { body: 'PR_MiniNav_ColBody',    chevron: 'PR_MiniNav_ColChevron'    },
    { body: 'PR_MiniNav_RunBody',    chevron: 'PR_MiniNav_RunChevron'    },
    { body: 'PR_MiniNav_SumBody',    chevron: 'PR_MiniNav_SumChevron'    },
  ].forEach(s => {
    const b = document.getElementById(s.body);
    const c = document.getElementById(s.chevron);
    if (b) b.style.display      = _prMiniAllExpanded ? 'block' : 'none';
    if (c) c.style.transform    = _prMiniAllExpanded ? 'rotate(90deg)' : 'rotate(0deg)';
  });
  const btn = document.getElementById('PR_MiniNav_ExpandBtn');
  if (btn) btn.title = _prMiniAllExpanded ? 'Collapse all' : 'Expand all';
}

// ── Column population ─────────────────────────────────────────────────────────
const _PR_NUMERIC_TYPES   = /int|float|double|decimal|numeric|real|bigint|smallint|tinyint|hugeint|ubigint|uinteger|usmallint|utinyint/;
const _PR_DATETIME_TYPES  = /date|time|timestamp|interval/;

let PR_AllColumns        = [];
let PR_SelectedColumns   = [];
let PR_NumericColumns    = [];
let PR_DetectedSpecial   = [];   // MCC-like column names
let PR_DetectedCountry   = [];   // country column names
let PR_MccGroupApplied   = false;
let PR_RegionGroupApplied = false;
let _prOrigSrc           = null; // original view/source name (e.g. 'data101')
let _prAppliedExprs      = [];   // accumulated derived-col SQL expressions

async function PR_MiniNav_PopulateCols() {
  const list = document.getElementById('PR_MiniNav_ColumnsList');
  if (!list) return;
  const conn = window.LD_getConn?.();
  const src  = window._prActiveSrc || window.LD_getSource?.();
  if (!conn || !src) {
    list.innerHTML = '<span style="font-size:0.62rem;color:var(--color-text-dim);padding:2px 0;">— Load data first —</span>';
    return;
  }
  try {
    const sp      = window.SP_getParams?.() || {};
    const excl    = new Set([sp.object, sp.col1, sp.ruleSignal].filter(Boolean));
    const res     = await conn.query(`DESCRIBE "${src}"`);
    const rows    = res.toArray();
    const allCols = rows.map(r => ({ name: r.column_name, dtype: (r.column_type || '').toLowerCase() }));

    const catCandidates = allCols
      .filter(c => !_PR_NUMERIC_TYPES.test(c.dtype) && !_PR_DATETIME_TYPES.test(c.dtype) && !excl.has(c.name))
      .map(c => c.name);
    const numCols = allCols.filter(c => _PR_NUMERIC_TYPES.test(c.dtype) && !excl.has(c.name)).map(c => c.name);

    // Only keep categorical columns with ≥ 10 distinct values (mirrors RA rule)
    const counts = await Promise.all(catCandidates.map(c =>
      conn.query(`SELECT COUNT(DISTINCT "${c.replace(/"/g,'""')}") AS n FROM "${src}"`).then(r => Number(r.toArray()[0].n))
    ));
    const catCols = catCandidates.filter((_, i) => counts[i] >= 10);

    PR_DetectedSpecial    = catCandidates.filter(n => /^mcc$/i.test(n));
    PR_DetectedCountry    = catCandidates.filter(n => /country/i.test(n));
    PR_MccGroupApplied    = catCandidates.includes('MCC_Group');
    PR_RegionGroupApplied = catCandidates.includes('Region');
    PR_NumericColumns     = numCols;
    PR_AllColumns         = [...catCols];
    PR_SelectedColumns    = PR_SelectedColumns.filter(c => PR_AllColumns.includes(c));

    PR_RefreshColumnsList();
  } catch { return; }
}

function PR_RefreshColumnsList() {
  const list = document.getElementById('PR_MiniNav_ColumnsList');
  if (!list) return;

  const chips = PR_AllColumns.map(col => {
    const sel = PR_SelectedColumns.includes(col);
    return `<button onclick="PR_ToggleColumn('${col}')" class="MN_chip MN_chip--col MN_chip--a${sel ? ' active' : ''}">${col}</button>`;
  }).join('');

  let mccSugg = '';
  if (PR_DetectedSpecial.length && !PR_MccGroupApplied) {
    mccSugg = `<button onclick="PR_ApplyMccGroup('${PR_DetectedSpecial[0]}')"
      style="height:28px;border-radius:5px;border:1px dashed var(--brand-pr-light);background:var(--brand-pr-dim);font-size:0.65rem;font-weight:600;color:var(--brand-pr-light);cursor:pointer;width:100%;">
      + MCC_Group</button>`;
  }
  let regionSugg = '';
  if (PR_DetectedCountry.length && !PR_RegionGroupApplied) {
    regionSugg = `<button onclick="PR_ApplyRegionGroup('${PR_DetectedCountry[0]}')"
      style="height:28px;border-radius:5px;border:1px dashed var(--brand-pr-light);background:var(--brand-pr-dim);font-size:0.65rem;font-weight:600;color:var(--brand-pr-light);cursor:pointer;width:100%;">
      + Region</button>`;
  }

  const binCards = PR_NumericColumns
    .filter(n => !PR_AllColumns.includes(n + '_Bin'))
    .map(n => {
      const sid = 'PR_BinStep_' + n.replace(/\W/g, '_');
      const mid = 'PR_BinMax_'  + n.replace(/\W/g, '_');
      return `<div ondblclick="PR_ApplyBinGroup('${n}','${sid}','${mid}')"
        style="grid-column:1/-1;border:1px dashed var(--brand-pr-light);border-radius:5px;padding:5px 7px;background:var(--brand-pr-dim);cursor:pointer;">
        <div style="font-size:0.62rem;font-weight:600;color:var(--brand-pr-light);margin-bottom:4px;">+ ${n}_Bin</div>
        <div style="display:flex;gap:4px;">
          <div style="flex:1;"><div style="font-size:0.55rem;color:var(--brand-pr-light);">Step</div>
            <input id="${sid}" type="number" step="any" value="15" onclick="event.stopPropagation()" class="MN_ctrl" style="width:100%;height:22px;"/></div>
          <div style="flex:1;"><div style="font-size:0.55rem;color:var(--brand-pr-light);">Max</div>
            <input id="${mid}" type="number" step="any" value="100" onclick="event.stopPropagation()" class="MN_ctrl" style="width:100%;height:22px;"/></div>
        </div>
      </div>`;
    }).join('');

  list.innerHTML = chips + mccSugg + regionSugg + binCards;

  const runBody = document.getElementById('PR_MiniNav_RunBody');
  if (runBody) {
    const locked = PR_SelectedColumns.length === 0;
    const wasLocked = runBody.style.pointerEvents === 'none';
    runBody.style.opacity       = locked ? '0.35' : '';
    runBody.style.pointerEvents = locked ? 'none'  : '';
    if (wasLocked && !locked) {
      _prRunBy = null;
      ['day','hour','overall'].forEach(x => document.getElementById('PR_RunByBtn_' + x)?.classList.remove('active'));
    }
  }
}

function PR_ToggleColumn(col) {
  const idx = PR_SelectedColumns.indexOf(col);
  if (idx === -1) PR_SelectedColumns.push(col);
  else PR_SelectedColumns.splice(idx, 1);
  PR_RefreshColumnsList();
}

// ── Group column lookup tables (mirrors Analysis_PolicyRules.py) ──────────────
const _PR_MCC_LOOKUP = {
  0:'Agricultural',100:'Agricultural',200:'Agricultural',300:'Agricultural',400:'Agricultural',500:'Agricultural',600:'Agricultural',700:'Agricultural',800:'Agricultural',900:'Agricultural',1000:'Agricultural',1100:'Agricultural',1200:'Agricultural',1300:'Agricultural',1400:'Agricultural',
  1500:'Contracted',1600:'Contracted',1700:'Contracted',1800:'Contracted',1900:'Contracted',2000:'Contracted',2100:'Contracted',2200:'Contracted',2300:'Contracted',2400:'Contracted',2500:'Contracted',2600:'Contracted',2700:'Contracted',2800:'Contracted',2900:'Contracted',
  3000:'Airlines',3100:'Airlines',3200:'Airlines',
  3300:'Car_Rental',3400:'Car_Rental',
  3500:'Lodging',3600:'Lodging',3700:'Lodging',3800:'Lodging',3900:'Lodging',
  4000:'Transportation',4100:'Transportation',4200:'Transportation',4300:'Transportation',4400:'Transportation',4500:'Transportation',4600:'Transportation',4700:'Transportation',
  4800:'Utility',4900:'Utility',
  5000:'RetailOutlet',5100:'RetailOutlet',5200:'RetailOutlet',5300:'RetailOutlet',5400:'RetailOutlet',5500:'RetailOutlet',
  5600:'ClothingStores',
  5700:'MiscellaneousStore',5800:'MiscellaneousStore',5900:'MiscellaneousStore',6000:'MiscellaneousStore',6100:'MiscellaneousStore',6200:'MiscellaneousStore',6300:'MiscellaneousStore',6400:'MiscellaneousStore',6500:'MiscellaneousStore',6600:'MiscellaneousStore',6700:'MiscellaneousStore',6800:'MiscellaneousStore',6900:'MiscellaneousStore',7000:'MiscellaneousStore',7100:'MiscellaneousStore',7200:'MiscellaneousStore',
  7300:'Business',7400:'Business',7500:'Business',7600:'Business',7700:'Business',7800:'Business',7900:'Business',
  8000:'ProfessionalMembership',8100:'ProfessionalMembership',8200:'ProfessionalMembership',8300:'ProfessionalMembership',8400:'ProfessionalMembership',8500:'ProfessionalMembership',8600:'ProfessionalMembership',8700:'ProfessionalMembership',8800:'ProfessionalMembership',8900:'ProfessionalMembership',
  9000:'Government',9100:'Government',9200:'Government',9300:'Government',9400:'Government',9500:'Government',9600:'Government',9700:'Government',9800:'Government',9900:'Government',
};

const _PR_REGION_LOOKUP = {
  '398':'asia_central','417':'asia_central','762':'asia_central','795':'asia_central','860':'asia_central',
  '156':'asia_eastern','344':'asia_eastern','392':'asia_eastern','408':'asia_eastern','410':'asia_eastern','446':'asia_eastern','496':'asia_eastern','158':'asia_eastern',
  '096':'asia_south_eastern','116':'asia_south_eastern','360':'asia_south_eastern','418':'asia_south_eastern','458':'asia_south_eastern','104':'asia_south_eastern','608':'asia_south_eastern','702':'asia_south_eastern','626':'asia_south_eastern','764':'asia_south_eastern','704':'asia_south_eastern',
  '004':'asia_southern','050':'asia_southern','064':'asia_southern','356':'asia_southern','364':'asia_southern','462':'asia_southern','524':'asia_southern','586':'asia_southern','144':'asia_southern',
  '051':'asia_western','031':'asia_western','048':'asia_western','196':'asia_western','268':'asia_western','368':'asia_western','376':'asia_western','400':'asia_western','414':'asia_western','422':'asia_western','512':'asia_western','275':'asia_western','634':'asia_western','682':'asia_western','760':'asia_western','792':'asia_western','784':'asia_western','887':'asia_western',
  '012':'africa_northern','818':'africa_northern','434':'africa_northern','504':'africa_northern','729':'africa_northern','788':'africa_northern','732':'africa_northern',
  '024':'africa_sub_saharan','086':'africa_sub_saharan','204':'africa_sub_saharan','072':'africa_sub_saharan','854':'africa_sub_saharan','108':'africa_sub_saharan','132':'africa_sub_saharan','120':'africa_sub_saharan','140':'africa_sub_saharan','148':'africa_sub_saharan','174':'africa_sub_saharan','178':'africa_sub_saharan','180':'africa_sub_saharan','262':'africa_sub_saharan','226':'africa_sub_saharan','232':'africa_sub_saharan','748':'africa_sub_saharan','231':'africa_sub_saharan','260':'africa_sub_saharan','266':'africa_sub_saharan','270':'africa_sub_saharan','288':'africa_sub_saharan','324':'africa_sub_saharan','624':'africa_sub_saharan','404':'africa_sub_saharan','426':'africa_sub_saharan','430':'africa_sub_saharan','450':'africa_sub_saharan','454':'africa_sub_saharan','466':'africa_sub_saharan','478':'africa_sub_saharan','480':'africa_sub_saharan','175':'africa_sub_saharan','508':'africa_sub_saharan','516':'africa_sub_saharan','562':'africa_sub_saharan','566':'africa_sub_saharan','638':'africa_sub_saharan','646':'africa_sub_saharan','654':'africa_sub_saharan','678':'africa_sub_saharan','686':'africa_sub_saharan','690':'africa_sub_saharan','694':'africa_sub_saharan','706':'africa_sub_saharan','710':'africa_sub_saharan','728':'africa_sub_saharan','834':'africa_sub_saharan','768':'africa_sub_saharan','800':'africa_sub_saharan','894':'africa_sub_saharan','716':'africa_sub_saharan',
  '660':'americas_latin_caribbean','028':'americas_latin_caribbean','032':'americas_latin_caribbean','533':'americas_latin_caribbean','136':'americas_latin_caribbean','152':'americas_latin_caribbean','170':'americas_latin_caribbean','192':'americas_latin_caribbean','531':'americas_latin_caribbean','212':'americas_latin_caribbean','214':'americas_latin_caribbean','218':'americas_latin_caribbean','222':'americas_latin_caribbean','238':'americas_latin_caribbean','254':'americas_latin_caribbean','308':'americas_latin_caribbean','312':'americas_latin_caribbean','316':'americas_latin_caribbean','320':'americas_latin_caribbean','328':'americas_latin_caribbean','332':'americas_latin_caribbean','340':'americas_latin_caribbean','388':'americas_latin_caribbean','474':'americas_latin_caribbean','484':'americas_latin_caribbean','500':'americas_latin_caribbean','558':'americas_latin_caribbean','591':'americas_latin_caribbean','600':'americas_latin_caribbean','604':'americas_latin_caribbean','630':'americas_latin_caribbean','652':'americas_latin_caribbean','659':'americas_latin_caribbean','662':'americas_latin_caribbean','663':'americas_latin_caribbean','670':'americas_latin_caribbean','534':'americas_latin_caribbean','740':'americas_latin_caribbean','780':'americas_latin_caribbean','858':'americas_latin_caribbean','862':'americas_latin_caribbean','092':'americas_latin_caribbean','850':'americas_latin_caribbean','239':'americas_latin_caribbean','068':'americas_latin_caribbean','535':'americas_latin_caribbean','074':'americas_latin_caribbean','076':'americas_latin_caribbean',
  '060':'americas_northern','124':'americas_northern','304':'americas_northern','666':'americas_northern','840':'americas_northern',
  '112':'europe_eastern','100':'europe_eastern','203':'europe_eastern','348':'europe_eastern','498':'europe_eastern','616':'europe_eastern','642':'europe_eastern','643':'europe_eastern','703':'europe_eastern','804':'europe_eastern',
  '248':'europe_northern','208':'europe_northern','233':'europe_northern','234':'europe_northern','246':'europe_northern','831':'europe_northern','832':'europe_northern','833':'europe_northern','352':'europe_northern','372':'europe_northern','428':'europe_northern','440':'europe_northern','578':'europe_northern','752':'europe_northern','826':'europe_northern','744':'europe_northern',
  '008':'europe_southern','020':'europe_southern','070':'europe_southern','191':'europe_southern','292':'europe_southern','300':'europe_southern','336':'europe_southern','380':'europe_southern','470':'europe_southern','499':'europe_southern','807':'europe_southern','620':'europe_southern','674':'europe_southern','688':'europe_southern','705':'europe_southern','724':'europe_southern',
  '040':'europe_western','056':'europe_western','250':'europe_western','276':'europe_western','438':'europe_western','442':'europe_western','492':'europe_western','528':'europe_western','756':'europe_western',
  '036':'oceania_australia_nz','162':'oceania_australia_nz','166':'oceania_australia_nz','334':'oceania_australia_nz','554':'oceania_australia_nz','574':'oceania_australia_nz',
  '242':'oceania_melanesia','540':'oceania_melanesia','598':'oceania_melanesia','090':'oceania_melanesia','548':'oceania_melanesia',
  '316':'oceania_micronesia','296':'oceania_micronesia','584':'oceania_micronesia','583':'oceania_micronesia','520':'oceania_micronesia','580':'oceania_micronesia','585':'oceania_micronesia','581':'oceania_micronesia',
  '016':'oceania_polynesia','184':'oceania_polynesia','258':'oceania_polynesia','570':'oceania_polynesia','612':'oceania_polynesia','772':'oceania_polynesia','776':'oceania_polynesia','798':'oceania_polynesia','876':'oceania_polynesia','882':'oceania_polynesia',
};

function _prMccCaseExpr(colSafe) {
  const whens = Object.entries(_PR_MCC_LOOKUP)
    .map(([k, v]) => `WHEN ${k} THEN '${v}'`).join(' ');
  return `CASE CAST(FLOOR(TRY_CAST("${colSafe}" AS DOUBLE) / 100) * 100 AS INTEGER) ${whens} ELSE 'Other' END`;
}

function _prRegionCaseExpr(colSafe) {
  const whens = Object.entries(_PR_REGION_LOOKUP)
    .map(([k, v]) => `WHEN '${k}' THEN '${v}'`).join(' ');
  return `CASE LPAD(CAST(TRY_CAST("${colSafe}" AS INTEGER) AS VARCHAR), 3, '0') ${whens} ELSE 'Other' END`;
}

// Rematerialise _pr_mat from the original source with ALL accumulated expressions.
// Always reads from _prOrigSrc (the view) — no circular reference.
async function _prRematerialize(conn) {
  const extras = _prAppliedExprs.length ? ', ' + _prAppliedExprs.join(', ') : '';
  await conn.query(`CREATE OR REPLACE TABLE _pr_mat AS SELECT *${extras} FROM "${_prOrigSrc}"`);
  window._prActiveSrc = '_pr_mat';
}

async function PR_ApplyMccGroup(mccCol) {
  const conn = window.LD_getConn?.();
  if (!conn) return;
  if (!_prOrigSrc) _prOrigSrc = window.LD_getSource?.();
  if (!_prOrigSrc) return;
  const colSafe = mccCol.replace(/"/g, '""');
  _prAppliedExprs = _prAppliedExprs.filter(e => !/ AS MCC_Group$/.test(e));
  _prAppliedExprs.push(`${_prMccCaseExpr(colSafe)} AS MCC_Group`);
  try {
    await _prRematerialize(conn);
    PR_MccGroupApplied = true;
    if (!PR_AllColumns.includes('MCC_Group')) PR_AllColumns.push('MCC_Group');
    PR_RefreshColumnsList();
    PR_toast('MCC_Group column added', 'success');
  } catch(e) {
    PR_toast('Failed to apply MCC group', 'error');
    console.error('PR_ApplyMccGroup:', e);
  }
}

async function PR_ApplyRegionGroup(countryCol) {
  const conn = window.LD_getConn?.();
  if (!conn) return;
  if (!_prOrigSrc) _prOrigSrc = window.LD_getSource?.();
  if (!_prOrigSrc) return;
  const colSafe = countryCol.replace(/"/g, '""');
  _prAppliedExprs = _prAppliedExprs.filter(e => !/ AS Region$/.test(e));
  _prAppliedExprs.push(`${_prRegionCaseExpr(colSafe)} AS Region`);
  try {
    await _prRematerialize(conn);
    PR_RegionGroupApplied = true;
    if (!PR_AllColumns.includes('Region')) PR_AllColumns.push('Region');
    PR_RefreshColumnsList();
    PR_toast('Region column added', 'success');
  } catch(e) {
    PR_toast('Failed to apply Region group', 'error');
    console.error('PR_ApplyRegionGroup:', e);
  }
}

async function PR_ApplyBinGroup(col, stepId, maxId) {
  const step = parseFloat(document.getElementById(stepId)?.value);
  const maxV = parseFloat(document.getElementById(maxId)?.value);
  if (!col || isNaN(step) || step <= 0 || isNaN(maxV) || maxV <= 0) {
    PR_toast('Enter step and max value', 'warning');
    return;
  }
  const conn = window.LD_getConn?.();
  if (!conn) return;
  if (!_prOrigSrc) _prOrigSrc = window.LD_getSource?.();
  if (!_prOrigSrc) return;
  const colSafe = col.replace(/"/g, '""');
  const newCol  = `${col}_Bin`;
  const pad     = String(Math.floor(maxV)).length;
  const whens   = [];
  for (let lo = 0; lo < maxV; lo += step) {
    const label = `${String(Math.floor(lo)).padStart(pad,'0')}-${String(Math.floor(lo + step)).padStart(pad,'0')}`;
    whens.push(`WHEN TRY_CAST("${colSafe}" AS DOUBLE) >= ${lo} AND TRY_CAST("${colSafe}" AS DOUBLE) < ${lo + step} THEN '${label}'`);
  }
  const binExpr = `CASE WHEN TRY_CAST("${colSafe}" AS DOUBLE) IS NULL THEN 'Other' WHEN TRY_CAST("${colSafe}" AS DOUBLE) > ${maxV} THEN '>${Math.floor(maxV)}' ${whens.join(' ')} ELSE 'Other' END`;
  _prAppliedExprs = _prAppliedExprs.filter(e => !new RegExp(` AS "${newCol.replace(/"/g,'""')}"$`).test(e));
  _prAppliedExprs.push(`${binExpr} AS "${newCol}"`);
  try {
    await _prRematerialize(conn);
    if (!PR_AllColumns.includes(newCol)) PR_AllColumns.push(newCol);
    PR_RefreshColumnsList();
    PR_toast(`${newCol} column added`, 'success');
  } catch(e) {
    PR_toast('Error applying bin group', 'error');
    console.error('PR_ApplyBinGroup:', e);
  }
}

function PR_SelectAll() { PR_SelectedColumns = [...PR_AllColumns]; PR_RefreshColumnsList(); }
function PR_ClearAll()  { PR_SelectedColumns = []; PR_RefreshColumnsList(); }
function PR_MiniNav_GetSelectedCols() { return [...PR_SelectedColumns]; }

// ── Run Options state ─────────────────────────────────────────────────────────
let _prType   = 'transaction';
let _prShow   = new Set(['total', 'fraud']);
let _prRunBy  = null;

function PR_SetType(t) {
  _prType = t;
  ['transaction','pan','amount'].forEach(x => {
    const btn = document.getElementById('PR_TypeBtn_' + x);
    if (btn) btn.classList.toggle('active', x === t);
  });
  if (PR_SelectedColumns.length && _prShow.size && window.LD_getConn?.()) window._PR_RunAnalysis?.();
}

function PR_ToggleShow(key) {
  if (_prShow.has(key)) _prShow.delete(key); else _prShow.add(key);
  const btn = document.getElementById('PR_ShowBtn_' + key);
  if (btn) btn.classList.toggle('active', _prShow.has(key));
  if (PR_SelectedColumns.length && _prShow.size && window.LD_getConn?.()) window._PR_RunAnalysis?.();
}

function PR_SetRunBy(mode) {
  _prRunBy = mode;
  ['day','hour','overall'].forEach(x => {
    const btn = document.getElementById('PR_RunByBtn_' + x);
    if (btn) btn.classList.toggle('active', x === mode);
  });
  if (PR_SelectedColumns.length && window.LD_getConn?.()) window._PR_RunAnalysis?.();
}

// ── Summary Filter ────────────────────────────────────────────────────────────
let _prSumConditions = [];
let _prSumConnector  = 'AND';
let _prSumCondSeq    = 0;

function PR_AddSumCondition() {
  const id   = 'prc_' + (++_prSumCondSeq);
  const cols = window._prSumColOptions?.length ? window._prSumColOptions : PR_MiniNav_GetSelectedCols();
  const colOpts = cols.map(c => `<option value="${c}">${c}</option>`).join('') ||
                  '<option value="">— run analysis first —</option>';
  _prSumConditions.push(id);
  const container = document.getElementById('PR_SumConditions');
  if (!container) return;

  if (_prSumConditions.length > 1) {
    const conn = document.createElement('div');
    conn.id = 'pr_conn_' + id;
    conn.style.cssText = 'display:flex;align-items:center;gap:6px;margin:3px 0;';
    conn.innerHTML = `
      <div style="flex:1;height:1px;background:var(--color-card-border);"></div>
      <button onclick="PR_ToggleSumConnector()" class="MN_btn" id="PR_SumConnBtn"
        style="border-color:var(--brand-pr-light);background:var(--brand-pr-dim);color:var(--brand-pr-light);font-weight:700;letter-spacing:0.08em;text-transform:uppercase;">${_prSumConnector.toLowerCase()}</button>
      <div style="flex:1;height:1px;background:var(--color-card-border);"></div>`;
    container.appendChild(conn);
  }

  const row = document.createElement('div');
  row.id = id;
  row.style.cssText = 'display:flex;gap:4px;align-items:center;';
  row.innerHTML = `
    <select class="MN_ctrl" style="flex:2;min-width:0;" id="${id}_col">${colOpts}</select>
    <select class="MN_ctrl" style="flex:1;min-width:0;" id="${id}_op">
      <option>≤</option><option>≥</option><option>&lt;</option><option>&gt;</option><option>=</option>
    </select>
    <input type="number" class="MN_ctrl" style="flex:1;min-width:0;" id="${id}_val" value="0">
    <span onclick="PR_RemoveSumCond('${id}')" style="cursor:pointer;color:var(--color-text-dim);font-size:0.8rem;padding:2px;">✕</span>`;
  container.appendChild(row);
}

function PR_ToggleSumConnector() {
  _prSumConnector = _prSumConnector === 'AND' ? 'OR' : 'AND';
  document.querySelectorAll('[id="PR_SumConnBtn"]').forEach(btn => {
    btn.textContent = _prSumConnector.toLowerCase();
  });
}

function PR_RemoveSumCond(id) {
  const idx = _prSumConditions.indexOf(id);
  if (idx !== -1) _prSumConditions.splice(idx, 1);
  document.getElementById(id)?.remove();
  document.getElementById('pr_conn_' + id)?.remove();
}

function PR_GetSumConditions() {
  return _prSumConditions.map(id => ({
    col: document.getElementById(id + '_col')?.value || '',
    op:  document.getElementById(id + '_op')?.value  || '≤',
    val: parseFloat(document.getElementById(id + '_val')?.value) || 0,
  })).filter(c => c.col);
}

// Stubs — wired by PolicyRules.js
function PR_RunSummary()    { if (typeof _PR_RunSummary    === 'function') _PR_RunSummary();    }

// ── PR Info Popup ─────────────────────────────────────────────────────────────
function PR_infoOpen(btn, title, text) {
  const popup = document.getElementById('PR_InfoPopup');
  if (!popup) return;
  document.getElementById('PR_InfoTitle').textContent = title;
  document.getElementById('PR_InfoBody').innerHTML    = text;
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
  setTimeout(() => document.addEventListener('click', _PR_infoOutside), 0);
  window.addEventListener('scroll', PR_infoClose, { once: true, capture: true });
}
function _PR_infoOutside(e) {
  const popup = document.getElementById('PR_InfoPopup');
  if (popup && !popup.contains(e.target) && !e.target.classList.contains('MN_info_btn'))
    PR_infoClose();
}
function PR_infoClose() {
  const popup = document.getElementById('PR_InfoPopup');
  if (popup) popup.style.display = 'none';
  document.removeEventListener('click', _PR_infoOutside);
}
