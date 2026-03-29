// ================================================
// api.js — Client HTTP centralisé (avec auth JWT)
// ================================================

const HOST = window.location.hostname;

const API = {
  BOOKS : `http://${HOST}:3001`,
  USERS : `http://${HOST}:3002`,
  LOANS : `http://${HOST}:3003`,

  async _req(url, method = 'GET', body = null) {
    const headers = { 'Content-Type': 'application/json' };

    // Injection automatique du token JWT
    const token = typeof Auth !== 'undefined' ? Auth.getAccessToken() : null;
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const opts = { method, headers };
    if (body) opts.body = JSON.stringify(body);

    try {
      let res = await fetch(url, opts);
/*
      // Token expiré → tentative de refresh silencieux
      if (res.status === 401 && typeof Auth !== 'undefined') {
        const refreshed = await Auth.refreshAccessToken();
        if (refreshed) {
          headers['Authorization'] = `Bearer ${Auth.getAccessToken()}`;
          res = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : null });
        } else {
          Auth.redirectToLogin();
          throw new Error('Session expirée. Redirection en cours...');
        }
      }
*/
      const data = await res.json();
      if (!data.success && res.status >= 400) throw new Error(data.message || 'Erreur serveur');
      return data;
    } catch (err) {
      if (err instanceof SyntaxError) throw new Error('Réponse invalide du serveur');
      throw err;
    }
  },

  books: {
    // --- Livres ---
    getAll   : ()          => API._req(`${API.BOOKS}/api/books`),
    search   : (q)         => API._req(`${API.BOOKS}/api/books/search?q=${encodeURIComponent(q)}`),
    getById  : (id)        => API._req(`${API.BOOKS}/api/books/${id}`),
    create   : (body)      => API._req(`${API.BOOKS}/api/books`, 'POST', body),
    update   : (id, b)     => API._req(`${API.BOOKS}/api/books/${id}`, 'PUT', b),
    delete   : (id)        => API._req(`${API.BOOKS}/api/books/${id}`, 'DELETE'),
    health   : ()          => API._req(`${API.BOOKS}/health`),

    // --- Exemplaires ---
    getCopies       : (bookId)              => API._req(`${API.BOOKS}/api/books/${bookId}/copies`),
    addCopy         : (bookId, body)        => API._req(`${API.BOOKS}/api/books/${bookId}/copies`, 'POST', body),
    updateCopyStatus: (bookId, copyId, b)   => API._req(`${API.BOOKS}/api/books/${bookId}/copies/${copyId}`, 'PATCH', b),
    deleteCopy      : (bookId, copyId)      => API._req(`${API.BOOKS}/api/books/${bookId}/copies/${copyId}`, 'DELETE'),
  },

  users: {
    getAll  : (type)  => API._req(`${API.USERS}/api/users${type ? `?type=${encodeURIComponent(type)}` : ''}`),
    getById : (id)    => API._req(`${API.USERS}/api/users/${id}`),
    create  : (body)  => API._req(`${API.USERS}/api/users`, 'POST', body),
    update  : (id, b) => API._req(`${API.USERS}/api/users/${id}`, 'PUT', b),
    delete  : (id)    => API._req(`${API.USERS}/api/users/${id}`, 'DELETE'),
    health  : ()      => API._req(`${API.USERS}/health`),
  },

  loans: {
    getAll    : ()     => API._req(`${API.LOANS}/api/loans`),
    getOverdue: ()     => API._req(`${API.LOANS}/api/loans/overdue`),
    getHistory: ()     => API._req(`${API.LOANS}/api/loans/history`),
    getByUser : (uid)  => API._req(`${API.LOANS}/api/loans/user/${uid}`),
    create    : (body) => API._req(`${API.LOANS}/api/loans`, 'POST', body),
    return    : (id)   => API._req(`${API.LOANS}/api/loans/${id}/return`, 'PUT'),
    health    : ()     => API._req(`${API.LOANS}/health`),
  },
};
