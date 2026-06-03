// ── Main Content ─────────────────────────────────────────────────────────────

// ── Shared copy template — used by all analysis views ────────────────────────
let _APP_IdSeq = 0;

function APP_ApplyTemplate(source, data) {
  let tmpl = {};
  try { tmpl = JSON.parse(localStorage.getItem('APP_CopyTemplate') || '{}'); } catch(e) {}
  const id = source.replace(/\s+/g, '_') + '_' + Date.now() + '_' + (++_APP_IdSeq);
  return { ...data, ...tmpl, Source: source, ID: id };
}

// ── Clipboard helper — works in file:// contexts where navigator.clipboard fails ─
function APP_CopyText(text) {
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(text).catch(() => APP_CopyText_Fallback(text));
  } else {
    APP_CopyText_Fallback(text);
  }
}

function APP_CopyText_Fallback(text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0;';
  document.body.appendChild(ta);
  ta.select();
  document.execCommand('copy');
  document.body.removeChild(ta);
}

// ── Like It — shared action used across all analyses ─────────────────────────
// Call with the same args as APP_FormatStrategyPayload.
// Behaviour today: format + copy. Can be extended later (e.g. persist to store).
function APP_LikeIt(source, strategyArgs) {
  const output = APP_FormatStrategyPayload(source, strategyArgs);
  APP_CopyText(JSON.stringify(output, null, 2));
  if (typeof _RMON_Persist === 'function') _RMON_Persist(output);
}

// ── Standard strategy payload — benchmark copy format used across all analyses ─
// amount: { active: bool, col: string, conditions: [{op, value}] }
// score:  { col: string, conditions: [{op, value}] }          — single score
// scores: [{ col, conditions }]                               — multiple scores (SC)
// additionalColumns: string[] (optional)
function APP_FormatStrategyPayload(source, { amount, score, scores, additionalColumns = [] }) {
  const amtConditions = (amount?.conditions || []).map(c => ({
    OperatorDescription: c.op,
    AmountValue: c.value,
  }));

  const fmtScore = sc => ({
    FilterByScore: true,
    ScoreMetric:   sc?.col || '',
    Conditions:    (sc?.conditions || []).map(c => ({ OperatorDescription: c.op, ScoreValue: c.value })),
  });

  const scoreInfoPayload = scores?.length
    ? scores.map(fmtScore)
    : [fmtScore(score)];

  const payload = {
    AmountInformation: {
      FilterByAmount: !!(amount?.active),
      AmountMetric:   amount?.col || '',
      Conditions:     amtConditions,
    },
    MerchantInformation: {
      SelectedColumn: '',
      ColumnOperator: 'isin',
      MerchantList:   [],
    },
    ScoreInformation: scoreInfoPayload,
    AdditionalColumns: additionalColumns,
  };

  return APP_ApplyTemplate(source, payload);
}

function App_HideAllViews() {
  document.querySelectorAll('.main > *').forEach(el => {
    el.classList.remove('visible');
    el.style.setProperty('display', 'none', 'important');
  });
  document.querySelector('.shell')?.classList.remove('anra-active', 'sa-active', 'sc-active', 'ia-active', 'pr-active');
  document.querySelector('.shell')?.classList.remove('pg-active');
  ['ANRA_MiniNav', 'IA_MiniNav', 'SA_MiniNav', 'SC_MiniNav', 'PR_MiniNav', 'PG_MiniNav'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
}

function IA_Open() {
  App_HideAllViews();
  document.querySelector('.shell').classList.add('ia-active');
  document.getElementById('IAView').style.display = '';
  document.getElementById('IA_MiniNav').style.display = 'flex';
  Sidebar_SetActive('nav-individual-analysis');
  IA_MiniNav_RenderParams();
}

function PR_Open() {
  App_HideAllViews();
  document.querySelector('.shell').classList.add('pr-active');
  document.getElementById('PRView').style.display = '';
  document.getElementById('PR_MiniNav').style.display = 'flex';
  Sidebar_SetActive('nav-policy-rules');
  PR_MiniNav_RenderParams();
}

function RA_Open() {
  App_HideAllViews();
  document.querySelector('.shell').classList.add('anra-active');
  document.getElementById('RAView').style.display = '';
  document.getElementById('ANRA_MiniNav').style.display = 'flex';
  Sidebar_SetActive('nav-route-analysis');
  ANRA_MiniNav_RenderParams();
  ANRA_MiniNav_PopulateCols();
  if (typeof ANRA_RefreshRouteBtns    === 'function') ANRA_RefreshRouteBtns();
  if (typeof ANRA_MiniNav_OpenDefaults === 'function') ANRA_MiniNav_OpenDefaults();
}

function App_ShowLanding() {
  App_HideAllViews();
  const el = document.getElementById('main-placeholder');
  if (el) el.style.removeProperty('display');
}

document.addEventListener('DOMContentLoaded', () => {
  App_HideAllViews();

  // Global pg-table column selection — click a th to highlight its column.
  // Skips th elements that already have an inline onclick (they manage their own state).
  document.addEventListener('click', e => {
    const th = e.target.closest('.pg-table th');
    if (!th || th.hasAttribute('onclick')) return;
    const table = th.closest('.pg-table');
    if (!table) return;
    const idx = Array.from(th.parentElement.children).indexOf(th);
    const isSelected = th.classList.contains('pg-col-selected');

    // Clear all selections in this table
    table.querySelectorAll('th.pg-col-selected, td.pg-col-selected')
         .forEach(el => el.classList.remove('pg-col-selected'));

    // Toggle on if it wasn't already selected
    if (!isSelected) {
      th.classList.add('pg-col-selected');
      table.querySelectorAll('tbody tr').forEach(row => {
        const td = row.children[idx];
        if (td) td.classList.add('pg-col-selected');
      });
    }
  });
});
