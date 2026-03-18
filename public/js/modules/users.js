// Users Module
const UsersModule = {
  async render() {
    const content = document.getElementById('content');
    content.innerHTML = '<div class="spinner"></div>';

    try {
      const data = await API.get('/api/users');
      const users = data.users || [];

      content.innerHTML = `
        <div class="toolbar">
          <div class="toolbar-left">
            <div class="search-box">
              <i class="fas fa-search"></i>
              <input type="text" id="user-search" placeholder="Buscar usuarios..." />
            </div>
          </div>
          <button class="btn btn-primary" onclick="UsersModule.showCreateModal()">
            <i class="fas fa-user-plus"></i> Nuevo Usuario
          </button>
        </div>

        <div class="card">
          <div class="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Usuario</th>
                  <th>Dispositivos</th>
                  <th>Expiración</th>
                  <th>Días</th>
                  <th>Estado</th>
                  <th>Creado por</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody id="users-table-body">
                ${users.length === 0 ? `
                  <tr><td colspan="7" class="empty-state"><i class="fas fa-users"></i><p>No hay usuarios</p></td></tr>
                ` : users.map(u => this.renderRow(u)).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;

      // Search
      document.getElementById('user-search').addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase();
        const rows = document.querySelectorAll('#users-table-body tr');
        rows.forEach(row => {
          const text = row.textContent.toLowerCase();
          row.style.display = text.includes(query) ? '' : 'none';
        });
      });
    } catch (err) {
      content.innerHTML = `<div class="empty-state"><i class="fas fa-exclamation-triangle"></i><p>${err.message}</p></div>`;
    }
  },

  renderRow(u) {
    return `
      <tr data-user-id="${u.id}">
        <td><strong>${Utils.escapeHtml(u.username)}</strong></td>
        <td>${u.device_limit}</td>
        <td>${Utils.formatDate(u.expiry_date)}</td>
        <td>${Utils.daysLeftBadge(u.days_left)}</td>
        <td>${Utils.statusBadge(u.status)}</td>
        <td>${Utils.escapeHtml(u.created_by_name || '—')}</td>
        <td>
          <div style="display:flex;gap:4px">
            <button class="btn-icon" title="Editar" onclick="UsersModule.showEditModal(${u.id})"><i class="fas fa-pen"></i></button>
            <button class="btn-icon" title="${u.status === 'banned' ? 'Desbanear' : 'Banear'}" onclick="UsersModule.toggleBan(${u.id})">
              <i class="fas fa-${u.status === 'banned' ? 'unlock' : 'ban'}"></i>
            </button>
            <button class="btn-icon" title="Reset Pass" onclick="UsersModule.resetPassword(${u.id}, '${Utils.escapeHtml(u.username)}')"><i class="fas fa-key"></i></button>
            <button class="btn-icon danger" title="Eliminar" onclick="UsersModule.deleteUser(${u.id}, '${Utils.escapeHtml(u.username)}')"><i class="fas fa-trash"></i></button>
          </div>
        </td>
      </tr>
    `;
  },

  showCreateModal() {
    Modal.show('Nuevo Usuario', `
      <form id="create-user-form">
        <div class="form-group">
          <label>Nombre de Usuario</label>
          <input class="form-control" id="new-username" placeholder="usuario123" required />
        </div>
        <div class="form-group">
          <label>Contraseña</label>
          <input class="form-control" id="new-password" type="text" placeholder="contraseña" required />
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Límite de Dispositivos</label>
            <input class="form-control" id="new-device-limit" type="number" min="1" max="10" value="1" />
          </div>
          <div class="form-group">
            <label>Expiración</label>
            <input class="form-control" id="new-expiry" type="date" min="${Utils.todayDate()}" value="${Utils.futureDate(30)}" required />
          </div>
        </div>
      </form>
    `, `
      <button class="btn btn-outline" onclick="Modal.hide()">Cancelar</button>
      <button class="btn btn-primary" id="btn-create-user">
        <i class="fas fa-user-plus"></i> Crear
      </button>
    `);

    document.getElementById('btn-create-user').onclick = async () => {
      const username = document.getElementById('new-username').value.trim();
      const password = document.getElementById('new-password').value;
      const device_limit = parseInt(document.getElementById('new-device-limit').value);
      const expiry_date = document.getElementById('new-expiry').value;

      if (!username || !password || !expiry_date) {
        return Toast.error('Complete todos los campos');
      }

      try {
        await API.post('/api/users', { username, password, device_limit, expiry_date });
        Toast.success(`Usuario ${username} creado`);
        Modal.hide();
        this.render();
      } catch (err) {
        Toast.error(err.message);
      }
    };
  },

  async showEditModal(id) {
    try {
      const data = await API.get('/api/users');
      const user = data.users.find(u => u.id === id);
      if (!user) return Toast.error('Usuario no encontrado');

      Modal.show('Editar Usuario', `
        <form id="edit-user-form">
          <div class="form-group">
            <label>Usuario</label>
            <input class="form-control" value="${Utils.escapeHtml(user.username)}" disabled />
          </div>
          <div class="form-group">
            <label>Nueva Contraseña (dejar vacío para no cambiar)</label>
            <input class="form-control" id="edit-password" type="text" placeholder="nueva contraseña" />
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Límite de Dispositivos</label>
              <input class="form-control" id="edit-device-limit" type="number" min="1" max="10" value="${user.device_limit}" />
            </div>
            <div class="form-group">
              <label>Expiración</label>
              <input class="form-control" id="edit-expiry" type="date" value="${user.expiry_date}" />
            </div>
          </div>
        </form>
      `, `
        <button class="btn btn-outline" onclick="Modal.hide()">Cancelar</button>
        <button class="btn btn-primary" id="btn-save-user">
          <i class="fas fa-save"></i> Guardar
        </button>
      `);

      document.getElementById('btn-save-user').onclick = async () => {
        const body = {};
        const password = document.getElementById('edit-password').value;
        const device_limit = parseInt(document.getElementById('edit-device-limit').value);
        const expiry_date = document.getElementById('edit-expiry').value;

        if (password) body.password = password;
        if (device_limit) body.device_limit = device_limit;
        if (expiry_date) body.expiry_date = expiry_date;

        try {
          await API.put(`/api/users/${id}`, body);
          Toast.success('Usuario actualizado');
          Modal.hide();
          this.render();
        } catch (err) {
          Toast.error(err.message);
        }
      };
    } catch (err) {
      Toast.error(err.message);
    }
  },

  async toggleBan(id) {
    try {
      const res = await API.post(`/api/users/${id}/ban`);
      Toast.success(res.status === 'banned' ? 'Usuario baneado' : 'Usuario desbaneado');
      this.render();
    } catch (err) {
      Toast.error(err.message);
    }
  },

  resetPassword(id, username) {
    Modal.show('Resetear Contraseña', `
      <p style="color:var(--text-secondary);margin-bottom:16px">Nueva contraseña para <strong>${username}</strong>:</p>
      <div class="form-group">
        <input class="form-control" id="reset-pass-input" type="text" placeholder="Nueva contraseña" />
      </div>
    `, `
      <button class="btn btn-outline" onclick="Modal.hide()">Cancelar</button>
      <button class="btn btn-primary" id="btn-reset-pass">
        <i class="fas fa-key"></i> Resetear
      </button>
    `);

    document.getElementById('btn-reset-pass').onclick = async () => {
      const password = document.getElementById('reset-pass-input').value;
      if (!password) return Toast.error('Ingrese una contraseña');
      try {
        await API.post(`/api/users/${id}/reset-password`, { password });
        Toast.success('Contraseña reseteada');
        Modal.hide();
      } catch (err) {
        Toast.error(err.message);
      }
    };
  },

  deleteUser(id, username) {
    Modal.confirm(
      'Eliminar Usuario',
      `¿Está seguro de eliminar a <strong>${username}</strong>? Esta acción eliminará el usuario del sistema.`,
      async () => {
        try {
          await API.delete(`/api/users/${id}`);
          Toast.success(`Usuario ${username} eliminado`);
          this.render();
        } catch (err) {
          Toast.error(err.message);
        }
      }
    );
  }
};
