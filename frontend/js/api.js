// ================================================
// api.js — Client HTTP centralisé (avec auth JWT)
// ================================================

const HOST = window.location.hostname;

const API = {
  BOOKS : `/api/books-service`,
  USERS : `/api/users-service`,
  LOANS : `/api/loans-service`,

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
    getAll   : ()          => API._req(`${API.BOOKS}`),
    search   : (q)         => API._req(`${API.BOOKS}/search?q=${encodeURIComponent(q)}`),
    getById  : (id)        => API._req(`${API.BOOKS}/${id}`),
    create   : (body)      => API._req(`${API.BOOKS}`, 'POST', body),
    update   : (id, b)     => API._req(`${API.BOOKS}/${id}`, 'PUT', b),
    delete   : (id)        => API._req(`${API.BOOKS}/${id}`, 'DELETE'),
    health   : ()          => API._req(`${API.BOOKS}/health`),

    // --- Exemplaires ---
    getCopies       : (bookId)              => API._req(`${API.BOOKS}/${bookId}/copies`),
    addCopy         : (bookId, body)        => API._req(`${API.BOOKS}/${bookId}/copies`, 'POST', body),
    updateCopyStatus: (bookId, copyId, b)   => API._req(`${API.BOOKS}/${bookId}/copies/${copyId}`, 'PATCH', b),
    deleteCopy      : (bookId, copyId)      => API._req(`${API.BOOKS}/${bookId}/copies/${copyId}`, 'DELETE'),
  },

  users: {
    getAll  : (type)  => API._req(`${API.USERS}/${type ? `?type=${encodeURIComponent(type)}` : ''}`),
    getById : (id)    => API._req(`${API.USERS}/${id}`),
    create  : (body)  => API._req(`${API.USERS}`, 'POST', body),
    update  : (id, b) => API._req(`${API.USERS}/${id}`, 'PUT', b),
    delete  : (id)    => API._req(`${API.USERS}/${id}`, 'DELETE'),
    health  : ()      => API._req(`${API.USERS}/health`),
  },

  loans: {
    getAll    : ()     => API._req(`${API.LOANS}`),
    getOverdue: ()     => API._req(`${API.LOANS}/overdue`),
    getHistory: ()     => API._req(`${API.LOANS}/history`),
    getByUser : (uid)  => API._req(`${API.LOANS}/user/${uid}`),
    create    : (body) => API._req(`${API.LOANS}`, 'POST', body),
    return    : (id)   => API._req(`${API.LOANS}/${id}/return`, 'PUT'),
    health    : ()     => API._req(`${API.LOANS}/health`),
  },
};
