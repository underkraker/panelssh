// ═══════════════════════════════════════════════════════════
// App — Main SPA Router & Controller
// ═══════════════════════════════════════════════════════════

const App = {
  user: null,
  panel: null,
  currentPage: null,
  ws: null,

  pages: {
    dashboard: { title: 'Dashboard', module: () => DashboardModule.render(), icon: 'fa-chart-pie' },
    users: { title: 'Usuarios', module: () => UsersModule.render(), icon: 'fa-users' },
    demos: { title: 'Demos', module: () => DemosModule.render(), icon: 'fa-clock' },
    resellers: { title: 'Resellers', module: () => ResellersModule.render(), icon: 'fa-store', admin: true },
    services: { title: 'Servicios', module: () => ServicesModule.render(), icon: 'fa-server', admin: true },
    logs: { title: 'Logs', module: () => LogsModule.render(), icon: 'fa-scroll' },
    settings: { title: 'Ajustes', module: () => SettingsModule.render(), icon: 'fa-gear' }
  },

  async init() {
    // Check auth
    try {
      const data = await API.get('/api/auth/me');
      this.user = data.user;
      this.panel = data.panel || { allowedPages: Object.keys(this.pages), features: {} };
      this.showApp();
    } catch (e) {
      this.showLogin();
    }

    // Login form
    document.getElementById('login-form').addEventListener('submit', (e) => {
      e.preventDefault();
      this.login();
    });

    // Logout
    document.getElementById('btn-logout').addEventListener('click', () => this.logout());

    // Nav items
    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const page = item.dataset.page;
        this.navigate(page);
      });
    });

    // Sidebar
    Sidebar.init();
  },

  showLogin() {
    document.getElementById('login-screen').style.display = 'flex';
    document.getElementById('app').style.display = 'none';
  },

  showApp() {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('app').style.display = 'flex';
    document.getElementById('sidebar-username').textContent = this.user.username;
    const allowedPages = Array.isArray(this.panel && this.panel.allowedPages)
      ? this.panel.allowedPages
      : Object.keys(this.pages);

    // Show/hide admin-only items
    if (this.user.role === 'admin') {
      Sidebar.showAllItems();
    } else {
      Sidebar.hideAdminItems();
    }

    Sidebar.applyAllowedPages(allowedPages);

    // Connect WebSocket
    this.connectWS();

    const initial = allowedPages.includes('dashboard') ? 'dashboard' : allowedPages[0];
    if (initial) this.navigate(initial);
  },

  async login() {
    const username = document.getElementById('login-user').value.trim();
    const password = document.getElementById('login-pass').value;
    const errorEl = document.getElementById('login-error');
    const btn = document.getElementById('btn-login');

    if (!username || !password) {
      errorEl.textContent = 'Ingrese usuario y contraseña';
      errorEl.style.display = 'block';
      return;
    }

    btn.disabled = true;
    btn.innerHTML = '<div class="spinner" style="width:18px;height:18px;margin:0"></div>';

    try {
      const data = await API.post('/api/auth/login', { username, password });
      this.user = data.user;
      this.panel = data.panel || { allowedPages: Object.keys(this.pages), features: {} };
      errorEl.style.display = 'none';
      this.showApp();
    } catch (err) {
      errorEl.textContent = err.message;
      errorEl.style.display = 'block';
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<span>Iniciar Sesión</span><i class="fas fa-arrow-right"></i>';
    }
  },

  async logout() {
    try {
      await API.post('/api/auth/logout');
    } catch (e) {}
    
    this.user = null;
    this.panel = null;
    if (this.ws) { this.ws.close(); this.ws = null; }
    this.showLogin();
  },

  navigate(page) {
    if (!this.pages[page]) return;
    const allowedPages = Array.isArray(this.panel && this.panel.allowedPages)
      ? this.panel.allowedPages
      : Object.keys(this.pages);
    if (!allowedPages.includes(page)) {
      Toast.error('Modulo no disponible en este panel');
      return;
    }
    const pageConfig = this.pages[page];
    
    // Admin-only check
    if (pageConfig.admin && this.user.role !== 'admin') {
      Toast.error('Acceso denegado');
      return;
    }

    // Destroy previous modules
    if (this.currentPage === 'demos' && typeof DemosModule !== 'undefined') {
      DemosModule.destroy();
    }

    this.currentPage = page;
    
    // Update UI
    Sidebar.setActiveItem(page);
    Topbar.setTitle(pageConfig.title);
    
    // Animate content
    const content = document.getElementById('content');
    content.style.animation = 'none';
    content.offsetHeight; // trigger reflow
    content.style.animation = 'fadeIn 0.3s ease';
    
    // Render module
    pageConfig.module();
  },

  connectWS() {
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${location.host}/ws`;

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        Topbar.setConnectionStatus(true);
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'port_status') {
            // Update services page if active
            if (this.currentPage === 'services') {
              ServicesModule.updateFromWS(msg.data);
            }
          }
        } catch (e) {}
      };

      this.ws.onclose = () => {
        Topbar.setConnectionStatus(false);
        // Reconnect after 5s
        setTimeout(() => {
          if (this.user) this.connectWS();
        }, 5000);
      };

      this.ws.onerror = () => {
        Topbar.setConnectionStatus(false);
      };
    } catch (e) {
      console.error('[WS] Connection error:', e);
    }
  }
};

// ── Initialize ───────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => App.init());
