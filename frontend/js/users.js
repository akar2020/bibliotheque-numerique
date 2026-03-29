// ================================================
// users.js — Page Utilisateurs
// ================================================
const USER_TYPES = ['Etudiant', 'Professeur', 'Personnel administratif'];

async function renderUsers() {
  document.getElementById('pageTitle').textContent = 'Utilisateurs';
  const container = document.getElementById('mainContent');
  container.innerHTML = `<div class="loading"><div class="spinner"></div> Chargement...</div>`;
  try {
    const res = await API.users.getAll();
    renderUsersUI(res.data);
  } catch (err) {
    container.innerHTML = `<div class="empty-state">❌<p>${escHtml(err.message)}</p></div>`;
  }
}

function renderUsersUI(users) {
  const etudiants = users.filter(u => u.type === 'Etudiant').length;
  const profs     = users.filter(u => u.type === 'Professeur').length;
  const perso     = users.filter(u => u.type === 'Personnel administratif').length;

  document.getElementById('mainContent').innerHTML = `
    <div class="page-header">
      <div><h2>👥 Utilisateurs</h2><p>${users.length} utilisateur(s)</p></div>
      <button class="btn btn-primary" onclick="openUserModal()">+ Ajouter</button>
    </div>
    <div class="stats-grid" style="margin-bottom:22px">
      <div class="stat-card blue"><div class="stat-icon">🎓</div><div class="stat-info"><div class="stat-value">${etudiants}</div><div class="stat-label">Étudiants</div></div></div>
      <div class="stat-card purple"><div class="stat-icon">👨‍🏫</div><div class="stat-info"><div class="stat-value">${profs}</div><div class="stat-label">Professeurs</div></div></div>
      <div class="stat-card green"><div class="stat-icon">💼</div><div class="stat-info"><div class="stat-value">${perso}</div><div class="stat-label">Personnel</div></div></div>
    </div>
    <div class="section-card">
      <div class="filter-tabs" id="userFilterTabs">
        <button class="filter-tab active" data-type="">Tous</button>
        <button class="filter-tab" data-type="Etudiant">Étudiants</button>
        <button class="filter-tab" data-type="Professeur">Professeurs</button>
        <button class="filter-tab" data-type="Personnel administratif">Personnel</button>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>#</th><th>Nom</th><th>Email</th><th>Type</th><th>Téléphone</th><th>ID</th><th>Actions</th></tr></thead>
          <tbody id="usersTableBody">${renderUsersRows(users)}</tbody>
        </table>
      </div>
    </div>
  `;

  document.querySelectorAll('#userFilterTabs .filter-tab').forEach(btn => {
    btn.addEventListener('click', async () => {
      document.querySelectorAll('#userFilterTabs .filter-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      try {
        const res = await API.users.getAll(btn.dataset.type || undefined);
        document.getElementById('usersTableBody').innerHTML = renderUsersRows(res.data);
      } catch {}
    });
  });
}

function renderUsersRows(users) {
  if (!users.length) return `<tr><td colspan="7"><div class="empty-state">📭<p>Aucun utilisateur</p></div></td></tr>`;
  return users.map((u, i) => `<tr>
    <td>${i+1}</td>
    <td><strong>${escHtml(u.name)}</strong></td>
    <td>${escHtml(u.email)}</td>
    <td>${userTypeBadge(u.type)}</td>
    <td>${u.phone ? escHtml(u.phone) : '—'}</td>
    <td>${u.student_id ? `<code>${escHtml(u.student_id)}</code>` : '—'}</td>
    <td><div class="actions-cell">
      <button class="btn btn-sm btn-outline" onclick="viewUserProfile(${u.id})">👁️</button>
      <button class="btn btn-sm btn-outline" onclick="openUserModal(${u.id})">✏️</button>
      <button class="btn btn-sm btn-danger"  onclick="deleteUser(${u.id},'${escHtml(u.name)}')">🗑️</button>
    </div></td>
  </tr>`).join('');
}

