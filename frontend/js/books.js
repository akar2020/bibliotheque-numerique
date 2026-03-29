// ================================================
// books.js — Page Livres + Exemplaires
// ================================================
let allBooks = [];

// ================================================
// Rendu principal de la page
// ================================================
async function renderBooks() {
  document.getElementById('pageTitle').textContent = 'Livres';
  const container = document.getElementById('mainContent');
  container.innerHTML = `<div class="loading"><div class="spinner"></div> Chargement des livres...</div>`;
  try {
    const res = await API.books.getAll();
    allBooks = res.data;
    renderBooksUI(allBooks);
  } catch (err) {
    container.innerHTML = `<div class="empty-state">❌<p>${escHtml(err.message)}</p></div>`;
  }
}

function renderBooksUI(books) {
  document.getElementById('mainContent').innerHTML = `
    <div class="page-header">
      <div><h2>📖 Livres</h2><p>${books.length} titre(s) dans le catalogue</p></div>
      <button class="btn btn-primary" onclick="openBookModal()">+ Ajouter un livre</button>
    </div>
    <div class="section-card">
      <div class="section-header">
        <div class="search-bar">
          <div class="search-input-wrap">
            <input type="text" id="bookSearch" placeholder="Rechercher par titre, auteur, ISBN..." />
          </div>
        </div>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Titre</th>
              <th>Auteur</th>
              <th>ISBN</th>
              <th>Catégorie</th>
              <th>Stock (Dispo / Total)</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody id="booksTableBody">${renderBooksRows(books)}</tbody>
        </table>
      </div>
    </div>
  `;

  document.getElementById('bookSearch').addEventListener('input', async (e) => {
    const q = e.target.value.trim();
    if (!q) {
      document.getElementById('booksTableBody').innerHTML = renderBooksRows(allBooks);
      return;
    }
    try {
      const res = await API.books.search(q);
      document.getElementById('booksTableBody').innerHTML = renderBooksRows(res.data);
    } catch {
      document.getElementById('booksTableBody').innerHTML = renderBooksRows([]);
    }
  });
}

