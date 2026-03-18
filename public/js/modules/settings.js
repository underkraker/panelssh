// Settings Module
const SettingsModule = {
  async render() {
    const content = document.getElementById('content');
    content.innerHTML = '<div class="spinner"></div>';
    
    let backups = [];
    if (App.user.role === 'admin') {
      try {
        const data = await API.get('/api/settings/backup/list');
        backups = data.backups || [];
      } catch (e) {
        console.error('Error fetching backups:', e);
      }
    }

    content.innerHTML = `
      <div style="max-width:800px; margin: 0 auto;">
        <div class="card" style="margin-bottom:24px">
          <div class="card-header">
            <h3 class="card-title"><i class="fas fa-key"></i> Cambiar Contraseña de Admin</h3>
          </div>
          <div class="form-group">
            <label>Contraseña Actual</label>
            <input class="form-control" id="current-pass" type="password" placeholder="Contraseña actual" />
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Nueva Contraseña</label>
              <input class="form-control" id="new-pass" type="password" placeholder="Nueva contraseña" />
            </div>
            <div class="form-group">
              <label>Confirmar Contraseña</label>
              <input class="form-control" id="confirm-pass" type="password" placeholder="Confirmar nueva contraseña" />
            </div>
          </div>
          <button class="btn btn-primary" onclick="SettingsModule.changePassword()">
            <i class="fas fa-save"></i> Actualizar Seguridad
          </button>
        </div>

        ${App.user.role === 'admin' ? `
        <div class="card" style="margin-bottom:24px">
          <div class="card-header">
            <h3 class="card-title"><i class="fas fa-database"></i> Respaldos de Base de Datos</h3>
            <button class="btn btn-sm btn-primary" onclick="SettingsModule.createBackup()">
              <i class="fas fa-plus"></i> Crear Respaldo
            </button>
          </div>
          <p style="color:var(--text-secondary);font-size:0.85rem;margin-bottom:16px">
            Se mantienen los últimos 5 respaldos automáticos.
          </p>
          <div class="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Archivo</th>
                  <th>Tamaño</th>
                  <th>Fecha</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                ${backups.length === 0 ? `
                  <tr><td colspan="4" class="empty-state" style="padding:20px">No hay respaldos disponibles</td></tr>
                ` : backups.map(b => `
                  <tr>
                    <td><i class="fas fa-file-archive" style="color:var(--orange)"></i> ${b.name}</td>
                    <td>${b.size}</td>
                    <td>${Utils.formatDateTime(b.time)}</td>
                    <td>
                      <a href="/api/settings/backup/download/${b.name}" class="btn-icon" title="Descargar">
                        <i class="fas fa-download"></i>
                      </a>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
        ` : ''}

        <div class="card">
          <div class="card-header">
            <h3 class="card-title"><i class="fas fa-info-circle"></i> Información del Panel</h3>
          </div>
          <div style="color:var(--text-secondary);font-size:0.88rem;line-height:2">
            <p><strong>Versión:</strong> La Casita v2026</p>
            <p><strong>Usuario:</strong> ${App.user ? App.user.username : '—'}</p>
            <p><strong>Rol:</strong> ${App.user ? (App.user.role === 'admin' ? 'Administrador' : 'Reseller') : '—'}</p>
            <p><strong>Entorno:</strong> Producción / Linux</p>
          </div>
        </div>
      </div>
    `;
  },

  async createBackup() {
    try {
      Toast.info('Creando respaldo...');
      await API.post('/api/settings/backup/create');
      Toast.success('Respaldo creado con éxito');
      this.render();
    } catch (err) {
      Toast.error(err.message);
    }
  },

  async changePassword() {
    Toast.info('Funcionalidad de seguridad en desarrollo');
  }
};
