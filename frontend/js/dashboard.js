// ================================================
// dashboard.js — Page Tableau de bord
// ================================================

async function renderDashboard() {
  document.getElementById('pageTitle').textContent = 'Tableau de bord';
  const container = document.getElementById('mainContent');
  container.innerHTML = `<div class="loading"><div class="spinner"></div> Chargement des statistiques...</div>`;

  try {
    const [booksRes, usersRes, loansRes] = await Promise.allSettled([
      API.books.getAll(),
      API.users.getAll(),
      API.loans.getAll(),
    ]);

    const books  = booksRes.status  === 'fulfilled' ? booksRes.value.data  : [];
    const users  = usersRes.status  === 'fulfilled' ? usersRes.value.data  : [];
    const loans  = loansRes.status  === 'fulfilled' ? loansRes.value.data  : [];

    const activeLoans  = loans.filter(l => l.status === 'active').length;
    const overdueLoans = loans.filter(l => l.status === 'overdue').length;
    const returned     = loans.filter(l => l.status === 'returned').length;

    const recentLoans = [...loans]
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 6);

    container.innerHTML = `
      <div class="page-header">
        <div>
          <h2>Tableau de bord</h2>
          <p>Vue d'ensemble de la Bibliothèque Numérique DIT</p>
        </div>
      </div>

      ${overdueLoans > 0 ? `
        <div class="alert-banner">
          ⚠️ <span><strong>${overdueLoans} emprunt(s) en retard</strong> — des livres n'ont pas été retournés à temps.</span>
          <button class="btn btn-sm btn-danger" style="margin-left:auto" onclick="navigate('overdue')">Voir les retards</button>
        </div>` : ''}

      <div class="stats-grid">
        <div class="stat-card blue">
          <div class="stat-icon">📚</div>
          <div class="stat-info">
            <div class="stat-value">${books.length}</div>
            <div class="stat-label">Titres de livres</div>
          </div>
        </div>
        <div class="stat-card green">
          <div class="stat-icon">👥</div>
          <div class="stat-info">
            <div class="stat-value">${users.length}</div>
            <div class="stat-label">Utilisateurs</div>
          </div>
        </div>
        <div class="stat-card purple">
          <div class="stat-icon">🤝</div>
          <div class="stat-info">
            <div class="stat-value">${activeLoans}</div>
            <div class="stat-label">Emprunts actifs</div>
          </div>
        </div>
        <div class="stat-card orange">
          <div class="stat-icon">✅</div>
          <div class="stat-info">
            <div class="stat-value">${returned}</div>
            <div class="stat-label">Retours effectués</div>
          </div>
        </div>
        <div class="stat-card red">
          <div class="stat-icon">⚠️</div>
          <div class="stat-info">
            <div class="stat-value">${overdueLoans}</div>
            <div class="stat-label">En retard</div>
          </div>
        </div>
      </div>

      <div class="section-card">
        <div class="section-header">
          <span class="section-title">🕐 Activité récente</span>
          <button class="btn btn-sm btn-outline" onclick="navigate('loans')">Tout voir</button>
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr><th>Livre</th><th>Utilisateur</th><th>Emprunt</th><th>Retour prévu</th><th>Statut</th></tr>
            </thead>
            <tbody>
              ${recentLoans.length === 0
                ? `<tr><td colspan="5"><div class="empty-state">📭<p>Aucun emprunt enregistré</p></div></td></tr>`
                : recentLoans.map(l => `
                  <tr>
                    <td><strong>${escHtml(l.book_title)}</strong></td>
                    <td>${escHtml(l.user_name)}</td>
                    <td>${formatDate(l.loan_date)}</td>
                    <td>${formatDate(l.due_date)}</td>
                    <td>${loanStatusBadge(l.status)}</td>
                  </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  } catch (err) {
    container.innerHTML = `<div class="empty-state">❌<p>Erreur : ${escHtml(err.message)}</p></div>`;
  }
}
