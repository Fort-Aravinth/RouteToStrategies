// ── Popup / Modal helpers ─────────────────────────────────────────────────────

function Popup_open(id)  { document.getElementById(id)?.classList.add('open');    }
function Popup_close(id) { document.getElementById(id)?.classList.remove('open'); }

// ── Playground example modal ──────────────────────────────────────────────────

function PG_openModal()  { Popup_open('PG_Modal');  }
function PG_closeModal() { Popup_close('PG_Modal'); }
