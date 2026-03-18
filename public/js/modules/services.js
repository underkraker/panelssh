// Services Module
const ServicesModule = {
  serviceIcons: {
    ssh: 'fa-terminal',
    stunnel: 'fa-shield-halved',
    squid: 'fa-globe',
    v2ray: 'fa-rocket',
    websocket: 'fa-plug'
  },

  serviceNames: {
    ssh: 'SSH Directo',
    stunnel: 'SSL/TLS (Stunnel)',
    squid: 'Squid Proxy',
    v2ray: 'V2Ray / Xray',
    websocket: 'WebSocket Tunnel'
  },

  serviceDescriptions: {
    ssh: 'Conexión SSH directa al servidor. Modifica /etc/ssh/sshd_config.',
    stunnel: 'Túnel SSL/TLS con certificados Let\'s Encrypt.',
    squid: 'Proxy HTTP con cabeceras para HTTP Custom / Injector.',
    v2ray: 'Protocolos VMess y VLESS con transporte WebSocket.',
    websocket: 'Túnel WebSocket para aplicaciones como HTTP Custom.'
  },

  async render() {
    const content = document.getElementById('content');
    content.innerHTML = '<div class="spinner"></div>';

    try {
      const data = await API.get('/api/services/status');
      const services = data.services || [];

      content.innerHTML = `
        <div class="toolbar">
          <div class="toolbar-left">
            <span style="color:var(--text-secondary)"><i class="fas fa-server"></i> ${services.filter(s => s.running).length}/${services.length} servicios activos</span>
          </div>
        </div>

        <div class="service-grid" id="services-grid">
          ${services.map(s => this.renderServiceCard(s)).join('')}
        </div>
      `;
    } catch (err) {
      content.innerHTML = `<div class="empty-state"><i class="fas fa-exclamation-triangle"></i><p>${err.message}</p></div>`;
    }
  },

  renderServiceCard(s) {
    const icon = this.serviceIcons[s.name] || 'fa-circle';
    const name = this.serviceNames[s.name] || s.name;
    const desc = this.serviceDescriptions[s.name] || '';
    const running = s.running || s.enabled;

    return `
      <div class="service-card ${running ? 'running' : 'stopped'}">
        <div class="service-card-header">
          <div class="service-name">
            <i class="fas ${icon}" style="color:${running ? 'var(--green)' : 'var(--text-muted)'}"></i>
            ${name}
          </div>
          <label class="toggle-switch">
            <input type="checkbox" ${running ? 'checked' : ''} onchange="ServicesModule.toggleService('${s.name}')">
            <span class="toggle-slider"></span>
          </label>
        </div>
        <p style="color:var(--text-secondary);font-size:0.82rem;margin-bottom:14px">${desc}</p>
        <div class="service-info">
          <div class="service-info-item">
            <i class="fas fa-network-wired"></i>
            Puerto: <strong>${s.port}</strong>
          </div>
          <div class="service-info-item">
            <span class="service-status-dot ${running ? 'on' : 'off'}"></span>
            ${running ? 'Activo' : 'Inactivo'}
          </div>
        </div>
      </div>
    `;
  },

  async toggleService(name) {
    try {
      const res = await API.post(`/api/services/${name}/toggle`);
      const displayName = this.serviceNames[name] || name;
      Toast.success(`${displayName}: ${res.enabled ? 'Activado' : 'Desactivado'}`);
      this.render();
    } catch (err) {
      Toast.error(err.message);
      this.render(); // revert toggle
    }
  },

  // Called by WebSocket port monitor
  updateFromWS(statusData) {
    const grid = document.getElementById('services-grid');
    if (!grid) return;
    
    for (const [name, info] of Object.entries(statusData)) {
      const card = grid.querySelector(`[data-service="${name}"]`);
      if (!card) continue;
      
      const dot = card.querySelector('.service-status-dot');
      if (dot) {
        dot.className = `service-status-dot ${info.listening ? 'on' : 'off'}`;
      }
    }
  }
};
