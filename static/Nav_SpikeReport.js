// ── Nav_SpikeReport — Spike Report mini-nav ──────────────────────────────────

// ── Scroll indicators ─────────────────────────────────────────────────────────
(function () {
  function _inject() {
    const nav = document.getElementById('SR_MiniNav');
    if (!nav || document.getElementById('SR_ScrollerDown')) return;
    nav.insertAdjacentHTML('afterbegin', `
      <div id="SR_ScrollerUp" onclick="SR_ScrollUp()" title="Scroll up">
        <svg viewBox="0 0 16 8" width="14" height="7" fill="none">
          <polyline points="1 7 8 1 15 7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <div class="MN_ScrollBar"></div>
      </div>`);
    nav.insertAdjacentHTML('beforeend', `
      <div id="SR_ScrollerDown" onclick="SR_ScrollDown()" title="Scroll down">
        <div class="MN_ScrollBar"></div>
        <svg viewBox="0 0 16 8" width="14" height="7" fill="none">
          <polyline points="1 1 8 7 15 1" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>`);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', _inject);
  else _inject();
})();

function SR_ScrollUp()   { document.getElementById('SR_MiniNav')?.scrollBy({ top: -150, behavior: 'smooth' }); }
function SR_ScrollDown() { document.getElementById('SR_MiniNav')?.scrollBy({ top:  150, behavior: 'smooth' }); }

// ── SRM Scroll indicators ─────────────────────────────────────────────────────
(function () {
  function _inject() {
    const nav = document.getElementById('SRM_MiniNav');
    if (!nav || document.getElementById('SRM_ScrollerDown')) return;
    nav.insertAdjacentHTML('afterbegin', `
      <div id="SRM_ScrollerUp" onclick="SRM_ScrollUp()" title="Scroll up">
        <svg viewBox="0 0 16 8" width="14" height="7" fill="none">
          <polyline points="1 7 8 1 15 7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <div class="MN_ScrollBar"></div>
      </div>`);
    nav.insertAdjacentHTML('beforeend', `
      <div id="SRM_ScrollerDown" onclick="SRM_ScrollDown()" title="Scroll down">
        <div class="MN_ScrollBar"></div>
        <svg viewBox="0 0 16 8" width="14" height="7" fill="none">
          <polyline points="1 1 8 7 15 1" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>`);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', _inject);
  else _inject();
})();

function SRM_ScrollUp()   { document.getElementById('SRM_MiniNav')?.scrollBy({ top: -150, behavior: 'smooth' }); }
function SRM_ScrollDown() { document.getElementById('SRM_MiniNav')?.scrollBy({ top:  150, behavior: 'smooth' }); }

// ── Params display ────────────────────────────────────────────────────────────
function SR_RenderParams() {
  if (typeof SP_RenderParamsTo === 'function') SP_RenderParamsTo('SR_ParamsDisplay', 'sr');
}

let _SR_ParamsOpen = false;
function SR_ToggleParams() {
  _SR_ParamsOpen = !_SR_ParamsOpen;
  const body    = document.getElementById('SR_ParamsBody');
  const chevron = document.getElementById('SR_ParamsChevron');
  if (body)    body.style.display      = _SR_ParamsOpen ? 'block' : 'none';
  if (chevron) chevron.style.transform = _SR_ParamsOpen ? 'rotate(90deg)' : 'rotate(0deg)';
}


// ── Analysis Window ───────────────────────────────────────────────────────────
let _SR_WindowOpen = true;
function SR_ToggleWindow() {
  _SR_WindowOpen = !_SR_WindowOpen;
  const body    = document.getElementById('SR_WindowBody');
  const chevron = document.getElementById('SR_WindowChevron');
  if (body)    body.style.display      = _SR_WindowOpen ? 'block' : 'none';
  if (chevron) chevron.style.transform = _SR_WindowOpen ? 'rotate(90deg)' : 'rotate(0deg)';
}

let _SR_Window = '7';
let _SR_Offset = 0;

function SR_SetWindow(val, btn) {
  _SR_Window = val;
  _SR_Offset = 0;
  document.querySelectorAll('#SR_WindowBtns .MN_btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  SR_Run();
}

function SR_ShiftWindow(dir) {
  // dir: -1 = older (left) → increase offset, 1 = newer (right) → decrease offset
  _SR_Offset = Math.max(0, _SR_Offset - dir);
  const nextBtn = document.getElementById('SR_WinNext');
  if (nextBtn) nextBtn.disabled = _SR_Offset === 0;
  SR_Run();
}

function SR_UpdateWindowRange(start, end) {
  const el = document.getElementById('SR_WinRange');
  if (el) el.textContent = start && end ? `${start} → ${end}` : '—';
  const nextBtn = document.getElementById('SR_WinNext');
  if (nextBtn) nextBtn.disabled = _SR_Offset === 0;
}

let _SR_Metric = 'total';
function SR_SetMetric(val, btn) {
  _SR_Metric = val;
  document.querySelectorAll('#SR_MetricBtns .MN_btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  SR_Run();
}

// ── Extra param cards (Decision Mode + custom cards) ─────────────────────────
function SR_RefreshExtraCards() {
  const p  = window.SP_getParams ? window.SP_getParams() : {};
  const el = document.getElementById('SR_ExtraCards');
  if (!el) return;

  const makeCard = (key, title, col, aVals, bVals, labelA, labelB) => {
    const btn = (v, group) =>
      `<button class="MN_btn MN_paramVal" data-col="${col.replace(/"/g,'&quot;')}"
        onclick="SR_ToggleParamVal('${key}','${group}','${v}',this)"
        style="flex:1;min-width:0;height:24px;padding:0 4px;font-size:0.62rem;border-radius:5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${v}</button>`;
    const aBtns = aVals.map(v => btn(v, 'a')).join('');
    const bBtns = bVals.map(v => btn(v, 'b')).join('');
    const none  = `<span style="font-size:0.62rem;color:var(--color-text-dim);">None</span>`;
    return `
      <div class="MN_divider"></div>
      <div id="SR_ExtraSection_${key}">
        <div onclick="SR_ToggleExtra('${key}')" class="MN_section_hdr">
          <span class="MN_title">${title}</span>
          <svg id="SR_ExtraChevron_${key}" viewBox="0 0 16 16" width="11" height="11" fill="none" style="transition:transform 0.18s;transform:rotate(90deg);flex-shrink:0;">
            <polyline points="5 3 11 8 5 13" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="color:var(--color-text-dim);"/>
          </svg>
        </div>
        <div id="SR_ExtraBody_${key}" style="display:block;">
          <div class="MN_section_body">
            <div style="font-size:0.62rem;font-weight:600;letter-spacing:0.05em;text-transform:uppercase;color:var(--color-text-dim);margin-bottom:5px;">Column</div>
            <div style="font-size:0.68rem;color:var(--color-text-dim);background:var(--color-card-bg);border:1px solid var(--color-card-border);border-radius:5px;padding:0 8px;height:28px;display:flex;align-items:center;">${col}</div>
          </div>
          <div class="MN_section_body">
            <div style="font-size:0.62rem;font-weight:600;letter-spacing:0.05em;text-transform:uppercase;color:var(--color-text-dim);margin-bottom:5px;">${labelA}</div>
            <div style="display:flex;gap:3px;">${aBtns || none}</div>
          </div>
          <div class="MN_section_body">
            <div style="font-size:0.62rem;font-weight:600;letter-spacing:0.05em;text-transform:uppercase;color:var(--color-text-dim);margin-bottom:5px;">${labelB}</div>
            <div style="display:flex;gap:3px;">${bBtns || none}</div>
          </div>
        </div>
      </div>`;
  };

  let html = '';
  const dm = p.decisionMode;
  if (dm?.col) {
    html += makeCard('dm', 'Decision Mode', dm.col,
      dm.assigned?.successful   || [],
      dm.assigned?.unsuccessful || [],
      'Successful', 'Unsuccessful');
  }
  (p.customCards || []).forEach((card, i) => {
    html += makeCard(`custom_${i}`, card.name || 'Custom', card.col || '—',
      card.assigned?.a || [], card.assigned?.b || [],
      card.labelA || 'Group A', card.labelB || 'Group B');
  });

  el.innerHTML = html;
}

function SR_ToggleParamVal(key, group, val, btn) {
  btn.classList.toggle('active');
  SR_Run();
}

function SR_ToggleExtra(key) {
  const body    = document.getElementById(`SR_ExtraBody_${key}`);
  const chevron = document.getElementById(`SR_ExtraChevron_${key}`);
  if (!body) return;
  const open = body.style.display !== 'none';
  body.style.display    = open ? 'none' : 'block';
  if (chevron) chevron.style.transform = open ? 'rotate(0deg)' : 'rotate(90deg)';
}

// ── Demo Data ─────────────────────────────────────────────────────────────────
let _SR_demoLoading = false;

async function SR_LoadDemo() {
  if (_SR_demoLoading) return;
  _SR_demoLoading = true;

  const btn = document.getElementById('SR_DemoBtn');
  if (btn) { btn.textContent = 'Loading…'; btn.disabled = true; }

  try {
    const initFn = window.LD_getDB_fn;
    if (typeof initFn !== 'function') {
      alert('DuckDB engine not available — ensure LoadData.js is loaded.');
      return;
    }
    const conn = await initFn();

    await conn.query(`
      CREATE OR REPLACE TABLE sr_demo AS
      SELECT
        'TXN-' || LPAD(rn::VARCHAR, 6, '0')                                       AS transaction_id,
        (DATE '2026-01-01' + (day_n::INTEGER) * INTERVAL '1 day')::VARCHAR         AS transaction_date,
        50 + ((rn * 137) % 951)                                                    AS amount,
        CASE WHEN (rn * 17) % 20 = 0 THEN '1' ELSE '0' END                        AS fraud_flag,
        ((rn * 73) % 1000) / 10.0                                                  AS score,
        CASE (rn * 11) % 5
          WHEN 0 THEN 'VISA' WHEN 1 THEN 'MASTERCARD'
          WHEN 2 THEN 'AMEX' WHEN 3 THEN 'DISCOVER' ELSE 'OTHER' END              AS card_type,
        CASE (rn * 7) % 4
          WHEN 0 THEN 'GB' WHEN 1 THEN 'US'
          WHEN 2 THEN 'DE' ELSE 'FR' END                                            AS card_country,
        CASE (rn * 3) % 3
          WHEN 0 THEN 'ONLINE' WHEN 1 THEN 'POS' ELSE 'ATM' END                   AS channel,
        CASE (rn * 13) % 6
          WHEN 0 THEN 'RETAIL' WHEN 1 THEN 'FOOD' WHEN 2 THEN 'TRAVEL'
          WHEN 3 THEN 'ENTERTAINMENT' WHEN 4 THEN 'HEALTHCARE'
          ELSE 'OTHER' END                                                          AS merchant_category,
        CASE (rn * 19) % 3
          WHEN 0 THEN 'GBP' WHEN 1 THEN 'USD' ELSE 'EUR' END                      AS currency,
        'MERCH-' || LPAD(((rn * 41) % 200 + 1)::VARCHAR, 4, '0')                  AS merchant_id,
        CASE (rn * 23) % 3
          WHEN 0 THEN 'PURCHASE' WHEN 1 THEN 'REFUND' ELSE 'AUTH' END             AS transaction_type
      FROM (
        SELECT ROW_NUMBER() OVER (ORDER BY day_n, txn_n) AS rn, day_n, txn_n
        FROM (
          SELECT days.day_n, txns.txn_n
          FROM (
            SELECT
              gs AS day_n,
              CASE
                WHEN gs IN (12, 27, 45, 63, 81) THEN 85
                WHEN gs IN (13, 28, 46, 64, 82) THEN 65
                ELSE 18
              END AS max_n
            FROM generate_series(0, 89) t(gs)
          ) AS days
          CROSS JOIN generate_series(0, 84) AS txns(txn_n)
          WHERE txns.txn_n < days.max_n
        ) t
        ORDER BY day_n, txn_n
      ) numbered
    `);

    window._SR_demoConn = conn;
    window._SR_demoSrc  = 'sr_demo';

    if (btn) {
      btn.textContent = 'Demo loaded ✓';
      btn.style.cssText += ';color:var(--MN_brand);pointer-events:none;';
    }

    SR_Run();
  } catch (e) {
    if (btn) { btn.textContent = 'Load Demo Data'; btn.disabled = false; }
    alert('Demo load failed: ' + e.message);
  } finally {
    _SR_demoLoading = false;
  }
}

// ── Run ───────────────────────────────────────────────────────────────────────
function SR_GetAddColFilters() {
  const filters = {};
  document.querySelectorAll('#SR_ExtraCards .MN_paramVal.active').forEach(btn => {
    const col = btn.getAttribute('data-col');
    const val = btn.textContent.trim();
    if (!col) return;
    if (!filters[col]) filters[col] = [];
    filters[col].push(val);
  });
  return filters;
}

function SR_Run() {
  const winSize    = _SR_Window;
  const offset     = _SR_Offset;
  const metric     = _SR_Metric;
  const addFilters = SR_GetAddColFilters();
  if (typeof SR_RunAnalysis === 'function') SR_RunAnalysis({ winSize, offset, metric, addFilters });
}

// ── Nav init — called by SR_OpenPanel() in SpikeReport.js ────────────────────
function SR_Open() {
  SR_RenderParams();
  SR_RefreshExtraCards();
  MN_initScrollArrows('SR_MiniNav');
}