function renderBooksRows(books) {
  if (!books.length) {
    return `<tr><td colspan="7"><div class="empty-state">📭<p>Aucun livre trouvé</p></div></td></tr>`;
  }
  return books.map((b, i) => {
    // Support des deux nomenclatures (available_copies du nouveau backend, available de l'ancien)
    const dispo = b.available_copies ?? b.available ?? 0;
    const total = b.total_copies    ?? b.quantity  ?? 0;
    const cls   = dispo === 0 ? 'out' : dispo <= 1 ? 'low' : 'ok';

    return `<tr>
      <td>${i + 1}</td>
      <td><strong>${escHtml(b.title)}</strong></td>
      <td>${escHtml(b.author)}</td>
      <td><code>${escHtml(b.isbn)}</code></td>
      <td>${b.category ? `<span class="badge badge-info">${escHtml(b.category)}</span>` : '—'}</td>
      <td><span class="avail ${cls}">${dispo} / ${total}</span></td>
      <td>
        <div class="actions-cell">
          <button class="btn btn-sm btn-outline" title="Exemplaires" onclick="viewCopies(${b.id}, '${escHtml(b.title)}')">📋</button>
          <button class="btn btn-sm btn-outline" title="Modifier"    onclick="openBookModal(${b.id})">✏️</button>
          <button class="btn btn-sm btn-danger"  title="Supprimer"   onclick="deleteBook(${b.id}, '${escHtml(b.title)}')">🗑️</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

// ================================================
// Modal : Ajouter / Modifier un livre
// ================================================
async function openBookModal(id = null) {
  let book = null;
  if (id) {
    try { book = (await API.books.getById(id)).data; } catch {}
  }

  openModal(id ? 'Modifier le livre' : 'Ajouter un livre', `
    <form id="bookForm">
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Titre <span>*</span></label>
          <input class="form-control" name="title" value="${book ? escHtml(book.title) : ''}" required />
        </div>
        <div class="form-group">
          <label class="form-label">Auteur <span>*</span></label>
          <input class="form-control" name="author" value="${book ? escHtml(book.author) : ''}" required />
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">ISBN <span>*</span></label>
          <input class="form-control" name="isbn" value="${book ? escHtml(book.isbn) : ''}" ${id ? 'readonly style="background:var(--gray-100)"' : ''} required />
        </div>
        <div class="form-group">
          <label class="form-label">Catégorie</label>
          <input class="form-control" name="category" value="${book?.category ? escHtml(book.category) : ''}" />
        </div>
      </div>
      ${!id ? `
      <div class="form-group">
        <label class="form-label">Nombre d'exemplaires à créer</label>
        <input class="form-control" type="number" name="quantity" min="1" value="1" />
        <small style="color:var(--gray-400);font-size:0.78rem">Des codes-barres seront générés automatiquement.</small>
      </div>` : `
      <div style="background:var(--gray-50);border-radius:8px;padding:10px 14px;margin-bottom:16px;font-size:0.85rem;color:var(--gray-500)">
        💡 Pour modifier le stock, utilisez le bouton <strong>📋 Exemplaires</strong> dans la liste.
      </div>`}
      <div class="form-group">
        <label class="form-label">Description</label>
        <textarea class="form-control" name="description" rows="3">${book?.description ? escHtml(book.description) : ''}</textarea>
      </div>
      <div class="form-actions">
        <button type="button" class="btn btn-outline" onclick="closeModal()">Annuler</button>
        <button type="submit" class="btn btn-primary">💾 Enregistrer</button>
      </div>
    </form>
  `);

  document.getElementById('bookForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(e.target).entries());
    try {
      if (id) {
        await API.books.update(id, body);
        showToast('Livre mis à jour.', 'success');
      } else {
        await API.books.create(body);
        showToast('Livre ajouté avec ses exemplaires.', 'success');
      }
      closeModal();
      renderBooks();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
}

// ================================================
// Supprimer un livre
// ================================================
async function deleteBook(id, title) {
  if (!confirm(`Supprimer "${title}" et tous ses exemplaires ?`)) return;
  try {
    await API.books.delete(id);
    showToast('Livre supprimé.', 'success');
    renderBooks();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ================================================
// Modal : Gérer les exemplaires d'un livre
// ================================================
async function viewCopies(bookId, title) {
  // Afficher un loader dans la modal pendant le chargement
  openModal(`📋 Exemplaires — ${escHtml(title)}`, `
    <div class="loading"><div class="spinner"></div> Chargement des exemplaires...</div>
  `);

  try {
    const res = await API.books.getCopies(bookId);
    const copies = res.data;

    document.getElementById('modalBody').innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:10px">
        <span style="font-size:0.88rem;color:var(--gray-500)">${copies.length} exemplaire(s) au total</span>
        <button class="btn btn-primary btn-sm" onclick="addCopyModal(${bookId}, '${escHtml(title)}')">+ Ajouter un exemplaire</button>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Code-barre</th>
              <th>Statut</th>
              <th>Emprunteur actuel</th>
              <th>Date limite</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${copies.length === 0
              ? `<tr><td colspan="5"><div class="empty-state">📭<p>Aucun exemplaire enregistré</p></div></td></tr>`
              : copies.map(c => `
                <tr>
                  <td><code>${escHtml(c.barcode)}</code></td>
                  <td>${copyStatusBadge(c.status)}</td>
                  <td>${c.current_borrower ? escHtml(c.current_borrower) : '—'}</td>
                  <td>${c.current_due_date ? formatDate(c.current_due_date) : '—'}</td>
                  <td>
                    <div class="actions-cell">
                      ${c.status !== 'loaned' ? `
                        <button class="btn btn-sm btn-warning" title="Signaler endommagé"
                          onclick="updateCopyStatus(${bookId}, ${c.id}, 'damaged', '${escHtml(title)}')">🔧</button>
                        <button class="btn btn-sm btn-outline" title="Signaler perdu"
                          onclick="updateCopyStatus(${bookId}, ${c.id}, 'lost', '${escHtml(title)}')">❓</button>
                        ${c.status !== 'available' ? `
                          <button class="btn btn-sm btn-success" title="Remettre disponible"
                            onclick="updateCopyStatus(${bookId}, ${c.id}, 'available', '${escHtml(title)}')">✅</button>
                        ` : ''}
                        <button class="btn btn-sm btn-danger" title="Supprimer"
                          onclick="deleteCopy(${bookId}, ${c.id}, '${escHtml(title)}')">🗑️</button>
                      ` : `<span style="color:var(--gray-400);font-size:0.8rem">En cours de prêt</span>`}
                    </div>
                  </td>
                </tr>`
              ).join('')}
          </tbody>
        </table>
      </div>
    `;
  } catch (err) {
    document.getElementById('modalBody').innerHTML = `<div class="empty-state">❌<p>${escHtml(err.message)}</p></div>`;
  }
}

// ================================================
// Modal : Ajouter un exemplaire manuellement
// ================================================
async function addCopyModal(bookId, title) {
  openModal(`➕ Nouvel exemplaire — ${escHtml(title)}`, `
    <form id="addCopyForm">
      <div class="form-group">
        <label class="form-label">Code-barre <span style="color:var(--gray-400);font-weight:400">(optionnel)</span></label>
        <input class="form-control" name="barcode" placeholder="Laissez vide pour générer automatiquement" />
      </div>
      <div class="form-actions">
        <button type="button" class="btn btn-outline" onclick="viewCopies(${bookId}, '${escHtml(title)}')">← Retour</button>
        <button type="submit" class="btn btn-primary">➕ Ajouter</button>
      </div>
    </form>
  `);

  document.getElementById('addCopyForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const barcode = e.target.barcode.value.trim();
    try {
      await API.books.addCopy(bookId, barcode ? { barcode } : {});
      showToast('Exemplaire ajouté.', 'success');
      viewCopies(bookId, title); // Retour à la liste
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
}

// ================================================
// Changer le statut d'un exemplaire
// ================================================
async function updateCopyStatus(bookId, copyId, status, title) {
  const labels = { damaged: 'endommagé', lost: 'perdu', available: 'disponible' };
  if (!confirm(`Marquer cet exemplaire comme ${labels[status]} ?`)) return;
  try {
    await API.books.updateCopyStatus(bookId, copyId, { status });
    showToast(`Exemplaire marqué comme ${labels[status]}.`, 'success');
    viewCopies(bookId, title);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ================================================
// Supprimer un exemplaire
// ================================================
async function deleteCopy(bookId, copyId, title) {
  if (!confirm('Supprimer définitivement cet exemplaire ?')) return;
  try {
    await API.books.deleteCopy(bookId, copyId);
    showToast('Exemplaire supprimé.', 'success');
    viewCopies(bookId, title);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ================================================
// Badge statut exemplaire
// ================================================
function copyStatusBadge(status) {
  const map = {
    available : ['badge-success', '✅ Disponible'],
    loaned    : ['badge-warning', '📤 Emprunté'],
    damaged   : ['badge-danger',  '🔧 Endommagé'],
    lost      : ['badge-gray',    '❓ Perdu'],
  };
  const [cls, label] = map[status] || ['badge-gray', status];
  return `<span class="badge ${cls}">${label}</span>`;
}
