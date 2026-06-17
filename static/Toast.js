// ── Notification Toast (shared across all pages) ──────────────────────────────
// App_toast(msg, type)  — type: 'success' | 'error' | 'info' | '' (default)

function App_toast(msg, type = '') {
  const container = document.getElementById('LD_ToastContainer');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = 'LD_Toast' + (type ? ' ' + type : '');
  toast.innerHTML = `<span style="flex:1">${msg}</span><button onclick="this.closest('.LD_Toast').remove()" style="background:none;border:none;cursor:pointer;color:var(--color-text-dim);font-size:12px;padding:0 0 0 10px;line-height:1;flex-shrink:0;">✕</button>`;
  toast.style.display = 'flex';
  toast.style.alignItems = 'center';
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('hide');
    toast.addEventListener('animationend', () => toast.remove(), { once: true });
  }, 4000);
}
