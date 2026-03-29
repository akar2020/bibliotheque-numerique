// ================================================
// loans.js — Page Emprunts & Retards
// ================================================

async function renderLoans() {
  document.getElementById('pageTitle').textContent = 'Emprunts';
  const container = document.getElementById('mainContent');
  container.innerHTML = `<div class="loading"><div class="spinner"></div> Chargement...</div>`;
  try {
    const res = await API.loans.getAll();
    renderLoansUI(res.data);
  } catch (err) {
    container.innerHTML = `<div class="empty-state">❌<p>${escHtml(err.message)}</p></div>`;
  }
}

function renderLoansUI(loans) {
  document.getElementById('mainContent').innerHTML = `
    <div class="page-header">
      <div><h2>🤝 Emprunts</h2><p>${loans.length} emprunt(s)</p></div>
      <button class="btn btn-primary" onclick="openLoanModal()">+ Nouvel emprunt</button>
    </div>
    <div class="section-card">
      <div class="filter-tabs" id="loanFilterTabs">
        <button class="filter-tab active" data-status="all">Tous</button>
        <button class="filter-tab" data-status="active">Actifs</button>
        <button class="filter-tab" data-status="overdue">En retard</button>
        <button class="filter-tab" data-status="returned">Retournés</button>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Livre</th>
              <th>Code-barre</th>
              <th>Utilisateur</th>
              <th>Emprunt</th>
              <th>Retour prévu</th>
              <th>Retourné le</th>
              <th>Statut</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody id="loansTableBody">${renderLoansRows(loans)}</tbody>
        </table>
      </div>
    </div>
  `;

  document.querySelectorAll('#loanFilterTabs .filter-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#loanFilterTabs .filter-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const s = btn.dataset.status;
      document.getElementById('loansTableBody').innerHTML =
        renderLoansRows(s === 'all' ? loans : loans.filter(l => l.status === s));
    });
  });
}

