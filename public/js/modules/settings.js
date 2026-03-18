// Settings Module
const SettingsModule = {
  render() {
    const content = document.getElementById('content');
    
    content.innerHTML = `
      <div style="max-width:600px">
        <div class="card" style="margin-bottom:20px">
          <div class="card-header">
            <h3 class="card-title"><i class="fas fa-key"></i> Cambiar Contraseña de Admin</h3>
          </div>
          <div class="form-group">
            <label>Contraseña Actual</label>
            <input class="form-control" id="current-pass" type="password" placeholder="Contraseña actual" />
          </div>
          <div class="form-group">
            <label>Nueva Contraseña</label>
            <input class="form-control" id="new-pass" type="password" placeholder="Nueva contraseña" />
          </div>
          <div class="form-group">
            <label>Confirmar Contraseña</label>
            <input class="form-control" id="confirm-pass" type="password" placeholder="Confirmar nueva contraseña" />
          </div>
          <button class="btn btn-primary" onclick="SettingsModule.changePassword()">
            <i class="fas fa-save"></i> Cambiar Contraseña
          </button>
        </div>

        <div class="card">
          <div class="card-header">
            <h3 class="card-title"><i class="fas fa-info-circle"></i> Información del Panel</h3>
          </div>
          <div style="color:var(--text-secondary);font-size:0.88rem;line-height:2">
            <p><strong>Versión:</strong> La Casita v2026</p>
            <p><strong>Usuario:</strong> ${App.user ? App.user.username : '—'}</p>
            <p><strong>Rol:</strong> ${App.user ? (App.user.role === 'admin' ? 'Administrador' : 'Reseller') : '—'}</p>
            <p><strong>Sesión:</strong> Activa</p>
          </div>
        </div>
      </div>
    `;
  },

  async changePassword() {
    const current = document.getElementById('current-pass').value;
    const newPass = document.getElementById('new-pass').value;
    const confirm = document.getElementById('confirm-pass').value;

    if (!current || !newPass || !confirm) {
      return Toast.error('Complete todos los campos');
    }

    if (newPass !== confirm) {
      return Toast.error('Las contraseñas no coinciden');
    }

    if (newPass.length < 4) {
      return Toast.error('La contraseña debe tener al menos 4 caracteres');
    }

    Toast.info('Función de cambio de contraseña próximamente');
  }
};
