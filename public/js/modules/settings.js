// Settings Module
const SettingsModule = {
  async render() {
    const content = document.getElementById('content');
    content.innerHTML = '<div class="spinner"></div>';
    
    let backups = [];
    let rootStatus = null;
    if (App.user.role === 'admin') {
      try {
        const [backupData, vpsData] = await Promise.all([
          API.get('/api/settings/backup/list'),
          API.get('/api/settings/vps/root-status').catch(() => null)
        ]);
        backups = backupData.backups || [];
        rootStatus = vpsData;
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

        ${App.user.role === 'admin' ? this.renderRootCard(rootStatus) : ''}

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

  renderRootCard(status) {
    const fallback = {
      privilege: { mode: 'none', isRoot: false, canUseSudo: false },
      rootForced: false,
      cloudProvider: 'auto',
      serverUser: 'desconocido',
      ssh: {
        passwordAuthentication: false,
        permitRootLogin: false,
        pubkeyAuthentication: false
      },
      diagnostics: {
        canCreateUsers: false,
        canChangePasswords: false,
        canManageServices: false
      }
    };

    const data = status || fallback;
    const modeLabel = data.privilege.mode === 'root'
      ? 'Root directo'
      : (data.privilege.mode === 'sudo' ? 'Sudo activo' : 'Sin privilegios');
    const modeBadge = data.privilege.mode === 'none' ? 'badge-red' : 'badge-green';

    return `
      <div class="card" style="margin-bottom:24px">
        <div class="card-header">
          <h3 class="card-title"><i class="fas fa-user-shield"></i> Compatibilidad VPS (Forzar Root)</h3>
          <button class="btn btn-danger btn-sm" onclick="SettingsModule.forceRootAccess()">
            <i class="fas fa-bolt"></i> Forzar Root
          </button>
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px">
          <span class="badge ${modeBadge}">Modo: ${modeLabel}</span>
          <span class="badge ${data.rootForced ? 'badge-green' : 'badge-orange'}">Root forzado: ${data.rootForced ? 'SI' : 'NO'}</span>
          <span class="badge badge-blue">Proveedor: ${Utils.escapeHtml(String(data.cloudProvider || 'auto'))}</span>
          <span class="badge badge-blue">Usuario servidor: ${Utils.escapeHtml(String(data.serverUser || 'root'))}</span>
        </div>
        <div style="color:var(--text-secondary);font-size:0.85rem;line-height:1.9">
          <p>SSH PasswordAuthentication: <strong>${data.ssh.passwordAuthentication ? 'yes' : 'no'}</strong></p>
          <p>SSH PermitRootLogin: <strong>${data.ssh.permitRootLogin ? 'yes' : 'no'}</strong></p>
          <p>SSH PubkeyAuthentication: <strong>${data.ssh.pubkeyAuthentication ? 'yes' : 'no'}</strong></p>
          <p>Permisos useradd/chpasswd/systemctl: <strong>${(data.diagnostics.canCreateUsers && data.diagnostics.canChangePasswords && data.diagnostics.canManageServices) ? 'OK' : 'INCOMPLETO'}</strong></p>
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
    const currentPassword = document.getElementById('current-pass').value;
    const newPassword = document.getElementById('new-pass').value;
    const confirmPassword = document.getElementById('confirm-pass').value;

    if (!currentPassword || !newPassword || !confirmPassword) {
      return Toast.error('Complete todos los campos');
    }

    if (newPassword !== confirmPassword) {
      return Toast.error('La confirmación no coincide');
    }

    try {
      await API.post('/api/settings/password/change', { currentPassword, newPassword, confirmPassword });
      Toast.success('Contraseña actualizada correctamente');
      document.getElementById('current-pass').value = '';
      document.getElementById('new-pass').value = '';
      document.getElementById('confirm-pass').value = '';
    } catch (err) {
      Toast.error(err.message);
    }
  },

  forceRootAccess() {
    Modal.confirm(
      'Forzar root en VPS',
      'Esto activara PermitRootLogin yes y PasswordAuthentication yes. Solo continua si entiendes el impacto de seguridad.',
      async () => {
        try {
          Toast.info('Forzando acceso root...');
          const result = await API.post('/api/settings/vps/force-root', {
            provider: 'auto'
          });

          Modal.show(
            'Root configurado',
            `<p style="color:var(--text-secondary);margin-bottom:8px">Guarda esta contraseña inmediatamente. No se mostrara de nuevo:</p>
             <div class="card" style="padding:12px;background:var(--bg-soft)">
               <strong style="word-break:break-all">${Utils.escapeHtml(result.rootPassword || '')}</strong>
             </div>`,
            '<button class="btn btn-primary" onclick="Modal.hide()">Entendido</button>'
          );
          Toast.success('Root forzado con exito');
          this.render();
        } catch (err) {
          Toast.error(err.message);
          this.render();
        }
      }
    );
  }
};