function renderLoansRows(loans) {
  if (!loans.length) {
    return `<tr><td colspan="9"><div class="empty-state">📭<p>Aucun emprunt</p></div></td></tr>`;
  }
  return loans.map((l, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>
        <strong>${escHtml(l.book_title)}</strong>
        ${l.book_author ? `<div style="font-size:0.78rem;color:var(--gray-400)">${escHtml(l.book_author)}</div>` : ''}
      </td>
      <td>${l.copy_barcode ? `<code style="font-size:0.78rem">${escHtml(l.copy_barcode)}</code>` : '—'}</td>
      <td>${escHtml(l.user_name)}</td>
      <td>${formatDate(l.loan_date)}</td>
      <td>${formatDate(l.due_date)}</td>
      <td>${l.return_date ? formatDate(l.return_date) : '—'}</td>
      <td>${loanStatusBadge(l.status)}</td>
      <td>
        ${l.status !== 'returned'
          ? `<button class="btn btn-sm btn-success btn-return-loan"
               data-id="${l.id}" data-title="${escHtml(l.book_title)}">↩ Retourner</button>`
          : `<span style="color:var(--gray-400);font-size:.82rem">Terminé</span>`}
      </td>
    </tr>
  `).join('');
}

// ================================================
// Page Retards
// ================================================
async function renderOverdue() {
  document.getElementById('pageTitle').textContent = 'Retards';
  const container = document.getElementById('mainContent');
  container.innerHTML = `<div class="loading"><div class="spinner"></div> Chargement...</div>`;
  try {
    const res = await API.loans.getOverdue();
    const loans = res.data;
    container.innerHTML = `
      <div class="page-header">
        <div><h2>⚠️ Emprunts en retard</h2><p>${loans.length} retard(s)</p></div>
      </div>
      ${loans.length > 0
        ? `<div class="alert-banner">⚠️ <span>Ces livres n'ont pas été retournés dans les délais.</span></div>`
        : ''}
      <div class="section-card">
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>#</th><th>Livre</th><th>Code-barre</th>
                <th>Utilisateur</th><th>Date limite</th><th>Retard</th><th>Action</th>
              </tr>
            </thead>
            <tbody>
              ${loans.length === 0
                ? `<tr><td colspan="7"><div class="empty-state">✅<p>Aucun retard — tout est en ordre !</p></div></td></tr>`
                : loans.map((l, i) => `
                  <tr>
                    <td>${i + 1}</td>
                    <td><strong>${escHtml(l.book_title)}</strong></td>
                    <td>${l.copy_barcode ? `<code style="font-size:0.78rem">${escHtml(l.copy_barcode)}</code>` : '—'}</td>
                    <td>${escHtml(l.user_name)}</td>
                    <td>${formatDate(l.due_date)}</td>
                    <td><span class="badge badge-danger">${l.days_overdue} jour(s)</span></td>
                    <td>
                      <button class="btn btn-sm btn-success btn-return-loan"
                        data-id="${l.id}" data-title="${escHtml(l.book_title)}">↩ Retourner</button>
                    </td>
                  </tr>`
                ).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  } catch (err) {
    container.innerHTML = `<div class="empty-state">❌<p>${escHtml(err.message)}</p></div>`;
  }
}

// ================================================
// Modal : Nouvel emprunt (avec sélection d'exemplaire)
// ================================================
async function openLoanModal() {
  openModal('🤝 Nouvel emprunt', `<div class="loading"><div class="spinner"></div> Chargement...</div>`);

  try {
    const [resB, resU] = await Promise.all([API.books.getAll(), API.users.getAll()]);

    // Ne garder que les livres avec au moins un exemplaire disponible
    const availableBooks = resB.data.filter(b => {
      const dispo = b.available_copies ?? b.available ?? 0;
      return dispo > 0;
    });

    document.getElementById('modalBody').innerHTML = `
      <form id="loanForm">
        <div class="form-group">
          <label class="form-label">Livre <span>*</span></label>
          <select class="form-control" name="book_id" id="bookSelect" required>
            <option value="">-- Sélectionner un titre --</option>
            ${availableBooks.map(b => {
              const dispo = b.available_copies ?? b.available ?? 0;
              const total = b.total_copies    ?? b.quantity  ?? 0;
              return `<option value="${b.id}">${escHtml(b.title)} — ${dispo}/${total} dispo.</option>`;
            }).join('')}
          </select>
          ${availableBooks.length === 0
            ? `<p style="color:var(--warning);font-size:.82rem;margin-top:4px">⚠️ Aucun livre disponible.</p>`
            : ''}
        </div>

        <div class="form-group" id="copyGroup" style="display:none">
          <label class="form-label">Exemplaire <span>*</span></label>
          <select class="form-control" name="copy_id" id="copySelect">
            <option value="">Sélection automatique</option>
          </select>
          <small style="color:var(--gray-400);font-size:0.78rem">
            Laissez sur "Sélection automatique" ou choisissez un code-barre précis.
          </small>
        </div>

        <div class="form-group">
          <label class="form-label">Utilisateur <span>*</span></label>
          <select class="form-control" name="user_id" required>
            <option value="">-- Sélectionner un utilisateur --</option>
            ${resU.data.map(u => `<option value="${u.id}">${escHtml(u.name)} (${escHtml(u.type)})</option>`).join('')}
          </select>
        </div>

        <div class="form-group">
          <label class="form-label">Date de retour prévue</label>
          <input type="date" class="form-control" name="due_date"
            min="${new Date().toISOString().split('T')[0]}" />
          <small style="color:var(--gray-400)">Par défaut : 14 jours</small>
        </div>

        <div class="form-actions">
          <button type="button" class="btn btn-outline" onclick="closeModal()">Annuler</button>
          <button type="submit" class="btn btn-primary">🤝 Enregistrer</button>
        </div>
      </form>
    `;

    // Chargement dynamique des exemplaires disponibles quand on choisit un livre
    document.getElementById('bookSelect').addEventListener('change', async (e) => {
      const bookId = e.target.value;
      const copyGroup  = document.getElementById('copyGroup');
      const copySelect = document.getElementById('copySelect');

      if (!bookId) {
        copyGroup.style.display = 'none';
        return;
      }

      copySelect.innerHTML = `<option value="">Chargement...</option>`;
      copyGroup.style.display = 'block';

      try {
        const resC = await API.books.getCopies(bookId);
        const available = resC.data.filter(c => c.status === 'available');
        copySelect.innerHTML = `
          <option value="">Sélection automatique (${available.length} dispo.)</option>
          ${available.map(c => `<option value="${c.id}">${escHtml(c.barcode)}</option>`).join('')}
        `;
      } catch {
        copySelect.innerHTML = `<option value="">Erreur de chargement</option>`;
      }
    });

    document.getElementById('loanForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const body = Object.fromEntries(new FormData(e.target).entries());
      // Nettoyer les champs vides optionnels
      if (!body.due_date)  delete body.due_date;
      if (!body.copy_id)   delete body.copy_id;
      try {
        await API.loans.create(body);
        showToast('Emprunt enregistré avec succès.', 'success');
        closeModal();
        renderLoans();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });

  } catch (err) {
    document.getElementById('modalBody').innerHTML =
      `<div class="empty-state">❌<p>${escHtml(err.message)}</p></div>`;
  }
}

// ================================================
// Délégation d'événement globale pour les boutons "Retourner"
// (générés dynamiquement dans le DOM)
// ================================================
document.addEventListener('click', (event) => {
  const btn = event.target.closest('.btn-return-loan');
  if (!btn) return;
  const loanId   = btn.getAttribute('data-id');
  const bookTitle = btn.getAttribute('data-title');
  if (confirm(`Confirmer le retour de "${bookTitle}" ?`)) {
    returnLoan(loanId);
  }
});

async function returnLoan(id) {
  try {
    await API.loans.return(id);
    showToast('Livre retourné avec succès.', 'success');
    const active = document.querySelector('.nav-item.active');
    if (active?.dataset.page === 'overdue') renderOverdue();
    else renderLoans();
  } catch (err) {
    showToast(err.message, 'error');
  }
}
