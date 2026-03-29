// ================================================
// auth.js — Authentification & sécurité des pages
// ================================================

const HOST_AUTH = window.location.hostname;
const AUTH_BASE = `http://${HOST_AUTH}:3000`; // Adapter le port à votre backend auth

const Auth = {
  // --- Clés de stockage ---
  KEYS: {
    ACCESS:   'dit_access_token',
    REFRESH:  'dit_refresh_token',
    USER:     'dit_user',
  },

  // --- Getters / Setters ---
  getAccessToken()  { return localStorage.getItem(this.KEYS.ACCESS); },
  getRefreshToken() { return localStorage.getItem(this.KEYS.REFRESH); },
  getUser()         { try { return JSON.parse(localStorage.getItem(this.KEYS.USER)); } catch { return null; } },

  setTokens(accessToken, refreshToken) {
    localStorage.setItem(this.KEYS.ACCESS,  accessToken);
    localStorage.setItem(this.KEYS.REFRESH, refreshToken);
  },

  setUser(user) {
    localStorage.setItem(this.KEYS.USER, JSON.stringify(user));
  },

  clearSession() {
    localStorage.removeItem(this.KEYS.ACCESS);
    localStorage.removeItem(this.KEYS.REFRESH);
    localStorage.removeItem(this.KEYS.USER);
  },

  isAuthenticated() {
    const token = this.getAccessToken();
    if (!token) return false;
    try {
      // Vérification de l'expiration côté client (sans vérifier la signature)
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.exp * 1000 > Date.now();
    } catch {
      return false;
    }
  },

  // --- Requête HTTP avec auth ---
  async _req(url, method = 'GET', body = null, withAuth = true) {
    const headers = { 'Content-Type': 'application/json' };
    if (withAuth) {
      const token = this.getAccessToken();
      if (token) headers['Authorization'] = `Bearer ${token}`;
    }
    const opts = { method, headers };
    if (body) opts.body = JSON.stringify(body);

    const res = await fetch(url, opts);

    // Token expiré → tenter le refresh
    if (res.status === 401 && withAuth) {
      const refreshed = await this.refreshAccessToken();
      if (refreshed) {
        headers['Authorization'] = `Bearer ${this.getAccessToken()}`;
        const retry = await fetch(url, { ...opts, headers });
        return retry;
      } else {
        this.redirectToLogin();
        return null;
      }
    }
    return res;
  },

  // --- Login ---
  async login(username, password) {
    const res = await fetch(`${AUTH_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Identifiants incorrects');

    this.setTokens(data.accessToken, data.refreshToken);
    this.setUser({ username });
    return data;
  },

  // --- Logout ---
  async logout() {
    const refreshToken = this.getRefreshToken();
    if (refreshToken) {
      try {
        await fetch(`${AUTH_BASE}/api/auth/logout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: refreshToken }),
        });
      } catch { /* Ignorer les erreurs réseau au logout */ }
    }
    this.clearSession();
    this.redirectToLogin();
  },

  // --- Refresh Token ---
  async refreshAccessToken() {
    const refreshToken = this.getRefreshToken();
    if (!refreshToken) return false;
    try {
      const res = await fetch(`${AUTH_BASE}/api/auth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: refreshToken }),
      });
      if (!res.ok) return false;
      const data = await res.json();
      localStorage.setItem(this.KEYS.ACCESS, data.accessToken);
      return true;
    } catch {
      return false;
    }
  },

  // --- Forgot Password ---
  async forgotPassword(email) {
    const res = await fetch(`${AUTH_BASE}/api/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Erreur lors de la demande');
    return data;
  },

  // --- Reset Password ---
  async resetPassword(token, newPassword) {
    const res = await fetch(`${AUTH_BASE}/api/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password: newPassword }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Erreur lors de la réinitialisation');
    return data;
  },

  // --- Redirection ---
  redirectToLogin() {
    const path = window.location.pathname;
    const authPages = ['login.html', 'forgot-password.html', 'reset-password.html'];
    const isAuthPage = authPages.some(p => path.endsWith(p));
    if (!isAuthPage) {
      window.location.replace('/login.html'); // replace évite l'historique de navigation
    }
  },

  redirectToApp() {
    window.location.replace('/index.html');
  },

  // --- Protection de page ---
  // Reçoit la liste des scripts à charger APRÈS confirmation de la session.
  // Aucun script de l'app n'est injecté tant que le token n'est pas validé.
  async requireAuth(appScripts = []) {
    // Masquer immédiatement la page pour éviter tout flash
    document.documentElement.style.visibility = 'hidden';

    // 1. Token valide → charger l'app directement
    if (this.isAuthenticated()) {
      await this._loadScripts(appScripts);
      document.documentElement.style.visibility = '';
      return;
    }

    // 2. Token expiré mais refresh token présent → tenter le refresh
    const refreshToken = this.getRefreshToken();
    if (refreshToken) {
      const ok = await this.refreshAccessToken();
      if (ok) {
        await this._loadScripts(appScripts);
        document.documentElement.style.visibility = '';
        return;
      }
    }

    // 3. Aucune session valide → rediriger vers login
    this.clearSession();
    //this.redirectToLogin();
  },

  // Charge une liste de scripts JS séquentiellement dans le DOM
  _loadScripts(scripts) {
    return scripts.reduce((chain, src) => {
      return chain.then(() => new Promise((resolve, reject) => {
        const s    = document.createElement('script');
        s.src      = src;
        s.onload   = resolve;
        s.onerror  = () => reject(new Error(`Impossible de charger ${src}`));
        document.body.appendChild(s);
      }));
    }, Promise.resolve());
  },

  // --- Auto-refresh périodique (toutes les 10 min) ---
  startAutoRefresh() {
    setInterval(async () => {
      if (this.getRefreshToken() && !this.isAuthenticated()) {
        const ok = await this.refreshAccessToken();
        if (!ok) this.redirectToLogin();
      }
    }, 10 * 60 * 1000);
  },
};
