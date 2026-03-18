// ═══════════════════════════════════════════════════════════
// API Helper — Fetch wrapper for all API calls
// ═══════════════════════════════════════════════════════════

const API = {
  async request(url, options = {}) {
    try {
      const res = await fetch(url, {
        headers: { 'Content-Type': 'application/json', ...options.headers },
        ...options
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
      return data;
    } catch (err) {
      console.error(`[API] ${url}:`, err.message);
      throw err;
    }
  },

  get(url) { return this.request(url); },
  
  post(url, body) {
    return this.request(url, { method: 'POST', body: JSON.stringify(body) });
  },
  
  put(url, body) {
    return this.request(url, { method: 'PUT', body: JSON.stringify(body) });
  },
  
  delete(url) {
    return this.request(url, { method: 'DELETE' });
  }
};

// Toast Notification System
const Toast = {
  show(message, type = 'info', duration = 4000) {
    const container = document.getElementById('toast-container');
    const icons = {
      success: 'fa-circle-check',
      error: 'fa-circle-xmark',
      warning: 'fa-triangle-exclamation',
      info: 'fa-circle-info'
    };

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<i class="fas ${icons[type]}"></i><span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  },

  success(msg) { this.show(msg, 'success'); },
  error(msg) { this.show(msg, 'error'); },
  warning(msg) { this.show(msg, 'warning'); },
  info(msg) { this.show(msg, 'info'); }
};

// Utility Functions
const Utils = {
  formatDate(dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return d.toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: 'numeric' });
  },

  formatDateTime(dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return d.toLocaleDateString('es-MX', { 
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  },

  daysLeftBadge(daysLeft) {
    if (daysLeft <= 0) return `<span class="days-badge red"><i class="fas fa-exclamation-circle"></i> Expirado</span>`;
    if (daysLeft <= 3) return `<span class="days-badge orange"><i class="fas fa-clock"></i> ${daysLeft}d</span>`;
    return `<span class="days-badge green"><i class="fas fa-check-circle"></i> ${daysLeft}d</span>`;
  },

  statusBadge(status) {
    const map = {
      active: '<span class="badge badge-green">Activo</span>',
      banned: '<span class="badge badge-red">Baneado</span>',
      expired: '<span class="badge badge-orange">Expirado</span>'
    };
    return map[status] || `<span class="badge">${status}</span>`;
  },

  escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  },

  todayDate() {
    return new Date().toISOString().split('T')[0];
  },

  futureDate(days) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
  }
};
