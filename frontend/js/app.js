// ================================================
// app.js — Routeur, utilitaires, initialisation
// ================================================
const routes = {
  dashboard : renderDashboard,
  books     : renderBooks,
  users     : renderUsers,
  loans     : renderLoans,
  overdue   : renderOverdue,
};

function navigate(page) {
  document.querySelectorAll('.nav-item').forEach(el =>
    el.classList.toggle('active', el.dataset.page === page)
  );
  const render = routes[page];
  if (render) render();
}

// --- MODAL ---
function openModal(title, bodyHtml) {
  document.getElementById('modalTitle').textContent = title;
  document.getElementById('modalBody').innerHTML = bodyHtml;
  document.getElementById('modalOverlay').classList.add('active');
}
function closeModal() {
  document.getElementById('modalOverlay').classList.remove('active');
}

// --- TOAST ---
let toastTimer;
function showToast(msg, type = 'success') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = `toast ${type} show`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 3500);
}

// --- UTILITAIRES ---
function escHtml(str) {
  if (!str) return '';
  return str
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#039;");
}


function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('fr-FR', { day:'2-digit', month:'short', year:'numeric' });
}

function loanStatusBadge(status) {
  const map = {
    active  : ['badge-info',    'Actif'],
    overdue : ['badge-danger',  'En retard'],
    returned: ['badge-success', 'Retourné'],
  };
  const [cls, label] = map[status] || ['badge-gray', status];
  return `<span class="badge ${cls}">${label}</span>`;
}

// --- HEALTH CHECK ---
async function checkHealth() {
  const checks = [
    { fn: API.books.health, id: 'dotBooks', label: 'Books' },
    { fn: API.users.health, id: 'dotUsers', label: 'Users' },
    { fn: API.loans.health, id: 'dotLoans', label: 'Loans' },
  ];
  for (const { fn, id, label } of checks) {
    const dot = document.getElementById(id);
    dot.classList.remove('online','offline');
    try {
      await fn();
      dot.classList.add('online');
      dot.title = `${label} — En ligne ✅`;
    } catch {
      dot.classList.add('offline');
      dot.title = `${label} — Hors ligne ❌`;
    }
  }
}

// --- INIT ---
document.addEventListener('DOMContentLoaded', () => {
  // Navigation
  document.querySelectorAll('.nav-item').forEach(el => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      navigate(el.dataset.page);
      if (window.innerWidth <= 768) document.getElementById('sidebar').classList.remove('open');
    });
  });

  // Mobile menu
  document.getElementById('menuToggle').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('open');
  });

  // Fermer modal
  document.getElementById('modalClose').addEventListener('click', closeModal);
  document.getElementById('modalOverlay').addEventListener('click', (e) => {
    if (e.target.id === 'modalOverlay') closeModal();
  });

  // Health checks
  checkHealth();
  setInterval(checkHealth, 30000);

  // Page initiale
  navigate('dashboard');
});
