// Demos Module
const DemosModule = {
  refreshInterval: null,

  async render() {
    const content = document.getElementById('content');
    content.innerHTML = '<div class="spinner"></div>';

    try {
      const data = await API.get('/api/demos');
      const demos = data.demos || [];

      content.innerHTML = `
        <div class="toolbar">
          <div class="toolbar-left">
            <span style="color:var(--text-secondary)"><i class="fas fa-clock"></i> ${demos.length} demo(s) activa(s)</span>
          </div>
          <div style="display:flex;gap:8px;align-items:center">
            <select id="demo-duration" class="form-control" style="width:auto">
              <option value="30">30 min</option>
              <option value="60">1 hora</option>
              <option value="120">2 horas</option>
            </select>
            <button class="btn btn-primary" onclick="DemosModule.createDemo()">
              <i class="fas fa-bolt"></i> Crear Demo
            </button>
          </div>
        </div>

        <div class="card">
          <div class="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Usuario</th>
                  <th>Duración</th>
                  <th>Tiempo Restante</th>
                  <th>Creado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody id="demos-table-body">
                ${demos.length === 0 ? `
                  <tr><td colspan="5"><div class="empty-state"><i class="fas fa-clock"></i><p>No hay demos activas</p></div></td></tr>
                ` : demos.map(d => this.renderRow(d)).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;

      // Auto-refresh timer
      if (this.refreshInterval) clearInterval(this.refreshInterval);
      if (demos.length > 0) {
        this.refreshInterval = setInterval(() => this.updateTimers(), 1000);
      }
    } catch (err) {
      content.innerHTML = `<div class="empty-state"><i class="fas fa-exclamation-triangle"></i><p>${err.message}</p></div>`;
    }
  },

  renderRow(d) {
    const minutesLeft = Math.max(0, d.minutes_left || 0);
    return `
      <tr data-demo-id="${d.id}" data-expires="${d.expires_at}">
        <td><strong>${Utils.escapeHtml(d.username)}</strong></td>
        <td>${d.duration_minutes} min</td>
        <td><span class="demo-timer" data-expires="${d.expires_at}">${this.formatTimer(minutesLeft)}</span></td>
        <td>${Utils.formatDateTime(d.created_at)}</td>
        <td>
          <button class="btn-icon danger" title="Eliminar" onclick="DemosModule.deleteDemo(${d.id}, '${Utils.escapeHtml(d.username)}')">
            <i class="fas fa-trash"></i>
          </button>
        </td>
      </tr>
    `;
  },

  formatTimer(minutes) {
    if (minutes <= 0) return '<span style="color:var(--red)">Expirado</span>';
    const h = Math.floor(minutes / 60);
    const m = Math.floor(minutes % 60);
    const s = Math.floor((minutes * 60) % 60);
    
    let str = '';
    if (h > 0) str += `${h}h `;
    str += `${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
    return `<i class="fas fa-hourglass-half"></i> ${str}`;
  },

  updateTimers() {
    const timers = document.querySelectorAll('.demo-timer');
    timers.forEach(el => {
      const expires = new Date(el.dataset.expires);
      const now = new Date();
      const minutesLeft = (expires - now) / 60000;
      el.innerHTML = this.formatTimer(minutesLeft);
      
      if (minutesLeft <= 0) {
        // Refresh to clean up
        setTimeout(() => this.render(), 2000);
      }
    });
  },

  async createDemo() {
    const duration = document.getElementById('demo-duration').value;
    
    try {
      const res = await API.post('/api/demos', { duration });
      Toast.success(`Demo creada: ${res.demo.username} / ${res.demo.password}`);
      
      // Show credentials
      Modal.show('Demo Creada', `
        <div style="text-align:center;padding:16px 0">
          <i class="fas fa-check-circle" style="font-size:3rem;color:var(--green);margin-bottom:16px;display:block"></i>
          <div class="form-group" style="text-align:left">
            <label>Usuario</label>
            <input class="form-control" value="${res.demo.username}" readonly onclick="this.select()" />
          </div>
          <div class="form-group" style="text-align:left">
            <label>Contraseña</label>
            <input class="form-control" value="${res.demo.password}" readonly onclick="this.select()" />
          </div>
          <p style="color:var(--text-secondary);font-size:0.85rem;margin-top:8px">
            <i class="fas fa-clock"></i> Expira en ${res.demo.duration} minutos
          </p>
        </div>
      `, `<button class="btn btn-primary" onclick="Modal.hide()">Cerrar</button>`);
      
      this.render();
    } catch (err) {
      Toast.error(err.message);
    }
  },

  deleteDemo(id, username) {
    Modal.confirm(
      'Eliminar Demo',
      `¿Eliminar la demo <strong>${username}</strong>?`,
      async () => {
        try {
          await API.delete(`/api/demos/${id}`);
          Toast.success('Demo eliminada');
          this.render();
        } catch (err) {
          Toast.error(err.message);
        }
      }
    );
  },

  destroy() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
  }
};