async function viewUserProfile(id) {
  try {
    const user  = (await API.users.getById(id)).data;
    const loans = (await API.loans.getByUser(id)).data;
    const active = loans.filter(l => l.status !== 'returned');
    openModal(`Profil — ${escHtml(user.name)}`, `
      <div style="text-align:center;margin-bottom:18px">
        <div style="font-size:2.5rem;margin-bottom:8px">👤</div>
        <div style="font-weight:700;font-size:1.1rem">${escHtml(user.name)}</div>
        <div style="color:var(--gray-500)">${escHtml(user.email)}</div>
        <div style="margin-top:6px">${userTypeBadge(user.type)}</div>
      </div>
      ${user.phone ? `<p style="margin-bottom:6px;font-size:.88rem">📞 ${escHtml(user.phone)}</p>` : ''}
      ${user.student_id ? `<p style="margin-bottom:14px;font-size:.88rem">🪪 ${escHtml(user.student_id)}</p>` : ''}
      <hr style="border:none;border-top:1px solid var(--gray-200);margin-bottom:14px">
      <p style="font-weight:600;margin-bottom:10px">Emprunts en cours (${active.length})</p>
      ${active.length === 0
        ? `<p style="color:var(--gray-400)">Aucun emprunt actif.</p>`
        : active.map(l => `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--gray-100)">
              <span style="font-size:.87rem">${escHtml(l.book_title)}</span>
              <span>${loanStatusBadge(l.status)}</span>
            </div>`).join('')}
    `);
  } catch (err) { showToast(err.message, 'error'); }
}

async function openUserModal(id = null) {
  let user = null;
  if (id) { try { user = (await API.users.getById(id)).data; } catch {} }
  openModal(id ? 'Modifier' : 'Nouvel utilisateur', `
    <form id="userForm">
      <div class="form-row">
        <div class="form-group"><label class="form-label">Nom <span>*</span></label>
          <input class="form-control" name="name" value="${user ? escHtml(user.name) : ''}" required /></div>
        <div class="form-group"><label class="form-label">Email <span>*</span></label>
          <input class="form-control" type="email" name="email" value="${user ? escHtml(user.email) : ''}" required /></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">Type</label>
          <select class="form-control" name="type">
            ${USER_TYPES.map(t => `<option value="${t}" ${user && user.type===t?'selected':''}>${t}</option>`).join('')}
          </select></div>
        <div class="form-group"><label class="form-label">Téléphone</label>
          <input class="form-control" name="phone" value="${user && user.phone ? escHtml(user.phone) : ''}" /></div>
      </div>
      <div class="form-group"><label class="form-label">Identifiant étudiant</label>
        <input class="form-control" name="student_id" value="${user && user.student_id ? escHtml(user.student_id) : ''}" /></div>
      <div class="form-actions">
        <button type="button" class="btn btn-outline" onclick="closeModal()">Annuler</button>
        <button type="submit" class="btn btn-primary">💾 Enregistrer</button>
      </div>
    </form>
  `);
  document.getElementById('userForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(e.target).entries());
    try {
      if (id) { await API.users.update(id, body); showToast('Utilisateur mis à jour.', 'success'); }
      else     { await API.users.create(body);    showToast('Utilisateur créé.', 'success'); }
      closeModal(); renderUsers();
    } catch (err) { showToast(err.message, 'error'); }
  });
}

async function deleteUser(id, name) {
  if (!confirm(`Supprimer "${name}" ?`)) return;
  try { await API.users.delete(id); showToast('Supprimé.', 'success'); renderUsers(); }
  catch (err) { showToast(err.message, 'error'); }
}

function userTypeBadge(type) {
  const map = { 'Etudiant':'badge-info','Professeur':'badge-purple','Personnel administratif':'badge-gray' };
  return `<span class="badge ${map[type]||'badge-gray'}">${escHtml(type)}</span>`;
}
