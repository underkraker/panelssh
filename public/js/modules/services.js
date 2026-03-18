// Services Module
const ServicesModule = {
  healthData: null,

  serviceIcons: {
    ssh: 'fa-terminal',
    stunnel: 'fa-shield-halved',
    squid: 'fa-globe',
    v2ray: 'fa-rocket',
    websocket: 'fa-plug',
    badvpn: 'fa-gamepad',
    hysteria: 'fa-bolt'
  },

  serviceNames: {
    ssh: 'SSH Directo',
    stunnel: 'SSL/TLS (Stunnel)',
    squid: 'Squid Proxy',
    v2ray: 'V2Ray / Xray',
    websocket: 'WebSocket Tunnel',
    badvpn: 'BadVPN (UDP Gateway)',
    hysteria: 'Hysteria v2'
  },

  serviceDescriptions: {
    ssh: 'Conexión SSH directa al servidor. Modifica /etc/ssh/sshd_config.',
    stunnel: 'Túnel SSL/TLS con certificados Let\'s Encrypt.',
    squid: 'Proxy HTTP con cabeceras para HTTP Custom / Injector.',
    v2ray: 'Protocolos VMess y VLESS con transporte WebSocket.',
    websocket: 'Túnel WebSocket para aplicaciones como HTTP Custom.',
    badvpn: 'Soporte para juegos y llamadas (UDP Gateway Port 7300).',
    hysteria: 'Protocolo de alta velocidad basado en UDP (brincando GFW).'
  },

  async render() {
    const content = document.getElementById('content');
    content.innerHTML = '<div class="spinner"></div>';

    try {
      const [statusData, healthData] = await Promise.all([
        API.get('/api/services/status'),
        API.get('/api/services/health').catch(() => ({ summary: null, protocols: [] }))
      ]);
      const services = statusData.services || [];
      this.healthData = healthData;

      const healthySummary = healthData.summary
        ? `<span style="color:${healthData.summary.allGood ? 'var(--green)' : 'var(--orange)'}"><i class="fas fa-heart-pulse"></i> ${healthData.summary.healthy}/${healthData.summary.enabled} protocolos OK</span>`
        : '<span style="color:var(--text-secondary)"><i class="fas fa-heart-pulse"></i> Diagnóstico no disponible</span>';

      const protocolBadges = (healthData.protocols || []).map(p => {
        const color = p.ready ? 'badge-green' : (p.enabled ? 'badge-orange' : 'badge-red');
        const label = p.ready ? 'OK' : (p.enabled ? 'Falla' : 'Off');
        return `<span class="badge ${color}" title="${p.issues && p.issues.length ? Utils.escapeHtml(p.issues.join(' | ')) : ''}">${Utils.escapeHtml(p.label)}: ${label}</span>`;
      }).join(' ');

      const repairButton = App.user && App.user.role === 'admin'
        ? '<button class="btn btn-outline" onclick="ServicesModule.repairServices()"><i class="fas fa-screwdriver-wrench"></i> Auto-reparar</button>'
        : '';

      content.innerHTML = `
        <div class="toolbar">
          <div class="toolbar-left">
            <span style="color:var(--text-secondary)"><i class="fas fa-server"></i> ${services.filter(s => s.running).length}/${services.length} servicios activos</span>
            ${healthySummary}
          </div>
          <div style="display:flex;gap:8px;align-items:center">
            ${repairButton}
          </div>
        </div>

        ${(healthData.protocols && healthData.protocols.length > 0) ? `
          <div class="card" style="margin-bottom:16px">
            <div class="card-header">
              <h3 class="card-title"><i class="fas fa-stethoscope"></i> Salud de Protocolos (HTTP Custom / HTTP Injector)</h3>
            </div>
            <div style="display:flex;flex-wrap:wrap;gap:8px">${protocolBadges}</div>
          </div>
        ` : ''}

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
    const running = !!s.running;
    const protectedService = s.name === 'ssh';
    const health = this.healthData && this.healthData.services
      ? this.healthData.services.find(x => x.name === s.name)
      : null;
    const healthBadge = health
      ? (health.healthy
          ? '<span class="badge badge-green">Salud: OK</span>'
          : (health.enabled
              ? `<span class="badge badge-orange" title="${Utils.escapeHtml((health.issues || []).join(' | '))}">Salud: Falla</span>`
              : '<span class="badge badge-red">Salud: Inactivo</span>'))
      : '<span class="badge badge-blue">Salud: N/D</span>';

    return `
      <div class="service-card ${running ? 'running' : 'stopped'}" data-service="${s.name}">
        <div class="service-card-header">
          <div class="service-name">
            <i class="fas ${icon}" style="color:${running ? 'var(--green)' : 'var(--text-muted)'}"></i>
            ${name}
          </div>
          <label class="toggle-switch">
            <input type="checkbox" ${running ? 'checked' : ''} ${protectedService ? 'disabled' : ''} onchange="ServicesModule.toggleService('${s.name}')">
            <span class="toggle-slider"></span>
          </label>
        </div>
        <p style="color:var(--text-secondary);font-size:0.82rem;margin-bottom:14px">${desc}${protectedService ? ' SSH puerto 22 protegido siempre activo.' : ''}</p>
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
        <div style="margin-top:10px">${healthBadge}</div>
      </div>
    `;
  },

  async repairServices() {
    try {
      Toast.info('Ejecutando auto-reparación de protocolos...');
      const result = await API.post('/api/services/health/repair');
      const repairedText = result.repaired && result.repaired.length ? result.repaired.join(', ') : 'ninguno';
      Toast.success(`Auto-reparación completa. Reiniciados: ${repairedText}`);
      this.render();
    } catch (err) {
      Toast.error(err.message);
      this.render();
    }
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
      const statusText = card.querySelector('.service-info-item:last-child');
      const icon = card.querySelector('.service-name i');
      if (dot) {
        dot.className = `service-status-dot ${info.listening ? 'on' : 'off'}`;
      }
      if (statusText) {
        statusText.innerHTML = `<span class="service-status-dot ${info.listening ? 'on' : 'off'}"></span>${info.listening ? 'Activo' : 'Inactivo'}`;
      }
      if (icon) {
        icon.style.color = info.listening ? 'var(--green)' : 'var(--text-muted)';
      }
      card.classList.toggle('running', !!info.listening);
      card.classList.toggle('stopped', !info.listening);
    }
  }
};
